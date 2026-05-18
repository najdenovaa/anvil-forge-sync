import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Send, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/anvl/AuthGate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/flows/$slug/broadcasts")({
  head: ({ params }) => ({
    meta: [{ title: `Рассылки — ${params.slug} — ANVL` }],
  }),
  component: () => (
    <AuthGate>
      <Screen />
    </AuthGate>
  ),
});

interface Broadcast {
  id: string;
  text: string;
  status: string;
  sent_count: number;
  fail_count: number;
  recipients_total: number;
  created_at: string;
  sent_at: string | null;
  error: string | null;
}

function Screen() {
  const { slug } = Route.useParams();
  const [botId, setBotId] = useState<string | null>(null);
  const [list, setList] = useState<Broadcast[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
      const { data } = await supabase
        .from("bot_broadcasts")
        .select("*")
        .eq("bot_id", bot.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setList((data ?? []) as Broadcast[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const send = async () => {
    if (!botId) return;
    const msg = text.trim();
    if (!msg) return;
    if (!confirm(`Отправить рассылку всем пользователям бота?\n\n${msg.slice(0, 200)}`)) return;
    setSending(true);
    setError(null);
    setInfo(null);
    try {
      const { data, error } = await supabase.functions.invoke("bot-broadcast", {
        body: { bot_id: botId, text: msg },
      });
      if (error) throw error;
      const res = data as { sent: number; failed: number; recipients_total: number };
      setInfo(`Отправлено ${res.sent} из ${res.recipients_total} (ошибок: ${res.failed})`);
      setText("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Ошибка отправки");
    } finally {
      setSending(false);
    }
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
            <Send className="h-4 w-4" /> Рассылки
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
        {!botId && !loading && (
          <div className="hairline mb-4 rounded-md bg-amber-500/10 px-3 py-2 text-[12px] text-amber-600 dark:text-amber-400">
            Бот ещё не задеплоен. Сначала задеплой бота во вкладке сценария.
          </div>
        )}

        <div className="hairline mb-6 rounded-lg bg-surface p-4">
          <div className="mb-2 text-sm font-semibold">Новая рассылка</div>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Сообщение получат все пользователи, которые когда-либо писали этому боту. Поддерживаются
            те же плейсхолдеры, что и в сценарии (например, <code>{"{first_name}"}</code>), но
            подставятся только пользовательские поля на момент рендера — глобальные переменные
            берутся как есть.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
            rows={5}
            maxLength={4000}
            placeholder="Привет! У нас новая акция…"
            className="hairline w-full rounded-md bg-background px-3 py-2 text-[13px]"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{text.length}/4000</span>
            <button
              onClick={send}
              disabled={sending || !botId || !text.trim()}
              className="flex items-center gap-1.5 rounded-md bg-foreground px-4 py-1.5 text-[12px] font-medium text-background transition hover:opacity-90 disabled:opacity-40"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Отправить
            </button>
          </div>
          {error && (
            <div className="mt-2 text-[12px] text-destructive">{error}</div>
          )}
          {info && (
            <div className="mt-2 text-[12px] text-emerald-600 dark:text-emerald-400">{info}</div>
          )}
        </div>

        <div className="mb-2 text-sm font-semibold">История</div>
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Загрузка…</div>
        ) : list.length === 0 ? (
          <div className="hairline rounded-lg bg-surface px-6 py-10 text-center text-sm text-muted-foreground">
            Рассылок пока не было.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((b) => (
              <div key={b.id} className="hairline rounded-lg bg-surface p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{new Date(b.created_at).toLocaleString("ru-RU")}</span>
                  <span>
                    {b.status} · отправлено {b.sent_count}/{b.recipients_total}
                    {b.fail_count > 0 && ` · ошибок ${b.fail_count}`}
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-[13px]">{b.text}</div>
                {b.error && (
                  <div className="mt-1 text-[11px] text-destructive">{b.error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
