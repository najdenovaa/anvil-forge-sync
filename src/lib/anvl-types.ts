export type Platform = "telegram" | "max";

export type NodeKind =
  | "trigger.command"
  | "trigger.message"
  | "trigger.callback"
  | "trigger.webapp_data"
  | "message.text"
  | "message.photo"
  | "message.document"
  | "keyboard.inline"
  | "keyboard.reply"
  | "miniapp.screen"
  | "logic.condition"
  | "action.api"
  | "action.set_var"
  | "action.set_user_var"
  | "action.input";

export interface NodeMeta {
  kind: NodeKind;
  label: string;
  group: "Triggers" | "Messages" | "Keyboards" | "Mini App" | "Logic";
  description: string;
}

// --- Variables -----------------------------------------------------------

export type VariableScope = "session" | "user" | "global";
export type VariableType = "string" | "number" | "boolean" | "json";

export interface VariableDef {
  /** Bare key, no `var.` prefix. e.g. "user_name", "cart_total". */
  key: string;
  scope: VariableScope;
  type: VariableType;
  /** Stored as string; coerced to `type` on read. */
  defaultValue?: string;
  description?: string;
}

// --- Conditions ----------------------------------------------------------

export type CompareOp =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "matches_regex"
  | "is_empty"
  | "is_not_empty"
  | "is_true"
  | "is_false";

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

/**
 * Parse a serialized condition (JSON string) saved in node.params.condition.
 * Backward compat: if invalid/empty, fall back to a leaf that always returns true.
 * If a raw `expression` string is provided as fallback, encode it as a placeholder
 * leaf with text source — the runtime will treat it as always-true.
 */
export function parseCondition(raw: string | undefined | null): Condition {
  if (raw && raw.trim()) {
    try {
      const c = JSON.parse(raw);
      if (c && (c.kind === "leaf" || c.kind === "group")) return c as Condition;
    } catch {
      /* fall through */
    }
  }
  return {
    kind: "group",
    combinator: "AND",
    children: [],
  };
}
