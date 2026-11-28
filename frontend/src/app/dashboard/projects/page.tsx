
"use client";

import { useEffect, useMemo, useState } from "react";
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
    Users,
    PanelLeft,
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
import { ProjectsToolbar, type ProjectSort } from "@/features/projects/components/projects-toolbar";
import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

const PAGE_SIZE = 9;


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
            className="group flex min-h-[230px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800"
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
                        {(project.project_managers?.length ? project.project_managers : [project.project_manager]).map((manager) => manager.full_name).join(", ")}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-400">Assigned team</span>
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {(project.teams?.length ? project.teams : [project.team]).map((team) => team.name).join(", ")}
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
    const [sort, setSort] = useState<ProjectSort>("updated-desc");
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

    const projects = useMemo(
        () => projectsQuery.data?.items ?? [],
        [projectsQuery.data?.items],
    );
    const displayedProjects = useMemo(() => {
        const items = [...projects];
        const timestamp = (value: string | null) =>
            value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;

        items.sort((a, b) => {
            switch (sort) {
                case "updated-asc":
                    return timestamp(a.updated_at) - timestamp(b.updated_at);
                case "created-desc":
                    return timestamp(b.created_at) - timestamp(a.created_at);
                case "created-asc":
                    return timestamp(a.created_at) - timestamp(b.created_at);
                case "name-asc":
                    return a.name.localeCompare(b.name);
                case "name-desc":
                    return b.name.localeCompare(a.name);
                case "start-asc":
                    return timestamp(a.start_date) - timestamp(b.start_date);
                case "start-desc":
                    return timestamp(b.start_date) - timestamp(a.start_date);
                case "updated-desc":
                default:
                    return timestamp(b.updated_at) - timestamp(a.updated_at);
            }
        });

        return items;
    }, [projects, sort]);

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

    const totalProjects = projectsQuery.data?.total ?? 0;
    const totalPages = Math.max(1, projectsQuery.data?.total_pages ?? 1);

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
                                Projects
                            </p>
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

                        <div className="-mt-3">
                            <ProjectsToolbar
                                totalProjects={totalProjects}
                                search={search}
                                onSearchChange={handleSearchChange}
                                status={status}
                                onStatusChange={handleStatusChange}
                                sort={sort}
                                onSortChange={setSort}
                            />


                        </div>{projectsQuery.isError && (
                            <div className="mt-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
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
                            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <div
                                        key={index}
                                        className="h-[230px] animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                                        <div className="mt-5 h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                                        <div className="mt-2 h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
                                        <div className="mt-8 h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
                                    </div>
                                ))}
                            </div>
                        ) : !projectsQuery.isError && projects.length === 0 ? (
                            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
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
                                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {displayedProjects.map((project) => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                        />
                                    ))}
                                </div>

                                <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
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