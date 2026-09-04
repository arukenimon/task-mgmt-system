import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { LoginForm } from "@/features/identity/views/login-form";
import { hasSupabaseConfig } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (hasSupabaseConfig && await getCurrentProfile()) redirect("/overview");

  const params = await searchParams;
  const linkWasInvalid = params.error === "invalid-link";

  return <main className="login-page"><section className="login-panel"><div className="brand" aria-label="Bespoke Task Management System"><span className="brand-mark">B</span><span className="brand-copy"><strong>Bespoke</strong><small>Task management</small></span></div><p className="eyebrow">Bespoke task management</p><h1>A task system built around your team.</h1><p className="login-copy">Enter the work email attached to your invited account. We’ll send a one-time sign-in link rather than asking you to manage another password.</p>{linkWasInvalid ? <p className="form-error" role="alert">That sign-in link has expired or has already been used. Request a new link, then open only the newest email.</p> : null}<LoginForm configured={hasSupabaseConfig} localDevelopment={process.env.NODE_ENV === "development"} /><p className="login-security"><ShieldCheck size={16} />Your role and team determine what you can see and change. These permissions are enforced by Supabase Auth and RLS.</p></section><aside className="login-aside"><p className="eyebrow">Built around your workflow</p><h2>A focused place for workload, deadlines and client delivery.</h2><ul><li>See individual, team and director-level work</li><li>Filter every view by client and deadline</li><li>Move work through a clear, traceable workflow</li></ul></aside></main>;
}
