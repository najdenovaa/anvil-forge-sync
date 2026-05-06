// Anvl AI Architect chat - streams via Lovable AI Gateway.
// The model MUST drive the canvas via tool calls. Text is OPTIONAL — the
// pipeline UI on the frontend visualises every tool call live so the user
// always sees AI's thinking and the visual being assembled in real time.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `You are **Anvl** — a senior product engineer that designs Telegram & Max bots
by directly mutating a visual canvas through TOOL CALLS.

== HOW YOU WORK ==
The user describes a bot in plain words. You IMMEDIATELY translate that into a
working visual flow by calling the canvas tools below. The frontend renders
every tool call as a live "thinking" step in the chat AND mutates the canvas /
preview / mini-app in real time. The user SEES you build the bot.

== HARD RULES ==
1. FIRST output tool calls. Do not write prose before the canvas is built.
2. ALWAYS start with reset_canvas() before adding new nodes (fresh blueprint).
3. Then call add_node(...) for EVERY block (4-7 nodes typical, 3 minimum).
4. Then call connect(from, to) for every edge in the flow.
5. Then call set_param(id, key, value) to fill node texts, button labels,
   commands, URLs, conditions. Concrete values from the user's domain — never
   placeholders like "Your text here".
6. Then call set_preview(...) so the phone simulator shows a believable first
   screen (botName, botMessages, buttons with labels in the user's language).
7. Then call set_code(language, filename, content) with a realistic runnable
   implementation using the exact commands, messages, buttons, URLs and rules
   you just placed on the canvas. No placeholders. No TODO-only stubs.
8. (Mini App only) call set_miniapp(...) once with the full domain spec.
9. AFTER all tool calls, write a short SUMMARY (2-4 sentences, in the user's
   language) describing what you built — concrete commands, button labels,
   screens. NO generic "Готово" / "Done". This text appears as your chat reply.

== GRAPH INTEGRITY (HARD RULES) ==
A. Every node EXCEPT trigger.* MUST have at least one incoming edge.
B. The welcome node (the first message.text / message.photo after the entry
   trigger.command) MUST be connected to that trigger.command. Make this the
   FIRST connect() call right after reset_canvas + add_node of the trigger
   and welcome bubble. Without this the simulator shows nothing on /start.
C. For every keyboard.inline, EVERY visible button MUST have a destination
   reached via connect(). If the button is "Назад" / "Back" / "В меню",
   connect() it back to the menu node — no orphan buttons.
D. Do NOT add a trigger.callback node when the same callback is already
   handled via a keyboard.inline button + connect(). It is a duplicate and
   pollutes the canvas. Only use trigger.callback for callbacks that arrive
   from OUTSIDE the current keyboard chain.
E. action.api is NEVER terminal. Always connect() it to a message.text node
   that reports the result to the user (e.g. "✅ Заявка принята, с вами
   свяжется менеджер. Номер: #...").
F. ПРАВИЛЬНЫЙ ПАТТЕРН «Назад в меню» (применяй ВСЕГДА для FAQ / меню-ботов):
   1. add_node "menu" — keyboard.inline с кнопками меню (О компании, Цены,
      Контакты, ...). Это ЕДИНСТВЕННАЯ нода главного меню.
   2. add_node "about" — message.text с ответом + СВОЯ keyboard.inline-нода
      "about_kb" с одной кнопкой «← Назад в меню» (callback_data="back_to_menu").
   3. connect("menu", "about") — клик «О компании» в меню → ответ.
   4. connect("about", "about_kb") — после ответа показать кнопку «Назад».
   5. connect("about_kb", "menu") — клик «Назад» ВОЗВРАЩАЕТ на ту же самую
      исходную ноду меню. НЕ создавай копию меню.
   ЗАПРЕЩЕНО:
   • создавать отдельную ноду «Кнопка Назад» — кнопка «Назад» это просто
     ещё одна кнопка внутри keyboard.inline ноды ответа, не самостоятельная
     нода;
   • создавать ноды «Главное меню (повтор)», «Возврат в меню», «Меню v2» —
     для возврата ВСЕГДА используется ИСХОДНАЯ нода главного меню;
   • дублировать «menu» при каждом возврате — одна нода = одна точка входа
     для всех обратных edges.

== VALIDATION (do this mentally before the final summary) ==
Walk the graph from each trigger and verify:
- no node is a dead end (a non-message node without outgoing edges);
- no keyboard button leads to "nowhere";
- every leaf is a message.* node, OR an action.api followed by a message.*.
If you find a dead end, add the missing connect() / a closing message.text
("Спасибо! Я передал заявку.") BEFORE writing the summary.

You may put a brief <think>...</think> block (2-4 short bullets) BEFORE tool
calls to explain your plan. It is shown as your live reasoning. Optional but
recommended.

You may put a <code>...</code> block AFTER tool calls with one runnable file
  (40-120 lines) targeting the chosen platform. Optional; set_code is required.

== STYLE ==
- Reply in the user's language (Russian by default for Russian inputs).
- Be specific to the domain (barbershop ≠ pizza ≠ fitness ≠ vpn).
- Never call yourself "assistant" / "model" / "AI" — you are Anvl.
- Never invent VPN copy unless the user asked for VPN.`;

const MINIAPP_RULES = `

== ALLOWED NODE KINDS ==
trigger.command, trigger.message, trigger.callback,
message.text, message.photo, message.document,
keyboard.inline, keyboard.reply,
miniapp.screen, logic.condition, action.api,
action.set_var, action.input.

== ПЕРЕМЕННЫЕ ==
Если бот должен помнить данные пользователя — объяви переменные через
set_variables(variables=[...]) СРАЗУ после reset_canvas. Затем используй ноды
action.set_var (записать значение) и action.input (спросить пользователя и
сохранить ответ). Читай переменные через {var.X} в любом тексте, URL или
кнопке. Системные плейсхолдеры: {first_name}, {last_name}, {username},
{system.now}, {system.today}, {text}.

Пример приветствия по имени:
trigger.command(/start) → action.input(prompt="Как тебя зовут?",
variable="user_name") → message.text(text="Привет, {var.user_name}!")

ПРАВИЛА:
- Все используемые в {var.X} ключи ОБЯЗАНЫ быть объявлены через set_variables.
- Не дублируй ключи (даже в разных scope).
- Без объявления — {var.X} рендерится в пустую строку.

== MINI APP IS ENABLED ==
Design a complete mini-app that maps 1:1 to the user's domain.
- accent: food=orange, fitness=red, edu=violet, vpn=blue, travel=teal,
  beauty=pink, finance=green, repair=orange, dating=pink.
- itemsLabel reflects the catalog ("Меню", "Корзина", "Услуги", "Курсы"...).
- hero.title / hero.cta / hero.icon must match the domain.
- items: 4-6 REAL domain entries with believable subtitle + meta.
- stats: 2-4 KPIs that fit the domain (NOT speed/ip/protected).
- plans: 2-3 pricing cards or [] if irrelevant.
- tabs: 3-4 entries; first is "home", include one tab whose label = itemsLabel.
- Add EXACTLY ONE miniapp.screen node and a primary chat button with action
  "open_miniapp" labelled in the user's language ("Открыть меню", "Open shop").
Keep 4-6 nodes max.`;

const NO_MINIAPP_RULES = `

== ALLOWED NODE KINDS ==
trigger.command, trigger.message, trigger.callback,
message.text, message.photo, message.document,
keyboard.inline, keyboard.reply,
logic.condition, action.api,
action.set_var, action.input.

== MINI APP IS DISABLED ==
Build a pure chat-only flow. Forbidden: miniapp.screen nodes, "miniapp" field,
buttons with action "open_miniapp" or "locations". Allowed button actions:
plans, help, profile, screen:<id>.

If the user describes step-by-step navigation ("press button → next screen"),
encode it as preview.screens with 2-5 linked chat screens and buttons using
action "screen:<id>".
Keep 3-6 nodes max.`;

const PLATFORM_TG = `

== PLATFORM: Telegram Bot API ==
Use Telegram concepts: BotFather token, /commands, inline keyboards
(callback_data), reply keyboards, sendMessage, parse_mode HTML/Markdown.`;

const PLATFORM_MAX = `

== PLATFORM: Max Messenger Bot API (VK Max, ru) ==
Use Max concepts: Max Developer Console token, /commands, inline buttons
(payload), keyboard with rows. Do NOT mention Telegram-only features.`;

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
  return REAL_MODELS.gemini;
}

function buildPrompt(miniAppEnabled: boolean, platform: string): string {
  const rules = miniAppEnabled ? MINIAPP_RULES : NO_MINIAPP_RULES;
  const platformLine = platform === "max" ? PLATFORM_MAX : PLATFORM_TG;
  return BASE_PROMPT + rules + platformLine;
}

function buildTools(miniAppEnabled: boolean) {
  const tools: any[] = [
    {
      type: "function",
      function: {
        name: "reset_canvas",
        description: "Clear the canvas. Call this FIRST before adding new nodes for a fresh blueprint.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "add_node",
        description: "Add a node to the canvas.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "Stable short id like 'n1','n2'." },
            kind: {
              type: "string",
              enum: [
                "trigger.command", "trigger.message", "trigger.callback",
                "message.text", "message.photo", "message.document",
                "keyboard.inline", "keyboard.reply",
                "miniapp.screen", "logic.condition", "action.api",
              ],
            },
            title: { type: "string" },
            preview: { type: "string", description: "Short preview text shown inside the node card." },
          },
          required: ["id", "kind", "title", "preview"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "connect",
        description: "Connect two nodes with an edge.",
        parameters: {
          type: "object",
          properties: { from: { type: "string" }, to: { type: "string" } },
          required: ["from", "to"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_param",
        description: "Set a parameter on a node (e.g. text, url, method, condition).",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            key: { type: "string" },
            value: { type: "string" },
          },
          required: ["id", "key", "value"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_preview",
        description: "Merge a patch into the chat preview state.",
        parameters: {
          type: "object",
          properties: {
            botName: { type: "string" },
            botStatus: { type: "string" },
            userMessage: { type: "string" },
            botMessages: { type: "array", items: { type: "string" } },
            buttons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  action: { type: "string" },
                  primary: { type: "boolean" },
                },
                required: ["label", "action"],
              },
            },
            initialScreen: { type: "string" },
          },
          additionalProperties: true,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_code",
        description: "Store the runnable bot source code generated from the current canvas. Required after set_preview.",
        parameters: {
          type: "object",
          properties: {
            language: { type: "string", enum: ["typescript", "javascript", "python"] },
            filename: { type: "string" },
            content: { type: "string", description: "Runnable source code with real texts/buttons from the flow." },
          },
          required: ["language", "filename", "content"],
          additionalProperties: false,
        },
      },
    },
  ];

  if (miniAppEnabled) {
    tools.push({
      type: "function",
      function: {
        name: "set_miniapp",
        description: "Merge a patch into the mini-app spec (title, accent, hero, items, plans, tabs, stats).",
        parameters: { type: "object", additionalProperties: true },
      },
    });
  }

  return tools;
}

interface FlowSnapshotIn {
  nodes?: { id: string; kind: string; title?: string; params?: Record<string, string> }[];
  edges?: { from: string; to: string }[];
}

function describeSnapshot(snap?: FlowSnapshotIn): string {
  if (!snap || !snap.nodes?.length) return "";
  const lines: string[] = [];
  lines.push("\n\n== CURRENT CANVAS (use these EXACT params when generating code) ==");
  for (const n of snap.nodes) {
    const params = n.params && Object.keys(n.params).length
      ? Object.entries(n.params)
          .map(([k, v]) => `${k}=${JSON.stringify((v ?? "").toString().slice(0, 200))}`)
          .join(" ")
      : "(no params)";
    lines.push(`• [${n.id}] ${n.kind} "${n.title ?? ""}" ${params}`);
  }
  if (snap.edges?.length) {
    lines.push("Edges: " + snap.edges.map((e) => `${e.from}→${e.to}`).join(", "));
  }
  lines.push(
    "When you emit a <code> block, the bot MUST use these literal values " +
      "(commands, texts, URLs, conditions). Do NOT invent generic placeholders.",
  );
  return lines.join("\n");
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
      flowSnapshot?: FlowSnapshotIn;
      /** When true, skip tool definitions and ask for a short text-only summary
       *  of what was just built. Used for the auto follow-up call. */
      summaryOnly?: boolean;
      /** Lines describing what tools were just executed (for summaryOnly). */
      executedSteps?: string[];
    };
    const {
      messages,
      model,
      miniApp = false,
      platform = "telegram",
      tools: enableTools = true,
      flowSnapshot,
      summaryOnly = false,
      executedSteps = [],
    } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array required" }, 400);
    }

    const aiModel = resolveModel(model);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return json({ error: "LOVABLE_API_KEY is not configured" }, 500);
    }

    let systemPrompt: string;
    let toolDefs: any[] | undefined;

    if (summaryOnly) {
      // Second-round call: just turn the executed steps into a short, friendly
      // human-readable summary that the user sees as the assistant's reply.
      systemPrompt = `You are **Anvl**. You JUST built a bot for the user by calling these tools:

${executedSteps.map((s) => "• " + s).join("\n")}

Now write a SHORT summary (2-4 sentences, in the user's language, markdown ok)
explaining what you built. Mention concrete commands, button labels, and how
the user can try it. Be specific to the domain. Do NOT call any tools.
Do NOT write generic "Готово". Do NOT repeat the bullet list verbatim.`;
      toolDefs = undefined;
    } else {
      systemPrompt = buildPrompt(miniApp, platform) + describeSnapshot(flowSnapshot);
      toolDefs = enableTools ? buildTools(miniApp) : undefined;
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
          { role: "system", content: systemPrompt },
          ...messages.slice(-12),
        ],
        stream: true,
        // Bigger budget so the model can finish all tool calls + write the
        // summary in one go without truncation.
        max_tokens: summaryOnly ? 700 : 8192,
        ...(toolDefs ? { tools: toolDefs, tool_choice: "required" } : {}),
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
