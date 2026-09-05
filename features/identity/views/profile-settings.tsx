"use client";

import { CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useActionState } from "react";
import { updateProfileAction, type ProfileActionState } from "@/features/identity/controllers/profile.actions";
import { ROLE_LABELS, type Role } from "@/features/identity/models/roles";
import { AccountMenu } from "@/features/identity/views/account-menu";
import { WorkspaceSidebar } from "@/features/navigation/views/workspace-sidebar";

const INITIAL_STATE: ProfileActionState = { status: "idle", message: "" };

type ProfileSettingsProps = {
  profile: {
    fullName: string;
    email: string;
    initials: string;
    role: Role;
    teamName: string | null;
    createdAt: string;
  };
};

function formatMemberSince(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(value));
}

export function ProfileSettings({ profile }: ProfileSettingsProps) {
  const [state, action, pending] = useActionState(updateProfileAction, INITIAL_STATE);

  return (
    <main className="workspace-shell">
      <WorkspaceSidebar active="profile" showTeamManagement={profile.role === "senior_director"} teamName={profile.teamName} />

      <section className="workspace-main">
        <header className="workspace-header">
          <p className="workspace-header-context"><span>Workspace</span><span aria-hidden="true">/</span><strong>Profile</strong></p>
          <AccountMenu initials={profile.initials} name={profile.fullName} role={profile.role} />
        </header>

        <div className="workspace-content profile-page-content">
          <header className="topbar profile-topbar">
            <div><p className="eyebrow">Account settings</p><h1>Your profile</h1><p className="profile-intro">Keep your name current and review how you appear across the workspace.</p></div>
          </header>

          <div className="profile-layout">
            <aside className="profile-summary" aria-label="Profile summary">
              <div className="profile-avatar" aria-hidden="true">{profile.initials}</div>
              <h2>{profile.fullName}</h2>
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
              <span className="profile-access-badge"><CheckCircle2 size={14} aria-hidden="true" />Active account</span>

              <dl className="profile-facts">
                <div><dt>Role</dt><dd>{ROLE_LABELS[profile.role]}</dd></div>
                <div><dt>Team</dt><dd>{profile.teamName ?? "Organisation-wide"}</dd></div>
                <div><dt>Member since</dt><dd>{formatMemberSince(profile.createdAt)}</dd></div>
              </dl>
            </aside>

            <div className="profile-sections">
              <section className="panel profile-card">
                <div className="profile-card-heading"><span><UserRound size={20} aria-hidden="true" /></span><div><p className="eyebrow">Personal details</p><h2>How others see you</h2></div></div>
                <p className="profile-card-copy">Your name and initials appear on assigned tasks, activity, and team views.</p>

                <form action={action} className="profile-form">
                  <label htmlFor="profile-full-name">Full name</label>
                  <input aria-describedby="profile-full-name-hint profile-full-name-error" autoComplete="name" defaultValue={profile.fullName} id="profile-full-name" name="fullName" required />
                  <p className="profile-field-hint" id="profile-full-name-hint">Initials are updated automatically from your name.</p>
                  {state.fieldErrors?.fullName?.[0] ? <p className="field-error" id="profile-full-name-error">{state.fieldErrors.fullName[0]}</p> : null}
                  {state.status !== "idle" ? <p className={state.status === "success" ? "action-message action-message-success" : "action-message action-message-error"} role={state.status === "error" ? "alert" : "status"}>{state.status === "success" ? <CheckCircle2 size={15} aria-hidden="true" /> : null}{state.message}</p> : null}
                  <div className="profile-form-actions"><button className="button button-primary" disabled={pending} type="submit">{pending ? "Saving…" : "Save changes"}</button></div>
                </form>
              </section>

              <section className="panel profile-card">
                <div className="profile-card-heading"><span><LockKeyhole size={20} aria-hidden="true" /></span><div><p className="eyebrow">Account & access</p><h2>Sign-in details</h2></div></div>
                <div className="profile-account-row"><span><Mail size={18} aria-hidden="true" /></span><div><small>Work email</small><strong>{profile.email}</strong></div><span className="profile-readonly">Admin managed</span></div>
                <div className="profile-account-row"><span><KeyRound size={18} aria-hidden="true" /></span><div><small>Sign-in method</small><strong>Secure email link</strong></div><span className="profile-readonly">Passwordless</span></div>
                <div className="profile-security-note"><ShieldCheck size={18} aria-hidden="true" /><p>Your role, team, and work email are managed by a Senior Director. Profile changes never alter your workspace permissions.</p></div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
