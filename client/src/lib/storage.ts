import { storage } from "./firebase.js";
import { ref, uploadString, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * Uploads a document file (PDF/DOCX/TXT/…) to the board's documents path and
 * returns a fetchable URL. Best-effort by design: the Documents box keeps the
 * extracted text in boxData even when this fails (signed-out local mode,
 * permission errors) — the URL is only for re-downloading the original file.
 */
export async function uploadDocumentToStorage(
  boardId: string,
  boxId: string,
  file: File
): Promise<string> {
  // Storage paths must be filesystem-safe — keep the name conservative.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const docRef = ref(
    storage,
    `boards/${boardId}/documents/${boxId}/${Date.now()}-${safeName}`
  );
  await uploadBytes(docRef, file, {
    contentType: file.type || "application/octet-stream",
  });
  return await getDownloadURL(docRef);
}