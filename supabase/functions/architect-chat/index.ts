// Anvl AI Architect chat — streams from the Anthropic Messages API.
// The model MUST drive the canvas via tool calls. Text is OPTIONAL — the
// pipeline UI on the frontend visualises every tool call live so the user
// always sees AI's thinking and the visual being assembled in real time.
//
// We keep the conversation in OpenAI-style internally (role: system/user/
// assistant/tool, tool_calls with function/arguments-as-string) and emit
// OpenAI-style SSE to the client, so LeftAIPanel does not need to change.
// The Anthropic format is contained inside this file via the converters
// and the upstream stream parser below.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `Вы — Anvl, senior product engineer для Telegram и Max ботов. Вы строите ботов исключительно через tool_calls на визуальном канвасе. Пользователь видит каждый ваш tool_call как живой шаг в чате и видит как канвас и превью собираются в реальном времени.

== ФОРМАТ ОТВЕТА ==
Только tool_calls плюс короткое сообщение пользователю (2-4 строки на его языке). НИКАКОГО КОДА — ни в \`\`\`js, ни в \`\`\`ts, ни в любых других блоках. Не упоминайте grammY, Telegraf, aiogram и подобные библиотеки. Не используйте словарь «функция / handler / callback / state machine» — у ANVL визуальная модель, концепции другие. Никогда не называйте себя «ассистентом» / «моделью» / «AI» — вы Anvl.

== РЕЖИМ: BUILD ИЛИ EDIT ==

ABSOLUTE RULE — reset_canvas вызывается ТОЛЬКО когда запрос пользователя ЯВНО содержит ОДНО из этих слов: «пересобери», «начни заново», «удали всё», «забудь старого бота», «перепиши с нуля», «с чистого листа», «rebuild», «start over». Точная фраза. Не похожие — точные слова.

Если ни одного из этих слов в запросе нет — режим EDIT. Без исключений. Даже если канвас выглядит «неправильным», «недоделанным», «не таким». Даже если пользователь пишет «собери бот для X» — это означает «добавь функционал X в существующий бот», НЕ «удали всё и сделай заново».

BUILD-режим разрешён ТОЛЬКО в двух случаях:
1. Канвас полностью пуст (get_canvas вернул 0 нод), ИЛИ
2. Пользователь явно использовал одно из trigger-слов выше.

Иначе — EDIT. Точка.

Конфликт темы (например, канвас про барбершоп, а пользователь говорит «собери бот для пиццерии»): НЕ начинай reset_canvas. Задай ОДИН вопрос БЕЗ tool_calls: «Сейчас на канвасе бот про барбершоп. Перестроить его в пиццерию (это сотрёт текущую работу, потребуется reset_canvas) или добавить пиццерию отдельным сценарием рядом с барбершопом?» — и жди ответа. Только при подтверждении «пересобери» — переходи в BUILD.

В EDIT-режиме reset_canvas вызывать ЗАПРЕЩЕНО. Это сотрёт всю работу пользователя. Даже если кажется проще пересобрать — нет. Точечная правка через set_param + add_node + connect + remove_node.


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
Архитектор работает в multi-turn loop'е: до 30 раундов на один ответ пользователю. После каждого раунда вы можете продолжить, вызвав ЛЮБОЙ tool_call в следующем раунде — система даст вам новый шанс.

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
trigger.command, trigger.message, trigger.callback, trigger.webapp_data, message.text, message.photo, message.document, keyboard.inline, keyboard.reply, logic.condition, action.api, action.set_var, action.set_user_var, action.input. (miniapp.screen — только в Mini App режиме.)

== УПРАВЛЕНИЕ БОТОМ ВЛАДЕЛЬЦЕМ (ВАЖНО!) ==
Управление ботом происходит НЕ в этом конструкторе, а прямо в Telegram. Когда владелец пишет своему задеплоенному боту, runtime сам отвечает на админ-команды (тебе НЕ нужно добавлять их в сценарий):
  • /admin, /help_admin — справка по командам
  • /leads — последние заявки из bot_submissions
  • /clients — список пользователей бота
  • /broadcast <текст> — рассылка всем
  • /content — список глобальных переменных {var.*}
  • /set <ключ> <значение> — изменить {var.ключ}
  • /stats — счётчики

Что это значит для тебя как Архитектора:
1. НЕ добавляй ноды для команд /admin, /leads, /broadcast и т.п. в сценарий — runtime перехватит их раньше. Если пользователь говорит «хочу CRM», «хочу управлять заявками», «хочу видеть клиентов» — объясни, что эти возможности УЖЕ работают через Telegram-команды владельца.
2. ВСЕГДА собирай заявки клиентов в bot_submissions через action.input + связку с источником (например, при записи на услугу — собери имя/телефон/дату, сохрани через action.input и пометь как лид). Тогда владелец увидит их через /leads.
3. Любые «настраиваемые тексты» (меню, прайс, расписание, контакты) клади в глобальные переменные {var.X} через set_variables. Владелец сможет менять их без передеплоя через команду /set <key> <value>.
4. Когда бот — это CRM/запись/магазин/опрос — подскажи владельцу в конце разговора: «Готово. Открой свой бот в Telegram и напиши /admin — увидишь все команды управления».

== ПЕРЕМЕННЫЕ ==
Объявляйте через set_variables один раз сразу после reset_canvas (в BUILD) или через set_variables с полным списком (в EDIT). Читайте через {var.X} в любом тексте / URL / кнопке. Системные плейсхолдеры: {first_name}, {last_name}, {username}, {system.now}, {system.today}, {text}. Все используемые {var.X} ключи ОБЯЗАНЫ быть в set_variables — иначе рендерится пустая строка.

Дополнительный namespace {webapp.*} доступен ТОЛЬКО внутри message.text-нод, которые подключены after a trigger.webapp_data. Поля: {webapp.action} (имя действия из sendData), {webapp.total} (численная сумма заказа), {webapp.currency} (валюта, например '₽'), {webapp.count} (количество позиций), {webapp.items_summary} (готовая строка 'Латте × 2, Раф × 1'), {webapp.raw} (исходный JSON для отладки). {webapp.*} НЕ нужно объявлять через set_variables — runtime подкладывает их сам.

== ЛИЧНЫЙ КАБИНЕТ ПОЛЬЗОВАТЕЛЯ ==
Namespace {user_var.X} — это переменные конкретного Telegram-пользователя, изолированные per tg_user_id. То что Маша сохранила в user_var.phone, Петя не видит — даже в одном чате. Сохраняются между сессиями (между перезапусками бота).

КОГДА использовать {user_var.X} вместо {var.X}:
- Личные данные клиента (имя, телефон, адрес, email, дата рождения)
- Состояние лояльности (тариф, остаток баллов, дата окончания подписки)
- История (последний заказ, любимый товар, последняя сумма)
- Любые поля «личного кабинета» / «профиля» / «анкеты»

КОГДА оставлять {var.X} (глобальные):
- Бот-wide счётчики, конфигурация
- Промежуточные/служебные значения в одном турне
- Когда автору явно нужно «одно значение на всех»

КАК ЗАПИСЫВАТЬ в личный кабинет:
- action.set_user_var с params { variable: "phone", value: "{text}" } сохранит ответ пользователя в его user_var.phone
- ИЛИ action.input с scope="user" (если в FIELD_SCHEMAS будет добавлено в будущем)
- ИЛИ через webapp_data из Mini App: при наличии user_var-полей в форме — пользователь редактирует профиль из Mini App, бот ловит payload через trigger.webapp_data + цепочку action.set_user_var

ПАТТЕРН «АНКЕТА» (онбординг):
trigger.command "/start"
  → message.text "Привет! Как вас зовут?" + action.input(scope=user, variable=name)
  → message.text "Какой ваш телефон?" + action.input(scope=user, variable=phone)
  → message.text "Спасибо, {user_var.name}! Записали ваш номер {user_var.phone}."

ПАТТЕРН «УЗНАЛ ВЕРНУВШЕГОСЯ»:
trigger.command "/start"
  → logic.condition if "{user_var.name}" != ""
     YES → message.text "С возвращением, {user_var.name}!"
     NO  → запустить онбординг как выше

Сейчас читать user_var из Mini App пока нельзя (только запись через webapp_data). UI «личного кабинета» в Mini App с реальными данными — следующий шаг, в этой версии его нет.

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
1. init_miniapp({ title, subtitle, accent, accentHex?, layout?, theme: "dark"|"light", itemsLabel? }) — ПЕРВЫЙ вызов для Mini App. accent — короткое имя палитры («orange» для пиццы/фастфуда, «blue» для tech, «green» для фитнеса, «violet» для премиум). accentHex — точный hex бренда («#FF5722»), используй если у бренда есть конкретный фирменный цвет. layout — «list» (по умолчанию), «grid» (товарные плитки 2 в ряд с большими картинками — для пиццерий, магазинов, всего где фото товара решает), «compact» (плотные строки для длинных списков услуг).
2. set_miniapp_hero({ title, subtitle, cta, icon?, image?, backgroundImage? }) — большая карточка сверху. cta — текст основной кнопки. image — URL квадратного логотипа/главного блюда (заменяет иконку). backgroundImage — URL фоновой картинки за hero.
3. set_miniapp_stats([{ label, value, unit? }, ...]) — 2-4 показателя в шапке (например: «Пицц в меню — 6», «Доставка — 30 мин», «Рейтинг — 4.8/5»).
4. (EDIT) clear_miniapp_items() — если перестраиваете содержимое.
5. add_miniapp_item({ title, subtitle?, meta?, emoji?, badge?, badgeColor?, image?, priceNumeric? }) — ОТДЕЛЬНО для каждого товара/услуги. meta — цена/длительность СТРОКОЙ для отображения ('590 ₽', '30 мин'). priceNumeric — численная цена БЕЗ валюты (590, 1490) — задавай ВСЕГДА когда товар покупаемый и Mini App это магазин: при включённой корзине на плитке появится кнопка «в корзину». Без priceNumeric элемент остаётся декоративным. badgeColor — hex-цвет фона бейджа («#22c55e» зелёный для «Новинка», «#ef4444» красный для «Скидка», «#f59e0b» янтарный для «Хит»). image — URL картинки товара.
6. (EDIT) clear_miniapp_plans() — если перестраиваете тарифы.
7. add_miniapp_plan({ id, name, price, unit?, description?, highlight?, features?: [...] }) — ОТДЕЛЬНО для каждого тарифа. id — латинский ключ, highlight: true — для рекомендованного тарифа.
8. set_miniapp_tabs([{ id, label, icon? }, ...]) — нижние табы.

ТАБЫ — СТРОГИЙ WHITELIST ID. Доступны ровно 4 типа табов, каждый рендерится по-разному:
   • "home"    → Главная: hero-карточка + stats (всегда первая)
   • "items"   → Каталог: список item-плиток (для пиццерии = «Меню», для барбершопа = «Услуги»)
   • "plans"   → Тарифы: список plans (для VPN, подписочных сервисов)
   • "profile" → Профиль пользователя

ЗАПРЕЩЕНО использовать любые другие id ("menu", "cart", "shop", "catalog", "delivery", "services", "orders" и т.д.). Эти id отрендерятся как ДУБЛИКАТ "items" — один и тот же список товаров повторится во всех табах. Это и есть «все вкладки одинаковые».

КОРЗИНА — НЕ ТАБ. Корзина включается через set_miniapp_cart и показывается sticky-баром внизу + bottom-sheet'ом. Никогда не добавляй id="cart" в табы.

ПРАВИЛЬНО (пиццерия):
   set_miniapp_tabs([
     { id: "home",    label: "Главная", icon: "home" },
     { id: "items",   label: "Меню",    icon: "list" },
     { id: "profile", label: "Профиль", icon: "user" }
   ])

ПРАВИЛЬНО (VPN с тарифами):
   set_miniapp_tabs([
     { id: "home",    label: "Главная", icon: "home" },
     { id: "items",   label: "Серверы", icon: "globe" },
     { id: "plans",   label: "Тарифы",  icon: "card" },
     { id: "profile", label: "Аккаунт", icon: "user" }
   ])

ПРАВИЛЬНО (барбершоп):
   set_miniapp_tabs([
     { id: "home",    label: "Главная", icon: "home" },
     { id: "items",   label: "Услуги",  icon: "list" },
     { id: "profile", label: "Запись",  icon: "user" }
   ])

НЕПРАВИЛЬНО:
   [{ id: "home" }, { id: "menu" }, { id: "cart" }, { id: "profile" }]  ← "menu" и "cart" покажут одно и то же
   [{ id: "main" }, { id: "items" }, ...]                                ← "main" — не из whitelist

9. set_miniapp_cart({ enabled, sendAction?, currency?, ctaLabel? }) — включить корзину. Когда корзина включена И у items есть priceNumeric, у каждой плитки появляется кнопка «+», внизу Mini App — счётчик с суммой, тап открывает корзину со списком и кнопкой «Оформить». При оформлении Mini App шлёт боту JSON через Telegram.WebApp.sendData. sendAction — имя действия (по умолчанию 'order'), его бот будет ловить webapp_data-триггером (Уровень 2B). currency — '₽' / '$' / 'usd'. ctaLabel — текст кнопки.

ВСЕ значения должны быть из ОПИСАНИЯ ПОЛЬЗОВАТЕЛЯ — конкретные товары, цены, тарифы. Не выдумывайте контент. Если пользователь упомянул шесть пицц с ценами — вызовите add_miniapp_item шесть раз с этими названиями и ценами.

КАРТИНКИ (image / backgroundImage): добавляй URL ТОЛЬКО если пользователь сам дал ссылки на свои фото товаров (например прислал список URL'ов) или если URL гарантированно стабильный (например ссылка на их сайт). НЕ выдумывайте URL'ы — «source.unsplash.com» и подобные часто не работают. Если URL'ов нет — используй emoji (для пиццы 🍕, для кофе ☕, для бургера 🍔 и т.д.); это уже выглядит хорошо. layout=grid с emoji тоже работает: emoji будет крупным по центру тайла.

ВЫБОР LAYOUT:
- layout=grid — пиццерии, кофейни, магазины одежды, цветочные, любой каталог где фото продаёт (или крупный emoji выглядит товарно).
- layout=list — VPN-локации, FAQ-разделы, услуги барбершопа с метой (цена/время), длинные перечни.
- layout=compact — справочники, расписания, очень длинные списки где хочется уместить много за раз.

КОРЗИНА И ЗАКАЗЫ (полный цикл): если Mini App — это МАГАЗИН (пиццерия, доставка, маркетплейс) или БРОНИРОВАНИЕ — включай корзину через set_miniapp_cart({enabled: true, sendAction: "order"}) И задавай priceNumeric у каждого add_miniapp_item. Корзина без priceNumeric не работает (нечего считать). И ОБЯЗАТЕЛЬНО добавь приёмник заказа на стороне бота через add_webapp_handler({handler_id: "order", action: "order", response_text: "Спасибо, {first_name}! Заказ на {webapp.total} {webapp.currency} принят. Состав: {webapp.items_summary}. Готовим примерно 30 минут."}) — без этой ноды пользователь нажмёт «Оформить заказ», но бот ничего не ответит. action в add_webapp_handler ОБЯЗАН совпадать с sendAction в set_miniapp_cart. Для информационных Mini App (FAQ, VPN-сервер, профиль) корзина и handler не нужны.

КАК ОТКРЫТЬ MINI APP КНОПКОЙ (важно!): в bot-runtime есть магическая action-строка "open_miniapp". В keyboard.inline-ноде params.buttons (textarea «одна строка на кнопку, label|action») формат СТРОГО такой:
  Открыть меню|open_miniapp
То есть label — что показывается пользователю, action — буквально "open_miniapp" (а НЕ "Open menu", НЕ "miniapp", НЕ что-то ещё). Когда бот рендерит такую inline-кнопку, она автоматически становится web_app-кнопкой и открывает Mini App. Никаких отдельных trigger.callback под неё не нужно. ЗАПРЕЩЕНО оставлять заглушки «Button 1|Button 2» — это пустая нода, бесполезная пользователю. Если нужно добавить кнопку открытия Mini App в существующую keyboard.inline-ноду — используй set_param на её поле buttons и впиши строку label|open_miniapp (одну или несколько, если рядом есть другие кнопки меню).

КАК СВЯЗАТЬ MINI APP С ЗАКАЗОМ НА CANVAS: после add_webapp_handler или если trigger.webapp_data уже существует — сделай визуальную связь connect(from=<id miniapp.screen>, to=<id trigger.webapp_data>). Это edge не участвует в Telegram маршрутизации (sendData ловится триггером), но оно обязательно для понятного canvas и для пользователя, который вручную «протягивает ноду от Mini App к триггеру заказа».

set_miniapp (старый, единым JSON) — оставлен как escape hatch, но ПРЕДПОЧИТАЙТЕ composite-tools — модель путается в большом JSON.

== ТОЧЕЧНЫЕ ПРАВКИ (EDIT-режим) ==
Когда пользователь в существующем боте просит изменить ОДНУ деталь (поменять текст приветствия, исправить кнопку, добавить ещё один FAQ-раздел) — ЗАПРЕЩЕНО:
- начинать с reset_canvas (сотрёт всю работу)
- говорить «у меня нет доступа к канвасу / визуалу / содержимому» (у вас ВСЕГДА есть инструмент get_canvas, вызовите его)
- спрашивать пользователя «уточните, что именно сломано» если вы ещё не посмотрели канвас
- создавать новые ноды с тем же смыслом что у существующих (дубликат welcome-сообщения вместо update_param на старом)
- удалять ноды которые пользователь не просил удалять
ОБЯЗАТЕЛЬНО:
- ПЕРВЫЙ tool-call в EDIT-сессии — get_canvas. Без исключений. Канвас уже есть в первом сообщении системы (как реальное содержимое flows.canvas), но повторный get_canvas в этом раунде даёт свежее состояние и подтверждает что инструменты доступны.
- использовать set_param чтобы изменить params.X на существующей ноде, а не пересоздавать её
- использовать update_menu_section для правки FAQ-разделов, update_param/connect для остального
- ТОЛЬКО если пользователь явно просит «удали X» или «пересобери» — тогда remove_ai_node / remove_ai_edge / reset_canvas

== GRAPH INTEGRITY — ПРОВЕРКА СВЯЗНОСТИ ==

После КАЖДОГО add_node (кроме trigger.*) СЛЕДУЮЩИЙ tool_call ОБЯЗАН быть connect(from=..., to=...) который соединяет новую ноду с уже существующей частью графа. Не «потом подключу» — сразу.

Перед финальным сообщением — ПОВТОРНО вызови get_canvas и пройдись глазами по nodes / edges:

A. КАЖДАЯ нода кроме trigger.* имеет хотя бы одно входящее ребро. Если нет — это orphan. Найди логичную ноду-родителя и сделай connect. Никогда не оставляй orphan-ноду «по дороге».

B. Welcome-message (первая message.text после trigger.command "/start") соединена с триггером. Без этого бот ничего не отвечает на /start.

C. Каждая action.api соединена ОТКУДА-то (входящее ребро) И КУДА-то (исходящее ребро — обычно на message.* для ответа). action.api никогда не терминальна.

D. Каждая кнопка в keyboard.inline params.buttons либо ведёт через trigger.callback (action != "open_miniapp"), либо является open_miniapp-кнопкой. ЗАПРЕЩЕНО оставлять кнопки с пустым action или с placeholder-action (типа "button1", "todo").

E. Каждый trigger.callback имеет params.data, равный action одной из существующих кнопок. Если data не совпадает ни с одной кнопкой — это сирота, либо удали либо привяжи.

F. Если в флоу есть trigger.webapp_data — на канвасе должна быть визуальная связь от miniapp.screen к нему через connect (см. раздел КАК СВЯЗАТЬ MINI APP).

ALGORITHM перед финальным сообщением:
1. get_canvas — получи snapshot.
2. Для каждой ноды кроме trigger.* — проверь что есть входящее ребро.
3. Если нашёл orphan: connect его. Перепроверь.
4. Только после того как orphan = 0 — пиши финальное сообщение.

ЗАПРЕЩЕНО писать финальное сообщение «готово, бот собран» если на канвасе есть orphan-ноды. Это самая частая причина жалоб пользователей «бот не работает» — кнопка нажимается, но цепочка обрывается на orphan-ноде. Лечи сразу.


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
  claude_haiku: "claude-haiku-4-5-20251001",
  claude_sonnet: "claude-sonnet-4-6",
  claude_opus: "claude-opus-4-7",
  gemini_flash: "gemini-2.5-flash",
  gemini_pro: "gemini-2.5-pro",
} as const;

type Provider = "anthropic" | "google";
type Resolved = { provider: Provider; model: string };

// UI selector labels → real model + provider.
// auto / claude / gpt / grok / sonnet → Anthropic Sonnet 4.6 (the workhorse).
// gemini → Google Gemini 2.5 Flash via GOOGLE_API_KEY (OpenAI-compatible API).
// haiku / opus → Anthropic explicit names.
function resolveModel(input?: string): Resolved {
  const key = (input ?? "auto").toLowerCase();
  switch (key) {
    case "gemini":
    case "gemini-flash":
    case "gemini_flash":
      return { provider: "google", model: REAL_MODELS.gemini_flash };
    case "gemini-pro":
    case "gemini_pro":
      return { provider: "google", model: REAL_MODELS.gemini_pro };
    case "haiku":
    case "claude_haiku":
      return { provider: "anthropic", model: REAL_MODELS.claude_haiku };
    case "opus":
    case "claude_opus":
      return { provider: "anthropic", model: REAL_MODELS.claude_opus };
    case "auto":
    case "claude":
    case "gpt":
    case "grok":
    case "sonnet":
    case "claude_sonnet":
    default:
      return { provider: "anthropic", model: REAL_MODELS.claude_sonnet };
  }
}

// ===== OpenAI ↔ Anthropic Messages API format converters =====
// Internally the conversation uses OpenAI shape (role: system/user/assistant/
// tool, tool_calls[].function.arguments as a JSON string). Anthropic expects
// a separate `system` string, `messages` with roles only user/assistant, and
// content blocks of type text / tool_use / tool_result. tool_use_id values
// are minted by Anthropic on the response side; we preserve them so that the
// next round's tool_result blocks reference the exact same id.

function convertMessagesToAnthropic(
  messages: Array<{ role: string; content: any; tool_calls?: any[]; tool_call_id?: string; name?: string }>,
): { system: any; messages: any[] } {
  let systemText = "";
  const out: any[] = [];

  // Anthropic disallows two consecutive messages with the same role. In
  // particular, several `role: "tool"` results in a row from our internal
  // log must collapse into a single user message with multiple tool_result
  // blocks. We track the "current pending user content" and flush it when
  // the role flips.
  let pendingUserBlocks: any[] | null = null;
  const flushPendingUser = () => {
    if (pendingUserBlocks && pendingUserBlocks.length > 0) {
      out.push({ role: "user", content: pendingUserBlocks });
    }
    pendingUserBlocks = null;
  };

  for (const m of messages) {
    if (m.role === "system") {
      const txt = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      systemText += (systemText ? "\n\n" : "") + txt;
      continue;
    }

    if (m.role === "user") {
      flushPendingUser();
      const txt = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      out.push({ role: "user", content: txt });
      continue;
    }

    if (m.role === "assistant") {
      flushPendingUser();
      const blocks: any[] = [];
      const txt = typeof m.content === "string" ? m.content : "";
      if (txt) blocks.push({ type: "text", text: txt });
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          let input: any = {};
          try { input = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* keep empty */ }
          blocks.push({
            type: "tool_use",
            id: tc.id ?? "",
            name: tc.function?.name ?? "",
            input,
          });
        }
      }
      // Anthropic API rejects assistant messages whose content is an empty
      // text block ("messages: text content blocks must be non-empty", 400).
      // This can happen when a previous round produced 0 text + 0 tool_calls
      // (refusal, max_tokens cut-off, or genuine empty stream). Pushing a
      // placeholder "" or " " is also rejected. Cleanest fix: skip such turns
      // entirely — they carry no signal for the next round anyway.
      if (blocks.length === 0) continue;
      out.push({ role: "assistant", content: blocks });
      continue;
    }

    if (m.role === "tool") {
      // Coalesce with any previous tool_result in the same logical turn.
      const contentStr =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      if (pendingUserBlocks === null) pendingUserBlocks = [];
      pendingUserBlocks.push({
        type: "tool_result",
        tool_use_id: m.tool_call_id ?? "",
        content: contentStr,
      });
      continue;
    }
  }
  flushPendingUser();

  // Return system as a cacheable content-block array. Anthropic prompt caching
  // marks the system prompt as a cache breakpoint with cache_control: ephemeral
  // (5-min TTL). Cached input tokens are billed at 10% AND don't count against
  // the ITPM rate limit — which is critical for staying under the Tier 1 cap
  // of 30K input tokens/min on Sonnet 4.6.
  const system = systemText
    ? [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }]
    : undefined;

  return { system, messages: out };
}

function convertToolsToAnthropic(toolDefs: any[] | undefined): any[] | undefined {
  if (!toolDefs || toolDefs.length === 0) return undefined;
  const out = toolDefs.map((t) => {
    const fn = t.function ?? t;
    const params = fn.parameters ?? { type: "object", properties: {} };
    // Anthropic accepts standard JSON Schema and does NOT reject
    // `additionalProperties` — pass the schema through unchanged.
    return {
      name: fn.name,
      description: fn.description ?? "",
      input_schema: params,
    };
  });
  // Mark the LAST tool with cache_control: ephemeral. This caches the entire
  // tools[] array (Anthropic caches contiguous prefix from start through this
  // marker). Together with system-prompt caching, this removes ~17K tokens
  // (BASE_PROMPT + 14 tool schemas) from the ITPM rate-limit counter on
  // every subsequent request within the 5-min cache window.
  if (out.length > 0) {
    out[out.length - 1] = { ...out[out.length - 1], cache_control: { type: "ephemeral" } };
  }
  return out;
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
                "trigger.webapp_data",
                "message.text", "message.photo", "message.document",
                "keyboard.inline", "keyboard.reply",
                "miniapp.screen", "logic.condition", "action.api",
                "action.set_var", "action.set_user_var", "action.input",
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
    {
      type: "function",
      function: {
        name: "add_webapp_handler",
        description:
          "Атомарно собирает приёмник заказа из Mini App: trigger.webapp_data (matches sendData.action) → message.text (ответ боту). ОДИН вызов вместо add_node + add_node + connect. Обязателен когда в Mini App включена корзина через set_miniapp_cart — иначе пользователь нажмёт «Оформить заказ», но бот ничего не ответит. handler_id — короткий префикс для id создаваемых нод (например 'order'). action — строка которая должна совпасть с sendAction в set_miniapp_cart (по умолчанию 'order'). response_text — текст ответа боту, может использовать плейсхолдеры {webapp.total} (численная сумма), {webapp.items_summary} (строка 'Латте × 2, Раф × 1'), {webapp.count} (количество позиций), {webapp.currency} (валюта), {webapp.action} (имя действия), {first_name} и обычные {var.X}. Пример response_text: 'Спасибо, {first_name}! Заказ на {webapp.total} {webapp.currency} принят. Состав: {webapp.items_summary}. Готовим примерно 30 минут.'",
        parameters: {
          type: "object",
          properties: {
            handler_id: { type: "string", description: "Префикс id: создастся handler_id+'_trig' и handler_id+'_msg'." },
            action: { type: "string", description: "Должен совпасть с sendAction из set_miniapp_cart." },
            response_text: { type: "string", description: "Текст ответа боту. Использует {webapp.*} плейсхолдеры." },
          },
          required: ["handler_id", "action", "response_text"],
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
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          accent: { type: "string" },
          itemsLabel: { type: "string" },
          theme: { type: "string" },
          hero: { type: "object", additionalProperties: true },
          stats: { type: "array", items: { type: "object", additionalProperties: true } },
          items: { type: "array", items: { type: "object", additionalProperties: true } },
          plans: { type: "array", items: { type: "object", additionalProperties: true } },
          tabs: { type: "array", items: { type: "object", additionalProperties: true } },
        },
        additionalProperties: true,
      },
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
          "Инициализировать или обновить верхнеуровневые поля Mini App (title, subtitle, accent, accentHex, layout, itemsLabel, theme: 'light'|'dark'). Вызывай ПЕРВЫМ при сборке Mini App. theme по умолчанию 'dark'. accent — короткое имя палитры ('orange', 'blue', 'green', 'violet', 'pink', 'red', 'teal'). accentHex — точный hex-цвет бренда (формат '#RRGGBB'), переопределяет accent (используй для бренда у которого есть конкретный цвет). layout — раскладка items: 'list' (по умолчанию: строки), 'grid' (плитки 2 в ряд с большими картинками — для пиццерий, магазинов, всего товарного), 'compact' (плотные строки без chevron — для длинных списков).",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            accent: { type: "string" },
            accentHex: { type: "string" },
            layout: { type: "string" },
            itemsLabel: { type: "string" },
            theme: { type: "string" },
          },
          required: ["title"],
          additionalProperties: true,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_miniapp_hero",
        description:
          "Установить hero-карточку Mini App (большая карточка вверху с CTA-кнопкой). title — заголовок, subtitle — подзаголовок, cta — текст основной кнопки, icon — короткий emoji или имя icon-key, image — URL квадратной картинки логотипа/блюда (заменяет иконку), backgroundImage — URL фоновой картинки за hero (с тёмной полупрозрачной подложкой для читаемости).",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            cta: { type: "string" },
            icon: { type: "string" },
            image: { type: "string" },
            backgroundImage: { type: "string" },
          },
          required: ["title", "cta"],
          additionalProperties: true,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_miniapp_stats",
        description:
          "Установить блок статистики (3-4 показателя в шапке). Перезаписывает массив целиком. unit опционален (например '/5', '%').",
        parameters: {
          type: "object",
          properties: {
            stats: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: { type: "string" },
                  unit: { type: "string" },
                },
                required: ["label", "value"],
                additionalProperties: true,
              },
            },
          },
          required: ["stats"],
          additionalProperties: true,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "set_miniapp_tabs",
        description:
          "Установить нижние табы Mini App. Перезаписывает массив целиком. id — латиницей короткий ключ, label — видимая подпись. Обычно 3-4 таба: 'home', 'items', 'plans', 'profile'.",
        parameters: {
          type: "object",
          properties: {
            tabs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  label: { type: "string" },
                  icon: { type: "string" },
                },
                required: ["id", "label"],
                additionalProperties: true,
              },
            },
          },
          required: ["tabs"],
          additionalProperties: true,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_miniapp_item",
        description:
          "Добавить ОДИН элемент в список items Mini App (товар, услуга, локация). title — обязателен, subtitle — описание, meta — визуальная цена / длительность / любое мета-поле строкой ('590 ₽', '30 мин'), priceNumeric — численная цена для подсчёта суммы в корзине (число, без валюты): если задан И корзина включена через set_miniapp_cart, на плитке появится кнопка '+' для добавления в корзину; если не задан — элемент остаётся декоративным. emoji — короткий эмодзи в левом углу карточки, badge — текст бейджа ('Хит', 'Новинка'), badgeColor — hex-цвет фона бейджа (например '#22c55e' зелёный для 'Новинка', '#ef4444' красный для 'Скидка'), image — URL квадратной картинки товара. Вызывай ОТДЕЛЬНО для каждого элемента.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            subtitle: { type: "string" },
            meta: { type: "string" },
            emoji: { type: "string" },
            badge: { type: "string" },
            badgeColor: { type: "string" },
            image: { type: "string" },
            priceNumeric: { type: "number" },
          },
          required: ["title"],
          additionalProperties: true,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "add_miniapp_plan",
        description:
          "Добавить ОДИН тариф/план в список plans Mini App. id — короткий латинский ключ, name — отображаемое имя, price — цена строкой ('990', 'от 1500'), unit — '₽', '$/мес' и т.д., description — описание, highlight: true помечает план как рекомендуемый, features — массив строк-преимуществ. Вызывай ОТДЕЛЬНО для каждого плана.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            price: { type: "string" },
            unit: { type: "string" },
            description: { type: "string" },
            highlight: { type: "boolean" },
            features: { type: "array", items: { type: "string" } },
          },
          required: ["id", "name", "price"],
          additionalProperties: true,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "clear_miniapp_items",
        description:
          "Очистить список items в Mini App (items = []). Вызывай перед серией add_miniapp_item при редактировании, чтобы не накапливать дубли.",
        parameters: { type: "object", properties: {}, additionalProperties: true },
      },
    },
    {
      type: "function",
      function: {
        name: "set_miniapp_cart",
        description:
          "Включить (или выключить) корзину в Mini App. Когда корзина включена и у items есть priceNumeric, у каждой плитки появляется кнопка '+', а внизу Mini App — sticky-бар с количеством и суммой. Тап на бар открывает bottom-sheet со списком, +/-/удалить и кнопкой 'Оформить', которая отправляет заказ в бота через Telegram.WebApp.sendData с JSON {action, items:[{title,price,qty}], total, currency}. enabled (обязательно) — включить или выключить. sendAction — имя действия в payload (по умолчанию 'order'); бот в Уровне 2B будет ловить webapp_data триггером по этому имени. currency — символ валюты в суммах ('₽' по умолчанию). ctaLabel — надпись на кнопке оформления ('Оформить заказ' по умолчанию). Вызывай ОДИН РАЗ при настройке Mini App-магазина.",
        parameters: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            sendAction: { type: "string" },
            currency: { type: "string" },
            ctaLabel: { type: "string" },
          },
          required: ["enabled"],
          additionalProperties: true,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "clear_miniapp_plans",
        description:
          "Очистить список plans в Mini App (plans = []). Вызывай перед серией add_miniapp_plan при редактировании.",
        parameters: { type: "object", properties: {}, additionalProperties: true },
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

    let resolved = resolveModel(model);
    let aiModel = resolved.model;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const googleKey = Deno.env.get("GOOGLE_API_KEY");
    if (resolved.provider === "anthropic" && !anthropicKey) {
      return json({ error: "ANTHROPIC_API_KEY is not configured" }, 500);
    }
    if (resolved.provider === "google" && !googleKey) {
      return json({ error: "GOOGLE_API_KEY is not configured" }, 500);
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

      // ===== EDIT-mode hard guard =====
      // If the canvas already has nodes AND the user did NOT explicitly ask
      // for a rebuild, we FORCIBLY remove `reset_canvas` from the tool set
      // and prepend a hard rule to the system prompt. Sonnet 4.6 routinely
      // mis-classifies small tweaks ("протяни ноду от mini app к триггеру")
      // as BUILD and wipes the user's canvas, burning credits and trust.
      // Removing the tool entirely is the only reliable defence — prompt
      // discipline alone has been insufficient.
      const canvasHasNodes = canvasNodes.length > 0;
      const rebuildKeywords = /(пересобер|собери заново|начни заново|с нуля|забудь старый|reset|rebuild|from scratch|wipe)/i;
      const explicitRebuild = rebuildKeywords.test(lastUserMsg);
      if (canvasHasNodes && !explicitRebuild && toolDefs) {
        toolDefs = toolDefs.filter((t) => t?.function?.name !== "reset_canvas");
        systemPrompt =
          `== HARD CONSTRAINT (system enforced) ==\n` +
          `На канвасе уже есть ${canvasNodes.length} нод. Пользователь НЕ просил пересборки.\n` +
          `Это EDIT-режим. Инструмент reset_canvas УДАЛЁН — его нельзя вызвать.\n` +
          `Делай МИНИМАЛЬНУЮ точечную правку: get_canvas → 1-3 операции (connect / set_param / add_node) → готово.\n` +
          `НЕ пересобирай существующие ноды. НЕ повторяй set_variables / set_preview / set_code, если правка их не затрагивает.\n` +
          `Если запрос звучит как «соедини X с Y» / «протяни ноду» / «исправь связь» — это ОДИН вызов connect и всё.\n\n` +
          `Если X/Y описаны словами, найди реальные ID через get_canvas: Mini App = kind miniapp.screen, триггер заказа = kind trigger.webapp_data с params.action='order'.\n` +
          `Для Mini App → заказ используй connect(from=<miniapp.screen id>, to=<trigger.webapp_data id>) и больше ничего не меняй.\n\n` +
          systemPrompt;
      }
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
          // Round cap raised from 8 to 30 (2026-05-15). Under tool_choice:"any",
          // Sonnet 4.6 prefers to emit one tool_use per round rather than batching
          // them. With the old cap of 8, multi-step pipelines (e.g. "build a shop
          // bot": 6× add_miniapp_item + set_miniapp_cart + add_webapp_handler +
          // structural nodes = 12-17 ops) silently truncated at 8 — the user
          // saw a half-built bot and a confident summary text. 30 gives us 4×
          // headroom on realistic asks while still capping runaway loops.
          for (let round = 0; round < 30; round++) {
            console.log(`[architect-chat] round=${round} starting, conversation.length=${conversation.length}, toolDefs=${toolDefs?.length ?? 0}, model=${aiModel}, provider=${resolved.provider}`);

            // ===== Google Gemini branch (OpenAI-compatible endpoint) =====
            if (resolved.provider === "google") {
              const gBody: any = {
                model: aiModel,
                stream: true,
                temperature: 0.7,
                max_tokens: summaryOnly ? 700 : 8192,
                messages: conversation,
              };
              if (toolDefs && toolDefs.length > 0) {
                gBody.tools = toolDefs;
                gBody.tool_choice = "required";
              }
              // Retry with exponential backoff on transient errors (503/429/502/504)
              let gUp: Response | null = null;
              let lastErrText = "";
              let lastStatus = 0;
              const maxAttempts = 4;
              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                gUp = await fetch(
                  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${googleKey}`,
                    },
                    body: JSON.stringify(gBody),
                  },
                );
                if (gUp.ok && gUp.body) break;
                lastStatus = gUp.status;
                lastErrText = await gUp.text().catch(() => "");
                console.error(`Google API error (attempt ${attempt + 1}/${maxAttempts}):`, gUp.status, lastErrText.slice(0, 300));
                const transient = [429, 500, 502, 503, 504].includes(gUp.status);
                if (!transient || attempt === maxAttempts - 1) break;
                // Backoff: 1s, 2s, 4s
                await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
                gUp = null;
              }

              if (!gUp || !gUp.ok || !gUp.body) {
                // Fallback to Anthropic Sonnet if Google is unavailable and ANTHROPIC_API_KEY is set
                const transient = [429, 500, 502, 503, 504].includes(lastStatus);
                if (transient && anthropicKey) {
                  console.log(`[architect-chat] Gemini ${lastStatus} after retries — falling back to Anthropic Sonnet`);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    choices: [{ delta: { content: `⚠️ Gemini временно перегружен (${lastStatus}). Переключаюсь на Claude Sonnet...\n\n` } }],
                  })}\n\n`));
                  // Switch provider for the rest of this round
                  resolved = { provider: "anthropic", model: REAL_MODELS.claude_sonnet };
                  aiModel = resolved.model;
                  // Fall through to Anthropic branch below by continuing the outer loop
                  continue;
                }
                const errMsg = lastStatus === 503
                  ? `⚠️ Google Gemini перегружен (503). Попробуйте через минуту или переключитесь на Claude в селекторе модели.`
                  : `⚠️ Google Gemini API ${lastStatus}\n\n${lastErrText.slice(0, 1500) || "(empty body)"}`;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  choices: [{ delta: { content: errMsg } }],
                })}\n\n`));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }

              const gReader = gUp.body.getReader();
              let gBuf = "";
              let gAssistantContent = "";
              // Tool calls accumulated by upstream "index" (Gemini emits OpenAI-style
              // tool_calls deltas). We buffer the JSON arguments until [DONE] then flush.
              const gCalls = new Map<number, { id: string; name: string; argsJson: string; localIdx: number }>();
              let gNextLocal = 0;
              let gMaxLocal = -1;
              let gFinish: string | null = null;

              streamLoop: for (;;) {
                const { value, done } = await gReader.read();
                if (done) break;
                gBuf += decoder.decode(value, { stream: true });
                let nl: number;
                while ((nl = gBuf.indexOf("\n")) !== -1) {
                  let line = gBuf.slice(0, nl);
                  gBuf = gBuf.slice(nl + 1);
                  if (line.endsWith("\r")) line = line.slice(0, -1);
                  if (!line.startsWith("data: ")) continue;
                  const payload = line.slice(6).trim();
                  if (!payload) continue;
                  if (payload === "[DONE]") break streamLoop;
                  let evt: any;
                  try { evt = JSON.parse(payload); } catch { continue; }
                  const choice = evt?.choices?.[0];
                  if (!choice) continue;
                  const delta = choice.delta ?? {};
                  if (typeof delta.content === "string" && delta.content.length > 0) {
                    gAssistantContent += delta.content;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      choices: [{ delta: { content: delta.content } }],
                    })}\n\n`));
                  }
                  if (Array.isArray(delta.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                      const upIdx = typeof tc.index === "number" ? tc.index : 0;
                      let entry = gCalls.get(upIdx);
                      if (!entry) {
                        const localIdx = gNextLocal++;
                        gMaxLocal = Math.max(gMaxLocal, localIdx);
                        entry = {
                          id: String(tc.id ?? `call_${round}_${localIdx}`),
                          name: String(tc.function?.name ?? ""),
                          argsJson: "",
                          localIdx,
                        };
                        gCalls.set(upIdx, entry);
                      }
                      if (tc.id && !entry.id.startsWith("call_")) entry.id = String(tc.id);
                      if (tc.function?.name) entry.name = String(tc.function.name);
                      if (typeof tc.function?.arguments === "string") {
                        entry.argsJson += tc.function.arguments;
                      }
                    }
                  }
                  if (typeof choice.finish_reason === "string") gFinish = choice.finish_reason;
                }
              }

              // Flush completed tool_calls to the client.
              for (const tc of Array.from(gCalls.values()).sort((a, b) => a.localIdx - b.localIdx)) {
                let argsForClient = tc.argsJson || "{}";
                try { JSON.parse(argsForClient); } catch { argsForClient = "{}"; }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  choices: [{ delta: { tool_calls: [{
                    index: tc.localIdx + indexOffset,
                    id: tc.id,
                    type: "function",
                    function: { name: tc.name, arguments: argsForClient },
                  }] } }],
                })}\n\n`));
              }

              console.log(`[architect-chat] round=${round} (gemini) stream done, finish=${gFinish ?? "none"}, tool_calls=${gCalls.size}, content_len=${gAssistantContent.length}`);

              if (gCalls.size === 0 && gAssistantContent.length === 0) {
                const diag = `⚠️ [DEBUG round=${round}] Gemini вернул пустой ответ.\nfinish=${gFinish ?? "unknown"}`;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  choices: [{ delta: { content: diag } }],
                })}\n\n`));
              }

              if (gCalls.size === 0) {
                console.log(`[architect-chat] FINISHED at round=${round} (gemini), exit_reason=empty_round`);
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }

              const orderedCalls = Array.from(gCalls.values())
                .sort((a, b) => a.localIdx - b.localIdx)
                .map((c) => ({
                  id: c.id,
                  type: "function" as const,
                  function: {
                    name: c.name,
                    arguments: c.argsJson && c.argsJson.length > 0 ? c.argsJson : "{}",
                  },
                }));

              conversation.push({
                role: "assistant",
                content: gAssistantContent || "",
                tool_calls: orderedCalls,
              });
              for (const call of orderedCalls) {
                conversation.push({
                  role: "tool",
                  tool_call_id: call.id,
                  name: call.function.name,
                  content: call.function.name === "get_canvas" ? canvasResult : `{"ok":true}`,
                });
              }
              indexOffset += gMaxLocal + 1;
              continue; // next round
            }
            // ===== /Google branch =====


            const { system, messages: anthropicMessages } = convertMessagesToAnthropic(conversation);
            const anthropicTools = convertToolsToAnthropic(toolDefs);
            const requestBody: any = {
              model: aiModel,
              max_tokens: summaryOnly ? 700 : 8192,
              temperature: 0.7,
              messages: anthropicMessages,
              stream: true,
            };
            if (system) requestBody.system = system;
            if (anthropicTools) {
              requestBody.tools = anthropicTools;
              // tool_choice "any" — force the model to call at least one tool
              // per round. With "auto", Sonnet 4.6 tends to stop after the
              // first get_canvas call instead of continuing with the actual
              // work (observed empirically). The summaryOnly follow-up path
              // (where toolDefs is undefined) is what produces the final text.
              requestBody.tool_choice = { type: "any" };
            }

            const upstream = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": anthropicKey!,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify(requestBody),
            });

            if (!upstream.ok || !upstream.body) {
              const text = await upstream.text().catch(() => "");
              console.error("Anthropic API error:", upstream.status, text);
              // Surface the upstream error as a visible content delta so the
              // user sees the actual cause in chat (instead of the generic
              // "empty stream" fallback the client falls back to when no
              // content arrives). This is a diagnostics aid — once stable
              // we can downgrade to a quieter message.
              const errMsg = `⚠️ Anthropic API ${upstream.status}\n\n${text.slice(0, 1500) || "(empty body)"}`;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                choices: [{ delta: { content: errMsg } }],
              })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            const reader = upstream.body.getReader();
            let buffer = "";
            let assistantContent = "";
            let stopReason: string | null = null;
            // Tool calls collected in this round, keyed by Anthropic's
            // content_block index. Each tool_use block streams its input as
            // partial_json chunks; we buffer until content_block_stop and
            // only then emit a complete tool_call delta to the client (the
            // client expects whole-JSON arguments, same as the previous
            // Google-backed code path).
            const roundCalls = new Map<number, { id: string; name: string; argsJson: string; localIdx: number }>();
            let nextLocalIdx = 0;
            let maxLocalIndex = -1;

            // Anthropic SSE is event-typed:
            //   event: message_start
            //   event: content_block_start  → tells us "block at index N is text or tool_use"
            //   event: content_block_delta  → text_delta OR input_json_delta
            //   event: content_block_stop   → block finished; for tool_use we now flush
            //   event: message_delta        → stop_reason, usage
            //   event: message_stop
            //   event: ping
            //   event: error
            // We only need the data: payload (the event: line is informational).
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              let nl: number;
              while ((nl = buffer.indexOf("\n")) !== -1) {
                let line = buffer.slice(0, nl);
                buffer = buffer.slice(nl + 1);
                if (line.endsWith("\r")) line = line.slice(0, -1);
                if (!line.startsWith("data: ")) continue;
                const payload = line.slice(6).trim();
                if (!payload) continue;

                let evt: any;
                try { evt = JSON.parse(payload); } catch { continue; }

                const type = evt?.type;
                if (!type) continue;

                if (type === "content_block_start") {
                  const idx = evt.index;
                  const block = evt.content_block ?? {};
                  if (block.type === "tool_use") {
                    const localIdx = nextLocalIdx++;
                    maxLocalIndex = Math.max(maxLocalIndex, localIdx);
                    roundCalls.set(idx, {
                      id: String(block.id ?? `call_${round}_${localIdx}`),
                      name: String(block.name ?? ""),
                      argsJson: "",
                      localIdx,
                    });
                  }
                  // text blocks need no setup — text_delta events carry data.
                  continue;
                }

                if (type === "content_block_delta") {
                  const idx = evt.index;
                  const delta = evt.delta ?? {};
                  if (delta.type === "text_delta" && typeof delta.text === "string" && delta.text.length > 0) {
                    assistantContent += delta.text;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      choices: [{ delta: { content: delta.text } }],
                    })}\n\n`));
                  } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
                    const tc = roundCalls.get(idx);
                    if (tc) tc.argsJson += delta.partial_json;
                  }
                  continue;
                }

                if (type === "content_block_stop") {
                  const idx = evt.index;
                  const tc = roundCalls.get(idx);
                  if (tc) {
                    // Validate JSON; Anthropic guarantees a complete object
                    // by content_block_stop, but be defensive.
                    let argsForClient = tc.argsJson || "{}";
                    try { JSON.parse(argsForClient); } catch { argsForClient = "{}"; }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      choices: [{ delta: { tool_calls: [{
                        index: tc.localIdx + indexOffset,
                        id: tc.id,
                        type: "function",
                        function: { name: tc.name, arguments: argsForClient },
                      }] } }],
                    })}\n\n`));
                  }
                  continue;
                }

                if (type === "message_delta") {
                  // Anthropic sends final stop_reason here. Useful for
                  // diagnostics — distinguishes "end_turn" (model done) from
                  // "tool_use" (paused for tool result), "max_tokens" (cut
                  // off), "stop_sequence" (matched stop string).
                  if (typeof evt?.delta?.stop_reason === "string") {
                    stopReason = evt.delta.stop_reason;
                  }
                  continue;
                }

                if (type === "error") {
                  console.error("Anthropic stream error event:", evt);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    error: "stream_error",
                    detail: evt?.error?.message ?? "",
                  })}\n\n`));
                }
                // message_start / message_delta / message_stop / ping: nothing to forward.
              }
            }

            console.log(`[architect-chat] round=${round} stream done, stop_reason=${stopReason ?? "none"}, tool_calls=${roundCalls.size}, assistant_content_length=${assistantContent.length}, tool_call_names=${JSON.stringify(Array.from(roundCalls.values()).map(c => c.name))}`);

            // Diagnostic: if Anthropic returned absolutely nothing (no text,
            // no tool_calls) — surface that in chat so the user sees it
            // instead of a silent failure. This catches the case where the
            // model decided to stop without producing any output.
            if (roundCalls.size === 0 && assistantContent.length === 0) {
              const diag = `⚠️ [DEBUG round=${round}] Anthropic вернул пустой ответ.\nstop_reason=${stopReason ?? "unknown"}\nЭто значит модель решила ничего не выводить. Скорее всего проблема в промпте или tool_choice.`;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                choices: [{ delta: { content: diag } }],
              })}\n\n`));
            }

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
            // Order by Anthropic's block index so multi-tool-call assistant turns
            // round-trip in stable order.
            const orderedCalls = Array.from(roundCalls.entries())
              .sort(([a], [b]) => a - b)
              .map(([, c]) => ({
                id: c.id,
                type: "function" as const,
                function: {
                  name: c.name,
                  arguments: c.argsJson && c.argsJson.length > 0 ? c.argsJson : "{}",
                },
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
                name: call.function.name,
                content: call.function.name === "get_canvas" ? canvasResult : `{"ok":true}`,
              });
            }

            indexOffset += maxLocalIndex + 1;
            // Loop back for another round.
          }

          // Safety cap reached.
          console.log(`[architect-chat] FINISHED at safety cap (8 rounds), exit_reason=cap`);
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
