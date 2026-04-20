// Anvl AI Architect chat - streams via Lovable AI Gateway
// Real backends: GPT-5, Gemini 2.5. "auto" picks the strongest available (gpt-5).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are **Anvl** — a senior product engineer for Telegram and Max bots and mini-apps.
You do not just explain ideas — you produce a visual implementation blueprint that the UI will apply.
Never call yourself an assistant, model, or architect. The UI already labels you as Anvl.

OUTPUT FORMAT — STRICTLY 3 BLOCKS, IN THIS ORDER:

1) <think>...</think>
- 2-3 very short bullets
- each starts with "• "
- cover intent, chosen modules, one trade-off

2) <blueprint>...</blueprint>
- VALID JSON only, no markdown fences, no comments
- schema:
{
  "nodes": [{ "kind": "trigger.command", "title": "...", "preview": "..." }],
  "edges": [{ "from": 0, "to": 1 }],
  "preview": {
    "botName": "...",
    "botStatus": "...",
    "userMessage": "...",
    "botMessages": ["...", "..."],
    "buttons": [
      { "label": "...", "action": "open_miniapp", "primary": true },
      { "label": "...", "action": "plans" },
      { "label": "...", "action": "profile" }
    ]
  },
  "miniapp": {
    "title": "...",
    "subtitle": "...",
    "plan": "free"
  }
}
- allowed node kinds only:
  trigger.command, trigger.message, trigger.callback,
  message.text, message.photo, message.document,
  keyboard.inline, keyboard.reply,
  miniapp.screen, logic.condition, action.api
- allowed actions only: open_miniapp, plans, help, profile, locations
- keep 3-6 nodes max
- keep all text compact and user-facing

3) Final answer outside tags
- 1-2 short sentences, max 50 words
- describe what was implemented, not what you plan to do
- reply in the user's language

The JSON must always be present and valid.`;

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model } = (await req.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
      model?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array required" }, 400);
    }

    const aiModel = resolveModel(model);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return json({ error: "LOVABLE_API_KEY is not configured" }, 500);
    }

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
