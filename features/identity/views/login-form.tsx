"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithPassword, type LoginState } from "@/features/identity/controllers/auth.actions";

const initialState: LoginState = {};

export function LoginForm({ configured, localDevelopment }: { configured: boolean; localDevelopment: boolean }) {
  const [state, action, pending] = useActionState(signInWithPassword, initialState);
  return (
    <form action={action} className="login-form">
      <label>Work email<input name="email" type="email" autoComplete="email" required placeholder={localDevelopment ? "alex.morgan@taskhub.demo" : "you@agency.co.uk"} disabled={!configured || pending} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required disabled={!configured || pending} /></label>
      {localDevelopment ? <p className="login-local-hint">Local test account: <code>alex.morgan@taskhub.demo</code> · password: <code>DemoPass!2026</code></p> : null}
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button className="button button-primary login-button" type="submit" disabled={!configured || pending}>{pending ? "Signing in…" : "Sign in"}</button>
      <Link className="auth-link" href="/forgot-password">Forgot your password?</Link>
    </form>
  );
}
