import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import type { BoxData } from "../types";
import { pendingUpstream } from "./queue";

const box = (status: BoxData["status"]) => ({ status }) as BoxData;
const edges = [
  { id: "a-c", source: "a", target: "c" },
  { id: "b-c", source: "b", target: "c" },
] as Edge[];

describe("pendingUpstream", () => {
  it("lists upstream boxes that are running or queued", () => {
    expect(
      pendingUpstream(edges, { a: box("running"), b: box("queued"), c: box("idle") }, "c"),
    ).toEqual(["a", "b"]);
  });

  it("is empty once upstream boxes have finished", () => {
    expect(
      pendingUpstream(edges, { a: box("done"), b: box("error"), c: box("idle") }, "c"),
    ).toEqual([]);
  });
});
