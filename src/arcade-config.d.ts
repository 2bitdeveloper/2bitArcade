// ============================================================
// Ambient global type for window.ARCADE_CONFIG (set by arcade-config.js).
// PLACE THIS FILE AT: src/arcade-config.d.ts
// (inside src/ so your tsconfig picks it up automatically)
// ============================================================
export {}; // make this a module so `declare global` works

interface ArcadeConfig {
  CONTRACT_ADDRESS: string;
  TOKEN_MINT: string;
  SOLANA_RPC_URL: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  INITIAL_TOKEN_SUPPLY: number;
  REVIVE_COST: number;
  MIN_TOKENS_TO_PLAY: number;
}

declare global {
  interface Window {
    ARCADE_CONFIG: ArcadeConfig;
  }
}
