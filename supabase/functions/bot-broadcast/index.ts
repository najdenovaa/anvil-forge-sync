// bot-broadcast — send a templated message to all known chats of a bot.
//
// POST { bot_id: uuid, text: string }
// Auth: caller's JWT (must own the bot).
//
// Recipients: distinct chat_id from bot_sessions for that bot. The runtime
// inserts a session row on first interaction, so this covers everyone who
// has ever talked to the bot.
//
// Telegram rate limit: ~30 msg/sec to different users. We pace at ~25/sec.

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "missing auth" }, 401);

  // Auth-scoped client to identify caller via RLS-friendly auth.getUser.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp?.user) return json({ error: "unauthorized" }, 401);
  const userId = userResp.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const bot_id = String(body?.bot_id ?? "").trim();
  const text = String(body?.text ?? "").trim();
  if (!bot_id) return json({ error: "bot_id required" }, 400);
  if (!text) return json({ error: "text required" }, 400);
  if (text.length > 4000) return json({ error: "text too long (max 4000)" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: bot } = await admin.from("bots").select("*").eq("id", bot_id).maybeSingle();
  if (!bot) return json({ error: "bot not found" }, 404);
  if (bot.owner_id && bot.owner_id !== userId) return json({ error: "forbidden" }, 403);

  let token: string;
  try {
    token = await decryptToken(bot.bot_token_encrypted);
  } catch (err) {
    return json({ error: `decrypt failed: ${String(err)}` }, 500);
  }

  // Recipients: distinct chat_id from sessions for this bot.
  const { data: sessions } = await admin
    .from("bot_sessions")
    .select("chat_id")
    .eq("bot_id", bot_id);
  const chatIds = Array.from(new Set((sessions ?? []).map((s: any) => String(s.chat_id))));

  // Create broadcast row.
  const { data: br, error: brErr } = await admin
    .from("bot_broadcasts")
    .insert({
      bot_id,
      flow_id: bot.flow_id,
      owner_id: userId,
      text,
      status: "sending",
      recipients_total: chatIds.length,
    })
    .select("id")
    .single();
  if (brErr || !br) return json({ error: brErr?.message ?? "failed to create broadcast" }, 500);

  let sent = 0;
  let failed = 0;
  for (const chat_id of chatIds) {
    try {
      const r = await fetch(`${TG_API}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text }),
      });
      if (r.ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
    // ~25 msg/sec
    await sleep(40);
  }

  await admin
    .from("bot_broadcasts")
    .update({
      status: "done",
      sent_count: sent,
      fail_count: failed,
      sent_at: new Date().toISOString(),
    })
    .eq("id", br.id);

  return json({ broadcast_id: br.id, sent, failed, recipients_total: chatIds.length });
});
