
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
    FolderKanban,
    Menu,
    Plus,
    RefreshCw,
    Search,
    Users,
    PanelLeft,
    X,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";
import {
    getProjects,
    type Project,
    type ProjectListStatus,
    type ProjectStatus,
} from "@/features/projects/api/projects-api";
import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

const PAGE_SIZE = 9;

const STATUS_OPTIONS: { label: string; value: ProjectListStatus }[] = [
    { label: "All projects", value: "ALL" },
    { label: "Planning", value: "PLANNING" },
    { label: "Active", value: "ACTIVE" },
    { label: "On hold", value: "ON_HOLD" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Archived", value: "ARCHIVED" },
];

const STATUS_STYLES: Record<ProjectStatus, string> = {
    PLANNING: "border-sky-200 bg-sky-50 text-sky-700",
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ON_HOLD: "border-amber-200 bg-amber-50 text-amber-700",
    COMPLETED: "border-violet-200 bg-violet-50 text-violet-700",
    ARCHIVED: "border-slate-200 bg-slate-100 text-slate-600",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
    PLANNING: "Planning",
    ACTIVE: "Active",
    ON_HOLD: "On hold",
    COMPLETED: "Completed",
    ARCHIVED: "Archived",
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

function StatusBadge({ status }: { status: ProjectStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
        >
            <span className="mr-1.5 size-1.5 rounded-full bg-current" />
            {STATUS_LABELS[status]}
        </span>
    );
}

function ProjectCard({ project }: { project: Project }) {
    return (
        <Link
            href={`/dashboard/projects/${project.id}`}
            className="group flex min-h-[230px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
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

                <StatusBadge status={project.status} />
            </div>

            <p className="mt-4 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {project.description || "No project description provided."}
            </p>

            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">Project manager</span>
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {project.project_manager.full_name}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">Assigned team</span>
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {project.team.name}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                        <Users className="size-3.5" />
                        Members
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                        {project.member_count}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                        <CalendarDays className="size-3.5" />
                        Timeline
                    </span>
                    <span className="text-right font-medium text-slate-700 dark:text-slate-200">
                        {formatDate(project.start_date)} – {formatDate(project.end_date)}
                    </span>
                </div>
            </div>
        </Link>
    );
}

export default function ProjectsPage() {
    const router = useRouter();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<ProjectListStatus>("ALL");
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
        queryKey: ["projects", page, PAGE_SIZE, search, status],
        queryFn: () =>
            getProjects({
                page,
                pageSize: PAGE_SIZE,
                search,
                status,
            }),
        enabled: !isCheckingAuth && Boolean(user),
    });

    const canCreateProject =
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

    function handleSearchChange(value: string) {
        setSearch(value);
        setPage(1);
    }

    function handleStatusChange(value: ProjectListStatus) {
        setStatus(value);
        setPage(1);
    }

    if (isCheckingAuth || !user) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
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

    const projects = projectsQuery.data?.items ?? [];
    const totalProjects = projectsQuery.data?.total ?? 0;
    const totalPages = Math.max(1, projectsQuery.data?.total_pages ?? 1);

    return (
        <main className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
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
                                Projects
                            </p>
                            <p className="hidden text-[11px] text-slate-400 sm:block">
                                Manage and track workspace projects
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <WorkspaceActions />

                        <button
                            type="button"
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                            className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            {isSigningOut ? "Signing out..." : "Sign out"}
                        </button>
                    </div>
                </header>

                <section className="flex-1 p-4 sm:p-6 lg:p-8">
                    <div className="mx-auto max-w-7xl">
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                                    Workspace
                                </p>
                                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                                    Projects
                                </h1>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    View and manage projects assigned to your workspace.
                                </p>
                            </div>

                            {canCreateProject && (
                                <Link
                                    href="/dashboard/projects/new"
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800"
                                >
                                    <Plus className="size-4" />
                                    Create project
                                </Link>
                            )}
                        </div>

                        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <FolderKanban className="size-4 text-violet-600" />
                                <span>
                                    <strong className="font-semibold text-slate-900 dark:text-white">
                                        {totalProjects}
                                    </strong>{" "}
                                    {totalProjects === 1 ? "project" : "projects"}
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) =>
                                            handleSearchChange(event.target.value)
                                        }
                                        placeholder="Search projects..."
                                        aria-label="Search projects"
                                        className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:w-60 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-violet-950"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => handleSearchChange("")}
                                            aria-label="Clear search"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>

                                <select
                                    value={status}
                                    onChange={(event) =>
                                        handleStatusChange(
                                            event.target.value as ProjectListStatus,
                                        )
                                    }
                                    aria-label="Filter projects by status"
                                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-violet-950"
                                >
                                    {STATUS_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={() => projectsQuery.refetch()}
                                    disabled={projectsQuery.isFetching}
                                    aria-label="Refresh projects"
                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    <RefreshCw
                                        className={`size-3.5 ${projectsQuery.isFetching ? "animate-spin" : ""}`}
                                    />
                                    <span className="sm:hidden">Refresh</span>
                                </button>
                            </div>
                        </div>

                        {projectsQuery.isError && (
                            <div className="mt-6 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                                <AlertCircle className="mt-0.5 size-5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold">
                                        Unable to load projects
                                    </p>
                                    <p className="mt-1 text-sm">
                                        {projectsQuery.error instanceof Error
                                            ? projectsQuery.error.message
                                            : "An unexpected error occurred."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => projectsQuery.refetch()}
                                        className="mt-2 text-sm font-semibold underline underline-offset-2"
                                    >
                                        Try again
                                    </button>
                                </div>
                            </div>
                        )}

                        {projectsQuery.isLoading ? (
                            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="h-[230px] animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                                        <div className="mt-5 h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                                        <div className="mt-2 h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
                                        <div className="mt-8 h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
                                    </div>
                                ))}
                            </div>
                        ) : !projectsQuery.isError && projects.length === 0 ? (
                            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
                                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                                    <FolderKanban className="size-6" />
                                </div>
                                <h2 className="mt-4 text-base font-semibold">
                                    {search || status !== "ALL"
                                        ? "No matching projects"
                                        : "No projects yet"}
                                </h2>
                                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
                                    {search || status !== "ALL"
                                        ? "Try changing your search or status filter."
                                        : "Projects that you create or are assigned to will appear here."}
                                </p>
                                {canCreateProject && !search && status === "ALL" && (
                                    <Link
                                        href="/dashboard/projects/new"
                                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
                                    >
                                        <Plus className="size-4" />
                                        Create your first project
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {projects.map((project) => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                        />
                                    ))}
                                </div>

                                <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Page {page} of {totalPages} · {totalProjects} total projects
                                    </p>

                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPage((current) => Math.max(1, current - 1))
                                            }
                                            disabled={page <= 1 || projectsQuery.isFetching}
                                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
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
                                                page >= totalPages || projectsQuery.isFetching
                                            }
                                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                                        >
                                            Next
                                            <ChevronRight className="size-3.5" />
                                        </button>
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