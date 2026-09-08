import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { AuthFragmentRepair } from "@/features/identity/views/auth-fragment-repair";
import { LoginForm } from "@/features/identity/views/login-form";
import { hasSupabaseConfig } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[]; "password-updated"?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (hasSupabaseConfig && await getCurrentProfile()) redirect("/overview");

  const params = await searchParams;
  const linkWasInvalid = params.error === "invalid-link";
  const passwordWasUpdated = params["password-updated"] === "1";

  return <main className="login-page"><section className="login-panel"><div className="brand" aria-label="Bespoke Task Management System"><span className="brand-mark">B</span><span className="brand-copy"><strong>Bespoke</strong><small>Task management</small></span></div><p className="eyebrow">Bespoke task management</p><h1>A task system built around your team.</h1><p className="login-copy">Sign in with the work email and password for your invited account. New members choose their password securely from their invitation email.</p>{linkWasInvalid ? <><AuthFragmentRepair /><p className="form-error" role="alert">That email link has expired or has already been used. Request a new invitation or password-reset email.</p></> : null}{passwordWasUpdated ? <p className="form-success" role="status">Your password has been saved. Sign in to continue.</p> : null}<LoginForm configured={hasSupabaseConfig} localDevelopment={process.env.NODE_ENV === "development"} /><p className="login-security"><ShieldCheck size={16} />Your role and team determine what you can see and change. These permissions are enforced by Supabase Auth and RLS.</p></section><aside className="login-aside"><p className="eyebrow">Built around your workflow</p><h2>A focused place for workload, deadlines and client delivery.</h2><ul><li>See individual, team and director-level work</li><li>Filter every view by client and deadline</li><li>Move work through a clear, traceable workflow</li></ul></aside></main>;
}
