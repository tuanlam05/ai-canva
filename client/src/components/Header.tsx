import { memo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { useBoardStore } from "../store/boardStore.js";
import { useTokenStore } from "../store/tokenStore.js";
import { Button } from "./ui/Button.js";
import { Menu, MenuDivider, MenuItem } from "./ui/Menu.js";
import PresenceRoster from "./PresenceRoster.js";
import { useTheme, type ThemeChoice } from "../lib/theme.js";
import {
  BoltIcon,
  ChevronDownIcon,
  LogoutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  PlusIcon,
  RerunIcon,
  TrashIcon,
  UsersIcon,
} from "./ui/icons.js";

/**
 * Top app bar — the app's primary chrome.
 *
 * Decluttered from the original ~12 inline controls to a calm two-group bar:
 *   left  — brand, board title, save status
 *   right — collaboration (roster / Share), board actions (Boards menu),
 *           usage badge, role-gated views, account menu
 *
 * Rare + destructive actions (Clear / Delete board, Sign out) live inside
 * menus instead of the bar itself.
 *
 * Performance: this component subscribes to the store slices it renders
 * (title, save status, board list). App does NOT — so typing in the board
 * title re-renders only this (memoized) header, not the whole Canvas tree.
 */

const SAVE_LABEL: Record<string, string> = {
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

interface HeaderProps {
  /** null = signed-out local guest (sign-in disabled, see lib/authMode.ts). */
  user: User | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onShare: () => void;
  onNewBoard: () => void;
  onLoadBoard: (boardId: string) => void;
  onDeleteBoard: () => void;
  onClearBoard: () => void;
  onLogout: () => void;
  isAdmin: boolean;
  isFacilitator: boolean;
  adminView: boolean;
  facilitatorView: boolean;
  onToggleAdminView: () => void;
  onToggleFacilitatorView: () => void;
}

function Header({
  user,
  sidebarOpen,
  onToggleSidebar,
  onShare,
  onNewBoard,
  onLoadBoard,
  onDeleteBoard,
  onClearBoard,
  onLogout,
  isAdmin,
  isFacilitator,
  adminView,
  facilitatorView,
  onToggleAdminView,
  onToggleFacilitatorView,
}: HeaderProps) {
  // Store slices the header itself renders (kept out of App on purpose).
  const currentBoardId = useBoardStore((s) => s.currentBoardId);
  const boardTitle = useBoardStore((s) => s.boardTitle);
  const setBoardTitle = useBoardStore((s) => s.setBoardTitle);
  const saveStatus = useBoardStore((s) => s.saveStatus);
  const boardList = useBoardStore((s) => s.boardList);
  const refreshBoardList = useBoardStore((s) => s.refreshBoardList);
  const resetDemoBoard = useBoardStore((s) => s.resetDemoBoard);

  // Reset is destructive and sits in the bar during a live demo, so it asks
  // once. Only offered on the showcase board.
  const [confirmingReset, setConfirmingReset] = useState(false);
  const isDemoBoard = boardTitle.trim().toLowerCase().startsWith("demo");

  const totalTokens = useTokenStore((s) => s.totalTokens);
  const fmtTokens = (n: number) => n.toLocaleString("en-US");

  const themeChoice = useTheme((s) => s.choice);
  const themeResolved = useTheme((s) => s.resolved);
  const setThemeChoice = useTheme((s) => s.setChoice);
  const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
    { value: "light", label: "Light", icon: <SunIcon /> },
    { value: "dark", label: "Dark", icon: <MoonIcon /> },
    { value: "system", label: "System", icon: <MonitorIcon /> },
  ];

  const saveLabel = SAVE_LABEL[saveStatus];
  const avatarInitials = (user?.displayName || user?.email || "?").slice(0, 2).toUpperCase();
  const isGuest = !user;

  // z-30 on the header: above the Add Box panel (z-20) so its menus open over it.
  return (
    <header className="app-bar flex items-center justify-between gap-3 px-4 h-14 relative z-30">
      {/* ---- Left: brand + board identity ---- */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="logo-tile" aria-hidden>
            RC
          </div>
          <span className="text-[14px] font-semibold text-ink hidden sm:block">
            Research Canvas
          </span>
        </div>

        <div className="h-6 w-px bg-line flex-shrink-0" />

        {currentBoardId || !user ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <input
              type="text"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              placeholder="Untitled board"
              className="h-[34px] w-48 md:w-56 rounded-lg border border-transparent bg-transparent px-2.5 text-[14px] font-semibold text-ink transition hover:bg-surface-sunken focus:border-line-control focus:bg-surface focus:outline-none focus:ring-2 focus:ring-[rgba(22,24,29,.12)]"
            />
            {!user && (
              <span
                className="font-mono text-[11px] text-ink-muted hidden md:block"
                title="Sign-in is off: this board is saved in this browser only"
              >
                Saved in this browser
              </span>
            )}
            {saveLabel && user && (
              <span
                className="flex items-center gap-1.5 flex-shrink-0"
                title={"Board save status: " + saveLabel}
              >
                <span className={"save-dot save-" + saveStatus} />
                <span className="font-mono text-[11px] text-ink-muted hidden md:block">{saveLabel}</span>
              </span>
            )}
          </div>
        ) : (
          <span className="font-mono text-[11.5px] text-ink-muted">Opening board…</span>
        )}
      </div>

      {/* ---- Right: actions ---- */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Collaboration group (cloud boards only) */}
        {currentBoardId && user && (
          <>
            <PresenceRoster />
            <Button variant="primary" onClick={onShare} className="ml-1">
              <UsersIcon /> Share
            </Button>
            <div className="h-6 w-px bg-line mx-1.5" />
          </>
        )}

        {/* Showcase reset: puts the board back to its starting state between
          visitors, restoring deleted boxes and clearing every decision. */}
        {(currentBoardId || isGuest) && isDemoBoard && (
          <>
            {confirmingReset ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-ink-muted hidden md:block">
                  Reset the demo board?
                </span>
                <Button
                  variant="primary"
                  onClick={() => {
                    resetDemoBoard();
                    setConfirmingReset(false);
                  }}
                >
                  Yes, reset
                </Button>
                <Button onClick={() => setConfirmingReset(false)}>Cancel</Button>
              </div>
            ) : (
              <Button
                onClick={() => setConfirmingReset(true)}
                title="Restore the demo board to its starting state"
              >
                <RerunIcon /> Reset
              </Button>
            )}
            <div className="h-6 w-px bg-line mx-1.5" />
          </>
        )}

        {/* Board tools */}
        <Button onClick={onToggleSidebar} active={sidebarOpen} title="Toggle the add-box panel">
          <PlusIcon /> Add Box
        </Button>

        {/* Cloud boards + usage need an account — hidden for local guests. */}
        {user && (
        <>
        <Menu
          panelClassName="w-72"
          trigger={({ open, toggle }) => (
            <Button
              onClick={() => {
                if (!open) refreshBoardList();
                toggle();
              }}
              active={open}
              title="Open, create, or manage boards"
            >
              Boards ({boardList.length})
              <ChevronDownIcon className={"transition-transform " + (open ? "rotate-180" : "")} />
            </Button>
          )}
        >
          {(close) => (
            <>
              <div className="max-h-80 overflow-y-auto">
                <MenuItem
                  icon={<PlusIcon />}
                  label="New Board"
                  accent
                  onClick={() => {
                    close();
                    onNewBoard();
                  }}
                />
                {boardList.length === 0 && (
                  <div className="px-3.5 py-3 text-[12px] text-ink-muted">No boards yet.</div>
                )}
                {boardList.map((b) => (
                  <MenuItem
                    key={b.id}
                    label={b.title || "Untitled board"}
                    description={
                      new Date(b.updatedAt).toLocaleDateString() +
                      " · " +
                      (Array.isArray(b.nodes) ? b.nodes.length : 0) +
                      " boxes"
                    }
                    active={b.id === currentBoardId}
                    onClick={() => {
                      close();
                      onLoadBoard(b.id);
                    }}
                  />
                ))}
              </div>
              {currentBoardId && (
                <>
                  <MenuDivider />
                  <MenuItem
                    label="Clear this board"
                    description="Remove all boxes"
                    danger
                    onClick={() => {
                      close();
                      onClearBoard();
                    }}
                  />
                  <MenuItem
                    icon={<TrashIcon />}
                    label="Delete this board"
                    description="Remove it from the cloud"
                    danger
                    onClick={() => {
                      close();
                      onDeleteBoard();
                    }}
                  />
                </>
              )}
            </>
          )}
        </Menu>

        <div className="h-6 w-px bg-line mx-1.5" />

        {/* Usage + role views + account */}
        <div
          className="flex items-center gap-1.5 h-[34px] px-2.5 rounded-lg bg-surface-muted font-mono text-[11.5px] text-ink-muted tabular-nums"
          title={"Your total LLM tokens used: " + fmtTokens(totalTokens)}
        >
          <BoltIcon /> <span className="font-semibold text-ink-3">{fmtTokens(totalTokens)}</span>
          <span className="hidden md:inline">tok</span>
        </div>
        </>
        )}

        {isAdmin && (
          <Button
            variant="ghost"
            active={adminView}
            onClick={onToggleAdminView}
            title="Admin board — system stats and users"
          >
            Admin
          </Button>
        )}
        {(isAdmin || isFacilitator) && (
          <Button
            variant="ghost"
            active={facilitatorView}
            onClick={onToggleFacilitatorView}
            title="Facilitator dashboard — templates, workshops, teams"
          >
            Facilitator
          </Button>
        )}

        {/* Colour theme: Light / Dark / follow the OS */}
        <Menu
          panelClassName="w-40"
          trigger={({ open, toggle }) => (
            <Button
              variant="ghost"
              onClick={toggle}
              active={open}
              className="!w-[34px] !px-0"
              title={"Theme: " + themeChoice}
              aria-label="Colour theme"
            >
              {themeResolved === "dark" ? <MoonIcon /> : <SunIcon />}
            </Button>
          )}
        >
          {(close) => (
            <div className="py-1">
              {THEME_OPTIONS.map((o) => (
                <MenuItem
                  key={o.value}
                  icon={o.icon}
                  label={o.label}
                  active={themeChoice === o.value}
                  onClick={() => {
                    setThemeChoice(o.value);
                    close();
                  }}
                />
              ))}
            </div>
          )}
        </Menu>

        {user && (
        <Menu
          panelClassName="w-60"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className={
                "flex items-center gap-1 h-[34px] pl-1 pr-2 rounded-full border transition-colors " +
                (open
                  ? "bg-surface-sunken border-line-control"
                  : "bg-surface border-line-control hover:bg-surface-hover")
              }
              title="Account"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <span className="w-[26px] h-[26px] rounded-full bg-ink text-on-ink font-mono text-[10.5px] font-semibold flex items-center justify-center">
                  {avatarInitials}
                </span>
              )}
              <ChevronDownIcon className="text-ink-icon" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3.5 py-2.5 border-b border-line-divider">
                <p className="text-[13px] font-semibold text-ink truncate">
                  {user.displayName || "Signed in"}
                </p>
                <p className="font-mono text-[11px] text-ink-muted truncate">{user.email || "Workshop guest"}</p>
              </div>
              <div className="py-1">
                <MenuItem
                  icon={<LogoutIcon />}
                  label="Sign out"
                  danger
                  onClick={() => {
                    close();
                    onLogout();
                  }}
                />
              </div>
            </>
          )}
        </Menu>
        )}
      </div>
    </header>
  );
}

export default memo(Header);