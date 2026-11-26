"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowUpDown,
    Check,
    ChevronRight,
    ListFilter,
    Shield,
} from "lucide-react";

import type { Team, TeamListStatus } from "@/features/teams/api/teams-api";
import type {
    MembershipFilter,
    TeamsSort,
} from "./teams-ui-types";

type FilterSection = "membership" | "identifiers" | "status" | null;

type TeamsFilterProps = {
    teams: Team[];
    membership: MembershipFilter[];
    identifiers: string[];
    status: TeamListStatus;
    sort: TeamsSort;
    onMembershipChange: (value: MembershipFilter) => void;
    onIdentifierChange: (value: string) => void;
    onStatusChange: (value: TeamListStatus) => void;
    onSortChange: (value: TeamsSort) => void;
    onClear: () => void;
};

const MEMBERSHIP_OPTIONS: MembershipFilter[] = ["Joined", "Not-Joined"];

const SORT_OPTIONS: {
    heading: string;
    options: { label: string; value: TeamsSort }[];
}[] = [
    {
        heading: "Name",
        options: [
            { label: "A → Z", value: "name-asc" },
            { label: "Z → A", value: "name-desc" },
        ],
    },
    {
        heading: "Members",
        options: [
            { label: "No. of Members (asc)", value: "members-asc" },
            { label: "No. of Members (desc)", value: "members-desc" },
        ],
    },
    {
        heading: "Projects",
        options: [
            { label: "No. of Projects (asc)", value: "projects-asc" },
            { label: "No. of Projects (desc)", value: "projects-desc" },
        ],
    },
];

export function TeamsFilter({
    teams,
    membership,
    identifiers,
    status,
    sort,
    onMembershipChange,
    onIdentifierChange,
    onStatusChange,
    onSortChange,
    onClear,
}: TeamsFilterProps) {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);
    const [active, setActive] = useState<FilterSection>(null);

    const availableIdentifiers = useMemo(
        () =>
            Array.from(
                new Map(
                    teams.map((team) => [
                        team.id.slice(0, 8).toUpperCase(),
                        team.id,
                    ]),
                ).entries(),
            ),
        [teams],
    );

    const activeFilterCount =
        membership.length + identifiers.length + (status !== "ACTIVE" ? 1 : 0);

    useEffect(() => {
        if (!filterOpen && !sortOpen) return;

        function handleOutsidePointerDown(event: PointerEvent) {
            const target = event.target;
            if (
                target instanceof Node &&
                !toolbarRef.current?.contains(target)
            ) {
                setFilterOpen(false);
                setSortOpen(false);
                setActive(null);
            }
        }

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        return () =>
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
    }, [filterOpen, sortOpen]);

    function closeFilter() {
        setFilterOpen(false);
        setActive(null);
    }

    return (
        <div ref={toolbarRef} className="flex items-center gap-2">
            <div className="relative">
                <button
                    type="button"
                    onClick={() => {
                        setFilterOpen((current) => !current);
                        setSortOpen(false);
                        setActive(null);
                    }}
                    aria-expanded={filterOpen}
                    className="inline-flex h-7 items-center gap-2 rounded-md px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    <ListFilter className="size-3.5" />
                    Filter
                    {activeFilterCount > 0 && (
                        <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-violet-700 text-[9px] font-semibold text-white">
                            {activeFilterCount}
                        </span>
                    )} </button>

                {filterOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        {active === null ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setActive("membership")}
                                    className="flex w-full items-center justify-between px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    <span className="flex items-center gap-2">
                                        <Shield className="size-3.5 text-slate-400" />
                                        Members
                                    </span>
                                    <span className="flex items-center gap-2 text-slate-400">
                                        {membership.length > 0 && membership.length}
                                        <ChevronRight className="size-3.5" />
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActive("identifiers")}
                                    className="flex w-full items-center justify-between px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    <span className="flex items-center gap-2">
                                        <Shield className="size-3.5 text-slate-400" />
                                        Identifiers
                                    </span>
                                    <span className="flex items-center gap-2 text-slate-400">
                                        {identifiers.length > 0 && identifiers.length}
                                        <ChevronRight className="size-3.5" />
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActive("status")}
                                    className="flex w-full items-center justify-between px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    Team status
                                    <ChevronRight className="size-3.5 text-slate-400" />
                                </button>

                                {activeFilterCount > 0 && (
                                    <>
                                        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClear();
                                                closeFilter();
                                            }}
                                            className="w-full px-3 py-2.5 text-left text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            Clear all filters
                                        </button>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-2 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setActive(null)}
                                        aria-label="Back to filters"
                                        className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <ChevronRight className="size-3.5 rotate-180" />
                                    </button>
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        {active === "membership"
                                            ? "Members"
                                            : active === "identifiers"
                                              ? "Identifiers"
                                              : "Team status"}
                                    </span>
                                </div>

                                <div className="max-h-64 overflow-y-auto py-1">
                                    {active === "membership" &&
                                        MEMBERSHIP_OPTIONS.map((value) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => onMembershipChange(value)}
                                                className="flex w-full items-center justify-between px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                {value}
                                                {membership.includes(value) && (
                                                    <Check className="size-3.5 text-violet-700 dark:text-violet-300" />
                                                )}
                                            </button>
                                        ))}

                                    {active === "identifiers" &&
                                        availableIdentifiers.map(([label, id]) => (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => onIdentifierChange(label)}
                                                className="flex w-full items-center justify-between px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                {label}
                                                {identifiers.includes(label) && (
                                                    <Check className="size-3.5 text-violet-700 dark:text-violet-300" />
                                                )}
                                            </button>
                                        ))}

                                    {active === "status" &&
                                        (
                                            [
                                                ["ACTIVE", "Active"],
                                                ["ARCHIVED", "Archived"],
                                                ["ALL", "All"],
                                            ] as const
                                        ).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => onStatusChange(value)}
                                                className="flex w-full items-center justify-between px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                {label}
                                                {status === value && (
                                                    <Check className="size-3.5 text-violet-700 dark:text-violet-300" />
                                                )}
                                            </button>
                                        ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => {
                        setSortOpen((current) => !current);
                        setFilterOpen(false);
                        setActive(null);
                    }}
                    aria-expanded={sortOpen}
                    className="inline-flex h-7 items-center gap-2 rounded-md px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                    <ArrowUpDown className="size-3.5" />
                    Sort by </button>

                {sortOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        {SORT_OPTIONS.map((group) => (
                            <div key={group.heading}>
                                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    {group.heading}
                                </p>
                                {group.options.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            onSortChange(option.value);
                                            setSortOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between px-3 py-2.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                        {option.label}
                                        {sort === option.value && (
                                            <Check className="size-3.5 text-violet-700 dark:text-violet-300" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
