import { Handle, Position, type NodeProps } from "reactflow";
import { NODE_CATALOG } from "@/lib/anvl-catalog";
import type { NodeKind } from "@/lib/anvl-types";
import { cn } from "@/lib/utils";

interface AnvlNodeData {
  kind: NodeKind;
  title?: string;
  preview?: string;
}

export function ForgeNode({ data, selected }: NodeProps<AnvlNodeData>) {
  const meta = NODE_CATALOG[data.kind];
  const Icon = meta.icon;
  const isTrigger = meta.group === "Triggers";

  return (
    <div
      className={cn(
        "min-w-[210px] rounded-xl border bg-surface text-foreground transition",
        selected
          ? "border-foreground/40 shadow-[0_0_0_2px_oklch(1_0_0_/_8%)]"
          : "border-hairline shadow-elevated",
      )}
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5"
        />
      )}
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-hairline bg-surface-elevated">
          <Icon className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium leading-tight">
            {data.title ?? meta.label}
          </div>
          <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {meta.group}
          </div>
        </div>
      </div>
      <div className="px-3 py-2.5 text-[12px] text-muted-foreground">
        {data.preview ?? meta.description}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5"
      />
    </div>
  );
}
