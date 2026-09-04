"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { signOut } from "@/features/identity/controllers/auth.actions";
import { ROLE_LABELS, type Role } from "@/features/identity/models/roles";

type AccountMenuProps = {
  initials: string;
  name: string;
  role: Role;
};

export function AccountMenu({ initials, name, role }: AccountMenuProps) {
  return (
    <details className="account-menu">
      <summary className="account-menu-trigger">
        <span className="avatar account-menu-avatar" aria-hidden="true">{initials}</span>
        <span className="account-menu-identity"><strong>{name}</strong><small>{ROLE_LABELS[role]}</small></span>
        <ChevronDown className="account-menu-chevron" size={16} aria-hidden="true" />
      </summary>

      <div className="account-menu-panel">
        <div className="account-menu-summary">
          <span className="avatar avatar-large" aria-hidden="true">{initials}</span>
          <div><strong>{name}</strong><span>{ROLE_LABELS[role]}</span></div>
        </div>
        <a className="account-menu-action" href="/profile"><UserRound size={16} aria-hidden="true" />Profile settings</a>
        <form action={signOut}>
          <button className="account-menu-action account-menu-sign-out" type="submit"><LogOut size={16} aria-hidden="true" />Sign out</button>
        </form>
      </div>
    </details>
  );
}
