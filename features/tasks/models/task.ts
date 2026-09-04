import type { Role } from "@/features/identity/models/roles";

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "complete",
] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  complete: "Complete",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export type Team = { id: string; name: string; accent: string };

export type Person = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  teamId: string | null;
};

export type Client = { id: string; name: string; accountLeadId: string | null };

export type Task = {
  id: string;
  title: string;
  description: string;
  clientId: string;
  teamId: string;
  ownerId: string;
  createdById: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
};

export type TaskActivity = {
  id: string;
  taskId: string;
  actorId: string;
  type: "created" | "assigned" | "status_changed" | "completed";
  summary: string;
  createdAt: string;
};

const asDateKey = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const demoTeams: Team[] = [
  { id: "north", name: "North Team", accent: "teal" },
  { id: "south", name: "South Team", accent: "violet" },
];

export const demoPeople: Person[] = [
  {
    id: "director-1",
    name: "Alex Morgan",
    initials: "AM",
    email: "alex.morgan@taskhub.demo",
    role: "senior_director",
    teamId: null,
  },
  {
    id: "ad-north",
    name: "Sophie Turner",
    initials: "ST",
    email: "sophie.turner@taskhub.demo",
    role: "account_director",
    teamId: "north",
  },
  {
    id: "ad-south",
    name: "Marcus Reed",
    initials: "MR",
    email: "marcus.reed@taskhub.demo",
    role: "account_director",
    teamId: "south",
  },
  {
    id: "zoe",
    name: "Zoe Patel",
    initials: "ZP",
    email: "zoe.patel@taskhub.demo",
    role: "team_member",
    teamId: "north",
  },
  {
    id: "liam",
    name: "Liam Chen",
    initials: "LC",
    email: "liam.chen@taskhub.demo",
    role: "team_member",
    teamId: "north",
  },
  {
    id: "olivia",
    name: "Olivia Grant",
    initials: "OG",
    email: "olivia.grant@taskhub.demo",
    role: "team_member",
    teamId: "south",
  },
  {
    id: "noah",
    name: "Noah Williams",
    initials: "NW",
    email: "noah.williams@taskhub.demo",
    role: "team_member",
    teamId: "south",
  },
];

export const demoClients: Client[] = [
  { id: "internal", name: "Internal operations", accountLeadId: "ad-north" },
  { id: "atlas", name: "Atlas Automotive", accountLeadId: "ad-north" },
  { id: "solstice", name: "Solstice Motors", accountLeadId: "ad-south" },
  { id: "helix", name: "Helix Vehicle Group", accountLeadId: "ad-south" },
];

export const demoTasks: Task[] = [
  {
    id: "task-1",
    title: "Approve Q4 campaign budget",
    description: "Consolidate channel forecasts and prepare the approval note.",
    clientId: "atlas",
    teamId: "north",
    ownerId: "zoe",
    createdById: "ad-north",
    status: "in_progress",
    priority: "urgent",
    dueDate: asDateKey(0),
    completedAt: null,
    createdAt: asDateKey(-7),
  },
  {
    id: "task-2",
    title: "Build dealer launch email journey",
    description: "Map the lead nurture sequence for the new showroom opening.",
    clientId: "atlas",
    teamId: "north",
    ownerId: "liam",
    createdById: "ad-north",
    status: "todo",
    priority: "high",
    dueDate: asDateKey(2),
    completedAt: null,
    createdAt: asDateKey(-3),
  },
  {
    id: "task-3",
    title: "Validate May sales-event feed",
    description: "Reconcile the event feed before the client dashboard refresh.",
    clientId: "solstice",
    teamId: "south",
    ownerId: "olivia",
    createdById: "ad-south",
    status: "blocked",
    priority: "urgent",
    dueDate: asDateKey(-1),
    completedAt: null,
    createdAt: asDateKey(-5),
  },
  {
    id: "task-4",
    title: "Prepare dealer performance report",
    description: "Review campaign performance and draft the account commentary.",
    clientId: "helix",
    teamId: "south",
    ownerId: "noah",
    createdById: "ad-south",
    status: "in_progress",
    priority: "high",
    dueDate: asDateKey(4),
    completedAt: null,
    createdAt: asDateKey(-4),
  },
  {
    id: "task-5",
    title: "Update shared client briefing template",
    description: "Add the revised GDPR wording and standard handover fields.",
    clientId: "internal",
    teamId: "north",
    ownerId: "zoe",
    createdById: "director-1",
    status: "todo",
    priority: "medium",
    dueDate: asDateKey(7),
    completedAt: null,
    createdAt: asDateKey(-1),
  },
  {
    id: "task-6",
    title: "Audit test-drive booking conversion",
    description: "Identify drop-off points and propose three experiments.",
    clientId: "solstice",
    teamId: "south",
    ownerId: "olivia",
    createdById: "ad-south",
    status: "complete",
    priority: "medium",
    dueDate: asDateKey(-2),
    completedAt: asDateKey(-2),
    createdAt: asDateKey(-10),
  },
  {
    id: "task-7",
    title: "Finalise client renewal presentation",
    description: "Prepare headline outcomes and the next-quarter growth plan.",
    clientId: "helix",
    teamId: "south",
    ownerId: "noah",
    createdById: "director-1",
    status: "complete",
    priority: "high",
    dueDate: asDateKey(-4),
    completedAt: asDateKey(-3),
    createdAt: asDateKey(-11),
  },
  {
    id: "task-8",
    title: "Create paid social asset checklist",
    description: "Confirm all required production assets ahead of launch.",
    clientId: "atlas",
    teamId: "north",
    ownerId: "liam",
    createdById: "ad-north",
    status: "complete",
    priority: "low",
    dueDate: asDateKey(-6),
    completedAt: asDateKey(-5),
    createdAt: asDateKey(-12),
  },
  {
    id: "task-9",
    title: "Schedule internal planning workshop",
    description: "Coordinate the delivery team priorities for next month.",
    clientId: "internal",
    teamId: "north",
    ownerId: "zoe",
    createdById: "director-1",
    status: "in_progress",
    priority: "medium",
    dueDate: asDateKey(5),
    completedAt: null,
    createdAt: asDateKey(-2),
  },
];
