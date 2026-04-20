import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { listFlowVersions, getFlowVersion } from "@/lib/anvl-flow-storage";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { cn } from "@/lib/utils";

export function VersionHistory() {
  const { flowId, snapshotNow, rollbackToVersion } = useAnvlWorkspace();
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["flow-versions", flowId],
    queryFn: () => (flowId ? listFlowVersions(flowId) : Promise.resolve([])),
    enabled: !!flowId && open,
    staleTime: 5_000,
  });

  const onRollback = async (versionId: string) => {
    setRestoring(versionId);
    try {
      const full = await getFlowVersion(versionId);
      if (full) {
        rollbackToVersion(full);
        // Save current state as a new snapshot too, so user can roll forward.
        await snapshotNow(`rolled back to v${full.version}`);
        qc.invalidateQueries({ queryKey: ["flow-versions", flowId] });
        setRestored(versionId);
        setTimeout(() => setRestored(null), 1500);
      }
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Version history"
          className="hairline flex h-7 items-center gap-1.5 rounded-full bg-surface px-2.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <History className="h-3 w-3" />
          History
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="hairline z-50 w-80 overflow-hidden rounded-xl bg-surface shadow-elegant"
        >
          <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">
              Versions
            </div>
            <button
              onClick={() => snapshotNow("manual")}
              className="rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background transition hover:bg-foreground/90"
            >
              Snapshot now
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-[11.5px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </div>
            ) : versions.length === 0 ? (
              <div className="px-3 py-6 text-center text-[11.5px] text-muted-foreground">
                No versions yet.
                <br />
                Auto-snapshots happen every 30s while editing.
              </div>
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {versions.map((v) => (
                    <motion.li
                      key={v.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group flex items-center justify-between gap-2 border-b border-hairline px-3 py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium">v{v.version}</div>
                        <div className="truncate text-[10.5px] text-muted-foreground">
                          {v.note ?? "auto-snapshot"} · {formatTime(v.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => onRollback(v.id)}
                        disabled={restoring !== null}
                        className={cn(
                          "flex h-6 items-center gap-1 rounded-md border border-hairline bg-surface-elevated px-2 text-[10.5px] font-medium text-foreground/80 transition hover:bg-accent",
                          restoring === v.id && "opacity-60",
                        )}
                      >
                        {restoring === v.id ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : restored === v.id ? (
                          <Check className="h-2.5 w-2.5 text-status-ok" />
                        ) : (
                          <RotateCcw className="h-2.5 w-2.5" />
                        )}
                        {restored === v.id ? "Restored" : "Restore"}
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}
