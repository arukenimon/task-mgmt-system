"use client";

import {
  Building2,
  CircleCheckBig,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { QueryClient, QueryClientProvider, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, type Role } from "@/features/identity/models/roles";
import { AccountMenu } from "@/features/identity/views/account-menu";
import { WorkspaceSidebar } from "@/features/navigation/views/workspace-sidebar";
import {
  createTeamAction,
  deactivateMemberAction,
  inviteMemberAction,
  updateMemberAction,
  type TeamActionState,
} from "@/features/team/controllers/team-management.actions";
import type { ManagedMember, ManagedMemberCursor, ManagedMemberPage, ManagedTeam } from "@/features/team/models/team-management";

const INITIAL_ACTION_STATE: TeamActionState = { status: "idle", message: "" };
const EDITABLE_ROLES: Role[] = ["team_member", "account_director", "senior_director"];

type TeamManagementProps = {
  actor: { id: string; name: string; initials: string; role: Role; teamId: string | null };
  teams: ManagedTeam[];
  initialMemberPage: ManagedMemberPage;
  activeMemberCount: number;
  inactiveMemberOpenTaskCount: number;
};

export function TeamManagement(props: TeamManagementProps) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><TeamManagementContent {...props} /></QueryClientProvider>;
}

function TeamManagementContent({ actor, teams, initialMemberPage, activeMemberCount, inactiveMemberOpenTaskCount }: TeamManagementProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const teamName = teams.find((team) => team.id === actor.teamId)?.name ?? null;
  const refreshDirectory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["team-directory"] });
    router.refresh();
  }, [queryClient, router]);

  return (
    <main className="workspace-shell">
      <WorkspaceSidebar active="team" showTeamManagement teamName={teamName} />
      <section className="workspace-main">
        <header className="workspace-header">
          <p className="workspace-header-context"><span>Workspace</span><span aria-hidden="true">/</span><strong>Team management</strong></p>
          <AccountMenu initials={actor.initials} name={actor.name} role={actor.role} />
        </header>

        <div className="workspace-content team-page-content">
          <header className="topbar team-topbar">
            <div><p className="eyebrow">Senior Director controls</p><h1>Team management</h1><p className="team-intro">Invite colleagues, organise teams, and keep workspace access current.</p></div>
            <span className="avatar avatar-large" title={actor.name}>{actor.initials}</span>
          </header>

          <section className="team-stat-grid" aria-label="Team summary">
            <TeamStat icon={<Users size={20} />} label="Active members" value={activeMemberCount} />
            <TeamStat icon={<Building2 size={20} />} label="Teams" value={teams.length} />
            <TeamStat icon={<ShieldCheck size={20} />} label="Tasks assigned to inactive members" value={inactiveMemberOpenTaskCount} warning={inactiveMemberOpenTaskCount > 0} />
          </section>

          <div className="team-management-grid">
            <TeamDirectory actorId={actor.id} teams={teams} initialPage={initialMemberPage} onDirectoryChanged={refreshDirectory} />

            <aside className="team-actions-column" aria-label="Team administration actions">
              <InviteMemberForm teams={teams} onDirectoryChanged={refreshDirectory} />
              <CreateTeamForm onDirectoryChanged={refreshDirectory} />
              <section className="team-security-note">
                <ShieldCheck size={18} aria-hidden="true" />
                <div><strong>Senior Director only</strong><p>Every action is checked again on the server and enforced by database policies.</p></div>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function TeamStat({ icon, label, value, warning = false }: { icon: React.ReactNode; label: string; value: number; warning?: boolean }) {
  return <article className={warning ? "team-stat team-stat-warning" : "team-stat"}><span>{icon}</span><div><strong>{value}</strong><p>{label}</p></div></article>;
}

function ActionMessage({ state }: { state: TeamActionState }) {
  if (state.status === "idle") return null;
  return <p className={state.status === "success" ? "action-message action-message-success" : "action-message action-message-error"} role={state.status === "error" ? "alert" : "status"}>{state.status === "success" ? <CircleCheckBig size={15} aria-hidden="true" /> : null}{state.message}</p>;
}

function FieldError({ state, name }: { state: TeamActionState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? <span className="field-error">{message}</span> : null;
}

async function fetchMemberPage(query: string, cursor: ManagedMemberCursor | null, signal: AbortSignal) {
  const params = new URLSearchParams({ q: query });
  if (cursor) {
    params.set("cursorName", cursor.name);
    params.set("cursorId", cursor.id);
  }
  const response = await fetch(`/api/team/members?${params.toString()}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Unable to load the team directory.");
  }
  return response.json() as Promise<ManagedMemberPage>;
}

function TeamDirectory({ actorId, teams, initialPage, onDirectoryChanged }: { actorId: string; teams: ManagedTeam[]; initialPage: ManagedMemberPage; onDirectoryChanged: () => void }) {
  const [query, setQuery] = useState("");
  const directory = useInfiniteQuery({
    queryKey: ["team-directory", query.trim()],
    queryFn: ({ pageParam, signal }) => fetchMemberPage(query.trim(), pageParam, signal),
    initialPageParam: null as ManagedMemberCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: query.trim() ? undefined : { pages: [initialPage], pageParams: [null] },
    staleTime: 30_000,
  });
  const members = directory.data?.pages.flatMap((page) => page.members) ?? [];
  const total = directory.data?.pages[0]?.total ?? 0;

  return <section className="panel team-directory">
    <div className="panel-heading team-directory-heading">
      <div><p className="eyebrow">Directory</p><h2>{total} {query.trim() ? "matching people" : "people"}</h2></div>
      <label className="team-search"><span className="sr-only">Search people</span><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button> : null}</label>
    </div>

    <div className="member-list">
      {members.map((member) => <MemberCard actorId={actorId} key={member.id} member={member} teams={teams} onDirectoryChanged={onDirectoryChanged} />)}
      {directory.isError ? <p className="team-directory-error" role="alert">{directory.error.message}</p> : null}
      {!directory.isError && !directory.isLoading && members.length === 0 ? <div className="team-empty"><Search size={22} aria-hidden="true" /><strong>No matching people</strong><span>Try a name, email, role, or team.</span></div> : null}
      {directory.hasNextPage ? <button className="button button-quiet team-load-more" type="button" onClick={() => void directory.fetchNextPage()} disabled={directory.isFetchingNextPage}>{directory.isFetchingNextPage ? "Loading…" : "Load more people"}</button> : null}
    </div>
  </section>;
}

function InviteMemberForm({ teams, onDirectoryChanged }: { teams: ManagedTeam[]; onDirectoryChanged: () => void }) {
  const [state, action, pending] = useActionState(inviteMemberAction, INITIAL_ACTION_STATE);
  const [role, setRole] = useState<Role>("team_member");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      onDirectoryChanged();
    }
  }, [onDirectoryChanged, state]);

  return (
    <section className="panel admin-form-card">
      <div className="admin-form-heading"><span><UserPlus size={19} /></span><div><p className="eyebrow">Access</p><h2>Invite a member</h2></div></div>
      <p className="admin-form-copy">They’ll receive a secure Supabase invitation by email.</p>
      <form action={action} ref={formRef}>
        <label>Full name<input aria-describedby="invite-name-error" autoComplete="name" name="fullName" placeholder="Jane Smith" required /></label>
        <span id="invite-name-error"><FieldError name="fullName" state={state} /></span>
        <label>Work email<input aria-describedby="invite-email-error" autoComplete="email" name="email" placeholder="jane@agency.co.uk" required type="email" /></label>
        <span id="invite-email-error"><FieldError name="email" state={state} /></span>
        <div className="form-grid">
          <label>Role<select name="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>{EDITABLE_ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select></label>
          <label>Team<select aria-describedby="invite-team-error" disabled={role === "senior_director"} name="teamId" required={role !== "senior_director"} defaultValue={teams[0]?.id ?? ""}><option disabled value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        </div>
        <span id="invite-team-error"><FieldError name="teamId" state={state} /></span>
        <button className="button button-primary admin-submit" disabled={pending || (role !== "senior_director" && teams.length === 0)} type="submit"><UserPlus size={16} aria-hidden="true" />{pending ? "Sending invite…" : "Send invitation"}</button>
        {teams.length === 0 && role !== "senior_director" ? <p className="form-hint">Create a team before inviting this role.</p> : null}
        <ActionMessage state={state} />
      </form>
    </section>
  );
}

function CreateTeamForm({ onDirectoryChanged }: { onDirectoryChanged: () => void }) {
  const [state, action, pending] = useActionState(createTeamAction, INITIAL_ACTION_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      onDirectoryChanged();
    }
  }, [onDirectoryChanged, state]);

  return (
    <section className="panel admin-form-card">
      <div className="admin-form-heading"><span><Building2 size={19} /></span><div><p className="eyebrow">Structure</p><h2>Create a team</h2></div></div>
      <form action={action} ref={formRef}>
        <label>Team name<input aria-describedby="team-name-error" name="name" placeholder="East Team" required /></label>
        <span id="team-name-error"><FieldError name="name" state={state} /></span>
        <button className="button button-quiet admin-submit" disabled={pending} type="submit"><Plus size={16} aria-hidden="true" />{pending ? "Creating…" : "Create team"}</button>
        <ActionMessage state={state} />
      </form>
    </section>
  );
}

function MemberCard({ actorId, member, teams, onDirectoryChanged }: { actorId: string; member: ManagedMember; teams: ManagedTeam[]; onDirectoryChanged: () => void }) {
  const [role, setRole] = useState(member.role);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updateMemberAction, INITIAL_ACTION_STATE);
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(deactivateMemberAction, INITIAL_ACTION_STATE);
  const isCurrentActor = member.id === actorId;

  useEffect(() => {
    if (updateState.status === "success" || deactivateState.status === "success") onDirectoryChanged();
  }, [deactivateState.status, onDirectoryChanged, updateState.status]);

  return (
    <article className={member.isActive ? "member-card" : "member-card member-card-inactive"}>
      <div className="member-identity">
        <span className="avatar">{member.initials}</span>
        <div><strong>{member.name}{isCurrentActor ? <small> You</small> : null}</strong><a href={`mailto:${member.email}`}>{member.email}</a></div>
        <span className={member.isActive ? "member-status" : "member-status member-status-inactive"}>{member.isActive ? "Active" : "Deactivated"}</span>
      </div>

      <div className="member-workload"><span>{member.openTaskCount} open {member.openTaskCount === 1 ? "task" : "tasks"}</span>{!member.isActive && member.openTaskCount > 0 ? <strong>Needs reassignment</strong> : null}</div>

      {member.isActive && !isCurrentActor ? (
        <form action={updateAction} className="member-edit-form">
          <input name="memberId" type="hidden" value={member.id} />
          <label><span>Role</span><select name="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>{EDITABLE_ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</select></label>
          <label><span>Team</span><select disabled={role === "senior_director"} name="teamId" required={role !== "senior_director"} defaultValue={member.teamId ?? teams[0]?.id ?? ""}><option disabled value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <button className="button button-quiet" disabled={updatePending} type="submit">{updatePending ? "Saving…" : "Save"}</button>
        </form>
      ) : (
        <div className="member-readonly-role"><span>{ROLE_LABELS[member.role]}</span><span>{teams.find((team) => team.id === member.teamId)?.name ?? "Organisation-wide"}</span></div>
      )}

      <ActionMessage state={updateState} />
      <ActionMessage state={deactivateState} />

      {member.isActive && !isCurrentActor ? (
        <div className="member-danger-zone">
          {showDeactivate ? (
            <form action={deactivateAction}>
              <input name="memberId" type="hidden" value={member.id} />
              <span>Block sign-in and workspace access?</span>
              <button className="button button-danger" disabled={deactivatePending} type="submit">{deactivatePending ? "Deactivating…" : "Yes, deactivate"}</button>
              <button className="text-button" disabled={deactivatePending} onClick={() => setShowDeactivate(false)} type="button">Cancel</button>
            </form>
          ) : <button className="text-button text-button-danger" onClick={() => setShowDeactivate(true)} type="button">Deactivate access</button>}
        </div>
      ) : null}
    </article>
  );
}
