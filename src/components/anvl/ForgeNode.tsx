import { Handle, Position, type NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { NODE_CATALOG, type NodeGroup } from "@/lib/anvl-catalog";
import type { NodeKind } from "@/lib/anvl-types";
import { useI18n } from "./I18nContext";
import { useBotSimulator } from "./BotSimulatorContext";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { cn } from "@/lib/utils";

interface AnvlNodeData {
  kind: NodeKind;
  titleKey?: string;
  title?: string;
  previewKey?: string;
  preview?: string;
  params?: Record<string, string>;
}

/** What param keys to surface on the node card, by kind. */
const PARAM_PREVIEW: Partial<Record<NodeKind, { key: string; prefix?: string }[]>> = {
  "trigger.command":  [{ key: "command" }],
  "trigger.message":  [{ key: "match", prefix: "~" }],
  "trigger.callback": [{ key: "data", prefix: "cb:" }],
  "message.text":     [{ key: "text" }],
  "message.photo":    [{ key: "url" }, { key: "caption" }],
  "message.document": [{ key: "filename" }, { key: "url" }],
  "keyboard.inline":  [{ key: "buttons" }],
  "keyboard.reply":   [{ key: "buttons" }],
  "miniapp.screen":   [{ key: "screenId", prefix: "#" }, { key: "url" }],
  "logic.condition":  [{ key: "condition", prefix: "if " }, { key: "expression", prefix: "if " }],
  "action.api":       [{ key: "method" }, { key: "url" }],
  "action.set_var":   [{ key: "variable", prefix: "var." }, { key: "value" }],
  "action.input":     [{ key: "variable", prefix: "→ var." }, { key: "prompt" }],
};

function clip(s: string, n = 36): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? oneLine.slice(0, n - 1) + "…" : oneLine;
}

const GROUP_ACCENT: Record<NodeGroup, string> = {
  Triggers: "var(--accent-trigger)",
  Messages: "var(--accent-message)",
  Keyboards: "var(--accent-keyboard)",
  "Mini App": "var(--accent-miniapp)",
  Logic: "var(--accent-logic)",
  CRM: "var(--accent-crm, oklch(0.78 0.15 30))",
};

export function ForgeNode({ id, data, selected }: NodeProps<AnvlNodeData>) {
  const meta = NODE_CATALOG[data.kind];
  const Icon = meta.icon;
  const isTrigger = meta.group === "Triggers";
  const canReceiveIncoming = data.kind === "trigger.webapp_data";
  const { t } = useI18n();
  const { activeNodeId } = useBotSimulator();
  const { lintIssues } = useAnvlWorkspace();
  const isActive = activeNodeId === id;
  const accent = GROUP_ACCENT[meta.group];
  const nodeIssues = lintIssues.filter((i) => i.nodeId === id);
  const nodeErrors = nodeIssues.filter((i) => i.severity === "error");
  const nodeWarns = nodeIssues.filter((i) => i.severity === "warning");
  const issueColor = nodeErrors.length > 0
    ? "var(--status-err, #ef4444)"
    : nodeWarns.length > 0 ? "var(--status-warn, #eab308)" : null;
  const firstIssue = nodeErrors[0] ?? nodeWarns[0];

  const title = data.titleKey ? t(data.titleKey) : (data.title ?? t(meta.labelKey));
  const preview = data.previewKey ? t(data.previewKey) : (data.preview ?? t(meta.descKey));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.6 }}
      whileHover={{ y: -1 }}
      className={cn(
        "group relative min-w-[220px] overflow-hidden rounded-2xl text-foreground transition-shadow",
        "glass",
        isActive && "sim-active",
      )}
      style={{
        boxShadow: isActive
          ? undefined
          : selected
            ? "var(--shadow-node-selected)"
            : "var(--shadow-node)",
        borderColor: selected ? "oklch(1 0 0 / 24%)" : undefined,
      }}
    >
      {/* Top accent bar */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] opacity-80"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />

      {issueColor && (
        <div
          className="absolute right-1.5 top-1.5 z-10 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white shadow"
          style={{ background: issueColor }}
          title={firstIssue?.message}
        >
          {nodeIssues.length > 1 ? nodeIssues.length : ""}
        </div>
      )}

      {(!isTrigger || canReceiveIncoming) && (
        <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5" />
      )}

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="node-halo flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-elevated"
          style={{ ["--node-accent" as string]: accent, color: accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold leading-tight tracking-tight">
            {title}
          </div>
          <div
            className="text-[9.5px] font-medium uppercase tracking-[0.14em]"
            style={{ color: accent, opacity: 0.85 }}
          >
            {t(`group.${meta.group}`)}
          </div>
        </div>
      </div>

      <div className="border-t border-hairline px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        {preview}
      </div>

      {(() => {
        const schema = PARAM_PREVIEW[data.kind];
        if (!schema || !data.params) return null;
        const chips = schema
          .map((s) => {
            const v = data.params?.[s.key];
            if (!v || !v.trim()) return null;
            return { key: s.key, label: clip((s.prefix ?? "") + v) };
          })
          .filter(Boolean) as { key: string; label: string }[];
        if (chips.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1 border-t border-hairline px-3 py-2">
            {chips.map((c) => (
              <span
                key={c.key}
                className="hairline rounded-md bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] leading-none text-foreground/75"
                title={data.params?.[c.key]}
              >
                {c.label}
              </span>
            ))}
          </div>
        );
      })()}

      {data.kind === "logic.condition" ? (
        <>
          <Handle
            type="source"
            id="true"
            position={Position.Right}
            className="!h-2.5 !w-2.5"
            style={{ top: "35%", background: "var(--status-ok, #22c55e)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 text-[9px] font-bold tracking-wider text-status-ok"
            style={{ top: "calc(35% - 14px)", color: "var(--status-ok, #22c55e)" }}
          >
            YES
          </span>
          <Handle
            type="source"
            id="false"
            position={Position.Right}
            className="!h-2.5 !w-2.5"
            style={{ top: "70%", background: "var(--status-err, #ef4444)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 text-[9px] font-bold tracking-wider"
            style={{ top: "calc(70% + 4px)", color: "var(--status-err, #ef4444)" }}
          >
            NO
          </span>
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5" />
      )}
    </motion.div>
  );
}
