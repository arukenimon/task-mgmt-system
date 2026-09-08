"use server";

import { redirect } from "next/navigation";
import { getSiteUrl, hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, loginSchema, setPasswordSchema } from "@/features/identity/models/auth.schemas";
import { authenticateWithPassword, requestPasswordReset, saveNewPassword } from "@/features/identity/services/auth.service";

export type LoginState = { error?: string; passwordUpdated?: boolean };
export type PasswordResetState = { error?: string; sent?: boolean };
export type SetPasswordState = { error?: string };

export async function signInWithPassword(_: LoginState, formData: FormData): Promise<LoginState> {
  if (!hasSupabaseConfig) return { error: "Start local Supabase and add its URL and publishable key to .env.local first." };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter your email and password." };

  const authenticated = await authenticateWithPassword(parsed.data.email, parsed.data.password);
  if (!authenticated) return { error: "Invalid email or password." };

  redirect("/overview");
}

export async function requestPasswordResetAction(_: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  if (!hasSupabaseConfig) return { error: "Start local Supabase and add its URL and publishable key to .env.local first." };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid work email address." };

  const { error } = await requestPasswordReset(
    parsed.data,
    `${getSiteUrl()}/auth/confirm?reason=recovery`,
  );

  if (error) {
    return { error: "We couldn't send a reset email. Please try again shortly." };
  }
  return { sent: true };
}

export async function setPassword(_: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const parsed = setPasswordSchema.safeParse({ password: formData.get("password"), confirmation: formData.get("confirmation") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your password and try again." };

  try {
    await saveNewPassword(parsed.data.password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Your password could not be saved." };
  }

  redirect("/login?password-updated=1");
}

export async function signOut() {
  if (hasSupabaseConfig) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
