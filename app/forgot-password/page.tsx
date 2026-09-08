import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PasswordResetForm } from "@/features/identity/views/password-reset-form";
import { hasSupabaseConfig } from "@/lib/supabase/env";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const linkWasInvalid = params.error === "invalid-link";

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand" aria-label="Bespoke Task Management System"><span className="brand-mark">B</span><span className="brand-copy"><strong>Bespoke</strong><small>Task management</small></span></div>
        <p className="eyebrow">Account recovery</p>
        <h1>Reset your password.</h1>
        <p className="login-copy">Enter the email for your invited account. If it exists, we’ll send a secure link to choose a new password.</p>
        {linkWasInvalid ? <p className="form-error" role="alert">That reset link has expired or has already been used. Request a new email below.</p> : null}
        <PasswordResetForm configured={hasSupabaseConfig} />
        <Link className="auth-link" href="/login">Back to sign in</Link>
        <p className="login-security"><ShieldCheck size={16} />For your protection, reset links are time limited and can only be used once.</p>
      </section>
      <aside className="login-aside"><p className="eyebrow">Secure access</p><h2>One recovery link. One new password.</h2></aside>
    </main>
  );
}
