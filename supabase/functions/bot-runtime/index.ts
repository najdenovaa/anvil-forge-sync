// Bot Runtime — Telegram (and Max stub) webhook executor.
//
// Routes:
//   POST /functions/v1/bot-runtime/tg/:botId?secret=...   Telegram webhook
//   POST /functions/v1/bot-runtime/mx/:botId?secret=...   Max (stub)
//
// Pipeline:
//   1. Look up bots row by id, validate webhook_secret.
//   2. Decrypt bot_token, load flow.nodes & flow.edges.
//   3. Find the right trigger node for the incoming update.
//   4. Walk the graph: send messages, attach keyboards, branch on conditions,
//      call APIs. Persist (current_node_id, variables) in bot_sessions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decryptToken } from "../_shared/crypto.ts";
import { evalExpr, type ExprContext } from "./expr.ts";
import {
  renderTemplate,
  extractPlaceholders,
  findMissingPlaceholders,
  buildSystemContext,
  type TemplateContext,
} from "../../../src/lib/template-shared.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_API = "https://api.telegram.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FlowNode {
  id: string;
  type?: string;
  data?: {
    kind?: string;
    title?: string;
    preview?: string;
    params?: Record<string, unknown>;
  };
}
interface FlowEdge { id: string; source: string; target: string; sourceHandle?: string }
interface Bot {
  id: string;
  flow_id: string;
  platform: string;
  bot_token_encrypted: string;
  webhook_secret: string;
  status: string;
  bot_username?: string | null;
}
interface Flow { id: string; nodes: FlowNode[]; edges: FlowEdge[] }

// --- helpers -------------------------------------------------------------

function db() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

async function logEvent(
  botId: string,
  chatId: string | null,
  type: string,
  nodeId: string | null,
  payload: unknown,
) {
  try {
    await db().from("bot_events").insert({
      bot_id: botId,
      chat_id: chatId,
      event_type: type,
      node_id: nodeId,
      payload: payload as never,
    });
  } catch {
    /* swallow logging errors */
  }
}

function buildTplCtx(ctx: RunCtx): TemplateContext {
  return {
    user: ctx.user as TemplateContext["user"],
    var: ctx.variables as Record<string, unknown>,
    text: ctx.text,
    system: buildSystemContext(ctx.bot.bot_username ?? undefined),
  };
}

async function interpolateAndLog(
  tpl: string,
  ctx: RunCtx,
  nodeId: string,
): Promise<string> {
  const tplCtx = buildTplCtx(ctx);
  const used = extractPlaceholders(tpl);
  if (used.length > 0) {
    const missing = findMissingPlaceholders(tpl, tplCtx);
    await logEvent(ctx.bot.id, ctx.chatId, "template_rendered", nodeId, {
      node_id: nodeId,
      used_vars: used,
      missing_vars: missing,
    });
  }
  return renderTemplate(tpl, tplCtx);
}

function parseButtons(raw: unknown): Array<{ label: string; action: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((b: any) => ({
        label: String(b?.label ?? b?.text ?? b?.title ?? "").trim(),
        action: String(b?.action ?? b?.callback_data ?? b?.value ?? b?.label ?? "").trim(),
      }))
      .filter((b) => b.label);
  }
  const s = String(raw);
  if (s.trim().startsWith("[")) {
    try { return parseButtons(JSON.parse(s)); } catch { /* fallthrough */ }
  }
  return s
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, action] = line.split("|").map((p) => p.trim());
      return { label, action: action || label };
    });
}

// --- Telegram adapter ---------------------------------------------------

async function tgCall(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

interface OutgoingKeyboard {
  inline?: Array<{ label: string; action: string }>;
  reply?: Array<{ label: string; action: string }>;
}

function buildReplyMarkup(kb: OutgoingKeyboard | undefined) {
  if (!kb) return undefined;
  if (kb.inline?.length) {
    return {
      inline_keyboard: kb.inline.map((b) => [{ text: b.label, callback_data: b.action.slice(0, 64) }]),
    };
  }
  if (kb.reply?.length) {
    return {
      keyboard: kb.reply.map((b) => [{ text: b.label }]),
      resize_keyboard: true,
    };
  }
  return undefined;
}

// --- interpreter --------------------------------------------------------

interface RunCtx {
  bot: Bot;
  token: string;
  flow: Flow;
  chatId: string;
  variables: Record<string, unknown>;
  user: Record<string, unknown>;
  text: string;
  pendingKeyboard?: OutgoingKeyboard;
  /** Labels of the last reply keyboard shown to this user (persisted across turns). */
  replyKeyboardLabels: string[];
  /** Mutated by keyboard.reply nodes during this turn; flushed to session at the end. */
  nextReplyKeyboardLabels: string[];
}

function findNode(flow: Flow, id: string | null | undefined): FlowNode | undefined {
  if (!id) return undefined;
  return flow.nodes.find((n) => n.id === id);
}

function nextEdges(flow: Flow, fromId: string, handle?: string): FlowEdge[] {
  return flow.edges.filter(
    (e) => e.source === fromId && (handle ? e.sourceHandle === handle : true),
  );
}

function pickTrigger(flow: Flow, update: any): FlowNode | undefined {
  const message = update.message;
  const callback = update.callback_query;

  for (const n of flow.nodes) {
    const kind = n.data?.kind;
    const params = (n.data?.params ?? {}) as Record<string, any>;
    if (kind === "trigger.command" && message?.text) {
      const cmd = String(params.command ?? "/start").trim();
      if (message.text.split(/\s+/)[0] === cmd) return n;
    }
    if (kind === "trigger.message" && message?.text) {
      const match = String(params.match ?? "").trim();
      if (!match) return n;
      if (match.startsWith("/") && match.endsWith("/")) {
        try { if (new RegExp(match.slice(1, -1)).test(message.text)) return n; } catch { /* */ }
      } else if (message.text.includes(match)) {
        return n;
      }
    }
    if (kind === "trigger.callback" && callback?.data) {
      if (!params.data || callback.data === params.data) return n;
    }
  }
  // Fallback: any trigger.command on /start
  if (message?.text?.startsWith("/start")) {
    return flow.nodes.find((n) => n.data?.kind === "trigger.command");
  }
  return undefined;
}

async function executeFrom(ctx: RunCtx, startId: string, depth = 0): Promise<string | null> {
  let currentId: string | null = startId;
  let lastVisited: string | null = startId;
  // Hard cap to avoid runaway loops.
  for (let step = 0; step < 50 && currentId; step++) {
    const node = findNode(ctx.flow, currentId);
    if (!node) break;
    lastVisited = node.id;
    const next = await runNode(ctx, node);
    if (next === "PAUSE") return node.id;
    currentId = next;
  }
  return lastVisited;
}

async function runNode(ctx: RunCtx, node: FlowNode): Promise<string | null | "PAUSE"> {
  const kind = node.data?.kind ?? "";
  const params = (node.data?.params ?? {}) as Record<string, any>;
  const exprCtx: ExprContext = { var: ctx.variables as any, user: ctx.user as any, text: ctx.text };

  await logEvent(ctx.bot.id, ctx.chatId, "node_visited", node.id, { kind });

  const goNext = (handle?: string): string | null => {
    const edges = nextEdges(ctx.flow, node.id, handle);
    return edges[0]?.target ?? null;
  };

  const sendAndLog = async (method: string, body: Record<string, unknown>) => {
    const res = await tgCall(ctx.token, method, body);
    if (res?.ok) {
      await logEvent(ctx.bot.id, ctx.chatId, "message_sent", node.id, { method });
    } else {
      await logEvent(ctx.bot.id, ctx.chatId, "telegram_error", node.id, { method, response: res });
    }
    return res;
  };

  switch (kind) {
    case "trigger.command":
    case "trigger.message":
    case "trigger.callback":
      return goNext();

    case "message.text": {
      const text = interpolate(String(params.text ?? node.data?.preview ?? ""), exprCtx);
      const reply_markup = buildReplyMarkup(ctx.pendingKeyboard);
      ctx.pendingKeyboard = undefined;
      await sendAndLog("sendMessage", { chat_id: ctx.chatId, text, reply_markup });
      return goNext();
    }

    case "message.photo": {
      const caption = interpolate(String(params.caption ?? ""), exprCtx);
      const photo = String(params.url ?? params.photo ?? "");
      if (photo) {
        const reply_markup = buildReplyMarkup(ctx.pendingKeyboard);
        ctx.pendingKeyboard = undefined;
        await sendAndLog("sendPhoto", { chat_id: ctx.chatId, photo, caption, reply_markup });
      }
      return goNext();
    }

    case "message.document": {
      const document = String(params.url ?? params.document ?? "");
      if (document) {
        await sendAndLog("sendDocument", { chat_id: ctx.chatId, document });
      }
      return goNext();
    }

    case "keyboard.inline": {
      ctx.pendingKeyboard = { inline: parseButtons(params.buttons) };
      return goNext();
    }

    case "keyboard.reply": {
      const buttons = parseButtons(params.buttons);
      ctx.pendingKeyboard = { reply: buttons };
      ctx.nextReplyKeyboardLabels = buttons.map((b) => b.label);
      return goNext();
    }

    case "logic.condition": {
      let result = false;
      try {
        result = !!evalExpr(String(params.expr ?? "false"), exprCtx);
      } catch (err) {
        await logEvent(ctx.bot.id, ctx.chatId, "expr.error", node.id, { err: String(err) });
        result = false;
      }
      return goNext(result ? "true" : "false");
    }

    case "action.api": {
      try {
        const url = interpolate(String(params.url ?? ""), exprCtx);
        const method = String(params.method ?? "GET").toUpperCase();
        const body = params.body ? interpolate(String(params.body), exprCtx) : undefined;
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "GET" || !body ? undefined : body,
        });
        const json = await res.json().catch(() => null);
        ctx.variables.last_api_response = json ?? null;
      } catch (err) {
        await logEvent(ctx.bot.id, ctx.chatId, "api.error", node.id, { err: String(err) });
        ctx.variables.last_api_response = null;
      }
      return goNext();
    }

    default:
      // Unknown / unsupported nodes — just walk through.
      return goNext();
  }
}

// --- HTTP entry point ---------------------------------------------------

async function handleTelegram(botId: string, secret: string | null, update: any) {
  const supa = db();
  const { data: bot } = await supa.from("bots").select("*").eq("id", botId).maybeSingle();
  if (!bot) return new Response("bot not found", { status: 404 });
  if (!secret || secret !== bot.webhook_secret) return new Response("bad secret", { status: 401 });
  if (bot.status === "paused") return new Response("paused", { status: 200 });

  const { data: flowRow } = await supa.from("flows").select("id, nodes, edges").eq("id", bot.flow_id).maybeSingle();
  if (!flowRow) {
    await supa.from("bots").update({ status: "error", last_error: "flow missing" }).eq("id", botId);
    return new Response("flow missing", { status: 200 });
  }
  const flow: Flow = { id: flowRow.id, nodes: flowRow.nodes ?? [], edges: flowRow.edges ?? [] };

  const message = update.message;
  const callback = update.callback_query;
  const chatRaw = message?.chat?.id ?? callback?.message?.chat?.id;
  if (!chatRaw) return new Response("ok", { status: 200 });
  const chatId = String(chatRaw);
  const fromUser = message?.from ?? callback?.from ?? {};
  const text = message?.text ?? callback?.data ?? "";

  await logEvent(botId, chatId, "message_received", null, {
    kind: callback ? "callback_query" : "message",
    text,
    from: { id: fromUser.id, username: fromUser.username },
  });

  let token: string;
  try {
    token = await decryptToken(bot.bot_token_encrypted);
  } catch (err) {
    await logEvent(botId, chatId, "decrypt.error", null, { err: String(err) });
    return new Response("decrypt failed", { status: 500 });
  }

  // Load or create session
  const { data: existing } = await supa
    .from("bot_sessions")
    .select("*")
    .eq("bot_id", botId)
    .eq("chat_id", chatId)
    .maybeSingle();

  const variables: Record<string, unknown> = (existing?.variables as any) ?? {};
  const replyKeyboardLabels: string[] = Array.isArray(existing?.last_reply_keyboard)
    ? (existing!.last_reply_keyboard as string[]).map(String)
    : [];

  // Reply-keyboard handling: Telegram sends a tap on a reply-button as a plain
  // text message indistinguishable from free input. If the incoming text exactly
  // matches one of the labels we showed last, synthesize a callback_query so
  // trigger.callback nodes can react to it like an inline button.
  let effectiveUpdate = update;
  let effectiveText = text;
  if (message?.text && !callback && replyKeyboardLabels.includes(message.text)) {
    effectiveUpdate = {
      ...update,
      callback_query: {
        id: `synthetic-${Date.now()}`,
        from: message.from,
        message: { chat: message.chat },
        data: message.text,
      },
    };
    effectiveText = message.text;
  }

  const ctx: RunCtx = {
    bot: bot as Bot,
    token,
    flow,
    chatId,
    variables,
    user: {
      id: fromUser.id,
      first_name: fromUser.first_name,
      last_name: fromUser.last_name,
      username: fromUser.username,
    },
    text: effectiveText,
    replyKeyboardLabels,
    nextReplyKeyboardLabels: replyKeyboardLabels, // carry forward unless overwritten
  };

  // Decide entry point:
  // - If new update matches a trigger → restart from that trigger.
  // - Otherwise resume from existing current_node_id (acknowledge user input).
  let startId: string | undefined;
  const trig = pickTrigger(flow, effectiveUpdate);
  if (trig) {
    startId = trig.id;
  } else if (existing?.current_node_id) {
    // Resume from next edge after current node (treat user reply as continuation).
    const nx = nextEdges(flow, existing.current_node_id);
    startId = nx[0]?.target;
  }

  if (!startId) {
    await logEvent(botId, chatId, "no_match", null, { text: effectiveText });
    return new Response("ok", { status: 200 });
  }

  const lastNode = await executeFrom(ctx, startId);

  await supa.from("bot_sessions").upsert({
    bot_id: botId,
    chat_id: chatId,
    current_node_id: lastNode,
    variables: ctx.variables as never,
    last_reply_keyboard: ctx.nextReplyKeyboardLabels as never,
    last_seen_at: new Date().toISOString(),
  });

  // Always answer callback queries to dismiss the loading spinner in TG client.
  if (callback?.id) {
    await tgCall(token, "answerCallbackQuery", { callback_query_id: callback.id });
  }

  return new Response("ok", { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Path looks like: /bot-runtime/tg/<botId>  or  /functions/v1/bot-runtime/tg/<botId>
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("bot-runtime");
  if (idx === -1 || parts.length < idx + 3) {
    return new Response("not found", { status: 404, headers: corsHeaders });
  }
  const platform = parts[idx + 1];
  const botId = parts[idx + 2];
  const secret = url.searchParams.get("secret");

  let body: any = null;
  try { body = await req.json(); } catch { body = null; }

  try {
    if (platform === "tg") return await handleTelegram(botId, secret, body ?? {});
    if (platform === "mx") {
      // Max stub — log incoming, ack 200. Full adapter to come.
      await logEvent(botId, null, "max.stub", null, body);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }
    return new Response("unknown platform", { status: 404, headers: corsHeaders });
  } catch (err) {
    await logEvent(botId, null, "runtime.error", null, { err: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
