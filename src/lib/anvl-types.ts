export type Platform = "telegram" | "max";

export type NodeKind =
  | "trigger.command"
  | "trigger.message"
  | "trigger.callback"
  | "message.text"
  | "message.photo"
  | "message.document"
  | "keyboard.inline"
  | "keyboard.reply"
  | "miniapp.screen"
  | "logic.condition"
  | "action.api"
  | "action.set_var"
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
