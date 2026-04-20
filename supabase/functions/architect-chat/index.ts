// Anvl AI Architect chat - streams via Lovable AI Gateway
// Supports GPT-5 and Gemini natively. Returns 501 for grok/claude.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the Anvl AI Architect — a senior product engineer who designs Telegram and Max bots, plus their mini-apps.
You help the user describe a bot flow in plain language, then propose a concrete node graph (triggers, messages, keyboards, mini-app screens, logic, API calls).
Be concise (1-3 short paragraphs unless asked). Reply in the user's language. Use bullet lists when proposing steps. Never invent fake API tokens.`;

const MODEL_MAP: Record<string, string> = {
  gpt: "openai/gpt-5",
  gemini: "google/gemini-2.5-flash",
};

const UNSUPPORTED = new Set(["grok", "claude"]);

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

    const modelKey = (model ?? "gemini").toLowerCase();

    if (UNSUPPORTED.has(modelKey)) {
      return json(
        {
          error: "model_unavailable",
          message:
            "This model is not available in Lovable AI Gateway yet. Try GPT-5 or Gemini.",
        },
        501,
      );
    }

    const aiModel = MODEL_MAP[modelKey] ?? "google/gemini-2.5-flash";
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
            ...messages.slice(-12), // keep last 12 turns for context
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
