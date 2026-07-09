// ============================================================
// SHARED $2BA BURN HELPER (revives)
// Exposes a burn function the game calls to destroy 1,000 $2BA
// on-chain (SPL burn -> supply shrinks). Watch-mode wallets can't
// sign and get a toast. Loads web3 libs from CDN (games are unbundled).
// Set window.<NAME>Burn = burn(cb) after defining TARGET_TOKEN_MINT.
// ============================================================
(function () {
  'use strict';
  var CFG = window.ARCADE_CONFIG || {};
  var REVIVE_COST = CFG.REVIVE_COST;
  var TARGET_TOKEN_MINT = CFG.TOKEN_MINT;
  var SOLANA_RPC_URL = CFG.SOLANA_RPC_URL;
  var busy = false;

  function walletAddr() {
    var watch = localStorage.getItem('watchAddress');
    if (watch && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(watch)) return watch;
    return (window.activeSolanaProvider && window.activeSolanaProvider.publicKey)
      ? window.activeSolanaProvider.publicKey.toString() : '';
  }
  function canSign() { return !!window.activeSolanaProvider; }

  function toast(msg) {
    var t = document.getElementById('burn-toast'); if (t) t.remove();
    t = document.createElement('div'); t.id = 'burn-toast'; t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:8%;left:50%;transform:translateX(-50%);background:#111;color:#ff9900;border:2px solid #ff9900;padding:12px 20px;font-family:monospace;font-size:15px;z-index:99999;text-align:center;max-width:80vw;';
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 5000);
  }

  async function burn(cb) {
    if (busy) { cb && cb(false); return; }
    if (!canSign()) { toast('Revives need a signing wallet. Connect Phantom/Solflare on the Arcade home page.'); cb && cb(false); return; }
    busy = true;
    try {
      var w = window;
      if (typeof w.global === 'undefined') w.global = window;
      if (typeof w.process === 'undefined') w.process = { env: {} };
      var web3 = await import('https://esm.sh/@solana/web3.js@1');
      var spl = await import('https://esm.sh/@solana/spl-token@0.4');
      var conn = new web3.Connection(SOLANA_RPC_URL, 'confirmed');
      var owner = new web3.PublicKey(walletAddr());
      var mint = new web3.PublicKey(TARGET_TOKEN_MINT);
      var resp = await conn.getParsedTokenAccountsByOwner(owner, { mint: mint });
      if (!resp.value.length) { toast('No $2BA found in wallet.'); busy = false; cb && cb(false); return; }
      var acct = resp.value[0].pubkey, programId = resp.value[0].account.owner;
      var info = resp.value[0].account.data.parsed.info;
      var dec = info.tokenAmount.decimals, uiBal = info.tokenAmount.uiAmount || 0;
      if (uiBal < REVIVE_COST) { toast('Not enough $2BA to revive (need ' + REVIVE_COST.toLocaleString() + ').'); busy = false; cb && cb(false); return; }
      var raw = BigInt(REVIVE_COST) * (BigInt(10) ** BigInt(dec));
      var tx = new web3.Transaction().add(spl.createBurnInstruction(acct, mint, owner, raw, [], programId));
      var bh = await conn.getLatestBlockhash('confirmed');
      tx.recentBlockhash = bh.blockhash; tx.feePayer = owner;
      var p = window.activeSolanaProvider, sig;
      if (typeof p.signAndSendTransaction === 'function') { var r = await p.signAndSendTransaction(tx); sig = typeof r === 'string' ? r : r.signature; }
      else { var s = await p.signTransaction(tx); sig = await conn.sendRawTransaction(s.serialize()); }
      var conf = await conn.confirmTransaction({ signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, 'confirmed');
      if (conf.value.err) { toast('Burn failed on-chain. Try again.'); busy = false; cb && cb(false); return; }
      console.log('[BURN] 1,000 $2BA destroyed. Sig: ' + sig);
      busy = false; cb && cb(true);
    } catch (e) { console.error('[BURN] failed/rejected', e); toast('Revive cancelled.'); busy = false; cb && cb(false); }
  }

  // expose under both names the games look for
  window.NeonRunnerBurn = burn;
  window.BulletHellBurn = burn;
})();
