"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TASK_STATUS_LABELS, type Client, type Task } from "@/features/tasks/models/task";
import { todayKey, type TaskFilters } from "@/features/tasks/models/task-filters";
import { TASK_CALENDAR_PAGE_SIZE, type TaskDateRange } from "@/features/tasks/models/task-page";
import { fetchTaskPage, taskFilterKey } from "@/features/tasks/views/task-page-client";

type CalendarPanelProps = {
  clients: Client[];
  filters: TaskFilters;
  refreshKey: number;
  onSelectTask: (task: Task) => void;
};

function clientFor(task: Task, clients: Client[]) {
  return clients.find((client) => client.id === task.clientId);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeForMonth(year: number, month: number): TaskDateRange {
  return {
    startDate: dateKey(new Date(year, month, 1)),
    endDate: dateKey(new Date(year, month + 1, 0)),
  };
}

export function CalendarPanel({ clients, filters, refreshKey, onSelectTask }: CalendarPanelProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + days }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const dateRange = useMemo(() => rangeForMonth(year, month), [year, month]);
  const queryClient = useQueryClient();
  const taskQuery = useQuery({
    queryKey: ["task-calendar", ...taskFilterKey(filters), dateRange.startDate, dateRange.endDate],
    queryFn: ({ signal }) => fetchTaskPage(filters, { dateRange, pageSize: TASK_CALENDAR_PAGE_SIZE }, signal),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (refreshKey > 0) void queryClient.invalidateQueries({ queryKey: ["task-calendar"] });
  }, [queryClient, refreshKey]);

  const tasks = taskQuery.data?.tasks ?? [];

  function dateForDay(day: number) {
    return dateKey(new Date(year, month, day));
  }

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <section className="panel calendar-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Calendar view</p>
          <h2 aria-live="polite">{visibleMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
        </div>
        <div className="calendar-arrows">
          <button className="icon-button" type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button className="icon-button" type="button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
      {taskQuery.isError ? <p className="board-load-error" role="alert">{taskQuery.error.message}</p> : null}
      <div className="calendar-grid">
        {cells.map((day, index) => {
          const key = day ? dateForDay(day) : `blank-${index}`;
          const dayTasks = day ? tasks.filter((task) => task.dueDate === key) : [];
          return (
            <div className={day ? `calendar-cell ${key === todayKey() ? "calendar-today" : ""}` : "calendar-cell calendar-empty"} key={key}>
              {day ? <>
                <span className="calendar-date">{day}</span>
                {dayTasks.slice(0, 3).map((task) => (
                  <button aria-label={`${task.status === "complete" ? "Completed" : TASK_STATUS_LABELS[task.status]} task: ${task.title}`} className={`calendar-task priority-${task.priority} status-${task.status}`} type="button" key={task.id} onClick={() => onSelectTask(task)}>
                    {task.title}<small>{clientFor(task, clients)?.name}</small>
                  </button>
                ))}
              </> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
