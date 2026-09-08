"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthFragmentCompleteProps = {
  reason: "invite" | "recovery";
};

function invalidLinkPath(reason: AuthFragmentCompleteProps["reason"]) {
  return reason === "recovery" ? "/forgot-password?error=invalid-link" : "/login?error=invalid-link";
}

export function AuthFragmentComplete({ reason }: AuthFragmentCompleteProps) {
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");

    if (!accessToken || !refreshToken) {
      window.location.replace(invalidLinkPath(reason));
      return;
    }

    const supabase = createClient();
    void supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          window.location.replace(invalidLinkPath(reason));
          return;
        }
        window.location.replace(`/auth/set-password?reason=${reason}`);
      })
      .catch(() => {
        window.location.replace(invalidLinkPath(reason));
      });
  }, [reason]);

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand" aria-label="Bespoke Task Management System"><span className="brand-mark">B</span><span className="brand-copy"><strong>Bespoke</strong><small>Task management</small></span></div>
        <p className="eyebrow">Secure email confirmation</p>
        <h1>Almost there.</h1>
        <p className="login-copy" role="status">Confirming your secure email link…</p>
      </section>
      <aside className="login-aside"><p className="eyebrow">Secure access</p><h2>Your account is being prepared.</h2></aside>
    </main>
  );
}
