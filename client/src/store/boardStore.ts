import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rfAddEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import type {
  BoxData,
  BoxType,
  BoxStatus,
  NamedInput,
  ChecklistItem,
} from "../types.js";
import { BOX_TYPES } from "../types.js";

import { generate } from "../lib/api.js";
import { fillPromptTemplate, getBoxOutput } from "../lib/prompts.js";

import { buildDocumentsOutput } from "../lib/documents.js";
import { cleanBoxDataForFirestore } from "../lib/serialization.js";
import type { CustomBoxDef } from "../lib/customBoxes.js";
import {
  saveBoard,
  loadBoard,
  listBoards,
  listSharedBoards,
  deleteBoard,
  subscribeToBoard,
  subscribeToPresence,
  updatePresence,
  removePresence,
  shareBoard as fsShareBoard,
  unshareBoard as fsUnshareBoard,
  updateBoardData,
  recordTokenUsage,
  type BoardDoc,
} from "../lib/firestore.js";
import type { PresenceUser, Theme } from "../types.js";
import { useAuthStore } from "./authStore.js";
import { getUserEmail } from "../lib/admin.js";
import { useTokenStore } from "./tokenStore.js";

function makeId(): string {
  return `box-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Debounced save to Firestore — triggers 1s after the last change
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    useBoardStore.getState().saveToFirestore();
  }, 1000);
}

// === Collaboration helpers ===

const CURSOR_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#14b8a6",
];

function getInitials(email: string): string {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getColorForEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++)
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// Track last local save time to prevent onSnapshot echo
let lastSaveTime = 0;
let lastSavedUpdatedAt = 0;

// Throttle presence updates to max 1 write per 200ms
let presenceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPresence: { x: number; y: number } | null = null;
// Presence heartbeat: keeps lastActive fresh every 15s so users who are on
// the board but not moving their mouse stay listed as online (the roster
// filters out entries stale for >30s).
let presenceHeartbeat: ReturnType<typeof setInterval> | null = null;

// Subscription cleanup functions
let boardUnsub: (() => void) | null = null;
let presenceUnsub: (() => void) | null = null;

// Agent runs that a user asked to stop — checked between agent turns (the
// current LLM call/run always finishes; the loop halts before the next one).
const agentCancelled = new Set<string>();

interface CollectedInputs {
  namedInputs: NamedInput[];
  inputImage?: string;
}

/**
 * Gathers upstream inputs for a box: walks incoming edges, collects text
 * outputs (documents boxes contribute their extracted-file text) and the
 * first image input. Also includes the box's own `content` so AI boxes work
 * standalone — pass `skipSelf: true` to exclude it (the Agent box uses this,
 * since its `content` is the task and travels in the context separately).
 */
function collectInputs(
  nodes: Node[],
  edges: Edge[],
  boxData: Record<string, BoxData>,
  id: string,
  opts: { skipSelf?: boolean } = {},
): CollectedInputs {
  let inputImage: string | undefined;
  const namedInputs: NamedInput[] = [];

  const incomingEdges = edges.filter((e) => e.target === id);
  for (const edge of incomingEdges) {
    const sourceData = boxData[edge.source];
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (sourceData) {
      // Check for image data (from Image Upload boxes)
      if (sourceData.imageData) {
        if (!inputImage) inputImage = sourceData.imageData;
      }
      // Gather text output with the source box name. Documents boxes
      // derive their output from the extracted file text (labeled by
      // filename) — see lib/documents.ts.
      const textOutput = sourceData.documents?.length
        ? buildDocumentsOutput(sourceData.documents)
        : getBoxOutput(sourceData.output, sourceData.content);
      if (textOutput) {
        namedInputs.push({
          name: (sourceNode?.data?.title as string) || "Unnamed",
          output: textOutput,
        });
      }
    }
  }

  if (!opts.skipSelf) {
    const data = boxData[id];
    const node = nodes.find((n) => n.id === id);
    // Also include this box's own content (lets AI boxes work standalone)
    if (data && data.content && data.content.trim()) {
      namedInputs.push({
        name: (node?.data?.title as string) || "This Box",
        output: data.content.trim(),
      });
    }
  }

  return { namedInputs, inputImage };
}

/** Box types whose output is code a change request can be applied to. */
function isCodeBoxType(type: BoxType | string): boolean {
  return type === "code" || type === "ui";
}

function defaultBoxData(type: BoxType): BoxData {
  const meta = BOX_TYPES[type];
  return {
    content: "",
    prompt: meta.defaultPrompt,
    systemPrompt: meta.defaultSystemPrompt,
    output: "",
    status: "idle" as BoxStatus,
    imageData: undefined,
    outputImage: undefined,
    documents: undefined,
    // Checklist boxes: the shared task array is created EMPTY but DEFINED
    // (Firestore-safe, and the panel can rely on it existing).
    ...(type === "checklist" ? { checklistItems: [] } : null),
  };
}

interface BoardState {
  nodes: Node[];
  edges: Edge[];
  boxData: Record<string, BoxData>;

  // Board management (Firestore)
  currentBoardId: string | null;
  boardTitle: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  boardList: BoardDoc[];
  collaborators: string[];
  activeUsers: PresenceUser[];

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addBox: (type: BoxType, position?: { x: number; y: number }) => string;
  updateBoxData: (id: string, patch: Partial<BoxData>) => void;
  addArea: (
    rect: { x: number; y: number; width: number; height: number },
    fill: string,
    border: string,
  ) => string;
  addCustomBox: (
    def: CustomBoxDef,
    position?: { x: number; y: number },
  ) => string;
  setAreaColor: (id: string, fill: string, border: string) => void;
  setBoxName: (id: string, name: string) => void;
  deleteBox: (id: string) => void;
  runBox: (id: string) => Promise<void>;
  rerunTheme: (id: string, themeIndex: number) => Promise<void>;
  /** Programmatic edge creation — used by the Agent box to wire the boxes it
   *  makes. Dedupes and rejects self-connections like a manual connect. */
  connectBoxes: (sourceId: string, targetId: string) => boolean;
  /**
   * Checklist box (collab): replace the shared task list. Every mutation is a
   * pure function in `lib/checklist.ts` (add/parse, toggle with attribution,
   * assign, rename, reorder, clear done) — the store only stores the result,
   * so the whole list syncs to collaborators through the normal board save.
   */
  setChecklistItems: (id: string, items: ChecklistItem[]) => void;

  setBoxStatus: (id: string, status: BoxStatus, error?: string) => void;

  // Board operations (Firestore)
  createNewBoard: (title?: string) => Promise<void>;
  loadBoardFromFirestore: (boardId: string) => Promise<void>;
  saveToFirestore: () => Promise<void>;
  setBoardTitle: (title: string) => void;
  refreshBoardList: () => Promise<void>;
  deleteCurrentBoard: () => Promise<void>;
  clearBoard: () => void;

  // Collaboration
  subscribeToBoardUpdates: () => void;
  unsubscribeFromBoard: () => void;
  shareBoard: (emails: string[]) => Promise<void>;
  unshareBoard: (email: string) => Promise<void>;
  updateCursorPosition: (x: number, y: number) => void;
  cleanupPresence: () => void;
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      boxData: {},
      currentBoardId: null,
      boardTitle: "Untitled Board",
      saveStatus: "idle",
      boardList: [],
      collaborators: [],
      activeUsers: [],

      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
        scheduleSave();
      },

      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
        scheduleSave();
      },

      onConnect: (connection) => {
        set({
          edges: rfAddEdge({ ...connection, animated: true }, get().edges),
        });
        scheduleSave();
      },

      addBox: (type, position) => {
        const id = makeId();
        const meta = BOX_TYPES[type];
        const node: Node = {
          id,
          type,
          position: position || {
            x: 200 + Math.random() * 200,
            y: 150 + Math.random() * 100,
          },
          data: {
            boxType: type,
            // Chatbots get a friendly companion name instead of "… Box",
            // and are auto-placed at the viewport bottom by Canvas.
            title: `${meta.label} Box`,
          },
          style: { width: meta.defaultWidth, height: meta.defaultHeight },
        };

        set({
          nodes: [...get().nodes, node],
          boxData: {
            ...get().boxData,
            [id]: {
              ...defaultBoxData(type),
              // Notes are a communication tool — attribute them to their
              // author (set once at creation, shown under the note text).
              ...(type === "note"
                ? {
                    authorEmail: useAuthStore.getState().user?.email || "",
                    authorName:
                      useAuthStore.getState().user?.displayName ||
                      useAuthStore.getState().user?.email ||
                      "Someone",
                  }
                : null),
            },
          },
        });

        scheduleSave();
        return id;
      },

      // === Areas (drawn rectangles under the boxes) ===

      addArea: (rect, fill, border) => {
        const id = makeId().replace("box-", "area-");
        const node: Node = {
          id,
          type: "area",
          position: { x: rect.x, y: rect.y },
          style: { width: rect.width, height: rect.height },
          // Areas render BELOW all boxes (default node z is 0; React Flow
          // elevates the selected node by 1000 so a selected area's color
          // dots stay reachable even where boxes overlap it).
          zIndex: -1,
          data: { fill, border },
        };
        set({ nodes: [...get().nodes, node] });
        scheduleSave();
        return id;
      },

      setAreaColor: (id, fill, border) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, fill, border } } : n,
          ),
        });
        scheduleSave();
      },

      // Custom box: instantiate a saved template as a `custom`-type AI box.
      // The definition's prompt/systemPrompt/icon/color are COPIED onto the
      // instance, so boards stay self-contained and deleting the saved
      // definition later never affects boxes already on boards.
      addCustomBox: (def, position) => {
        const id = makeId();
        const meta = BOX_TYPES.custom;
        const node: Node = {
          id,
          type: "custom",
          position: position || {
            x: 200 + Math.random() * 200,
            y: 150 + Math.random() * 100,
          },
          data: {
            boxType: "custom",
            title: def.label + " Box",
            customLabel: def.label,
            customIcon: def.icon,
            customColor: def.color,
          },
          style: { width: meta.defaultWidth, height: meta.defaultHeight },
        };
        set({
          nodes: [...get().nodes, node],
          boxData: {
            ...get().boxData,
            [id]: {
              content: "",
              prompt: def.prompt,
              systemPrompt: def.systemPrompt,
              output: "",
              status: "idle" as BoxStatus,
              imageData: undefined,
              outputImage: undefined,
            },
          },
        });
        scheduleSave();
        return id;
      },

      updateBoxData: (id, patch) => {
        const current = get().boxData[id];
        if (!current) return;
        set({
          boxData: {
            ...get().boxData,
            [id]: { ...current, ...patch },
          },
        });
        scheduleSave();
      },

      setBoxName: (id, name) => {
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, title: name } } : n,
          ),
        });
        scheduleSave();
      },

      deleteBox: (id) => {
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter((e) => e.source !== id && e.target !== id),
          boxData: Object.fromEntries(
            Object.entries(get().boxData).filter(([k]) => k !== id),
          ),
        });
        scheduleSave();
      },

      setBoxStatus: (id, status, error) => {
        get().updateBoxData(id, { status, error });
      },

      connectBoxes: (sourceId, targetId) => {
        if (!sourceId || !targetId || sourceId === targetId) return false;
        const edges = get().edges;
        const exists = edges.some(
          (e) => e.source === sourceId && e.target === targetId,
        );
        if (exists) return false;
        set({
          edges: rfAddEdge(
            {
              source: sourceId,
              target: targetId,
              sourceHandle: null,
              targetHandle: null,
              animated: true,
            } as Connection,
            edges,
          ),
        });
        scheduleSave();
        return true;
      },

      // Checklist box (collab): the store only persists the result of the pure
      // mutations in lib/checklist.ts. A no-op edit returns the same array, so
      // that write never happens.
      setChecklistItems: (id, items) => {
        const data = get().boxData[id];
        if (!data) return;
        // The pure mutators keep the reference of every task they did not
        // touch, so an all-identical list means "nothing changed" — skip the
        // write entirely rather than re-saving the same board.
        const prev = data.checklistItems || [];
        if (
          prev.length === items.length &&
          prev.every((it, i) => it === items[i])
        )
          return;
        get().updateBoxData(id, { checklistItems: items });
      },

      // --- Firestore board operations ---

      createNewBoard: async (title) => {
        const user = useAuthStore.getState().user;
        if (!user) return;
        const boardId = makeId();
        const now = Date.now();
        await saveBoard({
          id: boardId,
          title: title || "Untitled Board",
          ownerId: user.uid,
          ownerEmail: user.email || "",
          collaborators: [],
          nodes: [],
          edges: [],
          boxData: {},
          createdAt: now,
          updatedAt: now,
        });
        set({
          currentBoardId: boardId,
          boardTitle: title || "Untitled Board",
          collaborators: [],
          nodes: [],
          edges: [],
          boxData: {},
          saveStatus: "saved",
        });
        get().refreshBoardList();
      },

      loadBoardFromFirestore: async (boardId) => {
        const board = await loadBoard(boardId);
        if (!board) return;
        console.log(
          "[load] Board collaborators from Firestore:",
          board.collaborators,
        );
        set({
          currentBoardId: board.id,
          boardTitle: board.title,
          collaborators: board.collaborators || [],
          nodes: board.nodes as Node[],
          edges: board.edges as Edge[],
          boxData: board.boxData as Record<string, BoxData>,
          saveStatus: "saved",
          activeUsers: [],
        });
        // Subscription is handled automatically by the useEffect in App.tsx
        // that watches currentBoardId — no need to manually subscribe here
      },

      saveToFirestore: async () => {
        const state = get();
        const user = useAuthStore.getState().user;
        if (!user || !state.currentBoardId) return;
        set({ saveStatus: "saving" });
        lastSaveTime = Date.now();
        lastSavedUpdatedAt = Date.now();
        console.log(
          "[save] email:",
          user.email,
          "| uid:",
          user.uid,
          "| boardId:",
          state.currentBoardId,
        );
        console.log("[save] collaborators in store:", state.collaborators);
        try {
          // Strip undefined values and base64 imageData from boxData.
          // updateDoc rejects undefined values, so we must remove them entirely.
          // imageData (base64) is also removed to stay under Firestore's 1MB limit.
          const cleanBoxData = cleanBoxDataForFirestore(state.boxData);
          // Use updateBoardData (not saveBoard) so we do NOT overwrite
          // ownerId/ownerEmail/createdAt — collaborators can save without claiming ownership
          // Only save board CONTENT — do NOT include collaborators.
          // Collaborators are managed by shareBoard/unshareBoard (arrayUnion/arrayRemove).
          // Including collaborators here could overwrite the real list and break access.
          const saveTimestamp = Date.now();
          await updateBoardData(state.currentBoardId, {
            title: state.boardTitle,
            nodes: state.nodes,
            edges: state.edges,
            boxData: cleanBoxData,
            updatedAt: saveTimestamp,
          });
          lastSavedUpdatedAt = saveTimestamp;
          console.log(
            "[save] SUCCESS | updatedAt:",
            saveTimestamp,
            "| user:",
            user.email,
          );
          set({ saveStatus: "saved" });
        } catch (err) {
          console.error("Firestore save failed:", err);
          set({ saveStatus: "error" });
        }
      },

      setBoardTitle: (title) => {
        set({ boardTitle: title });
        scheduleSave();
      },

      refreshBoardList: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;
        try {
          // Guests (workshop code users) have no auth email — fall back to
          // their profile email from users/{uid} so email-shared boards still
          // appear for them.
          const email = user.email || (await getUserEmail(user.uid));
          const [owned, shared] = await Promise.all([
            listBoards(user.uid),
            email || user.uid
              ? listSharedBoards(email, user.uid)
              : Promise.resolve([]),
          ]);
          // Merge, deduplicate by id, sort by updatedAt desc
          const seen = new Set<string>();
          const all = [...owned, ...shared].filter((b) => {
            if (seen.has(b.id)) return false;
            seen.add(b.id);
            return true;
          });
          set({ boardList: all.sort((a, b) => b.updatedAt - a.updatedAt) });
        } catch (err) {
          console.error("Failed to list boards:", err);
        }
      },

      deleteCurrentBoard: async () => {
        const state = get();
        if (!state.currentBoardId) return;
        try {
          await deleteBoard(state.currentBoardId);
          set({
            currentBoardId: null,
            boardTitle: "Untitled Board",
            nodes: [],
            edges: [],
            boxData: {},
            saveStatus: "idle",
          });
          get().refreshBoardList();
        } catch (err) {
          console.error("Failed to delete board:", err);
        }
      },

      clearBoard: () => {
        get().unsubscribeFromBoard();
        set({
          nodes: [],
          edges: [],
          boxData: {},
          currentBoardId: null,
          boardTitle: "Untitled Board",
          collaborators: [],
          activeUsers: [],
        });
      },

      // === Collaboration actions ===

      subscribeToBoardUpdates: () => {
        const state = get();
        if (!state.currentBoardId) return;
        const boardId = state.currentBoardId;
        console.log("[store] Subscribing to board updates:", boardId);

        // Subscribe to board document changes (real-time sync)
        boardUnsub = subscribeToBoard(boardId, (board) => {
          // Echo prevention: compare the snapshot's updatedAt with our last saved updatedAt.
          // If they match, this is our own save echoing back — skip it.
          // If they differ, it's another user's update — apply it.
          const isEcho = board.updatedAt === lastSavedUpdatedAt;
          console.log(
            "[sync] onSnapshot | board.updatedAt:",
            board.updatedAt,
            "| myLastSaved:",
            lastSavedUpdatedAt,
            "| isEcho:",
            isEcho,
            "| me:",
            useAuthStore.getState().user?.email,
          );
          if (isEcho) return;
          console.log(
            "[sync] Applying remote update | nodes:",
            board.nodes?.length,
            "| edges:",
            board.edges?.length,
          );
          set({
            nodes: board.nodes as Node[],
            edges: board.edges as Edge[],
            boxData: board.boxData as Record<string, BoxData>,
            boardTitle: board.title,
            collaborators: board.collaborators || [],
          });
        });

        // Subscribe to presence (live cursors)
        presenceUnsub = subscribeToPresence(boardId, (users) => {
          set({ activeUsers: users });
        });

        // Presence heartbeat: even without mouse movement, refresh
        // lastActive every 15s so the online roster stays accurate.
        if (presenceHeartbeat) clearInterval(presenceHeartbeat);
        presenceHeartbeat = setInterval(async () => {
          const user = useAuthStore.getState().user;
          const bid = get().currentBoardId;
          if (!user || !bid) return;
          try {
            await updatePresence(bid, user.uid, {
              userId: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email || "",
              initials: getInitials(user.email || user.uid),
              color: getColorForEmail(user.email || user.uid),
              ...(pendingPresence || {}), // keep the last known cursor, if any
            });
          } catch {
            // best-effort
          }
        }, 15000);
      },

      unsubscribeFromBoard: () => {
        if (boardUnsub) {
          boardUnsub();
          boardUnsub = null;
        }
        if (presenceUnsub) {
          presenceUnsub();
          presenceUnsub = null;
        }
        if (presenceHeartbeat) {
          clearInterval(presenceHeartbeat);
          presenceHeartbeat = null;
        }
        get().cleanupPresence();
        set({ activeUsers: [] });
      },

      shareBoard: async (emails) => {
        const state = get();
        if (!state.currentBoardId) return;
        const user = useAuthStore.getState().user;
        if (!user) return;
        try {
          await fsShareBoard(state.currentBoardId, emails);
          set({ collaborators: [...get().collaborators, ...emails] });
        } catch (err) {
          console.error("Failed to share board:", err);
        }
      },

      unshareBoard: async (email) => {
        const state = get();
        if (!state.currentBoardId) return;
        try {
          await fsUnshareBoard(state.currentBoardId, email);
          set({
            collaborators: get().collaborators.filter((e) => e !== email),
          });
        } catch (err) {
          console.error("Failed to unshare:", err);
        }
      },

      updateCursorPosition: (x, y) => {
        const state = get();
        if (!state.currentBoardId) return;
        const user = useAuthStore.getState().user;
        if (!user) return;

        pendingPresence = { x, y };
        if (presenceTimer) return; // already scheduled

        presenceTimer = setTimeout(async () => {
          presenceTimer = null;
          if (!pendingPresence) return;
          const { x, y } = pendingPresence;
          pendingPresence = null;
          const boardId = get().currentBoardId;
          if (!boardId) return;
          try {
            await updatePresence(boardId, user.uid, {
              userId: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email || "",
              initials: getInitials(user.email || user.uid),
              color: getColorForEmail(user.email || user.uid),
              cursorX: x,
              cursorY: y,
            });
          } catch {
            // ignore — presence is best-effort
          }
        }, 200);
      },

      cleanupPresence: () => {
        const state = get();
        const user = useAuthStore.getState().user;
        if (!state.currentBoardId || !user) return;
        if (presenceTimer) {
          clearTimeout(presenceTimer);
          presenceTimer = null;
        }
        removePresence(state.currentBoardId, user.uid).catch(() => {});
      },

      runBox: async (id) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === id);
        const data = state.boxData[id];

        if (!node || !data) return;
        if (data.status === "running") return;

        const boxType = (node.data.boxType || node.type) as BoxType;

        // Collaboration boxes (note / label / timer / checklist) have no AI to
        // run — the Run button is hidden for them. Guard here too so no future
        // caller falls into the text-AI branch.
        // The chatbot talks via sendChatMessage, never via runBox.
        if (
          boxType === "note" ||
          boxType === "label" ||
          boxType === "checklist"
        ) {
          return;
        }

        // Gather upstream inputs
        const { namedInputs } = collectInputs(
          state.nodes,
          state.edges,
          state.boxData,
          id,
        );

        if (Object.keys(namedInputs).length === 0) {
          get().updateBoxData(id, {
            status: "error",
            error: "This box needs at least one attached context box.",
          });
          return;
        }

        // Set running state
        get().setBoxStatus(id, "running");

        try {
          const filledPrompt = fillPromptTemplate(data.prompt, namedInputs);

          const result = await generateTextForBox(id, {
            systemPrompt: data.systemPrompt,
            userPrompt: filledPrompt,
            boxType,
          });

          get().updateBoxData(id, {
            output: result.content,
            status: "done",
            error: undefined,
          });
        } catch (err: any) {
          get().setBoxStatus(id, "error", err.message || "Generation failed");
        }
      },

      rerunTheme: async (id: string, themeIndex: number) => {
        const state = get();
        const node = state.nodes.find((n) => n.id === id);
        const data = state.boxData[id];
        if (!node || !data) return;

        const { namedInputs } = collectInputs(
          state.nodes,
          state.edges,
          state.boxData,
          id,
        );
        if (Object.keys(namedInputs).length === 0) {
          get().updateBoxData(id, {
            status: "error",
            error: "This box needs at least one attached context box.",
          });
          return;
        }

        const parsed = JSON.parse(data.output);
        const currentThemes = parsed.themes as Theme[];
        const rejectedTheme = currentThemes[themeIndex];
        const otherThemes = currentThemes.filter((_, i) => i !== themeIndex);

        const rerunInstruction = `Re-run theme extraction on the research material below, but exclude "${rejectedTheme.theme}" (rejected as not useful). Generate ONE alternative theme from the remaining evidence that is not already covered by: ${otherThemes.map((t) => t.theme).join(", ")}. Follow the same grounding rules — only include a theme if there is direct verbatim quote evidence for it. If no distinct alternative theme exists, return { "themes": [] }.`;

        // Reuse the box's existing prompt template, but prepend the exclusion instruction
        const filledPrompt =
          rerunInstruction +
          "\n\n" +
          fillPromptTemplate(data.prompt, namedInputs);

        // get().setBoxStatus(id, "running");

        try {
          const result = await generateTextForBox(id, {
            systemPrompt: data.systemPrompt,
            userPrompt: filledPrompt,
            boxType: "insight",
          });

          const newThemeData = JSON.parse(result.content);
          const newTheme = newThemeData.themes?.[0];

          const updatedThemes = newTheme
            ? [
                ...otherThemes.slice(0, themeIndex),
                newTheme,
                ...otherThemes.slice(themeIndex),
              ]
            : otherThemes;

          get().updateBoxData(id, {
            output: JSON.stringify({ themes: updatedThemes }),
            status: "done",
            error: undefined,
          });
        } catch (err: any) {
          get().setBoxStatus(id, "error", err.message || "Rerun failed");
        }
      },
    }),
    {
      name: "ai-canva-board",
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        boxData: state.boxData,
        currentBoardId: state.currentBoardId,
        boardTitle: state.boardTitle,
      }),
    },
  ),
);

/** Display name used for attributions (approvals, edits, rejections). */
function actorName(): string {
  const user = useAuthStore.getState().user;
  return user?.displayName || user?.email || "Someone";
}

/**
 * One text generation for a box: calls the model, records token usage (box
 * display + Firestore ledger + session total) and throws on failure. Shared by
 * the generic text branch and the SDLC stage branch so the accounting can never
 * drift apart.
 */
async function generateTextForBox(
  id: string,
  opts: { systemPrompt: string; userPrompt: string; boxType: BoxType },
) {
  const result = await generate({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
  });

  if (result.error) throw new Error(result.error);

  const store = useBoardStore.getState();
  if (result.usage) {
    store.updateBoxData(id, { tokens: result.usage });
    const user = useAuthStore.getState().user;
    if (user) {
      recordTokenUsage(
        user.uid,
        store.currentBoardId || "",
        id,
        opts.boxType,
        result.usage,
        result.model,
      );
      useTokenStore.getState().addTokens(result.usage.totalTokens);
    }
  }

  return result;
}
