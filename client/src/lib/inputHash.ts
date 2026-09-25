import { NamedInput } from "../types";

export function hashInput(namedInputs: Record<string, string> | NamedInput[]): string {
  const text = Object.entries(namedInputs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, output]) => `${name}:${output}`)
    .join("|");

  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }

  return hash.toString();
}