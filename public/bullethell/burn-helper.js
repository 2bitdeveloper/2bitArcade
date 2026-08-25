// ============================================================
// SHARED REVIVE HELPER
// Revives used to cost 1,000 $2BA via an on-chain SPL burn. 2bitArcade
// is now fully free -- revives no longer touch a wallet or the chain
// at all. Kept as a drop-in replacement so the games that call
// window.NeonRunnerBurn / window.BulletHellBurn need no changes.
// ============================================================
(function () {
  'use strict';
  function burn(cb) {
    // free, instant, no wallet/network involved
    if (cb) cb(true);
  }
  window.NeonRunnerBurn = burn;
  window.BulletHellBurn = burn;
})();
