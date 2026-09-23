import type { ItemApproval } from "../types.js";

/**
 * Applies researcher decisions to a box's JSON output before it flows
 * downstream. Dismissed risks are removed while everything else passes
 * through, flagged with whether the researcher explicitly confirmed it.
 * Risks are approved by default, so the pipeline still works
 * end to end when nobody reviews anything.
 *
 * Returns the output untouched for box types with no reviewable items.
 */
export function filterApproved(
  boxType: string,
  output: string,
  approvals: Record<string, ItemApproval> | undefined,
): string {
  if (boxType !== "safety" || !approvals) return output;

  let parsed: any;
  try {
    parsed = JSON.parse(output);
  } catch {
    return output;
  }
  if (!Array.isArray(parsed?.risks)) return output;

  const kept = parsed.risks
    .filter((r: any) => approvals[r?.id]?.status !== "dismissed")
    .map((r: any) => ({
      ...r,
      researcher_confirmed: approvals[r?.id]?.status === "approved",
    }));

  return JSON.stringify({ ...parsed, risks: kept });
}
