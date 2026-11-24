"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    AlertCircle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    FileText,
    Menu,
    PanelLeft,
    Plus,
    RefreshCw,
    Search,
    X,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";
import {
    getTickets,
    type Ticket,
    type TicketPriority,
    type TicketStatus,
    type TicketType,
} from "@/features/tickets/api/tickets-api";
import { getProjects } from "@/features/projects/api/projects-api";
import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { label: string; value: TicketStatus | "ALL" }[] = [
    { label: "All statuses", value: "ALL" },
    { label: "Backlog", value: "BACKLOG" },
    { label: "To do", value: "TODO" },
    { label: "In progress", value: "IN_PROGRESS" },
    { label: "In review", value: "IN_REVIEW" },
    { label: "Testing", value: "TESTING" },
    { label: "Testing done", value: "TESTING_DONE" },
    { label: "Bug fixed", value: "BUG_FIXED" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Blocked", value: "BLOCKED" },
    { label: "Reopened", value: "REOPENED" },
    { label: "Cancelled", value: "CANCELLED" },
];

const PRIORITY_OPTIONS: { label: string; value: TicketPriority | "ALL" }[] = [
    { label: "All priorities", value: "ALL" },
    { label: "Low", value: "LOW" },
    { label: "Medium", value: "MEDIUM" },
    { label: "High", value: "HIGH" },
    { label: "Critical", value: "CRITICAL" },
];

const TYPE_OPTIONS: { label: string; value: TicketType | "ALL" }[] = [
    { label: "All types", value: "ALL" },
    { label: "Epic", value: "EPIC" },
    { label: "Story", value: "STORY" },
    { label: "Task", value: "TASK" },
    { label: "Subtask", value: "SUBTASK" },
    { label: "Bug", value: "BUG" },
    { label: "Improvement", value: "IMPROVEMENT" },
    { label: "Technical debt", value: "TECHNICAL_DEBT" },
];

const STATUS_STYLES: Record<TicketStatus, string> = {
    BACKLOG: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    TODO: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
    IN_REVIEW: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
    TESTING: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    TESTING_DONE: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
    BUG_FIXED: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
    COMPLETED: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
    BLOCKED: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    REOPENED: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-300",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
    LOW: "text-slate-500",
    MEDIUM: "text-sky-600 dark:text-sky-400",
    HIGH: "text-orange-600 dark:text-orange-400",
    CRITICAL: "text-rose-600 dark:text-rose-400",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
    BACKLOG: "Backlog",
    TODO: "To do",
    IN_PROGRESS: "In progress",
    IN_REVIEW: "In review",
    TESTING: "Testing",
    TESTING_DONE: "Testing done",
    BUG_FIXED: "Bug fixed",
    COMPLETED: "Completed",
    BLOCKED: "Blocked",
    REOPENED: "Reopened",
    CANCELLED: "Cancelled",
};

const TYPE_LABELS: Record<TicketType, string> = {
    EPIC: "Epic",
    STORY: "Story",
    TASK: "Task",
    SUBTASK: "Subtask",
    BUG: "Bug",
    IMPROVEMENT: "Improvement",
    TECHNICAL_DEBT: "Technical debt",
};

function formatDate(value: string | null): string {
    if (!value) return "No due date";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return "No due date";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function isOverdue(ticket: Ticket): boolean {
    if (
        !ticket.due_date ||
        ["COMPLETED", "CANCELLED"].includes(ticket.status)
    ) {
        return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(`${ticket.due_date}T00:00:00`);
    return due < today;
}

function StatusBadge({ status }: { status: TicketStatus }) {
    return (
        <span
            className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
        >
            <span className="mr-1.5 size-1.5 rounded-full bg-current" />
            {STATUS_LABELS[status]}
        </span>
    );
}

function PriorityLabel({ priority }: { priority: TicketPriority }) {
    return (
        <span className={`text-xs font-semibold ${PRIORITY_STYLES[priority]}`}>
            {priority.charAt(0) + priority.slice(1).toLowerCase()}
        </span>
    );
}

function TicketRow({ ticket }: { ticket: Ticket }) {
    const overdue = isOverdue(ticket);

    return (
        <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40">
            <td className="px-4 py-4">
                <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
                >
                    {ticket.ticket_key}
                </Link>
            </td>

            <td className="min-w-[230px] px-4 py-4">
                <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="block max-w-sm truncate text-sm font-semibold text-slate-800 hover:text-violet-700 dark:text-slate-100 dark:hover:text-violet-300"
                >
                    {ticket.title}
                </Link>
                <p className="mt-1 text-[11px] text-slate-400">
                    {ticket.project.key} · {TYPE_LABELS[ticket.type]}
                </p>
            </td>

            <td className="px-4 py-4">
                <PriorityLabel priority={ticket.priority} />
            </td>

            <td className="px-4 py-4">
                <StatusBadge status={ticket.status} />
            </td>

            <td className="px-4 py-4">
                <div className="flex min-w-[130px] items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        {ticket.assignee?.full_name.charAt(0).toUpperCase() ?? "—"}
                    </span>
                    <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                        {ticket.assignee?.full_name ?? "Unassigned"}
                    </span>
                </div>
            </td>

            <td className="whitespace-nowrap px-4 py-4">
                <span
                    className={`flex items-center gap-1.5 text-xs ${overdue
                        ? "font-semibold text-rose-600 dark:text-rose-400"
                        : "text-slate-500 dark:text-slate-400"
                        }`}
                >
                    <CalendarDays className="size-3.5" />
                    {formatDate(ticket.due_date)}
                </span>
                {overdue && (
                    <span className="ml-5 text-[10px] font-semibold text-rose-600">
                        Overdue
                    </span>
                )}
            </td>
        </tr>
    );
}

export default function TicketsPage() {
    const router = useRouter();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<TicketStatus | "ALL">("ALL");
    const [priority, setPriority] = useState<TicketPriority | "ALL">("ALL");
    const [ticketType, setTicketType] = useState<TicketType | "ALL">("ALL");
    const [projectId, setProjectId] = useState("ALL");
    const [sortBy, setSortBy] = useState<
        "created_at" | "updated_at" | "due_date" | "priority" | "title"
    >("updated_at");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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

    const projectsQuery = useQuery({
        queryKey: ["ticket-project-filter-options"],
        queryFn: () =>
            getProjects({
                page: 1,
                pageSize: 100,
                status: "ALL",
            }),
        enabled: !isCheckingAuth && Boolean(user),
    });

    const ticketsQuery = useQuery({
        queryKey: [
            "tickets",
            page,
            PAGE_SIZE,
            search,
            status,
            priority,
            ticketType,
            projectId,
            sortBy,
            sortOrder,
        ],
        queryFn: () =>
            getTickets({
                page,
                pageSize: PAGE_SIZE,
                search,
                status: status === "ALL" ? undefined : status,
                priority: priority === "ALL" ? undefined : priority,
                ticketType: ticketType === "ALL" ? undefined : ticketType,
                projectId: projectId === "ALL" ? undefined : projectId,
                sortBy,
                sortOrder,
            }),
        enabled: !isCheckingAuth && Boolean(user),
    });

    const tickets = ticketsQuery.data?.items ?? [];
    const totalTickets = ticketsQuery.data?.total ?? 0;
    const totalPages = Math.max(1, ticketsQuery.data?.total_pages ?? 1);
    const projects = projectsQuery.data?.items ?? [];

    const canCreateTicket =
        user?.role_code === "ADMIN" || user?.role_code === "PM";

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

    function resetPage() {
        setPage(1);
    }

    function clearFilters() {
        setSearch("");
        setStatus("ALL");
        setPriority("ALL");
        setTicketType("ALL");
        setProjectId("ALL");
        setSortBy("updated_at");
        setSortOrder("desc");
        setPage(1);
    }

    if (isCheckingAuth || !user) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <p className="text-sm text-slate-600 dark:text-slate-300" role="status">
                    Verifying your session...
                </p>
            </main>
        );
    }

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
                            <p className="truncate text-sm font-semibold">Tasks</p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <WorkspaceActions user={user}  onSignOut={handleSignOut} isSigningOut={isSigningOut} />
                    </div>
                </header>

                <section className="flex-1 px-3 pb-3 pt-1 sm:px-3 sm:pb-3 sm:pt-1 lg:px-4 lg:pb-4 lg:pt-1">
                    <div className="w-full max-w-none">
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h1 className="mt-0 text-2xl font-bold tracking-tight">
                                    Tickets
                                </h1>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    View, search and track project tasks and development work.
                                </p>
                            </div>

                            {canCreateTicket && (
                                <Link
                                    href="/dashboard/tickets/new"
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800"
                                >
                                    <Plus className="size-4" />
                                    Create ticket
                                </Link>
                            )}
                        </div>

                        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <FileText className="size-4 text-violet-600" />
                                    <span>
                                        <strong className="font-semibold text-slate-900 dark:text-white">
                                            {totalTickets}
                                        </strong>{" "}
                                        {totalTickets === 1 ? "ticket" : "tickets"}
                                    </span>
                                </div>

                                <div className="relative w-full lg:max-w-xs">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) => {
                                            setSearch(event.target.value);
                                            resetPage();
                                        }}
                                        placeholder="Search ticket ID or title..."
                                        aria-label="Search tickets"
                                        className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-violet-950"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearch("");
                                                resetPage();
                                            }}
                                            aria-label="Clear search"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                                <select
                                    value={projectId}
                                    onChange={(event) => {
                                        setProjectId(event.target.value);
                                        resetPage();
                                    }}
                                    aria-label="Filter by project"
                                    className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    <option value="ALL">All projects</option>
                                    {projects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.key} — {project.name}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={status}
                                    onChange={(event) => {
                                        setStatus(event.target.value as TicketStatus | "ALL");
                                        resetPage();
                                    }}
                                    aria-label="Filter by status"
                                    className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    {STATUS_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={priority}
                                    onChange={(event) => {
                                        setPriority(event.target.value as TicketPriority | "ALL");
                                        resetPage();
                                    }}
                                    aria-label="Filter by priority"
                                    className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    {PRIORITY_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={ticketType}
                                    onChange={(event) => {
                                        setTicketType(event.target.value as TicketType | "ALL");
                                        resetPage();
                                    }}
                                    aria-label="Filter by ticket type"
                                    className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    {TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={`${sortBy}:${sortOrder}`}
                                    onChange={(event) => {
                                        const [nextSort, nextOrder] = event.target.value.split(":");
                                        setSortBy(nextSort as typeof sortBy);
                                        setSortOrder(nextOrder as "asc" | "desc");
                                        resetPage();
                                    }}
                                    aria-label="Sort tickets"
                                    className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    <option value="updated_at:desc">Recently updated</option>
                                    <option value="created_at:desc">Newest created</option>
                                    <option value="created_at:asc">Oldest created</option>
                                    <option value="due_date:asc">Earliest due date</option>
                                    <option value="priority:desc">Priority</option>
                                    <option value="title:asc">Title A–Z</option>
                                </select>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-violet-700 dark:hover:text-violet-300"
                                >
                                    Clear filters
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        void ticketsQuery.refetch();
                                        void projectsQuery.refetch();
                                    }}
                                    disabled={ticketsQuery.isFetching}
                                    className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    <RefreshCw
                                        className={`size-3.5 ${ticketsQuery.isFetching ? "animate-spin" : ""}`}
                                    />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {ticketsQuery.isError && (
                            <div className="mt-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                                <AlertCircle className="mt-0.5 size-5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold">
                                        Unable to load tickets
                                    </p>
                                    <p className="mt-1 text-sm">
                                        {ticketsQuery.error instanceof Error
                                            ? ticketsQuery.error.message
                                            : "An unexpected error occurred."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => ticketsQuery.refetch()}
                                        className="mt-2 text-sm font-semibold underline underline-offset-2"
                                    >
                                        Try again
                                    </button>
                                </div>
                            </div>
                        )}

                        {ticketsQuery.isLoading ? (
                            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                {Array.from({ length: 7 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="h-12 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800"
                                    />
                                ))}
                            </div>
                        ) : !ticketsQuery.isError && tickets.length === 0 ? (
                            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
                                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                                    <FileText className="size-6" />
                                </div>
                                <h2 className="mt-4 text-base font-semibold">
                                    {search ||
                                        status !== "ALL" ||
                                        priority !== "ALL" ||
                                        ticketType !== "ALL" ||
                                        projectId !== "ALL"
                                        ? "No matching tickets"
                                        : "No tickets yet"}
                                </h2>
                                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
                                    {search ||
                                        status !== "ALL" ||
                                        priority !== "ALL" ||
                                        ticketType !== "ALL" ||
                                        projectId !== "ALL"
                                        ? "Try changing your search or filters."
                                        : "Tickets created in your projects will appear here."}
                                </p>
                                {canCreateTicket && (
                                    <Link
                                        href="/dashboard/tickets/new"
                                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
                                    >
                                        <Plus className="size-4" />
                                        Create your first ticket
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[950px] border-collapse text-left">
                                            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                                                <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                    <th className="px-4 py-3">Ticket</th>
                                                    <th className="px-4 py-3">Title / Project</th>
                                                    <th className="px-4 py-3">Priority</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3">Assignee</th>
                                                    <th className="px-4 py-3">Due date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tickets.map((ticket) => (
                                                    <TicketRow
                                                        key={ticket.id}
                                                        ticket={ticket}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Page {page} of {totalPages} · {totalTickets} total tickets
                                        </p>

                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPage((current) => Math.max(1, current - 1))
                                                }
                                                disabled={page <= 1 || ticketsQuery.isFetching}
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                <ChevronLeft className="size-3.5" />
                                                Previous
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setPage((current) =>
                                                        Math.min(totalPages, current + 1),
                                                    )
                                                }
                                                disabled={
                                                    page >= totalPages || ticketsQuery.isFetching
                                                }
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                            >
                                                Next
                                                <ChevronRight className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}