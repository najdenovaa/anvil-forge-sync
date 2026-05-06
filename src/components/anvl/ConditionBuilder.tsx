import { Plus, X, FolderPlus } from "lucide-react";
import type { Node } from "reactflow";
import type {
  Condition,
  ConditionGroup,
  ConditionLeaf,
  CompareOp,
  ConditionSource,
} from "@/lib/condition-eval-shared";
import type { VariableDef } from "@/lib/anvl-types";
import { cn } from "@/lib/utils";

interface Props {
  value: Condition;
  onChange: (c: Condition) => void;
  trueBranch?: string;
  falseBranch?: string;
  onTrueBranchChange: (v: string) => void;
  onFalseBranchChange: (v: string) => void;
  availableVars: VariableDef[];
  availableNodes: Node[];
  selfNodeId: string;
}

const USER_FIELDS = ["first_name", "last_name", "username", "language_code", "id"];
const SYSTEM_FIELDS = ["now", "today", "bot_username"];

const OPS_BY_TYPE: Record<string, { value: CompareOp; label: string }[]> = {
  string: [
    { value: "eq", label: "equals" },
    { value: "neq", label: "not equals" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "not contains" },
    { value: "starts_with", label: "starts with" },
    { value: "ends_with", label: "ends with" },
    { value: "matches_regex", label: "matches regex" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  number: [
    { value: "eq", label: "=" },
    { value: "neq", label: "≠" },
    { value: "gt", label: ">" },
    { value: "lt", label: "<" },
    { value: "gte", label: "≥" },
    { value: "lte", label: "≤" },
  ],
  boolean: [
    { value: "is_true", label: "is true" },
    { value: "is_false", label: "is false" },
    { value: "eq", label: "equals" },
  ],
  json: [
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
};

function inferType(left: ConditionLeaf["left"], vars: VariableDef[]): string {
  if (left.source === "var") {
    const v = vars.find((vv) => vv.key === left.key);
    return v?.type ?? "string";
  }
  return "string";
}

function newLeaf(): ConditionLeaf {
  return {
    kind: "leaf",
    left: { source: "var", key: "" },
    operator: "eq",
    right: { kind: "literal", value: "" },
  };
}

function newGroup(): ConditionGroup {
  return { kind: "group", combinator: "AND", children: [newLeaf()] };
}

export function ConditionBuilder({
  value,
  onChange,
  trueBranch,
  falseBranch,
  onTrueBranchChange,
  onFalseBranchChange,
  availableVars,
  availableNodes,
  selfNodeId,
}: Props) {
  // Always normalize root to a group.
  const root: ConditionGroup =
    value.kind === "group" ? value : { kind: "group", combinator: "AND", children: [value] };

  const update = (next: ConditionGroup) => onChange(next);

  return (
    <div className="space-y-3">
      <Section label="IF">
        <GroupEditor
          group={root}
          onChange={update}
          onRemove={() => onChange({ kind: "group", combinator: "AND", children: [] })}
          isRoot
          vars={availableVars}
        />
      </Section>

      <Section label="THEN go to">
        <NodePicker
          value={trueBranch ?? ""}
          onChange={onTrueBranchChange}
          nodes={availableNodes}
          excludeId={selfNodeId}
          accent="ok"
        />
      </Section>

      <Section label="ELSE go to">
        <NodePicker
          value={falseBranch ?? ""}
          onChange={onFalseBranchChange}
          nodes={availableNodes}
          excludeId={selfNodeId}
          accent="err"
        />
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hairline rounded-lg bg-surface px-2.5 py-2">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function GroupEditor({
  group,
  onChange,
  onRemove,
  isRoot,
  vars,
}: {
  group: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
  onRemove?: () => void;
  isRoot?: boolean;
  vars: VariableDef[];
}) {
  const setChildren = (children: Condition[]) => onChange({ ...group, children });
  const toggleCombinator = () =>
    onChange({ ...group, combinator: group.combinator === "AND" ? "OR" : "AND" });

  return (
    <div className={cn("space-y-1.5", !isRoot && "rounded-md border border-hairline bg-surface-elevated p-2")}>
      {!isRoot && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">group</span>
          {onRemove && (
            <button onClick={onRemove} className="text-muted-foreground hover:text-status-err">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {group.children.map((child, i) => (
        <div key={i}>
          {i > 0 && (
            <button
              onClick={toggleCombinator}
              className="my-1 block w-full rounded text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
            >
              ── {group.combinator} ──
            </button>
          )}
          {child.kind === "leaf" ? (
            <LeafEditor
              leaf={child}
              vars={vars}
              onChange={(c) => setChildren(group.children.map((x, j) => (i === j ? c : x)))}
              onRemove={() => setChildren(group.children.filter((_, j) => j !== i))}
            />
          ) : (
            <GroupEditor
              group={child}
              vars={vars}
              onChange={(c) => setChildren(group.children.map((x, j) => (i === j ? c : x)))}
              onRemove={() => setChildren(group.children.filter((_, j) => j !== i))}
            />
          )}
        </div>
      ))}

      <div className="flex gap-1.5 pt-1">
        <button
          onClick={() => setChildren([...group.children, newLeaf()])}
          className="hairline flex items-center gap-1 rounded-md bg-surface-elevated px-2 py-1 text-[10.5px] hover:bg-accent"
        >
          <Plus className="h-3 w-3" /> Condition
        </button>
        <button
          onClick={() => setChildren([...group.children, newGroup()])}
          className="hairline flex items-center gap-1 rounded-md bg-surface-elevated px-2 py-1 text-[10.5px] hover:bg-accent"
        >
          <FolderPlus className="h-3 w-3" /> Group
        </button>
      </div>
    </div>
  );
}

function LeafEditor({
  leaf,
  vars,
  onChange,
  onRemove,
}: {
  leaf: ConditionLeaf;
  vars: VariableDef[];
  onChange: (l: ConditionLeaf) => void;
  onRemove: () => void;
}) {
  const type = inferType(leaf.left, vars);
  const ops = OPS_BY_TYPE[type] ?? OPS_BY_TYPE.string;
  const noRightValue =
    leaf.operator === "is_empty" ||
    leaf.operator === "is_not_empty" ||
    leaf.operator === "is_true" ||
    leaf.operator === "is_false";

  const setLeft = (patch: Partial<ConditionLeaf["left"]>) =>
    onChange({ ...leaf, left: { ...leaf.left, ...patch } });

  return (
    <div className="hairline space-y-1 rounded-md bg-surface-elevated p-1.5">
      <div className="flex items-center gap-1">
        <select
          value={leaf.left.source}
          onChange={(e) => setLeft({ source: e.target.value as ConditionSource, key: "" })}
          className="hairline rounded bg-surface px-1.5 py-1 text-[11px]"
        >
          <option value="var">Variable</option>
          <option value="user">User field</option>
          <option value="system">System</option>
          <option value="text">Last message</option>
        </select>

        {leaf.left.source === "var" && (
          <select
            value={leaf.left.key ?? ""}
            onChange={(e) => setLeft({ key: e.target.value })}
            className="hairline flex-1 rounded bg-surface px-1.5 py-1 text-[11px]"
          >
            <option value="">— pick var —</option>
            {vars.map((v) => (
              <option key={v.key} value={v.key}>
                {v.key} ({v.type})
              </option>
            ))}
          </select>
        )}
        {leaf.left.source === "user" && (
          <select
            value={leaf.left.key ?? ""}
            onChange={(e) => setLeft({ key: e.target.value })}
            className="hairline flex-1 rounded bg-surface px-1.5 py-1 text-[11px]"
          >
            <option value="">—</option>
            {USER_FIELDS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}
        {leaf.left.source === "system" && (
          <select
            value={leaf.left.key ?? ""}
            onChange={(e) => setLeft({ key: e.target.value })}
            className="hairline flex-1 rounded bg-surface px-1.5 py-1 text-[11px]"
          >
            <option value="">—</option>
            {SYSTEM_FIELDS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        )}

        <button
          onClick={onRemove}
          className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-status-err/10 hover:text-status-err"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <select
          value={leaf.operator}
          onChange={(e) => onChange({ ...leaf, operator: e.target.value as CompareOp })}
          className="hairline rounded bg-surface px-1.5 py-1 text-[11px]"
        >
          {ops.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {!noRightValue && (
          <>
            <select
              value={leaf.right.kind}
              onChange={(e) => {
                const k = e.target.value as "literal" | "variable";
                onChange({
                  ...leaf,
                  right: k === "literal" ? { kind: "literal", value: "" } : { kind: "variable", key: "" },
                });
              }}
              className="hairline rounded bg-surface px-1 py-1 text-[10px]"
              title="Right side type"
            >
              <option value="literal">abc</option>
              <option value="variable">var</option>
            </select>

            {leaf.right.kind === "literal" ? (
              <input
                type="text"
                value={leaf.right.value}
                onChange={(e) => onChange({ ...leaf, right: { kind: "literal", value: e.target.value } })}
                placeholder="value"
                className="hairline flex-1 rounded bg-surface px-1.5 py-1 text-[11px]"
              />
            ) : (
              <select
                value={leaf.right.key}
                onChange={(e) => onChange({ ...leaf, right: { kind: "variable", key: e.target.value } })}
                className="hairline flex-1 rounded bg-surface px-1.5 py-1 text-[11px]"
              >
                <option value="">— pick var —</option>
                {vars.map((v) => (
                  <option key={v.key} value={v.key}>{v.key}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NodePicker({
  value,
  onChange,
  nodes,
  excludeId,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  nodes: Node[];
  excludeId: string;
  accent: "ok" | "err";
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "hairline w-full rounded bg-surface-elevated px-2 py-1.5 text-[11.5px]",
        accent === "ok" ? "border-l-2 border-l-status-ok" : "border-l-2 border-l-status-err",
      )}
    >
      <option value="">— select node —</option>
      {nodes
        .filter((n) => n.id !== excludeId)
        .map((n) => {
          const title = (n.data?.title as string) ?? (n.data?.kind as string) ?? n.id;
          const kind = (n.data?.kind as string) ?? "?";
          return (
            <option key={n.id} value={n.id}>
              {n.id}: {title} ({kind})
            </option>
          );
        })}
    </select>
  );
}
