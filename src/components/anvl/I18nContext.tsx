import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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
  "lang.ru": "RU",
  "lang.en": "EN",

  // Left AI panel
  "ai.title": "ИИ Архитектор",
  "ai.history": "История",
  "ai.new": "Новый чат",
  "ai.placeholder": "Опишите вашего бота…",
  "ai.send_hint": "⌘↵ — отправить",
  "ai.model": "gpt-5 · архитектор",
  "ai.msg.intro":
    "Я ваш ИИ Архитектор. Опишите бота, который вы хотите, и я выложу флоу на канвас.",
  "ai.msg.user_example":
    "Добавь команду /pricing, которая отправляет инлайн-клавиатуру с тремя тарифами.",
  "ai.msg.assistant_example":
    "Готово — добавил триггер «Команда», текстовое сообщение и инлайн-клавиатуру с Basic / Pro / Team. Соединил их на канвасе.",
  "ai.label": "Архитектор",

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
  "canvas.welcome.preview": "Привет, {{user.first_name}} — добро пожаловать в Anvl.",
  "canvas.menu.title": "Главное меню",
  "canvas.menu.preview": "Открыть приложение · Тарифы · Помощь",
  "canvas.dashboard.title": "Дашборд",
  "canvas.dashboard.preview": "WebView · /app/home",

  // Preview phone
  "preview.bot_name": "Welcome Bot",
  "preview.bot_status": "бот · в сети",
  "preview.composer": "Сообщение",
  "preview.user_msg": "/start",
  "preview.bot_msg_1": "Привет, Саша — добро пожаловать в Anvl. Помогу запустить ботов и mini-app за минуты.",
  "preview.bot_msg_2": "Выберите вариант:",
  "preview.btn.open": "Открыть приложение",
  "preview.btn.pricing": "Тарифы",
  "preview.btn.help": "Помощь",
};

const en: Dict = {
  "topbar.project": "Welcome Bot",
  "topbar.flow": "/ main flow",
  "topbar.preview": "Preview",
  "topbar.deploy": "Deploy",
  "platform.telegram": "Telegram",
  "platform.max": "Max",
  "lang.ru": "RU",
  "lang.en": "EN",

  "ai.title": "AI Architect",
  "ai.history": "History",
  "ai.new": "New chat",
  "ai.placeholder": "Describe your bot…",
  "ai.send_hint": "⌘↵ to send",
  "ai.model": "gpt-5 · architect",
  "ai.msg.intro":
    "I'm your AI Architect. Describe the bot you want and I'll lay out the flow on the canvas.",
  "ai.msg.user_example":
    "Add a /pricing command that sends an inline keyboard with three plans.",
  "ai.msg.assistant_example":
    "Done — I added a Command trigger, a Text message, and an Inline keyboard with Basic / Pro / Team. Connected them on the canvas.",
  "ai.label": "Architect",

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
  "canvas.welcome.preview": "Hi {{user.first_name}} — welcome to Anvl.",
  "canvas.menu.title": "Main menu",
  "canvas.menu.preview": "Open app · Pricing · Help",
  "canvas.dashboard.title": "Dashboard",
  "canvas.dashboard.preview": "WebView · /app/home",

  "preview.bot_name": "Welcome Bot",
  "preview.bot_status": "bot · online",
  "preview.composer": "Message",
  "preview.user_msg": "/start",
  "preview.bot_msg_1":
    "Hi Sasha — welcome to Anvl. I help you ship bots & mini-apps in minutes.",
  "preview.bot_msg_2": "Pick an option:",
  "preview.btn.open": "Open app",
  "preview.btn.pricing": "Pricing",
  "preview.btn.help": "Help",
};

const dicts: Record<Lang, Dict> = { ru, en };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

const STORAGE_KEY = "anvl.lang";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "ru";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "ru" || saved === "en") return saved;
  return "ru";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
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
