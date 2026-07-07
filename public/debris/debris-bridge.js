// ============================================================
// DEBRIS FIELD <-> 2BITARCADE BRIDGE
// Plain script (no modules): hooks the untouched Asteroids engine
// through its globals (Game.score, Game.FSM). Zero gameplay edits.
//   - one telemetry timestamp per 500 points (milestone pattern)
//   - submits to the validate-score edge function on game over
//   - presence heartbeat feeds the arcade's Active Players counter
//   - player identity shared with the rest of the arcade
// ============================================================
(function () {
  'use strict';

  // --- SHARED ARCADE CONFIG (keep in sync with the other games) ---
  var SUPABASE_URL = 'https://drawbbapvytjytvbedtl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_zzdZsO1BCunEfdGwur6M4g_nUjW5pa2';
  var BOARD_ID = 'debris_field';
  var MILESTONE_POINTS = 500; // one telemetry entry per 500 points

  var sbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };

  // --- PLAYER IDENTITY (same rules as every other cabinet) ---
  var guestName = 'Guest_' + (Math.floor(Math.random() * 9000) + 1000);
  var walletAddress = '';

  function playerName() {
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
        : type === 'solflare' ? w.solflare
        : type === 'backpack' ? w.backpack : null;
      if (provider && provider.connect) {
        provider.connect({ onlyIfTrusted: true }).then(function (resp) {
          var pk = (resp && resp.publicKey && resp.publicKey.toString()) ||
                   (provider.publicKey && provider.publicKey.toString()) || '';
          if (pk) walletAddress = pk;
        }).catch(function () { /* not pre-authorized: guest identity */ });
      }
    } catch (e) { /* identity stays guest */ }
  }

  // --- PRESENCE HEARTBEAT ---
  var sessionId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now() + '-' + Math.random().toString(36).slice(2);

  function heartbeat() {
    if (document.visibilityState === 'hidden') return;
    fetch(SUPABASE_URL + '/rest/v1/rpc/pilot_heartbeat', {
      method: 'POST', headers: sbHeaders,
      body: JSON.stringify({ p_session_id: sessionId })
    }).catch(function () {});
  }

  // --- TELEMETRY ---
  var telemetry = [];
  var runStart = 0;
  var lastMilestone = 0;
  var submitted = false;

  function resetRun() {
    telemetry = [];
    runStart = Date.now();
    lastMilestone = 0;
    submitted = false;
  }

  function pollScore() {
    if (!window.Game || runStart === 0) return;
    var score = window.Game.score || 0;
    while (score >= lastMilestone + MILESTONE_POINTS) {
      lastMilestone += MILESTONE_POINTS;
      // Space multiple same-tick milestones by 1ms so timestamps stay
      // strictly increasing (the server rejects non-monotonic telemetry).
      var t = Date.now() - runStart;
      var prev = telemetry.length ? telemetry[telemetry.length - 1] : -1;
      telemetry.push(t <= prev ? prev + 1 : t);
    }
  }

  function submitRun() {
    if (submitted || telemetry.length === 0) return;
    submitted = true;
    fetch(SUPABASE_URL + '/functions/v1/validate-score', {
      method: 'POST', headers: sbHeaders,
      body: JSON.stringify({ board_id: BOARD_ID, player_name: playerName(), telemetry: telemetry })
    }).catch(function () {});
  }

  // --- HOOK THE GAME'S STATE MACHINE (no game.js edits needed) ---
  function hookFSM() {
    if (!window.Game || !window.Game.FSM) { setTimeout(hookFSM, 100); return; }
    var fsm = window.Game.FSM;

    var origStart = fsm.start;
    fsm.start = function () { resetRun(); return origStart.apply(this, arguments); };

    var origEnd = fsm.end_game;
    fsm.end_game = function () { submitRun(); return origEnd.apply(this, arguments); };

    setInterval(pollScore, 100); // 10 Hz milestone polling
    console.log('[DEBRIS] 2bitArcade bridge armed. Board: ' + BOARD_ID);
  }

  // --- BOOT ---
  restoreWalletIdentity();
  heartbeat();
  setInterval(heartbeat, 45000);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookFSM);
  } else {
    hookFSM();
  }
})();
