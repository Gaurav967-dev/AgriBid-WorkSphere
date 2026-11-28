
"use client";

import {
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import {
    Activity,
    AlertCircle,
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronDown,
    Clipboard,
    Clock,
    FileText,
    History,
    Link2,
    Menu,
    PanelLeft,
    Pencil,
    RefreshCw,
    Trash2,
    Users,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";

import {
    changeTicketStatus,
    deleteTicket,
    getTicket,
    getTickets,
    updateTicket,
    type TicketPriority,
    type TicketStatus,
    type TicketType,
    type UpdateTicketInput,
} from "@/features/tickets/api/tickets-api";

import {
    getProject,
    type ProjectUser,
} from "@/features/projects/api/projects-api";

import { TicketCommentsPanel } from "@/features/tickets/components/ticket-comments-panel";
import { AttachmentsPanel } from "@/features/attachments/components/attachments-panel";

import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

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

const STATUS_STYLES: Record<TicketStatus, string> = {
    BACKLOG: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    TODO: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
    IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    IN_REVIEW: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
    TESTING: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    TESTING_DONE: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300",
    BUG_FIXED: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
    COMPLETED: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
    BLOCKED: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
    REOPENED: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950 dark:text-pink-300",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
    LOW: "text-slate-500",
    MEDIUM: "text-sky-600 dark:text-sky-400",
    HIGH: "text-orange-600 dark:text-orange-400",
    CRITICAL: "text-rose-600 dark:text-rose-400",
};

const ALL_STATUSES: TicketStatus[] = [
    "BACKLOG",
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "TESTING",
    "TESTING_DONE",
    "BUG_FIXED",
    "COMPLETED",
    "BLOCKED",
    "REOPENED",
    "CANCELLED",
];

const TYPE_LABELS: Record<TicketType, string> = {
    EPIC: "Epic",
    STORY: "Story",
    TASK: "Task",
    SUBTASK: "Subtask",
    BUG: "Bug",
    IMPROVEMENT: "Improvement",
    TECHNICAL_DEBT: "Technical debt",
};

type EditForm = {
    title: string;
    description: string;
    type: TicketType;
    priority: TicketPriority;
    assignee_id: string;
    reviewer_id: string;
    tester_id: string;
    start_date: string;
    due_date: string;
    estimated_effort: string;
    labels: string;
    parent_ticket_id: string;
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

function formatDateTime(value: string): string {
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

function displayValue(value: unknown): string {
    if (value === null || value === undefined) return "Empty";

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
}

function getActivityLabel(action: string, field?: string | null): string {
    if (action === "CREATED") return "Ticket created";
    if (action === "STATUS_CHANGED") return "Status changed";
    if (action === "DELETED") return "Ticket deleted";

    if (field) {
        return `${field.replace(/_/g, " ")} updated`;
    }

    return action.replace(/_/g, " ").toLowerCase();
}

function StatusBadge({ status }: { status: TicketStatus }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
        >
            <span className="size-1.5 rounded-full bg-current" />
            {STATUS_LABELS[status]}
        </span>
    );
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
    return (
        <span
            className={`text-sm font-semibold ${PRIORITY_STYLES[priority]}`}
        >
            {priority.charAt(0) + priority.slice(1).toLowerCase()}
        </span>
    );
}

function Card({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3.5">
            <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-violet-600 dark:text-violet-300">
                    {icon}
                </span>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                </h2>
            </div>
            {children}
        </section>
    );
}

function DetailField({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
            </p>
            <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {children}
            </div>
        </div>
    );
}

function PersonRow({
    label,
    person,
}: {
    label: string;
    person: { full_name: string; email: string } | null;
}) {
    return (
        <div className="flex items-center gap-2.5 py-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                {person?.full_name.trim().charAt(0).toUpperCase() ?? "—"}
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400">{label}</p>
                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {person?.full_name ?? "Not assigned"}
                </p>
                {person && (
                    <p className="truncate text-[10px] text-slate-400">
                        {person.email}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function TicketDetailsPage() {
    const router = useRouter();
    const params = useParams<{ ticketId: string }>();
    const queryClient = useQueryClient();

    const ticketId = params.ticketId;

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<EditForm | null>(null);
    const [editError, setEditError] = useState<string | null>(null);

    const [nextStatus, setNextStatus] = useState<TicketStatus | "">("");
    const [statusReason, setStatusReason] = useState("");
    const [showDeleteConfirmation, setShowDeleteConfirmation] =
        useState(false);

    const [pageError, setPageError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

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

    const ticketQuery = useQuery({
        queryKey: ["ticket", ticketId],
        queryFn: () => getTicket(ticketId),
        enabled: !isCheckingAuth && Boolean(user) && Boolean(ticketId),
    });

    const ticket = ticketQuery.data;

    const projectQuery = useQuery({
        queryKey: ["ticket-project-details", ticket?.project.id],
        queryFn: () => getProject(ticket!.project.id),
        enabled: Boolean(ticket),
    });

    const childrenQuery = useQuery({
        queryKey: ["ticket-children", ticket?.project.id, ticket?.id],
        queryFn: () =>
            getTickets({
                projectId: ticket!.project.id,
                page: 1,
                pageSize: 100,
                sortBy: "number",
                sortOrder: "asc",
            }),
        enabled: Boolean(ticket),
    });

    const parentQuery = useQuery({
        queryKey: ["ticket-parent", ticket?.parent_ticket_id],
        queryFn: () => getTicket(ticket!.parent_ticket_id!),
        enabled: Boolean(ticket?.parent_ticket_id),
    });

    const project = projectQuery.data;

    const projectUsers = useMemo(() => {
        if (!project) return [];

        const uniqueUsers = new Map<string, ProjectUser>();

        uniqueUsers.set(project.project_manager.id, project.project_manager);

        for (const membership of project.members) {
            uniqueUsers.set(membership.user.id, membership.user);
        }

        return Array.from(uniqueUsers.values());
    }, [project]);

    const testerUsers = projectUsers.filter(
        (member) => member.role_code === "TESTER",
    );

    const children = (childrenQuery.data?.items ?? []).filter(
        (item) => item.parent_ticket_id === ticket?.id,
    );

    const isAdmin = user?.role_code === "ADMIN";

    const isAssignedProjectManager =
        user?.role_code === "PM" &&
        Boolean(user.id) &&
        project?.project_manager.id === user?.id;

    const canManage = isAdmin || isAssignedProjectManager;

    const isAssignedDeveloper =
        user?.role_code === "DEVELOPER" &&
        ticket?.assignee?.id === user?.id;

    const isAssignedTester =
        user?.role_code === "TESTER" &&
        ticket?.tester?.id === user?.id;

    const availableTransitions = useMemo((): TicketStatus[] => {
        if (!ticket || !user) return [];

        if (canManage) {
            return ALL_STATUSES.filter(
                (status) => status !== ticket.status,
            );
        }

        if (isAssignedDeveloper) {
            const transitions: Partial<Record<TicketStatus, TicketStatus[]>> = {
                TODO: ["IN_PROGRESS"],
                IN_PROGRESS: ["IN_REVIEW"],
                REOPENED: ["IN_PROGRESS"],
            };

            return transitions[ticket.status] ?? [];
        }

        if (isAssignedTester) {
            const transitions: Partial<Record<TicketStatus, TicketStatus[]>> = {
                TESTING: ["TESTING_DONE", "BUG_FIXED", "REOPENED", "IN_PROGRESS"],
            };

            return transitions[ticket.status] ?? [];
        }

        return [];
    }, [
        ticket,
        user,
        canManage,
        isAssignedDeveloper,
        isAssignedTester,
    ]);

    const requiresStatusReason = Boolean(
        ticket &&
        nextStatus &&
        (
            (["BLOCKED", "REOPENED", "CANCELLED"] as TicketStatus[]).includes(nextStatus) ||
            ticket.status === "BLOCKED" ||
            (
                user?.role_code === "TESTER" &&
                ticket.status === "TESTING" &&
                nextStatus === "IN_PROGRESS"
            )
        )
    );

    const updateMutation = useMutation({
        mutationFn: (input: UpdateTicketInput) =>
            updateTicket(ticketId, input),

        onSuccess: async () => {
            setIsEditing(false);
            setEditForm(null);

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["ticket", ticketId],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["tickets"],
                }),
            ]);
        },
    });

    const statusMutation = useMutation({
        mutationFn: (input: {
            status: TicketStatus;
            reason?: string;
        }) =>
            changeTicketStatus(
                ticketId,
                input.status,
                input.reason,
            ),

        onSuccess: async () => {
            setNextStatus("");
            setStatusReason("");

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["ticket", ticketId],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["tickets"],
                }),
            ]);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteTicket(ticketId),

        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["tickets"],
            });

            router.push("/dashboard/tickets");
        },
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

    function startEditing() {
        if (!ticket || !canManage) return;

        setEditForm({
            title: ticket.title,
            description: ticket.description ?? "",
            type: ticket.type,
            priority: ticket.priority,
            assignee_id: ticket.assignee?.id ?? "",
            reviewer_id: ticket.reviewer?.id ?? "",
            tester_id: ticket.tester?.id ?? "",
            start_date: ticket.start_date ?? "",
            due_date: ticket.due_date ?? "",
            estimated_effort:
                ticket.estimated_effort === null
                    ? ""
                    : String(ticket.estimated_effort),
            labels: ticket.labels.join(", "),
            parent_ticket_id: ticket.parent_ticket_id ?? "",
        });

        setEditError(null);
        setIsEditing(true);
    }

    function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!ticket || !editForm) return;

        const title = editForm.title.trim();

        if (!title) {
            setEditError("Ticket title is required.");
            return;
        }

        if (
            editForm.start_date &&
            editForm.due_date &&
            editForm.due_date < editForm.start_date
        ) {
            setEditError("Due date cannot be before start date.");
            return;
        }

        const effort = editForm.estimated_effort.trim()
            ? Number(editForm.estimated_effort)
            : null;

        if (
            effort !== null &&
            (!Number.isFinite(effort) ||
                effort < 0 ||
                !/^\d{1,8}(\.\d{1,2})?$/.test(
                    editForm.estimated_effort.trim(),
                ))
        ) {
            setEditError("Enter a valid estimated effort.");
            return;
        }

        const labels = editForm.labels
            .split(/[,\n]/)
            .map((item) => item.trim())
            .filter(Boolean);

        if (
            labels.length > 20 ||
            labels.some((item) => item.length > 40)
        ) {
            setEditError(
                "Maximum 20 labels are allowed, with 40 characters each.",
            );
            return;
        }

        const input: UpdateTicketInput = {
            title,
            description: editForm.description.trim() || null,
            type: editForm.type,
            priority: editForm.priority,
            assignee_id: editForm.assignee_id || null,
            reviewer_id: editForm.reviewer_id || null,
            tester_id: editForm.tester_id || null,
            start_date: editForm.start_date || null,
            due_date: editForm.due_date || null,
            estimated_effort: effort,
            labels,
            parent_ticket_id: editForm.parent_ticket_id || null,
        };

        setEditError(null);
        updateMutation.mutate(input);
    }

    async function handleCopyLink() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setPageError(null);
        } catch {
            setPageError("Unable to copy the ticket URL.");
        }
    }

    if (isCheckingAuth || !user || ticketQuery.isLoading) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div
                    className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
                    role="status"
                >
                    <RefreshCw className="size-4 animate-spin" />
                    Loading ticket details...
                </div>
            </main>
        );
    }

    if (ticketQuery.isError || !ticket) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
                <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <AlertCircle className="mx-auto size-10 text-rose-500" />
                    <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                        Unable to load ticket
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {ticketQuery.error instanceof Error
                            ? ticketQuery.error.message
                            : "The ticket could not be found or you do not have access."}
                    </p>
                    <Link
                        href="/dashboard/tickets"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
                    >
                        <ArrowLeft className="size-4" />
                        Back to tickets
                    </Link>
                </section>
            </main>
        );
    }

    const overdue =
        Boolean(ticket.due_date) &&
        !["COMPLETED", "CANCELLED"].includes(ticket.status) &&
        new Date(`${ticket.due_date}T00:00:00`) <
        new Date(new Date().setHours(0, 0, 0, 0));

    const mutationError =
        updateMutation.error ??
        statusMutation.error ??
        deleteMutation.error;

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
                            aria-label={
                                collapsed ? "Expand sidebar" : "Collapse sidebar"
                            }
                            aria-expanded={!collapsed}
                            className="hidden size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:flex dark:text-slate-300 dark:hover:bg-slate-800"
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
                                {ticket.ticket_key}
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <WorkspaceActions user={user}  onSignOut={handleSignOut} isSigningOut={isSigningOut} />
                    </div>
                </header>

                <section className="flex-1 px-3 pb-3 pt-1 sm:px-3 sm:pb-3 sm:pt-1 lg:px-4 lg:pb-4 lg:pt-1">
                    <div className="w-full max-w-none">
                        <Link
                            href="/dashboard/tickets"
                            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300"
                        >
                            <ArrowLeft className="size-3.5" />
                            Back to tickets
                        </Link>

                        <div className="mt-2.5 flex flex-col justify-between gap-2.5 lg:flex-row lg:items-start">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-md bg-violet-50 px-2.5 py-1 font-mono text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                        {ticket.ticket_key}
                                    </span>
                                    <StatusBadge status={ticket.status} />
                                    <PriorityBadge priority={ticket.priority} />
                                </div>

                                <h1 className="mt-1.5 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                                    {ticket.title}
                                </h1>

                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {ticket.project.key} · {ticket.project.name}
                                    {" · "}
                                    {TYPE_LABELS[ticket.type]}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => void handleCopyLink()}
                                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    {copied ? (
                                        <Check className="size-3.5" />
                                    ) : (
                                        <Link2 className="size-3.5" />
                                    )}
                                    {copied ? "Copied" : "Copy link"}
                                </button>

                                {canManage && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={startEditing}
                                            disabled={projectQuery.isLoading}
                                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            <Pencil className="size-3.5" />
                                            Edit
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setShowDeleteConfirmation(true)}
                                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                        >
                                            <Trash2 className="size-3.5" />
                                            Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {(pageError || mutationError) && (
                            <div
                                role="alert"
                                className="mt-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                            >
                                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                {pageError ||
                                    (mutationError instanceof Error
                                        ? mutationError.message
                                        : "The operation could not be completed.")}
                            </div>
                        )}

                        {isEditing && editForm && (
                            <Card
                                title="Edit ticket"
                                icon={<Pencil className="size-4" />}
                            >
                                <form
                                    onSubmit={handleEditSubmit}
                                    className="space-y-3"
                                >
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="sm:col-span-2">
                                            <label className="text-xs font-semibold">
                                                Title
                                            </label>
                                            <input
                                                required
                                                maxLength={255}
                                                value={editForm.title}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        title: event.target.value,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="text-xs font-semibold">
                                                Description
                                            </label>
                                            <textarea
                                                maxLength={10000}
                                                value={editForm.description}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        description: event.target.value,
                                                    })
                                                }
                                                className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold">
                                                Type
                                            </label>
                                            <select
                                                value={editForm.type}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        type: event.target.value as TicketType,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                {Object.entries(TYPE_LABELS).map(
                                                    ([value, label]) => (
                                                        <option key={value} value={value}>
                                                            {label}
                                                        </option>
                                                    ),
                                                )}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold">
                                                Priority
                                            </label>
                                            <select
                                                value={editForm.priority}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        priority: event.target.value as TicketPriority,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                <option value="LOW">Low</option>
                                                <option value="MEDIUM">Medium</option>
                                                <option value="HIGH">High</option>
                                                <option value="CRITICAL">Critical</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold">
                                                Assignee
                                            </label>
                                            <select
                                                value={editForm.assignee_id}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        assignee_id: event.target.value,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                <option value="">Unassigned</option>
                                                {projectUsers.map((member) => (
                                                    <option key={member.id} value={member.id}>
                                                        {member.full_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold">
                                                Reviewer
                                            </label>
                                            <select
                                                value={editForm.reviewer_id}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        reviewer_id: event.target.value,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                <option value="">Not assigned</option>
                                                {projectUsers.map((member) => (
                                                    <option key={member.id} value={member.id}>
                                                        {member.full_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold">
                                                Tester
                                            </label>
                                            <select
                                                value={editForm.tester_id}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        tester_id: event.target.value,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                <option value="">Not assigned</option>
                                                {testerUsers.map((member) => (
                                                    <option key={member.id} value={member.id}>
                                                        {member.full_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold">
                                                Start date
                                            </label>
                                            <input
                                                type="date"
                                                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)}
                                                value={editForm.start_date}
                                                max={editForm.due_date || undefined}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        start_date: event.target.value,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold">
                                                Due date
                                            </label>
                                            <input
                                                type="date"
                                                value={editForm.due_date}
                                                min={editForm.start_date || undefined}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        due_date: event.target.value,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold">
                                                Estimated effort (hours)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.25"
                                                value={editForm.estimated_effort}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        estimated_effort: event.target.value,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold">
                                                Parent ticket
                                            </label>
                                            <select
                                                value={editForm.parent_ticket_id}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        parent_ticket_id: event.target.value,
                                                    })
                                                }
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                <option value="">No parent</option>
                                                {(childrenQuery.data?.items ?? [])
                                                    .filter(
                                                        (item) =>
                                                            item.id !== ticket.id &&
                                                            item.type !== "SUBTASK",
                                                    )
                                                    .map((item) => (
                                                        <option
                                                            key={item.id}
                                                            value={item.id}
                                                        >
                                                            {item.ticket_key} — {item.title}
                                                        </option>
                                                    ))}
                                                {parentQuery.data && (
                                                    <option value={parentQuery.data.id}>
                                                        {parentQuery.data.ticket_key} — {parentQuery.data.title}
                                                    </option>
                                                )}
                                            </select>
                                            {childrenQuery.isError && (
                                                <p className="mt-1 text-[10px] text-amber-600">
                                                    Unable to load parent ticket options.
                                                </p>
                                            )}
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="text-xs font-semibold">
                                                Labels
                                            </label>
                                            <input
                                                value={editForm.labels}
                                                onChange={(event) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        labels: event.target.value,
                                                    })
                                                }
                                                placeholder="frontend, backend, bug"
                                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>
                                    </div>

                                    {editError && (
                                        <p
                                            role="alert"
                                            className="text-sm text-rose-600"
                                        >
                                            {editError}
                                        </p>
                                    )}

                                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditing(false);
                                                setEditForm(null);
                                                setEditError(null);
                                            }}
                                            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold dark:border-slate-700"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={updateMutation.isPending}
                                            className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                                        >
                                            {updateMutation.isPending && (
                                                <RefreshCw className="size-3.5 animate-spin" />
                                            )}
                                            Save changes
                                        </button>
                                    </div>
                                </form>
                            </Card>
                        )}

                        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
                            <div className="min-w-0 space-y-2.5">
                                <Card
                                    title="Description"
                                    icon={<FileText className="size-4" />}
                                >
                                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                                        {ticket.description ||
                                            "No description has been provided."}
                                    </p>

                                    {ticket.labels.length > 0 && (
                                        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                Labels
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {ticket.labels.map((label, index) => (
                                                    <span
                                                        key={`${label}-${index}`}
                                                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                    >
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Card>

                                <Card
                                    title="Attachments and GitHub links"
                                    icon={<Link2 className="size-4" />}
                                >
                                    <div className="space-y-3">
                                        <AttachmentsPanel projectId={ticket.project.id} ticketId={ticket.id} />

                                        <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center dark:border-slate-700">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                GitHub integration is not connected yet
                                            </p>
                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                Branch, commit and pull-request links require
                                                the GitHub linking module.
                                            </p>
                                        </div>
                                    </div>
                                </Card>

<Card
                                    title="Comments and collaboration"
                                    icon={<Users className="size-4" />}
                                >
                                    <TicketCommentsPanel
                                        ticketId={ticketId}
                                        projectUsers={projectUsers}
                                        currentUser={user}
                                        canModerate={canManage}
                                    />
                                </Card>

<Card
                                    title="Activity history"
                                    icon={<History className="size-4" />}
                                >
                                    {ticket.activities.length === 0 ? (
                                        <p className="py-6 text-center text-xs text-slate-400">
                                            No activity has been recorded yet.
                                        </p>
                                    ) : (
                                        <div className="relative space-y-2">
                                            {[...ticket.activities]
                                                .reverse()
                                                .map((activity) => (
                                                    <div
                                                        key={activity.id}
                                                        className="relative flex gap-2.5"
                                                    >
                                                        <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300">
                                                            <Activity className="size-3.5" />
                                                        </div>

                                                        <div className="min-w-0 flex-1 border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                                    {getActivityLabel(
                                                                        activity.action,
                                                                        activity.field_name,
                                                                    )}
                                                                </p>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {formatDateTime(activity.created_at)}
                                                                </span>
                                                            </div>

                                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                {activity.actor.full_name}
                                                            </p>

                                                            {activity.old_value !== null ||
                                                                activity.new_value !== null ? (
                                                                <div className="mt-1.5 rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-800/70">
                                                                    {activity.old_value !== null && (
                                                                        <p className="break-words text-slate-500">
                                                                            Previous: {displayValue(activity.old_value)}
                                                                        </p>
                                                                    )}
                                                                    {activity.new_value !== null && (
                                                                        <p className="mt-1 break-words font-medium text-slate-700 dark:text-slate-200">
                                                                            New: {displayValue(activity.new_value)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ) : null}

                                                            {activity.description && (
                                                                <p className="mt-2 break-words text-xs text-slate-500 dark:text-slate-400">
                                                                    {activity.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </Card>
                            </div>

                            <aside className="min-w-0 space-y-2.5">
                                <Card
                                    title="Ticket information"
                                    icon={<Clipboard className="size-4" />}
                                >
                                    <div className="grid grid-cols-2 gap-3">
                                        <DetailField label="Ticket type">
                                            {TYPE_LABELS[ticket.type]}
                                        </DetailField>

                                        <DetailField label="Priority">
                                            <PriorityBadge priority={ticket.priority} />
                                        </DetailField>

                                        <DetailField label="Project">
                                            <Link
                                                href="/dashboard/projects"
                                                className="font-semibold text-violet-700 hover:underline dark:text-violet-300"
                                            >
                                                {ticket.project.key}
                                            </Link>
                                        </DetailField>

                                        <DetailField label="Estimated effort">
                                            {ticket.estimated_effort === null
                                                ? "Not set"
                                                : `${ticket.estimated_effort} hours`}
                                        </DetailField>

                                        <DetailField label="Start date">
                                            {formatDate(ticket.start_date)}
                                        </DetailField>

                                        <DetailField label="Due date">
                                            <span
                                                className={
                                                    overdue
                                                        ? "font-semibold text-rose-600"
                                                        : ""
                                                }
                                            >
                                                {formatDate(ticket.due_date)}
                                            </span>
                                            {overdue && (
                                                <span className="mt-1 block text-[10px] font-semibold text-rose-600">
                                                    Overdue
                                                </span>
                                            )}
                                        </DetailField>

                                        <DetailField label="Created">
                                            {formatDate(ticket.created_at)}
                                        </DetailField>

                                        <DetailField label="Last updated">
                                            {formatDate(ticket.updated_at)}
                                        </DetailField>
                                        <DetailField label="Completed date">
                                            {formatDate(ticket.completed_at)}
                                        </DetailField>
                                    </div>
                                </Card>

<Card
                                    title="Workflow"
                                    icon={<Activity className="size-4" />}
                                >
                                    <div className="space-y-2.5">
                                        <div>
                                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                Current status
                                            </p>
                                            <StatusBadge status={ticket.status} />
                                        </div>

                                        {availableTransitions.length > 0 ? (
                                            <div className="border-t border-slate-100 pt-2.5 dark:border-slate-800">
                                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    Move ticket to
                                                </label>

                                                <select
                                                    value={nextStatus}
                                                    onChange={(event) =>
                                                        setNextStatus(
                                                            event.target.value as TicketStatus | "",
                                                        )
                                                    }
                                                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                                                >
                                                    <option value="">
                                                        Select next status
                                                    </option>
                                                    {availableTransitions.map((status) => (
                                                        <option key={status} value={status}>
                                                            {STATUS_LABELS[status]}
                                                        </option>
                                                    ))}
                                                </select>

                                                <label className="mt-2 block text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    Reason / comment {requiresStatusReason ? "(required)" : "(optional)"}
                                                </label>
                                                <textarea
                                                    value={statusReason}
                                                    maxLength={1000}
                                                    onChange={(event) =>
                                                        setStatusReason(event.target.value)
                                                    }
                                                    placeholder={requiresStatusReason ? "Enter a reason or comment" : "Add a reason or transition note"}
                                                    aria-required={requiresStatusReason}
                                                    className="mt-1.5 min-h-16 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                                                />

                                                <button
                                                    type="button"
                                                    disabled={
                                                        !nextStatus ||
                                                        statusMutation.isPending ||
                                                        (requiresStatusReason && !statusReason.trim())
                                                    }
                                                    onClick={() => {
                                                        if (!nextStatus) return;

                                                        statusMutation.mutate({
                                                            status: nextStatus,
                                                            reason:
                                                                statusReason.trim() || undefined,
                                                        });
                                                    }}
                                                    className="mt-1.5 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {statusMutation.isPending ? (
                                                        <RefreshCw className="size-3.5 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="size-3.5" />
                                                    )}
                                                    Update status
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                                No status transition is currently available
                                                for your role and ticket assignment.
                                            </p>
                                        )}

                                        <p className="text-[10px] leading-5 text-slate-400">
                                            The backend validates every status transition.
                                        </p>
                                    </div>
                                </Card>

<Card
                                    title="People"
                                    icon={<Users className="size-4" />}
                                >
                                    <PersonRow
                                        label="Assignee"
                                        person={ticket.assignee}
                                    />
                                    <PersonRow
                                        label="Reporter"
                                        person={ticket.reporter}
                                    />
                                    <PersonRow
                                        label="Reviewer"
                                        person={ticket.reviewer}
                                    />
                                    <PersonRow
                                        label="Tester"
                                        person={ticket.tester}
                                    />
                                </Card>

<Card
                                    title="Parent and child tickets"
                                    icon={<ChevronDown className="size-4" />}
                                >
                                    {ticket.parent_ticket_id ? (
                                        parentQuery.isLoading ? (
                                            <p className="text-xs text-slate-400">
                                                Loading parent ticket...
                                            </p>
                                        ) : parentQuery.data ? (
                                            <Link
                                                href={`/dashboard/tickets/${parentQuery.data.id}`}
                                                className="block rounded-lg border border-slate-200 p-2.5 hover:border-violet-300 dark:border-slate-700 dark:hover:border-violet-700"
                                            >
                                                <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                                                    Parent ticket
                                                </p>
                                                <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                    {parentQuery.data.ticket_key}
                                                </p>
                                                <p className="mt-1 truncate text-xs text-slate-500">
                                                    {parentQuery.data.title}
                                                </p>
                                            </Link>
                                        ) : (
                                            <p className="text-xs text-slate-400">
                                                Parent ticket could not be loaded.
                                            </p>
                                        )
                                    ) : (
                                        <p className="text-xs text-slate-400">
                                            No parent ticket.
                                        </p>
                                    )}

                                    <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                            Child tickets ({children.length})
                                        </p>

                                        {childrenQuery.isLoading ? (
                                            <p className="text-xs text-slate-400">
                                                Loading child tickets...
                                            </p>
                                        ) : childrenQuery.isError ? (
                                            <p className="text-xs text-rose-500">
                                                Unable to load child tickets.
                                            </p>
                                        ) : children.length === 0 ? (
                                            <p className="text-xs text-slate-400">
                                                No child tickets.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {children.map((child) => (
                                                    <Link
                                                        key={child.id}
                                                        href={`/dashboard/tickets/${child.id}`}
                                                        className="block rounded-lg border border-slate-200 p-2.5 hover:border-violet-300 dark:border-slate-700 dark:hover:border-violet-700"
                                                    >
                                                        <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                                                            {child.ticket_key}
                                                        </p>
                                                        <p className="mt-1 truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                                                            {child.title}
                                                        </p>
                                                        <div className="mt-2">
                                                            <StatusBadge status={child.status} />
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Card>


                            </aside>
                        </div>
                    </div>
                </section>
            </div>

            {showDeleteConfirmation && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setShowDeleteConfirmation(false);
                        }
                    }}
                >
                    <section
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="delete-ticket-title"
                        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="flex size-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                            <Trash2 className="size-5" />
                        </div>

                        <h2
                            id="delete-ticket-title"
                            className="mt-4 text-lg font-bold text-slate-900 dark:text-white"
                        >
                            Delete {ticket.ticket_key}?
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            This ticket will be soft-deleted and removed from
                            normal ticket listings. Its existing activity
                            history will be preserved.
                        </p>

                        <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                            <button
                                type="button"
                                onClick={() =>
                                    setShowDeleteConfirmation(false)
                                }
                                className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate()}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                                {deleteMutation.isPending && (
                                    <RefreshCw className="size-3.5 animate-spin" />
                                )}
                                Delete ticket
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}