import { Handle, Position, type NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { NODE_CATALOG, type NodeGroup } from "@/lib/anvl-catalog";
import type { NodeKind } from "@/lib/anvl-types";
import { useI18n } from "./I18nContext";
import { cn } from "@/lib/utils";

interface AnvlNodeData {
  kind: NodeKind;
  titleKey?: string;
  title?: string;
  previewKey?: string;
  preview?: string;
}

const GROUP_ACCENT: Record<NodeGroup, string> = {
  Triggers: "var(--accent-trigger)",
  Messages: "var(--accent-message)",
  Keyboards: "var(--accent-keyboard)",
  "Mini App": "var(--accent-miniapp)",
  Logic: "var(--accent-logic)",
};

export function ForgeNode({ data, selected }: NodeProps<AnvlNodeData>) {
  const meta = NODE_CATALOG[data.kind];
  const Icon = meta.icon;
  const isTrigger = meta.group === "Triggers";
  const { t } = useI18n();
  const accent = GROUP_ACCENT[meta.group];

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
      )}
      style={{
        boxShadow: selected
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

      {!isTrigger && (
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

      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5" />
    </motion.div>
  );
}
