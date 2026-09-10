"use client";

import { Building2, LayoutDashboard, ListTodo, PanelLeftClose, PanelLeftOpen, Users } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore, type MouseEvent } from "react";
import { beginWorkspaceNavigation, shouldTrackWorkspaceNavigation, useWorkspaceNavigation, type WorkspaceDestination } from "@/features/navigation/models/workspace-navigation";

export type { WorkspaceDestination } from "@/features/navigation/models/workspace-navigation";

const NAVIGATION = [
  { id: "overview", label: "Overview", href: "/overview", icon: LayoutDashboard },
] as const;

const SIDEBAR_COLLAPSE_STORAGE_KEY = "task-hub.sidebar-collapsed";
const SIDEBAR_COLLAPSE_CHANGE_EVENT = "task-hub:sidebar-collapse-changed";

function getSidebarCollapsedSnapshot() {
  const savedPreference = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
  if (savedPreference === "true" || savedPreference === "false") return savedPreference === "true";
  return window.matchMedia?.("(max-width: 760px)").matches ?? false;
}

function getServerSidebarCollapsedSnapshot() {
  return false;
}

function subscribeToSidebarCollapsed(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia?.("(max-width: 760px)");
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSE_STORAGE_KEY) onStoreChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(SIDEBAR_COLLAPSE_CHANGE_EVENT, onStoreChange);
  mediaQuery?.addEventListener("change", onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(SIDEBAR_COLLAPSE_CHANGE_EVENT, onStoreChange);
    mediaQuery?.removeEventListener("change", onStoreChange);
  };
}

type WorkspaceSidebarProps = {
  active: WorkspaceDestination;
  showTeamManagement: boolean;
  teamName?: string | null;
  links?: Partial<Record<WorkspaceDestination, string>>;
  taskDestination?: Extract<WorkspaceDestination, "list" | "calendar" | "board">;
};

export function WorkspaceSidebar({ active, showTeamManagement, teamName, links = {}, taskDestination = "list" }: WorkspaceSidebarProps) {
  const collapsed = useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getServerSidebarCollapsedSnapshot,
  );
  const pendingDestination = useWorkspaceNavigation(active);
  const displayedDestination = pendingDestination ?? active;
  const isTaskView = displayedDestination === "list" || displayedDestination === "calendar" || displayedDestination === "board";
  const displayTeamSummary = !showTeamManagement;
  const displayedTeamName = teamName ?? "Organisation-wide";
  const SidebarToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  function updateCollapsed(nextCollapsed: boolean) {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(nextCollapsed));
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSE_CHANGE_EVENT));
  }

  function handleNavigation(destination: WorkspaceDestination, event: MouseEvent<HTMLAnchorElement>) {
    if (destination !== displayedDestination && shouldTrackWorkspaceNavigation(event)) beginWorkspaceNavigation(destination);
  }

  return (
    <aside className="sidebar" data-collapsed={collapsed}>
      <div className="sidebar-heading">
        <div className="brand" aria-label="Bespoke Task Management System">
          <span className="brand-mark">B</span>
          <span className="brand-copy"><strong>Bespoke</strong><small>Task management</small></span>
        </div>
        <button
          aria-controls="workspace-navigation"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="sidebar-toggle"
          onClick={() => updateCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          <SidebarToggleIcon size={18} aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Workspace views" className="workspace-nav" id="workspace-navigation">
        {NAVIGATION.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              aria-label={item.label}
              aria-current={displayedDestination === item.id ? "page" : undefined}
              className={displayedDestination === item.id ? "nav-item nav-item-active" : "nav-item"}
              href={links[item.id] ?? item.href}
              key={item.id}
              onClick={(event) => handleNavigation(item.id, event)}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-item-label">{item.label}</span>
            </Link>
          );
        })}
        <Link aria-label="Tasks" className={isTaskView ? "nav-item nav-item-active" : "nav-item"} href={links.list ?? "/list"} onClick={(event) => { if (displayedDestination !== taskDestination) handleNavigation(taskDestination, event); }} title={collapsed ? "Tasks" : undefined}>
          <ListTodo size={18} aria-hidden="true" />
          <span className="nav-item-label">Tasks</span>
        </Link>
        {showTeamManagement ? (
          <>
            <Link
              aria-label="Team management"
              aria-current={displayedDestination === "team" ? "page" : undefined}
              className={displayedDestination === "team" ? "nav-item nav-item-active nav-item-admin" : "nav-item nav-item-admin"}
              href={links.team ?? "/team"}
              onClick={(event) => handleNavigation("team", event)}
              title={collapsed ? "Team management" : undefined}
            >
              <Users size={18} aria-hidden="true" />
              <span className="nav-item-label">Team management</span>
            </Link>
            <Link
              aria-label="Client management"
              aria-current={displayedDestination === "clients" ? "page" : undefined}
              className={displayedDestination === "clients" ? "nav-item nav-item-active" : "nav-item"}
              href={links.clients ?? "/clients"}
              onClick={(event) => handleNavigation("clients", event)}
              title={collapsed ? "Client management" : undefined}
            >
              <Building2 size={18} aria-hidden="true" />
              <span className="nav-item-label">Client management</span>
            </Link>
          </>
        ) : null}
      </nav>
      {displayTeamSummary ? (
        <section className="sidebar-team" aria-label={`Team: ${displayedTeamName}`} title={collapsed ? displayedTeamName : undefined}>
          <span className="sidebar-team-icon" aria-hidden="true"><Building2 size={17} /></span>
          <span className="sidebar-team-copy"><strong>{displayedTeamName}</strong></span>
        </section>
      ) : null}
    </aside>
  );
}
