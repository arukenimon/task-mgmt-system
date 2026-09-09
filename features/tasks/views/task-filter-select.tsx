"use client";

import { ChevronDown, Search } from "lucide-react";
import { QueryClient, QueryClientProvider, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import type {
  TaskFilterOptionCursor,
  TaskFilterOptionKind,
  TaskFilterOptionPage,
} from "@/features/tasks/models/task-filter-options";

type TaskFilterSelectProps = {
  kind: TaskFilterOptionKind;
  label: string;
  allLabel: string;
  emptyLabel: string;
  selectedId: string;
  selectedLabel: string;
  onChange: (id: string) => void;
  formatOptionLabel?: (label: string, id: string) => string;
};

async function fetchTaskFilterOptionPage(kind: TaskFilterOptionKind, query: string, cursor: TaskFilterOptionCursor | null, signal: AbortSignal) {
  const params = new URLSearchParams({ kind, q: query });
  if (cursor) {
    params.set("cursorLabel", cursor.label);
    params.set("cursorId", cursor.id);
  }

  const response = await fetch(`/api/task-filter-options?${params.toString()}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Unable to load filter options.");
  }
  return response.json() as Promise<TaskFilterOptionPage>;
}

export function TaskFilterSelect(props: TaskFilterSelectProps) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}><TaskFilterSelectContent {...props} /></QueryClientProvider>;
}

function TaskFilterSelectContent({ kind, label, allLabel, emptyLabel, selectedId, selectedLabel, onChange, formatOptionLabel = (optionLabel) => optionLabel }: TaskFilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuId = useId();
  const selectRef = useRef<HTMLDivElement>(null);
  const searchQuery = search.trim();
  const optionsQuery = useInfiniteQuery({
    queryKey: ["task-filter-options", kind, searchQuery],
    queryFn: ({ pageParam, signal }) => fetchTaskFilterOptionPage(kind, searchQuery, pageParam, signal),
    initialPageParam: null as TaskFilterOptionCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isOpen,
    staleTime: 30_000,
  });
  const options = optionsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!selectRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [isOpen]);

  function selectOption(id: string) {
    onChange(id);
    setSearch("");
    setIsOpen(false);
  }

  return <div className="task-filter-select" ref={selectRef}>
    <button aria-controls={menuId} aria-expanded={isOpen} aria-haspopup="listbox" aria-label={label} className="task-filter-select-trigger" onClick={() => setIsOpen((open) => !open)} type="button">
      <span>{selectedLabel}</span><ChevronDown aria-hidden="true" size={16} />
    </button>
    {isOpen ? <div className="task-filter-select-menu" id={menuId} onKeyDown={(event) => { if (event.key === "Escape") setIsOpen(false); }}>
      <label className="task-filter-select-search"><Search aria-hidden="true" size={16} /><span className="sr-only">Search {allLabel.toLowerCase()}</span><input autoFocus onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${allLabel.toLowerCase()}`} value={search} /></label>
      <div aria-label={label} className="task-filter-select-options" role="listbox">
        <button aria-selected={selectedId === "all"} className={selectedId === "all" ? "task-filter-select-option task-filter-select-option-selected" : "task-filter-select-option"} onClick={() => selectOption("all")} role="option" type="button">{allLabel}</button>
        {options.map((option) => <button aria-selected={selectedId === option.id} className={selectedId === option.id ? "task-filter-select-option task-filter-select-option-selected" : "task-filter-select-option"} key={option.id} onClick={() => selectOption(option.id)} role="option" type="button">{formatOptionLabel(option.label, option.id)}</button>)}
        {optionsQuery.isLoading ? <p className="task-filter-select-status" role="status">Searching…</p> : null}
        {optionsQuery.isError ? <p className="task-filter-select-status task-filter-select-error" role="alert">{optionsQuery.error.message}</p> : null}
        {!optionsQuery.isLoading && !optionsQuery.isError && options.length === 0 ? <p className="task-filter-select-status">{emptyLabel}</p> : null}
      </div>
      {optionsQuery.hasNextPage ? <button className="task-filter-select-more" disabled={optionsQuery.isFetchingNextPage} onClick={() => void optionsQuery.fetchNextPage()} type="button">{optionsQuery.isFetchingNextPage ? "Loading…" : "Load more"}</button> : null}
    </div> : null}
  </div>;
}
