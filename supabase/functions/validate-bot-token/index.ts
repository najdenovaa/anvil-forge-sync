// validate-bot-token — read-only check that a Telegram bot token is alive.
//
// POST { token: string, platform: "telegram"|"max" }
// Response: { ok: true, username, first_name } | { ok: false, error: "..." }
//
// Stateless: no DB writes, no encryption. Safe to call on every keystroke
// (debounce on the client). For platform="max" returns coming_soon.

const TG_API = "https://api.telegram.org";
const TG_TOKEN_SHAPE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid json" }, 400); }

  const token = String(body?.token ?? "").trim();
  const platform = String(body?.platform ?? "telegram").trim();

  if (!token) return json({ ok: false, error: "token is required" }, 400);
  if (platform === "max") return json({ ok: false, error: "max_coming_soon" }, 400);
  if (platform !== "telegram") return json({ ok: false, error: "unsupported platform" }, 400);
  if (!TG_TOKEN_SHAPE.test(token)) {
    return json({ ok: false, error: "bad_format" }, 400);
  }

  try {
    const res = await fetch(`${TG_API}/bot${token}/getMe`);
    const data = await res.json().catch(() => ({ ok: false }));
    if (!res.ok || !data?.ok) {
      return json({
        ok: false,
        error: "telegram_rejected",
        telegram_status: res.status,
        description: data?.description ?? null,
      }, 200);
    }
    return json({
      ok: true,
      username: data.result?.username ?? null,
      first_name: data.result?.first_name ?? null,
      id: data.result?.id ?? null,
    });
  } catch (err) {
    return json({ ok: false, error: "network", detail: String(err) }, 200);
  }
});
