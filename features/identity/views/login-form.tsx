"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/features/identity/controllers/auth.actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  return <form action={action} className="login-form"><label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@agency.co.uk" /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{state.error ? <p className="form-error">{state.error}</p> : null}<button className="button button-primary login-button" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button></form>;
}
