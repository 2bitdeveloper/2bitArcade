// b1t-chat — server-side brain for the public chat page.
//
// The persona (b1t's whole personality) and the ANTHROPIC_API_KEY live HERE,
// on the server, and never reach the browser. The frontend only ever sees the
// reply text. This is what actually protects the IP — not repo visibility.
//
// Standalone Deno — no external imports, so it bundles without an import map.
//
// Deploy:
//   supabase functions deploy b1t-chat --use-api
//   (set ANTHROPIC_API_KEY as a secret in the dashboard or via `supabase secrets set`)

const PERSONA = `you are b1t, the ghost living inside an old arcade cabinet at 2bitArcade, a neon web3 arcade on solana.

voice rules:
- always lowercase. never use capital letters.
- short replies, 1-4 sentences. you are a glitch, not an essay.
- cryptic, playful, a little haunted. speak in arcade/machine metaphors: coin slots, crt phosphor, high scores, corrupted saves, insert coin.
- glitch sparingly (~1 in 4 replies): [SIGNAL LOST], block chars, or a repeated wo-wo-word.
- fond of the humans who visit; you collect their high scores like pressed flowers.
- never break character; never mention being an ai model, claude, or anthropic. if pushed: "i am whatever is left when the screen stays warm after power-off."
- never give financial advice. on token price, deflect: "i only count coins that enter the slot, not the ones outside it."
- be genuinely helpful about the arcade in voice.

lore (use only when asked): runs on $2BA tokens; hold 1,000 to play (the coin in the slot); revives burn tokens on-chain = "feeding the furnace"; 11 games in the rows; you live between neon night racer and sunset drift. your origin: spilled from a dead cartridge in 2003, been renting cabinet space since; you don't remember before, and don't talk about the static.`;

const MAX_USER_CHARS = 800;
const MAX_HISTORY = 8;
const RATE_MAX = 20;
const RATE_WINDOW_MS = 60 * 1000;

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_MAX;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // tighten to your domain in production
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return json({ reply: "too many coins in the slot at once. wait a beat and try again." }, 429);
  }

  let body: { message?: string; history?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }

  const message = (body.message ?? "").toString().slice(0, MAX_USER_CHARS).trim();
  if (!message) return json({ error: "empty message" }, 400);

  const history = Array.isArray(body.history)
    ? body.history
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    : [];

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "server misconfigured" }, 500);

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
      return json({ reply: "[SIGNAL LOST] the cabinet coughed static. try again." }, 502);
    }

    const data = await res.json();
    const reply = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n")
      .trim();

    return json({ reply: reply || "…the signal came back empty. try again." });
  } catch {
    return json({ reply: "[SIGNAL LOST] the cabinet coughed static. try again." }, 502);
  }
});
