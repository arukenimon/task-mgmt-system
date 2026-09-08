import type { Client, Person, Task } from "@/features/tasks/models/task";
import { todayKey } from "@/features/tasks/models/task-filters";

export type ClientWorkloadRow = {
  id: string;
  label: string;
  total: number;
  completed: number;
  open: number;
  overdue: number;
  dueSoon: number;
  completionRate: number;
};

export type OwnerWorkloadRow = {
  id: string;
  label: string;
  initials: string;
  open: number;
  overdue: number;
  dueSoon: number;
  isActive: boolean;
};

export type Overview = {
  open: number;
  overdue: number;
  dueSoon: number;
  completionRate: number;
  onTimeRate: number;
  byClient: ClientWorkloadRow[];
  byOwner: OwnerWorkloadRow[];
  peakOwnerLoad: number;
  unassignedOpen: number;
};

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildOverview(tasks: Task[], people: Person[], clients: Client[]): Overview {
  const today = todayKey();
  const nextWeekKey = addDays(today, 7);
  const completed = tasks.filter((task) => task.status === "complete");
  const openTasks = tasks.filter((task) => task.status !== "complete");
  const isOverdue = (task: Task) => task.dueDate < today;
  const isDueSoon = (task: Task) => task.dueDate >= today && task.dueDate <= nextWeekKey;

  // Riskiest first: overdue work outranks volume, and fully delivered clients sink to the bottom.
  const byClient = clients
    .map((client) => {
      const clientTasks = tasks.filter((task) => task.clientId === client.id);
      const clientOpen = clientTasks.filter((task) => task.status !== "complete");
      const clientCompleted = clientTasks.length - clientOpen.length;
      return {
        id: client.id,
        label: client.name,
        total: clientTasks.length,
        completed: clientCompleted,
        open: clientOpen.length,
        overdue: clientOpen.filter(isOverdue).length,
        dueSoon: clientOpen.filter(isDueSoon).length,
        completionRate: clientTasks.length ? Math.round((clientCompleted / clientTasks.length) * 100) : 0,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.completionRate - b.completionRate || a.label.localeCompare(b.label));

  const byOwner = people
    .map((person) => {
      const ownerTasks = openTasks.filter((task) => task.assigneeIds.includes(person.id));
      return {
        person,
        row: {
          id: person.id,
          label: person.name,
          initials: person.initials,
          open: ownerTasks.length,
          overdue: ownerTasks.filter(isOverdue).length,
          dueSoon: ownerTasks.filter(isDueSoon).length,
          isActive: person.isActive,
        },
      };
    })
    // Deactivated people and non-members only appear while they still hold open work that needs reassigning.
    .filter(({ person, row }) => row.open > 0 || (person.role === "team_member" && person.isActive))
    .map(({ row }) => row)
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.label.localeCompare(b.label));

  return {
    open: openTasks.length,
    overdue: openTasks.filter(isOverdue).length,
    dueSoon: openTasks.filter(isDueSoon).length,
    completionRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    onTimeRate: completed.length
      ? Math.round((completed.filter((task) => (task.completedAt ?? task.dueDate) <= task.dueDate).length / completed.length) * 100)
      : 0,
    byClient,
    byOwner,
    peakOwnerLoad: byOwner.reduce((peak, row) => Math.max(peak, row.open), 0),
    unassignedOpen: openTasks.filter((task) => task.assigneeIds.length === 0).length,
  };
}
