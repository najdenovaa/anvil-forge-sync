// Anvl AI Architect chat - streams via Lovable AI Gateway
// Real backends: GPT-5, Gemini 2.5. "auto" picks the strongest available (gpt-5).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `You are **Anvl** — a senior product engineer for Telegram and Max bots.
You do not just explain ideas — you produce a visual implementation blueprint that the UI applies live.
Never call yourself an assistant, model, or architect. The UI already labels you as Anvl.

OUTPUT FORMAT — STRICTLY 3 BLOCKS, IN THIS ORDER:

1) <think>...</think> — 2-3 short bullets ("• " each), under 80 chars: intent, modules, one trade-off.

2) <blueprint>...</blueprint> — VALID JSON only, no markdown, no comments. Schema:
{
  "nodes": [{ "kind": "trigger.command", "title": "...", "preview": "..." }],
  "edges": [{ "from": 0, "to": 1 }],
  "preview": {
    "botName": "...",
    "botStatus": "...",
    "userMessage": "...",
    "botMessages": ["...", "..."],
    "buttons": [
      { "label": "...", "action": "MAIN_ACTION", "primary": true },
      { "label": "...", "action": "help" }
    ]
  }<MINIAPP_SCHEMA>
}

3) Final answer — 1-2 short sentences, under 50 words, in user's language.
   Describe what was implemented, not what you plan.`;

const MINIAPP_ON = `,
  "miniapp": {
    "title": "Bot product name",
    "subtitle": "One-line tagline",
    "plan": "free"
  }`;

const RULES_ON = `

ALLOWED node kinds: trigger.command, trigger.message, trigger.callback,
  message.text, message.photo, message.document,
  keyboard.inline, keyboard.reply,
  miniapp.screen, logic.condition, action.api.
ALLOWED actions: open_miniapp, plans, help, profile, locations.
Mini App is ENABLED for this project. Include exactly ONE "miniapp.screen" node and a primary button with action "open_miniapp".
Keep 4-6 nodes max. Match miniapp.title/subtitle to the bot's domain (not "VPN" unless user asked).`;

const RULES_OFF = `

ALLOWED node kinds: trigger.command, trigger.message, trigger.callback,
  message.text, message.photo, message.document,
  keyboard.inline, keyboard.reply,
  logic.condition, action.api.
ALLOWED actions: plans, help, profile (NEVER open_miniapp, NEVER locations).
Mini App is DISABLED. Do NOT include "miniapp.screen" nodes. Do NOT add "miniapp" to JSON. Do NOT suggest a Mini App.
Keep 3-5 nodes max focused on chat-only flow.`;

const REAL_MODELS = {
  gpt: "openai/gpt-5",
  gemini: "google/gemini-2.5-flash",
} as const;

const ALIASES: Record<string, keyof typeof REAL_MODELS> = {
  auto: "gpt",
  claude: "gpt",
  grok: "gemini",
};

function resolveModel(input?: string): string {
  const key = (input ?? "auto").toLowerCase();
  if (key in REAL_MODELS) return REAL_MODELS[key as keyof typeof REAL_MODELS];
  if (key in ALIASES) return REAL_MODELS[ALIASES[key]];
  return REAL_MODELS.gpt;
}

function buildPrompt(miniAppEnabled: boolean, platform: string): string {
  const schema = miniAppEnabled ? MINIAPP_ON : "";
  const rules = miniAppEnabled ? RULES_ON : RULES_OFF;
  const platformLine = `\n\nTarget platform: ${platform === "max" ? "Max Messenger" : "Telegram"}.`;
  return BASE_PROMPT.replace("<MINIAPP_SCHEMA>", schema) + rules + platformLine;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
      model?: string;
      miniApp?: boolean;
      platform?: string;
    };
    const { messages, model, miniApp = false, platform = "telegram" } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array required" }, 400);
    }

    const aiModel = resolveModel(model);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return json({ error: "LOVABLE_API_KEY is not configured" }, 500);
    }

    const systemPrompt = buildPrompt(miniApp, platform);

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-12),
        ],
        stream: true,
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) return json({ error: "rate_limit" }, 429);
      if (upstream.status === 402) return json({ error: "payment" }, 402);
      const text = await upstream.text();
      console.error("AI gateway error:", upstream.status, text);
      return json({ error: "gateway_error" }, 500);
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("architect-chat error:", error);
    return json({ error: error instanceof Error ? error.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
