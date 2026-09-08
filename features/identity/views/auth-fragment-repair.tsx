"use client";

import { useEffect } from "react";

/** Repairs a legacy implicit-flow callback that reached the login error page. */
export function AuthFragmentRepair() {
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    const reason = fragment.get("type") === "recovery" ? "recovery" : "invite";
    window.location.replace(`/auth/complete?reason=${reason}${window.location.hash}`);
  }, []);

  return null;
}
