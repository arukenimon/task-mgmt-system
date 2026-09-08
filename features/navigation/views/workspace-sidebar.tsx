"use client";

import { Building2, LayoutDashboard, ListTodo, PanelLeftClose, PanelLeftOpen, Users } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

export type WorkspaceDestination = "overview" | "list" | "calendar" | "board" | "team" | "clients" | "profile";

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
};

export function WorkspaceSidebar({ active, showTeamManagement, teamName, links = {} }: WorkspaceSidebarProps) {
  const collapsed = useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getServerSidebarCollapsedSnapshot,
  );
  const isTaskView = active === "list" || active === "calendar" || active === "board";
  const SidebarToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  function updateCollapsed(nextCollapsed: boolean) {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(nextCollapsed));
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSE_CHANGE_EVENT));
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
              aria-current={active === item.id ? "page" : undefined}
              className={active === item.id ? "nav-item nav-item-active" : "nav-item"}
              href={links[item.id] ?? item.href}
              key={item.id}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-item-label">{item.label}</span>
            </Link>
          );
        })}
        <Link aria-label="Tasks" className={isTaskView ? "nav-item nav-item-active" : "nav-item"} href={links.list ?? "/list"} title={collapsed ? "Tasks" : undefined}>
          <ListTodo size={18} aria-hidden="true" />
          <span className="nav-item-label">Tasks</span>
        </Link>
        {showTeamManagement ? (
          <>
            <Link
              aria-label="Team management"
              aria-current={active === "team" ? "page" : undefined}
              className={active === "team" ? "nav-item nav-item-active nav-item-admin" : "nav-item nav-item-admin"}
              href={links.team ?? "/team"}
              title={collapsed ? "Team management" : undefined}
            >
              <Users size={18} aria-hidden="true" />
              <span className="nav-item-label">Team management</span>
            </Link>
            <Link
              aria-label="Client management"
              aria-current={active === "clients" ? "page" : undefined}
              className={active === "clients" ? "nav-item nav-item-active" : "nav-item"}
              href={links.clients ?? "/clients"}
              title={collapsed ? "Client management" : undefined}
            >
              <Building2 size={18} aria-hidden="true" />
              <span className="nav-item-label">Client management</span>
            </Link>
          </>
        ) : null}
      </nav>
      <section className="sidebar-team" aria-label={`Your team: ${teamName ?? "Organisation-wide"}`} title={collapsed ? teamName ?? "Organisation-wide" : undefined}>
        <span className="sidebar-team-icon" aria-hidden="true"><Building2 size={17} /></span>
        <span className="sidebar-team-copy"><small>Your team</small><strong>{teamName ?? "Organisation-wide"}</strong></span>
      </section>
    </aside>
  );
}
