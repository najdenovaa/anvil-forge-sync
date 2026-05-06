import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Edge, Node } from "reactflow";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import type { NodeKind } from "@/lib/anvl-types";

export interface SimButton {
  /** Stable id (handle id when present, else label-derived). */
  id: string;
  label: string;
  /** Action passed back to the existing chat-only handlers. */
  action: string;
  primary?: boolean;
}

export interface SimMessage {
  /** Multi-line bot text rendered in the chat bubble. */
  text: string;
  /** Optional image url for `message.photo`. */
  imageUrl?: string;
  /** Optional caption for the photo. */
  imageCaption?: string;
  /** Buttons rendered under the bubble (from keyboard.* nodes). */
  buttons: SimButton[];
  /** Set when the effective node is action.api — preview shows
   *  "Отправляю…" → "✅ Готово" sequence. */
  apiCall?: { method: string; url: string; pseudoId: string };
  /** Set when the effective node is logic.condition — preview shows
   *  the inline condition prompt with two buttons. */
  conditionExpr?: string;
  /** Soft warning (broken route / unconnected button) shown as a red plate. */
  warning?: string;
}

interface SimulatorCtx {
  /** True when at least one canvas node can be used as a simulation entry. */
  available: boolean;
  /** Currently rendered node id (for canvas highlight). */
  activeNodeId: string | null;
  /** Edge id of the last traversed transition (for canvas edge glow). */
  activeEdgeId: string | null;
  /** History stack of visited node ids (for back navigation). */
  history: string[];
  /** Composed bot message + buttons for the current node. */
  message: SimMessage | null;
  /** Effective node kind we walked to (after skipping silent triggers/messages). */
  effectiveKind: NodeKind | null;
  /** Last branch decision for condition nodes ("yes" | "no"), surfaced in UI. */
  lastBranch: "yes" | "no" | null;
  /** Whether the current node is awaiting user text input. */
  awaitingInput: boolean;
  /** Press a button on the current node. */
  press: (btn: SimButton) => void;
  /** Submit a free-text reply (used by input-aware nodes). */
  submitInput: (text: string) => void;
  /** Toggle / set the next branch for condition nodes. */
  setBranch: (b: "yes" | "no") => void;
  /** Pop one step back. */
  back: () => void;
  /** Restart from the entry node. */
  restart: () => void;
  /** Manually jump (used by canvas click-to-simulate). */
  jumpTo: (nodeId: string) => void;
  /** Camera follow toggle: canvas centers on activeNodeId when true. */
  cameraFollow: boolean;
  setCameraFollow: (v: boolean) => void;
  /** Human-readable breadcrumb of visited node titles. */
  breadcrumb: string[];
  /** Follow the first outgoing edge of the effective node — used by the
   *  preview to continue past action.api / condition after staging. */
  advance: () => void;
}

const Ctx = createContext<SimulatorCtx | null>(null);

const TRIGGER_KINDS: NodeKind[] = [
  "trigger.command",
  "trigger.message",
  "trigger.callback",
];

const KEYBOARD_KINDS: NodeKind[] = ["keyboard.inline", "keyboard.reply"];

function findEntry(nodes: Node[]): string | null {
  // Prefer command triggers, then any trigger, then first node.
  const cmd = nodes.find((n) => (n.data?.kind as NodeKind) === "trigger.command");
  if (cmd) return cmd.id;
  const trig = nodes.find((n) => TRIGGER_KINDS.includes(n.data?.kind as NodeKind));
  if (trig) return trig.id;
  return nodes[0]?.id ?? null;
}

/**
 * Parse buttons from a node param. Supports three formats produced by the AI:
 *   1. JSON array: `[{"label":"A","action":"x"}, ...]`
 *   2. Newline-separated `Label|action` pairs
 *   3. Plain labels (one per line)
 */
function parseButtons(raw: string | undefined): SimButton[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();

  // Strategy 1 — JSON array (object items or plain string items).
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item, i): SimButton | null => {
            if (typeof item === "string") {
              const label = item.trim();
              if (!label) return null;
              return { id: `btn-${i}`, label, action: label, primary: i === 0 };
            }
            if (item && typeof item === "object") {
              const obj = item as Record<string, unknown>;
              const label =
                (typeof obj.label === "string" && obj.label) ||
                (typeof obj.text === "string" && obj.text) ||
                (typeof obj.title === "string" && obj.title) ||
                `Button ${i + 1}`;
              const action =
                (typeof obj.action === "string" && obj.action) ||
                (typeof obj.callback === "string" && obj.callback) ||
                (typeof obj.callback_data === "string" && obj.callback_data) ||
                (typeof obj.data === "string" && obj.data) ||
                label;
              return { id: `btn-${i}`, label, action, primary: i === 0 };
            }
            return null;
          })
          .filter((b: SimButton | null): b is SimButton => b !== null);
      }
    } catch {
      // fall through to text parsing
    }
  }

  // Strategy 2/3 — newline-separated `Label|action` or plain labels.
  const parts = trimmed
    .split(/\n|,(?=\s*[^\d])/) // also split on commas before non-digit (CSV-like)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.map((p, i) => {
    const [labelRaw, actionRaw] = p.split("|").map((part) => part.trim());
    const label = labelRaw || `Button ${i + 1}`;
    return {
      id: `btn-${i}`,
      label,
      action: actionRaw || label,
      primary: i === 0,
    };
  });
}

/** Build the bot message + buttons that should be shown when we land on `node`. */
function composeMessage(
  node: Node,
  nodes: Node[],
  edges: Edge[],
): { message: SimMessage; effectiveNodeId: string; effectiveKind: NodeKind | null } {
  const visited = new Set<string>();
  let cursor: Node | undefined = node;
  const lines: string[] = [];
  let imageUrl: string | undefined;
  let imageCaption: string | undefined;
  let buttonsNode: Node | undefined;
  let stopKind: NodeKind | null = null;
  let lastVisited: Node = node;
  let apiCall: SimMessage["apiCall"] | undefined;
  let conditionExpr: string | undefined;

  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    lastVisited = cursor;
    const k = cursor.data?.kind as NodeKind | undefined;
    const p = (cursor.data?.params as Record<string, string>) ?? {};
    const title = (cursor.data?.title as string) ?? "";

    if (k === "message.text") {
      if (p.text) lines.push(p.text);
      else if (cursor.data?.preview) lines.push(cursor.data.preview as string);
      else if (title) lines.push(title);
    } else if (k === "message.photo") {
      imageUrl = p.url || "placeholder";
      imageCaption = p.caption;
      stopKind = k;
      break;
    } else if (k === "message.document") {
      lines.push(`📎 ${p.filename ?? "file"}`);
    } else if (KEYBOARD_KINDS.includes(k as NodeKind)) {
      buttonsNode = cursor;
      stopKind = k as NodeKind;
      break;
    } else if (k === "miniapp.screen") {
      lines.push(`🪟 ${p.screenId ?? title ?? "Mini App"}`);
      stopKind = k;
      break;
    } else if (k === "logic.condition") {
      conditionExpr = p.expression || p.condition || "var.X > 100";
      stopKind = k;
      break;
    } else if (k === "action.api") {
      const pseudoId =
        "A" + Math.floor(1000 + (cursor.id.length * 137 + visited.size * 4321) % 9000);
      apiCall = {
        method: (p.method || "POST").toUpperCase(),
        url: p.url || "https://api.example.com",
        pseudoId,
      };
      stopKind = k;
      break;
    } else if (k && TRIGGER_KINDS.includes(k)) {
      // Trigger nodes only seed the conversation — keep moving.
    }

    const outAll = edges.filter((e) => e.source === cursor!.id);
    if (outAll.length >= 2) {
      buttonsNode = cursor;
      break;
    }

    const next = outAll[0];
    cursor = next ? nodes.find((n) => n.id === next.target) : undefined;
  }

  const effectiveNode = buttonsNode ?? lastVisited;
  const effectiveKind = (effectiveNode.data?.kind as NodeKind | undefined) ?? null;

  let buttons: SimButton[] = [];
  if (buttonsNode) {
    const p = (buttonsNode.data?.params as Record<string, string>) ?? {};
    const parsed = parseButtons(p.buttons);
    const outgoing = edges.filter((e) => e.source === buttonsNode!.id);

    if (parsed.length > 0) {
      buttons = parsed.map((b, i) => ({
        ...b,
        id: outgoing[i]?.sourceHandle ?? outgoing[i]?.id ?? `${buttonsNode!.id}:${i}`,
      }));
    } else {
      buttons = outgoing.slice(0, 6).map((e, i) => {
        const target = nodes.find((n) => n.id === e.target);
        const tParams = (target?.data?.params as Record<string, string>) ?? {};
        const label =
          (target?.data?.title as string) ||
          tParams.text ||
          tParams.caption ||
          tParams.screenId ||
          `Шаг ${i + 1}`;
        const clipped = label.length > 28 ? label.slice(0, 27) + "…" : label;
        return {
          id: e.sourceHandle ?? e.id,
          label: clipped,
          action: clipped,
          primary: i === 0,
        };
      });
    }
  }

  // Dead-end / broken-route detection.
  let warning: string | undefined;
  const effectiveOut = edges.filter((e) => e.source === effectiveNode.id);
  const effKind = stopKind ?? effectiveKind;
  const isMessageLeaf =
    effKind === "message.text" || effKind === "message.photo" || effKind === "message.document";
  if (
    !buttonsNode &&
    !apiCall &&
    !conditionExpr &&
    effectiveOut.length === 0 &&
    !isMessageLeaf &&
    effKind !== "miniapp.screen"
  ) {
    const name =
      (effectiveNode.data?.title as string) ||
      (effKind ? `(${effKind})` : effectiveNode.id);
    warning = `⚠️ Маршрут оборван. Добавьте связь от ноды «${name}» к следующему шагу.`;
  }
  if (buttonsNode && buttons.length > 0) {
    const outIds = new Set(
      edges.filter((e) => e.source === buttonsNode!.id).map((e) => e.id + "|" + (e.sourceHandle ?? "")),
    );
    const unconnected = buttons.find(
      (b) => !outIds.has(b.id + "|" + b.id) && !outIds.has(b.id + "|"),
    );
    // (best-effort; resolveTarget handles fallback)
    void unconnected;
  }

  // Headline fallback: original node title.
  const seedTitle = (node.data?.title as string) ?? "";
  if (lines.length === 0 && !imageUrl && !apiCall && !conditionExpr && seedTitle) {
    lines.push(seedTitle);
  }
  if (lines.length === 0 && !imageUrl && !apiCall && !conditionExpr) {
    const k = (node.data?.kind as NodeKind | undefined) ?? null;
    lines.push(k ? `(${k})` : "…");
  }

  return {
    message: {
      text: lines.join("\n"),
      imageUrl,
      imageCaption,
      buttons,
      apiCall,
      conditionExpr,
      warning,
    },
    effectiveNodeId: effectiveNode.id,
    effectiveKind: stopKind ?? effectiveKind,
  };
}

/**
 * Resolve which canvas node we should hop to when a button is pressed on
 * `currentId`. Tries (1) sourceHandle = button.id, then (2) edge.id match,
 * then (3) Nth outgoing edge.
 */
function resolveTarget(
  currentId: string,
  btn: SimButton,
  edges: Edge[],
): string | null {
  const outgoing = edges.filter((e) => e.source === currentId);
  // Strategy 1: sourceHandle / edge.id match
  const byHandle = outgoing.find(
    (e) => (e.sourceHandle ?? null) === btn.id || e.id === btn.id,
  );
  if (byHandle) return byHandle.target;

  // Strategy 2: positional — extract index from "btn-N" or "<id>:N"
  const m = btn.id.match(/(?:^btn-|:)(\d+)$/);
  const idx = m ? parseInt(m[1], 10) : 0;
  return outgoing[idx]?.target ?? outgoing[0]?.target ?? null;
}

export function BotSimulatorProvider({ children }: { children: ReactNode }) {
  const { nodes, edges } = useAnvlWorkspace();

  const entryId = useMemo(() => findEntry(nodes), [nodes]);

  // Simulator is available whenever the canvas has at least one trigger/entry
  // node and at least one outgoing edge — composeMessage will synthesize
  // buttons from edges/targets even without explicit keyboard nodes.
  const available = useMemo(
    () => nodes.length > 0 && !!entryId && edges.length > 0,
    [nodes, entryId, edges],
  );

  const [activeNodeId, setActiveNodeId] = useState<string | null>(entryId);
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [lastBranch, setLastBranch] = useState<"yes" | "no" | null>(null);
  const [pendingBranch, setPendingBranch] = useState<"yes" | "no">("yes");
  const [cameraFollow, setCameraFollow] = useState(false);

  useEffect(() => {
    if (!entryId) {
      setActiveNodeId(null);
      setActiveEdgeId(null);
      setHistory([]);
      return;
    }

    if (!activeNodeId || !nodes.some((n) => n.id === activeNodeId)) {
      setActiveNodeId(entryId);
      setActiveEdgeId(null);
      setHistory([]);
    }
  }, [activeNodeId, entryId, nodes]);

  const activeNode = useMemo(
    () => (activeNodeId ? nodes.find((n) => n.id === activeNodeId) : null),
    [activeNodeId, nodes],
  );

  const composed = useMemo(() => {
    if (!activeNode) return null;
    return composeMessage(activeNode, nodes, edges);
  }, [activeNode, nodes, edges]);

  const message = composed?.message ?? null;
  const effectiveKind = composed?.effectiveKind ?? null;

  const awaitingInput = useMemo(() => {
    if (!activeNode) return false;
    const kind = activeNode.data?.kind as NodeKind | undefined;
    return kind === "trigger.message" && (message?.buttons.length ?? 0) === 0;
  }, [activeNode, message]);

  const jumpTo = useCallback((nodeId: string, edgeId?: string | null) => {
    setActiveNodeId((prev) => {
      if (prev) setHistory((h) => [...h, prev]);
      return nodeId;
    });
    setActiveEdgeId(edgeId ?? null);
    setLastBranch(null);
  }, []);

  const press = useCallback(
    (btn: SimButton) => {
      if (!activeNodeId) return;
      // Find the keyboard node we actually walked to (composeMessage may have
      // skipped through silent message nodes).
      let cursor: Node | undefined = nodes.find((n) => n.id === activeNodeId);
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        const k = cursor.data?.kind as NodeKind | undefined;
        if (KEYBOARD_KINDS.includes(k as NodeKind)) break;
        const out = edges.filter((e) => e.source === cursor!.id);
        if (out.length >= 2) break; // implicit switch
        const next = out[0];
        cursor = next ? nodes.find((n) => n.id === next.target) : undefined;
      }
      if (!cursor) return;
      const target = resolveTarget(cursor.id, btn, edges);
      if (!target) return;
      // Find the edge id we just traversed for canvas glow.
      const outgoing = edges.filter((e) => e.source === cursor!.id);
      const edge =
        outgoing.find((e) => (e.sourceHandle ?? null) === btn.id || e.id === btn.id) ??
        outgoing.find((e) => e.target === target);
      jumpTo(target, edge?.id ?? null);
    },
    [activeNodeId, nodes, edges, jumpTo],
  );

  const submitInput = useCallback(
    (_text: string) => {
      if (!activeNodeId) return;
      const out = edges.filter((e) => e.source === activeNodeId);
      const next = out[0]?.target;
      if (next) jumpTo(next);
    },
    [activeNodeId, edges, jumpTo],
  );

  const setBranch = useCallback(
    (b: "yes" | "no") => {
      setPendingBranch(b);
      setLastBranch(b);
      if (!activeNode) return;
      // Only act if current effective node is a condition.
      let cursor: Node | undefined = activeNode;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        const k = cursor.data?.kind as NodeKind | undefined;
        if (k === "logic.condition") break;
        const next = edges.find((e) => e.source === cursor!.id);
        cursor = next ? nodes.find((n) => n.id === next.target) : undefined;
      }
      if (!cursor || (cursor.data?.kind as NodeKind) !== "logic.condition") return;
      const out = edges.filter((e) => e.source === cursor!.id);
      const target = b === "yes" ? out[0]?.target : (out[1]?.target ?? out[0]?.target);
      if (target) jumpTo(target);
    },
    [activeNode, edges, nodes, jumpTo],
  );

  const back = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setActiveNodeId(prev);
      setActiveEdgeId(null);
      setLastBranch(null);
      return h.slice(0, -1);
    });
  }, []);

  const restart = useCallback(() => {
    setActiveNodeId(entryId);
    setActiveEdgeId(null);
    setHistory([]);
    setLastBranch(null);
    setPendingBranch("yes");
  }, [entryId]);

  const value = useMemo<SimulatorCtx>(
    () => ({
      available,
      activeNodeId,
      activeEdgeId,
      history,
      message,
      effectiveKind,
      lastBranch: lastBranch ?? (pendingBranch === "yes" ? null : "no"),
      awaitingInput,
      press,
      submitInput,
      setBranch,
      back,
      restart,
      jumpTo,
      cameraFollow,
      setCameraFollow,
    }),
    [
      available,
      activeNodeId,
      activeEdgeId,
      history,
      message,
      effectiveKind,
      lastBranch,
      pendingBranch,
      awaitingInput,
      press,
      submitInput,
      setBranch,
      back,
      restart,
      jumpTo,
      cameraFollow,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBotSimulator() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBotSimulator must be used inside BotSimulatorProvider");
  return ctx;
}
