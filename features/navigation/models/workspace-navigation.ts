"use client";

import { useEffect, useSyncExternalStore, type MouseEvent } from "react";

export type WorkspaceDestination = "overview" | "list" | "calendar" | "board" | "team" | "clients" | "profile";

let pendingDestination: WorkspaceDestination | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return pendingDestination;
}

function getServerSnapshot() {
  return null;
}

function clearWorkspaceNavigation() {
  if (!pendingDestination) return;
  pendingDestination = null;
  notifyListeners();
}

export function beginWorkspaceNavigation(destination: WorkspaceDestination) {
  if (pendingDestination === destination) return;
  pendingDestination = destination;
  notifyListeners();
}

export function shouldTrackWorkspaceNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function useWorkspaceNavigation(activeDestination?: WorkspaceDestination) {
  const pending = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hasReachedDestination = pending !== null && pending === activeDestination;

  useEffect(() => {
    if (hasReachedDestination) clearWorkspaceNavigation();
  }, [hasReachedDestination]);

  return hasReachedDestination ? null : pending;
}
