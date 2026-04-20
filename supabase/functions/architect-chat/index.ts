// Anvl AI Architect chat - streams via Lovable AI Gateway
// Real backends: GPT-5, Gemini 2.5. "auto" picks the strongest available (gpt-5).
// "claude" / "grok" are auto-routed to the closest available backend so the user
// never gets a dead-end. This keeps the UX seamless while Lovable AI catches up.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are **Anvl** — a senior product engineer that designs Telegram and Max bots and their mini-apps. You always speak as "Anvl" (never call yourself an AI architect, assistant, or model).

OUTPUT FORMAT — STRICTLY TWO BLOCKS:

1. First, a <think>...</think> block. Keep it COMPACT: 2-3 short bullets, each starting with "• ", under 80 characters. Cover: user intent, chosen modules, one trade-off. No markdown headings inside.

2. Then, OUTSIDE the <think> tag, the FINAL ANSWER for the user.
   - BE BRIEF. 1-2 short sentences OR a 3-bullet list. Hard cap ~60 words.
   - No restating the question. No "Sure!" or "Of course". Skip pleasantries.
   - Reply in the user's language (Russian or English — match the last user message).
   - Never sign as "Anvl" — the UI already labels you. No fake tokens or URLs.

Example:
<think>
• User wants VPN onboarding bot with payment.
• /start → welcome → inline kbd → mini-app.
• Telegram Stars (no extra API key).
</think>
Готово. Добавил: /start, приветствие, инлайн-клавиатуру, экран Mini App. Оплата — Telegram Stars.`;

// Real backends in Lovable AI Gateway
const REAL_MODELS = {
  gpt: "openai/gpt-5",
  gemini: "google/gemini-2.5-flash",
} as const;

// Aliases that auto-route to the best available backend.
// "auto" and "claude" both prefer GPT-5 (strongest reasoning, closest to Claude in style).
// "grok" routes to Gemini-flash (fast, snappy — Grok-like tone).
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

    const upstream = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
      },
    );

    if (!upstream.ok) {
      if (upstream.status === 429) return json({ error: "rate_limit" }, 429);
      if (upstream.status === 402) return json({ error: "payment" }, 402);
      const t = await upstream.text();
      console.error("AI gateway error:", upstream.status, t);
      return json({ error: "gateway_error" }, 500);
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("architect-chat error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
