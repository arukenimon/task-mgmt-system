"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type PasswordResetState } from "@/features/identity/controllers/auth.actions";

const initialState: PasswordResetState = {};

export function PasswordResetForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <form action={action} className="login-form">
      <label>Work email<input name="email" type="email" autoComplete="email" required disabled={!configured || pending} /></label>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      {state.sent ? <p className="form-success" role="status">If this email belongs to an invited account, a password reset link is on its way.</p> : null}
      <button className="button button-primary login-button" type="submit" disabled={!configured || pending}>{pending ? "Sending email…" : "Email reset link"}</button>
    </form>
  );
}
