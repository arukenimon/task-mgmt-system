"use server";

import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function signIn(_: LoginState, formData: FormData): Promise<LoginState> {
  if (!hasSupabaseConfig) return { error: "Start local Supabase and add its URL and publishable key to .env.local first." };
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "We could not sign you in with those details." };
  redirect("/");
}
