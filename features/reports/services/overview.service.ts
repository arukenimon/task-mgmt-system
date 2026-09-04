import type { Client, Person, Task } from "@/features/tasks/models/task";
import { todayKey } from "@/features/tasks/models/task-filters";

export type Overview = {
  open: number;
  overdue: number;
  dueSoon: number;
  completionRate: number;
  onTimeRate: number;
  byClient: Array<{ label: string; total: number; overdue: number }>;
  byOwner: Array<{ label: string; open: number; overdue: number }>;
};

export function buildOverview(tasks: Task[], people: Person[], clients: Client[]): Overview {
  const today = todayKey();
  const nextWeek = new Date(`${today}T12:00:00Z`);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const nextWeekKey = nextWeek.toISOString().slice(0, 10);
  const completed = tasks.filter((task) => task.status === "complete");
  const openTasks = tasks.filter((task) => task.status !== "complete");
  const overdueTasks = openTasks.filter((task) => task.dueDate < today);

  return {
    open: openTasks.length,
    overdue: overdueTasks.length,
    dueSoon: openTasks.filter((task) => task.dueDate >= today && task.dueDate <= nextWeekKey).length,
    completionRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    onTimeRate: completed.length
      ? Math.round((completed.filter((task) => (task.completedAt ?? task.dueDate) <= task.dueDate).length / completed.length) * 100)
      : 0,
    byClient: clients
      .map((client) => {
        const clientTasks = tasks.filter((task) => task.clientId === client.id);
        return {
          label: client.name,
          total: clientTasks.length,
          overdue: clientTasks.filter((task) => task.status !== "complete" && task.dueDate < today).length,
        };
      })
      .filter((row) => row.total > 0),
    byOwner: people
      .filter((person) => person.role === "team_member")
      .map((person) => {
        const ownerTasks = openTasks.filter((task) => task.ownerId === person.id);
        return {
          label: person.name,
          open: ownerTasks.length,
          overdue: ownerTasks.filter((task) => task.dueDate < today).length,
        };
      }),
  };
}
