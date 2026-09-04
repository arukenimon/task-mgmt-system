"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Columns3,
  LayoutDashboard,
  ListFilter,
  ListTodo,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, canManageTeamWork } from "@/features/identity/models/roles";
import { createTaskAction, updateTaskStatusAction } from "@/features/tasks/controllers/task.actions";
import { buildOverview } from "@/features/reports/services/overview.service";
import { DEFAULT_FILTERS, matchesTaskFilters, todayKey, type TaskFilters } from "@/features/tasks/models/task-filters";
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

type WorkspaceView = "overview" | "list" | "calendar" | "board";
type ComposerState = { title: string; clientId: string; ownerId: string; priority: TaskPriority; dueDate: string };

type TaskWorkspaceProps = {
  initialActorId: string;
  initialTasks: Task[];
  people: Person[];
  clients: Client[];
  teams: Team[];
  initialView?: string;
  initialFilters?: TaskFilters;
  isDemo: boolean;
};

const VIEWS: Array<{ id: WorkspaceView; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "list", label: "List", icon: ListTodo },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "board", label: "Kanban", icon: Columns3 },
];

function isWorkspaceView(value: string | undefined): value is WorkspaceView {
  return Boolean(value && VIEWS.some((view) => view.id === value));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function fullDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function ownerFor(task: Task, people: Person[]) {
  return people.find((person) => person.id === task.ownerId);
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

export function TaskWorkspace({ initialActorId, initialTasks, people, clients, teams, initialView, initialFilters = DEFAULT_FILTERS, isDemo }: TaskWorkspaceProps) {
  const router = useRouter();
  const [actorId, setActorId] = useState(initialActorId);
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<WorkspaceView>(isWorkspaceView(initialView) ? initialView : "overview");
  const [filters, setFilters] = useState<TaskFilters>(initialFilters);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(() => ({
    title: "",
    clientId: clients[0]?.id ?? "",
    ownerId: people.find((person) => person.role === "team_member")?.id ?? "",
    priority: "medium",
    dueDate: todayKey(),
  }));
  const [notice, setNotice] = useState(isDemo ? "Demo workspace — connect Supabase to persist this data." : "Connected workspace — Supabase Auth and RLS are active.");
  const actor = people.find((person) => person.id === actorId) ?? people[0];

  const roleScopedTasks = useMemo(() => {
    if (actor.role === "senior_director") return tasks;
    return tasks.filter((task) => task.teamId === actor.teamId);
  }, [actor, tasks]);
  const filteredTasks = useMemo(() => roleScopedTasks.filter((task) => matchesTaskFilters(task, filters)), [filters, roleScopedTasks]);
  const overview = useMemo(() => buildOverview(roleScopedTasks, people, clients), [clients, people, roleScopedTasks]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const canManage = canManageTeamWork(actor.role);
  const availableOwners = people.filter((person) => person.role === "team_member" && (actor.role === "senior_director" || person.teamId === actor.teamId));

  function syncUrl(nextFilters: TaskFilters, nextView = view) {
    const params = new URLSearchParams(window.location.search);
    const filterEntries: Array<[string, string]> = [
      ["client", nextFilters.clientId],
      ["team", nextFilters.teamId],
      ["owner", nextFilters.ownerId],
      ["status", nextFilters.status],
      ["priority", nextFilters.priority],
      ["due", nextFilters.due],
      ["q", nextFilters.query],
    ];
    for (const [key, value] of filterEntries) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    if (nextView === "overview") params.delete("view");
    else params.set("view", nextView);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function updateFilters(patch: Partial<TaskFilters>) {
    setFilters((current) => {
      const next = { ...current, ...patch };
      syncUrl(next);
      return next;
    });
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    syncUrl(DEFAULT_FILTERS);
  }

  function changeView(nextView: WorkspaceView) {
    setView(nextView);
    syncUrl(filters, nextView);
  }

  function openComposer() {
    setComposer({ title: "", clientId: clients[0]?.id ?? "", ownerId: availableOwners[0]?.id ?? "", priority: "medium", dueDate: todayKey() });
    setShowComposer(true);
  }

  function updateStatus(taskId: string, status: TaskStatus) {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    if (!canManage && target.ownerId !== actor.id) {
      setNotice("This role can view team work but cannot update another person’s task.");
      return;
    }
    const before = tasks;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status, completedAt: status === "complete" ? todayKey() : null } : task));
    setNotice(`${target.title} moved to ${TASK_STATUS_LABELS[status]}.`);
    if (!isDemo) {
      void updateTaskStatusAction(taskId, status).then(() => router.refresh()).catch(() => {
        setTasks(before);
        setNotice("The update could not be saved. Your previous task state has been restored.");
      });
    }
  }

  function createTask() {
    if (!canManage || !composer.title.trim()) return;
    const owner = people.find((person) => person.id === composer.ownerId);
    if (!owner?.teamId || (actor.role === "account_director" && owner.teamId !== actor.teamId)) {
      setNotice("Account Directors can allocate work only within their own team.");
      return;
    }
    const newTask: Task = { id: `demo-${Date.now()}`, title: composer.title.trim(), description: "Newly allocated in this assessment workspace.", clientId: composer.clientId, teamId: owner.teamId, ownerId: owner.id, createdById: actor.id, status: "todo", priority: composer.priority, dueDate: composer.dueDate, completedAt: null, createdAt: todayKey() };
    setTasks((current) => [newTask, ...current]);
    setShowComposer(false);
    setComposer((current) => ({ ...current, title: "" }));
    setNotice(`${owner.name} has been allocated “${newTask.title}”. An assignment email is queued in production.`);
    if (!isDemo) {
      void createTaskAction({ title: newTask.title, description: newTask.description, clientId: newTask.clientId, ownerId: newTask.ownerId, priority: newTask.priority, dueDate: newTask.dueDate }).then(() => router.refresh()).catch(() => {
        setTasks((current) => current.filter((task) => task.id !== newTask.id));
        setNotice("The task could not be saved. No allocation email was sent.");
      });
    }
  }

  return (
    <main className="workspace-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">T</span><span>Task Hub</span></div>
        <p className="workspace-label">Internal workflow</p>
        <nav aria-label="Workspace views" className="workspace-nav">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return <button className={view === item.id ? "nav-item nav-item-active" : "nav-item"} key={item.id} onClick={() => changeView(item.id)} type="button"><Icon size={18} aria-hidden="true" />{item.label}</button>;
          })}
        </nav>
        <div className="sidebar-footer">{isDemo ? <><span className="eyebrow">Assessment mode</span><p>Switch personas to demonstrate the three reporting levels.</p><label className="sr-only" htmlFor="demo-role">Demo persona</label><select id="demo-role" value={actorId} onChange={(event) => setActorId(event.target.value)}><option value="director-1">Alex — Senior Director</option><option value="ad-north">Sophie — North AD</option><option value="ad-south">Marcus — South AD</option><option value="zoe">Zoe — North team</option><option value="olivia">Olivia — South team</option></select></> : <><span className="eyebrow">Secure session</span><p>Data visibility is governed by your signed-in role and team.</p></>}</div>
      </aside>

      <section className="workspace-main">
        <header className="topbar"><div><p className="eyebrow">{ROLE_LABELS[actor.role]}</p><h1>Good morning, {actor.name.split(" ")[0]}.</h1></div><div className="topbar-actions"><span className="avatar avatar-large">{actor.initials}</span>{canManage ? <button className="button button-primary" onClick={openComposer} type="button"><Plus size={17} aria-hidden="true" />Allocate task</button> : null}</div></header>
        <div className="notice" role="status"><CircleCheckBig size={17} aria-hidden="true" />{notice}</div>
        <FilterBar clients={clients} filters={filters} people={people} teams={teams} onChange={updateFilters} onReset={resetFilters} />
        {view === "overview" ? <OverviewPanel overview={overview} tasks={filteredTasks} clients={clients} people={people} onSelectTask={setSelectedTaskId} /> : null}
        {view === "list" ? <ListPanel tasks={filteredTasks} clients={clients} people={people} onSelectTask={setSelectedTaskId} /> : null}
        {view === "calendar" ? <CalendarPanel tasks={filteredTasks} clients={clients} onSelectTask={setSelectedTaskId} /> : null}
        {view === "board" ? <BoardPanel tasks={filteredTasks} clients={clients} people={people} onMove={updateStatus} onSelectTask={setSelectedTaskId} /> : null}
      </section>

      {selectedTask ? <TaskDetail task={selectedTask} people={people} clients={clients} onClose={() => setSelectedTaskId(null)} onStatusChange={updateStatus} canUpdate={canManage || selectedTask.ownerId === actor.id} /> : null}
      {showComposer ? <TaskComposer clients={clients} owners={availableOwners} value={composer} onChange={setComposer} onClose={() => setShowComposer(false)} onCreate={createTask} /> : null}
    </main>
  );
}

function FilterBar({ clients, filters, people, teams, onChange, onReset }: { clients: Client[]; filters: TaskFilters; people: Person[]; teams: Team[]; onChange: (patch: Partial<TaskFilters>) => void; onReset: () => void }) {
  return <section className="filter-bar" aria-label="Task filters"><div className="search-field"><Search size={17} aria-hidden="true" /><input value={filters.query} onChange={(event) => onChange({ query: event.target.value })} placeholder="Search tasks" aria-label="Search tasks" /></div><select value={filters.clientId} onChange={(event) => onChange({ clientId: event.target.value })} aria-label="Filter by client"><option value="all">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><select value={filters.teamId} onChange={(event) => onChange({ teamId: event.target.value })} aria-label="Filter by team"><option value="all">All teams</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><select value={filters.ownerId} onChange={(event) => onChange({ ownerId: event.target.value })} aria-label="Filter by owner"><option value="all">All owners</option>{people.filter((person) => person.role === "team_member").map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><select value={filters.status} onChange={(event) => onChange({ status: event.target.value as TaskFilters["status"] })} aria-label="Filter by status"><option value="all">All statuses</option>{TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}</select><select value={filters.priority} onChange={(event) => onChange({ priority: event.target.value as TaskFilters["priority"] })} aria-label="Filter by priority"><option value="all">All priorities</option>{Object.entries(TASK_PRIORITY_LABELS).map(([priority, label]) => <option key={priority} value={priority}>{label}</option>)}</select><select value={filters.due} onChange={(event) => onChange({ due: event.target.value as TaskFilters["due"] })} aria-label="Filter by due date"><option value="all">Any deadline</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="week">Due this week</option></select><button className="icon-button" type="button" onClick={onReset} aria-label="Clear all filters"><ListFilter size={18} /></button></section>;
}

function OverviewPanel({ overview, tasks, clients, people, onSelectTask }: { overview: ReturnType<typeof buildOverview>; tasks: Task[]; clients: Client[]; people: Person[]; onSelectTask: (id: string) => void }) {
  return <div className="page-stack"><section className="metric-grid" aria-label="Operational overview"><Metric label="Open work" value={overview.open} context="Across your visible workload" icon={<ListTodo size={21} />} /><Metric label="Overdue" value={overview.overdue} context="Needs immediate attention" icon={<AlertTriangle size={21} />} tone="danger" /><Metric label="Due in 7 days" value={overview.dueSoon} context="Plan capacity early" icon={<CalendarDays size={21} />} tone="accent" /><Metric label="Completion" value={`${overview.completionRate}%`} context={`${overview.onTimeRate}% completed on time`} icon={<CheckCircle2 size={21} />} tone="success" /></section><section className="content-grid content-grid-wide"><div className="panel panel-large"><div className="panel-heading"><div><p className="eyebrow">Director signal</p><h2>Client delivery health</h2></div><span className="muted">Current workload</span></div><div className="health-list">{overview.byClient.map((row) => <div className="health-row" key={row.label}><div><strong>{row.label}</strong><span>{row.total} active and completed tasks</span></div><div className="health-track"><span style={{ width: `${Math.min(100, row.total * 18)}%` }} /></div><span className={row.overdue ? "risk risk-danger" : "risk"}>{row.overdue ? `${row.overdue} overdue` : "On track"}</span></div>)}</div></div><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Capacity</p><h2>Team workload</h2></div></div><div className="workload-list">{overview.byOwner.map((row) => <div className="workload-row" key={row.label}><span className="avatar">{row.label.split(" ").map((part) => part[0]).join("")}</span><div><strong>{row.label}</strong><span>{row.open} open tasks</span></div><span className={row.overdue ? "count-alert" : "count-muted"}>{row.overdue || "—"}</span></div>)}</div></div></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Priority queue</p><h2>Tasks needing attention</h2></div><button type="button" className="text-button">View all <ArrowRight size={15} /></button></div><CompactTaskList tasks={tasks.filter((task) => task.status !== "complete").slice(0, 5)} clients={clients} people={people} onSelectTask={onSelectTask} /></section></div>;
}

function Metric({ label, value, context, icon, tone = "default" }: { label: string; value: string | number; context: string; icon: ReactNode; tone?: "default" | "danger" | "accent" | "success" }) {
  return <article className={`metric metric-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><span>{context}</span></article>;
}

function CompactTaskList({ tasks, clients, people, onSelectTask }: { tasks: Task[]; clients: Client[]; people: Person[]; onSelectTask: (id: string) => void }) {
  return <div className="compact-list">{tasks.map((task) => { const owner = ownerFor(task, people); return <button className="compact-task" onClick={() => onSelectTask(task.id)} type="button" key={task.id}><span className={`priority-marker priority-${task.priority}`} /><span className="compact-task-main"><strong>{task.title}</strong><small>{clientFor(task, clients)?.name} · Due {formatDate(task.dueDate)}</small></span><span className="avatar">{owner?.initials}</span><StatusBadge status={task.status} /></button>; })}</div>;
}

function ListPanel({ tasks, clients, people, onSelectTask }: { tasks: Task[]; clients: Client[]; people: Person[]; onSelectTask: (id: string) => void }) {
  return <section className="panel task-list-panel"><div className="panel-heading"><div><p className="eyebrow">List view</p><h2>{tasks.length} matching tasks</h2></div></div><div className="table-wrap"><table><thead><tr><th>Task</th><th>Client</th><th>Owner</th><th>Deadline</th><th>Priority</th><th>Status</th></tr></thead><tbody>{tasks.map((task) => { const owner = ownerFor(task, people); return <tr key={task.id} onClick={() => onSelectTask(task.id)} tabIndex={0}><td><strong>{task.title}</strong><span>{task.description}</span></td><td>{clientFor(task, clients)?.name}</td><td><span className="person-cell"><span className="avatar">{owner?.initials}</span>{owner?.name}</span></td><td className={task.status !== "complete" && task.dueDate < todayKey() ? "deadline-overdue" : ""}>{formatDate(task.dueDate)}</td><td><PriorityDot priority={task.priority} /></td><td><StatusBadge status={task.status} /></td></tr>; })}</tbody></table></div></section>;
}

function CalendarPanel({ tasks, clients, onSelectTask }: { tasks: Task[]; clients: Client[]; onSelectTask: (id: string) => void }) {
  const current = new Date(); const year = current.getFullYear(); const month = current.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const days = new Date(year, month + 1, 0).getDate(); const cells = Array.from({ length: firstDay + days }, (_, index) => index < firstDay ? null : index - firstDay + 1); const dateForDay = (day: number) => new Date(year, month, day, 12).toISOString().slice(0, 10);
  return <section className="panel calendar-panel"><div className="panel-heading"><div><p className="eyebrow">Calendar view</p><h2>{current.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2></div><div className="calendar-arrows"><button className="icon-button" type="button" aria-label="Previous month"><ChevronLeft size={18} /></button><button className="icon-button" type="button" aria-label="Next month"><ChevronRight size={18} /></button></div></div><div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((day, index) => { const key = day ? dateForDay(day) : `blank-${index}`; const dayTasks = day ? tasks.filter((task) => task.dueDate === key) : []; return <div className={day ? `calendar-cell ${key === todayKey() ? "calendar-today" : ""}` : "calendar-cell calendar-empty"} key={key}>{day ? <><span className="calendar-date">{day}</span>{dayTasks.slice(0, 3).map((task) => <button className={`calendar-task priority-${task.priority}`} type="button" key={task.id} onClick={() => onSelectTask(task.id)}>{task.title}<small>{clientFor(task, clients)?.name}</small></button>)}</> : null}</div>; })}</div></section>;
}

function BoardPanel({ tasks, clients, people, onMove, onSelectTask }: { tasks: Task[]; clients: Client[]; people: Person[]; onMove: (id: string, status: TaskStatus) => void; onSelectTask: (id: string) => void }) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  return <section className="board"><div className="board-heading"><div><p className="eyebrow">Kanban view</p><h2>Move work as it progresses</h2></div><span className="muted">Drag cards between columns</span></div><div className="board-columns">{TASK_STATUSES.map((status) => { const tasksForStatus = tasks.filter((task) => task.status === status); return <div className="board-column" key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedTaskId) onMove(draggedTaskId, status); setDraggedTaskId(null); }}><div className="column-heading"><span><i className={`status-dot status-${status}`} />{TASK_STATUS_LABELS[status]}</span><small>{tasksForStatus.length}</small></div><div className="board-cards">{tasksForStatus.map((task) => { const owner = ownerFor(task, people); return <article className="board-card" key={task.id} draggable onDragStart={() => setDraggedTaskId(task.id)}><button className="board-card-title" type="button" onClick={() => onSelectTask(task.id)}>{task.title}</button><span className="client-label">{clientFor(task, clients)?.name}</span><div className="board-card-footer"><PriorityDot priority={task.priority} /><span className="avatar">{owner?.initials}</span></div></article>; })}</div></div>; })}</div></section>;
}

function TaskDetail({ task, clients, people, onClose, onStatusChange, canUpdate }: { task: Task; clients: Client[]; people: Person[]; onClose: () => void; onStatusChange: (id: string, status: TaskStatus) => void; canUpdate: boolean }) {
  const owner = ownerFor(task, people);
  return <aside className="detail-panel" aria-label="Task details"><div className="detail-heading"><span className="eyebrow">Task detail</span><button type="button" className="icon-button" onClick={onClose} aria-label="Close task detail"><X size={18} /></button></div><h2>{task.title}</h2><p className="detail-description">{task.description}</p><div className="detail-grid"><div><span>Client</span><strong>{clientFor(task, clients)?.name}</strong></div><div><span>Due date</span><strong className={task.status !== "complete" && task.dueDate < todayKey() ? "deadline-overdue" : ""}>{fullDate(task.dueDate)}</strong></div><div><span>Owner</span><strong className="person-cell"><span className="avatar">{owner?.initials}</span>{owner?.name}</strong></div><div><span>Priority</span><PriorityDot priority={task.priority} /></div></div><label className="status-control"><span>Status</span><select value={task.status} onChange={(event) => onStatusChange(task.id, event.target.value as TaskStatus)} disabled={!canUpdate}>{TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}</select></label><div className="activity"><p className="eyebrow">Activity</p><div><i /><span><strong>{owner?.name}</strong> is accountable for this task<small>Assignment recorded</small></span></div><div><i /><span>Deadline set for <strong>{fullDate(task.dueDate)}</strong><small>Task created</small></span></div></div></aside>;
}

function TaskComposer({ clients, owners, value, onChange, onClose, onCreate }: { clients: Client[]; owners: Person[]; value: ComposerState; onChange: Dispatch<SetStateAction<ComposerState>>; onClose: () => void; onCreate: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="composer" role="dialog" aria-modal="true" aria-labelledby="allocate-task-title"><div className="detail-heading"><div><p className="eyebrow">Manager action</p><h2 id="allocate-task-title">Allocate task</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close allocation form"><X size={18} /></button></div><label>Task name<input autoFocus value={value.title} onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))} placeholder="What needs to happen?" /></label><div className="form-grid"><label>Client<select value={value.clientId} onChange={(event) => onChange((current) => ({ ...current, clientId: event.target.value }))}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Owner<select value={value.ownerId} onChange={(event) => onChange((current) => ({ ...current, ownerId: event.target.value }))}>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></label><label>Priority<select value={value.priority} onChange={(event) => onChange((current) => ({ ...current, priority: event.target.value as TaskPriority }))}>{Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Due date<input type="date" value={value.dueDate} onChange={(event) => onChange((current) => ({ ...current, dueDate: event.target.value }))} /></label></div><div className="composer-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="button" className="button button-primary" onClick={onCreate}><Plus size={17} />Allocate and notify</button></div></section></div>;
}
