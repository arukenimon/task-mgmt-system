"use client";

import { LoaderCircle, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getTaskAttachmentsAction } from "@/features/tasks/controllers/task.actions";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES, type Client, type Person, type Task, type TaskStatus } from "@/features/tasks/models/task";
import { todayKey } from "@/features/tasks/models/task-filters";
import type { TaskAttachment } from "@/features/tasks/models/task-attachment";

type TaskDetailProps = {
  task: Task;
  clients: Client[];
  people: Person[];
  onClose: () => void;
  onEdit: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  canEdit: boolean;
  canUpdate: boolean;
};

function assigneesFor(task: Task, people: Person[]) {
  return people.filter((person) => task.assigneeIds.includes(person.id));
}

function clientFor(task: Task, clients: Client[]) {
  return clients.find((client) => client.id === task.clientId);
}

function fullDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function PriorityDot({ priority }: { priority: Task["priority"] }) {
  return <span className={`priority priority-${priority}`}>{TASK_PRIORITY_LABELS[priority]}</span>;
}

function AssigneeNames({ task, people }: { task: Task; people: Person[] }) {
  const assignees = assigneesFor(task, people);
  return <span className="person-cell"><span className="assignee-avatars" aria-label={`Assigned to ${assignees.map((person) => person.name).join(", ")}`}>{assignees.map((person) => <span className="avatar" key={person.id} title={person.name}>{person.initials}</span>)}</span><span>{assignees.map((person) => person.name).join(", ")}</span></span>;
}

function TaskAttachments({ taskId }: { taskId: string }) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    void getTaskAttachmentsAction(taskId).then((nextAttachments) => {
      if (!active) return;
      setAttachments(nextAttachments);
      setState("ready");
    }).catch(() => {
      if (active) setState("error");
    });
    return () => { active = false; };
  }, [taskId]);

  if (state === "loading") return <div className="task-attachments task-attachments-loading"><LoaderCircle size={16} aria-hidden="true" />Loading images…</div>;
  if (state === "error") return <p className="task-attachments-error">Images could not be loaded.</p>;
  if (attachments.length === 0) return null;

  return (
    <section className="task-attachments" aria-label="Task images">
      <p className="eyebrow">Images</p>
      <div className="task-image-grid">
        {attachments.map((attachment) => (
          <a href={attachment.url} key={attachment.id} target="_blank" rel="noreferrer" title={`Open ${attachment.fileName}`}>
            {/* The signed source URL is access-controlled and short-lived, so it is deliberately not proxied or cached by the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.url} alt={attachment.fileName} />
          </a>
        ))}
      </div>
    </section>
  );
}

export function TaskDetail({ task, clients, people, onClose, onEdit, onStatusChange, canEdit, canUpdate }: TaskDetailProps) {
  const assignees = assigneesFor(task, people);
  return (
    <aside className="detail-panel" aria-label="Task details">
      <div className="detail-heading">
        <span className="eyebrow">Task detail</span>
        <div className="detail-heading-actions">
          {canEdit ? <button className="text-button detail-edit-button" type="button" onClick={onEdit}><Pencil size={15} aria-hidden="true" />Edit task</button> : null}
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close task detail"><X size={18} /></button>
        </div>
      </div>
      <h2>{task.title}</h2>
      {task.description ? <p className="detail-description">{task.description}</p> : null}
      <TaskAttachments key={task.id} taskId={task.id} />
      <div className="detail-grid">
        <div><span>Client</span><strong>{clientFor(task, clients)?.name}</strong></div>
        <div><span>Due date</span><strong className={task.status !== "complete" && task.dueDate < todayKey() ? "deadline-overdue" : ""}>{fullDate(task.dueDate)}</strong></div>
        <div><span>Assignees</span><AssigneeNames task={task} people={people} /></div>
        <div><span>Priority</span><PriorityDot priority={task.priority} /></div>
      </div>
      <label className="status-control"><span>Status</span><select value={task.status} onChange={(event) => onStatusChange(task.id, event.target.value as TaskStatus)} disabled={!canUpdate}>{TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}</select></label>
      <div className="activity">
        <p className="eyebrow">Activity</p>
        <div><i /><span><strong>{assignees.map((person) => person.name).join(", ")}</strong> are assigned to this task<small>Assignment recorded</small></span></div>
        <div><i /><span>Deadline set for <strong>{fullDate(task.dueDate)}</strong><small>Task created</small></span></div>
      </div>
    </aside>
  );
}
