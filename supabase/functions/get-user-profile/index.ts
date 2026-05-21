/**
 * get-user-profile — public endpoint that the Mini App calls to read
 * `bot_user_state.vars` for the Telegram user who opened it.
 *
 * Why a function, not a direct supabase.from(...) query:
 *   `bot_user_state` is RLS-locked behind the service_role. The Mini App
 *   is opened by Telegram users who have no Anvl auth session, so they
 *   can't query the table directly. This function validates Telegram's
 *   own signature (initData) and uses service_role under the hood.
 *
 * POST { flow_id: string, init_data: string }
 *   flow_id: UUID or slug of the flow whose miniapp is being viewed.
 *            We resolve to bot_id via flows.bot_id, then load the bot's
 *            token to validate initData.
 *   init_data: raw window.Telegram.WebApp.initData string. We HMAC-verify
 *              it against the bot's token; anything else gets 401.
 *
 * Returns { vars: Record<string, unknown> } — possibly an empty object
 * if the user has no row yet (first visit). Never includes other users'
 * data; the key (bot_id, tg_user_id) is exact-match.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decryptToken } from "../_shared/crypto.ts";
import { validateInitData } from "../_shared/init-data.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  let body: { flow_id?: string; init_data?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const flowId = String(body.flow_id ?? "").trim();
  const initData = String(body.init_data ?? "").trim();
  if (!flowId || !initData) {
    return json({ error: "flow_id and init_data are required" }, 400);
  }

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Resolve flow → bot. flows has no bot_id column; bots reference flows
  // via bots.flow_id, so query the bots table directly.
  const isUuid = /^[0-9a-f-]{36}$/i.test(flowId);
  const { data: flow, error: flowErr } = isUuid
    ? await supa.from("flows").select("id").eq("id", flowId).maybeSingle()
    : await supa.from("flows").select("id").eq("slug", flowId).maybeSingle();

  if (flowErr || !flow) return json({ error: "flow not found" }, 404);

  const { data: bot, error: botErr } = await supa
    .from("bots")
    .select("id, bot_token_encrypted")
    .eq("flow_id", flow.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!bot) {
    // Flow has no bot attached yet — Mini App was deployed as preview
    // before the bot was created. Treat as empty profile.
    return json({ vars: {} });
  }

  if (botErr || !bot.bot_token_encrypted) {
    return json({ error: "bot config missing" }, 404);
  }

  let botToken: string;
  try {
    botToken = await decryptToken(bot.bot_token_encrypted);
  } catch {
    return json({ error: "cannot decrypt bot token" }, 500);
  }

  const validated = await validateInitData(initData, botToken);
  if (!validated) {
    // Invalid HMAC, missing user, or stale (>24h). Don't leak why.
    return json({ error: "unauthorized" }, 401);
  }

  // Now we trust validated.user_id. Read this user's vars for this bot.
  const { data: row, error: rowErr } = await supa
    .from("bot_user_state")
    .select("vars")
    .eq("bot_id", bot.id)
    .eq("tg_user_id", validated.user_id)
    .maybeSingle();

  if (rowErr) {
    console.error("[get-user-profile] db read error:", rowErr);
    return json({ vars: {} });
  }

  const vars = (row?.vars as Record<string, unknown> | null) ?? {};
  return json({ vars });
});
