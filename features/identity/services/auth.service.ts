import "server-only";

import {
  sendPasswordReset,
  setCurrentUserPassword,
  signInWithPassword,
} from "@/features/identity/repositories/auth.repository";

export async function authenticateWithPassword(email: string, password: string) {
  return signInWithPassword(email, password);
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  return sendPasswordReset(email, redirectTo);
}

export async function saveNewPassword(password: string) {
  return setCurrentUserPassword(password);
}
