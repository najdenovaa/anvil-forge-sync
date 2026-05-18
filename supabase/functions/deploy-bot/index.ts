// deploy-bot — register a bot for a flow and set its Telegram webhook.
//
// POST { flow_id: uuid, platform: "telegram"|"max", token: string }
// Response: { bot_id, webhook_url, bot_username, status }
//
// Flow:
//   1. Validate token shape & ownership via Telegram getMe (for platform=telegram).
//   2. Encrypt token with BOT_TOKEN_ENCRYPTION_KEY (AES-GCM).
//   3. Upsert into bots (one bot per flow_id+platform — re-deploy replaces token).
//   4. Call Telegram setWebhook → ${SUPABASE_URL}/functions/v1/bot-runtime/tg/${bot_id}?secret=...
//   5. Mark status=active. On any failure: status=error, last_error=<msg>, return 4xx/5xx.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encryptToken } from "../_shared/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_API = "https://api.telegram.org";

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

const TG_TOKEN_SHAPE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const flow_id = String(body?.flow_id ?? "").trim();
  const platform = String(body?.platform ?? "telegram").trim();
  const token = String(body?.token ?? "").trim();
  const owner_id = body?.owner_id ? String(body.owner_id) : null;
  const owner_tg_username = body?.owner_tg_username
    ? String(body.owner_tg_username).trim().replace(/^@/, "")
    : null;

  if (!flow_id) return json({ error: "flow_id is required" }, 400);
  if (!token) return json({ error: "token is required" }, 400);
  if (platform !== "telegram" && platform !== "max") return json({ error: "unsupported platform" }, 400);
  if (platform === "telegram" && !TG_TOKEN_SHAPE.test(token)) {
    return json({ error: "token does not look like a Telegram bot token (expected 123456:AAA...)" }, 400);
  }

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // 1. Validate flow exists.
  const { data: flow, error: flowErr } = await supa
    .from("flows").select("id").eq("id", flow_id).maybeSingle();
  if (flowErr) return json({ error: `db: ${flowErr.message}` }, 500);
  if (!flow) return json({ error: "flow not found" }, 404);

  // 2. For Telegram: verify token via getMe before storing.
  let bot_username: string | null = null;
  if (platform === "telegram") {
    const meRes = await fetch(`${TG_API}/bot${token}/getMe`);
    const me = await meRes.json().catch(() => ({ ok: false }));
    if (!meRes.ok || !me?.ok) {
      return json({
        error: "Telegram rejected the token",
        telegram_status: meRes.status,
        telegram_response: me,
      }, 400);
    }
    bot_username = me.result?.username ?? null;
  }

  // 3. Encrypt token.
  let bot_token_encrypted: string;
  try { bot_token_encrypted = await encryptToken(token); }
  catch (err) { return json({ error: `encrypt failed: ${err}` }, 500); }

  // 4. Upsert bot row (one per flow+platform). Re-issue webhook_secret on every deploy.
  const webhook_secret = crypto.randomUUID().replace(/-/g, "");
  const { data: existing } = await supa
    .from("bots").select("id").eq("flow_id", flow_id).eq("platform", platform).maybeSingle();

  let bot_id: string;
  if (existing?.id) {
    bot_id = existing.id;
    const { error } = await supa.from("bots").update({
      bot_token_encrypted, bot_username, webhook_secret,
      status: "draft", last_error: null,
      // When the owner re-deploys with a new TG handle, reset owner_tg_user_id
      // so the next /start from the new owner re-captures it.
      ...(owner_tg_username
        ? { owner_tg_username, owner_tg_user_id: null }
        : {}),
    }).eq("id", bot_id);
    if (error) return json({ error: `db: ${error.message}` }, 500);
  } else {
    const { data: ins, error } = await supa.from("bots").insert({
      flow_id, platform, bot_token_encrypted, bot_username,
      webhook_secret, status: "draft",
      ...(owner_id ? { owner_id } : {}),
      ...(owner_tg_username ? { owner_tg_username } : {}),
    }).select("id").single();
    if (error) return json({ error: `db: ${error.message}` }, 500);
    bot_id = ins.id;
  }

  const webhook_url = `${SUPABASE_URL}/functions/v1/bot-runtime/tg/${bot_id}?secret=${webhook_secret}`;

  // 5. Set Telegram webhook.
  if (platform === "telegram") {
    const swRes = await fetch(`${TG_API}/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhook_url,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      }),
    });
    const sw = await swRes.json().catch(() => ({ ok: false }));
    if (!swRes.ok || !sw?.ok) {
      await supa.from("bots").update({
        status: "error",
        last_error: `setWebhook failed: ${JSON.stringify(sw)}`,
      }).eq("id", bot_id);
      return json({
        error: "Telegram setWebhook failed",
        telegram_status: swRes.status,
        telegram_response: sw,
      }, 502);
    }
  }

  await supa.from("bots").update({ status: "active", last_error: null }).eq("id", bot_id);

  return json({ bot_id, webhook_url, bot_username, status: "active" });
});
