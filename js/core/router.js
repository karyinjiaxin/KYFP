/* ============================================================
   router.js — hash-based SPA router, no page reloads
   ============================================================ */

var Router = (function () {
  var routes = {};
  var container = null;
  var currentUnsub = null;
  var currentKey = null;

  function register(key, moduleObj) {
    routes[key] = moduleObj;
  }

  function navigate(key) {
    window.location.hash = key;
  }

  function renderCurrent() {
    var key = (window.location.hash || '#dashboard').replace('#', '');
    if (!routes[key]) key = 'dashboard';
    currentKey = key;

    if (currentUnsub) { try { currentUnsub(); } catch (e) {} currentUnsub = null; }
    container.innerHTML = '';

    var mod = routes[key];
    if (mod && typeof mod.render === 'function') {
      try {
        var maybeUnsub = mod.render(container);
        if (typeof maybeUnsub === 'function') currentUnsub = maybeUnsub;
      } catch (err) {
        // A module throwing used to leave the page silently blank — the
        // single most confusing failure mode for someone testing a fresh
        // deploy (e.g. a new file wasn't uploaded alongside a code
        // change). Show the actual error instead of nothing.
        container.innerHTML = '';
        var box = document.createElement('div');
        box.className = 'card';
        box.style.cssText = 'border-color:var(--bad);background:var(--bad-soft);margin:20px';
        box.innerHTML = '<div style="font-weight:700;margin-bottom:8px">This page hit an error and couldn\u2019t load</div>' +
          '<div style="font-size:13px;margin-bottom:8px">' + (err && err.message ? err.message : String(err)) + '</div>' +
          '<div style="font-size:12px;opacity:0.8">This usually means a required file is missing or out of date — try re-uploading the full set of files.</div>';
        container.appendChild(box);
        console.error('Router: module "' + key + '" failed to render:', err);
      }
    }
    Sidebar.setActive(key);
    document.title = 'Wealth Platform — ' + (mod && mod.title ? mod.title : key);
    container.scrollTop = 0;
  }

  return {
    init: function (containerEl) {
      container = containerEl;
      window.addEventListener('hashchange', renderCurrent);
      renderCurrent();
    },
    register: register,
    navigate: navigate,
    current: function () { return currentKey; }
  };
})();
