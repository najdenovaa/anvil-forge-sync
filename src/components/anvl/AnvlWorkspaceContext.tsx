import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Edge, Node } from "reactflow";
import type { AnvlBlueprint, AnvlMiniAppState, AnvlPreviewState } from "@/lib/anvl-blueprint";
import { useFlowPersistence, type SaveStatus } from "./useFlowPersistence";
import type { FlowSnapshot } from "@/lib/anvl-flow-storage";

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
  applyBlueprint: (blueprint: AnvlBlueprint) => void;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  snapshotNow: (note?: string) => Promise<void>;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function AnvlWorkspaceProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [preview, setPreview] = useState<Partial<AnvlPreviewState>>({});
  const [miniApp, setMiniApp] = useState<Partial<AnvlMiniAppState>>({});
  const [generatedCode, setGeneratedCode] = useState("");

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
    if (snap.nodes?.length) setNodes(snap.nodes);
    if (snap.edges?.length) setEdges(snap.edges);
    if (snap.preview) setPreview(snap.preview);
    if (snap.miniapp) setMiniApp(snap.miniapp);
    if (snap.generatedCode) setGeneratedCode(snap.generatedCode);
  }, []);

  const { status: saveStatus, lastSavedAt, snapshotNow } = useFlowPersistence({
    slug: DEFAULT_FLOW_SLUG,
    nodes,
    edges,
    preview,
    miniapp: miniApp,
    generatedCode,
    onHydrate: hydrate,
  });

  const value = useMemo(
    () => ({
      nodes,
      edges,
      setNodes,
      setEdges,
      preview,
      miniApp,
      generatedCode,
      setGeneratedCode,
      applyBlueprint,
      saveStatus,
      lastSavedAt,
      snapshotNow,
    }),
    [nodes, edges, preview, miniApp, generatedCode, applyBlueprint, saveStatus, lastSavedAt, snapshotNow],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnvlWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAnvlWorkspace must be used inside AnvlWorkspaceProvider");
  return ctx;
}
