// ============================================================
// 2BITARCADE — SINGLE SOURCE OF TRUTH FOR TOKEN + BACKEND CONFIG
// ============================================================
// THIS IS THE ONLY FILE YOU EDIT AT LAUNCH.
// Fill in CONTRACT_ADDRESS and TOKEN_MINT once here; every page,
// game, and bridge reads these values from window.ARCADE_CONFIG.
//
// Loaded as a plain <script> BEFORE everything else on every page,
// so both the compiled app and the third-party game bridges share it.
// ============================================================
window.ARCADE_CONFIG = {
  // ---- FILL THESE AT LAUNCH ----
  CONTRACT_ADDRESS: "",              // the $2BA contract address (for display/copy/buy link)
  TOKEN_MINT: "", // the SPL mint (for balances + burns) — usually SAME as CA on pump.fun

  // ---- USUALLY STABLE ----
  SOLANA_RPC_URL: "https://mainnet.helius-rpc.com/?api-key=3480e0ac-2fe9-415c-962c-6ec8c8337290", // swap to your Helius URL before launch
  SUPABASE_URL:     "https://drawbbapvytjytvbedtl.supabase.co",
  SUPABASE_KEY:     "sb_publishable_zzdZsO1BCunEfdGwur6M4g_nUjW5pa2",

  // ---- DEV / TESTING ----
  // Wallets listed here get UNRESTRICTED access (no username, no trial, no
  // token requirement) - but ONLY when connected via a wallet extension
  // (Phantom/Solflare/Backpack). Watch-mode entry of these addresses does NOT
  // bypass, so strangers reading this file can't ride your dev wallet.
  // !!! EMPTY THIS LIST BEFORE LAUNCH !!!
  DEV_WALLETS: ["PASTE_YOUR_TEST_WALLET_ADDRESS_HERE"],
  // For extension-less devices (e.g. a locked-down work laptop): enter your
  // dev wallet as a WATCH address, then once in the browser console run
  //   localStorage.setItem('devKey', '<your secret key>')
  // Only the SHA-256 HASH of the key lives here (safe to publish - the key
  // itself cannot be recovered from it). To use your own key, run this in any
  // browser console and paste the output:
  //   crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR-KEY'))
  //     .then(b=>console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
  // !!! BLANK THIS AND DEV_WALLETS BEFORE LAUNCH !!!
  DEV_KEY_HASH: "aac4acefe61647a45fa37fdf2cdf05a88f84511408e0e4f0b70259a04751c2d3",

  // ---- ECONOMY CONSTANTS ----
  INITIAL_TOKEN_SUPPLY: 1000000000,  // 1,000,000,000 $2BA (for the "burned" counter)
  REVIVE_COST:          1000,        // $2BA burned per revive
  MIN_TOKENS_TO_PLAY:   1000,        // $2BA balance required after the free trial

  // ---- OFFICIAL CHANNELS (anti-impersonation) ----
  // The ONLY official X account. The ONLY official contract address is
  // CONTRACT_ADDRESS above. Anything else is an impostor.
  OFFICIAL: {
    X_HANDLE: "@b1t_exe",
    X_URL: "https://x.com/b1t_exe",
    WARNING: "the only official x account is @b1t_exe. the only official $2BA contract address appears on this page. anything else is an impostor wearing our ghost.",
  },
};
