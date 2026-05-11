import { AlertCircle, AlertTriangle } from "lucide-react";
import type { LintIssue } from "@/lib/flow-linter";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { useSelection } from "./SelectionContext";
import { cn } from "@/lib/utils";

export function IssuesPanel() {
  const { lintIssues } = useAnvlWorkspace();
  const { setSelectedId } = useSelection();

  const errors = lintIssues.filter((i) => i.severity === "error");
  const warnings = lintIssues.filter((i) => i.severity === "warning");

  return (
    <div className="h-full overflow-y-auto px-3 py-3">
      <div className="mb-3 flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-[0.12em]">
        <span className={cn("flex items-center gap-1", errors.length > 0 ? "text-status-err" : "text-muted-foreground")}>
          <AlertCircle className="h-3.5 w-3.5" /> {errors.length} ошибок
        </span>
        <span className={cn("flex items-center gap-1", warnings.length > 0 ? "text-status-warn" : "text-muted-foreground")}>
          <AlertTriangle className="h-3.5 w-3.5" /> {warnings.length} предупреждений
        </span>
      </div>

      <div className="space-y-1.5">
        {errors.map((i) => (
          <IssueRow key={i.id} issue={i} onSelect={setSelectedId} />
        ))}
        {warnings.map((i) => (
          <IssueRow key={i.id} issue={i} onSelect={setSelectedId} />
        ))}
      </div>
    </div>
  );
}

function IssueRow({ issue, onSelect }: { issue: LintIssue; onSelect: (id: string | null) => void }) {
  const isErr = issue.severity === "error";
  const clickable = !!issue.nodeId;
  return (
    <button
      type="button"
      onClick={() => clickable && onSelect(issue.nodeId!)}
      disabled={!clickable}
      className={cn(
        "hairline w-full rounded-md bg-surface px-2.5 py-2 text-left transition",
        clickable && "hover:bg-accent cursor-pointer",
        !clickable && "cursor-default",
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-[2px] shrink-0", isErr ? "text-status-err" : "text-status-warn")}>
          {isErr ? <AlertCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] leading-snug text-foreground">{issue.message}</div>
          {issue.hint && (
            <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{issue.hint}</div>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground/70">
            <span className="font-mono">{issue.ruleCode}</span>
            {issue.nodeId && <span>· {issue.nodeId}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}
