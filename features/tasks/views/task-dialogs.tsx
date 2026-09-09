"use client";

import { ChevronDown, ImagePlus, LoaderCircle, Pencil, Plus, Search, X } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import { MAX_TASK_ATTACHMENT_BYTES, MAX_TASK_ATTACHMENTS } from "@/features/tasks/models/task-attachment";
import type { TaskDraft } from "@/features/tasks/models/task-draft";
import { TASK_PRIORITY_LABELS, type Client, type Person, type Task, type TaskPriority } from "@/features/tasks/models/task";

type SharedDialogProps = {
  clients: Client[];
  error: string | null;
  isSubmitting: boolean;
  owners: Person[];
  value: TaskDraft;
  onChange: Dispatch<SetStateAction<TaskDraft>>;
  onClose: () => void;
};

type TaskEditorProps = SharedDialogProps & {
  task: Task;
  onSave: () => Promise<void>;
};

type TaskComposerProps = SharedDialogProps & {
  attachments: File[];
  onAttachmentsChange: (files: File[]) => void;
  onCreate: () => Promise<void>;
};

function AssigneePicker({ owners, value, onChange, isSubmitting, menuId, labelId }: Pick<SharedDialogProps, "owners" | "value" | "onChange" | "isSubmitting"> & { menuId: string; labelId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedAssignees = owners.filter((owner) => value.assigneeIds.includes(owner.id));
  const matchingAssignees = owners.filter((owner) => owner.name.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedTeamId = selectedAssignees[0]?.teamId;

  function toggleAssignee(assigneeId: string) {
    onChange((current) => ({
      ...current,
      assigneeIds: current.assigneeIds.includes(assigneeId)
        ? current.assigneeIds.filter((id) => id !== assigneeId)
        : [...current.assigneeIds, assigneeId],
    }));
  }

  return (
    <div className="assignee-select">
      <span id={labelId}>Assignees <small>Choose one or more people from the same team</small></span>
      <button className="assignee-select-trigger" type="button" aria-expanded={isOpen} aria-controls={menuId} aria-labelledby={labelId} onClick={() => setIsOpen((open) => !open)} disabled={isSubmitting}>
        <span>{selectedAssignees.length ? `${selectedAssignees.length} assignee${selectedAssignees.length === 1 ? "" : "s"} selected` : "Select assignees"}</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      {selectedAssignees.length ? <div className="selected-assignee-chips">{selectedAssignees.map((owner) => <span key={owner.id}><span className="avatar">{owner.initials}</span>{owner.name}<button type="button" onClick={() => toggleAssignee(owner.id)} aria-label={`Remove ${owner.name}`} disabled={isSubmitting}><X size={13} aria-hidden="true" /></button></span>)}</div> : null}
      {isOpen ? <div className="assignee-select-menu" id={menuId}>
        <label className="assignee-search"><Search size={16} aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people…" aria-label="Search assignees" /></label>
        <div className="assignee-options">{matchingAssignees.length ? matchingAssignees.map((owner) => {
          const isSelected = value.assigneeIds.includes(owner.id);
          const isOtherTeam = Boolean(selectedTeamId && owner.teamId !== selectedTeamId);
          return <label className={isOtherTeam && !isSelected ? "assignee-option-disabled" : undefined} key={owner.id}><input type="checkbox" checked={isSelected} onChange={() => toggleAssignee(owner.id)} disabled={isSubmitting || (isOtherTeam && !isSelected)} /><span className="avatar">{owner.initials}</span><span>{owner.name}</span></label>;
        }) : <p>No matching people.</p>}</div>
      </div> : null}
    </div>
  );
}

function TaskFields({ clients, isSubmitting, value, onChange, allowArchivedClientId, disableClientSelection = false }: Pick<SharedDialogProps, "clients" | "isSubmitting" | "value" | "onChange"> & { allowArchivedClientId?: string; disableClientSelection?: boolean }) {
  const selectableClients = clients.filter((client) => client.isActive || client.id === allowArchivedClientId);
  return <>
    <label>Task name<input autoFocus value={value.title} onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))} placeholder="What needs to happen?" disabled={isSubmitting} /></label>
    <label className="composer-description">Description <span>Optional</span><textarea value={value.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} placeholder="Add context, links, or acceptance criteria…" maxLength={5000} disabled={isSubmitting} /></label>
    <div className="form-grid">
      <label>Client<select value={value.clientId} onChange={(event) => onChange((current) => ({ ...current, clientId: event.target.value }))} disabled={isSubmitting || disableClientSelection}>{selectableClients.length ? selectableClients.map((client) => <option disabled={!client.isActive} key={client.id} value={client.id}>{client.name}{client.isActive ? "" : " (archived)"}</option>) : <option value="">No active clients</option>}</select></label>
      <label>Priority<select value={value.priority} onChange={(event) => onChange((current) => ({ ...current, priority: event.target.value as TaskPriority }))} disabled={isSubmitting}>{Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Due date<input type="date" value={value.dueDate} onChange={(event) => onChange((current) => ({ ...current, dueDate: event.target.value }))} disabled={isSubmitting} /></label>
    </div>
  </>;
}

export function TaskEditor({ clients, error, isSubmitting, owners, task, value, onChange, onClose, onSave }: TaskEditorProps) {
  const formHint = !value.title.trim()
    ? "Enter a task name to save your changes."
    : value.assigneeIds.length === 0
      ? "Select at least one assignee to save your changes."
      : null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="composer" role="dialog" aria-modal="true" aria-labelledby="edit-task-title">
        <div className="detail-heading">
          <div><p className="eyebrow">Manager action</p><h2 id="edit-task-title">Edit task</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close edit task form" disabled={isSubmitting}><X size={18} /></button>
        </div>
        <TaskFields clients={clients} isSubmitting={isSubmitting} value={value} onChange={onChange} allowArchivedClientId={task.clientId} />
        <AssigneePicker owners={owners} value={value} onChange={onChange} isSubmitting={isSubmitting} menuId="edit-task-assignee-select-menu" labelId="edit-task-assignee-select-label" />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {formHint ? <p className="form-hint" role="status">{formHint}</p> : null}
        <div className="composer-actions">
          <button type="button" className="button button-quiet" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="button" className="button button-primary" onClick={() => void onSave()} disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="button-spinner" size={17} aria-hidden="true" /> : <Pencil size={17} aria-hidden="true" />}{isSubmitting ? "Saving…" : "Save changes"}</button>
        </div>
      </section>
    </div>
  );
}

export function TaskComposer({ attachments, clients, error, isSubmitting, owners, value, onAttachmentsChange, onChange, onClose, onCreate }: TaskComposerProps) {
  const totalSize = attachments.reduce((total, file) => total + file.size, 0);
  const invalidFiles = attachments.length > MAX_TASK_ATTACHMENTS || attachments.some((file) => file.size > MAX_TASK_ATTACHMENT_BYTES || !["image/png", "image/jpeg", "image/webp"].includes(file.type));
  const activeClients = clients.filter((client) => client.isActive);
  const formHint = !value.title.trim()
    ? "Enter a task name to allocate it."
    : value.assigneeIds.length === 0
      ? "Select at least one assignee to allocate this task."
      : null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="composer" role="dialog" aria-modal="true" aria-labelledby="allocate-task-title">
        <div className="detail-heading">
          <div><p className="eyebrow">Manager action</p><h2 id="allocate-task-title">Allocate task</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close allocation form" disabled={isSubmitting}><X size={18} /></button>
        </div>
        <TaskFields clients={activeClients} isSubmitting={isSubmitting} value={value} onChange={onChange} disableClientSelection={activeClients.length === 0} />
        <AssigneePicker owners={owners} value={value} onChange={onChange} isSubmitting={isSubmitting} menuId="assignee-select-menu" labelId="assignee-select-label" />
        <div className="attachment-picker">
          <label htmlFor="task-images"><ImagePlus size={17} aria-hidden="true" /><span>Add images <small>optional · PNG, JPEG, or WebP · up to {MAX_TASK_ATTACHMENTS} × 5 MB</small></span></label>
          <input id="task-images" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => onAttachmentsChange(Array.from(event.currentTarget.files ?? []))} disabled={isSubmitting} />
          {attachments.length > 0 ? <p className={invalidFiles ? "form-error" : "attachment-summary"}>{invalidFiles ? "Choose up to four PNG, JPEG, or WebP images no larger than 5 MB each." : `${attachments.length} image${attachments.length === 1 ? "" : "s"} selected · ${(totalSize / 1024 / 1024).toFixed(1)} MB`}</p> : null}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {formHint ? <p className="form-hint" role="status">{formHint}</p> : null}
        <div className="composer-actions">
          <button type="button" className="button button-quiet" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="button" className="button button-primary" onClick={() => void onCreate()} disabled={isSubmitting || invalidFiles || activeClients.length === 0}>{isSubmitting ? <LoaderCircle className="button-spinner" size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}{isSubmitting ? "Allocating…" : "Allocate and notify"}</button>
        </div>
      </section>
    </div>
  );
}
