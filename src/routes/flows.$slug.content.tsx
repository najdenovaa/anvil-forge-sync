import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, RefreshCw, Variable } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/anvl/AuthGate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/flows/$slug/content")({
  head: ({ params }) => ({
    meta: [{ title: `Контент — ${params.slug} — ANVL` }],
  }),
  component: () => (
    <AuthGate>
      <Screen />
    </AuthGate>
  ),
});

interface Global {
  id?: string;
  bot_id: string;
  key: string;
  label: string | null;
  value: unknown;
  updated_at?: string;
}

function valueToText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // Unwrap our {v: scalar} envelope if present
  if (typeof v === "object" && v && "v" in (v as any) && Object.keys(v as any).length === 1) {
    return valueToText((v as any).v);
  }
  return JSON.stringify(v, null, 2);
}

function textToValue(text: string): unknown {
  // Store as plain string by default — that's the 99% case for content.
  return text;
}

function Screen() {
  const { slug } = Route.useParams();
  const [botId, setBotId] = useState<string | null>(null);
  const [rows, setRows] = useState<Global[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { label: string; value: string }>>({});
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    const isUuid = /^[0-9a-f-]{36}$/i.test(slug);
    const fq = isUuid
      ? supabase.from("flows").select("id").eq("id", slug).maybeSingle()
      : supabase.from("flows").select("id").eq("slug", slug).maybeSingle();
    const { data: flow } = await fq;
    if (!flow) {
      setError("Flow not found");
      setLoading(false);
      return;
    }
    const { data: bot } = await supabase
      .from("bots")
      .select("id")
      .eq("flow_id", flow.id)
      .maybeSingle();
    setBotId(bot?.id ?? null);
    if (bot?.id) {
      const { data, error } = await supabase
        .from("bot_globals")
        .select("*")
        .eq("bot_id", bot.id)
        .order("key", { ascending: true });
      if (error) setError(error.message);
      const list = (data ?? []) as Global[];
      setRows(list);
      const d: Record<string, { label: string; value: string }> = {};
      for (const r of list) d[r.key] = { label: r.label ?? "", value: valueToText(r.value) };
      setDrafts(d);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const saveRow = async (key: string) => {
    if (!botId) return;
    const d = drafts[key];
    if (!d) return;
    const { error } = await supabase
      .from("bot_globals")
      .update({ value: textToValue(d.value) as any, label: d.label.trim() || null })
      .eq("bot_id", botId)
      .eq("key", key);
    if (error) setError(error.message);
    else await load();
  };

  const removeRow = async (key: string) => {
    if (!botId) return;
    if (!confirm(`Удалить переменную {var.${key}}?`)) return;
    const { error } = await supabase
      .from("bot_globals")
      .delete()
      .eq("bot_id", botId)
      .eq("key", key);
    if (error) setError(error.message);
    else await load();
  };

  const addRow = async () => {
    if (!botId) return;
    const k = newKey.trim();
    if (!k) return;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) {
      setError("Ключ может содержать только латинские буквы, цифры и _, начинаться с буквы.");
      return;
    }
    if (rows.some((r) => r.key === k)) {
      setError("Такой ключ уже есть.");
      return;
    }
    const { error } = await supabase.from("bot_globals").insert({
      bot_id: botId,
      key: k,
      value: textToValue(newValue) as any,
      label: newLabel.trim() || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNewKey("");
    setNewLabel("");
    setNewValue("");
    await load();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b border-hairline px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/flows/$slug"
            params={{ slug }}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> К сценарию
          </Link>
          <div className="h-5 w-px bg-hairline" />
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <Variable className="h-4 w-4" /> Контент бота
            <span className="font-mono text-[11px] text-muted-foreground">{slug}</span>
          </h1>
        </div>
        <button
          onClick={load}
          className="hairline flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-[12px] text-muted-foreground transition hover:text-foreground"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Обновить
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="mb-4 text-[12px] text-muted-foreground">
          Здесь живут «глобальные» переменные бота: меню, цены, расписание, контакты. В сценарии
          ссылайся на них как <code>{"{var.menu}"}</code>, <code>{"{var.price}"}</code> и т.д. —
          бот подставит свежее значение в момент ответа, ничего перевыкладывать не нужно.
        </p>

        {!botId && !loading && (
          <div className="hairline mb-4 rounded-md bg-amber-500/10 px-3 py-2 text-[12px] text-amber-600 dark:text-amber-400">
            Бот ещё не задеплоен. Задеплой бота во вкладке сценария, чтобы появилась область
            контента.
          </div>
        )}

        {error && (
          <div className="hairline mb-4 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
            {error}
          </div>
        )}

        {botId && (
          <div className="hairline mb-6 rounded-lg bg-surface p-4">
            <div className="mb-2 text-sm font-semibold">Добавить переменную</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr]">
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="key (menu)"
                className="hairline rounded-md bg-background px-3 py-1.5 text-[13px] font-mono"
              />
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Подпись (необязательно)"
                className="hairline rounded-md bg-background px-3 py-1.5 text-[13px]"
              />
            </div>
            <textarea
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              rows={3}
              placeholder="Значение (например, текст меню)"
              className="hairline mt-2 w-full rounded-md bg-background px-3 py-2 text-[13px]"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={addRow}
                disabled={!newKey.trim()}
                className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition hover:opacity-90 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Добавить
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="hairline rounded-lg bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
            Переменных пока нет.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const d = drafts[r.key] ?? { label: "", value: "" };
              const dirty =
                d.value !== valueToText(r.value) || (d.label ?? "") !== (r.label ?? "");
              return (
                <div key={r.key} className="hairline rounded-lg bg-surface p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-foreground/10 px-1.5 py-0.5 text-[11px] font-semibold">
                        {`{var.${r.key}}`}
                      </code>
                      <input
                        value={d.label}
                        onChange={(e) =>
                          setDrafts((cur) => ({ ...cur, [r.key]: { ...d, label: e.target.value } }))
                        }
                        placeholder="Подпись"
                        className="hairline rounded-md bg-background px-2 py-1 text-[12px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => saveRow(r.key)}
                        disabled={!dirty}
                        className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background transition hover:opacity-90 disabled:opacity-30"
                      >
                        <Save className="h-3 w-3" /> Сохранить
                      </button>
                      <button
                        onClick={() => removeRow(r.key)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={d.value}
                    onChange={(e) =>
                      setDrafts((cur) => ({ ...cur, [r.key]: { ...d, value: e.target.value } }))
                    }
                    rows={Math.min(10, Math.max(2, d.value.split("\n").length))}
                    className="hairline w-full rounded-md bg-background px-3 py-2 text-[13px]"
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
