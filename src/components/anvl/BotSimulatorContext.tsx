import {
  createContext,
  useCallback,
  useContext,
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
  /** Buttons rendered under the bubble (from keyboard.* nodes). */
  buttons: SimButton[];
}

interface SimulatorCtx {
  /** True when at least one canvas node can be used as a simulation entry. */
  available: boolean;
  /** Currently rendered node id (for canvas highlight). */
  activeNodeId: string | null;
  /** History stack of visited node ids (for back navigation). */
  history: string[];
  /** Composed bot message + buttons for the current node. */
  message: SimMessage | null;
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

/** Parse "Label A | Label B" or newline-separated lists from a params.buttons string. */
function parseButtons(raw: string | undefined): SimButton[] {
  if (!raw || !raw.trim()) return [];
  const parts = raw
    .split(/\n|\|/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.map((p, i) => ({
    id: `btn-${i}`,
    label: p,
    action: p, // reuse label as action — handlers see it as bare string
    primary: i === 0,
  }));
}

/** Build the bot message + buttons that should be shown when we land on `node`. */
function composeMessage(node: Node, nodes: Node[], edges: Edge[]): SimMessage {
  const kind = node.data?.kind as NodeKind | undefined;
  const params = (node.data?.params as Record<string, string>) ?? {};
  const title = (node.data?.title as string) ?? "";

  // Walk forward through silent nodes (triggers/messages without user choice)
  // to gather the full bubble text and reach a node that defines buttons.
  const visited = new Set<string>();
  let cursor: Node | undefined = node;
  const lines: string[] = [];
  let imageUrl: string | undefined;
  let buttonsNode: Node | undefined;

  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    const k = cursor.data?.kind as NodeKind | undefined;
    const p = (cursor.data?.params as Record<string, string>) ?? {};

    if (k === "message.text") {
      if (p.text) lines.push(p.text);
      else if (cursor.data?.preview) lines.push(cursor.data.preview as string);
    } else if (k === "message.photo") {
      imageUrl = p.url;
      if (p.caption) lines.push(p.caption);
    } else if (k === "message.document") {
      lines.push(`📎 ${p.filename ?? "file"}`);
    } else if (KEYBOARD_KINDS.includes(k as NodeKind)) {
      buttonsNode = cursor;
      break;
    } else if (k === "miniapp.screen") {
      lines.push(`🪟 ${p.screenId ?? title ?? "Mini App"}`);
      break;
    } else if (k === "logic.condition") {
      // Condition handled by caller (we stop here so the UI can surface a branch toggle).
      break;
    } else if (k === "action.api") {
      lines.push(`⚡ ${p.method ?? "POST"} ${p.url ?? ""}`.trim());
    } else if (k && TRIGGER_KINDS.includes(k)) {
      // Trigger nodes only seed the conversation — keep moving.
    }

    // Advance: take the FIRST outgoing edge.
    const next = edges.find((e) => e.source === cursor!.id);
    cursor = next ? nodes.find((n) => n.id === next.target) : undefined;
  }

  let buttons: SimButton[] = [];
  if (buttonsNode) {
    const p = (buttonsNode.data?.params as Record<string, string>) ?? {};
    const parsed = parseButtons(p.buttons);
    if (parsed.length > 0) {
      // Match each button to an outgoing edge so that pressing it can jump.
      const outgoing = edges.filter((e) => e.source === buttonsNode!.id);
      buttons = parsed.map((b, i) => ({
        ...b,
        // Prefer sourceHandle id when AI provides it; else by index.
        id: outgoing[i]?.sourceHandle ?? `${buttonsNode!.id}:${i}`,
      }));
    } else {
      // No params.buttons — derive labels from outgoing edges' target node titles.
      const outgoing = edges.filter((e) => e.source === buttonsNode!.id);
      buttons = outgoing.slice(0, 4).map((e, i) => {
        const target = nodes.find((n) => n.id === e.target);
        const label = (target?.data?.title as string) ?? `Step ${i + 1}`;
        return { id: e.id, label, action: label, primary: i === 0 };
      });
    }
  }

  // Headline: original node title if no inline message produced one.
  if (lines.length === 0 && title) lines.push(title);

  // Last-resort fallback so the bubble is never empty.
  if (lines.length === 0) {
    lines.push(kind ? `(${kind})` : "…");
  }

  return { text: lines.join("\n"), imageUrl, buttons };
}

/**
 * Resolve which canvas node we should hop to when a button is pressed on
 * `currentId`. Tries (1) sourceHandle = button.id, then (2) Nth outgoing edge.
 */
function resolveTarget(
  currentId: string,
  btn: SimButton,
  edges: Edge[],
): string | null {
  const outgoing = edges.filter((e) => e.source === currentId);
  // Strategy 1: sourceHandle match
  const byHandle = outgoing.find(
    (e) => (e.sourceHandle ?? null) === btn.id || `${currentId}:${btn.id}` === btn.id,
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

  const hasButtonsOnCanvas = useMemo(
    () =>
      nodes.some((n) => {
        const kind = n.data?.kind as NodeKind | undefined;
        if (!kind) return false;
        if (KEYBOARD_KINDS.includes(kind)) return true;
        // A node with multiple outgoing edges effectively acts as a switch.
        const out = edges.filter((e) => e.source === n.id);
        return out.length >= 2;
      }),
    [nodes, edges],
  );

  // Simulator is "available" when there is at least one trigger node AND
  // the AI hasn't shipped a chat-only preview.screens fallback.
  const available = useMemo(
    () => nodes.length > 0 && !!entryId && hasButtonsOnCanvas,
    [nodes, entryId, hasButtonsOnCanvas],
  );

  const [activeNodeId, setActiveNodeId] = useState<string | null>(entryId);
  const [history, setHistory] = useState<string[]>([]);
  const [lastBranch, setLastBranch] = useState<"yes" | "no" | null>(null);
  const [pendingBranch, setPendingBranch] = useState<"yes" | "no">("yes");

  // Re-pin when the canvas changes (e.g. AI applies a new flow).
  const lastEntryRef = useMemo(() => ({ id: entryId }), [entryId]);
  if (
    activeNodeId &&
    !nodes.some((n) => n.id === activeNodeId) &&
    lastEntryRef.id !== activeNodeId
  ) {
    // Active node was removed — reset to entry.
    setActiveNodeId(entryId);
    setHistory([]);
  }

  const activeNode = useMemo(
    () => (activeNodeId ? nodes.find((n) => n.id === activeNodeId) : null),
    [activeNodeId, nodes],
  );

  const message = useMemo(() => {
    if (!activeNode) return null;
    return composeMessage(activeNode, nodes, edges);
  }, [activeNode, nodes, edges]);

  const awaitingInput = useMemo(() => {
    if (!activeNode) return false;
    const kind = activeNode.data?.kind as NodeKind | undefined;
    return kind === "trigger.message" && (message?.buttons.length ?? 0) === 0;
  }, [activeNode, message]);

  const jumpTo = useCallback((nodeId: string) => {
    setActiveNodeId((prev) => {
      if (prev) setHistory((h) => [...h, prev]);
      return nodeId;
    });
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
      if (target) jumpTo(target);
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
      setLastBranch(null);
      return h.slice(0, -1);
    });
  }, []);

  const restart = useCallback(() => {
    setActiveNodeId(entryId);
    setHistory([]);
    setLastBranch(null);
    setPendingBranch("yes");
  }, [entryId]);

  // Keep entry in sync when AI rebuilds the flow.
  useMemo(() => {
    if (!activeNodeId && entryId) setActiveNodeId(entryId);
  }, [activeNodeId, entryId]);

  const value = useMemo<SimulatorCtx>(
    () => ({
      available,
      activeNodeId,
      history,
      message,
      lastBranch: lastBranch ?? (pendingBranch === "yes" ? null : "no"),
      awaitingInput,
      press,
      submitInput,
      setBranch,
      back,
      restart,
      jumpTo,
    }),
    [
      available,
      activeNodeId,
      history,
      message,
      lastBranch,
      pendingBranch,
      awaitingInput,
      press,
      submitInput,
      setBranch,
      back,
      restart,
      jumpTo,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBotSimulator() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBotSimulator must be used inside BotSimulatorProvider");
  return ctx;
}
