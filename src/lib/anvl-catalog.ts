import {
  Slash,
  MessageSquare,
  MousePointerClick,
  ShoppingBag,
  Type,
  Image as ImageIcon,
  FileText,
  LayoutGrid,
  Keyboard,
  AppWindow,
  GitBranch,
  Webhook,
  Variable,
  UserCog,
  TextCursorInput,
  Inbox,
  BellRing,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind } from "./anvl-types";

export type NodeGroup = "Triggers" | "Messages" | "Keyboards" | "Mini App" | "Logic" | "CRM";

export interface NodeMetaI18n {
  kind: NodeKind;
  group: NodeGroup;
  /** i18n key for label */
  labelKey: string;
  /** i18n key for description */
  descKey: string;
  icon: LucideIcon;
}

export const NODE_CATALOG: Record<NodeKind, NodeMetaI18n> = {
  "trigger.command": {
    kind: "trigger.command",
    group: "Triggers",
    labelKey: "node.trigger.command.label",
    descKey: "node.trigger.command.desc",
    icon: Slash,
  },
  "trigger.message": {
    kind: "trigger.message",
    group: "Triggers",
    labelKey: "node.trigger.message.label",
    descKey: "node.trigger.message.desc",
    icon: MessageSquare,
  },
  "trigger.callback": {
    kind: "trigger.callback",
    group: "Triggers",
    labelKey: "node.trigger.callback.label",
    descKey: "node.trigger.callback.desc",
    icon: MousePointerClick,
  },
  "trigger.webapp_data": {
    kind: "trigger.webapp_data",
    group: "Triggers",
    labelKey: "node.trigger.webapp_data.label",
    descKey: "node.trigger.webapp_data.desc",
    icon: ShoppingBag,
  },
  "message.text": {
    kind: "message.text",
    group: "Messages",
    labelKey: "node.message.text.label",
    descKey: "node.message.text.desc",
    icon: Type,
  },
  "message.photo": {
    kind: "message.photo",
    group: "Messages",
    labelKey: "node.message.photo.label",
    descKey: "node.message.photo.desc",
    icon: ImageIcon,
  },
  "message.document": {
    kind: "message.document",
    group: "Messages",
    labelKey: "node.message.document.label",
    descKey: "node.message.document.desc",
    icon: FileText,
  },
  "keyboard.inline": {
    kind: "keyboard.inline",
    group: "Keyboards",
    labelKey: "node.keyboard.inline.label",
    descKey: "node.keyboard.inline.desc",
    icon: LayoutGrid,
  },
  "keyboard.reply": {
    kind: "keyboard.reply",
    group: "Keyboards",
    labelKey: "node.keyboard.reply.label",
    descKey: "node.keyboard.reply.desc",
    icon: Keyboard,
  },
  "miniapp.screen": {
    kind: "miniapp.screen",
    group: "Mini App",
    labelKey: "node.miniapp.screen.label",
    descKey: "node.miniapp.screen.desc",
    icon: AppWindow,
  },
  "logic.condition": {
    kind: "logic.condition",
    group: "Logic",
    labelKey: "node.logic.condition.label",
    descKey: "node.logic.condition.desc",
    icon: GitBranch,
  },
  "action.api": {
    kind: "action.api",
    group: "Logic",
    labelKey: "node.action.api.label",
    descKey: "node.action.api.desc",
    icon: Webhook,
  },
  "action.set_var": {
    kind: "action.set_var",
    group: "Logic",
    labelKey: "node.action.set_var.label",
    descKey: "node.action.set_var.desc",
    icon: Variable,
  },
  "action.set_user_var": {
    kind: "action.set_user_var",
    group: "Logic",
    labelKey: "node.action.set_user_var.label",
    descKey: "node.action.set_user_var.desc",
    icon: UserCog,
  },
  "action.input": {
    kind: "action.input",
    group: "Triggers",
    labelKey: "node.action.input.label",
    descKey: "node.action.input.desc",
    icon: TextCursorInput,
  },
  "action.save_submission": {
    kind: "action.save_submission",
    group: "CRM",
    labelKey: "node.action.save_submission.label",
    descKey: "node.action.save_submission.desc",
    icon: Inbox,
  },
  "action.notify_admin": {
    kind: "action.notify_admin",
    group: "CRM",
    labelKey: "node.action.notify_admin.label",
    descKey: "node.action.notify_admin.desc",
    icon: BellRing,
  },
};

export const NODE_GROUPS: NodeGroup[] = ["Triggers", "Messages", "Keyboards", "Mini App", "Logic", "CRM"];
