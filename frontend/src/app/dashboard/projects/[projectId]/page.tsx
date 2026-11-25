"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  Pencil,
  Plus,
  RefreshCw,
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
  getProjectOptions,
  removeProjectMember,
  updateProject,
  type ProjectStatus,
} from "@/features/projects/api/projects-api";

import { getTickets } from "@/features/tickets/api/tickets-api";
import { AttachmentsPanel } from "@/features/attachments/components/attachments-panel";

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

export default function ProjectDetailsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const queryClient = useQueryClient();

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
    enabled: Boolean(projectId),
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

  if (projectQuery.isLoading) {
    return (
      <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
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

  const isArchived = project.status === "ARCHIVED" || Boolean(project.archived_at);

  return (
    <main className="workspace-shell min-h-screen bg-slate-50 px-3 py-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link
              href="/dashboard/projects"
              className="mb-2 inline-flex items-center gap-2 text-xs text-slate-500 transition hover:text-violet-600"
            >
              <ArrowLeft size={16} />
              Back to projects
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg bg-violet-100 p-2 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <FolderKanban size={25} />
              </div>

              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {project.name}
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  {project.key} · Created {formatDate(project.created_at)}
                </p>
              </div>

              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyles[project.status]}`}>
                {statusLabels[project.status]}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => projectQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
            >
              <RefreshCw size={15} /> Refresh
            </button>

            {!isArchived && (
              <>
                <button
                  onClick={beginEditing}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                >
                  <Pencil size={15} /> Edit
                </button>

                <button
                  onClick={handleArchive}
                  disabled={archiveMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <Archive size={15} /> Archive
                </button>
              </>
            )}
          </div>
        </div>

        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Dismiss message">
              <X size={16} />
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-xs text-slate-500">
              Total tickets <TicketIcon size={19} />
            </div>
            <p className="mt-1.5 text-2xl font-bold">{ticketStatus}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Recorded for this project</p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-xs text-slate-500">
              Project members <Users size={19} />
            </div>
            <p className="mt-1.5 text-2xl font-bold">{project.member_count}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Current members</p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-xs text-slate-500">
              Start date <CalendarDays size={19} />
            </div>
            <p className="mt-1.5 text-lg font-bold">
              {formatDate(project.start_date)}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-xs text-slate-500">
              End date <Clock size={19} />
            </div>
            <p className="mt-1.5 text-lg font-bold">
              {formatDate(project.end_date)}
            </p>
          </article>
        </section>

        <section className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-2.5 lg:col-span-2">
            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 text-base font-semibold">Project overview</h2>

              <p className="min-h-0 whitespace-pre-wrap text-xs leading-5 text-slate-600 dark:text-slate-300">
                {project.description || "No project description has been provided."}
              </p>

              <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Project manager
                  </p>
                  <p className="mt-1 text-sm font-semibold">{project.project_manager.full_name}</p>
                  <p className="text-xs text-slate-500">{project.project_manager.email}</p>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Assigned team
                  </p>
                  <p className="mt-1 text-sm font-semibold">{project.team.name}</p>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Visibility
                  </p>
                  <p className="mt-1 text-sm font-semibold">{project.visibility}</p>
                </div>

                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Last updated
                  </p>
                  <p className="mt-1 text-sm font-semibold">{formatDate(project.updated_at)}</p>
                </div>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-3 text-base font-semibold">Project files</h2>
              <AttachmentsPanel projectId={project.id} />
            </article>

            <article className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-semibold">Project tickets</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Tickets associated with this project
                  </p>
                </div>

                <Link
                  href={`/dashboard/tickets/new?project_id=${encodeURIComponent(project.id)}`}
                  className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800"
                >
                  Create ticket
                </Link>
              </div>

              {ticketsQuery.isLoading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="animate-spin text-violet-600" />
                </div>
              ) : ticketsQuery.isError ? (
                <p className="p-4 text-sm text-rose-600">
                  Unable to load project tickets. {ticketsQuery.error.message}
                </p>
              ) : tickets.length === 0 ? (
                <div className="p-6 text-center">
                  <TicketIcon className="mx-auto mb-3 text-slate-400" size={28} />
                  <p className="font-medium">No tickets found</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Create the first ticket for this project.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950">
                      <tr>
                        <th className="px-3 py-2">Ticket</th>
                        <th className="px-3 py-2">Priority</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Due date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {tickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2">
                            <Link
                              href={`/dashboard/tickets/${ticket.id}`}
                              className="font-medium text-violet-700 hover:underline dark:text-violet-300"
                            >
                              {ticket.ticket_key}
                            </Link>
                            <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                              {ticket.title}
                            </p>
                          </td>
                          <td className="px-3 py-2">{ticket.priority}</td>
                          <td className="px-3 py-2">
                            <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">
                              {ticket.status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                            {formatDate(ticket.due_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ticketTotal > tickets.length && (
                    <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
                      Showing {tickets.length} of {ticketTotal} tickets.
                      Open the Tickets page to access the remaining records.
                    </p>
                  )}
                </div>
              )}
            </article>
          </div>

          <aside className="w-full self-start rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold">Project members</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {project.members.length} current members
                </p>
              </div>
              <button
                onClick={() => setShowMemberPicker((value) => !value)}
                disabled={isArchived}
                className="rounded-lg bg-violet-700 p-2 text-white hover:bg-violet-800 disabled:opacity-40"
                aria-label="Add project member"
              >
                {showMemberPicker ? <X size={17} /> : <Plus size={17} />}
              </button>
            </div>

            {showMemberPicker && (
              <div className="space-y-2 border-b border-slate-100 p-3 dark:border-slate-800">
                {optionsQuery.isLoading ? (
                  <Loader2 className="animate-spin text-violet-600" />
                ) : optionsQuery.isError ? (
                  <p className="text-xs text-rose-600">
                    {optionsQuery.error.message}
                  </p>
                ) : availableMembers.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No additional eligible team members are available.
                  </p>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-slate-500">
                      Select a team member
                      <select
                        value={selectedUserId}
                        onChange={(event) => setSelectedUserId(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="">Choose employee</option>
                        {availableMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name} ({member.role_code})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={!selectedUserId || addMemberMutation.isPending}
                      onClick={() => addMemberMutation.mutate()}
                      className="w-full rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {addMemberMutation.isPending ? "Adding..." : "Add member"}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {project.members.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-500">
                  No members assigned.
                </p>
              ) : (
                project.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {member.user.full_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {member.user.role_code} · Joined {formatDate(member.joined_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(
                        member.user.id,
                        member.user.full_name,
                      )}
                      disabled={isArchived || removeMemberMutation.isPending}
                      aria-label={`Remove ${member.user.full_name}`}
                      className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-950"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        </section>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <CheckCircle2 size={14} />
          Project information is loaded from the WorkSphere backend.
          <Activity size={14} className="ml-2" />
          Activity, attachment and GitHub panels require their corresponding APIs.
        </div>
      </div>
    </main>
  );
}
