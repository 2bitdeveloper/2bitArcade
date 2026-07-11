# 2bitArcade

A neon web3 arcade on Solana. Eleven games, one token, one ghost.

**Site:** https://2bitdeveloper.github.io/2bitArcade/

## ▓ Official channels ▓

- **X (Twitter):** [@b1t_exe](https://x.com/b1t_exe) — the cabinet ghost. This is the ONLY official account.
- **Token:** $2BA. The only official contract address is the one published in
  [`public/arcade-config.js`](public/arcade-config.js) (`CONTRACT_ADDRESS`) and shown in the site footer.

> the only official x account is @b1t_exe. the only official $2BA contract
> address appears on the site. anything else is an impostor wearing our ghost.

Any token, account, or site claiming to be 2bitArcade or b1t that doesn't match
the above is fake. This file's commit history is the timestamped record.

## Repo layout

- `index.html` + game pages — the arcade (Vite/TypeScript, GitHub Pages)
- `public/arcade-config.js` — single source of truth for token + backend config
- `supabase/` — edge functions (wallet identity system)
