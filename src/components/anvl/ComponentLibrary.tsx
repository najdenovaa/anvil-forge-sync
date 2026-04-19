import { NODE_CATALOG, NODE_GROUPS } from "@/lib/anvl-catalog";
import type { NodeKind } from "@/lib/anvl-types";
import { Search } from "lucide-react";
import { useState } from "react";

export function ComponentLibrary() {
  const [q, setQ] = useState("");
  const all = Object.values(NODE_CATALOG);
  const filtered = q
    ? all.filter(
        (n) =>
          n.label.toLowerCase().includes(q.toLowerCase()) ||
          n.description.toLowerCase().includes(q.toLowerCase()),
      )
    : all;

  const onDragStart = (e: React.DragEvent, kind: NodeKind) => {
    e.dataTransfer.setData("application/anvl-node", kind);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-hairline bg-sidebar">
      <div className="border-b border-hairline px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Components
        </div>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-md border border-hairline bg-surface py-1.5 pl-8 pr-2 text-[13px] outline-none placeholder:text-muted-foreground focus:border-foreground/30"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {NODE_GROUPS.map((group) => {
          const items = filtered.filter((n) => n.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-4">
              <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {group}
              </div>
              <div className="space-y-1">
                {items.map((item) => (
                  <div
                    key={item.kind}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.kind)}
                    className="group flex cursor-grab items-center gap-2.5 rounded-md border border-transparent bg-transparent px-2 py-1.5 transition hover:border-hairline hover:bg-accent active:cursor-grabbing"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-hairline bg-surface-elevated text-foreground/80 transition group-hover:text-foreground">
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium leading-tight">
                        {item.label}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
