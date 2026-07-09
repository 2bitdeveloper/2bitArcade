// ============================================================
// RADIUS RAID <-> 2BITARCADE BRIDGE
// Hooks the untouched engine via its global `$` object:
//   $.reset() fires on every new run  -> reset telemetry
//   $.setState('gameover')            -> submit the run
//   $.score polled at 10 Hz           -> one timestamp per 1,000 pts
// Zero edits to Jack Rugile's code.
// ============================================================
(function () {
  'use strict';

  var SUPABASE_URL = 'https://drawbbapvytjytvbedtl.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_zzdZsO1BCunEfdGwur6M4g_nUjW5pa2';
  var BOARD_ID = 'radius_raid';
  var MILESTONE_POINTS = 1000;

  var sbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };

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
        : type === 'solflare' ? w.solflare
        : type === 'backpack' ? w.backpack : null;
      if (provider && provider.connect) {
        provider.connect({ onlyIfTrusted: true }).then(function (resp) {
          var pk = (resp && resp.publicKey && resp.publicKey.toString()) ||
                   (provider.publicKey && provider.publicKey.toString()) || '';
          if (pk) walletAddress = pk;
        }).catch(function () {});
      }
    } catch (e) {}
  }

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

  var telemetry = [], runStart = 0, lastMilestone = 0, submitted = false;

  function resetRun() {
    telemetry = []; runStart = Date.now(); lastMilestone = 0; submitted = false;
  }

  function pollScore() {
    if (runStart === 0 || typeof window.$ === 'undefined') return;
    var score = window.$.score || 0;
    while (score >= lastMilestone + MILESTONE_POINTS) {
      lastMilestone += MILESTONE_POINTS;
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

  function hook() {
    var g = window.$;
    if (!g || typeof g.setState !== 'function' || typeof g.reset !== 'function') {
      setTimeout(hook, 100); return;
    }
    var origReset = g.reset;
    g.reset = function () { resetRun(); onRunReset(); return origReset.apply(this, arguments); };

    var origSetState = g.setState;
    g.setState = function (state) {
      // final score is captured before submission by one last poll
      if (state === 'gameover') { pollScore(); submitRun(); }
      var ret = origSetState.apply(this, arguments);
      // $.setState clears $.buttons then rebuilds them; inject AFTER so ours survives
      if (state === 'gameover') injectReviveButton();
      updateControlsVisibility();
      return ret;
    };

    buildControlsOverlay();
    setInterval(pollScore, 100);
    setInterval(updateControlsVisibility, 300);
    console.log('[RADIUS RAID] 2bitArcade bridge armed. Board: ' + BOARD_ID);
  }


  // ============================================================
  // CONTROLS OVERLAY (DOM, drawn over the canvas on the menu)
  // ============================================================
  function buildControlsOverlay() {
    if (document.getElementById('rr-controls')) return;
    var box = document.createElement('div');
    box.id = 'rr-controls';
    box.innerHTML =
      '<h3>CONTROLS</h3>' +
      '<div class="rr-row"><b>WASD</b> / <b>ARROWS</b><span>Move</span></div>' +
      '<div class="rr-row"><b>MOUSE</b><span>Aim</span></div>' +
      '<div class="rr-row"><b>CLICK</b> / <b>F</b><span>Fire / autofire</span></div>' +
      '<div class="rr-row"><b>P</b><span>Pause</span></div>' +
      '<div class="rr-row"><b>M</b><span>Mute</span></div>' +
      '<div class="rr-note">\uD83D\uDDB1 Desktop \u2014 mouse required</div>';
    box.style.cssText =
      'position:fixed; right:16px; top:50%; transform:translateY(-50%); z-index:400;' +
      'font-family:monospace; color:#8fd; background:rgba(6,10,26,0.82);' +
      'border:2px solid #2af; box-shadow:0 0 18px rgba(40,170,255,0.4);' +
      'padding:14px 18px; font-size:14px; line-height:1.5; pointer-events:none;' +
      'transition:opacity 0.4s ease;';
    document.body.appendChild(box);
    var style = document.createElement('style');
    style.textContent =
      '#rr-controls h3{margin:0 0 8px;color:#fff;letter-spacing:2px;font-size:16px;}' +
      '#rr-controls .rr-row{display:flex;justify-content:space-between;gap:18px;}' +
      '#rr-controls .rr-row b{color:#ff9;}' +
      '#rr-controls .rr-row span{color:#9ab;}' +
      '#rr-controls .rr-note{margin-top:10px;color:#f93;font-size:12px;letter-spacing:1px;}';
    document.head.appendChild(style);
  }

  // Show controls on menu/pause, hide during active play so it never blocks the view
  function updateControlsVisibility() {
    var box = document.getElementById('rr-controls');
    if (!box || typeof window.$ === 'undefined') return;
    var st = window.$.state;
    box.style.opacity = (st === 'play') ? '0' : '1';
  }

  // ============================================================
  // TOKEN-BURN REVIVE  (injected via the game\'s own $.Button API)
  // ============================================================
  var CFG = window.ARCADE_CONFIG || {};
  var REVIVE_COST = CFG.REVIVE_COST;
  var TARGET_TOKEN_MINT = CFG.TOKEN_MINT;
  var SOLANA_RPC_URL = CFG.SOLANA_RPC_URL;
  var reviveUsedThisRun = false;
  var burnInProgress = false;

  function canSign() {
    return !!(walletAddress && window.activeSolanaProvider);
  }

  // reset revive flag each new run (piggybacks the reset hook set up below)
  function onRunReset() { reviveUsedThisRun = false; }

  function toast(msg) {
    var t = document.getElementById('rr-toast');
    if (t) t.remove();
    t = document.createElement('div');
    t.id = 'rr-toast'; t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:8%;left:50%;transform:translateX(-50%);' +
      'background:#111;color:#ff9900;border:2px solid #ff9900;padding:12px 20px;' +
      'font-family:monospace;font-size:15px;z-index:99998;text-align:center;max-width:80vw;';
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 5000);
  }

  async function executeBurn(amount) {
    if (!canSign()) { toast('Revives need a signing wallet. Connect Phantom/Solflare on the Arcade home page.'); return false; }
    if (burnInProgress) return false;
    burnInProgress = true;
    try {
      var w = window;
      if (typeof w.global === 'undefined') w.global = window;
      if (typeof w.process === 'undefined') w.process = { env: {} };
      // web3 libs from CDN (this bridge is a plain script, not bundled)
      var web3 = await import('https://esm.sh/@solana/web3.js@1');
      var splToken = await import('https://esm.sh/@solana/spl-token@0.4');
      var conn = new web3.Connection(SOLANA_RPC_URL, 'confirmed');
      var owner = new web3.PublicKey(walletAddress);
      var mint = new web3.PublicKey(TARGET_TOKEN_MINT);
      var resp = await conn.getParsedTokenAccountsByOwner(owner, { mint: mint });
      if (resp.value.length === 0) { toast('No $2BA found in wallet.'); return false; }
      var acct = resp.value[0].pubkey;
      var programId = resp.value[0].account.owner;
      var info = resp.value[0].account.data.parsed.info;
      var decimals = info.tokenAmount.decimals;
      var uiBal = info.tokenAmount.uiAmount || 0;
      if (uiBal < amount) { toast('Not enough $2BA to revive (need ' + amount.toLocaleString() + ').'); return false; }
      var raw = BigInt(amount) * (BigInt(10) ** BigInt(decimals));
      var ix = splToken.createBurnInstruction(acct, mint, owner, raw, [], programId);
      var tx = new web3.Transaction().add(ix);
      var bh = await conn.getLatestBlockhash('confirmed');
      tx.recentBlockhash = bh.blockhash;
      tx.feePayer = owner;
      var provider = window.activeSolanaProvider;
      var sig;
      if (typeof provider.signAndSendTransaction === 'function') {
        var r = await provider.signAndSendTransaction(tx);
        sig = typeof r === 'string' ? r : r.signature;
      } else {
        var signed = await provider.signTransaction(tx);
        sig = await conn.sendRawTransaction(signed.serialize());
      }
      var conf = await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
      if (conf.value.err) { toast('Burn failed on-chain. Try again.'); return false; }
      console.log('[BURN] 1,000 $2BA destroyed. Sig: ' + sig);
      return true;
    } catch (e) {
      console.error('[BURN] failed/rejected', e);
      toast('Revive cancelled.');
      return false;
    } finally {
      burnInProgress = false;
    }
  }

  // Bring the dead hero back to life in place, clear immediate threats,
  // and resume play - mirrors what $.reset would set for hero.life.
  function performRevive() {
    var g = window.$;
    if (!g || !g.hero) return;
    g.hero.life = 1;
    g.enemies.length = 0;
    g.bullets.length = 0;   // clears enemy projectiles on screen
    g.gameoverTick = 0;
    g.gameoverExplosion = 0;
    g.setState('play');
  }

  // Add a REVIVE button to the gameover screen using the game\'s own Button class.
  function injectReviveButton() {
    var g = window.$;
    if (reviveUsedThisRun || !g.Button) return;
    var reviveBtn = new g.Button({
      x: g.cw / 2 + 1,
      y: 366,               // sits above PLAY AGAIN (which is at 426)
      lockedWidth: 360,
      lockedHeight: 49,
      scale: 3,
      title: burnInProgress ? 'BURNING' : 'REVIVE 1000 2BA',
      action: function () {
        if (burnInProgress || reviveUsedThisRun) return;
        if (!canSign()) { toast('Revives need a signing wallet. Connect on the Arcade home page.'); return; }
        executeBurn(REVIVE_COST).then(function (ok) {
          if (ok) { reviveUsedThisRun = true; performRevive(); }
        });
      }
    });
    // put REVIVE first so it renders at the top of the gameover stack
    g.buttons.unshift(reviveBtn);
  }

  restoreWalletIdentity();
  heartbeat();
  setInterval(heartbeat, 45000);
  hook();
})();
