import {
  Slash,
  MessageSquare,
  MousePointerClick,
  Type,
  Image as ImageIcon,
  FileText,
  LayoutGrid,
  Keyboard,
  AppWindow,
  GitBranch,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind, NodeMeta } from "./anvl-types";

export const NODE_CATALOG: Record<NodeKind, NodeMeta & { icon: LucideIcon }> = {
  "trigger.command": {
    kind: "trigger.command",
    group: "Triggers",
    label: "Command",
    description: "Fires on /command",
    icon: Slash,
  },
  "trigger.message": {
    kind: "trigger.message",
    group: "Triggers",
    label: "Message",
    description: "Any incoming text",
    icon: MessageSquare,
  },
  "trigger.callback": {
    kind: "trigger.callback",
    group: "Triggers",
    label: "Callback",
    description: "Inline button tap",
    icon: MousePointerClick,
  },
  "message.text": {
    kind: "message.text",
    group: "Messages",
    label: "Text",
    description: "Send a text reply",
    icon: Type,
  },
  "message.photo": {
    kind: "message.photo",
    group: "Messages",
    label: "Photo",
    description: "Send an image",
    icon: ImageIcon,
  },
  "message.document": {
    kind: "message.document",
    group: "Messages",
    label: "Document",
    description: "Send a file",
    icon: FileText,
  },
  "keyboard.inline": {
    kind: "keyboard.inline",
    group: "Keyboards",
    label: "Inline",
    description: "Buttons under message",
    icon: LayoutGrid,
  },
  "keyboard.reply": {
    kind: "keyboard.reply",
    group: "Keyboards",
    label: "Reply",
    description: "Custom reply keyboard",
    icon: Keyboard,
  },
  "miniapp.screen": {
    kind: "miniapp.screen",
    group: "Mini App",
    label: "Screen",
    description: "WebView screen",
    icon: AppWindow,
  },
  "logic.condition": {
    kind: "logic.condition",
    group: "Logic",
    label: "Condition",
    description: "If / else branch",
    icon: GitBranch,
  },
  "action.api": {
    kind: "action.api",
    group: "Logic",
    label: "API call",
    description: "Outbound HTTP request",
    icon: Webhook,
  },
};

export const NODE_GROUPS = [
  "Triggers",
  "Messages",
  "Keyboards",
  "Mini App",
  "Logic",
] as const;
