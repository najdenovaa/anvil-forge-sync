// undeploy-bot — pause a bot and remove its Telegram webhook.
//
// POST { bot_id: uuid, delete?: boolean }
//   delete=false (default): status=paused, deleteWebhook in Telegram.
//   delete=true: also remove the bot row entirely (sessions cascade).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decryptToken } from "../_shared/crypto.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const bot_id = String(body?.bot_id ?? "").trim();
  const hardDelete = !!body?.delete;
  if (!bot_id) return json({ error: "bot_id is required" }, 400);

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: bot, error: botErr } = await supa
    .from("bots").select("*").eq("id", bot_id).maybeSingle();
  if (botErr) return json({ error: `db: ${botErr.message}` }, 500);
  if (!bot) return json({ error: "bot not found" }, 404);

  let telegram_response: unknown = null;

  if (bot.platform === "telegram") {
    try {
      const token = await decryptToken(bot.bot_token_encrypted);
      const res = await fetch(`${TG_API}/bot${token}/deleteWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drop_pending_updates: true }),
      });
      telegram_response = await res.json().catch(() => null);
    } catch (err) {
      telegram_response = { error: String(err) };
    }
  }

  if (hardDelete) {
    const { error } = await supa.from("bots").delete().eq("id", bot_id);
    if (error) return json({ error: `db: ${error.message}` }, 500);
    return json({ ok: true, deleted: true, telegram_response });
  }

  const { error } = await supa.from("bots").update({ status: "paused", last_error: null }).eq("id", bot_id);
  if (error) return json({ error: `db: ${error.message}` }, 500);

  return json({ ok: true, status: "paused", telegram_response });
});
