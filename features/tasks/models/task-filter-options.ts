export const TASK_FILTER_OPTION_KINDS = ["assignee", "client", "team"] as const;
export type TaskFilterOptionKind = (typeof TASK_FILTER_OPTION_KINDS)[number];

export const TASK_FILTER_OPTION_PAGE_SIZE = 20;

export type TaskFilterOption = {
  id: string;
  label: string;
};

export type TaskFilterOptionCursor = {
  label: string;
  id: string;
};

export type TaskFilterOptionPage = {
  items: TaskFilterOption[];
  nextCursor: TaskFilterOptionCursor | null;
};

export type TaskFilterOptionPageRequest = {
  kind: TaskFilterOptionKind;
  query: string;
  cursor?: TaskFilterOptionCursor | null;
};
