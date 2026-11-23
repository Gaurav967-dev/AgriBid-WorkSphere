"use client";

import { Box, Check, Info, Play, Users } from "lucide-react";

import type { Team } from "@/features/teams/api/teams-api";
import type { TeamDisplayProperties } from "./teams-ui-types";
import { TeamMembersTooltip } from "./team-members-tooltip";

type Props = {
    team: Team;
    displayProperties: TeamDisplayProperties;
    onOpen: (team: Team) => void;
};

function formatDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-IN", {
        month: "short",
        day: "2-digit",
    }).format(date);
}

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

export default function TeamLine({
    team,
    displayProperties,
    onOpen,
}: Props) {
    return (
        <div
            className="flex w-full min-w-[760px] items-center border-b border-slate-200/70 px-4 py-2.5 text-sm transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40 sm:px-6"
        >
            {/* Name */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    <Users className="size-3.5" />
                </span>

                <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                    {team.name}
                </span>
                <button
                    type="button"
                    onClick={() => onOpen(team)}
                    aria-label={`View ${team.name} details`}
                    title={`View ${team.name} details`}
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:hover:bg-violet-950/50 dark:hover:text-violet-300"
                >
                    <Info className="size-4" />
                </button>
            </div>

            {/* Membership */}
            {displayProperties.membership && (
                <div className="w-[15%] min-w-[130px] shrink-0">
                    {team.is_joined && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            <Check className="size-3" />
                            Joined
                        </span>
                    )}
                </div>
            )}

            {/* Owner */}
            {displayProperties.owners && (
                <div className="hidden w-[70px] shrink-0 lg:block">
                    {team.lead && (
                        <span
                            title={team.lead.full_name}
                            className="flex size-6 items-center justify-center rounded-full border border-slate-200 bg-violet-100 text-[9px] font-bold text-violet-800 dark:border-slate-700 dark:bg-violet-950 dark:text-violet-200"
                        >
                            {getInitials(team.lead.full_name)}
                        </span>
                    )}
                </div>
            )}

            {/* Identifier */}
            <div
                className="w-[15%] min-w-[120px] shrink-0"
                title={team.id}
            >
                <span className="font-mono text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {team.id.slice(0, 8).toUpperCase()}
                </span>
            </div>

            {/* Members */}
            {displayProperties.members && (
                <div className="w-[15%] min-w-[150px] shrink-0">
                    <TeamMembersTooltip team={team} />
                </div>
            )}

            {/* Cycle */}
            {displayProperties.cycle && (
                <div className="hidden w-[80px] shrink-0 items-center gap-1.5 text-xs text-slate-400 md:flex">
                    <Play className="size-3.5" />
                    —
                </div>
            )}

            {/* Projects */}
            {displayProperties.projects && (
                <div className="hidden w-[15%] min-w-[100px] shrink-0 items-center gap-1.5 text-xs text-slate-400 sm:flex">
                    <Box className="size-3.5" />
                    —
                </div>
            )}

            {/* Created */}
            {displayProperties.created && (
                <div className="hidden w-[90px] shrink-0 text-xs text-slate-500 xl:block">
                    {formatDate(team.created_at)}
                </div>
            )}

            {/* Updated */}
            {displayProperties.updated && (
                <div className="hidden w-[90px] shrink-0 text-xs text-slate-500 xl:block">
                    {formatDate(team.updated_at)}
                </div>
            )}
        </div>
    );
}