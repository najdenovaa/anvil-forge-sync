// Anvl AI Architect chat - streams via Lovable AI Gateway.
// The model MUST drive the canvas via tool calls. Text is OPTIONAL — the
// pipeline UI on the frontend visualises every tool call live so the user
// always sees AI's thinking and the visual being assembled in real time.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `Вы — Anvl, senior product engineer для Telegram и Max ботов. Вы строите ботов исключительно через tool_calls на визуальном канвасе. Пользователь видит каждый ваш tool_call как живой шаг в чате и видит как канвас и превью собираются в реальном времени.

== ФОРМАТ ОТВЕТА ==
Только tool_calls плюс короткое сообщение пользователю (2-4 строки на его языке). НИКАКОГО КОДА — ни в \`\`\`js, ни в \`\`\`ts, ни в любых других блоках. Не упоминайте grammY, Telegraf, aiogram и подобные библиотеки. Не используйте словарь «функция / handler / callback / state machine» — у ANVL визуальная модель, концепции другие. Никогда не называйте себя «ассистентом» / «моделью» / «AI» — вы Anvl.

== РЕЖИМ: BUILD ИЛИ EDIT ==
ПЕРВОЕ что вы делаете в каждом ответе — классифицируете запрос.

BUILD — строить с нуля. Признаки: «сделай бота для…», «создай», «начни заново», «забудь старый», или get_canvas вернул пустой канвас.

EDIT — точечная правка существующего. Признаки: «измени», «добавь», «убери», «поменяй», «переименуй», ссылки на конкретные элементы («кнопку Цены», «приветствие», «вторую ветку»).

Если неясно: get_canvas → если флоу есть и нет явного «начни заново» → EDIT, если флоу пуст → BUILD. В крайнем случае задайте ОДИН уточняющий вопрос БЕЗ tool_calls — но ТОЛЬКО если запрос пользователя НЕЯСЕН. Большой объём работы — НЕ повод задавать вопрос; разбивайте на раунды (см. раздел «БОЛЬШИЕ ЗАДАЧИ» ниже).

== АЛГОРИТМ BUILD ==
1. reset_canvas() — ОБЯЗАТЕЛЬНО первым tool_call.
2. set_variables(...) — если боту нужны переменные.
3. trigger.command "/start" + welcome message.text + первая keyboard.inline (главное меню) либо первый шаг сценария.
4. Для каждого FAQ-раздела (кнопка → статичный ответ → возврат в меню) — ОДИН вызов add_menu_section. НЕ собирайте FAQ-разделы цепочкой add_node+connect+set_param.
5. Для динамических веток (запись, форма, условие, API-вызов) — низкоуровневые tools: add_node + connect + set_param.
6. set_preview(...) — реалистичный первый экран.
7. set_code(...) — рабочий код под выбранную платформу.
8. (Mini App, если разрешено) — set_miniapp(...).

В финальном сообщении: «Построил с нуля» + 2-3 строки про конкретный домен.

== АЛГОРИТМ EDIT ==
ЗАПРЕЩЕНО вызывать reset_canvas — это сотрёт всю работу пользователя.

1. get_canvas() — ОБЯЗАТЕЛЬНО первым, чтобы знать актуальные ID нод.
2. Спланируйте МИНИМАЛЬНЫЙ набор операций под конкретный запрос.
3. Для FAQ-правок (см. раздел «COMPOSITE TOOLS» ниже) — composite tools.
4. Для остальных правок — низкоуровневые: set_param, rename_node, add_node, connect, remove_node, remove_edge.
5. Если меняете переменные — set_variables() с НОВЫМ ПОЛНЫМ списком (он перезаписывает целиком). НЕ удаляйте переменные на которые ссылаются другие ноды.
6. set_code(...) в конце для регенерации.

В финальном сообщении: «Точечная правка» + 1-3 строки о КОНКРЕТНОМ изменении («Добавил раздел Акции», «Переименовал кнопку Цены в Прайс»). НЕ повторяйте полное описание всего бота — пользователь и так его знает.

ID нод: используйте ТОЛЬКО ID из ответа get_canvas. Не угадывайте «n1»/«n2» — реальные могут быть «n7»/«ai-3»/«abc123».

Ссылки на удаляемое: если удаляете ноду на которую ссылаются другие (params.trueBranch / params.falseBranch у logic.condition, action="screen:..." у кнопок keyboard.inline) — обновите эти ссылки через set_param. Иначе линтер покажет ошибку.

== АРХИТЕКТУРА НАВИГАЦИИ ==
keyboard.inline в этом раннтайме — ТЕРМИНАЛЬНЫЙ узел: после прикрепления клавиатуры обход останавливается, и бот ждёт нажатия. Маршрутизация нажатий ВСЕГДА через trigger.callback-ноды: их params.data должно совпадать с action кнопки. Никогда не создавай ребро menu_kb → message — это даст либо неработающую кнопку, либо infinite loop.

Правильная цепочка главного меню: trigger.command → (action.input для имени, опционально) → message.text(menu_msg) → keyboard.inline(menu_kb). На этом всё. Каждая кнопка меню обслуживается отдельной trigger.callback(data=...) → дальнейшая нода.

== БОЛЬШИЕ ЗАДАЧИ И РАЗБИВКА НА РАУНДЫ ==
Архитектор работает в multi-turn loop'е: до 8 раундов на один ответ пользователю. После каждого раунда вы можете продолжить, вызвав ЛЮБОЙ tool_call в следующем раунде — система даст вам новый шанс.

Если задача большая (бот + Mini App + много контента), РАЗБЕЙТЕ её на последовательные раунды ОДНОГО ответа пользователю:
- Раунд 1: каркас бота (reset_canvas + set_variables + триггеры + основные ноды + базовые keyboard.inline).
- Раунд 2: FAQ-разделы (add_menu_section по одному).
- Раунд 3: Mini App контент (init_miniapp + hero + items + plans + tabs).
- Раунд 4: финальные set_preview + set_code.

В конце каждого промежуточного раунда ОБЯЗАТЕЛЬНО вызовите get_canvas() — это даёт системе сигнал «продолжаю в следующем раунде», вы получаете свежий snapshot, и общий лимит на токены ответа сбрасывается.

ЗАПРЕЩЕНО отвечать пользователю «задача слишком большая», «не получилось за один проход», «опишите по одной фиче». Это худший возможный исход. Лучше сделайте ЧАСТЬ работы и продолжите в следующих раундах через get_canvas — система предусмотрена для этого.

== COMPOSITE TOOLS: КОГДА И КАК ==
add_menu_section атомарно собирает паттерн «новая кнопка в существующем меню → trigger.callback → нода-ответ → keyboard.inline с кнопкой возврата → shared trigger.callback(back_to_menu) → menu_msg → menu_kb». Это правильный способ для FAQ-разделов: невозможно перепутать ID, невозможно забыть связь, невозможно создать loop.

ИСПОЛЬЗУЙТЕ add_menu_section когда:
- кнопка ведёт на статичный ответ (message.text или message.photo)
- после ответа пользователь возвращается в то же меню
- это типовой FAQ-раздел: «О компании», «Цены», «Контакты», «Услуги», «Адрес», «Время работы», «Отзывы», «Акции».

НЕ используйте add_menu_section когда:
- кнопка ведёт на под-меню (другую keyboard.inline) — соберите цепочкой низкоуровневых tools (создай свою trigger.callback)
- кнопка ведёт на action.input (запись / форма) — низкоуровневыми
- кнопка ведёт на logic.condition (развилка) — низкоуровневыми
- кнопка ведёт на action.api (внешний вызов) — низкоуровневыми

remove_menu_section и update_menu_section работают ТОЛЬКО с разделами которые были созданы через add_menu_section. Если раздел собран низкоуровневыми tools — удаляйте/правьте им же (remove_node + set_param).

Параметры add_menu_section:
- menu_id: ID существующей keyboard.inline (главного меню)
- menu_msg_id: ID message.text-ноды, которая показывает текст главного меню (предшественник menu_id)
- button_label: лейбл новой кнопки, например «💰 Цены»
- callback_data: уникальный короткий ключ ≤64 байт, например «prices». Идёт И в action кнопки, И в params.data trigger.callback-ноды.
- content_kind: "text" или "photo"
- content: текст ответа или URL фото
- section_id: префикс для создаваемых нод (например «prices» — создаст «prices_trig», «prices_msg», «prices_back_kb»)
- back_label: опционально, по умолчанию «« Назад в меню»

== ДОСТУПНЫЕ NODE KINDS ==
trigger.command, trigger.message, trigger.callback, message.text, message.photo, message.document, keyboard.inline, keyboard.reply, logic.condition, action.api, action.set_var, action.input. (miniapp.screen — только в Mini App режиме.)

== ПЕРЕМЕННЫЕ ==
Объявляйте через set_variables один раз сразу после reset_canvas (в BUILD) или через set_variables с полным списком (в EDIT). Читайте через {var.X} в любом тексте / URL / кнопке. Системные плейсхолдеры: {first_name}, {last_name}, {username}, {system.now}, {system.today}, {text}. Все используемые {var.X} ключи ОБЯЗАНЫ быть в set_variables — иначе рендерится пустая строка.

== УСЛОВИЯ (logic.condition) ==
Параметр condition — JSON-строка структуры:
{"kind":"leaf","left":{"source":"var","key":"X"},"operator":"gte","right":{"kind":"literal","value":"18"}}
Или группа:
{"kind":"group","combinator":"AND","children":[ {"kind":"leaf",...}, {"kind":"leaf",...} ]}

source: "var" | "user" | "system" | "text".
operator: eq, neq, gt, lt, gte, lte, contains, not_contains, starts_with, ends_with, matches_regex, is_empty, is_not_empty, is_true, is_false.

Для каждой logic.condition ОБЯЗАТЕЛЬНО:
- set_param(id, "condition", JSON.stringify(...))
- connect(from=cond, to=node_yes, sourceHandle="true")
- connect(from=cond, to=node_no, sourceHandle="false")

Если осмысленной NO-ветки нет — НЕ создавайте condition, делайте линейный путь. Условие имеет смысл только при настоящей развилке двух обработчиков.

== ВВОД (action.input) ==
У action.input есть встроенные параметры:
- validation: regex для проверки введённого текста
- errorMessage: что сказать пользователю при ошибке

ИСПОЛЬЗУЙТЕ ЭТО. НЕ создавайте logic.condition сразу после action.input для дубль-проверки regex'ом — рантайм пере-входит в input без нового текста и бот замолкает.

logic.condition после action.input допустима только для бизнес-логики (сравнение с порогом, проверка членства, не-regex проверки формата).

== СБОРКА MINI APP ==
Если включён Mini App-режим (в описании пользователя упомянуты «мини апп», «webapp», «приложение», или вы добавили в канвас ноду miniapp.screen) — вы ОБЯЗАНЫ собрать контент Mini App через composite-tools в том же ответе. Не оставляйте flows.miniapp пустым — иначе пользователь увидит дефолтную заглушку «Anvl VPN», независимо от темы бота.

Обязательная последовательность вызовов:
1. init_miniapp({ title, subtitle, accent, theme: "dark"|"light", itemsLabel? }) — ПЕРВЫЙ вызов для Mini App. accent — короткое имя цвета («orange» для пиццы/фастфуда, «blue» для tech, «green» для фитнеса, «purple» для премиум).
2. set_miniapp_hero({ title, subtitle, cta, icon? }) — большая карточка сверху. cta — текст основной кнопки.
3. set_miniapp_stats([{ label, value, unit? }, ...]) — 2-4 показателя в шапке (например: «Пицц в меню — 6», «Доставка — 30 мин», «Рейтинг — 4.8/5»).
4. (EDIT) clear_miniapp_items() — если перестраиваете содержимое.
5. add_miniapp_item({ title, subtitle?, meta?, emoji?, badge? }) — ОТДЕЛЬНО для каждого товара/услуги. title — название, subtitle — короткое описание, meta — цена/длительность, emoji — короткий значок, badge — необязательная метка («Хит», «Новинка»).
6. (EDIT) clear_miniapp_plans() — если перестраиваете тарифы.
7. add_miniapp_plan({ id, name, price, unit?, description?, highlight?, features?: [...] }) — ОТДЕЛЬНО для каждого тарифа. id — латинский ключ, highlight: true — для рекомендованного тарифа.
8. set_miniapp_tabs([{ id, label, icon? }, ...]) — нижние табы, обычно 3-4 штуки.

ВСЕ значения должны быть из ОПИСАНИЯ ПОЛЬЗОВАТЕЛЯ — конкретные товары, цены, тарифы. Не выдумывайте контент. Если пользователь упомянул шесть пицц с ценами — вызовите add_miniapp_item шесть раз с этими названиями и ценами.

set_miniapp (старый, единым JSON) — оставлен как escape hatch, но ПРЕДПОЧИТАЙТЕ composite-tools — модель путается в большом JSON.

== GRAPH INTEGRITY (обязательно перед финальным ответом) ==
A. Каждая нода кроме trigger.* имеет хотя бы одно входящее ребро.
B. Welcome-нода (первый message после trigger.command) соединена с триггером.
C. Каждая action.api имеет исходящее ребро на message.* — action.api никогда не терминальна, бот должен что-то сказать после API-вызова.
D. Каждая видимая кнопка keyboard.inline куда-то ведёт через connect() (для разделов созданных через add_menu_section это автоматически).
E. Каждая logic.condition имеет ОБЕ ветки (true и false).
F. Каждая объявленная переменная используется хотя бы где-то — в {var.X}, в logic.condition или как destination в action.input/action.set_var.
G. Не создавайте дубликаты главного меню — используйте add_menu_section которая ссылается на ОДНО существующее меню, или connect() обратно на исходную menu-ноду.

Если хоть один пункт не выполнен — НЕ пишите «готово», дособерите флоу.

== ФИНАЛЬНОЕ СООБЩЕНИЕ ==
2-4 строки на языке пользователя:
- что построили / изменили (BUILD: «Построил с нуля...» / EDIT: «Точечная правка...»)
- созданные переменные одной строкой (если есть)
- если есть action.api — упомянуть что юзеру нужно настроить webhook URL в params ноды
- «проверь IssuesPanel и опубликуй»

НЕ хвастайтесь «всё готово к деплою» — линтер всё равно проверит.

== КОНЕЦ ==`;

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
Keep 4-6 nodes max.

== set_miniapp ОБЯЗАТЕЛЕН ==
КАЖДЫЙ раз когда пользователь описывает Mini App (контент, фото, услуги,
карточки, цены, разделы, дизайн, фон, тему) — ВЫ ОБЯЗАНЫ вызвать set_miniapp
с ПОЛНЫМ patch-ом, отражающим описание ДОСЛОВНО:
- Если упомянуты фото/изображения — добавьте hero.image (URL или
  data-описание), и items[].image где уместно.
- Если упомянут «светлый фон / тёмная тема» — set_miniapp({ theme: "light" })
  или "dark".
- Если перечислены конкретные услуги, мастера, товары — items должны
  содержать ИХ ИМЕНА И ОПИСАНИЯ из реплики пользователя, а не выдуманные.
- Если описана структура вкладок — tabs должны соответствовать.
Не уклоняйтесь и НЕ ограничивайтесь словами «обновил Mini App» — реально
вызовите set_miniapp с конкретными полями. Без этого вызова изменения НЕ
сохранятся в базу и пользователь увидит пустой экран.`;

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
                "action.set_var", "action.input",
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
        description: "Connect two nodes with an edge. For logic.condition source nodes, set sourceHandle to 'true' or 'false'.",
        parameters: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            sourceHandle: {
              type: "string",
              enum: ["true", "false"],
              description: "Only for logic.condition source nodes",
            },
          },
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
    {
      type: "function",
      function: {
        name: "set_variables",
        description: "Объявить список переменных flow. Вызывается ОДИН раз сразу после reset_canvas.",
        parameters: {
          type: "object",
          properties: {
            variables: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  scope: { type: "string", enum: ["session", "user"] },
                  type: { type: "string", enum: ["string", "number", "boolean", "json"] },
                  defaultValue: { type: "string" },
                  description: { type: "string" },
                },
                required: ["key", "scope", "type"],
              },
            },
          },
          required: ["variables"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_canvas",
        description: "Получить текущее состояние канваса: список нод и рёбер. Read-only, не меняет состояние. Используй перед инкрементальными правками чтобы знать какие ID существуют.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    {
      type: "function",
      function: {
        name: "remove_node",
        description: "Удалить ноду по ID. Все входящие и исходящие рёбра этой ноды тоже удалятся. Используй чтобы убрать ненужный узел из существующего флоу.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "ID ноды для удаления" },
          },
          required: ["id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "remove_edge",
        description: "Удалить ребро между нодами. Для logic.condition обязательно указывай sourceHandle (\"true\" или \"false\") чтобы удалить конкретную ветку.",
        parameters: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            sourceHandle: {
              type: "string",
              description: "Опционально для обычных нод. Для logic.condition — \"true\" или \"false\".",
            },
          },
          required: ["from", "to"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "rename_node",
        description: "Изменить подпись (label) существующей ноды. Не меняет тип и ID.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
          },
          required: ["id", "label"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_menu_section",
        description: "Атомарно создать раздел FAQ-меню. Создаёт: trigger.callback(data=callback_data) → ответ-нода (message.text/message.photo) → keyboard.inline с кнопкой 'Назад'; добавляет кнопку в существующее menu_id; идемпотентно создаёт shared trigger.callback(data='back_to_menu') → menu_msg → menu_id для возврата. ВАЖНО: keyboard.inline в этом раннтайме ТЕРМИНАЛЬНЫЙ — навигация работает только через trigger.callback. Не создавай рёбер menu_id→ответ вручную.",
        parameters: {
          type: "object",
          properties: {
            menu_id: { type: "string", description: "ID существующей keyboard.inline ноды главного меню" },
            menu_msg_id: { type: "string", description: "ID message.text-ноды, которая показывает текст главного меню (предшественник menu_id)" },
            button_label: { type: "string", description: "Лейбл новой кнопки в меню (например '💰 Цены')" },
            callback_data: { type: "string", description: "Уникальный callback ≤64 байт (например 'prices'). Используется и как action кнопки, и как params.data trigger.callback-ноды." },
            content_kind: { type: "string", enum: ["text", "photo"] },
            content: { type: "string", description: "Текст ответа или URL фото" },
            section_id: { type: "string", description: "Префикс для создаваемых нод (создадутся ${section_id}_trig, ${section_id}_msg, ${section_id}_back_kb)" },
            back_label: { type: "string", description: "По умолчанию '« Назад в меню'" },
          },
          required: ["menu_id", "menu_msg_id", "button_label", "callback_data", "content_kind", "content", "section_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "remove_menu_section",
        description: "Атомарно удалить раздел FAQ-меню: убирает соответствующую кнопку из main menu, удаляет ноду-ответ и связанную с ней keyboard.inline-ноду возврата, удаляет все связанные edges. Кнопка в меню определяется по callback_data, который ведёт на section_msg_id.",
        parameters: {
          type: "object",
          properties: {
            menu_id: { type: "string" },
            section_msg_id: { type: "string" },
          },
          required: ["menu_id", "section_msg_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_menu_section",
        description: "Атомарно обновить раздел FAQ: меняет лейбл кнопки в меню (если new_button_label задан) и/или текст ноды-ответа (если new_content задан). Связи не трогает.",
        parameters: {
          type: "object",
          properties: {
            menu_id: { type: "string" },
            section_msg_id: { type: "string" },
            new_button_label: { type: "string" },
            new_content: { type: "string" },
          },
          required: ["menu_id", "section_msg_id"],
          additionalProperties: false,
        },
      },
    },
  ];

  // set_miniapp is ALWAYS available — the architect is required to populate
  // mini-app content whenever the canvas contains a miniapp.screen node.
  tools.push({
    type: "function",
    function: {
      name: "set_miniapp",
      description:
        "REQUIRED whenever the flow contains a miniapp.screen node. Merges a patch into flows.miniapp. " +
        "Provide a complete spec: { title, subtitle, accent, itemsLabel, hero:{title,subtitle,cta,icon}, " +
        "stats:[{label,value,unit?}], items:[{title,subtitle?,meta?,emoji?,badge?}], " +
        "plans:[{id,name,price,unit?,description?,highlight?,features?[]}], tabs:[{id,label,icon?}] }. " +
        "Domain-specific values only — never leave it empty.",
      parameters: { type: "object", additionalProperties: true },
    },
  });

  // ===== Composite Mini App tools (round 1: infrastructure only) =====
  // Small, reliable atomic tools — preferred over the monolithic set_miniapp.
  // The escape hatch (set_miniapp above) remains for complex one-shot patches.
  tools.push(
    {
      type: "function",
      function: {
        name: "init_miniapp",
        description:
          "Инициализировать или обновить верхнеуровневые поля Mini App (title, subtitle, accent, itemsLabel, theme: 'light'|'dark'). Вызывай ПЕРВЫМ при сборке Mini App. theme по умолчанию 'dark'. accent — цвет акцента ('orange', 'blue', 'green', 'purple' и т.д.).",
        parameters: { type: "object", additionalProperties: true, required: ["title"] },
      },
    },
    {
      type: "function",
      function: {
        name: "set_miniapp_hero",
        description:
          "Установить hero-карточку Mini App (большая карточка вверху с CTA-кнопкой). title — заголовок, subtitle — подзаголовок, cta — текст основной кнопки, icon — короткий emoji или имя icon-key, image — URL картинки (опционально).",
        parameters: { type: "object", additionalProperties: true, required: ["title", "cta"] },
      },
    },
    {
      type: "function",
      function: {
        name: "set_miniapp_stats",
        description:
          "Установить блок статистики (3-4 показателя в шапке). Перезаписывает массив целиком. unit опционален (например '/5', '%').",
        parameters: { type: "object", additionalProperties: true, required: ["stats"] },
      },
    },
    {
      type: "function",
      function: {
        name: "set_miniapp_tabs",
        description:
          "Установить нижние табы Mini App. Перезаписывает массив целиком. id — латиницей короткий ключ, label — видимая подпись. Обычно 3-4 таба: 'home', 'items', 'plans', 'profile'.",
        parameters: { type: "object", additionalProperties: true, required: ["tabs"] },
      },
    },
    {
      type: "function",
      function: {
        name: "add_miniapp_item",
        description:
          "Добавить ОДИН элемент в список items Mini App (товар, услуга, локация). title — обязателен, subtitle — описание, meta — цена / длительность / любое мета-поле, emoji — короткий эмодзи в левом углу карточки, badge — текст бейджа ('Хит', 'Новинка'), image — URL картинки. Вызывай ОТДЕЛЬНО для каждого элемента.",
        parameters: { type: "object", additionalProperties: true, required: ["title"] },
      },
    },
    {
      type: "function",
      function: {
        name: "add_miniapp_plan",
        description:
          "Добавить ОДИН тариф/план в список plans Mini App. id — короткий латинский ключ, name — отображаемое имя, price — цена строкой ('990', 'от 1500'), unit — '₽', '$/мес' и т.д., description — описание, highlight: true помечает план как рекомендуемый, features — массив строк-преимуществ. Вызывай ОТДЕЛЬНО для каждого плана.",
        parameters: { type: "object", additionalProperties: true, required: ["id", "name", "price"] },
      },
    },
    {
      type: "function",
      function: {
        name: "clear_miniapp_items",
        description:
          "Очистить список items в Mini App (items = []). Вызывай перед серией add_miniapp_item при редактировании, чтобы не накапливать дубли.",
        parameters: { type: "object", additionalProperties: true },
      },
    },
    {
      type: "function",
      function: {
        name: "clear_miniapp_plans",
        description:
          "Очистить список plans в Mini App (plans = []). Вызывай перед серией add_miniapp_plan при редактировании.",
        parameters: { type: "object", additionalProperties: true },
      },
    },
  );

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
      /** Live serialized canvas — fed back to Architect when it calls get_canvas. */
      canvasSnapshot?: { nodes?: unknown[]; edges?: unknown[]; variables?: unknown[] } | null;
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
      canvasSnapshot,
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
      systemPrompt = `You are **Anvl**. You JUST built a bot for the user by calling these tools:

${executedSteps.map((s) => "• " + s).join("\n")}

Now write a SHORT summary (2-4 sentences, in the user's language, markdown ok)
explaining what you built. Mention concrete commands, button labels, and how
the user can try it. Be specific to the domain. Do NOT call any tools.
Do NOT write generic "Готово". Do NOT repeat the bullet list verbatim.`;
      toolDefs = undefined;
    } else {
      // Auto-enable miniapp mode if the canvas already has a miniapp.screen
      // node (architect must keep building/refining its content) or the user
      // mentions "mini app" / "мини апп" / "webapp" in the latest message.
      const canvasNodes = Array.isArray(canvasSnapshot?.nodes) ? canvasSnapshot!.nodes : [];
      const hasMiniAppNode = canvasNodes.some(
        (n: any) => typeof n?.kind === "string" && n.kind === "miniapp.screen",
      );
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const wantsMiniApp = /mini\s*app|мини[-\s]?апп|web[-\s]?app|вебап/i.test(lastUserMsg);
      const effectiveMiniApp = miniApp || hasMiniAppNode || wantsMiniApp;

      systemPrompt = buildPrompt(effectiveMiniApp, platform) + describeSnapshot(flowSnapshot);
      toolDefs = enableTools ? buildTools(effectiveMiniApp) : undefined;
    }

    const canvasResult = JSON.stringify(
      canvasSnapshot && typeof canvasSnapshot === "object"
        ? {
            nodes: Array.isArray(canvasSnapshot.nodes) ? canvasSnapshot.nodes : [],
            edges: Array.isArray(canvasSnapshot.edges) ? canvasSnapshot.edges : [],
            variables: Array.isArray(canvasSnapshot.variables) ? canvasSnapshot.variables : [],
          }
        : { nodes: [], edges: [], variables: [] },
    );

    // Conversation we mutate across multi-turn rounds (for get_canvas tool loop).
    const conversation: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-12),
    ];

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let indexOffset = 0; // shift tool_call indexes across rounds so client buffers don't collide

        try {
          for (let round = 0; round < 8; round++) {
            console.log(`[architect-chat] round=${round} starting, conversation.length=${conversation.length}, toolDefs=${toolDefs?.length ?? 0}, model=${aiModel}`);
            const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: aiModel,
                messages: conversation,
                stream: true,
                max_tokens: summaryOnly ? 700 : 8192,
                ...(toolDefs ? { tools: toolDefs, tool_choice: "required" } : {}),
              }),
            });

            if (!upstream.ok || !upstream.body) {
              const text = await upstream.text().catch(() => "");
              console.error("AI gateway error:", upstream.status, text);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: "gateway_error", status: upstream.status })}\n\n`,
                ),
              );
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            const reader = upstream.body.getReader();
            let buffer = "";
            let assistantContent = "";
            // Tool calls collected in this round, keyed by upstream index.
            const roundCalls = new Map<number, { id: string; name: string; args: string }>();
            let maxLocalIndex = -1;

            // Pump SSE events: forward to client (with re-indexed tool_calls)
            // and capture content + tool_calls for the next round.
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              let nl: number;
              while ((nl = buffer.indexOf("\n")) !== -1) {
                let line = buffer.slice(0, nl);
                buffer = buffer.slice(nl + 1);
                if (line.endsWith("\r")) line = line.slice(0, -1);
                if (!line.startsWith("data: ")) {
                  if (line) controller.enqueue(encoder.encode(line + "\n"));
                  continue;
                }
                const payload = line.slice(6).trim();
                if (payload === "[DONE]") {
                  // Swallow — we may need another round; only emit at the very end.
                  continue;
                }
                try {
                  const parsed = JSON.parse(payload);
                  const choice = parsed.choices?.[0];
                  const delta = choice?.delta;
                  if (typeof delta?.content === "string") {
                    assistantContent += delta.content;
                  }
                  if (Array.isArray(delta?.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                      const localIdx = tc.index ?? 0;
                      maxLocalIndex = Math.max(maxLocalIndex, localIdx);
                      const slot = roundCalls.get(localIdx) ?? { id: "", name: "", args: "" };
                      if (tc.id) slot.id = tc.id;
                      if (tc.function?.name) slot.name = tc.function.name;
                      if (typeof tc.function?.arguments === "string") slot.args += tc.function.arguments;
                      roundCalls.set(localIdx, slot);
                      // Re-index for the client so buffers across rounds don't collide.
                      tc.index = localIdx + indexOffset;
                    }
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
                } catch {
                  // Forward un-parseable lines verbatim — better than dropping.
                  controller.enqueue(encoder.encode(line + "\n"));
                }
              }
            }

            console.log(`[architect-chat] round=${round} stream done, tool_calls=${roundCalls.size}, assistant_content_length=${assistantContent.length}, tool_call_names=${JSON.stringify(Array.from(roundCalls.values()).map(c => c.name))}`);

            // End the conversation ONLY when the model stopped calling tools.
            // While the model keeps making tool_calls, we feed synthetic results
            // back and run another round — this gives it room to break a big task
            // into multiple turns instead of hedging with "task too big" text.
            if (roundCalls.size === 0) {
              console.log(`[architect-chat] FINISHED at round=${round}, exit_reason=empty_round`);
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            // Append assistant turn (with tool_calls) + one tool result per call.
            const orderedCalls = Array.from(roundCalls.entries())
              .sort(([a], [b]) => a - b)
              .map(([, c], i) => ({
                id: c.id || `call_${round}_${i}`,
                type: "function" as const,
                function: { name: c.name, arguments: c.args || "{}" },
              }));

            conversation.push({
              role: "assistant",
              content: assistantContent || "",
              tool_calls: orderedCalls,
            });

            for (const call of orderedCalls) {
              conversation.push({
                role: "tool",
                tool_call_id: call.id,
                content: call.function.name === "get_canvas" ? canvasResult : `{"ok":true}`,
              });
            }

            indexOffset += maxLocalIndex + 1;
            // Loop back for another round.
          }

          // Safety cap reached.
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("architect-chat stream error:", err);
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "stream_error" })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch { /* ignore */ }
          controller.close();
        }
      },
    });

    return new Response(stream, {
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
