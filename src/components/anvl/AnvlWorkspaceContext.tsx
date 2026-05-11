import {
  createContext,
  useCallback,
  useContext,
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
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function AnvlWorkspaceProvider({
  children,
  slug = DEFAULT_FLOW_SLUG,
  persist = true,
}: {
  children: ReactNode;
  slug?: string;
  persist?: boolean;
}) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [preview, setPreview] = useState<Partial<AnvlPreviewState>>({});
  const [miniApp, setMiniApp] = useState<Partial<AnvlMiniAppState>>({});
  const [generatedCode, setGeneratedCode] = useState("");
  const [variables, setVariables] = useState<VariableDef[]>([]);
  const hydratedSlugRef = useRef<string | null>(null);

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
  });

  const value = useMemo(
    () => ({
      nodes, edges, setNodes, setEdges,
      preview, miniApp, generatedCode, setGeneratedCode,
      variables, setVariables,
      applyBlueprint,
      addAiNode, connectAiNodes, updateAiNodeParam,
      mergePreview, mergeMiniApp, resetAiCanvas, relayoutCanvas,
      saveStatus, lastSavedAt, snapshotNow,
      flowId, slug, rollbackToVersion,
    }),
    [nodes, edges, preview, miniApp, generatedCode, variables, applyBlueprint, addAiNode, connectAiNodes, updateAiNodeParam, mergePreview, mergeMiniApp, resetAiCanvas, relayoutCanvas, saveStatus, lastSavedAt, snapshotNow, flowId, slug, rollbackToVersion],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnvlWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnvlWorkspace must be used inside AnvlWorkspaceProvider");
  return ctx;
}
