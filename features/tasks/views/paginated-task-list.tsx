"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CenteredLoader } from "@/features/tasks/views/centered-loader";
import { fetchTaskPage, sameTaskFilters, taskFilterKey } from "@/features/tasks/views/task-page-client";
import type { TaskPage } from "@/features/tasks/models/task-page";
import { todayKey, type TaskFilters } from "@/features/tasks/models/task-filters";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type Client, type Person, type Task } from "@/features/tasks/models/task";

type PaginatedTaskListProps = {
  clients: Client[];
  people: Person[];
  filters: TaskFilters;
  initialFilters: TaskFilters;
  initialPage?: TaskPage;
  refreshKey: number;
  onReset: () => void;
  onSelectTask: (task: Task) => void;
};

function clientFor(task: Task, clients: Client[]) {
  return clients.find((client) => client.id === task.clientId);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function assigneesFor(task: Task, people: Person[]) {
  return people.filter((person) => task.assigneeIds.includes(person.id));
}

export function PaginatedTaskList({ clients, people, filters, initialFilters, initialPage, refreshKey, onReset, onSelectTask }: PaginatedTaskListProps) {
  const queryClient = useQueryClient();
  const [debouncedQuery, setDebouncedQuery] = useState(filters.query);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(filters.query), 250);
    return () => window.clearTimeout(timeout);
  }, [filters.query]);

  const pageFilters = useMemo(() => ({ ...filters, query: debouncedQuery }), [filters, debouncedQuery]);
  const matchingInitialPage = initialPage && sameTaskFilters(pageFilters, initialFilters) ? initialPage : undefined;
  const query = useInfiniteQuery({
    queryKey: ["task-list", ...taskFilterKey(pageFilters)],
    queryFn: ({ pageParam, signal }) => fetchTaskPage(pageFilters, { cursor: pageParam }, signal),
    initialPageParam: null as TaskPage["nextCursor"],
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: matchingInitialPage ? { pages: [matchingInitialPage], pageParams: [null] } : undefined,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (refreshKey > 0) void queryClient.invalidateQueries({ queryKey: ["task-list"] });
  }, [queryClient, refreshKey]);

  const tasks = query.data?.pages.flatMap((page) => page.tasks) ?? [];

  if (query.isLoading) {
    return <section className="panel task-view-loading" aria-busy="true"><CenteredLoader label="Loading tasks…" /></section>;
  }
  if (query.isError) {
    return <section className="panel" role="alert"><p className="board-load-error">{query.error.message}</p></section>;
  }
  if (tasks.length === 0) {
    return <section className="empty-state" aria-live="polite"><p className="eyebrow">No matching tasks</p><h2>Try a broader filter</h2><p>Clear the current filters to return to your complete visible workload.</p><button type="button" className="button button-primary" onClick={onReset}>Clear filters</button></section>;
  }

  return <section className="panel task-list-panel">
    <div className="panel-heading"><div><p className="eyebrow">List view</p><h2>{tasks.length} loaded matching {tasks.length === 1 ? "task" : "tasks"}</h2></div></div>
    <div className="table-wrap"><table><thead><tr><th>Task</th><th>Client</th><th>Assignees</th><th>Deadline</th><th>Priority</th><th>Status</th></tr></thead><tbody>{tasks.map((task) => {
      const assignees = assigneesFor(task, people);
      return <tr key={task.id} onClick={() => onSelectTask(task)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectTask(task); } }} role="button" tabIndex={0}><td><strong>{task.title}</strong><span>{task.description}</span></td><td>{clientFor(task, clients)?.name}</td><td><span className="person-cell"><span className="assignee-avatars" aria-label={`Assigned to ${assignees.map((person) => person.name).join(", ")}`}>{assignees.map((person) => <span className="avatar" key={person.id} title={person.name}>{person.initials}</span>)}</span><span>{assignees.map((person) => person.name).join(", ")}</span></span></td><td className={task.status !== "complete" && task.dueDate < todayKey() ? "deadline-overdue" : ""}>{formatDate(task.dueDate)}</td><td><span className={`priority priority-${task.priority}`}>{TASK_PRIORITY_LABELS[task.priority]}</span></td><td><span className={`status-badge status-${task.status}`}>{TASK_STATUS_LABELS[task.status]}</span></td></tr>;
    })}</tbody></table></div>
    {query.hasNextPage ? <button className="button button-quiet board-load-more" type="button" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? "Loading…" : "Load more tasks"}</button> : null}
  </section>;
}
