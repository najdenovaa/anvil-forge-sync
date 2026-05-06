/**
 * ⚠️ ДУБЛИРУЕТСЯ В ДВУХ МЕСТАХ — синхронизируй вручную:
 *   - src/lib/condition-eval-shared.ts             (фронт / симулятор)
 *   - supabase/functions/_shared/condition-eval.ts (edge functions / Deno)
 *
 * Причина: Supabase Edge Functions bundler не может импортировать за
 * пределы supabase/functions/. При изменении этого файла ОБЯЗАТЕЛЬНО
 * обнови второй (sha256 должны совпадать).
 *
 * NEVER use eval() / new Function() here. Pure data evaluation only.
 */

import type { TemplateContext } from "./template.ts";

export type CompareOp =
  | "eq" | "neq"
  | "gt" | "lt" | "gte" | "lte"
  | "contains" | "not_contains" | "starts_with" | "ends_with" | "matches_regex"
  | "is_empty" | "is_not_empty"
  | "is_true" | "is_false";

export type ConditionSource = "var" | "user" | "system" | "text";

export interface ConditionLeaf {
  kind: "leaf";
  left: { source: ConditionSource; key?: string };
  operator: CompareOp;
  right: { kind: "literal"; value: string } | { kind: "variable"; key: string };
}

export interface ConditionGroup {
  kind: "group";
  combinator: "AND" | "OR";
  children: Condition[];
}

export type Condition = ConditionLeaf | ConditionGroup;

export interface EvalSubResult {
  path: string;
  result: boolean;
  detail?: string;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function readSource(side: ConditionLeaf["left"], ctx: TemplateContext): unknown {
  if (side.source === "text") return ctx.text ?? "";
  if (side.source === "var") return (ctx.var as Record<string, unknown>)[side.key ?? ""] ?? "";
  if (side.source === "user") return (ctx.user as Record<string, unknown>)[side.key ?? ""] ?? "";
  if (side.source === "system") return (ctx.system as Record<string, unknown>)[side.key ?? ""] ?? "";
  return "";
}

function evalLeaf(leaf: ConditionLeaf, ctx: TemplateContext): boolean {
  const leftVal = readSource(leaf.left, ctx);
  const rightVal = leaf.right.kind === "literal"
    ? leaf.right.value
    : (ctx.var as Record<string, unknown>)[leaf.right.key] ?? "";

  switch (leaf.operator) {
    case "eq": return String(leftVal) === String(rightVal);
    case "neq": return String(leftVal) !== String(rightVal);
    case "gt": return toNum(leftVal) > toNum(rightVal);
    case "lt": return toNum(leftVal) < toNum(rightVal);
    case "gte": return toNum(leftVal) >= toNum(rightVal);
    case "lte": return toNum(leftVal) <= toNum(rightVal);
    case "contains": return String(leftVal).includes(String(rightVal));
    case "not_contains": return !String(leftVal).includes(String(rightVal));
    case "starts_with": return String(leftVal).startsWith(String(rightVal));
    case "ends_with": return String(leftVal).endsWith(String(rightVal));
    case "matches_regex":
      try { return new RegExp(String(rightVal)).test(String(leftVal)); }
      catch { return false; }
    case "is_empty": return !leftVal || String(leftVal).trim() === "";
    case "is_not_empty": return !!leftVal && String(leftVal).trim() !== "";
    case "is_true": return leftVal === true || leftVal === "true";
    case "is_false": return leftVal === false || leftVal === "false";
    default: return false;
  }
}

export function evaluateCondition(
  cond: Condition,
  ctx: TemplateContext,
  subResults?: EvalSubResult[],
  path = "$",
): boolean {
  if (cond.kind === "leaf") {
    const r = evalLeaf(cond, ctx);
    if (subResults) {
      const left = `${cond.left.source}${cond.left.key ? "." + cond.left.key : ""}`;
      const right = cond.right.kind === "literal" ? JSON.stringify(cond.right.value) : `var.${cond.right.key}`;
      subResults.push({ path, result: r, detail: `${left} ${cond.operator} ${right}` });
    }
    return r;
  }
  // Empty group → always true (so unconfigured condition routes via "true").
  if (!cond.children?.length) return true;
  if (cond.combinator === "OR") {
    let any = false;
    cond.children.forEach((c, i) => {
      const r = evaluateCondition(c, ctx, subResults, `${path}.${i}`);
      if (r) any = true;
    });
    return any;
  }
  let all = true;
  cond.children.forEach((c, i) => {
    const r = evaluateCondition(c, ctx, subResults, `${path}.${i}`);
    if (!r) all = false;
  });
  return all;
}

/** Try to JSON-parse a stored condition; returns null on failure (caller decides fallback). */
export function tryParseCondition(raw: string | undefined | null): Condition | null {
  if (!raw || !raw.trim()) return null;
  try {
    const c = JSON.parse(raw);
    if (c && (c.kind === "leaf" || c.kind === "group")) return c as Condition;
  } catch { /* */ }
  return null;
}
