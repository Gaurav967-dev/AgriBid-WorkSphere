"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Clock3,
    FolderKanban,
    Loader2,
    Menu,
    PanelLeft,
    Pencil,
    Play,
    Plus,
    Search,
    Target,
    Trash2,
    X,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";
import { getProjects } from "@/features/projects/api/projects-api";
import {
    addSprintTickets,
    completeSprint,
    createSprint,
    getProjectBacklog,
    getProjectSprints,
    removeSprintTicket,
    startSprint,
    updateSprint,
    type SprintBacklogTicket,
    type SprintInput,
    type SprintStatus,
} from "@/features/sprints/api/sprints-api";
import { WorkspaceActions } from "@/components/workspace-actions";
import { todayDateInputValue } from "@/lib/date-utils";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

const EMPTY_FORM: SprintInput = {
    name: "",
    goal: "",
    start_date: "",
    end_date: "",
};

const STATUS_STYLES: Record<SprintStatus, string> = {
    PLANNED: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    COMPLETED: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
};

const STATUS_LABELS: Record<SprintStatus, string> = {
    PLANNED: "Planned",
    ACTIVE: "Active",
    COMPLETED: "Completed",
};

function formatDate(value: string | null | undefined): string {
    if (!value) return "Not set";
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return "Not set";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

function priorityStyle(priority: string): string {
    switch (priority) {
        case "CRITICAL":
            return "text-rose-700 dark:text-rose-300";
        case "HIGH":
            return "text-orange-700 dark:text-orange-300";
        case "MEDIUM":
            return "text-amber-700 dark:text-amber-300";
        default:
            return "text-slate-500 dark:text-slate-400";
    }
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
    return (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="min-w-0 flex-1">{message}</p>
            {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="rounded p-0.5 hover:bg-rose-100 dark:hover:bg-rose-900/40"><X className="size-4" /></button>}
        </div>
    );
}

function SprintStatusBadge({ status }: { status: SprintStatus }) {
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export default function SprintsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { collapsed, toggleCollapsed } = useWorkspaceSidebarState();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [projectId, setProjectId] = useState("");
    const [selectedSprintId, setSelectedSprintId] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editingSprintId, setEditingSprintId] = useState<string | null>(null);
    const [form, setForm] = useState<SprintInput>(EMPTY_FORM);
    const [formError, setFormError] = useState("");
    const [pageError, setPageError] = useState("");
    const [backlogOpen, setBacklogOpen] = useState(false);
    const [backlogSearch, setBacklogSearch] = useState("");
    const [backlogPage, setBacklogPage] = useState(1);
    const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);

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
        return () => { active = false; };
    }, [router]);

    const projectsQuery = useQuery({
        queryKey: ["sprints", "projects"],
        queryFn: () => getProjects({ page: 1, pageSize: 100, status: "ALL" }),
        enabled: !isCheckingAuth && Boolean(user),
    });

    const projects = useMemo(
        () => projectsQuery.data?.items ?? [],
        [projectsQuery.data?.items],
    );
    // Use the first visible project as the default without synchronously
    // setting component state from an effect.
    const activeProjectId = projectId || projects[0]?.id || "";
    const selectedProject =
        projects.find((project) => project.id === activeProjectId) ?? null;

    const sprintsQuery = useQuery({
        queryKey: ["project-sprints", activeProjectId],
        queryFn: () => getProjectSprints(activeProjectId, 1, 50),
        enabled: !isCheckingAuth && Boolean(user) && Boolean(activeProjectId),
    });

    const sprints = sprintsQuery.data?.items ?? [];
    const selectedSprint =
        sprints.find((sprint) => sprint.id === selectedSprintId) ?? sprints[0] ?? null;

    const backlogQuery = useQuery({
        queryKey: ["project-sprint-backlog", activeProjectId, backlogSearch, backlogPage],
        queryFn: () => getProjectBacklog(activeProjectId, backlogSearch, backlogPage, 50),
        enabled:
            backlogOpen &&
            Boolean(activeProjectId) &&
            Boolean(selectedSprint) &&
            selectedSprint.status !== "COMPLETED",
    });

    const canManage = Boolean(
        user?.role_code === "ADMIN" ||
        (user?.role_code === "PM" && selectedProject?.project_manager.id === user.id),
    );

    async function invalidateSprintQueries() {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["project-sprints", activeProjectId] }),
            queryClient.invalidateQueries({ queryKey: ["project-sprint-backlog", activeProjectId] }),
        ]);
    }

    const createMutation = useMutation({
        mutationFn: (input: SprintInput) => createSprint(activeProjectId, input),
        onSuccess: async (sprint) => {
            await invalidateSprintQueries();
            setSelectedSprintId(sprint.id);
            setFormOpen(false);
            setFormError("");
            setForm(EMPTY_FORM);
        },
        onError: (error: Error) => setFormError(error.message),
    });

    const updateMutation = useMutation({
        mutationFn: (input: SprintInput) => updateSprint(editingSprintId!, input),
        onSuccess: async (sprint) => {
            await invalidateSprintQueries();
            setSelectedSprintId(sprint.id);
            setFormOpen(false);
            setEditingSprintId(null);
            setFormError("");
        },
        onError: (error: Error) => setFormError(error.message),
    });

    const addTicketsMutation = useMutation({
        mutationFn: () => addSprintTickets(selectedSprint!.id, selectedTicketIds),
        onSuccess: async (sprint) => {
            await invalidateSprintQueries();
            setSelectedSprintId(sprint.id);
            setBacklogOpen(false);
            setSelectedTicketIds([]);
            setBacklogSearch("");
            setPageError("");
        },
        onError: (error: Error) => setPageError(error.message),
    });

    const removeTicketMutation = useMutation({
        mutationFn: (ticketId: string) => removeSprintTicket(selectedSprint!.id, ticketId),
        onSuccess: async () => {
            await invalidateSprintQueries();
        },
        onError: (error: Error) => setPageError(error.message),
    });

    const startMutation = useMutation({
        mutationFn: () => startSprint(selectedSprint!.id),
        onSuccess: async (sprint) => {
            await invalidateSprintQueries();
            setSelectedSprintId(sprint.id);
            setPageError("");
        },
        onError: (error: Error) => setPageError(error.message),
    });
    const completeMutation = useMutation({
        mutationFn: () => completeSprint(selectedSprint!.id),
        onSuccess: async (sprint) => {
            await invalidateSprintQueries();
            setSelectedSprintId(sprint.id);
            setPageError("");
        },
        onError: (error: Error) => setPageError(error.message),
    });

    function openCreateForm() {
        setEditingSprintId(null);
        setForm(EMPTY_FORM);
        setFormError("");
        setFormOpen(true);
    }

    function openEditForm() {
        if (!selectedSprint) return;
        setEditingSprintId(selectedSprint.id);
        setForm({
            name: selectedSprint.name,
            goal: selectedSprint.goal,
            start_date: selectedSprint.start_date,
            end_date: selectedSprint.end_date,
        });
        setFormError("");
        setFormOpen(true);
    }

    function submitSprintForm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError("");
        const normalized = {
            name: form.name.trim(),
            goal: form.goal.trim(),
            start_date: form.start_date,
            end_date: form.end_date,
        };
        if (!normalized.name || !normalized.goal || !normalized.start_date || !normalized.end_date) {
            setFormError("Complete all sprint fields before saving.");
            return;
        }
        const originalStartDate =
            editingSprintId && selectedSprint?.id === editingSprintId
                ? selectedSprint.start_date
                : "";
        if (
            normalized.start_date < todayDateInputValue() &&
            normalized.start_date !== originalStartDate
        ) {
            setFormError("Sprint start date cannot be in the past.");
            return;
        }
        if (normalized.end_date < normalized.start_date) {
            setFormError("Sprint end date cannot be before its start date.");
            return;
        }
        if (editingSprintId) updateMutation.mutate(normalized);
        else createMutation.mutate(normalized);
    }

    function handleProjectChange(nextProjectId: string) {
        setProjectId(nextProjectId);
        setSelectedSprintId("");
        setPageError("");
        setBacklogOpen(false);
        setBacklogPage(1);
        setBacklogSearch("");
        setSelectedTicketIds([]);
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

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const backlogItems = backlogQuery.data?.items ?? [];
    const canEditSelected = canManage && (
        selectedSprint?.status === "PLANNED" || selectedSprint?.status === "ACTIVE"
    );
    const actionPending = startMutation.isPending || completeMutation.isPending;

    if (isCheckingAuth || !user) {
        return <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950"><p role="status" className="text-sm text-slate-500">Verifying your session...</p></main>;
    }

    return (
        <main className="workspace-shell flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 xl:h-dvh xl:min-h-0 xl:overflow-hidden">
            <WorkspaceSidebar
                user={user}
                collapsed={collapsed}
                mobileOpen={mobileNavOpen}
                onMobileClose={() => setMobileNavOpen(false)}
            />

            <div className="flex min-w-0 flex-1 flex-col xl:min-h-0 xl:overflow-hidden">
                <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:flex dark:text-slate-300 dark:hover:bg-slate-800"><PanelLeft className="size-4" /></button>
                        <button type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"><Menu className="size-5" /></button>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">Sprints &amp; Backlog</p>
                        </div>
                    </div>
                    <WorkspaceActions user={user} onSignOut={handleSignOut} isSigningOut={isSigningOut} />
                </header>

                <section className="flex-1 space-y-3 px-3 pb-3 pt-2 sm:px-5 lg:px-6 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
                    <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center xl:shrink-0">
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Sprints &amp; Backlog</h1>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Plan sprint work, track ticket progress, and review completed work.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label htmlFor="sprint-project" className="sr-only">Project</label>
                            <select id="sprint-project" value={activeProjectId} onChange={(event) => handleProjectChange(event.target.value)} disabled={projectsQuery.isLoading || projects.length === 0} className="h-10 min-w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                {projects.length === 0 && <option value="">No visible projects</option>}
                                {projects.map((project) => <option key={project.id} value={project.id}>{project.key} · {project.name}</option>)}
                            </select>
                            {canManage && <button type="button" onClick={openCreateForm} disabled={!selectedProject} className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-700 px-3.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><Plus className="size-4" /> Create sprint</button>}
                        </div>
                    </div>

                    {pageError && <ErrorBanner message={pageError} onDismiss={() => setPageError("")} />}
                    {projectsQuery.isError && <ErrorBanner message={projectsQuery.error.message} />}
                    {sprintsQuery.isError && <ErrorBanner message={sprintsQuery.error.message} />}

                    {!projectsQuery.isLoading && projects.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
                            <FolderKanban className="mx-auto size-9 text-slate-400" />
                            <h2 className="mt-3 text-base font-semibold">No projects available</h2>
                            <p className="mt-1 text-sm text-slate-500">You need access to a project before its sprints and backlog can be viewed.</p>
                            <Link href="/dashboard/projects" className="mt-4 inline-flex text-sm font-semibold text-violet-700 hover:underline dark:text-violet-300">View projects</Link>
                        </div>
                    ) : (
                        <div className="grid min-w-0 gap-3 xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:grid-rows-1 xl:grid-cols-[280px_minmax(0,1fr)]">
                            <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:h-full xl:min-h-0 xl:flex xl:flex-col xl:overflow-hidden">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                                    <div>
                                        <h2 className="text-sm font-semibold">Project sprints</h2>
                                        <p className="mt-0.5 text-xs text-slate-500">{sprintsQuery.data?.total ?? 0} total</p>
                                    </div>
                                </div>

                                {sprintsQuery.isLoading ? (
                                    <div className="mt-3 space-y-2">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}</div>
                                ) : sprints.length === 0 ? (
                                    <div className="py-10 text-center">
                                        <Target className="mx-auto size-8 text-slate-300" />
                                        <p className="mt-2 text-sm font-medium">No sprints yet</p>
                                        <p className="mt-1 text-xs text-slate-500">Create a sprint to begin planning tickets.</p>
                                    </div>
                                ) : (
                                    <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                                        {sprints.map((sprint) => {
                                            const active = sprint.id === selectedSprint?.id;
                                            return (
                                                <button key={sprint.id} type="button" onClick={() => setSelectedSprintId(sprint.id)} className={`w-full rounded-lg border p-3 text-left transition ${active ? "border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/30" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"}`}>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className="min-w-0 truncate text-sm font-semibold">{sprint.name}</span>
                                                        <span className="shrink-0 text-[10px] font-semibold text-slate-400">{sprint.assigned_tickets} tickets</span>
                                                    </div>
                                                    <div className="mt-2 flex items-center justify-between gap-2">
                                                        <SprintStatusBadge status={sprint.status} />
                                                        <span className="text-[10px] text-slate-500">{sprint.completion_percentage}%</span>
                                                    </div>
                                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-violet-600" style={{ width: `${sprint.completion_percentage}%` }} /></div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </aside>

                            <section className="flex min-w-0 flex-col gap-4 xl:h-full xl:min-h-0 xl:overflow-hidden xl:gap-3">
                                {!selectedSprint ? (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
                                        <Target className="mx-auto size-9 text-slate-300" />
                                        <h2 className="mt-3 text-base font-semibold">Select or create a sprint</h2>
                                        <p className="mt-1 text-sm text-slate-500">Sprint goal, dates, ticket assignments and progress will appear here.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4 xl:shrink-0">
                                            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <SprintStatusBadge status={selectedSprint.status} />
                                                        <span className="text-xs text-slate-400">{selectedSprint.project_key}</span>
                                                    </div>
                                                    <h2 className="mt-1.5 text-lg font-bold">{selectedSprint.name}</h2>
                                                    <p className="mt-0.5 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">{selectedSprint.goal}</p>
                                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
                                                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {formatDate(selectedSprint.start_date)} – {formatDate(selectedSprint.end_date)}</span>
                                                        {selectedSprint.started_at && <span className="inline-flex items-center gap-1.5"><Play className="size-3.5" /> Started {formatDate(selectedSprint.started_at)}</span>}
                                                        {selectedSprint.completed_at && <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Completed {formatDate(selectedSprint.completed_at)}</span>}
                                                    </div>
                                                </div>

                                                {canManage && (
                                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                        {selectedSprint.status === "PLANNED" && <button type="button" onClick={openEditForm} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Pencil className="size-3.5" /> Edit</button>}
                                                        {(selectedSprint.status === "PLANNED" || selectedSprint.status === "ACTIVE") && <button type="button" onClick={() => { setBacklogOpen(true); setBacklogPage(1); setSelectedTicketIds([]); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"><Plus className="size-3.5" /> Add backlog tickets</button>}
                                                        {selectedSprint.status === "PLANNED" && <button type="button" onClick={() => startMutation.mutate()} disabled={actionPending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Play className="size-3.5" /> Start sprint</button>}
                                                        {selectedSprint.status === "ACTIVE" && <button type="button" onClick={() => { if (window.confirm("Complete this sprint? Unfinished, non-cancelled tickets will return to Backlog.")) completeMutation.mutate(); }} disabled={actionPending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"><CheckCircle2 className="size-3.5" /> Complete sprint</button>}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                {[
                                                    { label: "Assigned tickets", value: selectedSprint.assigned_tickets, icon: FolderKanban },
                                                    { label: "Completed tickets", value: selectedSprint.completed_tickets, icon: CheckCircle2 },
                                                    { label: "Pending tickets", value: selectedSprint.pending_tickets, icon: Clock3 },
                                                ].map((metric) => {
                                                    const Icon = metric.icon;
                                                    return <div key={metric.label} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950/50"><div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{metric.label}</span><Icon className="size-4" /></div><p className="mt-0.5 text-xl font-bold tabular-nums">{metric.value}</p></div>;
                                                })}
                                            </div>

                                            <div className="mt-3">
                                                <div className="flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-600 dark:text-slate-300">Sprint progress</span><span className="font-bold tabular-nums">{selectedSprint.completion_percentage}%</span></div>
                                                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${selectedSprint.completion_percentage}%` }} /></div>
                                            </div>
                                        </div>

                                        <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
                                            <div className="flex shrink-0 flex-col justify-between gap-1.5 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800 sm:flex-row sm:items-center">
                                                <div>
                                                    <h3 className="text-sm font-semibold">Sprint tickets</h3>
                                                    <p className="mt-0.5 text-[11px] text-slate-500">Ticket status is read from the current workflow and reflected in sprint progress.</p>
                                                </div>
                                                <span className="text-xs font-medium text-slate-500">{selectedSprint.tickets.length} tickets</span>
                                            </div>
                                            {selectedSprint.tickets.length === 0 ? (
                                                <div className="px-4 py-12 text-center">
                                                    <FolderKanban className="mx-auto size-8 text-slate-300" />
                                                    <p className="mt-2 text-sm font-medium">No tickets assigned</p>
                                                    {canEditSelected && <button type="button" onClick={() => setBacklogOpen(true)} className="mt-3 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">Add tickets from Backlog</button>}
                                                </div>
                                            ) : (
                                                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 pr-1 dark:divide-slate-800 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                                                    {selectedSprint.tickets.map((ticket) => (
                                                        <div key={ticket.id} className="flex flex-col justify-between gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2"><Link href={`/dashboard/tickets/${ticket.ticket_id}`} className="text-[11px] font-bold text-violet-700 hover:underline dark:text-violet-300">{ticket.ticket_key}</Link><span className={`text-[10px] font-semibold ${priorityStyle(ticket.priority)}`}>{ticket.priority}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">{ticket.type}</span></div>
                                                                <Link href={`/dashboard/tickets/${ticket.ticket_id}`} className="mt-0.5 block truncate text-xs font-medium hover:text-violet-700 dark:hover:text-violet-300">{ticket.title}</Link>
                                                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500"><span>{ticket.assignee_name ?? "Unassigned"}</span><span>Due {formatDate(ticket.due_date)}</span><span>{ticket.status.replaceAll("_", " ")}</span></div>
                                                            </div>
                                                            {canEditSelected && <button type="button" onClick={() => { if (window.confirm(`Remove ${ticket.ticket_key} from this sprint? If the sprint is active, unfinished work returns to Backlog.`)) removeTicketMutation.mutate(ticket.ticket_id); }} disabled={removeTicketMutation.isPending} aria-label={`Remove ${ticket.ticket_key} from sprint`} className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 self-start rounded-md px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/30 sm:self-center"><Trash2 className="size-3.5" /> Remove</button>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </section>
                        </div>
                    )}
                </section>
            </div>

            {formOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
                    <form noValidate onSubmit={submitSprintForm} role="dialog" aria-modal="true" aria-labelledby="sprint-form-title" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-3">
                            <div><h2 id="sprint-form-title" className="text-lg font-bold">{editingSprintId ? "Edit sprint" : "Create sprint"}</h2><p className="mt-1 text-xs text-slate-500">Set the sprint goal and planned dates.</p></div>
                            <button type="button" onClick={() => setFormOpen(false)} aria-label="Close form" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-4" /></button>
                        </div>
                        <div className="mt-5 space-y-4">
                            <label className="block"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Sprint name</span><input autoFocus required maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950" placeholder="e.g. Sprint 1" /></label>
                            <label className="block"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Sprint goal</span><textarea required maxLength={2000} rows={3} value={form.goal} onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))} className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950" placeholder="What should this sprint achieve?" /></label>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Start date</span><input required type="date" min={todayDateInputValue()} value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950" /></label>
                                <label className="block"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">End date</span><input required type="date" min={form.start_date || undefined} value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950" /></label>
                            </div>
                        </div>
                        {formError && <div className="mt-4"><ErrorBanner message={formError} /></div>}
                        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                            <button type="button" onClick={() => setFormOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Cancel</button>
                            <button type="submit" disabled={isSaving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-700 px-4 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{isSaving && <Loader2 className="size-3.5 animate-spin" />}{editingSprintId ? "Save changes" : "Create sprint"}</button>
                        </div>
                    </form>
                </div>
            )}

            {backlogOpen && selectedSprint && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBacklogOpen(false); }}>
                    <div role="dialog" aria-modal="true" aria-labelledby="backlog-dialog-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                            <div><h2 id="backlog-dialog-title" className="text-lg font-bold">Add backlog tickets</h2><p className="mt-1 text-xs text-slate-500">Select tickets from {selectedSprint.project_key}. Tickets already assigned to another sprint are excluded.</p></div>
                            <button type="button" onClick={() => setBacklogOpen(false)} aria-label="Close backlog selector" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-4" /></button>
                        </div>
                        <div className="border-b border-slate-100 p-3 dark:border-slate-800">
                            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={backlogSearch} onChange={(event) => { setBacklogSearch(event.target.value); setBacklogPage(1); }} placeholder="Search ticket key or title" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950" /></div>
                            <p className="mt-2 text-xs text-slate-500">{selectedTicketIds.length} selected · {backlogQuery.data?.total ?? 0} backlog tickets available</p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto p-3">
                            {backlogQuery.isLoading ? (
                                <div className="space-y-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}</div>
                            ) : backlogQuery.isError ? (
                                <ErrorBanner message={backlogQuery.error.message} />
                            ) : backlogItems.length === 0 ? (
                                <div className="py-12 text-center"><CheckCircle2 className="mx-auto size-8 text-slate-300" /><p className="mt-2 text-sm font-medium">No available backlog tickets</p><p className="mt-1 text-xs text-slate-500">Create tickets or remove existing sprint assignments before adding work.</p></div>
                            ) : (
                                <div className="space-y-1.5">
                                    {backlogItems.map((ticket: SprintBacklogTicket) => {
                                        const checked = selectedTicketIds.includes(ticket.id);
                                        return <label key={ticket.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${checked ? "border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20" : "border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"}`}>
                                            <input type="checkbox" checked={checked} onChange={(event) => setSelectedTicketIds((current) => event.target.checked ? [...current, ticket.id] : current.filter((id) => id !== ticket.id))} className="mt-1 size-4 accent-violet-700" />
                                            <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-bold text-violet-700 dark:text-violet-300">{ticket.ticket_key}</span><span className={`text-[10px] font-semibold ${priorityStyle(ticket.priority)}`}>{ticket.priority}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">{ticket.type}</span></span><span className="mt-1 block truncate text-sm font-medium">{ticket.title}</span><span className="mt-1 block text-[11px] text-slate-500">{ticket.assignee_name ?? "Unassigned"} · Due {formatDate(ticket.due_date)}</span></span>
                                        </label>;
                                    })}
                                </div>
                            )}
                        </div>
                        {(backlogQuery.data?.total_pages ?? 0) > 1 && (
                            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 dark:border-slate-800">
                                <span className="text-[11px] text-slate-500">Page {backlogPage} of {backlogQuery.data?.total_pages ?? 1}</span>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setBacklogPage((page) => Math.max(1, page - 1))} disabled={backlogPage <= 1 || backlogQuery.isFetching} className="h-8 rounded-md border border-slate-200 px-2.5 text-[11px] font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button>
                                    <button type="button" onClick={() => setBacklogPage((page) => Math.min(backlogQuery.data?.total_pages ?? page, page + 1))} disabled={backlogPage >= (backlogQuery.data?.total_pages ?? 1) || backlogQuery.isFetching} className="h-8 rounded-md border border-slate-200 px-2.5 text-[11px] font-semibold disabled:opacity-40 dark:border-slate-700">Next</button>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-3 dark:border-slate-800">
                            <span className="text-xs text-slate-500">{selectedTicketIds.length} tickets selected</span>
                            <div className="flex gap-2"><button type="button" onClick={() => setBacklogOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700">Cancel</button><button type="button" onClick={() => addTicketsMutation.mutate()} disabled={selectedTicketIds.length === 0 || addTicketsMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-700 px-4 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{addTicketsMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}Add selected</button></div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
