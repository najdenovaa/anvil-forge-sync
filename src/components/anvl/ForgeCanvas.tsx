import { useCallback, useMemo, useRef, useState } from "react";
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
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";

import { ForgeNode } from "./ForgeNode";
import { NODE_CATALOG } from "@/lib/anvl-catalog";
import type { NodeKind } from "@/lib/anvl-types";
import { PreviewPhone } from "./PreviewPhone";

const initialNodes: Node[] = [
  {
    id: "1",
    type: "anvl",
    position: { x: 40, y: 120 },
    data: { kind: "trigger.command", title: "/start", preview: "When user sends /start" },
  },
  {
    id: "2",
    type: "anvl",
    position: { x: 320, y: 80 },
    data: {
      kind: "message.text",
      title: "Welcome",
      preview: "Hi {{user.first_name}} — welcome to Anvl.",
    },
  },
  {
    id: "3",
    type: "anvl",
    position: { x: 320, y: 240 },
    data: { kind: "keyboard.inline", title: "Main menu", preview: "Open app · Pricing · Help" },
  },
  {
    id: "4",
    type: "anvl",
    position: { x: 620, y: 240 },
    data: { kind: "miniapp.screen", title: "Dashboard", preview: "WebView · /app/home" },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e1-3", source: "1", target: "3", animated: true },
  { id: "e3-4", source: "3", target: "4", animated: true },
];

function CanvasInner() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const nodeTypes = useMemo(() => ({ anvl: ForgeNode }), []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [],
  );
  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => addEdge({ ...c, animated: true }, es)),
    [],
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
          data: { kind, title: NODE_CATALOG[kind].label },
        },
      ]);
    },
    [screenToFlowPosition],
  );

  return (
    <div ref={wrapperRef} className="relative h-full w-full forge-grid">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ animated: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="oklch(1 0 0 / 8%)" />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* Floating preview */}
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
