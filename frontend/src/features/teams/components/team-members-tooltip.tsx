"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getTeam, type Team } from "@/features/teams/api/teams-api";

function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}

type Props = {
    team: Team;
};

export function TeamMembersTooltip({ team }: Props) {
    const [open, setOpen] = useState(false);

    const membersQuery = useQuery({
        queryKey: ["teams", "detail", team.id],
        queryFn: () => getTeam(team.id),
        enabled: open && team.member_count > 0,
        staleTime: 60_000,
    });

    const preview = team.members_preview.slice(0, 3);
    const remaining = Math.max(0, team.member_count - preview.length);

    return (
        <div
            className="relative flex w-[150px] shrink-0 items-center gap-1.5"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpen(false);
                }
            }}
        >
            {team.member_count > 0 && (
                <>
                    <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`View members of ${team.name}`}
                        className="flex items-center outline-none"
                    >
                        <span className="flex -space-x-1.5">
                            {preview.map((member) => (
                                <span
                                    key={member.id}
                                    title={member.full_name}
                                    className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-violet-100 text-[9px] font-bold text-violet-800 dark:border-slate-900 dark:bg-violet-950 dark:text-violet-200"
                                >
                                    {initials(member.full_name)}
                                </span>
                            ))}
                        </span>

                        {remaining > 0 && (
                            <span className="z-[5] -ml-1.5 flex size-6 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[9px] font-semibold text-slate-600 dark:border-slate-900 dark:bg-slate-800 dark:text-slate-300">
                                +{remaining}
                            </span>
                        )}
                    </button>

                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {team.member_count}
                    </span>
                </>
            )}

            {open && team.member_count > 0 && (
                <div
                    role="tooltip"
                    className="absolute top-full left-0 z-[100] mt-2 w-[min(390px,85vw)] rounded-md border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                >
                    <p className="mb-2 border-b border-slate-100 px-1 pb-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        Members
                    </p>

                    {membersQuery.isPending ? (
                        <p className="px-1 py-2 text-xs text-slate-500">
                            Loading members...
                        </p>
                    ) : membersQuery.isError ? (
                        <p className="px-1 py-2 text-xs text-rose-600">
                            Unable to load members.
                        </p>
                    ) : (
                        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                            {(membersQuery.data?.members ?? []).map(
                                (membership) => {
                                    const member = membership.user;
                                    const role =
                                        member.role_code === "ADMIN"
                                            ? "Admin"
                                            : "Member";

                                    return (
                                        <div
                                            key={membership.id}
                                            className="flex min-w-0 items-center gap-1.5 py-1"
                                        >
                                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[8px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                                                {initials(member.full_name)}
                                            </span>

                                            <span className="min-w-0 truncate text-xs text-slate-800 dark:text-slate-200">
                                                <span className="font-medium">
                                                    {member.full_name}
                                                </span>
                                                <span className="text-slate-500 dark:text-slate-400">
                                                    {" - "}
                                                    {member.email}
                                                </span>
                                            </span>

                                            <span className="ml-auto shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                                                ({role})
                                            </span>
                                        </div>
                                    );
                                },
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}