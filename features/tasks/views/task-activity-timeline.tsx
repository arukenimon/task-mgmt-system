"use client";

import { QueryClient, QueryClientProvider, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import type { TaskActivityCursor, TaskActivityPage } from "@/features/tasks/models/task-activity";

type TaskActivityTimelineProps = {
  taskId: string;
};

async function fetchTaskActivityPage(taskId: string, cursor: TaskActivityCursor | null, signal: AbortSignal) {
  const params = new URLSearchParams({ taskId });
  if (cursor) {
    params.set("cursorCreatedAt", cursor.createdAt);
    params.set("cursorId", cursor.id);
  }

  const response = await fetch(`/api/tasks/activity?${params.toString()}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Task activity could not be loaded.");
  }
  return response.json() as Promise<TaskActivityPage>;
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  const elapsedMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (elapsedMinutes > -60) return elapsedMinutes >= -1 ? "Just now" : `${Math.abs(elapsedMinutes)} minutes ago`;
  if (elapsedMinutes > -1_440) return `${Math.abs(Math.round(elapsedMinutes / 60))} hours ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

export function TaskActivityTimeline({ taskId }: TaskActivityTimelineProps) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><TaskActivityTimelineContent taskId={taskId} /></QueryClientProvider>;
}

function TaskActivityTimelineContent({ taskId }: TaskActivityTimelineProps) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => hasSupabaseConfig ? createClient() : null, []);
  const queryKey = useMemo(() => ["task-activity", taskId] as const, [taskId]);
  const activity = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchTaskActivityPage(taskId, pageParam, signal),
    initialPageParam: null as TaskActivityCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: hasSupabaseConfig,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`task-activity:${taskId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_activity", filter: `task_id=eq.${taskId}` }, () => {
        void queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey, supabase, taskId]);

  const items = activity.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="activity" aria-label="Task activity">
      <p className="eyebrow">Activity</p>
      {activity.isLoading ? <p className="activity-status"><LoaderCircle size={15} aria-hidden="true" />Loading activity…</p> : null}
      {activity.isError ? <p className="activity-status activity-status-error" role="alert">{activity.error.message}</p> : null}
      {!activity.isLoading && !activity.isError && items.length === 0 ? <p className="activity-status">No activity has been recorded yet.</p> : null}
      {items.map((item) => (
        <div className="activity-entry" key={item.id}>
          <i aria-hidden="true" />
          <span><strong>{item.actor.name}</strong> {item.summary.toLowerCase()}<small>{formatActivityTime(item.createdAt)}</small></span>
        </div>
      ))}
      {activity.hasNextPage ? <button className="button button-quiet activity-load-more" type="button" onClick={() => void activity.fetchNextPage()} disabled={activity.isFetchingNextPage}>{activity.isFetchingNextPage ? "Loading…" : "Load earlier activity"}</button> : null}
    </section>
  );
}
