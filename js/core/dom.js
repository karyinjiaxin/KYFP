/* ============================================================
   dom.js — small DOM helpers shared by every module
   ============================================================ */

var Dom = (function () {
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      } else if (attrs[k] !== undefined && attrs[k] !== null) {
        node.setAttribute(k, attrs[k]);
      }
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      // coerce numbers/booleans to text nodes to avoid appendChild errors
      if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
        node.appendChild(document.createTextNode(String(c)));
      } else {
        node.appendChild(c);
      }
    });
    return node;
  }

  function fmtMoney(n, opts) {
    opts = opts || {};
    n = Number(n) || 0;
    var sign = n < 0 ? '-' : '';
    var abs = Math.abs(n);
    var decimals = opts.decimals !== undefined ? opts.decimals : 0;
    return sign + 'S$' + abs.toLocaleString('en-SG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function fmtPct(n, decimals) {
    n = Number(n) || 0;
    return n.toFixed(decimals === undefined ? 1 : decimals) + '%';
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function debounce(fn, wait) {
    var t;
    var wrapped = function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
    // Exposed so a subscriber can cancel an already-queued call — e.g.
    // when the router switches routes right after a Store change, the
    // OLD page's debounced re-render would otherwise still fire ~30ms
    // later and overwrite the NEW page's just-rendered content, even
    // though that old page has already been "unsubscribed". Unsubscribing
    // alone only stops FUTURE triggers, not one already in flight.
    wrapped.cancel = function () { clearTimeout(t); };
    return wrapped;
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 10);
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ----------------------------------------------------------------
  // Path-keyed commit scheduler. This exists because of a real race
  // condition: every field used to build its own debounce timer fresh
  // on each re-render, and the whole page re-renders whenever ANY
  // field commits. If field A was mid-edit when field B's commit
  // triggered a redraw, A's DOM node got destroyed and recreated —
  // but A's OLD pending timer kept running (JS timers aren't tied to
  // DOM lifecycle). If the user kept typing into the new A node, a
  // SECOND timer started. Whichever fired last won — so a stale timer
  // could silently overwrite newer typing. Keying the timer by the
  // field's data-path instead of by DOM node/closure fixes this:
  // scheduling a new commit for a path always cancels any previous
  // pending commit for that same path, no matter which "generation"
  // of DOM node scheduled it.
  // ----------------------------------------------------------------
  var pendingCommits = {};
  function scheduleCommit(path, fn, wait) {
    if (pendingCommits[path]) clearTimeout(pendingCommits[path]);
    pendingCommits[path] = setTimeout(function () {
      delete pendingCommits[path];
      fn();
    }, wait);
  }

  // Re-render `container` via renderFn() without disrupting an input the
  // user is actively typing into. Two things can go wrong on a full
  // re-render and both are handled here:
  //  1) type="number" inputs don't support setSelectionRange at all, so the
  //     cursor lands wherever the browser defaults it — callers should use
  //     type="text" + inputmode for anything numeric (see fields.js).
  //  2) ANY field's debounced commit triggers a full page re-render, which
  //     would rebuild every OTHER field from its last-saved Store value —
  //     silently discarding whatever the user is mid-typing elsewhere on
  //     the page. We snapshot the live DOM value of the focused field
  //     before rendering and reapply it after, so a keystroke is never
  //     visually lost regardless of which field's commit triggered this.
  function withFocusPreserved(container, renderFn) {
    var active = document.activeElement;
    var restore = null;
    if (active && container.contains(active) && active.hasAttribute && active.hasAttribute('data-path')) {
      restore = {
        path: active.getAttribute('data-path'),
        value: active.value,
        selStart: active.selectionStart,
        selEnd: active.selectionEnd
      };
    }
    renderFn();
    if (restore) {
      var next = container.querySelector('[data-path="' + CSS.escape(restore.path) + '"]');
      if (next) {
        if (next.value !== restore.value) next.value = restore.value;
        next.focus();
        try { next.setSelectionRange(restore.selStart, restore.selEnd); } catch (e) {}
      }
    }
  }

  // Custom modal dialogs — built from regular DOM elements rather than
  // window.confirm/prompt/alert. Native browser dialogs are unreliable
  // for file:// pages in some browsers/webviews (silently blocked or
  // auto-dismissed with no error), which would make any button relying
  // on them appear to do nothing at all when clicked. These are fully
  // self-contained and don't depend on any browser dialog support.
  function closeModal(overlay) { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); }

  function modalConfirm(message, onConfirm, opts) {
    opts = opts || {};
    var overlay = el('div', { class: 'modal-overlay' });
    var box = el('div', { class: 'modal-box' }, [
      el('div', { class: 'modal-message' }, [message]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-ghost', onclick: function () { closeModal(overlay); if (opts.onCancel) opts.onCancel(); } }, [opts.cancelLabel || 'Cancel']),
        el('button', {
          class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'),
          onclick: function () { closeModal(overlay); onConfirm(); }
        }, [opts.confirmLabel || 'OK'])
      ])
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { closeModal(overlay); if (opts.onCancel) opts.onCancel(); } });
    document.body.appendChild(overlay);
  }

  function modalPrompt(message, onSubmit, opts) {
    opts = opts || {};
    var overlay = el('div', { class: 'modal-overlay' });
    var input = el('input', { type: 'text', class: 'modal-input', value: opts.defaultValue || '', placeholder: opts.placeholder || '' });
    var box = el('div', { class: 'modal-box' }, [
      el('div', { class: 'modal-message' }, [message]),
      input,
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-ghost', onclick: function () { closeModal(overlay); if (opts.onCancel) opts.onCancel(); } }, ['Cancel']),
        el('button', {
          class: 'btn btn-primary',
          onclick: function () { var v = input.value.trim(); closeModal(overlay); if (v) onSubmit(v); else if (opts.onCancel) opts.onCancel(); }
        }, [opts.confirmLabel || 'OK'])
      ])
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { closeModal(overlay); if (opts.onCancel) opts.onCancel(); } });
    document.body.appendChild(overlay);
    setTimeout(function () { input.focus(); input.select(); }, 30);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var v = input.value.trim(); closeModal(overlay); if (v) onSubmit(v); }
      if (e.key === 'Escape') { closeModal(overlay); if (opts.onCancel) opts.onCancel(); }
    });
  }

  function modalAlert(message, onClose) {
    var overlay = el('div', { class: 'modal-overlay' });
    var box = el('div', { class: 'modal-box' }, [
      el('div', { class: 'modal-message' }, [message]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn btn-primary', onclick: function () { closeModal(overlay); if (onClose) onClose(); } }, ['OK'])
      ])
    ]);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  return {
    el: el, fmtMoney: fmtMoney, fmtPct: fmtPct, clamp: clamp, debounce: debounce, uid: uid, qs: qs, qsa: qsa,
    withFocusPreserved: withFocusPreserved, scheduleCommit: scheduleCommit,
    modalConfirm: modalConfirm, modalPrompt: modalPrompt, modalAlert: modalAlert
  };
})();
