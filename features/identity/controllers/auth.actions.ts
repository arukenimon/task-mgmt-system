"use server";

import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; sent?: boolean };

export async function requestSignInLink(_: LoginState, formData: FormData): Promise<LoginState> {
  if (!hasSupabaseConfig) return { error: "Start local Supabase and add its URL and publishable key to .env.local first." };
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid work email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  // Keep the response the same for unknown and known addresses so this endpoint
  // cannot be used to enumerate the invited team.
  if (error) {
    if (process.env.NODE_ENV === "development") {
      return { error: "No invited local account matches that email. Try alex.morgan@taskhub.demo." };
    }

    return { sent: true };
  }
  return { sent: true };
}

export async function signOut() {
  if (hasSupabaseConfig) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
