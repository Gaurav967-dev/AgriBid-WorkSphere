"use client";

import { useEffect, useRef, useState } from "react";
import {
    ArrowUpDown,
    CalendarDays,
    Check,
    ChevronDown,
    Filter,
    Search,
    X,
} from "lucide-react";

import type { ProjectListStatus } from "@/features/projects/api/projects-api";

export type ProjectSort =
    | "updated-desc"
    | "updated-asc"
    | "created-desc"
    | "created-asc"
    | "name-asc"
    | "name-desc"
    | "start-asc"
    | "start-desc";

type Props = {
    totalProjects: number;
    search: string;
    onSearchChange: (value: string) => void;
    status: ProjectListStatus;
    onStatusChange: (value: ProjectListStatus) => void;
    sort: ProjectSort;
    onSortChange: (value: ProjectSort) => void;
};

const STATUS_OPTIONS: { label: string; value: ProjectListStatus }[] = [
    { label: "All projects", value: "ALL" },
    { label: "Planning", value: "PLANNING" },
    { label: "Active", value: "ACTIVE" },
    { label: "On hold", value: "ON_HOLD" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Archived", value: "ARCHIVED" },
];

const SORT_OPTIONS: { label: string; value: ProjectSort }[] = [
    { label: "Recently updated", value: "updated-desc" },
    { label: "Oldest updated", value: "updated-asc" },
    { label: "Newest created", value: "created-desc" },
    { label: "Oldest created", value: "created-asc" },
    { label: "Name: A to Z", value: "name-asc" },
    { label: "Name: Z to A", value: "name-desc" },
    { label: "Start date: earliest", value: "start-asc" },
    { label: "Start date: latest", value: "start-desc" },
];

export function ProjectsToolbar({
    totalProjects,
    search,
    onSearchChange,
    status,
    onStatusChange,
    sort,
    onSortChange,
}: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);

    useEffect(() => {
        if (!filterOpen && !sortOpen) return;

        function handleOutsidePointerDown(event: PointerEvent) {
            const target = event.target;
            if (target instanceof Node && !rootRef.current?.contains(target)) {
                setFilterOpen(false);
                setSortOpen(false);
            }
        }

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        return () =>
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
    }, [filterOpen, sortOpen]);

    return (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <CalendarDays className="size-4 text-violet-600" />
                <span>
                    <strong className="font-semibold text-slate-900 dark:text-white">
                        {totalProjects}
                    </strong>{" "}
                    {totalProjects === 1 ? "project" : "projects"}
                </span>
            </div>

            <div ref={rootRef} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:w-60">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search projects..."
                        aria-label="Search projects"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-violet-950"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => onSearchChange("")}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>

                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setFilterOpen((current) => !current);
                            setSortOpen(false);
                        }}
                        aria-expanded={filterOpen}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <Filter className="size-3.5" />
                        Filter
                        <ChevronDown className={`size-3.5 text-slate-400 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
                    </button>
                    {filterOpen && (
                        <div className="absolute left-0 top-full z-50 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Project status
                            </p>
                            {STATUS_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onStatusChange(option.value);
                                        setFilterOpen(false);
                                    }}
                                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {option.label}
                                    {status === option.value && <Check className="size-3.5 text-violet-700 dark:text-violet-300" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setSortOpen((current) => !current);
                            setFilterOpen(false);
                        }}
                        aria-expanded={sortOpen}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <ArrowUpDown className="size-3.5" />
                        Sort by
                        <ChevronDown className={`size-3.5 text-slate-400 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
                    </button>
                    {sortOpen && (
                        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Sort projects
                            </p>
                            {SORT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onSortChange(option.value);
                                        setSortOpen(false);
                                    }}
                                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {option.label}
                                    {sort === option.value && <Check className="size-3.5 text-violet-700 dark:text-violet-300" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
