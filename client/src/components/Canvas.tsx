import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  useViewport,
  type Node,
} from "@xyflow/react";
import { useBoardStore } from "../store/boardStore.js";
import { AREA_COLORS } from "../types.js";
import { fitGroupFrames, isValidAreaSize, normalizeRect } from "../lib/areas.js";
import { Button } from "./ui/Button.js";
import { SquareIcon } from "./ui/icons.js";
import { STEP_HEX } from "../lib/nodeView.js";
import { useTheme } from "../lib/theme.js";
import BoxNode from "./BoxNode.js";
import AreaNode from "./AreaNode.js";
import Cursors from "./Cursors.js";

const nodeTypes = {
  text: BoxNode,
  insight: BoxNode,
  journey: BoxNode,
  documents: BoxNode,
  coach: BoxNode,
  safety: BoxNode,
  summary: BoxNode,
  note: BoxNode,
  label: BoxNode,
  checklist: BoxNode,
  area: AreaNode,
};

const SIDEBAR_WIDTH = 232;

/** Fit the whole board, leaving room for the Add Box panel on the right and
 *  the zoom / help controls along the bottom. */
const FIT_PADDING = { top: "56px", left: "48px", right: "272px", bottom: "96px" } as const;

export default function Canvas({ sidebarOpen = false }: { sidebarOpen?: boolean }) {
  const nodes = useBoardStore((s) => s.nodes);
  const edges = useBoardStore((s) => s.edges);
  const onNodesChange = useBoardStore((s) => s.onNodesChange);
  const onEdgesChange = useBoardStore((s) => s.onEdgesChange);
  const onConnect = useBoardStore((s) => s.onConnect);
  const updateCursorPosition = useBoardStore((s) => s.updateCursorPosition);
  const cleanupPresence = useBoardStore((s) => s.cleanupPresence);
  const boxData = useBoardStore((s) => s.boxData);
  const colorMode = useTheme((s) => s.resolved);
  const detachFromArea = useBoardStore((s) => s.detachFromArea);

  // Ctrl+drag (⌘+drag on Mac) a box to take it out of its group frame, so
  // the frame stops stretching after it.
  const onNodeDragStart = useCallback(
    (e: MouseEvent | TouchEvent, node: Node) => {
      if (node.type === "area") return;
      if (e.ctrlKey || e.metaKey) detachFromArea(node.id);
    },
    [detachFromArea]
  );
  // Display-only node tweaks:
  //  - group frames that hug their boxes (demo board);
  //  - stacking: React Flow's own "raise the selected node" is off
  //    (elevateNodesOnSelect below) because it lifted a selected area over
  //    the boxes inside it. Selected boxes are raised here instead, and areas
  //    always stay underneath (their handles/colour picker sit on or above
  //    the frame edge, so they remain reachable).
  const displayNodes = useMemo(
    () =>
      fitGroupFrames(nodes).map((n) =>
        n.type !== "area" && n.selected ? { ...n, zIndex: 1000 } : n,
      ),
    [nodes],
  );

  // Connector styles (presentation only; stored edges just gain a class):
  //  - "running": the box it feeds is running → data flows along it;
  //  - "waiting": its source step hasn't produced anything yet → dashed.
  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const src = boxData[e.source];
        const hasOutput =
          !!src &&
          (!!src.output?.trim() ||
            !!src.content?.trim() ||
            (src.documents || []).some((d) => !d.error && d.text));
        const running = boxData[e.target]?.status === "running";
        const waiting = !running && !!src && !hasOutput;
        const base = (e.className || "").replace(/\s*edge-(waiting|running)/g, "").trim();
        const extra = running ? "edge-running" : waiting ? "edge-waiting" : "";
        const className = [base, extra].filter(Boolean).join(" ") || undefined;
        return className === e.className ? e : { ...e, className };
      }),
    [edges, boxData]
  );

  const { screenToFlowPosition, fitView } = useReactFlow();

  // Re-fit the view when the board is replaced (demo load / Reset): the
  // initial fitView runs before the demo boxes exist. Waits a moment so the
  // new boxes are measured first.
  const fitRequest = useBoardStore((s) => s.fitRequest);
  useEffect(() => {
    if (!fitRequest) return;
    const t = setTimeout(() => fitView({ padding: FIT_PADDING, duration: 250 }), 120);
    return () => clearTimeout(t);
  }, [fitRequest, fitView]);

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

  // Touch mirror of the presence cursor — iPads never fire mousemove, so
  // collaborators would otherwise not see where the tablet user is pointing.
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const pos = screenToFlowPosition({ x: t.clientX, y: t.clientY });
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

  // === Area drawing tool ===
  const addArea = useBoardStore((s) => s.addArea);
  const [areaTool, setAreaTool] = useState(false);
  const [areaColorIdx, setAreaColorIdx] = useState(0);
  const [draft, setDraft] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Begin a draft on pane mousedown while the tool is active; track the drag
  // with window listeners so the rectangle keeps following the cursor even
  // outside the pane.
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!areaTool) return;
      // Only start on empty canvas — not on an existing node/area.
      const target = e.target as HTMLElement;
      if (!target.classList.contains("react-flow__pane")) return;
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setDraft({ start: p, current: p });
      e.preventDefault();
    },
    [areaTool, screenToFlowPosition]
  );

  useEffect(() => {
    if (!draft) return;
    const track = (clientX: number, clientY: number) => {
      const d = draftRef.current;
      if (!d) return;
      setDraft({ ...d, current: screenToFlowPosition({ x: clientX, y: clientY }) });
    };
    const onMove = (e: MouseEvent) => track(e.clientX, e.clientY);
    const commit = () => {
      const d = draftRef.current;
      setDraft(null);
      if (!d) return;
      const rect = normalizeRect(d.start, d.current);
      if (isValidAreaSize(rect)) {
        const c = AREA_COLORS[areaColorIdx] || AREA_COLORS[0];
        addArea(rect, c.fill, c.border);
      }
    };
    const onTouchMove = (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length !== 1) return;
      te.preventDefault();
      track(te.touches[0].clientX, te.touches[0].clientY);
    };
    const onTouchCancel = () => setDraft(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", commit);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", commit);
    window.addEventListener("touchcancel", onTouchCancel);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", commit);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", commit);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [draft !== null, areaColorIdx, addArea, screenToFlowPosition]);

  // Touch mirror of onCanvasMouseDown — iPads never fire the synthesized
  // mousedown on the pane (React Flow's touch handlers suppress it), so the
  // Area tool needs its own touchstart listener while it is active.
  useEffect(() => {
    if (!areaTool) return;
    const pane = document.querySelector<HTMLElement>(".react-flow__pane");
    if (!pane) return;
    const onTouchStart = (e: Event) => {
      const te = e as TouchEvent;
      if (te.touches.length !== 1) return;
      const target = te.target as HTMLElement;
      if (!target.classList.contains("react-flow__pane")) return;
      const t = te.touches[0];
      const p = screenToFlowPosition({ x: t.clientX, y: t.clientY });
      setDraft({ start: p, current: p });
      te.preventDefault();
    };
    pane.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => pane.removeEventListener("touchstart", onTouchStart);
  }, [areaTool, screenToFlowPosition]);

  // Undo / redo: Ctrl+Z (⌘Z), Ctrl+Shift+Z (⌘⇧Z) or Ctrl+Y. Inside a text
  // field the browser's own text undo applies instead.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        useBoardStore.getState().undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        useBoardStore.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Escape cancels an in-progress draft and deactivates the tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDraft(null);
      setAreaTool(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const draftRect = draft ? normalizeRect(draft.start, draft.current) : null;

  return (
    <ReactFlow
      nodes={displayNodes}
      edges={styledEdges}
      elevateNodesOnSelect={false}
      // A box only starts dragging after the pointer moves 5px, so a normal
      // click (which usually wobbles a pixel or two) still opens cards and
      // presses buttons on the first try.
      nodeDragThreshold={5}
      onNodeDragStart={onNodeDragStart}
      // Multi-select is Shift+click (React Flow's default is Ctrl/⌘), so that
      // Ctrl/⌘ is free for "drag a box out of its frame" above.
      multiSelectionKeyCode="Shift"
      nodeTypes={nodeTypes}
      colorMode={colorMode}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onMouseMove={onMouseMove}
      onMouseDown={onCanvasMouseDown}
      onTouchMove={onTouchMove}
      // Double-tap / double-click zoom is surprising on touch — the pinch
      // gesture already covers zooming.
      zoomOnDoubleClick={false}
      // While the area tool is active, dragging draws a rectangle instead of
      // panning the canvas or moving nodes.
      panOnDrag={!areaTool}
      nodesDraggable={!areaTool}
      className={areaTool ? "area-tool-active" : undefined}
      fitView
      fitViewOptions={{ padding: FIT_PADDING }}
      // The full demo flow is wider than a screen at React Flow's default
      // minimum zoom (0.5), which cut off the inputs; allow zooming out
      // far enough to see the whole board.
      minZoom={0.2}
      defaultEdgeOptions={{
        animated: true,
      }}
      proOptions={{ hideAttribution: true }}
      // Treat every node as a "no wheel" zone: when the cursor is over a box,
      // trackpad scroll / pinch must not zoom the canvas (it would fight the
      // box's own scrolling). Zooming still works over empty canvas space.
      noWheelClassName="react-flow__node"
    >
      {/* Canvas background: a faint square grid every 5 cells, with a dot at
        every cell — graph paper, so the board reads as a canvas. */}
      <Background
        id="grid-major"
        variant={BackgroundVariant.Lines}
        gap={110}
        lineWidth={1}
        color="var(--canvas-grid)"
        bgColor="var(--canvas-bg)"
      />
      <Background
        id="grid-dots"
        variant={BackgroundVariant.Dots}
        gap={22}
        size={2.2}
        color="var(--canvas-dot)"
        bgColor="transparent"
      />
      <Controls position="bottom-center" orientation="horizontal" />
      <Cursors />
      {/* Area drawing tool */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        <Button
          size="xs"
          variant={areaTool ? "primary" : "secondary"}
          onClick={() => { setAreaTool((t) => !t); setDraft(null); }}
          title="Draw a rectangular area under the boxes"
        >
          <SquareIcon /> {areaTool ? "Drawing areas — Esc to stop" : "Area"}
        </Button>
        {areaTool && (
          <div className="flex items-center gap-1.5 rounded-[10px] bg-surface px-2 py-1.5 border border-line [box-shadow:var(--shadow-float)]">
            {AREA_COLORS.map((c, i) => (
              <button
                key={c.fill}
                onClick={() => setAreaColorIdx(i)}
                title={`Draw color — ${c.name}`}
                className={
                  "w-5 h-5 rounded-md border transition hover:scale-110 " +
                  (i === areaColorIdx ? "border-slate-600 scale-110" : "border-slate-300")
                }
                style={{ backgroundColor: c.fill, borderColor: i === areaColorIdx ? c.border : undefined }}
              />
            ))}
          </div>
        )}
      </div>
      {/* Draft rectangle preview (viewport-transformed like Cursors) */}
      {draftRect && <AreaDraft rect={draftRect} />}
      <MiniMap
        pannable
        zoomable
        style={{
          right: (sidebarOpen ? SIDEBAR_WIDTH : 0) + 16,
          transition: "right 300ms",
        }}
        nodeColor={(node: Node) => {
          const colors: Record<string, string> = {
            ...(STEP_HEX as Record<string, string>),
            note: "#fbbf24",
            label: "#8A8F98",
            checklist: "#8A8F98",
          };
          if (node.type === "area") {
            // Areas are near-white on the minimap — use their border shade.
            return (node.data as any)?.border || "#cbd5e1";
          }
          return colors[node.type || ""] || "#A3A8B1";
        }}
      />
    </ReactFlow>
  );
}

/** In-progress area rectangle, transformed with the viewport like Cursors. */
function AreaDraft({ rect }: { rect: { x: number; y: number; width: number; height: number } }) {
  const viewport = useViewport();
  return (
    <div
      className="absolute inset-0 pointer-events-none z-20"
      style={{
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        transformOrigin: "0 0",
      }}
    >
      <div
        className="absolute rounded-xl"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          backgroundColor: "rgba(6, 182, 212, 0.06)",
          border: "1.5px dashed #06b6d4",
        }}
      />
    </div>
  );
}
