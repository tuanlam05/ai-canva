import { auth, googleProvider } from "./firebase.js";
import {
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

export async function signInWithGoogle(): Promise<void> {
  return await signInWithRedirect(auth, googleProvider);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}