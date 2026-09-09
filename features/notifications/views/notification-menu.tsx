"use client";

import { type InfiniteData, QueryClient, QueryClientProvider, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, LoaderCircle } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { markAllNotificationsReadAction } from "@/features/notifications/controllers/in-app-notification.actions";
import type { InAppNotificationCursor, InAppNotificationPage } from "@/features/notifications/models/in-app-notification";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/env";

type NotificationMenuProps = {
  actorId: string;
};

async function fetchNotificationPage(cursor: InAppNotificationCursor | null, signal: AbortSignal) {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursorCreatedAt", cursor.createdAt);
    params.set("cursorId", cursor.id);
  }

  const response = await fetch(`/api/notifications?${params.toString()}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Notifications could not be loaded.");
  }
  return response.json() as Promise<InAppNotificationPage>;
}

function formatNotificationTime(value: string) {
  const elapsedMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  if (elapsedMinutes > -60) return elapsedMinutes >= -1 ? "Just now" : `${Math.abs(elapsedMinutes)}m ago`;
  if (elapsedMinutes > -1_440) return `${Math.abs(Math.round(elapsedMinutes / 60))}h ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value));
}

export function NotificationMenu({ actorId }: NotificationMenuProps) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><NotificationMenuContent actorId={actorId} /></QueryClientProvider>;
}

function NotificationMenuContent({ actorId }: NotificationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const supabase = useMemo(() => hasSupabaseConfig ? createClient() : null, []);
  const queryKey = useMemo(() => ["in-app-notifications", actorId] as const, [actorId]);
  const notifications = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchNotificationPage(pageParam, signal),
    initialPageParam: null as InAppNotificationCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: hasSupabaseConfig,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`user-notifications:${actorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_notifications", filter: `recipient_id=eq.${actorId}` }, () => {
        void queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [actorId, queryClient, queryKey, supabase]);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [isOpen]);

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsReadAction,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<InAppNotificationPage>>(queryKey);
      queryClient.setQueryData<InfiniteData<InAppNotificationPage>>(queryKey, (current) => current ? {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          unreadCount: 0,
          items: page.items.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() })),
        })),
      } : current);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const items = notifications.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCount = notifications.data?.pages[0]?.unreadCount ?? 0;
  const unreadLabel = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <div className="notification-menu" ref={menuRef}>
      <button aria-controls={menuId} aria-expanded={isOpen} aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"} className="notification-menu-trigger" onClick={() => setIsOpen((open) => !open)} type="button">
        <Bell aria-hidden="true" size={18} />
        {unreadCount ? <span className="notification-badge" aria-hidden="true">{unreadLabel}</span> : null}
      </button>
      {isOpen ? <section className="notification-menu-panel" id={menuId} aria-label="Notifications">
        <header className="notification-menu-heading"><div><strong>Notifications</strong><span>{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</span></div>{unreadCount ? <button className="text-button notification-mark-read" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()} type="button"><CheckCheck size={15} aria-hidden="true" />Mark all read</button> : null}</header>
        <div className="notification-list">
          {notifications.isLoading ? <p className="notification-status"><LoaderCircle size={15} aria-hidden="true" />Loading notifications…</p> : null}
          {notifications.isError ? <p className="notification-status notification-status-error" role="alert">{notifications.error.message}</p> : null}
          {!notifications.isLoading && !notifications.isError && items.length === 0 ? <p className="notification-status">No notifications yet.</p> : null}
          {items.map((notification) => <article className={notification.isRead ? "notification-item" : "notification-item notification-item-unread"} key={notification.id}><span className="notification-item-dot" aria-hidden="true" /><div><strong>{notification.title}</strong><p>{notification.body}</p><small>{formatNotificationTime(notification.createdAt)}</small></div></article>)}
        </div>
        {notifications.hasNextPage ? <button className="button button-quiet notification-load-more" type="button" onClick={() => void notifications.fetchNextPage()} disabled={notifications.isFetchingNextPage}>{notifications.isFetchingNextPage ? "Loading…" : "Load more"}</button> : null}
      </section> : null}
    </div>
  );
}
