"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    ArrowRight,
    BriefcaseBusiness,
    CalendarDays,
    CheckCircle2,
    CirclePause,
    CircleAlert,
    Clock3,
    Send,
    Ticket as TicketIcon,
    FolderKanban,
    Layers3,
    Menu,
    Users,
    UserRoundCheck,
    PanelLeft,
    type LucideIcon,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";
import {
    getDashboard,
    type DashboardMetric,
    type DashboardProject,
    type DashboardRole,
    type DashboardActivity,
    type DashboardDeadline,
    type DashboardTeamWorkload,
} from "@/features/dashboard/api/dashboard-api";
import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";
import { getInvitations } from "@/features/users/api/users-api";

const METRIC_ICONS: Record<string, LucideIcon> = {
    total_users: Users,
    active_users: UserRoundCheck,
    total_teams: Layers3,
    total_projects: FolderKanban,
    active_projects: Activity,
    completed_projects: CheckCircle2,
    assigned_projects: BriefcaseBusiness,
    planning_projects: CalendarDays,
    on_hold_projects: CirclePause,
    total_tickets: TicketIcon,
    pending_tickets: Clock3,
    completed_tickets: CheckCircle2,
    overdue_tickets: CircleAlert,
    project_completion: CheckCircle2,
    open_tickets: Clock3,
    in_progress_tickets: Activity,
    my_assigned_tickets: TicketIcon,
    my_pending_tickets: Clock3,
    tickets_awaiting_review: CalendarDays,
    overdue_tasks: CircleAlert,
    assigned_testing_tickets: TicketIcon,
    testing_queue: Clock3,
    passed_tickets: CheckCircle2,
    failed_tickets: CircleAlert,
    reopened_tickets: Activity,
    bugs_reported: CircleAlert,
    pending_testing: Clock3,
    upcoming_testing_deadlines: CalendarDays,
    upcoming_deadlines: CalendarDays,
};

const STATUS_STYLES: Record<string, string> = {
    PLANNING: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    ON_HOLD: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    COMPLETED: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    ARCHIVED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const STATUS_LABELS: Record<string, string> = {
    PLANNING: "Planning",
    ACTIVE: "Active",
    ON_HOLD: "On hold",
    COMPLETED: "Completed",
    ARCHIVED: "Archived",
};

const ROLE_CONTENT: Record<
    DashboardRole,
    { eyebrow: string; title: string; description: string }
> = {
    ADMIN: {
        eyebrow: "Administration",
        title: "Dashboard",
        description:
            "Monitor users, teams and project activity across your workspace.",
    },
    PM: {
        eyebrow: "Project management",
        title: "Dashboard",
        description:
            "Review the projects you manage and their current status.",
    },
    DEVELOPER: {
        eyebrow: "Development workspace",
        title: "Dashboard",
        description:
            "View the projects you are currently assigned to.",
    },
    TESTER: {
        eyebrow: "Quality assurance",
        title: "Dashboard",
        description:
            "View the projects available to you.",
    },
};

function formatDate(value: string | null): string {
    if (!value) return "Not set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not set";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function formatDateTime(value: string | null): string {
    if (!value) return "Unknown date";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}



function InvitationSummaryCard({
    title,
    value,
    detail,
    icon: Icon,
}: {
    title: string;
    value: number;
    detail: string;
    icon: LucideIcon;
}) {
    return (
        <article className="flex min-h-[88px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    <Icon className="size-5" />
                </span>
            </div>
            <p className="mt-0.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white">{value.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{detail}</p>
        </article>
    );
}

function relativeUpdate(value?: string | null): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
    const Icon = METRIC_ICONS[metric.key] ?? Activity;

    return (
        <article className="flex min-h-[88px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {metric.title}
                    </p>
                    <p className="mt-0.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                        {metric.value.toLocaleString("en-IN")}{metric.key === "project_completion" ? "%" : ""}
                    </p>
                </div>

                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    <Icon className="size-5" />
                </div>
            </div>

            <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">
                {metric.description}
            </p>
        </article>
    );
}

function ProjectCard({ project }: { project: DashboardProject }) {
    return (
        <Link
            href={`/dashboard/projects/${project.id}`}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                        <FolderKanban className="size-5" />
                    </div>

                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-violet-700 dark:text-slate-100 dark:group-hover:text-violet-300">
                            {project.name}
                        </p>
                        <p className="mt-0.5 text-xs font-medium tracking-wide text-slate-400">
                            {project.key}
                        </p>
                    </div>
                </div>

                <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[project.status] ?? STATUS_STYLES.ARCHIVED}`}
                >
                    {STATUS_LABELS[project.status] ?? project.status}
                </span>
            </div>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">Project manager</span>
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {project.project_manager_name}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">Team</span>
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {project.team_name}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">Members</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                        {project.member_count}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">End date</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                        {formatDate(project.end_date)}
                    </span>
                </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                View project
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
        </Link>
    );
}

function ProjectUpdateRow({ project }: { project: DashboardProject }) {
    return (
        <Link
            href={`/dashboard/projects/${project.id}`}
            className="group flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    <FolderKanban className="size-4" />
                </div>

                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-violet-700 dark:text-slate-100 dark:group-hover:text-violet-300">
                        {project.name}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {project.key} · {project.team_name} · {project.project_manager_name}
                    </p>
                </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${STATUS_STYLES[project.status] ?? STATUS_STYLES.ARCHIVED
                        }`}
                >
                    {STATUS_LABELS[project.status] ?? project.status}
                </span>

                <span className="text-[10px] text-slate-400">
                    {formatDate(project.updated_at)}
                </span>
            </div>
        </Link>
    );
}

function TeamDistribution({
    items,
}: {
    items: {
        team_id: string;
        team_name: string;
        project_count: number;
    }[];
}) {
    const maximum = Math.max(...items.map((item) => item.project_count), 1);

    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    No team distribution available
                </p>
                <p className="mt-1 text-xs text-slate-500">
                    Active teams will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {items.map((item) => (
                <div key={item.team_id}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                            {item.team_name}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-slate-500">
                            {item.project_count}
                        </span>
                    </div>

                    <div
                        className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                        role="progressbar"
                        aria-label={`${item.team_name} project count`}
                        aria-valuemin={0}
                        aria-valuemax={maximum}
                        aria-valuenow={item.project_count}
                    >
                        <div
                            className="h-full rounded-full bg-violet-600 transition-all"
                            style={{
                                width: `${(item.project_count / maximum) * 100}%`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}


function RecentActivityFeed({
    items,
    title,
    className = "",
}: {
    items: DashboardActivity[];
    title: string;
    className?: string;
}) {
    const uniqueItems = Array.from(new Map(items.map((item) => [item.id, item])).values());

    return (
        <section className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Latest recorded ticket events
                    </p>
                </div>
                <Activity className="size-4 text-violet-600 dark:text-violet-300" />
            </div>

            {items.length === 0 ? (
                <div className={`mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-7 text-center dark:border-slate-700`}>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        No recent activity
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                        Ticket activity will appear here when work is updated.
                    </p>
                </div>
            ) : (
                <div className="mt-2 max-h-[280px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
                    {uniqueItems.map((item) => (
                        <Link
                            key={item.id}
                            href={`/dashboard/tickets/${item.ticket_id}`}
                            className={`flex items-start gap-3 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50`}
                        >
                            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                                <Activity className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                                    {item.actor_name} · {item.action.replaceAll("_", " ").toLowerCase()}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                                    {item.description || `${item.ticket_key} · ${item.ticket_title}`}
                                </span>
                                <span className="mt-1 block text-[10px] text-slate-400">
                                    {item.project_name} · {formatDateTime(item.created_at)}
                                </span>
                            </span>
                            <span className="shrink-0 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                                {item.ticket_key}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}

function UpcomingDeadlineList({
    items,
    title,
}: {
    items: DashboardDeadline[];
    title: string;
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Due within the next 30 days
                    </p>
                </div>
                <CalendarDays className="size-4 text-violet-600 dark:text-violet-300" />
            </div>

            {items.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-7 text-center dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        No upcoming deadlines
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                        Tickets with upcoming due dates will appear here.
                    </p>
                </div>
            ) : (
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((item) => (
                        <Link
                            key={item.ticket_id}
                            href={`/dashboard/tickets/${item.ticket_id}`}
                            className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                                    {item.ticket_key} · {item.title}
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                                    {item.project_name} · {item.status.replaceAll("_", " ")}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-slate-400">
                                    {item.assignee_name || item.tester_name || "Unassigned"}
                                </span>
                            </span>
                            <span className="shrink-0 text-right">
                                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                                    {formatDate(item.due_date)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    {item.priority}
                                </span>
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}

function TeamWorkloadList({ items }: { items: DashboardTeamWorkload[] }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Team workload
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Open and overdue tickets across your managed teams
                    </p>
                </div>
                <Users className="size-4 text-violet-600 dark:text-violet-300" />
            </div>

            {items.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-7 text-center dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        No team workload available
                    </p>
                </div>
            ) : (
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((item) => (
                        <div key={item.team_id} className="flex items-center justify-between gap-3 py-3">
                            <span className="min-w-0">
                                <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                                    {item.team_name}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-slate-500">
                                    {item.project_count} {item.project_count === 1 ? "project" : "projects"}
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3 text-right">
                                <span>
                                    <span className="block text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                                        {item.open_tickets}
                                    </span>
                                    <span className="block text-[10px] text-slate-400">Open</span>
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-300">
                                        {item.overdue_tickets}
                                    </span>
                                    <span className="block text-[10px] text-slate-400">Overdue</span>
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6" role="status" aria-label="Loading dashboard">
            <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 10 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
                    />
                ))}
            </div>

            <div className="h-72 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
    );
}

export default function DashboardPage() {
    const router = useRouter();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

    const dashboardQuery = useQuery({
        queryKey: ["dashboard"],
        queryFn: getDashboard,
        enabled: !isCheckingAuth && Boolean(user),
    });

    const invitationSummaryQuery = useQuery({
        queryKey: ["users", "dashboard-invitation-summary"],
        queryFn: () => getInvitations(1, 100),
        enabled: !isCheckingAuth && user?.role_code === "ADMIN",
        staleTime: 30_000,
    });

    async function handleSignOut() {
        setIsSigningOut(true);

        try {
            await signOut();
        } catch {
            // The session may already have expired.
        } finally {
            router.replace("/");

        }
    }

    if (isCheckingAuth || !user) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <p
                    className="text-sm text-slate-600 dark:text-slate-300"
                    role="status"
                    aria-live="polite"
                >
                    Verifying your session...
                </p>
            </main>
        );
    }

    const dashboard = dashboardQuery.data;
    const role = dashboard?.role_code ?? user.role_code;

    const roleContent =
        ROLE_CONTENT[role as DashboardRole] ?? ROLE_CONTENT.DEVELOPER;

    const isAdmin = role === "ADMIN";
    const projects = dashboard?.projects ?? [];
    const metrics = dashboard?.metrics ?? [];
    const invitationItems = invitationSummaryQuery.data?.items ?? [];
    const pendingInvitations = invitationItems.filter((item) => item.status === "PENDING").length;
    const acceptedInvitations = invitationItems.filter((item) => item.status === "ACCEPTED").length;
    const latestProjectUpdate = projects
        .map((project) => project.updated_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    return (
        <main className="workspace-shell flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <WorkspaceSidebar
                user={user}
                collapsed={collapsed}
                mobileOpen={mobileNavOpen}
                onMobileClose={() => setMobileNavOpen(false)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={toggleCollapsed}
                            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                            aria-expanded={!collapsed}
                            className="hidden size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 md:flex dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            <PanelLeft className="size-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="Open navigation"
                            onClick={() => setMobileNavOpen(true)}
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
                        >
                            <Menu className="size-5" />
                        </button>

                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                                Dashboard
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <WorkspaceActions user={user} lastUpdated={relativeUpdate(latestProjectUpdate)}  onSignOut={handleSignOut} isSigningOut={isSigningOut} />
                    </div>
                </header>

                <section className="flex-1 px-3 pb-3 pt-1 sm:px-3 sm:pb-3 sm:pt-1 lg:px-4 lg:pb-4 lg:pt-1">
                    <div className="mx-auto max-w-none">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                            <div>
                                <h1 className="mt-0 text-2xl font-bold tracking-tight">
                                    {roleContent.title}
                                </h1>

                                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                    {roleContent.description}
                                </p>

                                <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                                    Welcome, {user.full_name || user.email}
                                </p>
                            </div>
                        </div>

                        {dashboardQuery.isLoading ? (
                            <div className="mt-4">
                                <DashboardSkeleton />
                            </div>
                        ) : dashboardQuery.isError ? (
                            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                                <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                                    Unable to load dashboard
                                </p>
                                <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                                    {dashboardQuery.error instanceof Error
                                        ? dashboardQuery.error.message
                                        : "An unexpected error occurred."}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => dashboardQuery.refetch()}
                                    className="mt-3 text-sm font-semibold text-rose-800 underline underline-offset-2 dark:text-rose-200"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : dashboard ? (
                            <>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                                    {metrics.map((metric) => (
                                        <MetricCard key={metric.key} metric={metric} />
                                    ))}
                                    {isAdmin && (
                                        <>
                                            <InvitationSummaryCard
                                                title="Total invitations"
                                                value={invitationSummaryQuery.data?.total ?? 0}
                                                detail="All invitations recorded"
                                                icon={Send}
                                            />
                                            <InvitationSummaryCard
                                                title="Pending invitations"
                                                value={pendingInvitations}
                                                detail="Awaiting employee acceptance"
                                                icon={Clock3}
                                            />
                                            <InvitationSummaryCard
                                                title="Accepted invitations"
                                                value={acceptedInvitations}
                                                detail="Accounts created from invitations"
                                                icon={CheckCircle2}
                                            />
                                        </>
                                    )}
                                </div>

                                <div
                                    className={`mt-2 grid gap-3 ${isAdmin ? "xl:grid-cols-[1.5fr_1fr]" : "grid-cols-1"}`}
                                >
                                    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h2 className="text-sm font-semibold">
                                                    {isAdmin ? "Recent project updates" : "Your projects"}
                                                </h2>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {isAdmin
                                                        ? "Recently updated project records"
                                                        : "Projects available to your account"}
                                                </p>
                                            </div>

                                            <Link
                                                href="/dashboard/projects"
                                                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800 dark:text-violet-300"
                                            >
                                                View all
                                                <ArrowRight className="size-3.5" />
                                            </Link>
                                        </div>

                                        {projects.length > 0 ? (
                                            isAdmin ? (
                                                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                                                    {projects.map((project) => (
                                                        <ProjectUpdateRow
                                                            key={project.id}
                                                            project={project}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                    {projects.map((project) => (
                                                        <ProjectCard
                                                            key={project.id}
                                                            project={project}
                                                        />
                                                    ))}
                                                </div>
                                            )
                                        ) : (
                                            <div className="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
                                                <FolderKanban className="mx-auto size-7 text-slate-400" />
                                                <p className="mt-3 text-sm font-medium">
                                                    No projects available
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    Projects will appear here when they are assigned or created.
                                                </p>
                                            </div>
                                        )}
                                    </section>

                                    {isAdmin && (
                                        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                            <div>
                                                <h2 className="text-sm font-semibold">
                                                    Team-wise project distribution
                                                </h2>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                    Active projects grouped by team
                                                </p>
                                            </div>

                                            <div className="mt-3">
                                                <TeamDistribution
                                                    items={
                                                        dashboard.team_project_distribution
                                                    }
                                                />
                                            </div>
                                        </section>
                                    )}
                                </div>

                                <div className={`mt-2 grid gap-3 ${isAdmin ? "md:grid-cols-2" : "xl:grid-cols-2"}`}>
                                    <RecentActivityFeed
                                        items={dashboard.recent_activities ?? []}
                                        title={isAdmin ? "Recent system activity" : "Recent activity"}
                                        className={isAdmin ? "md:col-span-2" : ""}
                                    />

                                    {role === "PM" && (
                                        <TeamWorkloadList items={dashboard.team_workload ?? []} />
                                    )}

                                    {(role === "PM" || role === "DEVELOPER" || role === "TESTER") && (
                                        <UpcomingDeadlineList
                                            items={dashboard.upcoming_deadlines ?? []}
                                            title={role === "TESTER" ? "Upcoming testing deadlines" : "Upcoming deadlines"}
                                        />
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                </section>
            </div>
        </main>
    );
}
