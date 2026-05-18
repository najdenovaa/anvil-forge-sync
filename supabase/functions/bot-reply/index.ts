// bot-reply — send a single direct message from admin to one bot user.
//
// POST { bot_id: uuid, chat_id: string, text: string }
// Auth: caller's JWT (must own the bot).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decryptToken } from "../_shared/crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
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

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "missing auth" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp?.user) return json({ error: "unauthorized" }, 401);
  const userId = userResp.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const bot_id = String(body?.bot_id ?? "").trim();
  const chat_id = String(body?.chat_id ?? "").trim();
  const text = String(body?.text ?? "").trim();
  if (!bot_id || !chat_id || !text) return json({ error: "bot_id, chat_id and text required" }, 400);
  if (text.length > 4000) return json({ error: "text too long (max 4000)" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: bot } = await admin.from("bots").select("*").eq("id", bot_id).maybeSingle();
  if (!bot) return json({ error: "bot not found" }, 404);
  if (bot.owner_id && bot.owner_id !== userId) return json({ error: "forbidden" }, 403);

  let token: string;
  try { token = await decryptToken(bot.bot_token_encrypted); }
  catch (err) { return json({ error: `decrypt failed: ${String(err)}` }, 500); }

  const r = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text }),
  });
  const tgData = await r.json().catch(() => ({}));
  if (!r.ok || !tgData?.ok) {
    await admin.from("bot_events").insert({
      bot_id, chat_id, event_type: "admin_reply.failed", payload: { text, tg: tgData } as never,
    });
    return json({ error: tgData?.description ?? "send failed", tg: tgData }, 502);
  }

  await admin.from("bot_events").insert({
    bot_id, chat_id, event_type: "admin_reply.sent", payload: { text, by: userId } as never,
  });

  return json({ ok: true });
});
