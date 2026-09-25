/* ============================================================
   fields.js — bound form fields. Every input writes straight
   to Store at the given path, which triggers re-renders across
   every subscribed module automatically. Inputs carry data-path
   so Dom.withFocusPreserved can restore focus/cursor/live-value
   after a re-render.

   Numeric fields use type="text" + inputmode, not type="number".
   Native type="number" inputs can't support setSelectionRange at
   all (it throws), so the cursor jumps to an unpredictable spot
   on every re-render. They also display with thousands commas
   (1,000,000) while typing, with cursor position kept correct as
   commas are inserted/removed on the fly.

   Commits are scheduled through Dom.scheduleCommit, keyed by the
   field's data-path — NOT a per-instance debounce closure. This
   matters on dense forms (Cashflow, Net Worth, Insurance...): the
   whole page re-renders on every commit, so a field being edited
   gets its DOM node destroyed and recreated whenever ANY other
   field commits. A per-instance timer would go stale/orphaned in
   that situation and could fire out of order, silently overwriting
   newer typing with older data. Keying by path instead means a new
   keystroke always cancels whatever was previously scheduled for
   that exact field, regardless of which DOM "generation" it came
   from.
   ============================================================ */

var Fields = (function () {
  var COMMIT_DELAY = 350;

  function sanitizeNumberString(v) {
    // allow digits, one leading minus, one decimal point — strip everything
    // else (currency symbols, commas, stray letters from paste, etc.), and
    // drop leading zeros ("05" -> "5") so a fresh "0" field doesn't need to
    // be manually cleared before typing a real number over it.
    v = String(v == null ? '' : v);
    var negative = v.trim().charAt(0) === '-';
    var cleaned = v.replace(/[^0-9.]/g, '');
    var firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) {
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    }
    cleaned = cleaned.replace(/^0+(?=\d)/, '');
    return (negative ? '-' : '') + cleaned;
  }

  function formatWithCommas(numStr) {
    var negative = numStr.charAt(0) === '-';
    var s = negative ? numStr.slice(1) : numStr;
    var parts = s.split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (negative ? '-' : '') + intPart + (parts.length > 1 ? '.' + parts[1] : '');
  }

  function numericInput(path, label, opts, withPrefix) {
    opts = opts || {};
    var wrap = Dom.el('div', { class: 'field' });
    if (label) wrap.appendChild(Dom.el('label', { class: 'field-label' }, [label]));
    var input = Dom.el('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', 'data-path': path,
      value: formatWithCommas(String(Calc.num(Store.get(path)))),
      oninput: function (e) {
        var el = e.target;
        var oldValue = el.value;
        var oldCursor = el.selectionStart;
        var commasBeforeOld = (oldValue.slice(0, oldCursor).match(/,/g) || []).length;
        var rawCursor = oldCursor - commasBeforeOld;

        var raw = sanitizeNumberString(oldValue.replace(/,/g, ''));
        var formatted = formatWithCommas(raw);

        // walk the newly-formatted string, counting non-comma characters
        // until we've matched the cursor's position in the raw (uncomma'd)
        // string, so the caret lands in the same logical spot even though
        // commas may have been inserted or removed around it.
        var newCursor = 0, rawCount = 0;
        while (newCursor < formatted.length && rawCount < rawCursor) {
          if (formatted.charAt(newCursor) !== ',') rawCount++;
          newCursor++;
        }

        el.value = formatted;
        try { el.setSelectionRange(newCursor, newCursor); } catch (err) {}

        Dom.scheduleCommit(path, function () { Store.set(path, Number(raw) || 0); }, COMMIT_DELAY);
      }
    });
    if (withPrefix) {
      var prefixWrap = Dom.el('div', { class: 'input-prefix' }, [Dom.el('span', {}, ['S$']), input]);
      wrap.appendChild(prefixWrap);
    } else {
      wrap.appendChild(input);
    }
    return wrap;
  }

  function moneyInput(path, label, opts) { return numericInput(path, label, opts, true); }
  function numberInput(path, label, opts) { return numericInput(path, label, opts, false); }

  function textInput(path, label, opts) {
    opts = opts || {};
    var wrap = Dom.el('div', { class: 'field' });
    if (label) wrap.appendChild(Dom.el('label', { class: 'field-label' }, [label]));
    var tag = opts.multiline ? 'textarea' : 'input';
    var isDate = !opts.multiline && opts.type === 'date';
    var attrs = { 'data-path': path };
    if (opts.placeholder) attrs.placeholder = opts.placeholder;
    if (isDate) {
      // Native date inputs report an empty value while a segment (e.g. the
      // year) is only partially typed. Committing on every keystroke would
      // write that empty value to the store and wipe the field mid-edit —
      // so date fields commit only on 'change' (segment/field fully set or
      // blurred), never on 'input'.
      attrs.onchange = function (e) { Store.set(path, e.target.value); };
    } else {
      attrs.oninput = function (e) {
        var val = e.target.value;
        Dom.scheduleCommit(path, function () { Store.set(path, val); }, COMMIT_DELAY);
      };
    }
    if (!opts.multiline) { attrs.type = opts.type || 'text'; attrs.value = Store.get(path) || ''; }
    else { attrs.rows = opts.rows || 3; }
    var input = Dom.el(tag, attrs);
    if (opts.multiline) input.value = Store.get(path) || '';
    wrap.appendChild(input);
    return wrap;
  }

  function selectInput(path, label, options) {
    var wrap = Dom.el('div', { class: 'field' });
    if (label) wrap.appendChild(Dom.el('label', { class: 'field-label' }, [label]));
    var current = Store.get(path);
    var select = Dom.el('select', {
      'data-path': path,
      onchange: function (e) { Store.set(path, e.target.value); }
    });
    options.forEach(function (opt) {
      var o = Dom.el('option', { value: opt }, [opt]);
      if (opt === current) o.setAttribute('selected', 'selected');
      select.appendChild(o);
    });
    wrap.appendChild(select);
    return wrap;
  }

  // Focuses a bound field by its data-path and selects its content, so
  // typing immediately replaces a default value ("New Item", "0") instead
  // of requiring a manual clear first. Called after adding a new row.
  // Uses setTimeout (not requestAnimationFrame) because the module's own
  // re-render is itself debounced by ~30ms after a Store.set — rAF fires
  // before that redraw has actually created the new field's DOM node.
  function focusAndSelect(path) {
    setTimeout(function () {
      var el = document.querySelector('[data-path="' + CSS.escape(path) + '"]');
      if (el) {
        el.focus();
        if (typeof el.select === 'function') el.select();
      }
    }, 60);
  }

  // Auto-formats a date of birth as DD/MM/YYYY while typing — entering
  // "01011990" becomes "01/01/1990" automatically, without the user
  // needing to type the slashes themselves. Cursor position is tracked
  // the same way moneyInput tracks it around inserted commas, so typing
  // mid-string (e.g. fixing a digit) doesn't jump the cursor around.
  function dobInput(path, label, opts) {
    opts = opts || {};
    var wrap = Dom.el('div', { class: 'field' });
    if (label) wrap.appendChild(Dom.el('label', { class: 'field-label' }, [label]));
    var input = Dom.el('input', {
      type: 'text', inputmode: 'numeric', autocomplete: 'off', 'data-path': path,
      placeholder: opts.placeholder || 'DD/MM/YYYY',
      value: Store.get(path) || '',
      oninput: function (e) {
        var el = e.target;
        var oldValue = el.value;
        var oldCursor = el.selectionStart;
        var slashesBeforeOld = (oldValue.slice(0, oldCursor).match(/\//g) || []).length;
        var rawCursor = oldCursor - slashesBeforeOld;

        var digitsOnly = oldValue.replace(/\D/g, '').slice(0, 8);
        var formatted = digitsOnly.slice(0, 2);
        if (digitsOnly.length > 2) formatted += '/' + digitsOnly.slice(2, 4);
        if (digitsOnly.length > 4) formatted += '/' + digitsOnly.slice(4, 8);

        var slashesBeforeNew = (rawCursor > 2 ? 1 : 0) + (rawCursor > 4 ? 1 : 0);
        var newCursor = Math.min(formatted.length, rawCursor + slashesBeforeNew);

        el.value = formatted;
        el.setSelectionRange(newCursor, newCursor);
        Dom.scheduleCommit(path, function () { Store.set(path, formatted); }, COMMIT_DELAY);
      }
    });
    wrap.appendChild(input);
    return wrap;
  }

  return { moneyInput: moneyInput, numberInput: numberInput, textInput: textInput, selectInput: selectInput, dobInput: dobInput, focusAndSelect: focusAndSelect };
})();
