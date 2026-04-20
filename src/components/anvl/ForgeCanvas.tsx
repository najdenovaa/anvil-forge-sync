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
  const { screenToFlowPosition } = useReactFlow();
  const { nodes, edges, setNodes, setEdges } = useAnvlWorkspace();
  const { setSelectedId } = useSelection();

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
        edges={edges}
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
