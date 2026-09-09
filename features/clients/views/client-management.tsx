"use client";

import { Archive, Building2, CircleCheckBig, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AccountMenu } from "@/features/identity/views/account-menu";
import { WorkspaceMainLoading } from "@/features/navigation/views/workspace-main-loading";
import { WorkspaceSidebar } from "@/features/navigation/views/workspace-sidebar";
import {
  archiveClientAction,
  createClientAction,
  restoreClientAction,
  updateClientAction,
  type ClientActionState,
} from "@/features/clients/controllers/client-management.actions";
import type { AccountLead, ManagedClient } from "@/features/clients/models/client-management";
import type { Role } from "@/features/identity/models/roles";

const INITIAL_ACTION_STATE: ClientActionState = { status: "idle", message: "" };

type ClientManagementProps = {
  actor: { id: string; name: string; initials: string; role: Role; teamId: string | null };
  clients: ManagedClient[];
  accountLeads: AccountLead[];
};

export function ClientManagement({ actor, clients, accountLeads }: ClientManagementProps) {
  const [query, setQuery] = useState("");
  const activeClients = clients.filter((client) => client.isActive);
  const archivedClients = clients.length - activeClients.length;
  const unassignedClients = activeClients.filter((client) => !client.accountLeadId).length;
  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return clients;
    return clients.filter((client) => [client.name, client.accountLeadName ?? ""].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
  }, [clients, query]);

  return (
    <main className="workspace-shell">
      <WorkspaceSidebar active="clients" showTeamManagement teamName={null} />
      <section className="workspace-main">
        <header className="workspace-header">
          <p className="workspace-header-context"><span>Workspace</span><span aria-hidden="true">/</span><strong>Client management</strong></p>
          <AccountMenu actorId={actor.id} initials={actor.initials} name={actor.name} role={actor.role} />
        </header>
        <WorkspaceMainLoading active="clients" />

        <div className="workspace-content client-page-content">
          <header className="topbar team-topbar">
            <div><p className="eyebrow">Senior Director controls</p><h1>Client management</h1><p className="team-intro">Create client records, assign account leads, and archive workspaces that are no longer taking new tasks.</p></div>
            <span className="avatar avatar-large" title={actor.name}>{actor.initials}</span>
          </header>

          <section className="team-stat-grid" aria-label="Client summary">
            <ClientStat icon={<Building2 size={20} />} label="Active clients" value={activeClients.length} />
            <ClientStat icon={<Archive size={20} />} label="Archived clients" value={archivedClients} />
            <ClientStat icon={<Users size={20} />} label="Active clients without a lead" value={unassignedClients} warning={unassignedClients > 0} />
          </section>

          <div className="team-management-grid client-management-grid">
            <section className="panel client-directory" aria-label="Client directory">
              <div className="panel-heading team-directory-heading">
                <div><p className="eyebrow">Directory</p><h2>{visibleClients.length} {query.trim() ? "matching clients" : "clients"}</h2></div>
                <label className="team-search"><span className="sr-only">Search clients</span><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients or leads" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button> : null}</label>
              </div>
              <div className="client-list">
                {visibleClients.map((client) => <ClientCard accountLeads={accountLeads} client={client} key={client.id} />)}
                {visibleClients.length === 0 ? <div className="team-empty"><Search size={22} aria-hidden="true" /><strong>No matching clients</strong><span>Try a client or account-lead name.</span></div> : null}
              </div>
            </section>

            <aside className="team-actions-column" aria-label="Client administration actions">
              <CreateClientForm accountLeads={accountLeads} />
              <section className="team-security-note">
                <ShieldCheck size={18} aria-hidden="true" />
                <div><strong>Senior Director only</strong><p>Archived clients remain visible on historical tasks but cannot be selected when allocating new work.</p></div>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function ClientStat({ icon, label, value, warning = false }: { icon: React.ReactNode; label: string; value: number; warning?: boolean }) {
  return <article className={warning ? "team-stat team-stat-warning" : "team-stat"}><span>{icon}</span><div><strong>{value}</strong><p>{label}</p></div></article>;
}

function ActionMessage({ state }: { state: ClientActionState }) {
  if (state.status === "idle") return null;
  return <p className={state.status === "success" ? "action-message action-message-success" : "action-message action-message-error"} role={state.status === "error" ? "alert" : "status"}>{state.status === "success" ? <CircleCheckBig size={15} aria-hidden="true" /> : null}{state.message}</p>;
}

function FieldError({ state, name }: { state: ClientActionState; name: string }) {
  const message = state.fieldErrors?.[name]?.[0];
  return message ? <span className="field-error">{message}</span> : null;
}

function CreateClientForm({ accountLeads }: { accountLeads: AccountLead[] }) {
  const [state, action, pending] = useActionState(createClientAction, INITIAL_ACTION_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <section className="panel admin-form-card">
      <div className="admin-form-heading"><span><Plus size={19} /></span><div><p className="eyebrow">Directory</p><h2>Add a client</h2></div></div>
      <p className="admin-form-copy">Add only clients that should be available when new work is allocated.</p>
      <form action={action} ref={formRef}>
        <label>Client name<input aria-describedby="client-name-error" autoComplete="organization" name="name" placeholder="Acme Ltd" required /></label>
        <span id="client-name-error"><FieldError name="name" state={state} /></span>
        <label>Account lead <span className="form-label-optional">Optional</span><select name="accountLeadId" defaultValue=""><option value="">No account lead</option>{accountLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label>
        <button className="button button-primary admin-submit" disabled={pending} type="submit"><Plus size={16} aria-hidden="true" />{pending ? "Adding client…" : "Add client"}</button>
        {accountLeads.length === 0 ? <p className="form-hint">Add an active Account Director before assigning a lead.</p> : null}
        <ActionMessage state={state} />
      </form>
    </section>
  );
}

function ClientCard({ client, accountLeads }: { client: ManagedClient; accountLeads: AccountLead[] }) {
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updateClientAction, INITIAL_ACTION_STATE);
  const [archiveState, archiveAction, archivePending] = useActionState(archiveClientAction, INITIAL_ACTION_STATE);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreClientAction, INITIAL_ACTION_STATE);
  const currentLeadIsAvailable = !client.accountLeadId || accountLeads.some((lead) => lead.id === client.accountLeadId);
  const fieldId = `client-${client.id}-name-error`;

  return (
    <article className={client.isActive ? "client-card" : "client-card client-card-archived"}>
      <div className="client-card-heading">
        <div><strong>{client.name}</strong><span>{client.accountLeadName ? `Account lead: ${client.accountLeadName}` : "No account lead assigned"}</span></div>
        <span className={client.isActive ? "member-status" : "member-status member-status-inactive"}>{client.isActive ? "Active" : "Archived"}</span>
      </div>

      <form action={updateAction} className="client-edit-form">
        <input name="clientId" type="hidden" value={client.id} />
        <label><span>Client name</span><input aria-describedby={fieldId} defaultValue={client.name} name="name" required /></label>
        <label><span>Account lead</span><select name="accountLeadId" defaultValue={client.accountLeadId ?? ""}><option value="">No account lead</option>{!currentLeadIsAvailable && client.accountLeadId ? <option disabled value={client.accountLeadId}>{client.accountLeadName ?? "Former account lead"} (inactive)</option> : null}{accountLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label>
        <button className="button button-quiet" disabled={updatePending} type="submit">{updatePending ? "Saving…" : "Save"}</button>
        <span id={fieldId}><FieldError name="name" state={updateState} /></span>
      </form>
      <ActionMessage state={updateState} />

      {client.isActive ? (
        <div className="client-archive-zone">
          {showArchiveConfirm ? (
            <form action={archiveAction}>
              <input name="clientId" type="hidden" value={client.id} />
              <span>Hide this client from new task allocation? Existing tasks will stay unchanged.</span>
              <button className="button button-danger" disabled={archivePending} type="submit">{archivePending ? "Archiving…" : "Yes, archive"}</button>
              <button className="text-button" disabled={archivePending} onClick={() => setShowArchiveConfirm(false)} type="button">Cancel</button>
            </form>
          ) : <button className="text-button text-button-danger" onClick={() => setShowArchiveConfirm(true)} type="button">Archive client</button>}
          <ActionMessage state={archiveState} />
        </div>
      ) : (
        <div className="client-archive-zone client-restore-zone">
          <form action={restoreAction}>
            <input name="clientId" type="hidden" value={client.id} />
            <button className="button button-quiet" disabled={restorePending} type="submit">{restorePending ? "Restoring…" : "Restore client"}</button>
          </form>
          <ActionMessage state={restoreState} />
        </div>
      )}
    </article>
  );
}
