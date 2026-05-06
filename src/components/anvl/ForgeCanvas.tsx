import { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";

import { ForgeNode } from "./ForgeNode";
import { PreviewPhone } from "./PreviewPhone";
import { useAnvlWorkspace } from "./AnvlWorkspaceContext";
import { useSelection } from "./SelectionContext";
import { useBotSimulator } from "./BotSimulatorContext";
import { NODE_CATALOG } from "@/lib/anvl-catalog";
import type { NodeKind } from "@/lib/anvl-types";

function CanvasInner() {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { nodes, edges, setNodes, setEdges } = useAnvlWorkspace();
  const { setSelectedId } = useSelection();
  const { activeNodeId, activeEdgeId, cameraFollow } = useBotSimulator();

  // Camera follow: when toggle is on, smoothly center the canvas on the
  // currently active simulator node (only if it exists on the graph).
  useEffect(() => {
    if (!cameraFollow || !activeNodeId) return;
    if (!nodes.some((n) => n.id === activeNodeId)) return;
    const t = window.setTimeout(() => {
      try {
        fitView({ nodes: [{ id: activeNodeId }], duration: 600, padding: 0.4, maxZoom: 1.2 });
      } catch {
        /* node may have just unmounted */
      }
    }, 30);
    return () => window.clearTimeout(t);
  }, [cameraFollow, activeNodeId, nodes, fitView]);

  // Decorate edges: brighter solid stroke; the just-traversed edge gets a glow.
  const decoratedEdges = useMemo(() => {
    return edges.map((e) => {
      const baseStyle = {
        stroke: "var(--accent-primary, oklch(0.78 0.14 230))",
        strokeWidth: 2,
        opacity: 0.55,
        ...(e.style ?? {}),
      };
      if (e.id === activeEdgeId) {
        return {
          ...e,
          animated: true,
          style: {
            ...baseStyle,
            stroke: "oklch(0.78 0.18 145 / 95%)",
            strokeWidth: 2.4,
            opacity: 1,
            filter: "drop-shadow(0 0 6px oklch(0.78 0.18 145 / 60%))",
          },
        };
      }
      return { ...e, style: baseStyle };
    });
  }, [edges, activeEdgeId]);

  const nodeTypes = useMemo(() => ({ anvl: ForgeNode }), []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [setEdges],
  );
  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((es) => addEdge({ ...c, animated: true, type: "smoothstep" }, es)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/anvl-node") as NodeKind;
      if (!kind || !NODE_CATALOG[kind]) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `${Date.now()}`;
      setNodes((ns) => [
        ...ns,
        {
          id,
          type: "anvl",
          position,
          data: { kind },
        },
      ]);
    },
    [screenToFlowPosition, setNodes],
  );

  return (
    <div className="relative h-full w-full forge-grid">
      <ReactFlow
        nodes={nodes}
        edges={decoratedEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onPaneClick={() => setSelectedId(null)}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: true, type: "smoothstep" }}
        connectionRadius={48}
        snapToGrid
        snapGrid={[8, 8]}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="oklch(1 0 0 / 8%)" />
        <Controls showInteractive={false} />
      </ReactFlow>

      <div className="pointer-events-none absolute right-5 top-5 z-10">
        <div className="pointer-events-auto">
          <PreviewPhone />
        </div>
      </div>
    </div>
  );
}

export function ForgeCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
