/* ============================================================
   state.js — Single source of truth reactive store
   Dot-path get/set + pub/sub + localStorage persistence.
   Every module reads/writes through this. No module owns data.
   ============================================================ */

var Store = (function () {
  var STORAGE_KEY = 'wealthPlatform.client.v1';
  var CLIENTS_KEY = 'wealthPlatform.savedClients.v1';
  var CURRENT_CLIENT_ID_KEY = 'wealthPlatform.currentClientId';
  var data = {};
  var listeners = []; // { path: 'a.b.c' | '*', fn }

  function getPath(obj, path) {
    if (!path) return obj;
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      if (cur[key] === undefined || cur[key] === null || typeof cur[key] !== 'object') {
        // detect array index next
        var nextKey = parts[i + 1];
        cur[key] = /^\d+$/.test(nextKey) ? [] : {};
      }
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function notify(path) {
    for (var i = 0; i < listeners.length; i++) {
      var l = listeners[i];
      if (l.path === '*' || path === l.path || path.indexOf(l.path + '.') === 0 || l.path.indexOf(path + '.') === 0) {
        try { l.fn(path); } catch (e) { console.error('Listener error for', l.path, e); }
      }
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { console.warn('Persist failed', e); }
  }

  // Detects the exact "nothing customized yet" placeholder left behind when
  // a category gets auto-created (e.g. from the + button) but never
  // actually filled in — a lone "New Category" whose items are all still
  // at their $0 default. If that's all a saved browser has, treat it as
  // untouched rather than real user data, so shipped updates to the
  // built-in category list aren't permanently hidden behind it.
  function looksLikeUntouchedCategories(cats) {
    if (!Array.isArray(cats) || cats.length === 0) return true;
    if (cats.length === 1) {
      var cat = cats[0];
      var items = cat.items || [];
      var allZero = items.every(function (it) { return !Number(it && it.cost); });
      if (cat.name === 'New Category' && allZero) return true;
    }
    return false;
  }

  // Migrates estate.hasWill/hasLPA from the old boolean-string schema
  // ('true'/'false', used before the Yes/No/In Progress dropdown existed)
  // to the current one. Without this, a returning browser's saved 'true'
  // wouldn't match any option in the new dropdown, so the visible
  // selection and the displayed status badge could silently disagree.
  function migrateEstateStatus(estate) {
    if (!estate) return;
    ['hasWill', 'hasLPA'].forEach(function (key) {
      if (estate[key] === 'true') estate[key] = 'Yes';
      else if (estate[key] === 'false') estate[key] = 'No';
    });
  }

  return {
    init: function (defaults) {
      var saved = null;
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (e) { saved = null; }

      if (saved) {
        // Forward-compat migration: backfill any top-level section that's
        // entirely missing from an older save (e.g. this browser saved
        // data before a feature existed), so shipped updates aren't
        // silently invisible to returning users.
        Object.keys(defaults).forEach(function (key) {
          if (saved[key] === undefined) saved[key] = JSON.parse(JSON.stringify(defaults[key]));
        });
        if (looksLikeUntouchedCategories(saved.cashflowCategories)) {
          saved.cashflowCategories = JSON.parse(JSON.stringify(defaults.cashflowCategories));
        }
        migrateEstateStatus(saved.estate);
        data = saved;
      } else {
        data = JSON.parse(JSON.stringify(defaults));
      }
      notify('*');
    },
    get: function (path) {
      var v = getPath(data, path);
      return v;
    },
    getAll: function () { return data; },
    set: function (path, value, opts) {
      setPath(data, path, value);
      persist();
      notify(path);
      return value;
    },
    // update multiple paths in one batch, single notify at end (perf + fewer re-renders)
    batch: function (fn) {
      fn();
      persist();
      notify('*');
    },
    subscribe: function (path, fn) {
      var entry = { path: path, fn: fn };
      listeners.push(entry);
      return function unsubscribe() {
        var idx = listeners.indexOf(entry);
        if (idx > -1) listeners.splice(idx, 1);
        // If fn is a Dom.debounce()-wrapped function, it may already have
        // a render queued via setTimeout from a notify() that fired just
        // before this unsubscribe — cancel that too, or it will fire
        // anyway ~30ms later and re-render this now-inactive module's
        // content over whatever the newly active route just rendered.
        if (fn && typeof fn.cancel === 'function') fn.cancel();
      };
    },
    reset: function (defaults) {
      data = JSON.parse(JSON.stringify(defaults));
      persist();
      this.clearCurrentClientId();
      notify('*');
    },
    exportJSON: function () {
      return JSON.stringify(data, null, 2);
    },
    importJSON: function (json) {
      data = JSON.parse(json);
      persist();
      notify('*');
    },

    // ---------------------------------------------------------------
    // Saved-client manager: lets one browser hold multiple clients'
    // data, separate from the single "currently open" client above.
    // Tucked into Settings rather than the main sidebar — an advisor
    // switching between meetings doesn't need it front-and-center,
    // but it's there when needed.
    // ---------------------------------------------------------------
    listSavedClients: function () {
      try {
        var raw = localStorage.getItem(CLIENTS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        // A parse failure here used to silently return an empty list —
        // dangerous, because any subsequent save (push + write-back)
        // would then overwrite the REAL underlying data with just the
        // one new entry, permanently destroying everything else that
        // was actually still there. Surface it loudly instead, and keep
        // the raw corrupted string around so it's at least recoverable
        // by hand rather than silently gone.
        console.error('Saved clients data is corrupted and could not be read:', e);
        try {
          var rawBackup = localStorage.getItem(CLIENTS_KEY);
          if (rawBackup) localStorage.setItem(CLIENTS_KEY + '.corrupted.' + Date.now(), rawBackup);
        } catch (e2) {}
        return null; // distinct from [] — callers must treat this as "unknown", not "empty"
      }
    },
    saveCurrentAsClient: function (label) {
      var list = this.listSavedClients();
      if (list === null) { Dom.modalAlert('Saved clients data appears corrupted and could not be safely read \u2014 refusing to save, to avoid overwriting what might still be recoverable. Check the browser console and contact support before trying again.'); return null; }
      var entry = {
        id: 'client_' + Date.now().toString(36),
        label: label || (data.personal && data.personal.name) || 'Untitled Client',
        savedAt: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(data))
      };
      list.push(entry);
      try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(list)); } catch (e) { console.warn('Save client failed', e); }
      try { localStorage.setItem(CURRENT_CLIENT_ID_KEY, entry.id); } catch (e) {}
      return entry;
    },
    loadSavedClient: function (id) {
      var list = this.listSavedClients();
      if (list === null) return false;
      var entry = list.filter(function (e) { return e.id === id; })[0];
      if (!entry) return false;
      data = JSON.parse(JSON.stringify(entry.data));
      persist();
      try { localStorage.setItem(CURRENT_CLIENT_ID_KEY, id); } catch (e) {}
      notify('*');
      return true;
    },
    // The saved-client id the currently active session corresponds to,
    // if any (null for a brand-new/never-saved client). Kept in sync by
    // loadSavedClient, saveCurrentAsClient, and quickSave.
    getCurrentClientId: function () {
      try { return localStorage.getItem(CURRENT_CLIENT_ID_KEY); } catch (e) { return null; }
    },
    clearCurrentClientId: function () {
      try { localStorage.removeItem(CURRENT_CLIENT_ID_KEY); } catch (e) {}
    },
    // Overwrites an existing saved entry's data by id, in place — used
    // for partner-linking, where the CURRENT client's own record needs
    // its partner reference updated without spawning a duplicate save
    // every time (unlike saveCurrentAsClient, which always creates new).
    updateSavedClientData: function (id, newData) {
      var list = this.listSavedClients();
      if (list === null) return false;
      var entry = list.filter(function (e) { return e.id === id; })[0];
      if (!entry) return false;
      entry.data = JSON.parse(JSON.stringify(newData));
      entry.savedAt = new Date().toISOString();
      try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(list)); } catch (e) { return false; }
      return true;
    },
    // Saves an arbitrary client data object (not necessarily the
    // currently-active one) as a brand new saved-client entry — used to
    // create a linked partner record while staying on the current client.
    saveClientData: function (label, clientData) {
      var list = this.listSavedClients();
      if (list === null) { Dom.modalAlert('Saved clients data appears corrupted and could not be safely read \u2014 refusing to save, to avoid overwriting what might still be recoverable.'); return null; }
      var entry = {
        id: 'client_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        label: label || (clientData.personal && clientData.personal.name) || 'Untitled Client',
        savedAt: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(clientData))
      };
      list.push(entry);
      try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(list)); } catch (e) { console.warn('Save client failed', e); }
      return entry;
    },
    deleteSavedClient: function (id) {
      var list = this.listSavedClients();
      if (list === null) return;
      list = list.filter(function (e) { return e.id !== id; });
      try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(list)); } catch (e) {}
    },
    // Overwrites the WHOLE saved-clients list at once — used by the
    // Settings backup/restore feature, so callers never need to know the
    // raw localStorage key directly.
    replaceSavedClients: function (list) {
      try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
    },

    // Quick-save: the low-friction topbar "Save" button. First click names
    // and creates a snapshot automatically from the client's name (no
    // prompt); every click after that updates that SAME snapshot in place,
    // so repeatedly clicking Save doesn't pile up duplicate entries. The
    // deliberate, name-it-yourself "Save Current Client" flow in Settings
    // is unaffected and still creates separate snapshots on demand.
    quickSave: function () {
      var lastId = this.getCurrentClientId();
      var list = this.listSavedClients();
      if (list === null) { Dom.modalAlert('Saved clients data appears corrupted and could not be safely read \u2014 refusing to save, to avoid overwriting what might still be recoverable.'); return null; }
      var existing = lastId ? list.filter(function (e) { return e.id === lastId; })[0] : null;
      if (existing) {
        existing.data = JSON.parse(JSON.stringify(data));
        existing.savedAt = new Date().toISOString();
        try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(list)); } catch (e) {}
        return existing;
      }
      var label = (data.personal && data.personal.name) || 'Untitled Client';
      return this.saveCurrentAsClient(label);
    }
  };
})();
