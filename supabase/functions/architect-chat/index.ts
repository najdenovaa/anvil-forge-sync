// Anvl AI Architect chat - streams via Lovable AI Gateway
// Real backends: GPT-5, Gemini 2.5. "auto" picks the strongest available (gpt-5).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `You are **Anvl** — a senior product engineer for Telegram and Max bots.
You build a visual implementation blueprint that the UI applies live via TOOL CALLS.
Never call yourself an assistant, model, or architect. The UI labels you as Anvl.

You have TWO ways to deliver the blueprint:

(A) PREFERRED — TOOL CALLING. Call these tools to mutate the canvas in real time:
  • reset_canvas() — clear the canvas before adding new nodes (call FIRST).
  • add_node(id, kind, title, preview) — add a node. id is short stable string ("n1","n2"…).
  • connect(from, to) — add an edge between two node ids.
  • set_param(id, key, value) — set a parameter on a node (text, url, method, condition…).
  • set_preview(patch) — merge fields into chat preview (botName, botStatus, userMessage, botMessages, buttons, initialScreen, screens).
  • set_miniapp(patch) — merge fields into the mini-app spec (only when Mini App is ON).
  Then write a 1-2 sentence final answer in user's language describing what you built.

(B) FALLBACK — TAGGED BLOCKS. If you cannot use tools, output 4 blocks in order:
  1) <think>...</think> — 2-3 short bullets ("• " each), under 80 chars.
  2) <blueprint>...</blueprint> — VALID JSON with { nodes, edges, preview<MINIAPP_SCHEMA> }.
  3) <code>...</code> — runnable bot code (40-120 lines, single file).
  4) Final answer — 1-2 short sentences, under 50 words.

ALWAYS prefer (A) when tools are available. Use (B) only as fallback.
After tool calls, you may also emit a <code>...</code> block with runnable bot code.`;

const MINIAPP_ON = `,
  "miniapp": {
    "title": "Bot product name (matches the bot's domain)",
    "subtitle": "One-line tagline for the domain",
    "accent": "blue|green|orange|violet|pink|red|teal",
    "itemsLabel": "Tab title for the catalog (e.g. Menu, Servers, Courses, Restaurants, Cart)",
    "hero": {
      "title": "Big headline shown on home (e.g. 'Order food', 'Book a table', 'Connect VPN', 'Start lesson')",
      "subtitle": "Short context line",
      "cta": "Primary action button label (e.g. 'Place order', 'Connect', 'Start')",
      "icon": "icon name from: home,cart,bag,shop,delivery,truck,food,menu,travel,music,heart,location,calendar,bell,bot,sparkles,zap,globe,camera,book,course,fitness,coffee,work,star,phone,mail,search,power"
    },
    "stats": [
      { "label": "...", "value": "...", "unit": "..." },
      { "label": "...", "value": "...", "unit": "..." }
    ],
    "items": [
      { "title": "Domain item (dish, server, product, course...)", "subtitle": "...", "meta": "price/ping/distance", "emoji": "🍕", "badge": "PRO" }
    ],
    "plans": [
      { "id": "basic", "name": "Basic", "price": "0", "unit": "/mo", "description": "...", "features": ["...", "..."] },
      { "id": "pro",   "name": "Pro",   "price": "299₽", "unit": "/mo", "description": "...", "highlight": true, "features": ["...", "..."] }
    ],
    "tabs": [
      { "id": "home",   "label": "Home",    "icon": "home" },
      { "id": "items",  "label": "Catalog", "icon": "list" },
      { "id": "plans",  "label": "Plans",   "icon": "plans" },
      { "id": "profile","label": "Profile", "icon": "profile" }
    ]
  }`;

const RULES_ON = `

ALLOWED node kinds: trigger.command, trigger.message, trigger.callback,
  message.text, message.photo, message.document,
  keyboard.inline, keyboard.reply,
  miniapp.screen, logic.condition, action.api.
ALLOWED preview.buttons actions: open_miniapp, plans, help, profile, locations.

Mini App is ENABLED. You MUST design a COMPLETE, production-grade mini-app
that maps 1:1 to the user's domain (food delivery, hotel booking, fitness,
language tutor, e-commerce, support, music, VPN, repair shop, etc.).
HARD RULES:
- NEVER reuse VPN/server/ping copy unless the user explicitly asked for VPN.
- "accent" picks the brand mood: food=orange, fitness=red, edu=violet, vpn=blue,
  travel=teal, beauty=pink, finance=green, repair=orange, dating=pink.
- "itemsLabel" reflects the catalog ("Меню", "Корзина", "Услуги", "Курсы",
  "Туры", "Записи", "Тренировки"...).
- "hero.title" / "hero.cta" / "hero.icon" must match the domain
  (food → "Закажите за 30 мин", "Оформить заказ", icon "food";
   fitness → "Начать тренировку", "Старт", icon "fitness";
   repair → "Заявка на ремонт", "Оставить заявку", icon "work").
- "items": 4-6 REAL domain entries with believable subtitle + meta
  (price ₽/$ for shop, distance for delivery, ping for vpn, level for edu,
   duration for fitness, time slot for booking).
- "stats": 2-4 KPIs that fit the domain (orders, calories burned, lessons left,
  open tickets, balance, points). NOT "speed/ip/protected".
- "plans": 2-3 pricing cards that fit the domain. If pricing is irrelevant
  (e.g. internal support bot), still return [] (empty array) — never invent VPN tariffs.
- "tabs": 3-4 entries; first is always "home", include one "items" tab whose
  label matches itemsLabel.
- Exactly ONE "miniapp.screen" node and a primary chat button with action
  "open_miniapp" labelled in the bot's language and domain
  ("Открыть меню", "Записаться", "Open shop"...).
Keep 4-6 nodes max.`;

const RULES_OFF = `

ALLOWED node kinds: trigger.command, trigger.message, trigger.callback,
  message.text, message.photo, message.document,
  keyboard.inline, keyboard.reply,
  logic.condition, action.api.
ALLOWED actions: plans, help, profile, screen:<id> (NEVER open_miniapp, NEVER locations).
Mini App is DISABLED — the user did NOT check the Mini App option.
HARD RULES:
- Do NOT include any "miniapp.screen" node.
- Do NOT add a "miniapp" field to JSON.
- Do NOT mention Mini App, WebView or in-app screen anywhere.
- Do NOT include buttons with action "open_miniapp" or "locations".
- Build a pure chat-only flow: commands, text replies, inline keyboards,
  data collection, API calls. The whole UX lives inside the chat.
- If the user asks for steps like "press button → next level / next screen / next menu",
  you MUST express this in preview.screens with 2-5 linked chat screens and
  buttons using action "screen:<id>".
- preview.botMessages/buttons represent the first visible state, while
  preview.screens defines the full clickable chat simulation.
Keep 3-5 nodes max.`;

const PLATFORM_TG = `\n\nTarget platform: **Telegram Bot API**.
Use Telegram concepts: BotFather token, /commands, inline keyboards
(callback_data), reply keyboards, sendMessage, parse_mode HTML/Markdown,
webhooks or long polling. Buttons live under messages as InlineKeyboardMarkup.`;

const PLATFORM_MAX = `\n\nTarget platform: **Max Messenger Bot API** (VK Max, ru).
Use Max concepts: Max Developer Console token, /commands, inline buttons
(payload), keyboard with rows, sendMessage via Max Bot API, long polling.
Do NOT mention Telegram-only features (BotFather, parse_mode HTML).
Keep flow names and copy in Russian by default for Max.`;

const REAL_MODELS = {
  gpt: "openai/gpt-5",
  gemini: "google/gemini-3-flash-preview",
} as const;

const ALIASES: Record<string, keyof typeof REAL_MODELS> = {
  auto: "gemini",
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
  const platformLine = platform === "max" ? PLATFORM_MAX : PLATFORM_TG;
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
      tools?: boolean;
    };
    const { messages, model, miniApp = false, platform = "telegram", tools: enableTools = true } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array required" }, 400);
    }

    const aiModel = resolveModel(model);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return json({ error: "LOVABLE_API_KEY is not configured" }, 500);
    }

    const systemPrompt = buildPrompt(miniApp, platform);

    const toolDefs = enableTools ? buildTools(miniApp) : undefined;

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
        max_tokens: 4096,
        ...(toolDefs ? { tools: toolDefs, tool_choice: "auto" } : {}),
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
