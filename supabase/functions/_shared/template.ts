/**
 * ⚠️ ДУБЛИРУЕТСЯ В ДВУХ МЕСТАХ — синхронизируй вручную:
 *   - src/lib/template-shared.ts             (используется фронтом / симулятором)
 *   - supabase/functions/_shared/template.ts (используется edge functions)
 *
 * Причина: Supabase Edge Functions bundler не может импортировать
 * за пределы supabase/functions/. Vite не может импортировать .ts
 * файлы из supabase/functions/ напрямую без хака.
 *
 * При изменении этого файла ОБЯЗАТЕЛЬНО обнови второй.
 * Будущая защита: snapshot-тест который сравнивает оба файла побайтно.
 */
// Shared template engine. Used by both the simulator (browser/Vite) AND
// the bot-runtime edge function (Deno). Keep this file dependency-free —
// no Node, no Deno, no DOM imports.

export type TemplatePrimitive = string | number | boolean | null;

export interface TemplateContext {
  user: {
    first_name?: string;
    last_name?: string;
    username?: string;
    id?: string | number;
    language_code?: string;
  };
  var: Record<string, TemplatePrimitive | unknown>;
  /** Last incoming user message text, if any. */
  text?: string;
  system: {
    /** Local timestamp like "2026-05-06 14:23". */
    now: string;
    /** Local date like "2026-05-06". */
    today: string;
    bot_username?: string;
  };
  /**
   * Data from the latest Telegram.WebApp.sendData payload sent by a Mini App.
   * Populated by bot-runtime when a `trigger.webapp_data` node fires; absent
   * otherwise. Lets response templates address {webapp.total},
   * {webapp.items_summary}, {webapp.action}, {webapp.count}, {webapp.currency}.
   * The raw JSON is also exposed as {webapp.raw} for power users.
   */
  webapp?: {
    /** Value of `action` field in the JSON payload (e.g. "order"). */
    action?: string;
    /** Numeric total — pre-stringified to ease template use. */
    total?: string;
    /** Currency symbol from the payload. */
    currency?: string;
    /** Number of distinct line-items, NOT total quantity. */
    count?: string;
    /** Pre-formatted human-readable list, e.g. "Latte × 2, Raf × 1". */
    items_summary?: string;
    /** Raw payload JSON as a string for advanced usage. */
    raw?: string;
  };
}

const USER_ALIASES = new Set(["first_name", "last_name", "username"]);

/**
 * Supported placeholder syntax:
 *   {first_name}, {last_name}, {username}    aliases for {user.X}
 *   {user.X}                                 user fields
 *   {var.X}                                  session/user variable
 *   {text}                                   last user message
 *   {system.now}, {system.today}, {system.bot_username}
 *
 * Missing keys render as the empty string — never throw, so a typo
 * in the AI Architect's output doesn't crash a live bot.
 *
 * NOTE: no HTML / Markdown escaping happens here. Callers that send
 * with parse_mode must escape the rendered string themselves.
 */
export function renderTemplate(tpl: string | undefined | null, ctx: TemplateContext): string {
  if (!tpl) return "";
  return tpl.replace(/\{([\w.]+)\}/g, (_, path: string) => {
    if (USER_ALIASES.has(path)) {
      const v = ctx.user?.[path as "first_name" | "last_name" | "username"];
      return v == null ? "" : String(v);
    }
    const parts = path.split(".");
    let v: unknown = ctx;
    for (const p of parts) {
      if (v == null || typeof v !== "object") return "";
      v = (v as Record<string, unknown>)[p];
    }
    return v == null ? "" : String(v);
  });
}

/** Names of placeholders found in the template, deduped, in first-seen order. */
export function extractPlaceholders(tpl: string | undefined | null): string[] {
  if (!tpl) return [];
  const out = new Set<string>();
  const re = /\{([\w.]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tpl)) !== null) out.add(m[1]);
  return Array.from(out);
}

/** Returns placeholders that resolve to empty / missing values for the given context. */
export function findMissingPlaceholders(tpl: string | undefined | null, ctx: TemplateContext): string[] {
  const used = extractPlaceholders(tpl);
  return used.filter((p) => renderTemplate(`{${p}}`, ctx) === "");
}

/** Build a system context block with locale-aware now/today (ru-RU). */
export function buildSystemContext(botUsername?: string): TemplateContext["system"] {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = `${today} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { now, today, bot_username: botUsername };
}
