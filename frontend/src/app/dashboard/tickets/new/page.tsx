
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    ArrowLeft,
    CalendarDays,
    FileText,
    Menu,
    PanelLeft,
    Plus,
    RefreshCw,
    ShieldCheck,
    Tag,
    Users,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";

import {
    getProjects,
    getProject,
    type ProjectUser,
} from "@/features/projects/api/projects-api";

import {
    createTicket,
    getTickets,
    type CreateTicketInput,
    type TicketPriority,
    type TicketType,
} from "@/features/tickets/api/tickets-api";

import { WorkspaceActions } from "@/components/workspace-actions";
import { todayDateInputValue } from "@/lib/date-utils";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

type FormState = {
    project_id: string;
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

const INITIAL_FORM: FormState = {
    project_id: "",
    title: "",
    description: "",
    type: "TASK",
    priority: "MEDIUM",
    assignee_id: "",
    reviewer_id: "",
    tester_id: "",
    start_date: "",
    due_date: "",
    estimated_effort: "",
    labels: "",
    parent_ticket_id: "",
};

const INPUT_CLASS =
    "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-violet-950 dark:disabled:bg-slate-900";

const TEXTAREA_CLASS =
    "mt-1.5 min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-violet-950";

const LABEL_CLASS =
    "text-xs font-semibold text-slate-700 dark:text-slate-300";

const USER_ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    PM: "Project Manager",
    DEVELOPER: "Developer",
    TESTER: "Tester",
};

function FormSection({
    title,
    description,
    icon,
    children,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3">
            <div className="mb-3 flex items-start gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                    {icon}
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {title}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                {children}
            </div>
        </section>
    );
}

export default function CreateTicketPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [formError, setFormError] = useState<string | null>(null);

    const { collapsed, toggleCollapsed } = useWorkspaceSidebarState();

    const canCreateTicket =
        user?.role_code === "ADMIN" || user?.role_code === "PM";

    function updateField<K extends keyof FormState>(
        field: K,
        value: FormState[K],
    ) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));

        setFormError(null);
    }

    // Verify the session before loading project data.
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

    // Only load projects after authentication.
    const projectsQuery = useQuery({
        queryKey: ["ticket-create-projects"],
        queryFn: () =>
            getProjects({
                page: 1,
                pageSize: 100,
                status: "ALL",
            }),
        enabled: !isCheckingAuth && canCreateTicket,
    });

    // Load members and project manager for the selected project.
    const selectedProjectQuery = useQuery({
        queryKey: ["ticket-create-project", form.project_id],
        queryFn: () => getProject(form.project_id),
        enabled: Boolean(form.project_id) && Boolean(canCreateTicket),
    });

    // Load eligible parent tickets from the selected project.
    const parentTicketsQuery = useQuery({
        queryKey: ["ticket-create-parents", form.project_id],
        queryFn: () =>
            getTickets({
                projectId: form.project_id,
                page: 1,
                pageSize: 100,
                sortBy: "number",
                sortOrder: "asc",
            }),
        enabled: Boolean(form.project_id) && Boolean(canCreateTicket),
    });

    const projects = (projectsQuery.data?.items ?? []).filter(
        (project) =>
            project.archived_at === null && project.status !== "ARCHIVED",
    );

    const projectDetails = selectedProjectQuery.data;

    // Include the project manager even if they are not in the members array.
    const projectUsers = useMemo(() => {
        if (!projectDetails) return [];

        const uniqueUsers = new Map<string, ProjectUser>();

        uniqueUsers.set(
            projectDetails.project_manager.id,
            projectDetails.project_manager,
        );

        for (const member of projectDetails.members) {
            uniqueUsers.set(member.user.id, member.user);
        }

        return Array.from(uniqueUsers.values());
    }, [projectDetails]);

    const testerUsers = useMemo(
        () => projectUsers.filter((member) => member.role_code === "TESTER"),
        [projectUsers],
    );

    const parentTickets = (parentTicketsQuery.data?.items ?? []).filter(
        (ticket) => ticket.type !== "SUBTASK",
    );

    const createMutation = useMutation({
        mutationFn: (input: CreateTicketInput) => createTicket(input),

        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["tickets"],
            });

            router.push("/dashboard/tickets");
            router.refresh();
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
            router.refresh();
        }
    }

    function handleProjectChange(projectId: string) {
        setForm((current) => ({
            ...current,
            project_id: projectId,
            assignee_id: "",
            reviewer_id: "",
            tester_id: "",
            parent_ticket_id: "",
        }));

        setFormError(null);
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError(null);

        if (!form.project_id) {
            setFormError("Please select a project.");
            return;
        }

        if (!form.title.trim()) {
            setFormError("Ticket title is required.");
            return;
        }

        if (form.title.trim().length > 255) {
            setFormError("Ticket title cannot exceed 255 characters.");
            return;
        }

        if (
            form.start_date &&
            form.due_date &&
            form.due_date < form.start_date
        ) {
            setFormError("Due date cannot be earlier than start date.");
            return;
        }

        const effort = form.estimated_effort.trim()
            ? Number(form.estimated_effort)
            : null;

        if (
            effort !== null &&
            (!Number.isFinite(effort) ||
                effort < 0 ||
                !/^\d{1,8}(\.\d{1,2})?$/.test(form.estimated_effort.trim()))
        ) {
            setFormError(
                "Estimated effort must be a non-negative number with at most two decimal places.",
            );
            return;
        }

        const labels = form.labels
            .split(/[,\n]/)
            .map((label) => label.trim())
            .filter(Boolean);

        if (labels.length > 20) {
            setFormError("You can add a maximum of 20 labels.");
            return;
        }

        if (labels.some((label) => label.length > 40)) {
            setFormError("Each label cannot exceed 40 characters.");
            return;
        }

        const input: CreateTicketInput = {
            project_id: form.project_id,
            title: form.title.trim(),
            description: form.description.trim() || null,
            type: form.type,
            priority: form.priority,
            assignee_id: form.assignee_id || null,
            reviewer_id: form.reviewer_id || null,
            tester_id: form.tester_id || null,
            start_date: form.start_date || null,
            due_date: form.due_date || null,
            estimated_effort: effort,
            labels,
            parent_ticket_id: form.parent_ticket_id || null,
        };

        createMutation.mutate(input);
    }

    if (isCheckingAuth || !user) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div
                    className="flex items-center gap-2 text-sm text-slate-500"
                    role="status"
                >
                    <RefreshCw className="size-4 animate-spin" />
                    Verifying your session...
                </div>
            </main>
        );
    }

    if (!canCreateTicket) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
                <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <ShieldCheck className="mx-auto size-10 text-rose-500" />
                    <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                        Access restricted
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Only Administrators and Project Managers can create tickets.
                    </p>
                    <Link
                        href="/dashboard/tickets"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800"
                    >
                        <ArrowLeft className="size-4" />
                        Back to tickets
                    </Link>
                </section>
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
                                Create ticket
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <WorkspaceActions user={user}  onSignOut={handleSignOut} isSigningOut={isSigningOut} />
                    </div>
                </header>

                <section className="flex-1 px-2 pb-3 pt-1 sm:px-3 sm:pb-3 sm:pt-1 lg:px-3 lg:pb-3 lg:pt-1">
                    <div className="w-full max-w-none">
                        <Link
                            href="/dashboard/tickets"
                            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300"
                        >
                            <ArrowLeft className="size-3.5" />
                            Back to tickets
                        </Link>

                        <div className="mt-2">
                            <h1 className="mt-0 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Create a new ticket
                            </h1>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Describe the work and assign the people responsible for it.
                            </p>
                        </div>


                        {projectsQuery.isError && (
                            <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                                Unable to load projects.{" "}
                                {projectsQuery.error instanceof Error
                                    ? projectsQuery.error.message
                                    : ""}
                                <button
                                    type="button"
                                    onClick={() => projectsQuery.refetch()}
                                    className="ml-2 font-semibold underline"
                                >
                                    Try again
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="mt-2 space-y-2">
                            <FormSection
                                title="Basic information"
                                description="Select the project and provide the ticket details."
                                icon={<FileText className="size-4" />}
                            >
                                <div className="sm:col-span-2">
                                    <label htmlFor="project_id" className={LABEL_CLASS}>
                                        Project <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        id="project_id"
                                        required
                                        value={form.project_id}
                                        onChange={(event) =>
                                            handleProjectChange(event.target.value)
                                        }
                                        disabled={projectsQuery.isLoading}
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">
                                            {projectsQuery.isLoading
                                                ? "Loading projects..."
                                                : "Select a project"}
                                        </option>
                                        {projects.map((project) => (
                                            <option
                                                key={project.id}
                                                value={project.id}
                                            >
                                                {project.key} — {project.name}
                                            </option>
                                        ))}
                                    </select>
                                    {!projectsQuery.isLoading && projects.length === 0 && (
                                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                            No available non-archived projects were found.
                                        </p>
                                    )}
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="title" className={LABEL_CLASS}>
                                        Ticket title <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="title"
                                        required
                                        maxLength={255}
                                        value={form.title}
                                        onChange={(event) =>
                                            updateField("title", event.target.value)
                                        }
                                        placeholder="Enter a clear, descriptive ticket title"
                                        className={INPUT_CLASS}
                                    />
                                    <p className="mt-1 text-right text-[10px] text-slate-400">
                                        {form.title.length}/255
                                    </p>
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="description" className={LABEL_CLASS}>
                                        Description
                                    </label>
                                    <textarea
                                        id="description"
                                        maxLength={10000}
                                        value={form.description}
                                        onChange={(event) =>
                                            updateField("description", event.target.value)
                                        }
                                        placeholder="Describe the requirements, expected outcome, and relevant details..."
                                        className={TEXTAREA_CLASS}
                                    />
                                    <p className="mt-1 text-right text-[10px] text-slate-400">
                                        {form.description.length}/10000
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="type" className={LABEL_CLASS}>
                                        Ticket type <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        id="type"
                                        value={form.type}
                                        onChange={(event) =>
                                            updateField("type", event.target.value as TicketType)
                                        }
                                        className={INPUT_CLASS}
                                    >
                                        <option value="EPIC">Epic</option>
                                        <option value="STORY">Story</option>
                                        <option value="TASK">Task</option>
                                        <option value="SUBTASK">Subtask</option>
                                        <option value="BUG">Bug</option>
                                        <option value="IMPROVEMENT">Improvement</option>
                                        <option value="TECHNICAL_DEBT">Technical debt</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="priority" className={LABEL_CLASS}>
                                        Priority <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        id="priority"
                                        value={form.priority}
                                        onChange={(event) =>
                                            updateField(
                                                "priority",
                                                event.target.value as TicketPriority,
                                            )
                                        }
                                        className={INPUT_CLASS}
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="CRITICAL">Critical</option>
                                    </select>
                                </div>
                            </FormSection>

                            <FormSection
                                title="People and assignment"
                                description="Choose project members responsible for the ticket."
                                icon={<Users className="size-4" />}
                            >
                                {selectedProjectQuery.isLoading && (
                                    <div className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-500">
                                        <RefreshCw className="size-4 animate-spin" />
                                        Loading project members...
                                    </div>
                                )}

                                {selectedProjectQuery.isError && (
                                    <div className="sm:col-span-2 text-xs text-rose-600">
                                        Unable to load project members.{" "}
                                        <button
                                            type="button"
                                            onClick={() => selectedProjectQuery.refetch()}
                                            className="font-semibold underline"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                )}

                                {!form.project_id && (
                                    <p className="sm:col-span-2 text-xs text-slate-400">
                                        Select a project first to load its manager and members.
                                    </p>
                                )}

                                <div>
                                    <label htmlFor="assignee_id" className={LABEL_CLASS}>
                                        Assignee
                                    </label>
                                    <select
                                        id="assignee_id"
                                        value={form.assignee_id}
                                        onChange={(event) =>
                                            updateField("assignee_id", event.target.value)
                                        }
                                        disabled={!projectDetails}
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">Unassigned</option>
                                        {projectUsers.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.full_name} — {USER_ROLE_LABELS[member.role_code]}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="reviewer_id" className={LABEL_CLASS}>
                                        Reviewer
                                    </label>
                                    <select
                                        id="reviewer_id"
                                        value={form.reviewer_id}
                                        onChange={(event) =>
                                            updateField("reviewer_id", event.target.value)
                                        }
                                        disabled={!projectDetails}
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">Not assigned</option>
                                        {projectUsers.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.full_name} — {USER_ROLE_LABELS[member.role_code]}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="tester_id" className={LABEL_CLASS}>
                                        Tester
                                    </label>
                                    <select
                                        id="tester_id"
                                        value={form.tester_id}
                                        onChange={(event) =>
                                            updateField("tester_id", event.target.value)
                                        }
                                        disabled={!projectDetails}
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">Not assigned</option>
                                        {testerUsers.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.full_name}
                                            </option>
                                        ))}
                                    </select>
                                    {projectDetails && testerUsers.length === 0 && (
                                        <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                                            No project member with the Tester role is currently available.
                                        </p>
                                    )}
                                </div>
                            </FormSection>

                            <FormSection
                                title="Schedule and effort"
                                description="Define the development timeline and estimated work."
                                icon={<CalendarDays className="size-4" />}
                            >
                                <div>
                                    <label htmlFor="start_date" className={LABEL_CLASS}>
                                        Start date
                                    </label>
                                    <input
                                        id="start_date"
                                        type="date"
                                        value={form.start_date}
                                        onChange={(event) =>
                                            updateField("start_date", event.target.value)
                                        }
                                        min={todayDateInputValue()}
                                        max={form.due_date || undefined}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="due_date" className={LABEL_CLASS}>
                                        Due date
                                    </label>
                                    <input
                                        id="due_date"
                                        type="date"
                                        value={form.due_date}
                                        onChange={(event) =>
                                            updateField("due_date", event.target.value)
                                        }
                                        min={form.start_date || undefined}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="estimated_effort" className={LABEL_CLASS}>
                                        Estimated effort
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="estimated_effort"
                                            type="number"
                                            min="0"
                                            step="0.25"
                                            value={form.estimated_effort}
                                            onChange={(event) =>
                                                updateField(
                                                    "estimated_effort",
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="e.g. 8"
                                            className={`${INPUT_CLASS} pr-16`}
                                        />
                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                            Hours
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="parent_ticket_id" className={LABEL_CLASS}>
                                        Parent ticket (optional)
                                    </label>
                                    <select
                                        id="parent_ticket_id"
                                        value={form.parent_ticket_id}
                                        onChange={(event) =>
                                            updateField(
                                                "parent_ticket_id",
                                                event.target.value,
                                            )
                                        }
                                        disabled={!form.project_id || parentTicketsQuery.isLoading}
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">No parent ticket</option>
                                        {parentTickets.map((ticket) => (
                                            <option key={ticket.id} value={ticket.id}>
                                                {ticket.ticket_key} — {ticket.title}
                                            </option>
                                        ))}
                                    </select>
                                    {parentTicketsQuery.isError && (
                                        <p className="mt-1 text-[11px] text-amber-600">
                                            Unable to load parent ticket options.
                                        </p>
                                    )}
                                </div>
                            </FormSection>

                            <FormSection
                                title="Labels"
                                description="Add searchable labels to organize and identify this ticket."
                                icon={<Tag className="size-4" />}
                            >
                                <div className="sm:col-span-2">
                                    <label htmlFor="labels" className={LABEL_CLASS}>
                                        Ticket labels
                                    </label>
                                    <textarea
                                        id="labels"
                                        value={form.labels}
                                        onChange={(event) =>
                                            updateField("labels", event.target.value)
                                        }
                                        placeholder="frontend, authentication, high-priority"
                                        className={`${TEXTAREA_CLASS} min-h-20`}
                                    />
                                    <p className="mt-1.5 text-[11px] text-slate-400">
                                        Separate labels with commas or new lines. Maximum 20 labels, 40 characters each.
                                    </p>
                                </div>
                            </FormSection>

                            {(formError || createMutation.error) && (
                                <div
                                    role="alert"
                                    className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                                >
                                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                                    <div className="text-sm">
                                        <p className="font-semibold">
                                            Unable to create ticket
                                        </p>
                                        <p className="mt-1">
                                            {formError ||
                                                (createMutation.error instanceof Error
                                                    ? createMutation.error.message
                                                    : "An unexpected error occurred.")}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row">
                                <Link
                                    href="/dashboard/tickets"
                                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </Link>

                                <button
                                    type="submit"
                                    disabled={
                                        createMutation.isPending ||
                                        projectsQuery.isLoading ||
                                        projects.length === 0
                                    }
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {createMutation.isPending ? (
                                        <>
                                            <RefreshCw className="size-4 animate-spin" />
                                            Creating ticket...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="size-4" />
                                            Create ticket
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        </main>
    );
}