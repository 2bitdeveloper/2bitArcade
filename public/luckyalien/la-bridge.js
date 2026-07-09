// ============================================================
// LUCKY ALIEN <-> 2BITARCADE BRIDGE
// Phaser game with a global `stats` object. Leaderboard metric =
// coins collected. Coins reset to 0 on death (lives<=0), so we track
// the run's PEAK coins and submit when the coin count drops to 0
// (a death/reset just happened) or on tab close.
// Engine untouched.
// ============================================================
(function () {
  'use strict';
  var CFG = window.ARCADE_CONFIG || {};
  var SUPABASE_URL = CFG.SUPABASE_URL;
  var SUPABASE_KEY = CFG.SUPABASE_KEY;
  var BOARD_ID = 'lucky_alien';
  var MILESTONE_COINS = 5; // one telemetry stamp per 5 coins

  var sbHeaders = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
  var guestName = 'Guest_' + (Math.floor(Math.random() * 9000) + 1000);
  var walletAddress = '';
  function playerName() {
    var custom = '';
    try { custom = localStorage.getItem('arcadeUsername') || ''; } catch (e) {}
    if (custom) return custom;
    return walletAddress ? 'WL_' + walletAddress.substring(0, 6) : guestName;
  }

  function restoreWalletIdentity() {
    try {
      var watch = localStorage.getItem('watchAddress');
      if (watch && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(watch)) { walletAddress = watch; return; }
      var type = localStorage.getItem('walletType');
      if (!type) return;
      var w = window;
      var provider = type === 'phantom' ? (w.phantom && w.phantom.solana) || w.solana
        : type === 'solflare' ? w.solflare : type === 'backpack' ? w.backpack : null;
      if (provider && provider.connect) {
        provider.connect({ onlyIfTrusted: true }).then(function (resp) {
          var pk = (resp && resp.publicKey && resp.publicKey.toString()) || (provider.publicKey && provider.publicKey.toString()) || '';
          if (pk) walletAddress = pk;
        }).catch(function () {});
      }
    } catch (e) {}
  }

  var sessionId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
  function heartbeat() {
    if (document.visibilityState === 'hidden') return;
    fetch(SUPABASE_URL + '/rest/v1/rpc/pilot_heartbeat', { method: 'POST', headers: sbHeaders, body: JSON.stringify({ p_session_id: sessionId }) }).catch(function () {});
  }

  var telemetry = [], runStart = 0, lastMilestone = 0, peak = 0, prevCoins = 0;

  function resetRun() { telemetry = []; runStart = Date.now(); lastMilestone = 0; peak = 0; }

  function currentCoins() {
    try { return (typeof window.stats === 'object' && window.stats) ? (window.stats.coins || 0) : 0; }
    catch (e) { return 0; }
  }

  function submitRun() {
    if (telemetry.length === 0) return;
    fetch(SUPABASE_URL + '/functions/v1/validate-score', {
      method: 'POST', headers: sbHeaders,
      body: JSON.stringify({ board_id: BOARD_ID, player_name: playerName(), telemetry: telemetry })
    }).catch(function () {});
  }

  function poll() {
    if (runStart === 0) return;
    var coins = currentCoins();
    // A drop to 0 from a positive count = death/reset. Bank the run, restart.
    if (coins === 0 && prevCoins > 0) {
      submitRun();
      resetRun();
      prevCoins = 0;
      return;
    }
    prevCoins = coins;
    if (coins > peak) peak = coins;
    while (peak >= lastMilestone + MILESTONE_COINS) {
      lastMilestone += MILESTONE_COINS;
      var t = Date.now() - runStart;
      var prev = telemetry.length ? telemetry[telemetry.length - 1] : -1;
      telemetry.push(t <= prev ? prev + 1 : t);
    }
  }

  function boot() {
    restoreWalletIdentity();
    heartbeat();
    setInterval(heartbeat, 45000);
    resetRun();
    setInterval(poll, 300);
    window.addEventListener('beforeunload', submitRun);
    console.log('[LUCKY ALIEN] 2bitArcade bridge armed. Board: ' + BOARD_ID);
  }
  boot();
})();
