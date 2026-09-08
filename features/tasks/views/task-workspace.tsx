"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Columns3,
  ImagePlus,
  ListTodo,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLE_LABELS, canManageTeamWork } from "@/features/identity/models/roles";
import { AccountMenu } from "@/features/identity/views/account-menu";
import { WorkspaceSidebar } from "@/features/navigation/views/workspace-sidebar";
import { createTaskWithAttachmentsAction, getTaskAttachmentsAction, updateTaskAction, updateTaskStatusAction } from "@/features/tasks/controllers/task.actions";
import { buildOverview, type ClientWorkloadRow, type Overview, type OwnerWorkloadRow } from "@/features/reports/services/overview.service";
import { DEFAULT_FILTERS, matchesTaskFilters, todayKey, type TaskFilters } from "@/features/tasks/models/task-filters";
import { PaginatedKanbanBoard } from "@/features/tasks/views/paginated-kanban-board";
import type { InitialKanbanPages } from "@/features/tasks/models/kanban";
import { MAX_TASK_ATTACHMENT_BYTES, MAX_TASK_ATTACHMENTS, type TaskAttachment } from "@/features/tasks/models/task-attachment";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Client,
  type Person,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type Team,
} from "@/features/tasks/models/task";

export type WorkspaceView = "overview" | "list" | "calendar" | "board";
type ComposerState = { title: string; description: string; clientId: string; assigneeIds: string[]; priority: TaskPriority; dueDate: string };
type WorkloadScope = "active" | "all";

type TaskWorkspaceProps = {
  initialActorId: string;
  initialTasks: Task[];
  people: Person[];
  clients: Client[];
  teams: Team[];
  initialTaskView?: Exclude<WorkspaceView, "overview">;
  initialView?: WorkspaceView;
  initialFilters?: TaskFilters;
  initialKanbanPages?: InitialKanbanPages;
};

const VIEWS: Array<{ id: WorkspaceView; label: string; href: string }> = [
  { id: "overview", label: "Overview", href: "/overview" },
  { id: "list", label: "List", href: "/list" },
  { id: "calendar", label: "Calendar", href: "/calendar" },
  { id: "board", label: "Kanban", href: "/kanban" },
];

const TASK_VIEW_OPTIONS = [
  { id: "list" as const, label: "List", icon: ListTodo },
  { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
  { id: "board" as const, label: "Kanban", icon: Columns3 },
];

function writeFilterParams(params: URLSearchParams, filters: TaskFilters) {
  const filterEntries: Array<[string, string]> = [
    ["client", filters.clientId],
    ["team", filters.teamId],
    ["owner", filters.ownerId],
    ["status", filters.status],
    ["priority", filters.priority],
    ["due", filters.due],
    ["q", filters.query],
  ];
  for (const [key, value] of filterEntries) {
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function fullDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function assigneesFor(task: Task, people: Person[]) {
  return people.filter((person) => task.assigneeIds.includes(person.id));
}

function clientFor(task: Task, clients: Client[]) {
  return clients.find((client) => client.id === task.clientId);
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`status-badge status-${status}`}>{TASK_STATUS_LABELS[status]}</span>;
}

function PriorityDot({ priority }: { priority: TaskPriority }) {
  return <span className={`priority priority-${priority}`}>{TASK_PRIORITY_LABELS[priority]}</span>;
}

function AssigneeAvatars({ task, people }: { task: Task; people: Person[] }) {
  const assignees = assigneesFor(task, people);
  return <span className="assignee-avatars" aria-label={`Assigned to ${assignees.map((person) => person.name).join(", ")}`}>{assignees.map((person) => <span className="avatar" key={person.id} title={person.name}>{person.initials}</span>)}</span>;
}

function AssigneeNames({ task, people }: { task: Task; people: Person[] }) {
  const assignees = assigneesFor(task, people);
  return <span className="person-cell"><AssigneeAvatars task={task} people={people} /><span>{assignees.map((person) => person.name).join(", ")}</span></span>;
}

export function TaskWorkspace({ initialActorId, initialTasks, people, clients, teams, initialTaskView, initialView, initialFilters = DEFAULT_FILTERS, initialKanbanPages }: TaskWorkspaceProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const view = initialView ?? "overview";
  const taskView = view === "overview" ? initialTaskView ?? "list" : view;
  const activeView = VIEWS.find((item) => item.id === view) ?? VIEWS[0];
  const [filters, setFilters] = useState<TaskFilters>(initialFilters);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [kanbanRefreshKey, setKanbanRefreshKey] = useState(0);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isAllocating, setIsAllocating] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const activeClients = clients.filter((client) => client.isActive);
  const [composer, setComposer] = useState<ComposerState>(() => ({
    title: "",
    description: "",
    clientId: clients.find((client) => client.isActive)?.id ?? "",
    assigneeIds: people.find((person) => person.role === "team_member")?.id ? [people.find((person) => person.role === "team_member")!.id] : [],
    priority: "medium",
    dueDate: todayKey(),
  }));
  const [editor, setEditor] = useState<ComposerState>({ title: "", description: "", clientId: "", assigneeIds: [], priority: "medium", dueDate: todayKey() });
  const [notice, setNotice] = useState<string | null>(null);
  const foundActor = people.find((person) => person.id === initialActorId);

  if (!foundActor) throw new Error("Your signed-in profile is not available in this workspace.");
  const actor = foundActor;
  const teamName = teams.find((team) => team.id === actor.teamId)?.name ?? null;

  const roleScopedTasks = useMemo(() => {
    if (actor.role === "senior_director") return tasks;
    return tasks.filter((task) => task.teamId === actor.teamId);
  }, [actor, tasks]);
  const filteredTasks = useMemo(() => roleScopedTasks.filter((task) => matchesTaskFilters(task, filters)), [filters, roleScopedTasks]);
  // Directors see everyone; other roles only ever report on their own team, so capacity rows stay relevant.
  const scopedPeople = useMemo(() => actor.role === "senior_director" ? people : people.filter((person) => person.teamId === actor.teamId), [actor, people]);
  const overview = useMemo(() => buildOverview(filteredTasks, scopedPeople, clients), [clients, filteredTasks, scopedPeople]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const canManage = canManageTeamWork(actor.role);
  const availableOwners = people.filter((person) => person.isActive && person.role === "team_member" && (actor.role === "senior_director" || person.teamId === actor.teamId));
  const navigationLinks = Object.fromEntries(VIEWS.map((item) => [item.id, hrefForView(item.id)]));
  navigationLinks.list = hrefForView(taskView);

  function syncUrl(nextFilters: TaskFilters) {
    const params = new URLSearchParams(window.location.search);
    params.delete("view");
    writeFilterParams(params, nextFilters);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function hrefForView(nextView: WorkspaceView) {
    const target = VIEWS.find((item) => item.id === nextView) ?? VIEWS[0];
    const params = new URLSearchParams();
    writeFilterParams(params, filters);
    if (nextView === "overview" && view !== "overview") params.set("taskView", view);
    const query = params.toString();
    return `${target.href}${query ? `?${query}` : ""}`;
  }

  function updateFilters(patch: Partial<TaskFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    syncUrl(next);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    syncUrl(DEFAULT_FILTERS);
  }

  function openComposer() {
    if (activeClients.length === 0) {
      setNotice("Add or restore an active client before allocating a new task.");
      return;
    }
    setComposer({ title: "", description: "", clientId: activeClients[0]?.id ?? "", assigneeIds: availableOwners[0]?.id ? [availableOwners[0].id] : [], priority: "medium", dueDate: todayKey() });
    setAttachments([]);
    setComposerError(null);
    setShowComposer(true);
  }

  function openTaskEditor(task: Task) {
    setEditor({ title: task.title, description: task.description, clientId: task.clientId, assigneeIds: task.assigneeIds, priority: task.priority, dueDate: task.dueDate });
    setEditorError(null);
    setEditingTask(task);
  }

  async function updateStatus(taskId: string, status: TaskStatus, knownTask?: Task) {
    const target = tasks.find((task) => task.id === taskId) ?? knownTask;
    if (!target) return false;
    if (!canManage && !target.assigneeIds.includes(actor.id)) {
      setNotice("This role can view team work but cannot update another person’s task.");
      return false;
    }
    const before = tasks;
    const updatedTask = { ...target, status, completedAt: status === "complete" ? todayKey() : null };
    setTasks((current) => current.some((task) => task.id === taskId) ? current.map((task) => task.id === taskId ? updatedTask : task) : [...current, updatedTask]);
    setNotice(`${target.title} moved to ${TASK_STATUS_LABELS[status]}.`);
    try {
      await updateTaskStatusAction(taskId, status);
      setKanbanRefreshKey((current) => current + 1);
      router.refresh();
      return true;
    } catch {
      setTasks(before);
      setNotice("The update could not be saved. Your previous task state has been restored.");
      return false;
    }
  }

  async function createTask() {
    if (!canManage) {
      setComposerError("Only managers can allocate tasks.");
      return;
    }
    if (!composer.title.trim()) {
      setComposerError("Enter a task name before allocating it.");
      return;
    }
    if (!activeClients.some((client) => client.id === composer.clientId)) {
      setComposerError("Select an active client before allocating a task.");
      return;
    }
    if (composer.assigneeIds.length === 0) {
      setComposerError("Select at least one assignee.");
      return;
    }
    const assignees = people.filter((person) => composer.assigneeIds.includes(person.id));
    const assigneeTeamId = assignees[0]?.teamId;
    if (!assigneeTeamId || assignees.length !== composer.assigneeIds.length || assignees.some((person) => person.teamId !== assigneeTeamId) || (actor.role === "account_director" && assigneeTeamId !== actor.teamId)) {
      setComposerError(actor.role === "account_director" ? "Account Directors can allocate work only within their own team." : "All assignees must belong to the same team.");
      return;
    }
    setIsAllocating(true);
    setComposerError(null);
    try {
      const formData = new FormData();
      formData.set("title", composer.title.trim());
      formData.set("description", composer.description);
      formData.set("clientId", composer.clientId);
      for (const assigneeId of composer.assigneeIds) formData.append("assigneeIds", assigneeId);
      formData.set("priority", composer.priority);
      formData.set("dueDate", composer.dueDate);
      for (const attachment of attachments) formData.append("attachments", attachment);

      const result = await createTaskWithAttachmentsAction(formData);
      const newTask: Task = { id: result.taskId, title: composer.title.trim(), description: composer.description.trim(), clientId: composer.clientId, teamId: assigneeTeamId, assigneeIds: composer.assigneeIds, createdById: actor.id, status: "todo", priority: composer.priority, dueDate: composer.dueDate, completedAt: null, createdAt: todayKey() };
      setTasks((current) => [newTask, ...current]);
      setShowComposer(false);
      setAttachments([]);
      setNotice(result.attachmentError ?? `${assignees.map((person) => person.name).join(", ")} have been allocated “${newTask.title}”. Assignment emails are queued in production.`);
      setKanbanRefreshKey((current) => current + 1);
      router.refresh();
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "The task could not be allocated.");
    } finally {
      setIsAllocating(false);
    }
  }

  async function editTask() {
    if (!editingTask || !canManage) return;
    if (!editor.title.trim()) {
      setEditorError("Enter a task name before saving your changes.");
      return;
    }
    const selectedClient = clients.find((client) => client.id === editor.clientId);
    if (!selectedClient || (!selectedClient.isActive && selectedClient.id !== editingTask.clientId)) {
      setEditorError("Select an active client before saving your changes.");
      return;
    }
    if (editor.assigneeIds.length === 0) {
      setEditorError("Select at least one assignee.");
      return;
    }
    const assignees = people.filter((person) => editor.assigneeIds.includes(person.id));
    const assigneeTeamId = assignees[0]?.teamId;
    if (!assigneeTeamId || assignees.length !== editor.assigneeIds.length || assignees.some((person) => person.teamId !== assigneeTeamId) || (actor.role === "account_director" && assigneeTeamId !== actor.teamId)) {
      setEditorError(actor.role === "account_director" ? "Account Directors can allocate work only within their own team." : "All assignees must belong to the same team.");
      return;
    }

    setIsSavingEdit(true);
    setEditorError(null);
    try {
      const updatedTask: Task = { ...editingTask, title: editor.title.trim(), description: editor.description.trim(), clientId: editor.clientId, teamId: assigneeTeamId, assigneeIds: editor.assigneeIds, priority: editor.priority, dueDate: editor.dueDate };
      await updateTaskAction({ taskId: editingTask.id, ...editor, title: updatedTask.title, description: updatedTask.description });
      setTasks((current) => current.map((task) => task.id === updatedTask.id ? updatedTask : task));
      setEditingTask(null);
      setNotice(`“${updatedTask.title}” was updated.`);
      setKanbanRefreshKey((current) => current + 1);
      router.refresh();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "The task could not be updated.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <main className="workspace-shell">
      <WorkspaceSidebar active={view} links={navigationLinks} showTeamManagement={actor.role === "senior_director"} teamName={teamName} />

      <section className="workspace-main">
        <header className="workspace-header">
          <p className="workspace-header-context"><span>Workspace</span><span aria-hidden="true">/</span><strong>{activeView.label}</strong></p>
          <AccountMenu initials={actor.initials} name={actor.name} role={actor.role} />
        </header>
        <div className="workspace-content">
          <header className="topbar"><div><p className="eyebrow">{ROLE_LABELS[actor.role]}</p><h1>Good morning, {actor.name.split(" ")[0]}.</h1></div><div className="topbar-actions"><span className="avatar avatar-large">{actor.initials}</span>{canManage ? <button className="button button-primary" onClick={openComposer} type="button"><Plus size={17} aria-hidden="true" />Allocate task</button> : null}</div></header>
          {notice ? <div className="notice" role="status"><CircleCheckBig size={17} aria-hidden="true" />{notice}</div> : null}
          <div className="task-view-controls">
            <FilterBar clients={clients} filters={filters} people={people} teams={teams} onChange={updateFilters} onReset={resetFilters} />
            {view !== "overview" ? <TaskViewSwitcher active={view} hrefForView={hrefForView} /> : null}
          </div>
          {view === "overview" ? <OverviewPanel overview={overview} tasks={filteredTasks} clients={clients} filters={filters} people={people} onSelectTask={setSelectedTaskId} onViewAll={() => router.push(hrefForView("list"))} onFilterChange={updateFilters} /> : null}
          {view !== "overview" && view !== "board" && filteredTasks.length === 0 ? <EmptyTasks onReset={resetFilters} /> : null}
          {view === "list" && filteredTasks.length > 0 ? <ListPanel tasks={filteredTasks} clients={clients} people={people} onSelectTask={setSelectedTaskId} /> : null}
          {view === "calendar" && filteredTasks.length > 0 ? <CalendarPanel tasks={filteredTasks} clients={clients} onSelectTask={setSelectedTaskId} /> : null}
          {view === "board" ? <PaginatedKanbanBoard clients={clients} people={people} filters={filters} initialFilters={initialFilters} initialPages={initialKanbanPages} refreshKey={kanbanRefreshKey} onMove={(task, status) => updateStatus(task.id, status, task)} onSelectTask={(task) => { setTasks((current) => current.some((item) => item.id === task.id) ? current : [...current, task]); setSelectedTaskId(task.id); }} /> : null}
        </div>
      </section>

      {selectedTask ? <TaskDetail task={selectedTask} people={people} clients={clients} onClose={() => setSelectedTaskId(null)} onEdit={() => openTaskEditor(selectedTask)} onStatusChange={updateStatus} canEdit={canManage} canUpdate={canManage || selectedTask.assigneeIds.includes(actor.id)} /> : null}
      {showComposer ? <TaskComposer attachments={attachments} clients={clients} error={composerError} isSubmitting={isAllocating} owners={availableOwners} value={composer} onAttachmentsChange={setAttachments} onChange={setComposer} onClose={() => setShowComposer(false)} onCreate={createTask} /> : null}
      {editingTask ? <TaskEditor clients={clients} error={editorError} isSubmitting={isSavingEdit} owners={availableOwners} task={editingTask} value={editor} onChange={setEditor} onClose={() => setEditingTask(null)} onSave={editTask} /> : null}
    </main>
  );
}

function FilterBar({ clients, filters, people, teams, onChange, onReset }: { clients: Client[]; filters: TaskFilters; people: Person[]; teams: Team[]; onChange: (patch: Partial<TaskFilters>) => void; onReset: () => void }) {
  const hasActiveFilters = filters.query.trim().length > 0 || filters.clientId !== "all" || filters.teamId !== "all" || filters.ownerId !== "all" || filters.status !== "all" || filters.priority !== "all" || filters.due !== "all";
  return <section className="filter-bar" aria-label="Task filters"><div className="search-field"><Search size={17} aria-hidden="true" /><input value={filters.query} onChange={(event) => onChange({ query: event.target.value })} placeholder="Search tasks" aria-label="Search tasks" /></div><select value={filters.clientId} onChange={(event) => onChange({ clientId: event.target.value })} aria-label="Filter by client"><option value="all">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><select value={filters.teamId} onChange={(event) => onChange({ teamId: event.target.value })} aria-label="Filter by team"><option value="all">All teams</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><select value={filters.ownerId} onChange={(event) => onChange({ ownerId: event.target.value })} aria-label="Filter by assignee"><option value="all">All assignees</option>{people.filter((person) => person.role === "team_member").map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><select value={filters.status} onChange={(event) => onChange({ status: event.target.value as TaskFilters["status"] })} aria-label="Filter by status"><option value="all">All statuses</option>{TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}</select><select value={filters.priority} onChange={(event) => onChange({ priority: event.target.value as TaskFilters["priority"] })} aria-label="Filter by priority"><option value="all">All priorities</option>{Object.entries(TASK_PRIORITY_LABELS).map(([priority, label]) => <option key={priority} value={priority}>{label}</option>)}</select><select value={filters.due} onChange={(event) => onChange({ due: event.target.value as TaskFilters["due"] })} aria-label="Filter by due date"><option value="all">Any deadline</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="week">Due this week</option></select><button className="icon-button filter-clear" type="button" onClick={onReset} aria-label="Clear all filters" title="Clear all filters" disabled={!hasActiveFilters}><X size={17} aria-hidden="true" /><span>Clear</span></button></section>;
}

function TaskViewSwitcher({ active, hrefForView }: { active: WorkspaceView; hrefForView: (view: WorkspaceView) => string }) {
  return <nav aria-label="Task view" className="view-switcher workspace-view-switcher">{TASK_VIEW_OPTIONS.map((item) => {
    const Icon = item.icon;
    const isActive = active === item.id;
    return <Link aria-current={isActive ? "page" : undefined} aria-label={item.label} className={isActive ? "view-switcher-item view-switcher-item-active" : "view-switcher-item"} href={hrefForView(item.id)} key={item.id} title={item.label}><Icon size={17} aria-hidden="true" /></Link>;
  })}</nav>;
}

function Metric({ label, value, context, icon, tone = "default" }: { label: string; value: string | number; context: string; icon: ReactNode; tone?: "default" | "danger" | "accent" | "success" }) {
  return <article className={`metric metric-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><span>{context}</span></article>;
}

function CompactTaskList({ tasks, clients, people, onSelectTask }: { tasks: Task[]; clients: Client[]; people: Person[]; onSelectTask: (id: string) => void }) {
  if (tasks.length === 0) return <div className="compact-empty"><CheckCircle2 size={20} aria-hidden="true" /><span><strong>Nothing needs attention</strong><small>Your current filters have no open tasks.</small></span></div>;
  return <div className="compact-list">{tasks.map((task) => <button className="compact-task" onClick={() => onSelectTask(task.id)} type="button" key={task.id}><span className={`priority-marker priority-${task.priority}`} /><span className="compact-task-main"><strong>{task.title}</strong><small>{clientFor(task, clients)?.name} · Due {formatDate(task.dueDate)}</small></span><AssigneeAvatars task={task} people={people} /><StatusBadge status={task.status} /></button>)}</div>;
}

function WorkloadScopeToggle({ label, value, onChange }: { label: string; value: WorkloadScope; onChange: (value: WorkloadScope) => void }) {
  return (
    <div aria-label={label} className="workload-scope" role="group">
      <button aria-pressed={value === "active"} className={value === "active" ? "workload-scope-button workload-scope-button-active" : "workload-scope-button"} onClick={() => onChange("active")} type="button">Open work</button>
      <button aria-pressed={value === "all"} className={value === "all" ? "workload-scope-button workload-scope-button-active" : "workload-scope-button"} onClick={() => onChange("all")} type="button">All</button>
    </div>
  );
}

function ClientWorkloadPanel({ rows, activeClientId, onFilterClient }: { rows: ClientWorkloadRow[]; activeClientId: string; onFilterClient: (clientId: string) => void }) {
  const [scope, setScope] = useState<WorkloadScope>("active");
  const visibleRows = scope === "active" ? rows.filter((row) => row.open > 0) : rows;
  const atRisk = visibleRows.filter((row) => row.overdue > 0).length;
  const panelTag = atRisk ? `${atRisk} at risk` : visibleRows.length === 0 && scope === "active" ? "No open work" : "All on track";
  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Client delivery</p>
          <h2>Where work stands by client</h2>
        </div>
        <div className="panel-heading-actions">
          <WorkloadScopeToggle label="Client delivery visibility" value={scope} onChange={setScope} />
          <span className={atRisk ? "panel-tag panel-tag-danger" : "panel-tag"}>{panelTag}</span>
        </div>
      </div>
      {visibleRows.length === 0 ? (
        <p className="panel-empty">{scope === "active" ? "No clients have open work in scope for your current filters." : "No client work is in scope for your current filters."}</p>
      ) : (
        <>
          <p className="panel-note">{scope === "active" ? "Showing clients with open work, sorted by risk." : "Showing all clients with assigned work, including delivered work."} Select a client to filter every view to their work.</p>
          <ul className="client-load-list">
            {visibleRows.map((row) => {
              const isComplete = row.open === 0;
              const state = row.overdue > 0 ? "danger" : isComplete ? "complete" : "active";
              const isActive = activeClientId === row.id;
              return (
                <li key={row.id}>
                  <button aria-pressed={isActive} className={`client-load-row client-load-row-${state}${isActive ? " client-load-row-selected" : ""}`} onClick={() => onFilterClient(isActive ? "all" : row.id)} type="button">
                    <span className="client-load-head">
                      <strong>{row.label}</strong>
                      <span className={`client-load-status client-load-status-${state}`}>
                        {row.overdue > 0 ? <><AlertTriangle size={13} aria-hidden="true" />{row.overdue} overdue</> : isComplete ? <><CheckCircle2 size={13} aria-hidden="true" />All done</> : `${row.open} open`}
                      </span>
                    </span>
                    <span aria-hidden="true" className={`client-load-track client-load-track-${state}`}>
                      <span style={{ width: `${row.completionRate}%` }} />
                    </span>
                    <span className="client-load-meta">
                      <span>{row.completed} of {row.total} complete · {row.completionRate}%</span>
                      {row.dueSoon > 0 ? <span className="client-load-soon">{row.dueSoon} due in 7 days</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function CapacityPanel({ rows, peakLoad, unassignedOpen, activeOwnerId, onFilterOwner }: { rows: OwnerWorkloadRow[]; peakLoad: number; unassignedOpen: number; activeOwnerId: string; onFilterOwner: (ownerId: string) => void }) {
  const [scope, setScope] = useState<WorkloadScope>("active");
  const visibleRows = scope === "active" ? rows.filter((row) => row.open > 0) : rows;
  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Capacity</p>
          <h2>Who is carrying the load</h2>
        </div>
        <WorkloadScopeToggle label="Capacity visibility" value={scope} onChange={setScope} />
      </div>
      {visibleRows.length === 0 ? (
        <p className="panel-empty">{scope === "active" ? "No team members have open tasks in scope for your current filters." : "No team members are in scope for your current filters."}</p>
      ) : (
        <>
          <p className="panel-note">{scope === "active" ? "Showing people with open tasks, busiest first." : "Showing everyone in scope, including people with no open tasks."} Bars are relative to the heaviest load.</p>
          <ul className="capacity-list">
            {visibleRows.map((row) => {
              const share = peakLoad ? Math.round((row.open / peakLoad) * 100) : 0;
              const state = row.overdue > 0 ? "danger" : row.open === 0 ? "clear" : "active";
              const isActive = activeOwnerId === row.id;
              return (
                <li key={row.id}>
                  <button aria-pressed={isActive} className={isActive ? "capacity-row capacity-row-selected" : "capacity-row"} onClick={() => onFilterOwner(isActive ? "all" : row.id)} type="button">
                    <span className="avatar">{row.initials}</span>
                    <span className="capacity-main">
                      <strong>{row.label}{row.isActive ? "" : " (deactivated)"}</strong>
                      <span aria-hidden="true" className={`capacity-track capacity-track-${state}`}><span style={{ width: `${row.open === 0 ? 0 : Math.max(share, 8)}%` }} /></span>
                      <small>{row.open === 0 ? "No open tasks" : `${row.open} open${row.dueSoon ? ` · ${row.dueSoon} due in 7 days` : ""}`}</small>
                    </span>
                    {row.overdue > 0 ? <span className="capacity-flag"><AlertTriangle size={12} aria-hidden="true" />{row.overdue}</span> : <span className="capacity-count">{row.open}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {unassignedOpen > 0 ? <p className="capacity-unassigned"><AlertTriangle size={14} aria-hidden="true" />{unassignedOpen} open {unassignedOpen === 1 ? "task has" : "tasks have"} nobody assigned.</p> : null}
    </div>
  );
}

function OverviewPanel({ overview, tasks, clients, filters, people, onSelectTask, onViewAll, onFilterChange }: { overview: Overview; tasks: Task[]; clients: Client[]; filters: TaskFilters; people: Person[]; onSelectTask: (id: string) => void; onViewAll: () => void; onFilterChange: (patch: Partial<TaskFilters>) => void }) {
  return (
    <div className="page-stack">
      <section className="metric-grid" aria-label="Operational overview">
        <Metric label="Open work" value={overview.open} context="Across your visible workload" icon={<ListTodo size={21} />} />
        <Metric label="Overdue" value={overview.overdue} context={overview.overdue ? "Needs immediate attention" : "Nothing past its deadline"} icon={<AlertTriangle size={21} />} tone="danger" />
        <Metric label="Due in 7 days" value={overview.dueSoon} context="Plan capacity early" icon={<CalendarDays size={21} />} tone="accent" />
        <Metric label="Completion" value={`${overview.completionRate}%`} context={`${overview.onTimeRate}% completed on time`} icon={<CheckCircle2 size={21} />} tone="success" />
      </section>
      <section className="content-grid">
        <ClientWorkloadPanel rows={overview.byClient} activeClientId={filters.clientId} onFilterClient={(clientId) => onFilterChange({ clientId })} />
        <CapacityPanel rows={overview.byOwner} peakLoad={overview.peakOwnerLoad} unassignedOpen={overview.unassignedOpen} activeOwnerId={filters.ownerId} onFilterOwner={(ownerId) => onFilterChange({ ownerId })} />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Priority queue</p><h2>Tasks needing attention</h2></div>
          <button type="button" className="text-button" onClick={onViewAll}>View all <ArrowRight size={15} aria-hidden="true" /></button>
        </div>
        <CompactTaskList tasks={tasks.filter((task) => task.status !== "complete").slice(0, 5)} clients={clients} people={people} onSelectTask={onSelectTask} />
      </section>
    </div>
  );
}

function EmptyTasks({ onReset }: { onReset: () => void }) {
  return <section className="empty-state" aria-live="polite"><span className="empty-state-icon"><SearchX size={24} aria-hidden="true" /></span><p className="eyebrow">No matching tasks</p><h2>Try a broader filter</h2><p>Clear the current filters to return to your complete visible workload.</p><button type="button" className="button button-primary" onClick={onReset}>Clear filters</button></section>;
}

function ListPanel({ tasks, clients, people, onSelectTask }: { tasks: Task[]; clients: Client[]; people: Person[]; onSelectTask: (id: string) => void }) {
  return <section className="panel task-list-panel"><div className="panel-heading"><div><p className="eyebrow">List view</p><h2>{tasks.length} matching tasks</h2></div></div><div className="table-wrap"><table><thead><tr><th>Task</th><th>Client</th><th>Assignees</th><th>Deadline</th><th>Priority</th><th>Status</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} onClick={() => onSelectTask(task.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectTask(task.id); } }} role="button" tabIndex={0}><td><strong>{task.title}</strong><span>{task.description}</span></td><td>{clientFor(task, clients)?.name}</td><td><AssigneeNames task={task} people={people} /></td><td className={task.status !== "complete" && task.dueDate < todayKey() ? "deadline-overdue" : ""}>{formatDate(task.dueDate)}</td><td><PriorityDot priority={task.priority} /></td><td><StatusBadge status={task.status} /></td></tr>)}</tbody></table></div></section>;
}

function CalendarPanel({ tasks, clients, onSelectTask }: { tasks: Task[]; clients: Client[]; onSelectTask: (id: string) => void }) {
  const [visibleMonth, setVisibleMonth] = useState(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), 1); }); const year = visibleMonth.getFullYear(); const month = visibleMonth.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const days = new Date(year, month + 1, 0).getDate(); const cells = Array.from({ length: firstDay + days }, (_, index) => index < firstDay ? null : index - firstDay + 1); const dateForDay = (day: number) => new Date(year, month, day, 12).toISOString().slice(0, 10); const changeMonth = (offset: number) => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  return <section className="panel calendar-panel"><div className="panel-heading"><div><p className="eyebrow">Calendar view</p><h2 aria-live="polite">{visibleMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2></div><div className="calendar-arrows"><button className="icon-button" type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={18} aria-hidden="true" /></button><button className="icon-button" type="button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={18} aria-hidden="true" /></button></div></div><div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => { const key = day ? dateForDay(day) : `blank-${index}`; const dayTasks = day ? tasks.filter((task) => task.dueDate === key) : []; return <div className={day ? `calendar-cell ${key === todayKey() ? "calendar-today" : ""}` : "calendar-cell calendar-empty"} key={key}>{day ? <><span className="calendar-date">{day}</span>{dayTasks.slice(0, 3).map((task) => <button aria-label={`${task.status === "complete" ? "Completed" : TASK_STATUS_LABELS[task.status]} task: ${task.title}`} className={`calendar-task priority-${task.priority} status-${task.status}`} type="button" key={task.id} onClick={() => onSelectTask(task.id)}>{task.title}<small>{clientFor(task, clients)?.name}</small></button>)}</> : null}</div>; })}</div></section>;
}

function TaskDetail({ task, clients, people, onClose, onEdit, onStatusChange, canEdit, canUpdate }: { task: Task; clients: Client[]; people: Person[]; onClose: () => void; onEdit: () => void; onStatusChange: (id: string, status: TaskStatus) => void; canEdit: boolean; canUpdate: boolean }) {
  const assignees = assigneesFor(task, people);
  return <aside className="detail-panel" aria-label="Task details"><div className="detail-heading"><span className="eyebrow">Task detail</span><div className="detail-heading-actions">{canEdit ? <button className="text-button detail-edit-button" type="button" onClick={onEdit}><Pencil size={15} aria-hidden="true" />Edit task</button> : null}<button type="button" className="icon-button" onClick={onClose} aria-label="Close task detail"><X size={18} /></button></div></div><h2>{task.title}</h2>{task.description ? <p className="detail-description">{task.description}</p> : null}<TaskAttachments key={task.id} taskId={task.id} /><div className="detail-grid"><div><span>Client</span><strong>{clientFor(task, clients)?.name}</strong></div><div><span>Due date</span><strong className={task.status !== "complete" && task.dueDate < todayKey() ? "deadline-overdue" : ""}>{fullDate(task.dueDate)}</strong></div><div><span>Assignees</span><AssigneeNames task={task} people={people} /></div><div><span>Priority</span><PriorityDot priority={task.priority} /></div></div><label className="status-control"><span>Status</span><select value={task.status} onChange={(event) => onStatusChange(task.id, event.target.value as TaskStatus)} disabled={!canUpdate}>{TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}</select></label><div className="activity"><p className="eyebrow">Activity</p><div><i /><span><strong>{assignees.map((person) => person.name).join(", ")}</strong> are assigned to this task<small>Assignment recorded</small></span></div><div><i /><span>Deadline set for <strong>{fullDate(task.dueDate)}</strong><small>Task created</small></span></div></div></aside>;
}

function TaskAttachments({ taskId }: { taskId: string }) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void getTaskAttachmentsAction(taskId).then((nextAttachments) => {
      if (!active) return;
      setAttachments(nextAttachments);
      setState("ready");
    }).catch(() => {
      if (active) setState("error");
    });
    return () => { active = false; };
  }, [taskId]);

  if (state === "loading") return <div className="task-attachments task-attachments-loading"><LoaderCircle size={16} aria-hidden="true" />Loading images…</div>;
  if (state === "error") return <p className="task-attachments-error">Images could not be loaded.</p>;
  if (attachments.length === 0) return null;

  return (
    <section className="task-attachments" aria-label="Task images">
      <p className="eyebrow">Images</p>
      <div className="task-image-grid">
        {attachments.map((attachment) => (
          <a href={attachment.url} key={attachment.id} target="_blank" rel="noreferrer" title={`Open ${attachment.fileName}`}>
            {/* The signed source URL is access-controlled and short-lived, so it is deliberately not proxied or cached by the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.url} alt={attachment.fileName} />
          </a>
        ))}
      </div>
    </section>
  );
}

function TaskEditor({ clients, error, isSubmitting, owners, task, value, onChange, onClose, onSave }: { clients: Client[]; error: string | null; isSubmitting: boolean; owners: Person[]; task: Task; value: ComposerState; onChange: Dispatch<SetStateAction<ComposerState>>; onClose: () => void; onSave: () => Promise<void> }) {
  const [isAssigneeMenuOpen, setIsAssigneeMenuOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const selectedAssignees = owners.filter((owner) => value.assigneeIds.includes(owner.id));
  const matchingAssignees = owners.filter((owner) => owner.name.toLowerCase().includes(assigneeQuery.trim().toLowerCase()));
  const selectedTeamId = selectedAssignees[0]?.teamId;
  const selectableClients = clients.filter((client) => client.isActive || client.id === task.clientId);
  const formHint = !value.title.trim()
    ? "Enter a task name to save your changes."
    : value.assigneeIds.length === 0
      ? "Select at least one assignee to save your changes."
      : null;

  function toggleAssignee(assigneeId: string) {
    onChange((current) => ({ ...current, assigneeIds: current.assigneeIds.includes(assigneeId) ? current.assigneeIds.filter((id) => id !== assigneeId) : [...current.assigneeIds, assigneeId] }));
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="composer" role="dialog" aria-modal="true" aria-labelledby="edit-task-title">
        <div className="detail-heading">
          <div><p className="eyebrow">Manager action</p><h2 id="edit-task-title">Edit task</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close edit task form" disabled={isSubmitting}><X size={18} /></button>
        </div>
        <label>Task name<input autoFocus value={value.title} onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))} placeholder="What needs to happen?" disabled={isSubmitting} /></label>
        <label className="composer-description">Description <span>Optional</span><textarea value={value.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} placeholder="Add context, links, or acceptance criteria…" maxLength={5000} disabled={isSubmitting} /></label>
        <div className="form-grid">
          <label>Client<select value={value.clientId} onChange={(event) => onChange((current) => ({ ...current, clientId: event.target.value }))} disabled={isSubmitting}>{selectableClients.map((client) => <option disabled={!client.isActive} key={client.id} value={client.id}>{client.name}{client.isActive ? "" : " (archived)"}</option>)}</select></label>
          <label>Priority<select value={value.priority} onChange={(event) => onChange((current) => ({ ...current, priority: event.target.value as TaskPriority }))} disabled={isSubmitting}>{Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Due date<input type="date" value={value.dueDate} onChange={(event) => onChange((current) => ({ ...current, dueDate: event.target.value }))} disabled={isSubmitting} /></label>
        </div>
        <div className="assignee-select">
          <span id="edit-task-assignee-select-label">Assignees <small>Choose one or more people from the same team</small></span>
          <button className="assignee-select-trigger" type="button" aria-expanded={isAssigneeMenuOpen} aria-controls="edit-task-assignee-select-menu" aria-labelledby="edit-task-assignee-select-label" onClick={() => setIsAssigneeMenuOpen((open) => !open)} disabled={isSubmitting}>
            <span>{selectedAssignees.length ? `${selectedAssignees.length} assignee${selectedAssignees.length === 1 ? "" : "s"} selected` : "Select assignees"}</span><ChevronDown size={16} aria-hidden="true" />
          </button>
          {selectedAssignees.length ? <div className="selected-assignee-chips">{selectedAssignees.map((owner) => <span key={owner.id}><span className="avatar">{owner.initials}</span>{owner.name}<button type="button" onClick={() => toggleAssignee(owner.id)} aria-label={`Remove ${owner.name}`} disabled={isSubmitting}><X size={13} aria-hidden="true" /></button></span>)}</div> : null}
          {isAssigneeMenuOpen ? <div className="assignee-select-menu" id="edit-task-assignee-select-menu">
            <label className="assignee-search"><Search size={16} aria-hidden="true" /><input autoFocus value={assigneeQuery} onChange={(event) => setAssigneeQuery(event.target.value)} placeholder="Search people…" aria-label="Search assignees" /></label>
            <div className="assignee-options">{matchingAssignees.length ? matchingAssignees.map((owner) => {
              const isSelected = value.assigneeIds.includes(owner.id);
              const isOtherTeam = Boolean(selectedTeamId && owner.teamId !== selectedTeamId);
              return <label className={isOtherTeam && !isSelected ? "assignee-option-disabled" : undefined} key={owner.id}><input type="checkbox" checked={isSelected} onChange={() => toggleAssignee(owner.id)} disabled={isSubmitting || (isOtherTeam && !isSelected)} /><span className="avatar">{owner.initials}</span><span>{owner.name}</span></label>;
            }) : <p>No matching people.</p>}</div>
          </div> : null}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {formHint ? <p className="form-hint" role="status">{formHint}</p> : null}
        <div className="composer-actions">
          <button type="button" className="button button-quiet" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="button" className="button button-primary" onClick={() => void onSave()} disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="button-spinner" size={17} aria-hidden="true" /> : <Pencil size={17} aria-hidden="true" />}{isSubmitting ? "Saving…" : "Save changes"}</button>
        </div>
      </section>
    </div>
  );
}

function TaskComposer({ attachments, clients, error, isSubmitting, owners, value, onAttachmentsChange, onChange, onClose, onCreate }: { attachments: File[]; clients: Client[]; error: string | null; isSubmitting: boolean; owners: Person[]; value: ComposerState; onAttachmentsChange: (files: File[]) => void; onChange: Dispatch<SetStateAction<ComposerState>>; onClose: () => void; onCreate: () => Promise<void> }) {
  const totalSize = attachments.reduce((total, file) => total + file.size, 0);
  const invalidFiles = attachments.length > MAX_TASK_ATTACHMENTS || attachments.some((file) => file.size > MAX_TASK_ATTACHMENT_BYTES || !["image/png", "image/jpeg", "image/webp"].includes(file.type));
  const activeClients = clients.filter((client) => client.isActive);
  const [isAssigneeMenuOpen, setIsAssigneeMenuOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const selectedAssignees = owners.filter((owner) => value.assigneeIds.includes(owner.id));
  const matchingAssignees = owners.filter((owner) => owner.name.toLowerCase().includes(assigneeQuery.trim().toLowerCase()));
  const selectedTeamId = selectedAssignees[0]?.teamId;
  const formHint = !value.title.trim()
    ? "Enter a task name to allocate it."
    : value.assigneeIds.length === 0
      ? "Select at least one assignee to allocate this task."
      : null;

  function toggleAssignee(assigneeId: string) {
    onChange((current) => ({ ...current, assigneeIds: current.assigneeIds.includes(assigneeId) ? current.assigneeIds.filter((id) => id !== assigneeId) : [...current.assigneeIds, assigneeId] }));
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="composer" role="dialog" aria-modal="true" aria-labelledby="allocate-task-title">
        <div className="detail-heading">
          <div><p className="eyebrow">Manager action</p><h2 id="allocate-task-title">Allocate task</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close allocation form" disabled={isSubmitting}><X size={18} /></button>
        </div>
        <label>Task name<input autoFocus value={value.title} onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))} placeholder="What needs to happen?" disabled={isSubmitting} /></label>
        <label className="composer-description">Description <span>Optional</span><textarea value={value.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} placeholder="Add context, links, or acceptance criteria…" maxLength={5000} disabled={isSubmitting} /></label>
        <div className="form-grid">
          <label>Client<select value={value.clientId} onChange={(event) => onChange((current) => ({ ...current, clientId: event.target.value }))} disabled={isSubmitting || activeClients.length === 0}>{activeClients.length ? activeClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>) : <option value="">No active clients</option>}</select></label>
          <label>Priority<select value={value.priority} onChange={(event) => onChange((current) => ({ ...current, priority: event.target.value as TaskPriority }))} disabled={isSubmitting}>{Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Due date<input type="date" value={value.dueDate} onChange={(event) => onChange((current) => ({ ...current, dueDate: event.target.value }))} disabled={isSubmitting} /></label>
        </div>
        <div className="assignee-select">
          <span id="assignee-select-label">Assignees <small>Choose one or more people from the same team</small></span>
          <button className="assignee-select-trigger" type="button" aria-expanded={isAssigneeMenuOpen} aria-controls="assignee-select-menu" aria-labelledby="assignee-select-label" onClick={() => setIsAssigneeMenuOpen((open) => !open)} disabled={isSubmitting}>
            <span>{selectedAssignees.length ? `${selectedAssignees.length} assignee${selectedAssignees.length === 1 ? "" : "s"} selected` : "Select assignees"}</span><ChevronDown size={16} aria-hidden="true" />
          </button>
          {selectedAssignees.length ? <div className="selected-assignee-chips">{selectedAssignees.map((owner) => <span key={owner.id}><span className="avatar">{owner.initials}</span>{owner.name}<button type="button" onClick={() => toggleAssignee(owner.id)} aria-label={`Remove ${owner.name}`} disabled={isSubmitting}><X size={13} aria-hidden="true" /></button></span>)}</div> : null}
          {isAssigneeMenuOpen ? <div className="assignee-select-menu" id="assignee-select-menu">
            <label className="assignee-search"><Search size={16} aria-hidden="true" /><input autoFocus value={assigneeQuery} onChange={(event) => setAssigneeQuery(event.target.value)} placeholder="Search people…" aria-label="Search assignees" /></label>
            <div className="assignee-options">{matchingAssignees.length ? matchingAssignees.map((owner) => {
              const isSelected = value.assigneeIds.includes(owner.id);
              const isOtherTeam = Boolean(selectedTeamId && owner.teamId !== selectedTeamId);
              return <label className={isOtherTeam && !isSelected ? "assignee-option-disabled" : undefined} key={owner.id}><input type="checkbox" checked={isSelected} onChange={() => toggleAssignee(owner.id)} disabled={isSubmitting || (isOtherTeam && !isSelected)} /><span className="avatar">{owner.initials}</span><span>{owner.name}</span></label>;
            }) : <p>No matching people.</p>}</div>
          </div> : null}
        </div>
        <div className="attachment-picker">
          <label htmlFor="task-images"><ImagePlus size={17} aria-hidden="true" /><span>Add images <small>optional · PNG, JPEG, or WebP · up to {MAX_TASK_ATTACHMENTS} × 5 MB</small></span></label>
          <input id="task-images" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => onAttachmentsChange(Array.from(event.currentTarget.files ?? []))} disabled={isSubmitting} />
          {attachments.length > 0 ? <p className={invalidFiles ? "form-error" : "attachment-summary"}>{invalidFiles ? "Choose up to four PNG, JPEG, or WebP images no larger than 5 MB each." : `${attachments.length} image${attachments.length === 1 ? "" : "s"} selected · ${(totalSize / 1024 / 1024).toFixed(1)} MB`}</p> : null}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {formHint ? <p className="form-hint" role="status">{formHint}</p> : null}
        <div className="composer-actions">
          <button type="button" className="button button-quiet" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="button" className="button button-primary" onClick={() => void onCreate()} disabled={isSubmitting || invalidFiles || activeClients.length === 0}>{isSubmitting ? <LoaderCircle className="button-spinner" size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}{isSubmitting ? "Allocating…" : "Allocate and notify"}</button>
        </div>
      </section>
    </div>
  );
}
