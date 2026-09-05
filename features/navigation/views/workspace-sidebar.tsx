import { Building2, LayoutDashboard, ListTodo, Users } from "lucide-react";
import Link from "next/link";

export type WorkspaceDestination = "overview" | "list" | "calendar" | "board" | "team" | "profile";

const NAVIGATION = [
  { id: "overview", label: "Overview", href: "/overview", icon: LayoutDashboard },
] as const;

type WorkspaceSidebarProps = {
  active: WorkspaceDestination;
  showTeamManagement: boolean;
  teamName?: string | null;
  links?: Partial<Record<WorkspaceDestination, string>>;
};

export function WorkspaceSidebar({ active, showTeamManagement, teamName, links = {} }: WorkspaceSidebarProps) {
  const isTaskView = active === "list" || active === "calendar" || active === "board";

  return (
    <aside className="sidebar">
      <div className="brand" aria-label="Bespoke Task Management System">
        <span className="brand-mark">B</span>
        <span className="brand-copy"><strong>Bespoke</strong><small>Task management</small></span>
      </div>
      <nav aria-label="Workspace views" className="workspace-nav">
        {NAVIGATION.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              aria-current={active === item.id ? "page" : undefined}
              className={`${active === item.id ? "nav-item nav-item-active" : "nav-item"}${item.id === "team" ? " nav-item-admin" : ""}`}
              href={links[item.id] ?? item.href}
              key={item.id}
            >
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <Link className={isTaskView ? "nav-item nav-item-active" : "nav-item"} href={links.list ?? "/list"}>
          <ListTodo size={18} aria-hidden="true" />
          Tasks
        </Link>
        {showTeamManagement ? (
          <Link
            aria-current={active === "team" ? "page" : undefined}
            className={active === "team" ? "nav-item nav-item-active nav-item-admin" : "nav-item nav-item-admin"}
            href={links.team ?? "/team"}
          >
            <Users size={18} aria-hidden="true" />
            Team management
          </Link>
        ) : null}
      </nav>
      <section className="sidebar-team" aria-label="Your team">
        <span className="sidebar-team-icon" aria-hidden="true"><Building2 size={17} /></span>
        <span className="sidebar-team-copy"><small>Your team</small><strong>{teamName ?? "Organisation-wide"}</strong></span>
      </section>
    </aside>
  );
}
