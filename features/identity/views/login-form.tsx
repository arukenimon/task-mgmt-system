"use client";

import { useActionState } from "react";
import { requestSignInLink, type LoginState } from "@/features/identity/controllers/auth.actions";

const initialState: LoginState = {};

export function LoginForm({ configured, localDevelopment }: { configured: boolean; localDevelopment: boolean }) {
  const [state, action, pending] = useActionState(requestSignInLink, initialState);
  return <form action={action} className="login-form"><label>Work email<input name="email" type="email" autoComplete="email" required placeholder={localDevelopment ? "alex.morgan@taskhub.demo" : "you@agency.co.uk"} disabled={!configured || pending} /></label>{localDevelopment ? <p className="login-local-hint">Local test account: <code>alex.morgan@taskhub.demo</code></p> : null}{state.error ? <p className="form-error" role="alert">{state.error}</p> : null}{state.sent ? <p className="form-success">If this email belongs to an invited team member, a secure sign-in link is on its way.</p> : null}<button className="button button-primary login-button" type="submit" disabled={!configured || pending}>{pending ? "Sending link…" : "Email me a sign-in link"}</button></form>;
}
