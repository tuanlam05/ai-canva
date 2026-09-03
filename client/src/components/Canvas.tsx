import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useBoardStore } from "../store/boardStore.js";
import BoxNode from "./BoxNode.js";
import Cursors from "./Cursors.js";

const nodeTypes = {
  text: BoxNode,
  file: BoxNode,
  insight: BoxNode,
  journey: BoxNode,
  safety: BoxNode,
  coach: BoxNode,
};

export default function Canvas() {
  const nodes = useBoardStore((s) => s.nodes);
  const edges = useBoardStore((s) => s.edges);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const onEdgesChange = useBoardStore((s) => s.onEdgesChange);
  const onConnect = useBoardStore((s) => s.onConnect);
  const updateCursorPosition = useBoardStore((s) => s.updateCursorPosition);
  const cleanupPresence = useBoardStore((s) => s.cleanupPresence);

  const { screenToFlowPosition } = useReactFlow();

  // Track mouse movement and update presence
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      if (pos) {
        updateCursorPosition(pos.x, pos.y);
      }
    },
    [screenToFlowPosition, updateCursorPosition]
  );

  // Cleanup presence on unmount
  useEffect(() => {
    return () => cleanupPresence();
  }, [cleanupPresence]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onMouseMove={onMouseMove}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      defaultEdgeOptions={{
        animated: true,
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
      <Controls />
      <Cursors />
      <MiniMap
        pannable
        zoomable
        nodeColor={(node: Node) => {
          const colors: Record<string, string> = {
            idea: "#fbbf24",
            research: "#60a5fa",
            summarize: "#a78bfa",
            image: "#34d399",
            cartoon: "#f472b6",
            slides: "#fb923c",
            code: "#22d3ee",
            prd: "#818cf8",
            devplan: "#14b8a6",
            ui: "#c026d3",
            stitch: "#0ea5e9",
          };
          return colors[node.type || ""] || "#94a3b8";
        }}
      />
    </ReactFlow>
  );
}
