import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type Lang = "ru" | "en";

type Dict = Record<string, string>;

const ru: Dict = {
  // TopBar
  "topbar.project": "Welcome Bot",
  "topbar.flow": "/ основной флоу",
  "topbar.preview": "Превью",
  "topbar.deploy": "Опубликовать",
  "platform.telegram": "Telegram",
  "platform.max": "Max",
  "platform.miniapp": "Mini App",
  "platform.miniapp.hint": "Если включено — Anvl построит и Mini App",
  "lang.ru": "RU",
  "lang.en": "EN",

  // Left AI panel
  "ai.title": "Anvl",
  "ai.history": "История",
  "ai.new": "Новый чат",
  "ai.placeholder": "Опишите вашего бота…",
  "ai.send_hint": "⌘↵ — отправить",
  "ai.model": "движок",
  "ai.msg.intro":
    "Я Anvl. Опишите бота, который вы хотите, и я разложу флоу на канвасе.",
  "ai.label": "Anvl",
  "ai.thinking": "Думаю…",
  "ai.thoughts": "Ход мыслей",
  "ai.step.analyze": "Анализирую запрос",
  "ai.step.plan": "Подбираю модули",
  "ai.step.compose": "Формирую ответ",
  "ai.thoughts.show": "Показать рассуждения",
  "ai.thoughts.hide": "Скрыть рассуждения",
  "ai.error": "Не удалось получить ответ. Попробуйте ещё раз.",
  "ai.rate_limit": "Слишком много запросов. Подождите немного.",
  "ai.payment": "Закончились кредиты Lovable AI. Пополните баланс в Settings → Workspace → Usage.",
  "ai.unavailable": "Эта модель пока недоступна. Используйте Auto, GPT-5 или Gemini.",
  "ai.model.auto": "Auto",
  "ai.model.auto.hint": "Anvl сам выберет лучшую модель",
  "ai.model.gpt": "GPT-5",
  "ai.model.gemini": "Gemini 2.5",
  "ai.model.grok": "Grok",
  "ai.model.claude": "Claude",
  "ai.model.soon": "скоро",
  "ai.model.routed": "через Anvl",

  // Right inspector
  "inspector.components": "Компоненты",
  "inspector.settings": "Настройки",

  // Component groups
  "group.Triggers": "Триггеры",
  "group.Messages": "Сообщения",
  "group.Keyboards": "Клавиатуры",
  "group.Mini App": "Mini App",
  "group.Logic": "Логика",

  // Node labels
  "node.trigger.command.label": "Команда",
  "node.trigger.command.desc": "Срабатывает на /команду",
  "node.trigger.message.label": "Сообщение",
  "node.trigger.message.desc": "Любой входящий текст",
  "node.trigger.callback.label": "Callback",
  "node.trigger.callback.desc": "Нажатие инлайн-кнопки",
  "node.message.text.label": "Текст",
  "node.message.text.desc": "Отправить текстовый ответ",
  "node.message.photo.label": "Фото",
  "node.message.photo.desc": "Отправить изображение",
  "node.message.document.label": "Документ",
  "node.message.document.desc": "Отправить файл",
  "node.keyboard.inline.label": "Инлайн",
  "node.keyboard.inline.desc": "Кнопки под сообщением",
  "node.keyboard.reply.label": "Reply",
  "node.keyboard.reply.desc": "Своя клавиатура ответа",
  "node.miniapp.screen.label": "Экран",
  "node.miniapp.screen.desc": "Экран WebView",
  "node.logic.condition.label": "Условие",
  "node.logic.condition.desc": "Ветка if / else",
  "node.action.api.label": "API запрос",
  "node.action.api.desc": "Исходящий HTTP-запрос",

  // Settings pane
  "settings.cloud_status": "Статус облака",
  "settings.production": "Production",
  "settings.webhook": "Webhook",
  "settings.healthy": "Здоров",
  "settings.tg_status": "Telegram",
  "settings.max_status": "Max",
  "settings.reauth": "Переавторизация",
  "settings.tg_section": "Telegram · BotFather",
  "settings.max_section": "Max Messenger · Developer",
  "settings.bot_username": "Имя бота",
  "settings.bot_token": "Токен бота",
  "settings.webhook_field": "Webhook",
  "settings.app_id": "ID приложения",
  "settings.api_key": "API-ключ",
  "settings.channel": "Канал",
  "settings.miniapp": "Mini App",
  "settings.webview_url": "WebView URL",
  "settings.init_mode": "Режим инициализации",

  // Initial canvas nodes
  "canvas.start.title": "/start",
  "canvas.start.preview": "Когда пользователь отправляет /start",
  "canvas.welcome.title": "Приветствие",
  "canvas.welcome.preview": "Привет! Готовы запустить VPN?",
  "canvas.menu.title": "Главное меню",
  "canvas.menu.preview": "Открыть VPN · Тарифы · Помощь",
  "canvas.dashboard.title": "VPN Mini App",
  "canvas.dashboard.preview": "WebView · /app/vpn",

  // Preview phone — VPN bot
  "preview.bot_name": "Anvl VPN",
  "preview.bot_status": "бот · в сети",
  "preview.composer": "Сообщение",
  "preview.user_msg": "/start",
  "preview.bot_msg_1":
    "Привет, Саша 👋 Anvl VPN — быстрый и безопасный доступ к интернету. 12 стран, без логов.",
  "preview.bot_msg_2": "Готовы подключиться?",
  "preview.btn.open": "🚀 Открыть VPN",
  "preview.btn.pricing": "Тарифы",
  "preview.btn.help": "Помощь",
  "preview.opening": "Открываю Mini App…",

  // Mini App — VPN
  "vpn.title": "Anvl VPN",
  "vpn.subtitle": "Быстрый. Без логов.",
  "vpn.tab.home": "Главная",
  "vpn.tab.locations": "Серверы",
  "vpn.tab.plans": "Тарифы",
  "vpn.tab.profile": "Профиль",
  "vpn.status.disconnected": "Отключено",
  "vpn.status.connecting": "Подключение…",
  "vpn.status.connected": "Защищено",
  "vpn.connect": "Подключить",
  "vpn.disconnect": "Отключить",
  "vpn.connecting": "Подключение…",
  "vpn.current_server": "Текущий сервер",
  "vpn.your_ip": "Ваш IP",
  "vpn.protected_ip": "Защищённый IP",
  "vpn.speed_down": "Загрузка",
  "vpn.speed_up": "Отдача",
  "vpn.choose_location": "Выбрать локацию",
  "vpn.ping": "пинг",
  "vpn.load": "загрузка",
  "vpn.free": "Free",
  "vpn.pro": "Pro",
  "vpn.team": "Team",
  "vpn.plan.free.desc": "3 локации · 1 устройство",
  "vpn.plan.pro.desc": "Все локации · 5 устройств · без рекламы",
  "vpn.plan.team.desc": "До 10 устройств · приоритет",
  "vpn.plan.current": "Текущий",
  "vpn.plan.upgrade": "Перейти",
  "vpn.month": "/мес",
  "vpn.profile.devices": "Устройства",
  "vpn.profile.referral": "Пригласи друга",
  "vpn.profile.support": "Поддержка",
  "vpn.profile.signout": "Выйти",
  "vpn.back_to_chat": "← Назад к чату",
  "vpn.country.nl": "Нидерланды",
  "vpn.country.de": "Германия",
  "vpn.country.us": "США",
  "vpn.country.jp": "Япония",
  "vpn.country.sg": "Сингапур",
  "vpn.country.ae": "ОАЭ",
  "vpn.city.ams": "Амстердам",
  "vpn.city.fra": "Франкфурт",
  "vpn.city.nyc": "Нью-Йорк",
  "vpn.city.tok": "Токио",
  "vpn.city.sgp": "Сингапур",
  "vpn.city.dxb": "Дубай",
};

const en: Dict = {
  "topbar.project": "Welcome Bot",
  "topbar.flow": "/ main flow",
  "topbar.preview": "Preview",
  "topbar.deploy": "Deploy",
  "platform.telegram": "Telegram",
  "platform.max": "Max",
  "platform.miniapp": "Mini App",
  "platform.miniapp.hint": "When on — Anvl also builds a Mini App",
  "lang.ru": "RU",
  "lang.en": "EN",

  "ai.title": "Anvl",
  "ai.history": "History",
  "ai.new": "New chat",
  "ai.placeholder": "Describe your bot…",
  "ai.send_hint": "⌘↵ to send",
  "ai.model": "engine",
  "ai.msg.intro":
    "I'm Anvl. Describe the bot you want and I'll lay out the flow on the canvas.",
  "ai.label": "Anvl",
  "ai.thinking": "Thinking…",
  "ai.thoughts": "Thought process",
  "ai.step.analyze": "Analyzing request",
  "ai.step.plan": "Selecting modules",
  "ai.step.compose": "Composing reply",
  "ai.thoughts.show": "Show reasoning",
  "ai.thoughts.hide": "Hide reasoning",
  "ai.error": "Couldn't get a response. Try again.",
  "ai.rate_limit": "Too many requests. Please wait a moment.",
  "ai.payment": "Out of Lovable AI credits. Top up at Settings → Workspace → Usage.",
  "ai.unavailable": "This model isn't available yet. Use Auto, GPT-5 or Gemini.",
  "ai.model.auto": "Auto",
  "ai.model.auto.hint": "Anvl picks the best model",
  "ai.model.gpt": "GPT-5",
  "ai.model.gemini": "Gemini 2.5",
  "ai.model.grok": "Grok",
  "ai.model.claude": "Claude",
  "ai.model.soon": "soon",
  "ai.model.routed": "routed by Anvl",

  "inspector.components": "Components",
  "inspector.settings": "Settings",

  "group.Triggers": "Triggers",
  "group.Messages": "Messages",
  "group.Keyboards": "Keyboards",
  "group.Mini App": "Mini App",
  "group.Logic": "Logic",

  "node.trigger.command.label": "Command",
  "node.trigger.command.desc": "Fires on /command",
  "node.trigger.message.label": "Message",
  "node.trigger.message.desc": "Any incoming text",
  "node.trigger.callback.label": "Callback",
  "node.trigger.callback.desc": "Inline button tap",
  "node.message.text.label": "Text",
  "node.message.text.desc": "Send a text reply",
  "node.message.photo.label": "Photo",
  "node.message.photo.desc": "Send an image",
  "node.message.document.label": "Document",
  "node.message.document.desc": "Send a file",
  "node.keyboard.inline.label": "Inline",
  "node.keyboard.inline.desc": "Buttons under message",
  "node.keyboard.reply.label": "Reply",
  "node.keyboard.reply.desc": "Custom reply keyboard",
  "node.miniapp.screen.label": "Screen",
  "node.miniapp.screen.desc": "WebView screen",
  "node.logic.condition.label": "Condition",
  "node.logic.condition.desc": "If / else branch",
  "node.action.api.label": "API call",
  "node.action.api.desc": "Outbound HTTP request",

  "settings.cloud_status": "Cloud status",
  "settings.production": "Production",
  "settings.webhook": "Webhook",
  "settings.healthy": "Healthy",
  "settings.tg_status": "Telegram",
  "settings.max_status": "Max",
  "settings.reauth": "Reauth",
  "settings.tg_section": "Telegram · BotFather",
  "settings.max_section": "Max Messenger · Developer",
  "settings.bot_username": "Bot username",
  "settings.bot_token": "Bot token",
  "settings.webhook_field": "Webhook",
  "settings.app_id": "App ID",
  "settings.api_key": "API key",
  "settings.channel": "Channel",
  "settings.miniapp": "Mini App",
  "settings.webview_url": "WebView URL",
  "settings.init_mode": "Init mode",

  "canvas.start.title": "/start",
  "canvas.start.preview": "When user sends /start",
  "canvas.welcome.title": "Welcome",
  "canvas.welcome.preview": "Hi! Ready to launch VPN?",
  "canvas.menu.title": "Main menu",
  "canvas.menu.preview": "Open VPN · Pricing · Help",
  "canvas.dashboard.title": "VPN Mini App",
  "canvas.dashboard.preview": "WebView · /app/vpn",

  "preview.bot_name": "Anvl VPN",
  "preview.bot_status": "bot · online",
  "preview.composer": "Message",
  "preview.user_msg": "/start",
  "preview.bot_msg_1":
    "Hi Sasha 👋 Anvl VPN — fast and secure internet. 12 countries, no logs.",
  "preview.bot_msg_2": "Ready to connect?",
  "preview.btn.open": "🚀 Open VPN",
  "preview.btn.pricing": "Plans",
  "preview.btn.help": "Help",
  "preview.opening": "Opening Mini App…",

  "vpn.title": "Anvl VPN",
  "vpn.subtitle": "Fast. No logs.",
  "vpn.tab.home": "Home",
  "vpn.tab.locations": "Servers",
  "vpn.tab.plans": "Plans",
  "vpn.tab.profile": "Profile",
  "vpn.status.disconnected": "Disconnected",
  "vpn.status.connecting": "Connecting…",
  "vpn.status.connected": "Protected",
  "vpn.connect": "Connect",
  "vpn.disconnect": "Disconnect",
  "vpn.connecting": "Connecting…",
  "vpn.current_server": "Current server",
  "vpn.your_ip": "Your IP",
  "vpn.protected_ip": "Protected IP",
  "vpn.speed_down": "Download",
  "vpn.speed_up": "Upload",
  "vpn.choose_location": "Choose location",
  "vpn.ping": "ping",
  "vpn.load": "load",
  "vpn.free": "Free",
  "vpn.pro": "Pro",
  "vpn.team": "Team",
  "vpn.plan.free.desc": "3 locations · 1 device",
  "vpn.plan.pro.desc": "All locations · 5 devices · ad-free",
  "vpn.plan.team.desc": "Up to 10 devices · priority",
  "vpn.plan.current": "Current",
  "vpn.plan.upgrade": "Upgrade",
  "vpn.month": "/mo",
  "vpn.profile.devices": "Devices",
  "vpn.profile.referral": "Invite a friend",
  "vpn.profile.support": "Support",
  "vpn.profile.signout": "Sign out",
  "vpn.back_to_chat": "← Back to chat",
  "vpn.country.nl": "Netherlands",
  "vpn.country.de": "Germany",
  "vpn.country.us": "USA",
  "vpn.country.jp": "Japan",
  "vpn.country.sg": "Singapore",
  "vpn.country.ae": "UAE",
  "vpn.city.ams": "Amsterdam",
  "vpn.city.fra": "Frankfurt",
  "vpn.city.nyc": "New York",
  "vpn.city.tok": "Tokyo",
  "vpn.city.sgp": "Singapore",
  "vpn.city.dxb": "Dubai",
};

const dicts: Record<Lang, Dict> = { ru, en };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = "anvl.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  // Always start with "ru" on both server and client to avoid hydration mismatch.
  const [lang, setLangState] = useState<Lang>("ru");

  // After mount, restore from localStorage if user previously chose another language.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "ru") {
        setLangState(saved);
        document.documentElement.setAttribute("lang", saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
      } catch {
        /* ignore */
      }
      document.documentElement.setAttribute("lang", l);
    }
  }, []);

  const t = useCallback(
    (key: string) => dicts[lang][key] ?? dicts.ru[key] ?? key,
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
