import type { NodeKind } from "./anvl-types";

export type PreviewAction = "open_miniapp" | "plans" | "help" | "profile" | "locations";
export type MiniAppPlan = "free" | "pro" | "team";

export interface AnvlBlueprintNode {
  kind: NodeKind;
  title: string;
  preview: string;
}

export interface AnvlBlueprintEdge {
  from: number;
  to: number;
}

export interface AnvlPreviewButton {
  label: string;
  action: PreviewAction;
  primary?: boolean;
}

export interface AnvlPreviewState {
  botName: string;
  botStatus: string;
  userMessage: string;
  botMessages: string[];
  buttons: AnvlPreviewButton[];
}

export interface AnvlMiniAppState {
  title: string;
  subtitle: string;
  plan: MiniAppPlan;
}

export interface AnvlBlueprint {
  nodes?: AnvlBlueprintNode[];
  edges?: AnvlBlueprintEdge[];
  preview?: Partial<AnvlPreviewState>;
  miniapp?: Partial<AnvlMiniAppState>;
}

const NODE_KINDS: NodeKind[] = [
  "trigger.command",
  "trigger.message",
  "trigger.callback",
  "message.text",
  "message.photo",
  "message.document",
  "keyboard.inline",
  "keyboard.reply",
  "miniapp.screen",
  "logic.condition",
  "action.api",
];

const ACTIONS: PreviewAction[] = ["open_miniapp", "plans", "help", "profile", "locations"];
const PLANS: MiniAppPlan[] = ["free", "pro", "team"];

function isNodeKind(value: unknown): value is NodeKind {
  return typeof value === "string" && NODE_KINDS.includes(value as NodeKind);
}

function isAction(value: unknown): value is PreviewAction {
  return typeof value === "string" && ACTIONS.includes(value as PreviewAction);
}

export function safeParseAnvlBlueprint(raw: string): AnvlBlueprint | null {
  if (!raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as AnvlBlueprint;
    const blueprint: AnvlBlueprint = {};

    if (Array.isArray(parsed.nodes)) {
      const nodes = parsed.nodes
        .filter(
          (node): node is AnvlBlueprintNode =>
            !!node &&
            isNodeKind(node.kind) &&
            typeof node.title === "string" &&
            typeof node.preview === "string",
        )
        .slice(0, 8);

      if (nodes.length > 0) blueprint.nodes = nodes;
    }

    if (Array.isArray(parsed.edges)) {
      const edges = parsed.edges
        .filter(
          (edge): edge is AnvlBlueprintEdge =>
            !!edge &&
            typeof edge.from === "number" &&
            typeof edge.to === "number",
        )
        .slice(0, 12);

      if (edges.length > 0) blueprint.edges = edges;
    }

    if (parsed.preview && typeof parsed.preview === "object") {
      const preview = parsed.preview as Partial<AnvlPreviewState>;
      blueprint.preview = {
        botName: typeof preview.botName === "string" ? preview.botName : undefined,
        botStatus: typeof preview.botStatus === "string" ? preview.botStatus : undefined,
        userMessage: typeof preview.userMessage === "string" ? preview.userMessage : undefined,
        botMessages: Array.isArray(preview.botMessages)
          ? preview.botMessages.filter((item): item is string => typeof item === "string").slice(0, 3)
          : undefined,
        buttons: Array.isArray(preview.buttons)
          ? preview.buttons
              .filter(
                (button): button is AnvlPreviewButton =>
                  !!button &&
                  typeof button.label === "string" &&
                  isAction(button.action),
              )
              .slice(0, 3)
          : undefined,
      };
    }

    if (parsed.miniapp && typeof parsed.miniapp === "object") {
      const miniapp = parsed.miniapp as Partial<AnvlMiniAppState>;
      blueprint.miniapp = {
        title: typeof miniapp.title === "string" ? miniapp.title : undefined,
        subtitle: typeof miniapp.subtitle === "string" ? miniapp.subtitle : undefined,
        plan: typeof miniapp.plan === "string" && PLANS.includes(miniapp.plan as MiniAppPlan)
          ? (miniapp.plan as MiniAppPlan)
          : undefined,
      };
    }

    return blueprint;
  } catch {
    return null;
  }
}
