import type { BoxData, HistoryEntry } from "../types.js";

/**
 * Versions of an AI box's output. Every run (and every single-theme rerun in
 * Theme Finder) adds a version and makes it current. Restoring an earlier
 * version makes that one current again. Nothing is deleted, so you can
 * always switch back.
 *
 * Review decisions (approve / dismiss in Safety Risk Review) belong to the
 * version they were made on. A rerun produces new items, so a new version
 * starts undecided. The decisions of the version being left are saved with
 * it, so restoring that version brings them back.
 */

/** The history, with the box's current decisions saved on its current version. */
function saveDecisions(data: BoxData): HistoryEntry[] {
  return (data.history ?? []).map((entry) => {
    if (entry.id !== data.currentVersionId) return entry;
    const { approvals: _previous, ...rest } = entry;
    return data.approvals ? { ...rest, approvals: data.approvals } : rest;
  });
}

/** The patch that adds `output` as a new version and makes it current. */
export function addVersion(
  data: BoxData,
  output: string,
  versionId: string,
  now: number,
): Partial<BoxData> {
  return {
    output,
    history: [...saveDecisions(data), { id: versionId, timestamp: now, output }],
    currentVersionId: versionId,
    approvals: undefined,
  };
}

/**
 * The patch that makes an earlier version current again, with its decisions.
 * Null when there's nothing to do (unknown or already current version).
 */
export function restoreVersion(data: BoxData, versionId: string): Partial<BoxData> | null {
  const version = data.history?.find((entry) => entry.id === versionId);
  if (!version || version.id === data.currentVersionId) return null;
  return {
    output: version.output,
    history: saveDecisions(data),
    currentVersionId: version.id,
    approvals: version.approvals,
  };
}

/** "Today, 14:05", "Yesterday, 9:12", "27 Sep, 16:40" or "27 Sep 2025, 16:40". */
export function formatVersionTime(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const today = new Date(now);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Rounded: a day with a daylight-saving change isn't exactly 24 hours.
  const daysAgo = Math.round((dayStart(today) - dayStart(date)) / 86_400_000);
  if (daysAgo === 0) return `Today, ${time}`;
  if (daysAgo === 1) return `Yesterday, ${time}`;
  const day = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${day}, ${time}`;
}
