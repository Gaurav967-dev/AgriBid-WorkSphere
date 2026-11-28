"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FolderKanban,
  Loader2,
  Menu,
  PanelLeft,
  Pencil,
  Plus,
  Save,
  Ticket as TicketIcon,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  addProjectMember,
  archiveProject,
  getProject,
  getProjectOverview,
  getProjectOptions,
  removeProjectMember,
  updateProject,
  type ProjectStatus,
} from "@/features/projects/api/projects-api";

import { getTickets } from "@/features/tickets/api/tickets-api";
import { AttachmentsPanel } from "@/features/attachments/components/attachments-panel";
import { signOut, verifyToken, type AuthUser } from "@/features/auth/api/auth-api";
import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

const statuses: ProjectStatus[] = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
];

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const statusStyles: Record<ProjectStatus, string> = {
  PLANNING: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ON_HOLD: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ARCHIVED: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

function formatDate(value: string | null) {
  if (!value) return "Not specified";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}


function ProjectDetailCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-violet-600 dark:text-violet-300">{icon}</span>
          <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ProjectDetailsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const queryClient = useQueryClient();

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

  const [editing, setEditing] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "PLANNING" as ProjectStatus,
    start_date: "",
    end_date: "",
  });

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: !isCheckingAuth && Boolean(user) && Boolean(projectId),
  });

  const project = projectQuery.data;

  const ticketsQuery = useQuery({
    queryKey: ["tickets", "project-details", projectId],
    queryFn: () => getTickets({
      projectId,
      page: 1,
      pageSize: 100,
      sortBy: "updated_at",
      sortOrder: "desc",
    }),
    enabled: Boolean(projectId && project),
  });

  const projectOverviewQuery = useQuery({
    queryKey: ["project-overview", projectId],
    queryFn: () => getProjectOverview(projectId),
    enabled: Boolean(projectId && project),
  });

  const optionsQuery = useQuery({
    queryKey: ["project-options", project?.team.id],
    queryFn: () => getProjectOptions(project?.team.id),
    enabled: Boolean(showMemberPicker && project),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProject(projectId, {
        name: form.name,
        description: form.description || null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditing(false);
      setNotice("Project information updated successfully.");
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setNotice("Project archived successfully.");
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const addMemberMutation = useMutation({
    mutationFn: () =>
      addProjectMember({ projectId, userId: selectedUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setSelectedUserId("");
      setShowMemberPicker(false);
      setNotice("Project member added successfully.");
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      removeProjectMember({ projectId, userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setNotice("Project member removed successfully.");
    },
    onError: (error: Error) => setNotice(error.message),
  });

  const availableMembers = useMemo(() => {
    const existingIds = new Set(
      project?.members.map((member) => member.user.id) ?? [],
    );

    return (optionsQuery.data?.team_members ?? []).filter(
      (member) => !existingIds.has(member.id),
    );
  }, [optionsQuery.data, project?.members]);

  function beginEditing() {
    if (!project) return;

    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      start_date: dateInput(project.start_date),
      end_date: dateInput(project.end_date),
    });

    setNotice("");
    setEditing(true);
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setNotice("Project name is required.");
      return;
    }

    if (
      form.start_date &&
      form.end_date &&
      form.end_date < form.start_date
    ) {
      setNotice("Project end date cannot be before start date.");
      return;
    }

    saveMutation.mutate();
  }

  function handleArchive() {
    if (!window.confirm(
      "Are you sure you want to archive this project?",
    )) return;

    archiveMutation.mutate();
  }

  function handleRemoveMember(userId: string, name: string) {
    if (!window.confirm(
      `Remove ${name} from this project? Historical records will be retained.`,
    )) return;

    removeMemberMutation.mutate(userId);
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

  if (isCheckingAuth || !user || projectQuery.isLoading) {
    return (
      <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400" role="status">
          <Loader2 className="size-4 animate-spin text-violet-600" />
          Loading project details...
        </div>
      </main>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="max-w-md rounded-xl border bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
          <AlertCircle className="mx-auto mb-3 h-9 w-9 text-rose-500" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Unable to load project
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {projectQuery.error instanceof Error
              ? projectQuery.error.message
              : "Project not found or access denied."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={() => projectQuery.refetch()}
              className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
            <Link
              href="/dashboard/projects"
              className="rounded-lg border px-4 py-2 text-sm dark:border-slate-700"
            >
              Back to projects
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tickets = ticketsQuery.data?.items ?? [];
  const ticketTotal = ticketsQuery.data?.total ?? 0;
  const ticketStatus = ticketsQuery.isError
    ? "Unavailable"
    : ticketsQuery.isLoading
      ? "Loading"
      : `${ticketTotal}`;
  const projectOverview = projectOverviewQuery.data;

  const isArchived = project.status === "ARCHIVED" || Boolean(project.archived_at);

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
            <p className="truncate text-sm font-semibold">{project.key}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <WorkspaceActions user={user} onSignOut={handleSignOut} isSigningOut={isSigningOut} />
          </div>
        </header>

        <section className="flex-1 px-3 pb-3 pt-1 sm:px-3 sm:pb-3 sm:pt-1 lg:px-4 lg:pb-4 lg:pt-1">
          <div className="w-full max-w-none space-y-3">
            <Link
              href="/dashboard/projects"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300"
            >
              <ArrowLeft className="size-3.5" />
              Back to projects
            </Link>

            <div className="flex flex-col justify-between gap-2.5 lg:flex-row lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-violet-50 px-2.5 py-1 font-mono text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {project.key}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[project.status]}`}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {statusLabels[project.status]}
                  </span>
                </div>
                <h1 className="mt-1.5 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {project.name}
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {project.team.name} · Created {formatDate(project.created_at)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isArchived && (
                  <>
                    <button
                      type="button"
                      onClick={beginEditing}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={archiveMutation.isPending}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      <Archive className="size-3.5" />
                      Archive
                    </button>
                  </>
                )}
              </div>
            </div>

            {notice && (
              <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">
                  <X className="size-3.5" />
                </button>
              </div>
            )}

                    {editing && (
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Edit project information</h2>
              <button onClick={() => setEditing(false)} aria-label="Close edit form">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium">
                Project name
                <input
                  required
                  maxLength={150}
                  value={form.name}
                  onChange={(event) => setForm({
                    ...form,
                    name: event.target.value,
                  })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="space-y-1 text-xs font-medium">
                Project status
                <select
                  value={form.status}
                  onChange={(event) => setForm({
                    ...form,
                    status: event.target.value as ProjectStatus,
                  })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium sm:col-span-2">
                Description
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={form.description}
                  onChange={(event) => setForm({
                    ...form,
                    description: event.target.value,
                  })}
                  className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="space-y-1 text-xs font-medium">
                Start date
                <input
                  type="date"
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)}
                  value={form.start_date}
                  onChange={(event) => setForm({
                    ...form,
                    start_date: event.target.value,
                  })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <label className="space-y-1 text-xs font-medium">
                End date
                <input
                  type="date"
                  min={form.start_date || undefined}
                  value={form.end_date}
                  onChange={(event) => setForm({
                    ...form,
                    end_date: event.target.value,
                  })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg border px-4 py-2 text-sm dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  {saveMutation.isPending
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Save size={15} />}
                  Save changes
                </button>
              </div>
            </form>
          </section>
        )}

            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <article className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Total tickets <TicketIcon className="size-4 text-violet-600 dark:text-violet-300" />
                </div>
                <p className="mt-1 text-xl font-bold tabular-nums">{ticketStatus}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">Recorded for this project</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Project members <Users className="size-4 text-violet-600 dark:text-violet-300" />
                </div>
                <p className="mt-1 text-xl font-bold tabular-nums">{project.member_count}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">Current members</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Start date <CalendarDays className="size-4 text-violet-600 dark:text-violet-300" />
                </div>
                <p className="mt-1 text-base font-bold">{formatDate(project.start_date)}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  End date <Clock className="size-4 text-violet-600 dark:text-violet-300" />
                </div>
                <p className="mt-1 text-base font-bold">{formatDate(project.end_date)}</p>
              </article>
            </section>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 space-y-2.5">
                <ProjectDetailCard title="Project overview" icon={<FolderKanban className="size-4" />}>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {project.description || "No project description has been provided."}
                  </p>
                  <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 dark:border-slate-800">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Project manager</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{project.project_manager.full_name}</p>
                      <p className="truncate text-[11px] text-slate-500">{project.project_manager.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned team</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{project.team.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Visibility</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{project.visibility}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Last updated</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{formatDate(project.updated_at)}</p>
                    </div>
                  </div>
                </ProjectDetailCard>

                <ProjectDetailCard title="Project files" icon={<FolderKanban className="size-4" />}>
                  <AttachmentsPanel projectId={project.id} />
                </ProjectDetailCard>

                <ProjectDetailCard
                  title="Project tickets"
                  icon={<TicketIcon className="size-4" />}
                  action={(
                    <Link
                      href={`/dashboard/tickets/new?project_id=${encodeURIComponent(project.id)}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-700 px-2.5 text-[11px] font-semibold text-white hover:bg-violet-800"
                    >
                      <Plus className="size-3.5" />
                      Create ticket
                    </Link>
                  )}
                >
                  <p className="-mt-1 mb-2 text-[11px] text-slate-500">Tickets associated with this project</p>
                  {ticketsQuery.isLoading ? (
                    <div className="flex justify-center p-5"><Loader2 className="size-4 animate-spin text-violet-600" /></div>
                  ) : ticketsQuery.isError ? (
                    <p className="text-xs text-rose-600">Unable to load project tickets. {ticketsQuery.error.message}</p>
                  ) : tickets.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center dark:border-slate-700">
                      <TicketIcon className="mx-auto mb-2 size-6 text-slate-400" />
                      <p className="text-xs font-semibold">No tickets found</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">Create the first ticket for this project.</p>
                    </div>
                  ) : (
                    <div className="max-h-[320px] overflow-auto rounded-lg border border-slate-100 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-950">
                          <tr>
                            <th className="px-2.5 py-2">Ticket</th>
                            <th className="px-2.5 py-2">Priority</th>
                            <th className="px-2.5 py-2">Status</th>
                            <th className="px-2.5 py-2">Due date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {tickets.map((ticket) => (
                            <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-2.5 py-2">
                                <Link href={`/dashboard/tickets/${ticket.id}`} className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
                                  {ticket.ticket_key}
                                </Link>
                                <p className="mt-0.5 max-w-xs truncate text-[11px] text-slate-500">{ticket.title}</p>
                              </td>
                              <td className="whitespace-nowrap px-2.5 py-2">{ticket.priority}</td>
                              <td className="px-2.5 py-2">
                                <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold dark:bg-slate-800">{ticket.status.replaceAll("_", " ")}</span>
                              </td>
                              <td className="whitespace-nowrap px-2.5 py-2 text-[11px] text-slate-500">{formatDate(ticket.due_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {ticketTotal > tickets.length && (
                        <p className="border-t border-slate-100 px-2.5 py-2 text-[11px] text-slate-500 dark:border-slate-800">
                          Showing {tickets.length} of {ticketTotal} tickets. Open the Tickets page to access the remaining records.
                        </p>
                      )}
                    </div>
                  )}
                </ProjectDetailCard>

                {projectOverviewQuery.isLoading ? (
                  <ProjectDetailCard title="Recent activities" icon={<Activity className="size-4" />}>
                    <div className="space-y-2"><div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" /><div className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" /></div>
                  </ProjectDetailCard>
                ) : projectOverviewQuery.isError ? (
                  <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                    Unable to load project analytics. {projectOverviewQuery.error.message}
                    <button type="button" onClick={() => projectOverviewQuery.refetch()} className="ml-2 font-semibold underline">Try again</button>
                  </div>
                ) : projectOverview ? (
                  <ProjectDetailCard title="Recent activities" icon={<Activity className="size-4" />}>
                    {projectOverview.recent_activities.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500 dark:border-slate-700">No recent ticket activity.</p>
                    ) : (
                      <div className="max-h-[320px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
                        {projectOverview.recent_activities.map((item) => (
                          <Link key={item.id} href={`/dashboard/tickets/${item.ticket_id}`} className="block py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{item.actor_name} · {item.action.replaceAll("_", " ").toLowerCase()}</p>
                              <span className="text-[10px] text-slate-400">{formatDate(item.created_at)}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">{item.description || `${item.ticket_key} · ${item.ticket_title}`}</p>
                            <p className="mt-0.5 text-[10px] text-slate-400">{item.ticket_key}</p>
                          </Link>
                        ))}
                      </div>
                    )}
                  </ProjectDetailCard>
                ) : null}
              </div>

              <aside className="min-w-0 space-y-2.5">
                <ProjectDetailCard title="Project information" icon={<FolderKanban className="size-4" />}>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{statusLabels[project.status]}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Members</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{project.member_count}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Start date</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{formatDate(project.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">End date</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{formatDate(project.end_date)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Project manager</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{project.project_manager.full_name}</p>
                      <p className="truncate text-[11px] text-slate-500">{project.project_manager.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Team</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{project.team.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Visibility</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{project.visibility}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Last updated</p>
                      <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{formatDate(project.updated_at)}</p>
                    </div>
                  </div>
                </ProjectDetailCard>

                {projectOverviewQuery.isLoading ? (
                  <ProjectDetailCard title="Project progress" icon={<CheckCircle2 className="size-4" />}>
                    <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                  </ProjectDetailCard>
                ) : projectOverview && (
                  <ProjectDetailCard title="Project progress" icon={<CheckCircle2 className="size-4" />}>
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-2xl font-bold tracking-tight">{projectOverview.completion_percentage.toLocaleString("en-IN")}%</p>
                      <p className="text-right text-[10px] text-slate-500">{projectOverview.completed_tickets} of {projectOverview.total_tickets} completed</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label="Project ticket completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={projectOverview.completion_percentage}>
                      <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${projectOverview.completion_percentage}%` }} />
                    </div>
                    {projectOverview.total_tickets === 0 && <p className="mt-2 text-[10px] text-slate-400">Create project tickets to begin tracking progress.</p>}
                  </ProjectDetailCard>
                )}

                {projectOverview && (
                  <ProjectDetailCard title="Ticket distribution" icon={<TicketIcon className="size-4" />}>
                    {projectOverview.total_tickets === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-500 dark:border-slate-700">No tickets are recorded for this project yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {projectOverview.ticket_distribution.filter((item) => item.count > 0).sort((a, b) => b.count - a.count).map((item) => (
                          <div key={item.status}>
                            <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
                              <span className="truncate text-slate-600 dark:text-slate-300">{item.status.replaceAll("_", " ")}</span>
                              <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{item.count}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div className="h-full rounded-full bg-violet-500" style={{ width: `${(item.count / projectOverview.total_tickets) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ProjectDetailCard>
                )}

                <ProjectDetailCard
                  title="Project members"
                  icon={<Users className="size-4" />}
                  action={(
                    <button
                      type="button"
                      onClick={() => setShowMemberPicker((value) => !value)}
                      disabled={isArchived}
                      className="inline-flex size-7 items-center justify-center rounded-lg bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-40"
                      aria-label="Add project member"
                    >
                      {showMemberPicker ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
                    </button>
                  )}
                >
                  {showMemberPicker && (
                    <div className="mb-2 space-y-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                      {optionsQuery.isLoading ? (
                        <Loader2 className="size-4 animate-spin text-violet-600" />
                      ) : optionsQuery.isError ? (
                        <p className="text-xs text-rose-600">{optionsQuery.error.message}</p>
                      ) : availableMembers.length === 0 ? (
                        <p className="text-[11px] text-slate-500">No additional eligible team members are available.</p>
                      ) : (
                        <>
                          <label className="block text-[11px] font-medium text-slate-500">
                            Select a team member
                            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950">
                              <option value="">Choose employee</option>
                              {availableMembers.map((member) => <option key={member.id} value={member.id}>{member.full_name} ({member.role_code})</option>)}
                            </select>
                          </label>
                          <button type="button" disabled={!selectedUserId || addMemberMutation.isPending} onClick={() => addMemberMutation.mutate()} className="w-full rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                            {addMemberMutation.isPending ? "Adding..." : "Add member"}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="max-h-[280px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
                    {project.members.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-500">No members assigned.</p>
                    ) : (
                      project.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{member.user.full_name}</p>
                            <p className="truncate text-[10px] text-slate-500">{member.user.role_code} · Joined {formatDate(member.joined_at)}</p>
                          </div>
                          <button type="button" onClick={() => handleRemoveMember(member.user.id, member.user.full_name)} disabled={isArchived || removeMemberMutation.isPending} aria-label={`Remove ${member.user.full_name}`} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-950">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </ProjectDetailCard>

                {projectOverview && (
                  <ProjectDetailCard title="Upcoming deadlines" icon={<CalendarDays className="size-4" />}>
                    {projectOverview.upcoming_deadlines.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-[11px] text-slate-500 dark:border-slate-700">No upcoming deadlines.</p>
                    ) : (
                      <div className="max-h-[220px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
                        {projectOverview.upcoming_deadlines.map((item) => (
                          <Link key={item.ticket_id} href={`/dashboard/tickets/${item.ticket_id}`} className="flex items-center justify-between gap-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <span className="min-w-0">
                              <span className="block truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">{item.ticket_key} · {item.title}</span>
                              <span className="mt-0.5 block truncate text-[10px] text-slate-500">{item.status.replaceAll("_", " ")} · {item.assignee_name || item.tester_name || "Unassigned"}</span>
                            </span>
                            <span className="shrink-0 text-right text-[10px] font-semibold text-slate-600 dark:text-slate-300">{formatDate(item.due_date)}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </ProjectDetailCard>
                )}
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
