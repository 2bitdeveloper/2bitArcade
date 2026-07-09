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
  CONTRACT_ADDRESS: "YOUR_CA_HERE",              // the $2BA contract address (for display/copy/buy link)
  TOKEN_MINT:       "YOUR_TOKEN_MINT_ADDRESS_HERE", // the SPL mint (for balances + burns) — usually SAME as CA on pump.fun

  // ---- USUALLY STABLE ----
  SOLANA_RPC_URL:   "https://api.mainnet-beta.solana.com", // swap to your Helius URL before launch
  SUPABASE_URL:     "https://drawbbapvytjytvbedtl.supabase.co",
  SUPABASE_KEY:     "sb_publishable_zzdZsO1BCunEfdGwur6M4g_nUjW5pa2",

  // ---- ECONOMY CONSTANTS ----
  INITIAL_TOKEN_SUPPLY: 1000000000,  // 1,000,000,000 $2BA (for the "burned" counter)
  REVIVE_COST:          1000,        // $2BA burned per revive
  MIN_TOKENS_TO_PLAY:   1000,        // $2BA balance required after the free trial
};
