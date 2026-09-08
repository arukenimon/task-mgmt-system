import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SetPasswordForm } from "@/features/identity/views/set-password-form";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";

type SetPasswordPageProps = {
  searchParams: Promise<{ reason?: string | string[] }>;
};

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  if (!hasSupabaseConfig) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const params = await searchParams;
  const isRecovery = params.reason === "recovery";
  if (error || !data.user) {
    redirect(isRecovery ? "/forgot-password?error=invalid-link" : "/login?error=invalid-link");
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand" aria-label="Bespoke Task Management System"><span className="brand-mark">B</span><span className="brand-copy"><strong>Bespoke</strong><small>Task management</small></span></div>
        <p className="eyebrow">{isRecovery ? "Password reset" : "Welcome to Bespoke"}</p>
        <h1>{isRecovery ? "Choose a new password." : "Create your password."}</h1>
        <p className="login-copy">{isRecovery ? "Use a new, strong password for your work account." : "Your email invitation is confirmed. Choose a strong password to activate your account."}</p>
        <SetPasswordForm />
        <p className="login-security"><ShieldCheck size={16} />After saving, you’ll sign in with this password. Email links cannot open the workspace.</p>
      </section>
      <aside className="login-aside"><p className="eyebrow">Secure access</p><h2>Your password protects your team’s work.</h2></aside>
    </main>
  );
}
