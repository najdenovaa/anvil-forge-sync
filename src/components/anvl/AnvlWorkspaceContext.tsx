import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Edge, Node } from "reactflow";
import type { AnvlBlueprint, AnvlMiniAppState, AnvlPreviewState } from "@/lib/anvl-blueprint";
import type { VariableDef } from "@/lib/anvl-types";
import { lintFlow, type LintIssue } from "@/lib/flow-linter";
import { useFlowPersistence, type SaveStatus } from "./useFlowPersistence";
import type { FlowSnapshot, FlowVersionFull } from "@/lib/anvl-flow-storage";
import { autoLayout } from "@/lib/anvl-autolayout";

const DEFAULT_FLOW_SLUG = "default";

const initialNodes: Node[] = [
  {
    id: "1",
    type: "anvl",
    position: { x: 40, y: 120 },
    data: {
      kind: "trigger.command",
      titleKey: "canvas.start.title",
      previewKey: "canvas.start.preview",
    },
  },
  {
    id: "2",
    type: "anvl",
    position: { x: 320, y: 80 },
    data: {
      kind: "message.text",
      titleKey: "canvas.welcome.title",
      previewKey: "canvas.welcome.preview",
    },
  },
  {
    id: "3",
    type: "anvl",
    position: { x: 320, y: 240 },
    data: {
      kind: "keyboard.inline",
      titleKey: "canvas.menu.title",
      previewKey: "canvas.menu.preview",
    },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e1-3", source: "1", target: "3", animated: true },
];

type MenuButton = { label: string; action: string };

function parseMenuButtons(raw: unknown): MenuButton[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((b: any) => ({
        label: String(b?.label ?? b?.text ?? b?.title ?? "").trim(),
        action: String(b?.action ?? b?.callback_data ?? b?.value ?? "").trim(),
      }))
      .filter((b) => b.label);
  }
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      return parseMenuButtons(JSON.parse(s));
    } catch {
      /* fallthrough */
    }
  }
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, action] = line.split("|").map((p) => p.trim());
      return { label, action: action || label };
    });
}

function serializeMenuButtons(buttons: MenuButton[]): string {
  return JSON.stringify(buttons);
}

interface WorkspaceCtx {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  preview: Partial<AnvlPreviewState>;
  miniApp: Partial<AnvlMiniAppState>;
  generatedCode: string;
  setGeneratedCode: React.Dispatch<React.SetStateAction<string>>;
  variables: VariableDef[];
  setVariables: React.Dispatch<React.SetStateAction<VariableDef[]>>;
  applyBlueprint: (blueprint: AnvlBlueprint) => void;
  /** Tool-calling primitives — incremental mutations from the AI agent. */
  addAiNode: (id: string, kind: string, title: string, preview: string) => void;
  connectAiNodes: (from: string, to: string, sourceHandle?: string) => void;
  updateAiNodeParam: (id: string, key: string, value: string) => void;
  removeAiNode: (id: string) => void;
  removeAiEdge: (from: string, to: string, sourceHandle?: string) => void;
  renameAiNode: (id: string, label: string) => void;
  addMenuSection: (args: {
    menu_id: string;
    button_label: string;
    callback_data: string;
    content_kind: "text" | "photo";
    content: string;
    section_id: string;
    back_label?: string;
  }) => void;
  removeMenuSection: (args: { menu_id: string; section_msg_id: string }) => void;
  updateMenuSection: (args: {
    menu_id: string;
    section_msg_id: string;
    new_button_label?: string;
    new_content?: string;
  }) => void;
  serializeCanvas: () => {
    nodes: { id: string; kind: string; label: string; params: Record<string, string> }[];
    edges: { from: string; to: string; sourceHandle: string | null }[];
    variables: VariableDef[];
  };
  mergePreview: (patch: Partial<AnvlPreviewState>) => void;
  mergeMiniApp: (patch: Partial<AnvlMiniAppState>) => void;
  resetAiCanvas: () => void;
  relayoutCanvas: () => void;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  snapshotNow: (note?: string) => Promise<void>;
  flowId: string | null;
  slug: string;
  rollbackToVersion: (version: FlowVersionFull) => void;
  lintIssues: LintIssue[];
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function AnvlWorkspaceProvider({
  children,
  slug = DEFAULT_FLOW_SLUG,
  persist = true,
  autoCreate = false,
  onFlowCreated,
}: {
  children: ReactNode;
  slug?: string;
  persist?: boolean;
  autoCreate?: boolean;
  onFlowCreated?: (slug: string) => void;
}) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [preview, setPreview] = useState<Partial<AnvlPreviewState>>({});
  const [miniApp, setMiniApp] = useState<Partial<AnvlMiniAppState>>({});
  const [generatedCode, setGeneratedCode] = useState("");
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const hydratedSlugRef = useRef<string | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const applyBlueprint = useCallback((blueprint: AnvlBlueprint) => {
    if (blueprint.nodes?.length) {
      const nextNodes: Node[] = blueprint.nodes.map((node, index) => ({
        id: `ai-${index + 1}`,
        type: "anvl",
        position: {
          x: 40 + Math.floor(index / 2) * 280,
          y: 90 + (index % 2) * 170,
        },
        data: {
          kind: node.kind,
          title: node.title,
          preview: node.preview,
        },
      }));

      const nextEdges: Edge[] = (blueprint.edges?.length
        ? blueprint.edges
        : nextNodes.slice(1).map((_, index) => ({ from: index, to: index + 1 })))
        .filter((edge) => nextNodes[edge.from] && nextNodes[edge.to])
        .map((edge, index) => ({
          id: `ai-edge-${index + 1}`,
          source: nextNodes[edge.from].id,
          target: nextNodes[edge.to].id,
          animated: true,
        }));

      setNodes(nextNodes);
      setEdges(nextEdges);
    }

    if (blueprint.preview) {
      setPreview((current) => ({ ...current, ...blueprint.preview }));
    }

    if (blueprint.miniapp) {
      setMiniApp((current) => ({ ...current, ...blueprint.miniapp }));
    }
  }, []);

  const hydrate = useCallback((snap: FlowSnapshot) => {
    hydratedSlugRef.current = snap.slug;
    setNodes(snap.nodes?.length ? snap.nodes : initialNodes);
    setEdges(snap.edges?.length ? snap.edges : initialEdges);
    setPreview(snap.preview ?? {});
    setMiniApp(snap.miniapp ?? {});
    setGeneratedCode(snap.generatedCode ?? "");
    setVariables(snap.variables ?? []);
  }, []);

  const rollbackToVersion = useCallback((version: FlowVersionFull) => {
    setNodes(version.nodes ?? []);
    setEdges(version.edges ?? []);
    setPreview(version.preview ?? {});
    setMiniApp(version.miniapp ?? {});
    setGeneratedCode(version.generatedCode ?? "");
  }, []);

  const resetAiCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, []);

  const relayoutCanvas = useCallback(() => {
    setNodes((ns) => {
      // We need current edges; read via setEdges identity callback.
      let currentEdges: Edge[] = [];
      setEdges((es) => { currentEdges = es; return es; });
      return autoLayout(ns, currentEdges);
    });
  }, []);

  const addAiNode = useCallback((id: string, kind: string, title: string, preview: string) => {
    setNodes((prev) => {
      if (prev.some((n) => n.id === id)) return prev;
      const idx = prev.length;
      return [
        ...prev,
        {
          id,
          type: "anvl",
          position: { x: 40 + Math.floor(idx / 2) * 280, y: 90 + (idx % 2) * 170 },
          data: { kind, title, preview, params: {} },
        },
      ];
    });
  }, []);

  const connectAiNodes = useCallback((from: string, to: string, sourceHandle?: string) => {
    const eid = sourceHandle ? `ai-${from}-${sourceHandle}-${to}` : `ai-${from}-${to}`;
    setEdges((prev) =>
      prev.some((e) => e.id === eid)
        ? prev
        : [...prev, { id: eid, source: from, target: to, animated: true, sourceHandle }],
    );
  }, []);

  const updateAiNodeParam = useCallback((id: string, key: string, value: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, params: { ...(n.data?.params ?? {}), [key]: value } } }
          : n,
      ),
    );
  }, []);

  const removeAiNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
  }, []);

  const removeAiEdge = useCallback((from: string, to: string, sourceHandle?: string) => {
    setEdges((prev) =>
      prev.filter(
        (e) =>
          !(
            e.source === from &&
            e.target === to &&
            (sourceHandle === undefined || (e.sourceHandle ?? undefined) === sourceHandle)
          ),
      ),
    );
  }, []);

  const renameAiNode = useCallback((id: string, label: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, title: label, label } } : n)),
    );
  }, []);

  // ── Composite menu-section helpers ────────────────────────────────────
  // Buttons are stored as a JSON-serialized array of {label, action} so that
  // both legacy add_node-built menus (JSON) and composite-built menus stay
  // compatible. parseMenuButtons handles either format on read.
  const addMenuSection = useCallback(
    (args: {
      menu_id: string;
      button_label: string;
      callback_data: string;
      content_kind: "text" | "photo";
      content: string;
      section_id: string;
      back_label?: string;
    }) => {
      const msgId = `${args.section_id}_msg`;
      const backKbId = `${args.section_id}_back_kb`;
      const backLabel = args.back_label ?? "« Назад в меню";
      const buttonAction = `screen:${msgId}`;
      const msgKind = args.content_kind === "photo" ? "message.photo" : "message.text";
      const contentKey = args.content_kind === "photo" ? "photoUrl" : "text";

      setNodes((prev) => {
        const menu = prev.find((n) => n.id === args.menu_id);
        if (!menu || menu.data?.kind !== "keyboard.inline") {
          console.warn("addMenuSection: menu_id not found or not keyboard.inline", args.menu_id);
          return prev;
        }
        if (prev.some((n) => n.id === msgId) || prev.some((n) => n.id === backKbId)) {
          console.warn("addMenuSection: nodes already exist", msgId, backKbId);
          return prev;
        }
        const baseIdx = prev.length;
        const existing = parseMenuButtons((menu.data?.params as any)?.buttons);
        const nextButtons = serializeMenuButtons([
          ...existing,
          { label: args.button_label, action: buttonAction },
        ]);
        const backButtons = serializeMenuButtons([
          { label: backLabel, action: "back_to_menu" },
        ]);

        return prev
          .map((n) =>
            n.id === args.menu_id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    params: { ...((n.data?.params as Record<string, string>) ?? {}), buttons: nextButtons },
                  },
                }
              : n,
          )
          .concat([
            {
              id: msgId,
              type: "anvl",
              position: { x: 40 + Math.floor(baseIdx / 2) * 280, y: 90 + (baseIdx % 2) * 170 },
              data: {
                kind: msgKind,
                title: args.button_label,
                preview: args.content.slice(0, 80),
                params: { [contentKey]: args.content },
              },
            },
            {
              id: backKbId,
              type: "anvl",
              position: { x: 40 + Math.floor((baseIdx + 1) / 2) * 280, y: 90 + ((baseIdx + 1) % 2) * 170 },
              data: {
                kind: "keyboard.inline",
                title: `Назад → ${args.menu_id}`,
                preview: backLabel,
                params: { buttons: backButtons },
              },
            },
          ]);
      });

      setEdges((prev) => {
        const next = [...prev];
        const add = (from: string, to: string) => {
          const eid = `ai-${from}-${to}`;
          if (!next.some((e) => e.id === eid)) {
            next.push({ id: eid, source: from, target: to, animated: true });
          }
        };
        add(args.menu_id, msgId);
        add(msgId, backKbId);
        add(backKbId, args.menu_id);
        return next;
      });
    },
    [],
  );

  const removeMenuSection = useCallback(
    (args: { menu_id: string; section_msg_id: string }) => {
      const buttonAction = `screen:${args.section_msg_id}`;

      // Find back_kb synchronously from refs BEFORE any state updates.
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      const backEdge = currentEdges.find(
        (e) =>
          e.source === args.section_msg_id &&
          currentNodes.find((n) => n.id === e.target)?.data?.kind === "keyboard.inline",
      );
      const backKbId: string | null = backEdge?.target ?? null;

      setNodes((prev) =>
        prev
          .filter((n) => n.id !== args.section_msg_id && n.id !== backKbId)
          .map((n) => {
            if (n.id !== args.menu_id || n.data?.kind !== "keyboard.inline") return n;
            const filtered = parseMenuButtons((n.data?.params as any)?.buttons).filter(
              (b) => b.action !== buttonAction,
            );
            return {
              ...n,
              data: {
                ...n.data,
                params: {
                  ...((n.data?.params as Record<string, string>) ?? {}),
                  buttons: serializeMenuButtons(filtered),
                },
              },
            };
          }),
      );

      setEdges((prev) =>
        prev.filter(
          (e) =>
            e.source !== args.section_msg_id &&
            e.target !== args.section_msg_id &&
            (backKbId === null || (e.source !== backKbId && e.target !== backKbId)),
        ),
      );
    },
    [],
  );

  const updateMenuSection = useCallback(
    (args: {
      menu_id: string;
      section_msg_id: string;
      new_button_label?: string;
      new_content?: string;
    }) => {
      const buttonAction = `screen:${args.section_msg_id}`;
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === args.menu_id && n.data?.kind === "keyboard.inline" && args.new_button_label) {
            const updated = parseMenuButtons((n.data?.params as any)?.buttons).map((b) =>
              b.action === buttonAction ? { ...b, label: args.new_button_label! } : b,
            );
            return {
              ...n,
              data: {
                ...n.data,
                params: {
                  ...((n.data?.params as Record<string, string>) ?? {}),
                  buttons: serializeMenuButtons(updated),
                },
              },
            };
          }
          if (n.id === args.section_msg_id && args.new_content !== undefined) {
            const kind = (n.data?.kind as string) ?? "message.text";
            const key = kind === "message.photo" ? "photoUrl" : "text";
            return {
              ...n,
              data: {
                ...n.data,
                params: { ...((n.data?.params as Record<string, string>) ?? {}), [key]: args.new_content },
              },
            };
          }
          return n;
        }),
      );
    },
    [],
  );

  const serializeCanvas = useCallback(() => {
    const abbreviate = (kind: string, params: Record<string, string>) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(params ?? {})) {
        const s = String(v ?? "");
        out[k] = s.length > 80 ? s.slice(0, 80) + "…" : s;
      }
      return out;
    };
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: (n.data?.kind as string) ?? "",
        label: (n.data?.title as string) ?? (n.data?.label as string) ?? (n.data?.titleKey as string) ?? "",
        params: abbreviate((n.data?.kind as string) ?? "", (n.data?.params as Record<string, string>) ?? {}),
      })),
      edges: edges.map((e) => ({ from: e.source, to: e.target, sourceHandle: e.sourceHandle ?? null })),
      variables,
    };
  }, [nodes, edges, variables]);

  const mergePreview = useCallback((patch: Partial<AnvlPreviewState>) => {
    setPreview((cur) => ({ ...cur, ...patch }));
  }, []);

  const mergeMiniApp = useCallback((patch: Partial<AnvlMiniAppState>) => {
    setMiniApp((cur) => ({ ...cur, ...patch }));
  }, []);

  const { status: saveStatus, lastSavedAt, snapshotNow, flowId } = useFlowPersistence({
    slug,
    nodes,
    edges,
    preview,
    miniapp: miniApp,
    generatedCode,
    variables,
    onHydrate: hydrate,
    enabled: persist,
    autoCreate,
    onFlowCreated,
  });

  const lintIssues = useMemo<LintIssue[]>(() => {
    try { return lintFlow(nodes, edges, variables); }
    catch { return []; }
  }, [nodes, edges, variables]);

  const value = useMemo(
    () => ({
      nodes, edges, setNodes, setEdges,
      preview, miniApp, generatedCode, setGeneratedCode,
      variables, setVariables,
      applyBlueprint,
      addAiNode, connectAiNodes, updateAiNodeParam,
      removeAiNode, removeAiEdge, renameAiNode, serializeCanvas,
      mergePreview, mergeMiniApp, resetAiCanvas, relayoutCanvas,
      addMenuSection, removeMenuSection, updateMenuSection,
      saveStatus, lastSavedAt, snapshotNow,
      flowId, slug, rollbackToVersion,
      lintIssues,
    }),
    [nodes, edges, preview, miniApp, generatedCode, variables, applyBlueprint, addAiNode, connectAiNodes, updateAiNodeParam, removeAiNode, removeAiEdge, renameAiNode, serializeCanvas, mergePreview, mergeMiniApp, resetAiCanvas, relayoutCanvas, addMenuSection, removeMenuSection, updateMenuSection, saveStatus, lastSavedAt, snapshotNow, flowId, slug, rollbackToVersion, lintIssues],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnvlWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnvlWorkspace must be used inside AnvlWorkspaceProvider");
  return ctx;
}
