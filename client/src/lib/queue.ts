import type { Edge } from "@xyflow/react";
import type { BoxData } from "../types.js";

/** Upstream boxes of `id` that are still generating (running or queued). */
export function pendingUpstream(
  edges: Edge[],
  boxData: Record<string, BoxData>,
  id: string,
): string[] {
  return edges
    .filter((e) => e.target === id)
    .map((e) => e.source)
    .filter((src) => {
      const status = boxData[src]?.status;
      return status === "running" || status === "queued";
    });
}
