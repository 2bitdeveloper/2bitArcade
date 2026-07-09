// ============================================================
// 2BITARCADE ACCESS GUARD  (loaded first on every game page)
// Enforces the same gate as the landing page so a bookmarked game
// URL can't bypass it: wallet + username required, 8h free trial,
// then >= 1000 $2BA. Redirects back to the arcade if not allowed.
// ============================================================
(function () {
  'use strict';
  var CFG = window.ARCADE_CONFIG || {};
  var SUPABASE_URL = CFG.SUPABASE_URL;
  var SUPABASE_KEY = CFG.SUPABASE_KEY;
  var TARGET_TOKEN_MINT = CFG.TOKEN_MINT;
  var SOLANA_RPC_URL = CFG.SOLANA_RPC_URL;
  var MIN_TOKENS = CFG.MIN_TOKENS_TO_PLAY;
  var sb = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  function boot() { document.body.style.visibility = 'visible'; }
  function bounce(reason) {
    try { sessionStorage.setItem('gateBounce', reason || 'tokengate'); } catch (e) {}
    window.location.href = './index.html';
  }

  function walletAddr() {
    try {
      var watch = localStorage.getItem('watchAddress');
      if (watch && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(watch)) return watch;
      var t = localStorage.getItem('walletType');
      var w = window;
      var p = t === 'phantom' ? (w.phantom && w.phantom.solana) || w.solana
        : t === 'solflare' ? w.solflare : t === 'backpack' ? w.backpack : null;
      if (p && p.publicKey) return p.publicKey.toString();
    } catch (e) {}
    return '';
  }

  async function tokenBalance(addr) {
    try {
      var res = await fetch(SOLANA_RPC_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
          params: [addr, { mint: TARGET_TOKEN_MINT }, { encoding: 'jsonParsed' }] })
      });
      var d = await res.json();
      var a = d.result && d.result.value || [];
      return a.length ? (a[0].account.data.parsed.info.tokenAmount.uiAmount || 0) : 0;
    } catch (e) { return 0; }
  }

  async function guard() {
    var addr = walletAddr();
    var username = '';
    try { username = localStorage.getItem('arcadeUsername') || ''; } catch (e) {}
    if (!addr) return bounce('connect');
    if (!username) return bounce('username');

    // holders always pass
    var bal = await tokenBalance(addr);
    if (bal >= MIN_TOKENS) return boot();

    // else check the trial clock (does NOT start it here - landing page starts it)
    try {
      var res = await fetch(SUPABASE_URL + '/rest/v1/rpc/check_or_start_trial', {
        method: 'POST', headers: sb, body: JSON.stringify({ p_wallet: addr })
      });
      var data = await res.json();
      if (data && typeof data.seconds_left === 'number' && data.seconds_left > 0) return boot();
    } catch (e) {}
    return bounce('tokengate');
  }

  // hide the page until access is confirmed (avoids a flash of the game)
  if (document.body) document.body.style.visibility = 'hidden';
  else document.addEventListener('DOMContentLoaded', function () { document.body.style.visibility = 'hidden'; });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard);
  else guard();
})();
