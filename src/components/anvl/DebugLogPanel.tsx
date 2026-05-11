// DebugLogPanel — live viewer for bot_events of the current flow's bot.
//
// TODO(RLS): bot_events currently has public SELECT policy (bot_events_public_read).
// If the policy is tightened later, this panel will hit "permission denied" and
// fall back to the "Нет доступа к логам (RLS)" message. At that point a proper
// per-user policy keyed by bot ownership needs to be added via migration.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Copy, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { useSelection } from "./SelectionContext";
import { cn } from "@/lib/utils";

interface BotEventRow {
  id: number;
  event_type: string;
  node_id: string | null;
  payload: unknown;
  created_at: string;
}

const RLS_DENIED = "rls-denied" as const;

export function DebugLogPanel() {
  const { flowId } = useAnvlWorkspace();
  const { setSelectedId } = useSelection();
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  // Lookup bot by flow_id (same pattern as DeployButton).
  const { data: bot } = useQuery<{ id: string } | null>({
    queryKey: ["bot", flowId],
    enabled: !!flowId,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!flowId) return null;
      const { data, error } = await supabase
        .from("bots")
        .select("id")
        .eq("flow_id", flowId)
        .maybeSingle();
      if (error) throw error;
      return (data as { id: string } | null) ?? null;
    },
  });

  const { data: events, error } = useQuery<BotEventRow[] | typeof RLS_DENIED>({
    queryKey: ["bot-events", bot?.id],
    enabled: !!bot?.id,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_events")
        .select("id, event_type, node_id, payload, created_at")
        .eq("bot_id", bot!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        if (/permission denied|row-level security/i.test(error.message)) {
          return RLS_DENIED;
        }
        throw error;
      }
      return (data ?? []) as BotEventRow[];
    },
  });

  const rlsBlocked = events === RLS_DENIED;
  const rows: BotEventRow[] = Array.isArray(events) ? events : [];

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((e) => {
      const hay = `${e.event_type} ${e.node_id ?? ""} ${JSON.stringify(e.payload ?? "")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter]);

  if (!flowId) {
    return <EmptyState>Откройте флоу, чтобы видеть логи.</EmptyState>;
  }
  if (!bot) {
    return <EmptyState>Бот не задеплоен. Опубликуйте бота, чтобы видеть логи.</EmptyState>;
  }
  if (rlsBlocked) {
    return <EmptyState>Нет доступа к логам (RLS).</EmptyState>;
  }
  if (error && !rows.length) {
    return <EmptyState>Ошибка загрузки логов: {(error as Error).message}</EmptyState>;
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
      toast.success("Скопировано", { description: `${rows.length} событий в буфер` });
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="hairline flex-1 rounded-md bg-surface-elevated px-2 py-1 text-[11.5px] outline-none focus:border-foreground/30"
        />
        <button
          onClick={copyAll}
          title="Copy all events as JSON"
          className="hairline flex items-center gap-1 rounded-md bg-surface-elevated px-2 py-1 text-[10.5px] text-muted-foreground hover:text-foreground"
        >
          <Copy className="h-3 w-3" /> Copy
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            {rows.length === 0 ? "Пока нет событий. Напишите боту /start." : "Ничего не найдено по фильтру."}
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {filtered.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                open={openId === e.id}
                onToggle={() => setOpenId(openId === e.id ? null : e.id)}
                onSelectNode={(id) => setSelectedId(id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EventRow({
  event,
  open,
  onToggle,
  onSelectNode,
}: {
  event: BotEventRow;
  open: boolean;
  onToggle: () => void;
  onSelectNode: (id: string) => void;
}) {
  const time = useMemo(() => {
    const d = new Date(event.created_at);
    return d.toLocaleTimeString(undefined, { hour12: false });
  }, [event.created_at]);

  const color = colorForType(event.event_type);

  return (
    <li className="px-3 py-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        </button>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{time}</span>
        <span className={cn("truncate font-mono text-[11px]", color)}>{event.event_type}</span>
        {event.node_id && (
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              onSelectNode(event.node_id!);
            }}
            className="ml-auto truncate font-mono text-[10px] text-muted-foreground hover:text-foreground hover:underline"
            title="Select node on canvas"
          >
            {event.node_id}
          </button>
        )}
      </div>
      {open && (
        <pre className="mt-1 ml-6 max-h-60 overflow-auto rounded-md bg-surface px-2 py-1.5 font-mono text-[10px] leading-relaxed text-foreground/80">
{JSON.stringify(event.payload ?? null, null, 2)}
        </pre>
      )}
    </li>
  );
}

function colorForType(type: string): string {
  if (/error/i.test(type)) return "text-status-err";
  if (type === "message_received" || type === "message_sent") return "text-sky-500";
  if (type === "condition_evaluated" || type === "variable_set") return "text-violet-500";
  return "text-foreground/80";
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-8 text-center text-[12px] text-muted-foreground">
      {children}
    </div>
  );
}
