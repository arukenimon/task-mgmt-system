"use client";

import { QueryClient, QueryClientProvider, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES, type Client, type Person, type Task, type TaskStatus } from "@/features/tasks/models/task";
import type { InitialKanbanPages, KanbanCursor, KanbanTaskPage } from "@/features/tasks/models/kanban";
import type { TaskFilters } from "@/features/tasks/models/task-filters";

type PaginatedKanbanBoardProps = {
  clients: Client[];
  people: Person[];
  filters: TaskFilters;
  initialFilters: TaskFilters;
  initialPages?: InitialKanbanPages;
  refreshKey: number;
  onMove: (task: Task, status: TaskStatus) => Promise<boolean>;
  onSelectTask: (task: Task) => void;
};

function filterKey(filters: TaskFilters) {
  return [filters.clientId, filters.teamId, filters.ownerId, filters.status, filters.priority, filters.due, filters.query];
}

function sameFilters(left: TaskFilters, right: TaskFilters) {
  return filterKey(left).every((value, index) => value === filterKey(right)[index]);
}

function clientFor(task: Task, clients: Client[]) {
  return clients.find((client) => client.id === task.clientId);
}

function ownerFor(task: Task, people: Person[]) {
  return people.find((person) => person.id === task.ownerId);
}

function PriorityDot({ priority }: { priority: Task["priority"] }) {
  return <span className={`priority priority-${priority}`}>{TASK_PRIORITY_LABELS[priority]}</span>;
}

async function fetchKanbanPage(status: TaskStatus, filters: TaskFilters, cursor: KanbanCursor | null, signal: AbortSignal) {
  const params = new URLSearchParams({
    status,
    client: filters.clientId,
    team: filters.teamId,
    owner: filters.ownerId,
    filterStatus: filters.status,
    priority: filters.priority,
    due: filters.due,
    q: filters.query,
  });
  if (cursor) {
    params.set("cursorDueDate", cursor.dueDate);
    params.set("cursorId", cursor.id);
  }

  const response = await fetch(`/api/tasks/kanban?${params.toString()}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Unable to load more tasks.");
  }
  return response.json() as Promise<KanbanTaskPage>;
}

function RefreshKanbanQueries({ refreshKey }: { refreshKey: number }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (refreshKey > 0) void queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] });
  }, [queryClient, refreshKey]);
  return null;
}

function KanbanColumn({ status, clients, people, filters, initialPage, draggedTask, onDragStart, onMove, onSelectTask }: {
  status: TaskStatus;
  clients: Client[];
  people: Person[];
  filters: TaskFilters;
  initialPage?: KanbanTaskPage;
  draggedTask: Task | null;
  onDragStart: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus) => Promise<boolean>;
  onSelectTask: (task: Task) => void;
}) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ["kanban-tasks", status, ...filterKey(filters)],
    queryFn: ({ pageParam, signal }) => fetchKanbanPage(status, filters, pageParam, signal),
    initialPageParam: null as KanbanCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: initialPage ? { pages: [initialPage], pageParams: [null] } : undefined,
    staleTime: 30_000,
  });
  const tasks = query.data?.pages.flatMap((page) => page.tasks) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  function dropTask() {
    if (!draggedTask || draggedTask.status === status) return;
    void onMove(draggedTask, status).then((didUpdate) => {
      if (didUpdate) void queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] });
    });
  }

  return <div className="board-column" onDragOver={(event) => event.preventDefault()} onDrop={dropTask}>
    <div className="column-heading"><span><i className={`status-dot status-${status}`} />{TASK_STATUS_LABELS[status]}</span><small>{total}</small></div>
    <div className="board-cards">
      {tasks.map((task) => {
        const owner = ownerFor(task, people);
        return <article className="board-card" key={task.id} draggable onDragStart={() => onDragStart(task)}>
          <button className="board-card-title" type="button" onClick={() => onSelectTask(task)}>{task.title}</button>
          <span className="client-label">{clientFor(task, clients)?.name}</span>
          <div className="board-card-footer"><PriorityDot priority={task.priority} /><span className="avatar">{owner?.initials}</span></div>
        </article>;
      })}
      {query.isError ? <p className="board-load-error" role="alert">{query.error.message}</p> : null}
      {query.hasNextPage ? <button className="button button-quiet board-load-more" type="button" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? "Loading…" : "Load more"}</button> : null}
    </div>
  </div>;
}

function KanbanBoardContent({ clients, people, filters, initialPages, refreshKey, onMove, onSelectTask }: Omit<PaginatedKanbanBoardProps, "initialFilters">) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  return <>
    <RefreshKanbanQueries refreshKey={refreshKey} />
    <section className="board"><div className="board-heading"><div><p className="eyebrow">Kanban view</p><h2>Move work as it progresses</h2></div><span className="muted">Drag cards between columns</span></div><div className="board-columns">{TASK_STATUSES.map((status) => <KanbanColumn key={status} status={status} clients={clients} people={people} filters={filters} initialPage={initialPages?.[status]} draggedTask={draggedTask} onDragStart={setDraggedTask} onMove={onMove} onSelectTask={onSelectTask} />)}</div></section>
  </>;
}

export function PaginatedKanbanBoard({ initialFilters, initialPages, ...props }: PaginatedKanbanBoardProps) {
  const [queryClient] = useState(() => new QueryClient());
  const matchingInitialPages = sameFilters(props.filters, initialFilters) ? initialPages : undefined;
  return <QueryClientProvider client={queryClient}><KanbanBoardContent {...props} initialPages={matchingInitialPages} /></QueryClientProvider>;
}
