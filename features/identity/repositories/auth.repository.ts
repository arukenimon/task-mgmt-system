import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function signInWithPassword(email: string, password: string) {
  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !authData.user) return false;

  // A Supabase Auth user without an application profile must not enter the workspace.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profile) return true;

  await supabase.auth.signOut();
  return false;
}

export async function sendPasswordReset(email: string, redirectTo: string) {
  const supabase = await createClient();
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function setCurrentUserPassword(password: string) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Your password setup session has expired.");

  const { error } = await supabase.auth.updateUser({ password });
  if (error?.code === "same_password") {
    throw new Error("Choose a new password that is different from your previous password.");
  }
  if (error) throw new Error("Your password could not be saved. Request a new email and try again.");

  // The invite/recovery session is not allowed into the workspace. The user must
  // authenticate again with the password they just chose.
  await supabase.auth.signOut();
}
