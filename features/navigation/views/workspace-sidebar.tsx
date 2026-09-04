import { CalendarDays, Columns3, LayoutDashboard, ListTodo, Users } from "lucide-react";
import Link from "next/link";

export type WorkspaceDestination = "overview" | "list" | "calendar" | "board" | "team" | "profile";

const NAVIGATION = [
  { id: "overview", label: "Overview", href: "/overview", icon: LayoutDashboard },
  { id: "list", label: "List", href: "/list", icon: ListTodo },
  { id: "calendar", label: "Calendar", href: "/calendar", icon: CalendarDays },
  { id: "board", label: "Kanban", href: "/kanban", icon: Columns3 },
  { id: "team", label: "Team management", href: "/team", icon: Users },
] as const;

type WorkspaceSidebarProps = {
  active: WorkspaceDestination;
  showTeamManagement: boolean;
  links?: Partial<Record<WorkspaceDestination, string>>;
};

export function WorkspaceSidebar({ active, showTeamManagement, links = {} }: WorkspaceSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand" aria-label="Bespoke Task Management System">
        <span className="brand-mark">B</span>
        <span className="brand-copy"><strong>Bespoke</strong><small>Task management</small></span>
      </div>
      <nav aria-label="Workspace views" className="workspace-nav">
        {NAVIGATION.filter((item) => item.id !== "team" || showTeamManagement).map((item) => {
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
      </nav>
    </aside>
  );
}
