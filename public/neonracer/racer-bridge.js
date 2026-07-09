// ============================================================
// NEON NIGHT RACER <-> 2BITARCADE BRIDGE
// Endless driver (no crash/lose state). Score = distance driven
// (game.car.z / 1000, same value shown on the DIST readout).
// One telemetry stamp per 100 distance. Submits when the player
// returns to the start screen (a new run) or on tab close.
// ============================================================
(function () {
  'use strict';
  var CFG = window.ARCADE_CONFIG || {};
  var SUPABASE_URL = CFG.SUPABASE_URL;
  var SUPABASE_KEY = CFG.SUPABASE_KEY;
  var BOARD_ID = 'neon_racer';
  var MILESTONE = 100;

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

  var telemetry = [], runStart = 0, lastMilestone = 0, submitted = false;
  function resetRun() { telemetry = []; runStart = Date.now(); lastMilestone = 0; submitted = false; }
  function dist() {
    try { return window.game && window.game.car ? Math.floor(window.game.car.z / 1000) : 0; } catch (e) { return 0; }
  }
  function submitRun() {
    if (submitted || telemetry.length === 0) return;
    submitted = true;
    fetch(SUPABASE_URL + '/functions/v1/validate-score', {
      method: 'POST', headers: sbHeaders,
      body: JSON.stringify({ board_id: BOARD_ID, player_name: playerName(), telemetry: telemetry })
    }).catch(function () {});
  }
  function poll() {
    if (runStart === 0) return;
    var d = dist();
    while (d >= lastMilestone + MILESTONE) {
      lastMilestone += MILESTONE;
      var t = Date.now() - runStart;
      var prev = telemetry.length ? telemetry[telemetry.length - 1] : -1;
      telemetry.push(t <= prev ? prev + 1 : t);
    }
  }

  // The game drives run boundaries via these hooks (start -> wreck).
  window.NeonRacerBridge = {
    onStart: function () { resetRun(); },
    onGameOver: function () { poll(); submitRun(); }
  };

  restoreWalletIdentity();
  heartbeat();
  setInterval(heartbeat, 45000);
  setInterval(poll, 250);
  window.addEventListener('beforeunload', submitRun);
  console.log('[NEON RACER] 2bitArcade bridge armed. Board: ' + BOARD_ID);
})();
