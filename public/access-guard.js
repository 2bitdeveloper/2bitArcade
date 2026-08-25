// ============================================================
// 2BITARCADE ACCESS GUARD
// 2bitArcade is free and open to everyone. This file used to gate
// games behind a wallet + token-balance check; that gate has been
// removed. Kept as a no-op so existing <script src="./access-guard.js">
// tags on every game page don't need to be edited one by one.
// ============================================================
(function () {
  'use strict';
  if (document.body) document.body.style.visibility = 'visible';
  else document.addEventListener('DOMContentLoaded', function () {
    document.body.style.visibility = 'visible';
  });
})();
