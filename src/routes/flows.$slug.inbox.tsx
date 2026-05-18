import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Inbox as InboxIcon, RefreshCw, Plus, Trash2, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/anvl/AuthGate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/flows/$slug/inbox")({
  head: ({ params }) => ({
    meta: [
      { title: `Inbox — ${params.slug} — ANVL` },
      { name: "description", content: `Incoming submissions for ${params.slug}.` },
    ],
  }),
  component: () => (
    <AuthGate>
      <InboxScreen />
    </AuthGate>
  ),
});

type Status = "new" | "in_progress" | "done" | "archived";

interface Submission {
  id: string;
  bot_id: string;
  flow_id: string;
  tg_user_id: string | null;
  tg_chat_id: string;
  tg_username: string | null;
  tg_user_full_name: string | null;
  kind: string;
  status: Status;
  payload: Record<string, unknown>;
  admin_note: string | null;
  read_at: string | null;
  created_at: string;
}

interface AdminChat {
  id: string;
  bot_id: string;
  tg_chat_id: string;
  label: string | null;
}

const STATUS_LABELS: Record<Status, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Готово",
  archived: "Архив",
};

function InboxScreen() {
  const { slug } = Route.useParams();
  const [flowId, setFlowId] = useState<string | null>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [admins, setAdmins] = useState<AdminChat[]>([]);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdmins, setShowAdmins] = useState(false);

  const loadFlow = async () => {
    const isUuid = /^[0-9a-f-]{36}$/i.test(slug);
    const q = isUuid
      ? supabase.from("flows").select("id").eq("id", slug).maybeSingle()
      : supabase.from("flows").select("id").eq("slug", slug).maybeSingle();
    const { data, error } = await q;
    if (error || !data) {
      setError(error?.message ?? "Flow not found");
      setLoading(false);
      return null;
    }
    setFlowId(data.id);
    return data.id;
  };

  const loadAll = async (resolvedFlowId: string) => {
    setLoading(true);
    setError(null);
    const [{ data: bot }, { data: subs, error: subErr }] = await Promise.all([
      supabase.from("bots").select("id").eq("flow_id", resolvedFlowId).maybeSingle(),
      supabase
        .from("bot_submissions")
        .select("*")
        .eq("flow_id", resolvedFlowId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setBotId(bot?.id ?? null);
    if (subErr) setError(subErr.message);
    else setSubmissions((subs ?? []) as Submission[]);
    if (bot?.id) {
      const { data: adm } = await supabase
        .from("bot_admin_chats")
        .select("*")
        .eq("bot_id", bot.id)
        .order("created_at", { ascending: true });
      setAdmins((adm ?? []) as AdminChat[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const fid = await loadFlow();
      if (fid) await loadAll(fid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Realtime: listen for inserts/updates/deletes on bot_submissions for this flow.
  useEffect(() => {
    if (!flowId) return;
    const channel = supabase
      .channel(`submissions:${flowId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_submissions", filter: `flow_id=eq.${flowId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Submission;
            setSubmissions((cur) => (cur.some((s) => s.id === row.id) ? cur : [row, ...cur]));
            // Best-effort browser notification.
            try {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                new Notification("🆕 Новая заявка", {
                  body: row.tg_user_full_name || row.tg_username || row.tg_chat_id,
                });
              }
            } catch { /* ignore */ }
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Submission;
            setSubmissions((cur) => cur.map((s) => (s.id === row.id ? { ...s, ...row } : s)));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id: string };
            setSubmissions((cur) => cur.filter((s) => s.id !== row.id));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [flowId]);

  // Ask for browser-notification permission once.
  useEffect(() => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? submissions : submissions.filter((s) => s.status === filter)),
    [submissions, filter],
  );

  const updateStatus = async (id: string, status: Status) => {
    setSubmissions((cur) => cur.map((s) => (s.id === id ? { ...s, status } : s)));
    await supabase.from("bot_submissions").update({ status }).eq("id", id);
  };

  const markRead = async (id: string) => {
    const now = new Date().toISOString();
    setSubmissions((cur) => cur.map((s) => (s.id === id ? { ...s, read_at: now } : s)));
    await supabase.from("bot_submissions").update({ read_at: now }).eq("id", id);
  };

  const markAllRead = async () => {
    if (!flowId) return;
    const now = new Date().toISOString();
    const unreadIds = submissions.filter((s) => !s.read_at).map((s) => s.id);
    if (unreadIds.length === 0) return;
    setSubmissions((cur) => cur.map((s) => (s.read_at ? s : { ...s, read_at: now })));
    await supabase.from("bot_submissions").update({ read_at: now }).in("id", unreadIds);
  };

  const deleteSub = async (id: string) => {
    if (!confirm("Удалить заявку?")) return;
    setSubmissions((cur) => cur.filter((s) => s.id !== id));
    await supabase.from("bot_submissions").delete().eq("id", id);
  };

  const unreadCount = useMemo(() => submissions.filter((s) => !s.read_at).length, [submissions]);

  const counts = useMemo(() => {
    const c = { all: submissions.length, new: 0, in_progress: 0, done: 0, archived: 0 };
    for (const s of submissions) c[s.status]++;
    return c;
  }, [submissions]);


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b border-hairline px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/flows/$slug"
            params={{ slug }}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            К сценарию
          </Link>
          <div className="h-5 w-px bg-hairline" />
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <InboxIcon className="h-4 w-4" /> Входящие
            <span className="font-mono text-[11px] text-muted-foreground">{slug}</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {unreadCount} новых
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="hairline rounded-md bg-surface px-3 py-1.5 text-[12px] text-muted-foreground transition hover:text-foreground"
            >
              Прочитать все
            </button>
          )}
          <button
            onClick={() => setShowAdmins((v) => !v)}
            className="hairline rounded-md bg-surface px-3 py-1.5 text-[12px] text-muted-foreground transition hover:text-foreground"
          >
            Админы ({admins.length})
          </button>
          <button
            onClick={() => flowId && loadAll(flowId)}
            className="hairline flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-[12px] text-muted-foreground transition hover:text-foreground"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            Обновить
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {showAdmins && botId && (
          <AdminChatsPanel
            botId={botId}
            admins={admins}
            onChanged={() => flowId && loadAll(flowId)}
          />
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["all", "new", "in_progress", "done", "archived"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "hairline rounded-full px-3 py-1 text-[12px] font-medium transition",
                filter === s
                  ? "border-transparent bg-foreground text-background"
                  : "bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "Все" : STATUS_LABELS[s]} · {counts[s]}
            </button>
          ))}
        </div>

        {error && (
          <div className="hairline mb-4 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Загрузка…</div>
        ) : filtered.length === 0 ? (
          <div className="hairline rounded-lg bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
            <InboxIcon className="mx-auto mb-3 h-8 w-8 opacity-40" />
            Пока нет заявок. Добавь в сценарий ноду <b>«Сохранить заявку»</b>, и они начнут
            появляться здесь.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <SubmissionCard
                key={s.id}
                sub={s}
                botId={botId}
                onStatus={(st) => { updateStatus(s.id, st); if (!s.read_at) markRead(s.id); }}
                onRead={() => markRead(s.id)}
                onDelete={() => deleteSub(s.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SubmissionCard({
  sub,
  botId,
  onStatus,
  onRead,
  onDelete,
}: {
  sub: Submission;
  botId: string | null;
  onStatus: (s: Status) => void;
  onRead: () => void;
  onDelete: () => void;
}) {
  const unread = !sub.read_at;
  const entries = Object.entries(sub.payload).filter(([k]) => !k.startsWith("__"));
  const name =
    sub.tg_user_full_name ||
    (sub.tg_username ? `@${sub.tg_username}` : null) ||
    `tg:${sub.tg_user_id ?? sub.tg_chat_id}`;
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);

  const send = async () => {
    if (!botId) return;
    const t = replyText.trim();
    if (!t) return;
    setSending(true);
    setSendErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("bot-reply", {
        body: { bot_id: botId, chat_id: sub.tg_chat_id, text: t },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setReplyText("");
      setReplyOpen(false);
      setSentAt(Date.now());
    } catch (e: any) {
      setSendErr(e?.message ?? "Не удалось отправить");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={cn(
        "hairline rounded-lg bg-surface p-4 transition",
        unread && "ring-1 ring-primary/40 bg-primary/[0.04]",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {unread && (
            <span className="h-2 w-2 rounded-full bg-primary" title="Не прочитано" />
          )}
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {sub.kind}
          </span>
          <span className="text-sm font-medium">{name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {new Date(sub.created_at).toLocaleString("ru-RU")}
          </span>
          {unread && (
            <button
              onClick={onRead}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              отметить прочитанным
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setReplyOpen((v) => !v)}
            disabled={!botId}
            className="flex items-center gap-1 rounded-md bg-foreground/10 px-2 py-1 text-[11px] font-medium transition hover:bg-foreground/20 disabled:opacity-40"
            title="Ответить пользователю"
          >
            <Send className="h-3 w-3" /> Ответить
          </button>
          <select
            value={sub.status}
            onChange={(e) => onStatus(e.target.value as Status)}
            className="hairline rounded-md bg-background px-2 py-1 text-[11px]"
          >
            {(Object.keys(STATUS_LABELS) as Status[]).map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st]}
              </option>
            ))}
          </select>
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            title="Удалить"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="text-[12px] text-muted-foreground italic">Без дополнительных полей</div>
      ) : (
        <dl className="grid grid-cols-1 gap-1.5 text-[13px] sm:grid-cols-2">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">{k}:</dt>
              <dd className="break-words font-medium">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {replyOpen && (
        <div className="mt-3 border-t border-hairline pt-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            disabled={sending}
            rows={3}
            maxLength={4000}
            placeholder={`Сообщение для ${name}…`}
            className="hairline w-full rounded-md bg-background px-3 py-2 text-[13px]"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{replyText.length}/4000</span>
            <div className="flex items-center gap-2">
              {sendErr && <span className="text-[11px] text-destructive">{sendErr}</span>}
              <button
                onClick={() => { setReplyOpen(false); setReplyText(""); setSendErr(null); }}
                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
              >
                Отмена
              </button>
              <button
                onClick={send}
                disabled={sending || !replyText.trim()}
                className="flex items-center gap-1 rounded-md bg-foreground px-3 py-1 text-[11px] font-medium text-background transition hover:opacity-90 disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}
      {sentAt && !replyOpen && (
        <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">
          Ответ отправлен.
        </div>
      )}
    </div>
  );
}

function AdminChatsPanel({
  botId,
  admins,
  onChanged,
}: {
  botId: string;
  admins: AdminChat[];
  onChanged: () => void;
}) {
  const [chatId, setChatId] = useState("");
  const [label, setLabel] = useState("");

  const add = async () => {
    const cid = chatId.trim();
    if (!cid) return;
    const { error } = await supabase.from("bot_admin_chats").insert({
      bot_id: botId,
      tg_chat_id: cid,
      label: label.trim() || null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setChatId("");
    setLabel("");
    onChanged();
  };

  const remove = async (id: string) => {
    await supabase.from("bot_admin_chats").delete().eq("id", id);
    onChanged();
  };

  return (
    <div className="hairline mb-6 rounded-lg bg-surface p-4">
      <div className="mb-3 text-sm font-semibold">Чаты администраторов</div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Бот будет слать сюда уведомления о новых заявках. Чтобы узнать свой chat_id, напиши боту{" "}
        <a
          href="https://t.me/userinfobot"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          @userinfobot
        </a>
        .
      </p>
      <div className="mb-3 space-y-1.5">
        {admins.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-md bg-background/60 px-3 py-1.5 text-[13px]"
          >
            <div>
              <span className="font-mono">{a.tg_chat_id}</span>
              {a.label && <span className="ml-2 text-muted-foreground">— {a.label}</span>}
            </div>
            <button
              onClick={() => remove(a.id)}
              className="text-muted-foreground transition hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {admins.length === 0 && (
          <div className="text-[12px] italic text-muted-foreground">
            Пока никого. Добавь хотя бы один chat_id, иначе уведомления никуда не уйдут.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="chat_id (например 123456789)"
          className="hairline flex-1 rounded-md bg-background px-3 py-1.5 text-[13px]"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="подпись"
          className="hairline w-40 rounded-md bg-background px-3 py-1.5 text-[13px]"
        />
        <button
          onClick={add}
          className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background transition hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить
        </button>
      </div>
    </div>
  );
}
