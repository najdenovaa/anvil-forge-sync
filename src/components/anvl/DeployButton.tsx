import { useMemo, useState } from "react";
import { Rocket, ExternalLink, Copy, RotateCw, Pause, Play, Trash2, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "./I18nContext";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { DeployDialog } from "./DeployDialog";

interface BotRow {
  id: string;
  flow_id: string;
  platform: string;
  bot_username: string | null;
  status: "draft" | "active" | "paused" | "error" | string;
  webhook_secret: string;
  last_error: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export function DeployButton() {
  const { t } = useI18n();
  const { flowId, lintIssues } = useAnvlWorkspace();
  const lintErrors = lintIssues.filter((i) => i.severity === "error");
  const blocked = lintErrors.length > 0;
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [acting, setActing] = useState<null | "pause" | "resume" | "delete">(null);

  const { data: bot } = useQuery<BotRow | null>({
    queryKey: ["bot", flowId],
    enabled: !!flowId,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!flowId) return null;
      const { data, error } = await supabase
        .from("bots")
        .select("id, flow_id, platform, bot_username, status, webhook_secret, last_error")
        .eq("flow_id", flowId)
        .maybeSingle();
      if (error) throw error;
      return (data as BotRow | null) ?? null;
    },
  });

  const todayIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: messagesToday = 0 } = useQuery<number>({
    queryKey: ["bot-events-today", bot?.id, todayIso],
    enabled: !!bot?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("bot_events")
        .select("*", { count: "exact", head: true })
        .eq("bot_id", bot!.id)
        .eq("event_type", "message_received")
        .gte("created_at", todayIso);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const status: "not_deployed" | "active" | "paused" | "error" =
    !bot ? "not_deployed" : (bot.status as any);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["bot", flowId] });
    qc.invalidateQueries({ queryKey: ["bot-events-today"] });
  }

  async function callUndeploy(opts: { delete?: boolean }) {
    if (!bot) return;
    const { data, error } = await supabase.functions.invoke("undeploy-bot", {
      body: { bot_id: bot.id, delete: !!opts.delete },
    });
    if (error || data?.error) {
      toast.error(t("deploy.error.server"));
      return false;
    }
    return true;
  }

  async function handlePauseToggle() {
    if (!bot) return;
    if (bot.status === "active") {
      setActing("pause");
      const ok = await callUndeploy({ delete: false });
      setActing(null);
      if (ok) refresh();
    } else {
      // Resume = re-issue webhook → DeployDialog (user must enter token again,
      // since we never store the raw token unencrypted on the client).
      setDialogOpen(true);
    }
  }

  async function handleDelete() {
    setActing("delete");
    const ok = await callUndeploy({ delete: true });
    setActing(null);
    setConfirmDelete(false);
    if (ok) {
      refresh();
      toast.success(t("deploy.success.done"));
    }
  }

  function copyWebhook() {
    if (!bot || !SUPABASE_URL) return;
    const url = `${SUPABASE_URL}/functions/v1/bot-runtime/tg/${bot.id}?secret=${bot.webhook_secret}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(t("bot.popover.copied")),
      () => toast.error(t("deploy.error.network")),
    );
  }

  // ---------- Trigger button ----------
  const trigger = (() => {
    if (status === "not_deployed") {
      return (
        <button
          onClick={() => !blocked && setDialogOpen(true)}
          disabled={blocked}
          title={blocked ? `Во флоу ${lintErrors.length} ошибок — посмотрите правую панель` : undefined}
          className="group flex items-center gap-2 rounded-md bg-foreground px-3.5 py-1.5 text-[13px] font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Rocket className="h-3.5 w-3.5" />
          {t("topbar.deploy")}
        </button>
      );
    }
    const live = status === "active";
    return (
      <button
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium transition",
          live
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
            : "border-hairline bg-surface text-muted-foreground hover:text-foreground",
        )}
      >
        <span className="relative flex h-2 w-2">
          {live && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          )}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              live ? "bg-emerald-500" : "bg-muted-foreground/60",
            )}
          />
        </span>
        <span className="font-mono">
          {bot?.bot_username ? `@${bot.bot_username}` : "bot"}
        </span>
        <span className="opacity-60">·</span>
        <span>{live ? t("topbar.deploy.live") : t("topbar.deploy.paused")}</span>
      </button>
    );
  })();

  return (
    <>
      {status === "not_deployed" ? (
        trigger
      ) : (
        <Popover>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="border-b border-hairline p-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    status === "active" ? "bg-emerald-500" : "bg-muted-foreground/60",
                  )}
                />
                <div className="font-mono text-sm font-semibold">
                  {bot?.bot_username ? `@${bot.bot_username}` : "bot"}
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {status === "active" ? t("bot.popover.live") : t("bot.popover.paused")} ·{" "}
                {t("bot.popover.messages_today", { n: messagesToday })}
              </div>
              {bot?.last_error && (
                <div className="mt-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
                  {bot.last_error}
                </div>
              )}
            </div>
            <div className="flex flex-col py-1 text-sm">
              {bot?.bot_username && (
                <a
                  href={`https://t.me/${bot.bot_username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2 hover:bg-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("bot.popover.open_telegram")}
                </a>
              )}
              <button
                onClick={copyWebhook}
                className="flex items-center gap-2 px-3 py-2 text-left hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                {t("bot.popover.copy_webhook")}
              </button>
              <button
                onClick={() => setDialogOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-left hover:bg-accent"
              >
                <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                {t("bot.popover.reissue")}
              </button>
              <button
                onClick={handlePauseToggle}
                disabled={acting === "pause"}
                className="flex items-center gap-2 px-3 py-2 text-left hover:bg-accent disabled:opacity-50"
              >
                {acting === "pause" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : status === "active" ? (
                  <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {status === "active" ? t("bot.popover.pause") : t("bot.popover.resume")}
              </button>
              <div className="my-1 h-px bg-hairline" />
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-3 py-2 text-left text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("bot.popover.delete")}
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      <DeployDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        flowId={flowId}
        existingBotUsername={bot?.bot_username ?? null}
        onDeployed={refresh}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bot.popover.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bot.popover.delete.confirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deploy.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {acting === "delete" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("bot.popover.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
