import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Trash2, Send, AppWindow, ArrowRight, Loader2 } from "lucide-react";
import { listFlows, deleteFlow, upsertFlow, type FlowSnapshot } from "@/lib/anvl-flow-storage";
import { cn } from "@/lib/utils";
import anvlLogo from "@/assets/anvl-logo.png";
import maxLogo from "@/assets/max-logo.png";

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `flow-${Date.now().toString(36)}`
  );
}

export function FlowsList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [newTitle, setNewTitle] = useState("");

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["anvl-flows-list"],
    queryFn: listFlows,
  });

  const createMut = useMutation({
    mutationFn: async (title: string) => {
      const slug = slugify(title);
      return upsertFlow({
        slug,
        title: title.trim() || "Untitled flow",
        platform: "telegram",
        miniappEnabled: false,
        nodes: [],
        edges: [],
        preview: {},
        miniapp: {},
        generatedCode: "",
      });
    },
    onSuccess: (snap) => {
      qc.invalidateQueries({ queryKey: ["anvl-flows-list"] });
      navigate({ to: "/flows/$slug", params: { slug: snap.slug } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFlow(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["anvl-flows-list"] }),
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="glass sticky top-0 z-10 flex h-14 items-center justify-between border-b border-hairline px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={anvlLogo} alt="ANVL" className="h-9 w-auto object-contain" />
        </Link>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Workspaces
        </div>
        <div className="w-9" />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-semibold tracking-tight">Your flows</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Each flow is a separate bot workspace with its own canvas, preview and version history.
          </p>
        </motion.div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTitle.trim() || createMut.isPending) return;
            createMut.mutate(newTitle);
            setNewTitle("");
          }}
          className="hairline mb-8 flex items-center gap-2 rounded-xl bg-surface p-2"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New flow title — e.g. Pizza delivery bot"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || createMut.isPending}
            className="flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-[13px] font-medium text-background transition hover:bg-foreground/90 disabled:opacity-50"
          >
            {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create
          </button>
        </form>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading flows…
          </div>
        ) : flows.length === 0 ? (
          <div className="hairline rounded-xl bg-surface px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No flows yet. Create your first one above.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {flows.map((f) => (
              <FlowCard
                key={f.id}
                flow={f}
                onDelete={() => {
                  if (confirm(`Delete flow "${f.title}"? This removes all versions.`)) {
                    deleteMut.mutate(f.id);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function FlowCard({ flow, onDelete }: { flow: FlowSnapshot; onDelete: () => void }) {
  const updated = new Date(flow.updatedAt);
  const ago = relativeTime(updated);
  const nodeCount = flow.nodes?.length ?? 0;

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="hairline group relative overflow-hidden rounded-xl bg-surface"
    >
      <Link
        to="/flows/$slug"
        params={{ slug: flow.slug }}
        className="block p-4"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <PlatformBadge platform={flow.platform} />
              {flow.miniappEnabled && (
                <span className="hairline flex items-center gap-1 rounded-full bg-surface-elevated px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-foreground/70">
                  <AppWindow className="h-2.5 w-2.5" />
                  Mini app
                </span>
              )}
            </div>
            <h3 className="mt-2 truncate text-[15px] font-semibold">{flow.title}</h3>
            <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
              /flows/{flow.slug}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {nodeCount} {nodeCount === 1 ? "node" : "nodes"} · v{flow.currentVersion}
          </span>
          <span suppressHydrationWarning>{ago}</span>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-status-err/10 hover:text-status-err group-hover:opacity-100"
        title="Delete flow"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const isMax = platform === "max";
  return (
    <span
      className={cn(
        "hairline flex items-center gap-1 rounded-full bg-surface-elevated px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-foreground/70",
      )}
    >
      {isMax ? (
        <img src={maxLogo} alt="Max" className="h-2.5 w-2.5 object-contain" />
      ) : (
        <Send className="h-2.5 w-2.5" />
      )}
      {isMax ? "Max" : "Telegram"}
    </span>
  );
}

function relativeTime(d: Date): string {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
