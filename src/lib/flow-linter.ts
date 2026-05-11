import type { Node, Edge } from "reactflow";
import type { VariableDef, NodeKind } from "./anvl-types";
import { tryParseCondition, type Condition } from "./condition-eval-shared";

export type LintSeverity = "error" | "warning";

export interface LintIssue {
  id: string;
  severity: LintSeverity;
  ruleCode: string;
  nodeId?: string;
  message: string;
  hint?: string;
}

/** Mirrors NodeInspector.TEMPLATE_FIELDS — keep in sync. */
export const TEMPLATE_FIELDS: Partial<Record<NodeKind, string[]>> = {
  "message.text": ["text"],
  "message.photo": ["caption"],
  "action.set_var": ["value"],
  "action.input": ["prompt"],
  "action.api": ["url", "body"],
};

const PLACEHOLDER_RE = /\{var\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

function collectVarsFromCondition(c: Condition, used: Set<string>): void {
  if (c.kind === "leaf") {
    if (c.left.source === "var" && c.left.key) used.add(c.left.key);
    if (c.right.kind === "variable" && c.right.key) used.add(c.right.key);
    return;
  }
  for (const child of c.children ?? []) collectVarsFromCondition(child, used);
}

function walkConditionLeaves(c: Condition, fn: (leaf: Extract<Condition, { kind: "leaf" }>) => void): void {
  if (c.kind === "leaf") { fn(c); return; }
  for (const child of c.children ?? []) walkConditionLeaves(child, fn);
}

export function lintFlow(
  nodes: Node[],
  edges: Edge[],
  variables: VariableDef[],
): LintIssue[] {
  try {
    const issues: LintIssue[] = [];
    const varKeys = new Set(variables.map((v) => v.key));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const usedVars = new Set<string>();

    // Index incoming/outgoing edges
    const outBy = new Map<string, Edge[]>();
    const inBy = new Map<string, Edge[]>();
    for (const e of edges) {
      if (!outBy.has(e.source)) outBy.set(e.source, []);
      outBy.get(e.source)!.push(e);
      if (!inBy.has(e.target)) inBy.set(e.target, []);
      inBy.get(e.target)!.push(e);
    }

    for (const n of nodes) {
      const kind = (n.data?.kind as NodeKind | undefined) ?? "message.text";
      const params: Record<string, string> = (n.data?.params as Record<string, string>) ?? {};

      // ---- B1: template placeholders ----
      const tplKeys = TEMPLATE_FIELDS[kind];
      if (tplKeys) {
        for (const k of tplKeys) {
          const val = params[k];
          if (!val) continue;
          PLACEHOLDER_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          const seen = new Set<string>();
          while ((m = PLACEHOLDER_RE.exec(val)) !== null) {
            const key = m[1];
            usedVars.add(key);
            if (seen.has(key)) continue;
            seen.add(key);
            if (!varKeys.has(key)) {
              issues.push({
                id: `var-unknown-placeholder:${n.id}:${k}:${key}`,
                severity: "error",
                ruleCode: "var-unknown-placeholder",
                nodeId: n.id,
                message: `Плейсхолдер {var.${key}} ссылается на несуществующую переменную`,
                hint: `Объявите ${key} во вкладке Variables`,
              });
            }
          }
        }
      }

      // ---- B2: action.set_var / action.input variable target ----
      if (kind === "action.set_var" || kind === "action.input") {
        const v = (params.variable ?? "").trim();
        if (v) {
          usedVars.add(v);
          if (!varKeys.has(v)) {
            issues.push({
              id: `var-not-declared:${n.id}`,
              severity: "warning",
              ruleCode: "var-not-declared",
              nodeId: n.id,
              message: `Переменная ${v} не объявлена`,
              hint: "Бот создаст её на лету, но лучше добавить во вкладку Variables",
            });
          }
        }
      }

      // ---- A. logic.condition ----
      if (kind === "logic.condition") {
        const rawCond = params.condition;
        const expr = (params.expression ?? "").trim();
        const parsed = tryParseCondition(rawCond);

        if (!parsed) {
          if (rawCond && rawCond.trim()) {
            issues.push({
              id: `condition-invalid-json:${n.id}`,
              severity: "error",
              ruleCode: "condition-invalid-json",
              nodeId: n.id,
              message: "Условие повреждено (невалидный JSON)",
              hint: "Откройте инспектор и пересоберите условие",
            });
          } else if (!expr) {
            issues.push({
              id: `condition-empty:${n.id}`,
              severity: "error",
              ruleCode: "condition-empty",
              nodeId: n.id,
              message: "Условие не сконфигурировано",
              hint: "Соберите условие через визуальный билдер",
            });
          }
        } else {
          // A3 / A4: walk leaves
          walkConditionLeaves(parsed, (leaf) => {
            if (leaf.left.source === "var") {
              const k = leaf.left.key ?? "";
              if (!k) {
                issues.push({
                  id: `condition-empty-leaf-var:${n.id}`,
                  severity: "error",
                  ruleCode: "condition-empty-leaf-var",
                  nodeId: n.id,
                  message: "В условии не выбрана переменная слева",
                });
              } else {
                usedVars.add(k);
                if (!varKeys.has(k)) {
                  issues.push({
                    id: `condition-unknown-var:${n.id}:${k}`,
                    severity: "error",
                    ruleCode: "condition-unknown-var",
                    nodeId: n.id,
                    message: `В условии используется неизвестная переменная ${k}`,
                    hint: `Объявите ${k} во вкладке Variables`,
                  });
                }
              }
            }
            if (leaf.right.kind === "variable") {
              const k = leaf.right.key;
              if (k) {
                usedVars.add(k);
                if (!varKeys.has(k)) {
                  issues.push({
                    id: `condition-unknown-rhs-var:${n.id}:${k}`,
                    severity: "error",
                    ruleCode: "condition-unknown-rhs-var",
                    nodeId: n.id,
                    message: `Правая часть условия ссылается на неизвестную переменную ${k}`,
                    hint: `Объявите ${k} во вкладке Variables`,
                  });
                }
              }
            }
          });
          collectVarsFromCondition(parsed, usedVars);
        }

        // A7: legacy expression
        if (expr && !rawCond) {
          issues.push({
            id: `condition-legacy-expression:${n.id}`,
            severity: "warning",
            ruleCode: "condition-legacy-expression",
            nodeId: n.id,
            message: "Используется legacy expression",
            hint: "Соберите условие через визуальный билдер",
          });
        }

        // A5/A6: branches
        const outs = outBy.get(n.id) ?? [];
        const hasTrueEdge = outs.some((e) => e.sourceHandle === "true");
        const hasFalseEdge = outs.some((e) => e.sourceHandle === "false");
        const trueBranch = (params.trueBranch ?? "").trim();
        const falseBranch = (params.falseBranch ?? "").trim();

        if (!hasTrueEdge && !(trueBranch && nodeIds.has(trueBranch))) {
          issues.push({
            id: `condition-no-true-branch:${n.id}`,
            severity: "error",
            ruleCode: "condition-no-true-branch",
            nodeId: n.id,
            message: "Нет YES-ветки",
            hint: "Перетащите стрелку с зелёного хэндла YES",
          });
        }
        if (!hasFalseEdge && !(falseBranch && nodeIds.has(falseBranch))) {
          issues.push({
            id: `condition-no-false-branch:${n.id}`,
            severity: "error",
            ruleCode: "condition-no-false-branch",
            nodeId: n.id,
            message: "Нет NO-ветки",
            hint: "Перетащите стрелку с красного хэндла NO",
          });
        }
      }

      // ---- C. Topology ----
      const isTrigger = kind.startsWith("trigger.");
      if (!isTrigger) {
        const ins = inBy.get(n.id) ?? [];
        if (ins.length === 0) {
          issues.push({
            id: `node-orphan:${n.id}`,
            severity: "error",
            ruleCode: "node-orphan",
            nodeId: n.id,
            message: "Нода не подключена ко флоу",
            hint: "Подключите к этой ноде стрелку из триггера или другой ноды",
          });
        }
      }

      if (kind === "action.input") {
        const outs = outBy.get(n.id) ?? [];
        if (outs.length === 0) {
          issues.push({
            id: `input-no-next:${n.id}`,
            severity: "error",
            ruleCode: "input-no-next",
            nodeId: n.id,
            message: "После ввода нет следующей ноды",
            hint: "Подключите стрелку к следующему шагу",
          });
        } else if (outs.length > 1) {
          issues.push({
            id: `input-bad-fanout:${n.id}`,
            severity: "error",
            ruleCode: "input-bad-fanout",
            nodeId: n.id,
            message: "У ноды ввода не должно быть нескольких выходов",
            hint: "Удалите лишние стрелки — input не ветвится",
          });
        }
      }

      if (kind === "action.api") {
        const outs = outBy.get(n.id) ?? [];
        if (outs.length === 0) {
          issues.push({
            id: `api-no-next:${n.id}`,
            severity: "error",
            ruleCode: "api-no-next",
            nodeId: n.id,
            message: "action.api не финальная — нет следующей ноды",
            hint: "Добавьте следующую ноду после API-вызова",
          });
        }
      }
    }

    // ---- B3: unused variables ----
    for (const v of variables) {
      if (!usedVars.has(v.key)) {
        issues.push({
          id: `var-unused:${v.key}`,
          severity: "warning",
          ruleCode: "var-unused",
          message: `Переменная ${v.key} объявлена, но не используется`,
        });
      }
    }

    return issues;
  } catch {
    return [];
  }
}
