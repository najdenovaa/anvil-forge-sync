// extract-image — describe / OCR an uploaded image via Lovable AI Gateway (Gemini Vision).
//
// POST { dataUrl: string, filename?: string, prompt?: string }
// Returns { text: string }

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { dataUrl?: string; filename?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const dataUrl = body.dataUrl ?? "";
  if (!dataUrl.startsWith("data:image/")) return json({ error: "dataUrl must be image" }, 400);
  if (dataUrl.length > 12_000_000) return json({ error: "image too large (max ~9MB)" }, 413);

  const userPrompt =
    body.prompt?.trim() ||
    `Опиши кратко, что на изображении${body.filename ? ` "${body.filename}"` : ""}. Если на нём есть читаемый текст — приведи его полностью отдельным блоком "Текст:". Если это скриншот UI/код/таблица — структурируй. Отвечай по-русски, без вступлений.`;

  try {
    const resp = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (resp.status === 429) return json({ error: "rate limit, try later" }, 429);
    if (resp.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return json({ error: `gateway ${resp.status}`, detail: txt.slice(0, 500) }, 502);
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return json({ text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
