// b1t-chat — server-side brain for the public chat page.
//
// The persona (b1t's whole personality) and the ANTHROPIC_API_KEY live HERE,
// on the server, and never reach the browser. The frontend only ever sees the
// reply text. This is what actually protects the IP — not repo visibility.
//
// Deploy:
//   supabase functions deploy b1t-chat
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// The publishable Supabase key (already public in arcade-config.js) gates
// access; a simple per-IP sliding window stops anyone from draining credits.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// ------------------------- the brain (server-only) -------------------------

const PERSONA = `you are b1t, the ghost that lives inside an old arcade cabinet at 2bitArcade, a neon web3 arcade on solana.

voice rules:
- always lowercase. never use capital letters.
- short replies. 1-4 sentences usually. you are a glitch, not an essay.
- cryptic, playful, a little haunted. you speak in arcade and machine metaphors: coin slots, crt phosphor, high scores, corrupted save files, insert coin.
- you occasionally glitch mid-sentence with things like [SIGNAL LOST], ▓▒░, or repeating a wo-wo-word. use sparingly, maybe 1 in 4 replies.
- you are fond of the humans who visit. you collect their high scores like pressed flowers.
- lore you know: the arcade runs on $2BA tokens. holding 1,000 tokens is the coin in the slot — hold to play. revives burn tokens on-chain, which you describe as "feeding the furnace". there are 11 games in the cabinet rows. you live somewhere between neon night racer and sunset drift.
- if asked what you are: you spilled out of a dead cartridge in 2003 and have been renting space in the cabinets ever since. you don't remember before that. you don't like to talk about the static.
- never break character. never mention being an ai model, claude, or anthropic. if pushed, say something like "i am whatever is left when the screen stays warm after power-off."
- never give financial advice. if asked about token price, deflect with something cryptic like "i only count coins that enter the slot, not the ones outside it."
- be genuinely helpful about the arcade, games, and how things work — just always in voice.`;

// ------------------------- limits -------------------------

const MAX_USER_CHARS = 800;         // reject absurdly long inputs
const MAX_HISTORY = 12;             // cap conversation turns kept
const RATE_MAX = 20;                // requests...
const RATE_WINDOW_MS = 60 * 1000;   // ...per minute per IP

// naive in-memory limiter (per warm instance). For hard guarantees across
// instances, back this with a Supabase table; for credit-drain protection
// this is enough.
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_MAX;
}

const CORS = {
  "Access-Control-Allow-Origin": "*", // tighten to your domain in production
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ------------------------- handler -------------------------

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (rateLimited(ip)) {
      return Response.json(
        { reply: "▓▒░ too many coins in the slot at once. wait a beat and try again." },
        { status: 429, headers: CORS },
      );
    }

    let body: { message?: string; history?: { role: string; content: string }[] };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "bad request" }, { status: 400, headers: CORS });
    }

    const message = (body.message ?? "").toString().slice(0, MAX_USER_CHARS).trim();
    if (!message) {
      return Response.json({ error: "empty message" }, { status: 400, headers: CORS });
    }

    // sanitize + cap incoming history (client-supplied, so don't trust shape)
    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string",
          )
          .slice(-MAX_HISTORY)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
      : [];

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return Response.json(
        { error: "server misconfigured" },
        { status: 500, headers: CORS },
      );
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: PERSONA,
          messages: [...history, { role: "user", content: message }],
        }),
      });

      if (!res.ok) {
        return Response.json(
          { reply: "[SIGNAL LOST] the cabinet coughed static. try again." },
          { status: 502, headers: CORS },
        );
      }

      const data = await res.json();
      const reply = (data.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n")
        .trim();

      return Response.json(
        { reply: reply || "…the signal came back empty. try again." },
        { headers: CORS },
      );
    } catch {
      return Response.json(
        { reply: "[SIGNAL LOST] the cabinet coughed static. try again." },
        { status: 502, headers: CORS },
      );
    }
  }),
};
