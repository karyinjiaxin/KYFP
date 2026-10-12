/* ============================================================
   sync.js — optional Supabase-backed cross-device sync.
   Only active when supabaseConfig.js has real credentials; local-only
   mode (the original behavior) is unaffected.

   Design: rather than rewriting Store's synchronous localStorage API
   (used synchronously by 20+ modules), this mirrors the THREE
   localStorage keys Store already owns — the current client, the saved
   clients list, and which one is current — as one JSONB blob in a
   single Supabase row per advisor. A short poll (plus an immediate push
   on every Store change) catches every write, including the saved-
   client-list operations that don't go through Store.set/notify.
   ============================================================ */

var Sync = (function () {
  var STORAGE_KEY = 'wealthPlatform.client.v1';
  var CLIENTS_KEY = 'wealthPlatform.savedClients.v1';
  var CURRENT_CLIENT_ID_KEY = 'wealthPlatform.currentClientId';
  var POLL_MS = 2500;
  var PUSH_DEBOUNCE_MS = 700;

  var pushTimer = null;
  var pollTimer = null;
  var lastPushedJSON = null;
  var channel = null;

  function readLocalSnapshot() {
    var client = null, savedClients = null, currentClientId = null;
    try { client = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) {}
    try { savedClients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || 'null'); } catch (e) {}
    try { currentClientId = localStorage.getItem(CURRENT_CLIENT_ID_KEY); } catch (e) {}
    return { client: client, savedClients: savedClients, currentClientId: currentClientId };
  }

  function writeLocalSnapshot(snap) {
    try { if (snap.client) localStorage.setItem(STORAGE_KEY, JSON.stringify(snap.client)); } catch (e) {}
    try { if (snap.savedClients) localStorage.setItem(CLIENTS_KEY, JSON.stringify(snap.savedClients)); } catch (e) {}
    try {
      if (snap.currentClientId) localStorage.setItem(CURRENT_CLIENT_ID_KEY, snap.currentClientId);
      else localStorage.removeItem(CURRENT_CLIENT_ID_KEY);
    } catch (e) {}
  }

  // Pulls the advisor's remote row (if any) into localStorage BEFORE
  // Store.init() runs, so the existing synchronous init path picks it up
  // exactly as if it had always been local. If no remote row exists yet
  // (first-ever sign-in), this is a no-op — the first push below seeds
  // the remote row from whatever is already in this browser.
  function pullBeforeInit() {
    var sb = Auth.getClient();
    if (!sb) return Promise.resolve();
    return sb.auth.getUser().then(function (res) {
      var user = res.data && res.data.user;
      if (!user) return;
      return sb.from('app_state').select('data').eq('owner', user.id).maybeSingle().then(function (res2) {
        if (res2.error) { console.error('Supabase pull failed, running local-only for this session', res2.error); return; }
        if (res2.data && res2.data.data) {
          writeLocalSnapshot(res2.data.data);
          lastPushedJSON = JSON.stringify(res2.data.data);
        }
      });
    });
  }

  function pushNow() {
    var sb = Auth.getClient();
    if (!sb) return;
    sb.auth.getUser().then(function (res) {
      var user = res.data && res.data.user;
      if (!user) return;
      var snap = readLocalSnapshot();
      var json = JSON.stringify(snap);
      if (json === lastPushedJSON) return; // nothing changed since our last push
      lastPushedJSON = json;
      sb.from('app_state').upsert({ owner: user.id, data: snap, updated_at: new Date().toISOString() }).then(function (res3) {
        if (res3.error) console.error('Supabase sync push failed', res3.error);
      });
    });
  }

  function scheduleDebouncedPush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, PUSH_DEBOUNCE_MS);
  }

  function startPolling() {
    // Catches saved-client-list operations (Save Current Client, New
    // Client, delete, partner-link, backup/restore) which write
    // localStorage directly without going through Store's notify().
    pollTimer = setInterval(pushNow, POLL_MS);
  }

  function subscribeRealtime(userId) {
    var sb = Auth.getClient();
    channel = sb
      .channel('app-state-sync-' + userId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'owner=eq.' + userId },
        function (payload) {
          var incoming = payload.new && payload.new.data;
          if (!incoming) return;
          var json = JSON.stringify(incoming);
          if (json === lastPushedJSON) return; // our own echo
          lastPushedJSON = json;
          writeLocalSnapshot(incoming);
          // Store.init is idempotent (reads localStorage, merges,
          // notifies) — calling it again is the simplest safe way to
          // pick up a remote change made from another device without
          // adding a parallel "reload" code path to state.js.
          Store.init(SampleClient);
        }
      )
      .subscribe();
  }

  return {
    enabled: function () { return !!Auth.getClient(); },
    pullBeforeInit: pullBeforeInit,
    // Called once after Store.init() has run for the first time.
    startWatching: function () {
      var sb = Auth.getClient();
      if (!sb) return;
      sb.auth.getUser().then(function (res) {
        var user = res.data && res.data.user;
        if (!user) return;
        Store.subscribe('*', scheduleDebouncedPush);
        startPolling();
        subscribeRealtime(user.id);
        pushNow(); // seed the remote row immediately on first sign-in
      });
    }
  };
})();
