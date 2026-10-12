/* ============================================================
   auth.js — thin wrapper around Supabase Auth: one shared client,
   a login screen, and sign-out. Only used when supabaseConfig.js has
   real credentials — app.js skips all of this and runs local-only
   otherwise, exactly as before.
   ============================================================ */

var Auth = (function () {
  var client = null;

  function getClient() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    if (!client) {
      if (typeof supabase === 'undefined') {
        console.warn('Supabase config is set but the supabase-js script did not load — running local-only for this session.');
        return null;
      }
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  function getSession() {
    var sb = getClient();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (res) { return res.data.session; });
  }

  function signOut() {
    var sb = getClient();
    if (sb) sb.auth.signOut().then(function () { window.location.reload(); });
    else window.location.reload();
  }

  // Renders a full-screen login card into `root` and resolves with the
  // authenticated session once sign-in succeeds. Accounts are created
  // from the Supabase dashboard (Authentication -> Users) — there is
  // deliberately no public self-serve sign-up for a single-advisor tool
  // holding client financial data.
  function renderLoginScreen(root) {
    return new Promise(function (resolve) {
      var sb = getClient();
      var submitting = false;

      var emailInput = Dom.el('input', { type: 'email', autocomplete: 'email', placeholder: 'you@advisory.com', style: 'width:100%;padding:9px 12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text-primary);font-size:12.5px;' });
      var passInput = Dom.el('input', { type: 'password', autocomplete: 'current-password', placeholder: '••••••••', style: 'width:100%;padding:9px 12px;border-radius:10px;border:1px solid var(--border-strong);background:var(--bg);color:var(--text-primary);font-size:12.5px;' });
      var errorMsg = Dom.el('p', { style: 'color:var(--bad);font-size:11.5px;margin-top:8px;display:none' }, ['']);

      function submit() {
        if (submitting) return;
        submitting = true;
        errorMsg.style.display = 'none';
        sb.auth.signInWithPassword({ email: emailInput.value.trim(), password: passInput.value }).then(function (res) {
          submitting = false;
          if (res.error) {
            errorMsg.textContent = res.error.message;
            errorMsg.style.display = 'block';
            return;
          }
          resolve(res.data.session);
        });
      }

      [emailInput, passInput].forEach(function (input) {
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      });

      var card = Dom.el('div', { style: 'width:100%;max-width:360px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-md);padding:28px;' }, [
        Dom.el('div', { style: 'display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:22px' }, [
          Dom.el('div', { style: 'width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,var(--brass-300),var(--brass-500));display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--ink-950);font-size:16px;margin-bottom:10px' }, ['W']),
          Dom.el('div', { style: 'font-size:14px;font-weight:700' }, ['Wealth Advisory']),
          Dom.el('div', { class: 'text-tertiary', style: 'margin-top:4px' }, ['Sign in to your wealth console'])
        ]),
        Dom.el('div', { class: 'field' }, [Dom.el('label', { class: 'field-label' }, ['Email']), emailInput]),
        Dom.el('div', { class: 'field' }, [Dom.el('label', { class: 'field-label' }, ['Password']), passInput]),
        errorMsg,
        Dom.el('button', { class: 'btn btn-primary', style: 'width:100%;justify-content:center;margin-top:6px', onclick: submit }, ['Sign In'])
      ]);

      root.innerHTML = '';
      root.appendChild(Dom.el('div', { style: 'min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg)' }, [card]));
    });
  }

  return { getClient: getClient, getSession: getSession, signOut: signOut, renderLoginScreen: renderLoginScreen };
})();
