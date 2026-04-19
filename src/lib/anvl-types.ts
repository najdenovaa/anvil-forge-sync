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
  | "action.api";

export interface NodeMeta {
  kind: NodeKind;
  label: string;
  group: "Triggers" | "Messages" | "Keyboards" | "Mini App" | "Logic";
  description: string;
}
