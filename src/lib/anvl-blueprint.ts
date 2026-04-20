import type { NodeKind } from "./anvl-types";

export type BuiltInPreviewAction = "open_miniapp" | "plans" | "help" | "profile" | "locations";
export type PreviewAction = BuiltInPreviewAction | `screen:${string}`;
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

export interface AnvlPreviewScreen {
  id: string;
  userMessage?: string;
  botMessages: string[];
  buttons: AnvlPreviewButton[];
}

export interface AnvlPreviewState {
  botName: string;
  botStatus: string;
  userMessage: string;
  botMessages: string[];
  buttons: AnvlPreviewButton[];
  initialScreen?: string;
  screens?: AnvlPreviewScreen[];
}

export type MiniAppAccent = "blue" | "green" | "orange" | "violet" | "pink" | "red" | "teal";

export interface MiniAppHero {
  /** Big headline shown on the home screen, e.g. "Order food", "Book a table" */
  title: string;
  /** Sub line under the title */
  subtitle?: string;
  /** Primary CTA label, e.g. "Place order", "Connect" */
  cta: string;
  /** Lucide-like icon name. Renderer maps to a small whitelist. */
  icon?: string;
}

export interface MiniAppStat {
  label: string;
  value: string;
  unit?: string;
}

export interface MiniAppItem {
  title: string;
  subtitle?: string;
  /** Right-side meta: price, distance, ping, count, etc. */
  meta?: string;
  /** Optional emoji as a visual marker (flag, food, etc.) */
  emoji?: string;
  badge?: string;
}

export interface MiniAppPlanCard {
  id: string;
  name: string;
  price: string;
  /** "/mo", "/order", etc. */
  unit?: string;
  description?: string;
  highlight?: boolean;
  features?: string[];
}

export interface MiniAppTabSpec {
  id: string;
  label: string;
  /** Lucide-like icon name */
  icon?: string;
}

export interface AnvlMiniAppState {
  /** Brand title shown in the mini-app header */
  title: string;
  /** Brand tagline shown in the header */
  subtitle: string;
  /** Default plan in the (optional) plans tab */
  plan: MiniAppPlan;
  /** Color accent for buttons, badges, header */
  accent: MiniAppAccent;
  /** Hero block on the home tab */
  hero: MiniAppHero;
  /** 2-4 quick stats under the hero */
  stats: MiniAppStat[];
  /** Catalog list (menu, locations, products, songs...) */
  items: MiniAppItem[];
  /** Optional pricing tab content */
  plans: MiniAppPlanCard[];
  /** Tabs to render at the bottom (2-4) */
  tabs: MiniAppTabSpec[];
  /** Label of the items tab (e.g. "Menu", "Servers", "Catalog") */
  itemsLabel: string;
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

const ACTIONS: BuiltInPreviewAction[] = ["open_miniapp", "plans", "help", "profile", "locations"];
const PLANS: MiniAppPlan[] = ["free", "pro", "team"];
const ACCENTS: MiniAppAccent[] = ["blue", "green", "orange", "violet", "pink", "red", "teal"];

function isNodeKind(value: unknown): value is NodeKind {
  return typeof value === "string" && NODE_KINDS.includes(value as NodeKind);
}
function isAction(value: unknown): value is PreviewAction {
  return typeof value === "string" && (ACTIONS.includes(value as BuiltInPreviewAction) || value.startsWith("screen:"));
}
function isStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function parseHero(v: unknown): MiniAppHero | undefined {
  if (!v || typeof v !== "object") return undefined;
  const h = v as Partial<MiniAppHero>;
  if (!isStr(h.title) || !isStr(h.cta)) return undefined;
  return {
    title: h.title,
    subtitle: isStr(h.subtitle) ? h.subtitle : undefined,
    cta: h.cta,
    icon: isStr(h.icon) ? h.icon : undefined,
  };
}

function parseStats(v: unknown): MiniAppStat[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((s): s is MiniAppStat => !!s && typeof s === "object" && isStr((s as MiniAppStat).label) && isStr((s as MiniAppStat).value))
    .map((s) => ({ label: s.label, value: s.value, unit: isStr(s.unit) ? s.unit : undefined }))
    .slice(0, 4);
  return out.length ? out : undefined;
}

function parseItems(v: unknown): MiniAppItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((i): i is MiniAppItem => !!i && typeof i === "object" && isStr((i as MiniAppItem).title))
    .map((i) => ({
      title: i.title,
      subtitle: isStr(i.subtitle) ? i.subtitle : undefined,
      meta: isStr(i.meta) ? i.meta : undefined,
      emoji: isStr(i.emoji) ? i.emoji : undefined,
      badge: isStr(i.badge) ? i.badge : undefined,
    }))
    .slice(0, 8);
  return out.length ? out : undefined;
}

function parsePlanCards(v: unknown): MiniAppPlanCard[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter(
      (p): p is MiniAppPlanCard =>
        !!p && typeof p === "object" && isStr((p as MiniAppPlanCard).id) && isStr((p as MiniAppPlanCard).name) && isStr((p as MiniAppPlanCard).price),
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      unit: isStr(p.unit) ? p.unit : undefined,
      description: isStr(p.description) ? p.description : undefined,
      highlight: !!p.highlight,
      features: Array.isArray(p.features) ? p.features.filter(isStr).slice(0, 5) : undefined,
    }))
    .slice(0, 4);
  return out.length ? out : undefined;
}

function parseTabs(v: unknown): MiniAppTabSpec[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((t): t is MiniAppTabSpec => !!t && typeof t === "object" && isStr((t as MiniAppTabSpec).id) && isStr((t as MiniAppTabSpec).label))
    .map((t) => ({ id: t.id, label: t.label, icon: isStr(t.icon) ? t.icon : undefined }))
    .slice(0, 4);
  return out.length >= 2 ? out : undefined;
}

function parsePreviewButtons(v: unknown): AnvlPreviewButton[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter(
      (button): button is AnvlPreviewButton =>
        !!button && typeof button.label === "string" && isAction(button.action),
    )
    .slice(0, 4);
  return out.length ? out : undefined;
}

function parsePreviewScreens(v: unknown): AnvlPreviewScreen[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter(
      (screen): screen is AnvlPreviewScreen =>
        !!screen &&
        typeof screen === "object" &&
        isStr((screen as AnvlPreviewScreen).id) &&
        Array.isArray((screen as AnvlPreviewScreen).botMessages),
    )
    .map((screen) => ({
      id: screen.id,
      userMessage: isStr(screen.userMessage) ? screen.userMessage : undefined,
      botMessages: screen.botMessages.filter((item): item is string => typeof item === "string").slice(0, 4),
      buttons: parsePreviewButtons(screen.buttons) ?? [],
    }))
    .filter((screen) => screen.botMessages.length > 0)
    .slice(0, 8);
  return out.length ? out : undefined;
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
            !!edge && typeof edge.from === "number" && typeof edge.to === "number",
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
        buttons: parsePreviewButtons(preview.buttons),
        initialScreen: isStr(preview.initialScreen) ? preview.initialScreen : undefined,
        screens: parsePreviewScreens(preview.screens),
      };
    }

    if (parsed.miniapp && typeof parsed.miniapp === "object") {
      const m = parsed.miniapp as Partial<AnvlMiniAppState>;
      blueprint.miniapp = {
        title: isStr(m.title) ? m.title : undefined,
        subtitle: isStr(m.subtitle) ? m.subtitle : undefined,
        plan: isStr(m.plan) && PLANS.includes(m.plan as MiniAppPlan) ? (m.plan as MiniAppPlan) : undefined,
        accent:
          isStr(m.accent) && ACCENTS.includes(m.accent as MiniAppAccent)
            ? (m.accent as MiniAppAccent)
            : undefined,
        hero: parseHero(m.hero),
        stats: parseStats(m.stats),
        items: parseItems(m.items),
        plans: parsePlanCards(m.plans),
        tabs: parseTabs(m.tabs),
        itemsLabel: isStr(m.itemsLabel) ? m.itemsLabel : undefined,
      };
    }

    return blueprint;
  } catch {
    return null;
  }
}
