// ============================================================
// BULLETHELL <-> 2BITARCADE BRIDGE
// p5.js game with top-level globals (score, pl, resetGame).
// No game-over screen: death reverts to the last level checkpoint,
// so we submit the run's peak score on each death and on level-up.
// Engine untouched; this wraps the global functions.
// ============================================================
(function () {
  'use strict';
  var CFG = window.ARCADE_CONFIG || {};
  var SUPABASE_URL = CFG.SUPABASE_URL;
  var SUPABASE_KEY = CFG.SUPABASE_KEY;
  var BOARD_ID = 'bullethell';
  var MILESTONE_POINTS = 250;

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

  // A "run" spans from a fresh game (resetGame) to the moment the player
  // stops improving. We track peak score and emit milestone timestamps,
  // submitting the accumulated telemetry whenever the player dies.
  var telemetry = [], runStart = 0, lastMilestone = 0, peak = 0;

  function resetRun() { telemetry = []; runStart = Date.now(); lastMilestone = 0; peak = 0; }

  function poll() {
    if (runStart === 0 || typeof window.score !== 'number') return;
    if (window.score > peak) peak = window.score;
    while (peak >= lastMilestone + MILESTONE_POINTS) {
      lastMilestone += MILESTONE_POINTS;
      var t = Date.now() - runStart;
      var prev = telemetry.length ? telemetry[telemetry.length - 1] : -1;
      telemetry.push(t <= prev ? prev + 1 : t);
    }
  }

  function submitRun() {
    poll();
    if (telemetry.length === 0) return;
    var payload = JSON.stringify({ board_id: BOARD_ID, player_name: playerName(), telemetry: telemetry });
    fetch(SUPABASE_URL + '/functions/v1/validate-score', { method: 'POST', headers: sbHeaders, body: payload }).catch(function () {});
  }

  // ----- BURN REVIVE -----
  var reviveUsedThisRun = false, revivePending = false, reviving = false;

  function showRevivePrompt(onResolve) {
    if (document.getElementById('bh-revive')) return;
    var d = document.createElement('div');
    d.id = 'bh-revive';
    d.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,2,15,0.82);font-family:monospace;';
    d.innerHTML =
      '<div style="color:#ff3355;font-size:34px;letter-spacing:2px;margin-bottom:6px;">YOU DIED</div>' +
      '<button id="bh-revive-btn" style="font-family:monospace;font-size:22px;padding:12px 26px;margin:10px;cursor:pointer;color:#000;background:#ff9900;border:none;box-shadow:0 0 18px #ff5500;">REVIVE \uD83D\uDD25 1000 $2BA</button>' +
      '<button id="bh-skip-btn" style="font-family:monospace;font-size:18px;padding:8px 20px;cursor:pointer;color:#aaa;background:transparent;border:2px solid #555;">RESTART LEVEL</button>' +
      '<div style="color:#666;font-size:14px;margin-top:10px;">Burning revives you in place with full health and keeps your score.</div>';
    document.body.appendChild(d);
    document.getElementById('bh-skip-btn').onclick = function () { d.remove(); onResolve(false); };
    document.getElementById('bh-revive-btn').onclick = function () {
      if (reviving) return;
      if (!window.BulletHellBurn) { d.remove(); onResolve(false); return; }
      reviving = true;
      document.getElementById('bh-revive-btn').textContent = 'BURNING...';
      window.BulletHellBurn(function (ok) {
        reviving = false;
        if (ok) { d.remove(); onResolve(true); }
        else { document.getElementById('bh-revive-btn').textContent = 'REVIVE \uD83D\uDD25 1000 $2BA'; }
      });
    };
  }

  function hook() {
    // resetGame is a top-level function in main.js
    if (typeof window.resetGame !== 'function' || typeof window.reloadLevel !== 'function') { setTimeout(hook, 120); return; }

    var origReset = window.resetGame;
    window.resetGame = function () { var r = origReset.apply(this, arguments); resetRun(); reviveUsedThisRun = false; return r; };

    // Death reverts to checkpoint via reloadLevel(). Offer a burn-revive first:
    // if the player burns, restore full HP in place and DON'T reload (score kept).
    var origReload = window.reloadLevel;
    window.reloadLevel = function () {
      var self = this, args = arguments;
      // Only intercept for player death (pl.dead), when revive is available & unused
      if (window.pl && window.pl.dead && window.BulletHellBurn && !reviveUsedThisRun && !revivePending) {
        revivePending = true;
        showRevivePrompt(function (revived) {
          revivePending = false;
          if (revived) {
            reviveUsedThisRun = true;
            // resurrect in place: clear bullets, restore hp, keep score & level
            try {
              window.pl.dead = false;
              window.pl.hp = window.pl.maxHp;
              if (typeof clearEntities === 'function') { /* keep level, just clear hazards */ }
              if (window.bullets) window.bullets.length = 0;
              if (window.enemyBullets) window.enemyBullets.length = 0;
            } catch (e) {}
          } else {
            submitRun();
            origReload.apply(self, args); // normal restart
          }
        });
        return; // defer the reload until the prompt resolves
      }
      submitRun();
      return origReload.apply(self, args);
    };

    resetRun();
    setInterval(poll, 150);
    // flush on tab close so a run isn't lost if they leave mid-game
    window.addEventListener('beforeunload', submitRun);
    console.log('[BULLETHELL] 2bitArcade bridge armed. Board: ' + BOARD_ID);
  }

  restoreWalletIdentity();
  heartbeat();
  setInterval(heartbeat, 45000);
  hook();
})();
