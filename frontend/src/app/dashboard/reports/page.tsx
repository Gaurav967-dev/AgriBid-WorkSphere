"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    ArrowDownToLine,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    Clock3,
    FolderKanban,
    Menu,
    PanelLeft,
    Ticket,
    Users,
    AlertTriangle,
    TrendingUp,
} from "lucide-react";

import { signOut, verifyToken, type AuthUser } from "@/features/auth/api/auth-api";
import {
    downloadReportCsv,
    getProjectReport,
    getReportsOptions,
    getSprintReport,
    getTeamReport,
    type ProjectReport,
    type ReportBucket,
    type SprintReport,
    type TeamReport,
} from "@/features/reports/api/reports-api";
import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

type ReportType = "project" | "team" | "sprint";

const REPORT_TABS: Array<{ id: ReportType; label: string; icon: typeof FolderKanban }> = [
    { id: "project", label: "Project", icon: FolderKanban },
    { id: "team", label: "Team", icon: Users },
    { id: "sprint", label: "Sprint", icon: Activity },
];

function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function MetricCard({
    label,
    value,
    description,
    icon: Icon,
    tone = "violet",
}: {
    label: string;
    value: string | number;
    description: string;
    icon: typeof Ticket;
    tone?: "violet" | "emerald" | "amber" | "sky";
}) {
    const tones = {
        violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
        emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
        amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
        sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    };

    return (
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
                    <Icon className="size-4" />
                </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {typeof value === "number" ? value.toLocaleString("en-IN") : value}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{description}</p>
        </article>
    );
}

function DistributionCard({
    title,
    items,
    color = "bg-violet-500",
}: {
    title: string;
    items: ReportBucket[];
    color?: string;
}) {
    const total = items.reduce((sum, item) => sum + item.count, 0);
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                <span className="text-[10px] text-slate-400">{total.toLocaleString("en-IN")} tickets</span>
            </div>
            <div className="space-y-3">
                {items.map((item) => {
                    const percentage = total > 0 ? (item.count / total) * 100 : 0;
                    return (
                        <div key={item.key}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                                <span className="truncate text-slate-600 dark:text-slate-300">{item.label}</span>
                                <span className="shrink-0 font-semibold tabular-nums text-slate-800 dark:text-slate-100">{item.count}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function ProjectReportView({ report }: { report: ProjectReport }) {
    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total tickets" value={report.total_tickets} description="Non-deleted tickets in this project" icon={Ticket} />
                <MetricCard label="Completed tickets" value={report.completed_tickets} description="Tickets in Completed status" icon={CheckCircle2} tone="emerald" />
                <MetricCard label="Pending tickets" value={report.pending_tickets} description="Excludes Completed and Cancelled" icon={Clock3} tone="sky" />
                <MetricCard label="Overdue tickets" value={report.overdue_tickets} description="Open tickets past their due date" icon={AlertTriangle} tone="amber" />
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-sm font-semibold">Project completion</h2>
                        <p className="text-[11px] text-slate-500">{report.project_key} · {report.team_name}</p>
                    </div>
                    <p className="text-xl font-bold tabular-nums text-violet-700 dark:text-violet-300">{report.completion_percentage.toFixed(1)}%</p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(100, report.completion_percentage)}%` }} />
                </div>
            </section>

            <div className="grid gap-3 xl:grid-cols-3">
                <DistributionCard title="Tickets by priority" items={report.tickets_by_priority} color="bg-amber-500" />
                <DistributionCard title="Tickets by status" items={report.tickets_by_status} color="bg-sky-500" />
                <DistributionCard title="Tickets by type" items={report.tickets_by_type} color="bg-violet-500" />
            </div>
        </div>
    );
}

function TeamReportView({ report }: { report: TeamReport }) {
    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Assigned tickets" value={report.total_assigned_tickets} description="Tickets with an assigned owner" icon={Ticket} />
                <MetricCard label="Completed tickets" value={report.completed_tickets} description="Assigned tickets in Completed status" icon={CheckCircle2} tone="emerald" />
                <MetricCard label="Pending tickets" value={report.pending_tickets} description="Assigned tickets still open" icon={Clock3} tone="sky" />
                <MetricCard label="Overdue tickets" value={report.overdue_tickets} description="Open assigned tickets past due" icon={AlertTriangle} tone="amber" />
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div>
                        <h2 className="text-sm font-semibold">Workload by team member</h2>
                        <p className="text-[11px] text-slate-500">{report.project_count} visible project(s) · {report.workload_by_member.length} active team members</p>
                    </div>
                    <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">{report.completion_percentage.toFixed(1)}% completed</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 dark:bg-slate-950/50">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Team member</th>
                                <th className="px-3 py-3 text-right font-semibold">Assigned</th>
                                <th className="px-3 py-3 text-right font-semibold">Completed</th>
                                <th className="px-3 py-3 text-right font-semibold">Pending</th>
                                <th className="px-3 py-3 text-right font-semibold">In progress</th>
                                <th className="px-3 py-3 text-right font-semibold">Overdue</th>
                                <th className="px-4 py-3 text-right font-semibold">Completion</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {report.workload_by_member.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No active team members found.</td></tr>
                            ) : report.workload_by_member.map((member) => (
                                <tr key={member.user_id}>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{member.full_name}</p>
                                        <p className="mt-0.5 text-[10px] text-slate-400">{member.role_code.replaceAll("_", " ")}</p>
                                    </td>
                                    <td className="px-3 py-3 text-right tabular-nums">{member.assigned_tickets}</td>
                                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{member.completed_tickets}</td>
                                    <td className="px-3 py-3 text-right tabular-nums">{member.pending_tickets}</td>
                                    <td className="px-3 py-3 text-right tabular-nums">{member.in_progress_tickets}</td>
                                    <td className="px-3 py-3 text-right tabular-nums text-amber-700 dark:text-amber-300">{member.overdue_tickets}</td>
                                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{member.completion_percentage.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="border-t border-slate-100 px-4 py-3 text-[10px] leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {report.interpretation_note}
                </div>
            </section>

            <DistributionCard title="Team tickets by status" items={report.tickets_by_status} color="bg-sky-500" />
        </div>
    );
}

function SprintReportView({ report }: { report: SprintReport }) {
    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Sprint tickets" value={report.total_tickets} description="Tickets in the final sprint scope" icon={Ticket} />
                <MetricCard label="Completed work" value={report.completed_work} description="Tickets completed by sprint close" icon={CheckCircle2} tone="emerald" />
                <MetricCard label="Incomplete work" value={report.incomplete_work} description="Work not completed by sprint close" icon={Clock3} tone="sky" />
                <MetricCard label="Completion rate" value={`${report.completion_rate.toFixed(1)}%`} description={`${report.cancelled_work} cancelled ticket(s) excluded from incomplete work`} icon={TrendingUp} tone="violet" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="Scope changes" value={report.scope_change_count} description="Additions and removals after sprint start" icon={Activity} />
                <MetricCard label="Added after start" value={report.tickets_added_after_start} description="Tickets added once the sprint was active" icon={ArrowDownToLine} tone="sky" />
                <MetricCard label="Removed after start" value={report.tickets_removed_after_start} description="Tickets removed before sprint close" icon={AlertTriangle} tone="amber" />
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <h2 className="text-sm font-semibold">Sprint work</h2>
                    <p className="text-[11px] text-slate-500">{report.project_key} · {report.sprint_name} · {formatDate(report.start_date)} – {formatDate(report.end_date)}</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[660px] text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 dark:bg-slate-950/50">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Ticket</th>
                                <th className="px-3 py-3 font-semibold">Status at close</th>
                                <th className="px-3 py-3 font-semibold">Priority</th>
                                <th className="px-3 py-3 font-semibold">Type</th>
                                <th className="px-4 py-3 font-semibold">Assignee</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {report.tickets.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No tickets in the sprint scope.</td></tr>
                            ) : report.tickets.map((ticket) => (
                                <tr key={ticket.ticket_id}>
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-violet-700 dark:text-violet-300">{ticket.ticket_key}</p>
                                        <p className="mt-0.5 text-slate-600 dark:text-slate-300">{ticket.title}</p>
                                    </td>
                                    <td className="px-3 py-3">{ticket.status.replaceAll("_", " ")}</td>
                                    <td className="px-3 py-3">{ticket.priority}</td>
                                    <td className="px-3 py-3">{ticket.type.replaceAll("_", " ")}</td>
                                    <td className="px-4 py-3">{ticket.assignee_name ?? "Unassigned"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-sm font-semibold">Sprint scope changes</h2>
                        <p className="text-[11px] text-slate-500">Recorded ticket additions and removals after sprint start</p>
                    </div>
                    <span className="text-xs font-semibold tabular-nums">{report.scope_changes.length} events</span>
                </div>
                {report.scope_changes.length === 0 ? (
                    <p className="py-5 text-center text-xs text-slate-400">No scope changes recorded after sprint start.</p>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {report.scope_changes.map((change, index) => (
                            <div key={`${change.ticket_id}-${change.change_type}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold">{change.ticket_key} · {change.title}</p>
                                    <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTime(change.occurred_at)}</p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${change.change_type === "ADDED_AFTER_START" ? "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                                    {change.change_type === "ADDED_AFTER_START" ? "Added after start" : "Removed after start"}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default function ReportsPage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [activeType, setActiveType] = useState<ReportType>("project");
    const [projectId, setProjectId] = useState("");
    const [teamId, setTeamId] = useState("");
    const [sprintId, setSprintId] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const { collapsed, toggleCollapsed } = useWorkspaceSidebarState();

    useEffect(() => {
        let active = true;
        verifyToken()
            .then(({ user: verifiedUser }) => {
                if (!active) return;
                setUser(verifiedUser);
                setIsCheckingAuth(false);
            })
            .catch(() => {
                if (active) router.replace("/");
            });
        return () => {
            active = false;
        };
    }, [router]);

    const optionsQuery = useQuery({
        queryKey: ["reports-options"],
        queryFn: getReportsOptions,
        enabled: !isCheckingAuth && Boolean(user),
        staleTime: 30_000,
    });

    const options = optionsQuery.data;
    const activeProjectId = projectId || options?.projects[0]?.id || "";
    const activeTeamId = teamId || options?.teams[0]?.id || "";
    const activeSprintId = sprintId || options?.sprints[0]?.id || "";

    const projectQuery = useQuery({
        queryKey: ["reports", "project", activeProjectId],
        queryFn: () => getProjectReport(activeProjectId),
        enabled: !isCheckingAuth && Boolean(user) && activeType === "project" && Boolean(activeProjectId),
    });
    const teamQuery = useQuery({
        queryKey: ["reports", "team", activeTeamId],
        queryFn: () => getTeamReport(activeTeamId),
        enabled: !isCheckingAuth && Boolean(user) && activeType === "team" && Boolean(activeTeamId),
    });
    const sprintQuery = useQuery({
        queryKey: ["reports", "sprint", activeSprintId],
        queryFn: () => getSprintReport(activeSprintId),
        enabled: !isCheckingAuth && Boolean(user) && activeType === "sprint" && Boolean(activeSprintId),
    });

    const isReportLoading =
        activeType === "project" ? projectQuery.isLoading
            : activeType === "team" ? teamQuery.isLoading
                : sprintQuery.isLoading;
    const reportError =
        activeType === "project" ? projectQuery.error
            : activeType === "team" ? teamQuery.error
                : sprintQuery.error;
    const projectReport = projectQuery.data;
    const teamReport = teamQuery.data;
    const sprintReport = sprintQuery.data;
    const activeReportId =
        activeType === "project" ? activeProjectId
            : activeType === "team" ? activeTeamId
                : activeSprintId;
    const hasActiveReport =
        activeType === "project" ? Boolean(projectReport)
            : activeType === "team" ? Boolean(teamReport)
                : Boolean(sprintReport);

    async function handleExport() {
        if (!activeReportId || isExporting) return;
        setIsExporting(true);
        setExportError(null);
        try {
            await downloadReportCsv(activeType, activeReportId);
        } catch (error) {
            setExportError(error instanceof Error ? error.message : "Unable to export report.");
        } finally {
            setIsExporting(false);
        }
    }

    async function handleSignOut() {
        setIsSigningOut(true);
        try {
            await signOut();
        } catch {
            // The session may already have expired.
        } finally {
            router.replace("/");
            router.refresh();
        }
    }

    const selectedOption =
        activeType === "project"
            ? options?.projects.find((item) => item.id === activeProjectId)
            : activeType === "team"
                ? options?.teams.find((item) => item.id === activeTeamId)
                : options?.sprints.find((item) => item.id === activeSprintId);

    return (
        <main className="workspace-shell flex h-dvh min-h-0 w-full min-w-0 overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <WorkspaceSidebar user={user} collapsed={collapsed} mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

            <div className="flex h-full min-h-0 w-0 min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="hidden size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 md:flex dark:text-slate-300 dark:hover:bg-slate-800"><PanelLeft className="size-4" /></button>
                        <button type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"><Menu className="size-5" /></button>
                        <p className="truncate text-sm font-semibold">Reports &amp; Analytics</p>
                    </div>
                    <WorkspaceActions user={user} onSignOut={handleSignOut} isSigningOut={isSigningOut} />
                </header>

                <section className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-6">
                    <div className="mx-auto max-w-[1440px] space-y-4">
                        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">Workspace insights</p>
                                <h1 className="mt-1 text-2xl font-bold tracking-tight">Reports &amp; Analytics</h1>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Understand project delivery, team workload and sprint outcomes.</p>
                            </div>
                            <button type="button" onClick={handleExport} disabled={!hasActiveReport || isExporting} className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg bg-violet-700 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50 lg:self-auto">
                                <ArrowDownToLine className="size-4" />
                                {isExporting ? "Preparing CSV..." : "Export CSV"}
                            </button>
                        </div>

                        <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {REPORT_TABS.map((tab) => {
                                    const Icon = tab.icon;
                                    const selected = activeType === tab.id;
                                    return (
                                        <button key={tab.id} type="button" onClick={() => { setActiveType(tab.id); setExportError(null); }} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${selected ? "bg-violet-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
                                            <Icon className="size-3.5" />{tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <label className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 text-[11px] font-medium text-slate-500">{activeType === "project" ? "Project" : activeType === "team" ? "Team" : "Sprint"}</span>
                                <select
                                    value={activeReportId}
                                    onChange={(event) => {
                                        if (activeType === "project") setProjectId(event.target.value);
                                        else if (activeType === "team") setTeamId(event.target.value);
                                        else setSprintId(event.target.value);
                                    }}
                                    className="h-9 min-w-0 max-w-[min(70vw,380px)] rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    {activeType === "project" && options?.projects.map((item) => <option key={item.id} value={item.id}>{item.key} · {item.name}</option>)}
                                    {activeType === "team" && options?.teams.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.project_count} projects</option>)}
                                    {activeType === "sprint" && options?.sprints.map((item) => <option key={item.id} value={item.id}>{item.project_key} · {item.name}</option>)}
                                </select>
                            </label>
                        </div>

                        {exportError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{exportError}</p>}
                        {optionsQuery.isLoading ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">Loading report options...</div>
                        ) : optionsQuery.isError ? (
                            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40">{optionsQuery.error.message}</div>
                        ) : !selectedOption ? (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
                                <BarChart3 className="mx-auto size-8 text-slate-300" />
                                <h2 className="mt-3 text-sm font-semibold">No {activeType} reports available</h2>
                                <p className="mt-1 text-xs text-slate-500">There are no {activeType} records within your current workspace access.</p>
                            </div>
                        ) : isReportLoading ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">Loading {activeType} report...</div>
                        ) : reportError ? (
                            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40">{reportError.message}</div>
                        ) : (
                            <>
                                {activeType === "project" && projectReport && <ProjectReportView report={projectReport} />}
                                {activeType === "team" && teamReport && <TeamReportView report={teamReport} />}
                                {activeType === "sprint" && sprintReport && <SprintReportView report={sprintReport} />}
                            </>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
