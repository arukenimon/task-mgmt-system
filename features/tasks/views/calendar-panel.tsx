"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { TASK_STATUS_LABELS, type Client, type Task } from "@/features/tasks/models/task";
import { todayKey } from "@/features/tasks/models/task-filters";

type CalendarPanelProps = {
  tasks: Task[];
  clients: Client[];
  onSelectTask: (id: string) => void;
};

function clientFor(task: Task, clients: Client[]) {
  return clients.find((client) => client.id === task.clientId);
}

export function CalendarPanel({ tasks, clients, onSelectTask }: CalendarPanelProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + days }, (_, index) => index < firstDay ? null : index - firstDay + 1);

  function dateForDay(day: number) {
    return new Date(year, month, day, 12).toISOString().slice(0, 10);
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
      <div className="calendar-grid">
        {cells.map((day, index) => {
          const key = day ? dateForDay(day) : `blank-${index}`;
          const dayTasks = day ? tasks.filter((task) => task.dueDate === key) : [];
          return (
            <div className={day ? `calendar-cell ${key === todayKey() ? "calendar-today" : ""}` : "calendar-cell calendar-empty"} key={key}>
              {day ? <>
                <span className="calendar-date">{day}</span>
                {dayTasks.slice(0, 3).map((task) => (
                  <button aria-label={`${task.status === "complete" ? "Completed" : TASK_STATUS_LABELS[task.status]} task: ${task.title}`} className={`calendar-task priority-${task.priority} status-${task.status}`} type="button" key={task.id} onClick={() => onSelectTask(task.id)}>
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
