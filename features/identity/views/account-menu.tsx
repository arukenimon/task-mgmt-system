"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/features/identity/controllers/auth.actions";
import { ROLE_LABELS, type Role } from "@/features/identity/models/roles";
import { beginWorkspaceNavigation, shouldTrackWorkspaceNavigation } from "@/features/navigation/models/workspace-navigation";
import { NotificationMenu } from "@/features/notifications/views/notification-menu";

type AccountMenuProps = {
  actorId: string;
  initials: string;
  name: string;
  role: Role;
};

export function AccountMenu({ actorId, initials, name, role }: AccountMenuProps) {
  return (
    <div className="workspace-account-actions">
      <NotificationMenu actorId={actorId} />
      <details className="account-menu">
        <summary aria-label={`Open account menu for ${name}`} className="account-menu-trigger">
          <span className="avatar account-menu-avatar" aria-hidden="true">{initials}</span>
          <span className="account-menu-identity"><strong>{name}</strong><small>{ROLE_LABELS[role]}</small></span>
          <ChevronDown className="account-menu-chevron" size={16} aria-hidden="true" />
        </summary>

        <div className="account-menu-panel">
          <div className="account-menu-summary">
            <span className="avatar avatar-large" aria-hidden="true">{initials}</span>
            <div><strong>{name}</strong><span>{ROLE_LABELS[role]}</span></div>
          </div>
          <Link className="account-menu-action" href="/profile" onClick={(event) => { if (shouldTrackWorkspaceNavigation(event)) beginWorkspaceNavigation("profile"); }}><UserRound size={16} aria-hidden="true" />Profile settings</Link>
          <form action={signOut}>
            <button className="account-menu-action account-menu-sign-out" type="submit"><LogOut size={16} aria-hidden="true" />Sign out</button>
          </form>
        </div>
      </details>
    </div>
  );
}
