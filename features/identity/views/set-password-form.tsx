"use client";

import { useActionState } from "react";
import { setPassword, type SetPasswordState } from "@/features/identity/controllers/auth.actions";

const initialState: SetPasswordState = {};

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, initialState);

  return (
    <form action={action} className="login-form">
      <label>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          disabled={pending}
        />
      </label>
      <label>
        Confirm password
        <input
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          disabled={pending}
        />
      </label>
      <p className="password-requirements">Use 12+ characters including upper- and lowercase letters, a number, and a symbol.</p>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      <button className="button button-primary login-button" type="submit" disabled={pending}>
        {pending ? "Saving password…" : "Save password and continue"}
      </button>
    </form>
  );
}
