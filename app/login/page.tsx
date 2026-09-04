import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/features/identity/views/login-form";

export default function LoginPage() {
  return <main className="login-page"><section className="login-panel"><div className="brand"><span className="brand-mark">T</span><span>Task Hub</span></div><p className="eyebrow">Secure internal workspace</p><h1>Keep every client delivery moving.</h1><p className="login-copy">Sign in with a seeded team account once your local Supabase environment is running.</p><LoginForm /><div className="login-divider"><span>or explore the assessment</span></div><Link href="/?as=director-1" className="demo-link">Open interactive demo <ArrowRight size={16} /></Link><p className="login-security"><ShieldCheck size={16} />Role permissions are enforced by Supabase Auth and RLS in the connected environment.</p></section><aside className="login-aside"><p className="eyebrow">Built for clarity</p><h2>One shared source of truth for workload, deadlines and clients.</h2><ul><li>See personal, team and director-level work</li><li>Filter any view by client and deadline</li><li>Move work through a traceable workflow</li></ul></aside></main>;
}
