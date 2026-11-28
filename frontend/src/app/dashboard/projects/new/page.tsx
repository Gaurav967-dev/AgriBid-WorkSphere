
"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    FolderKanban,
    Menu,
    PanelLeft,
    Plus,
    RefreshCw,
    ShieldCheck,
    Users,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";

import {
    createProject,
    getProjectOptions,
    type CreateProjectInput,
    type ProjectStatus,
} from "@/features/projects/api/projects-api";

import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

type FormState = {
    name: string;
    key: string;
    description: string;
    project_manager_id: string;
    team_id: string;
    member_ids: string[];
    start_date: string;
    end_date: string;
    status: Exclude<ProjectStatus, "ARCHIVED">;
    visibility: "INTERNAL" | "PRIVATE";
};

const INITIAL_FORM: FormState = {
    name: "",
    key: "",
    description: "",
    project_manager_id: "",
    team_id: "",
    member_ids: [],
    start_date: "",
    end_date: "",
    status: "PLANNING",
    visibility: "INTERNAL",
};

const INPUT_CLASS =
    "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-violet-950 dark:disabled:bg-slate-900";

const TEXTAREA_CLASS =
    "mt-1.5 min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-violet-950";

const LABEL_CLASS =
    "text-xs font-semibold text-slate-700 dark:text-slate-300";

const ROLE_LABELS: Record<string, string> = {
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
    icon: ReactNode;
    children: ReactNode;
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

export default function CreateProjectPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [formError, setFormError] = useState<string | null>(null);

    const { collapsed, toggleCollapsed } = useWorkspaceSidebarState();

    const canManageProjects =
        user?.role_code === "ADMIN" || user?.role_code === "PM";

    const selectedManagerId =
        form.project_manager_id ||
        (user?.role_code === "PM" ? user.id ?? "" : "");

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
        queryKey: ["project-form-options", form.team_id],
        queryFn: () => getProjectOptions(form.team_id || undefined),
        enabled: !isCheckingAuth && canManageProjects,
    });

    const teams = optionsQuery.data?.teams ?? [];
    const managers = optionsQuery.data?.project_managers ?? [];
    const teamMembers = optionsQuery.data?.team_members ?? [];

    const createMutation = useMutation({
        mutationFn: (input: CreateProjectInput) => createProject(input),

        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["projects"],
            });

            router.push("/dashboard/projects");
        },
    });

    function handleTeamChange(teamId: string) {
        setForm((current) => ({
            ...current,
            team_id: teamId,
            member_ids: [],
        }));

        setFormError(null);
    }

    function handleMemberToggle(memberId: string, checked: boolean) {
        setForm((current) => ({
            ...current,
            member_ids: checked
                ? [...current.member_ids, memberId]
                : current.member_ids.filter((id) => id !== memberId),
        }));

        setFormError(null);
    }

    function handleKeyChange(value: string) {
        updateField(
            "key",
            value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 20),
        );
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError(null);

        const name = form.name.trim();
        const key = form.key.trim().toUpperCase();

        if (!name) {
            setFormError("Project name is required.");
            return;
        }

        if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(key)) {
            setFormError(
                "Project key must start with a letter and contain 2–20 uppercase letters, numbers or underscores.",
            );
            return;
        }

        if (!form.team_id) {
            setFormError("Please select an active team.");
            return;
        }

        if (!selectedManagerId) {
            setFormError("Please select a project manager.");
            return;
        }

        if (
            !managers.some((manager) => manager.id === selectedManagerId)
        ) {
            setFormError(
                "The selected project manager is not available.",
            );
            return;
        }

        if (
            !teamMembers.length &&
            form.member_ids.length
        ) {
            setFormError(
                "Project member options are unavailable. Reload the team options.",
            );
            return;
        }

        const validMemberIds = new Set(
            teamMembers.map((member) => member.id),
        );

        if (form.member_ids.some((id) => !validMemberIds.has(id))) {
            setFormError(
                "One or more selected members are not active members of this team.",
            );
            return;
        }

        if (
            form.start_date &&
            form.end_date &&
            form.end_date < form.start_date
        ) {
            setFormError(
                "Project end date cannot be earlier than its start date.",
            );
            return;
        }

        const input: CreateProjectInput = {
            name,
            key,
            description: form.description.trim() || null,
            project_manager_id: selectedManagerId,
            team_id: form.team_id,
            member_ids: form.member_ids,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            status: form.status,
            visibility: form.visibility,
        };

        createMutation.mutate(input);
    }

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

    if (!canManageProjects) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
                <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <ShieldCheck className="mx-auto size-10 text-rose-500" />
                    <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                        Access restricted
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Only Administrators and Project Managers can create projects.
                    </p>
                    <Link
                        href="/dashboard/projects"
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800"
                    >
                        <ArrowLeft className="size-4" />
                        Back to projects
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

                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                                Create project
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
                            href="/dashboard/projects"
                            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300"
                        >
                            <ArrowLeft className="size-3.5" />
                            Back to projects
                        </Link>

                        <div className="mt-2">
                            <h1 className="mt-0 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Create a new project
                            </h1>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Configure the project, assign its manager and organize its team.
                            </p>
                        </div>

                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                            <div className="text-xs leading-5 text-sky-800 dark:text-sky-200">
                                <p className="font-semibold">Project setup</p>
                                <p className="mt-1">
                                    Each project needs a unique key, an active team and
                                    an eligible Project Manager. Only active members
                                    of the selected team can be added.
                                </p>
                            </div>
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            className="mt-2 space-y-2"
                        >
                            <FormSection
                                title="Basic information"
                                description="Provide the project's name, identifier and description."
                                icon={<FolderKanban className="size-4" />}
                            >
                                <div>
                                    <label htmlFor="project_name" className={LABEL_CLASS}>
                                        Project name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="project_name"
                                        required
                                        maxLength={150}
                                        value={form.name}
                                        onChange={(event) =>
                                            updateField("name", event.target.value)
                                        }
                                        placeholder="e.g. AgriBid Website"
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="project_key" className={LABEL_CLASS}>
                                        Project key <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="project_key"
                                        required
                                        maxLength={20}
                                        value={form.key}
                                        onChange={(event) =>
                                            handleKeyChange(event.target.value)
                                        }
                                        placeholder="e.g. AGRI"
                                        className={`${INPUT_CLASS} font-mono uppercase`}
                                    />
                                    <p className="mt-1.5 text-[10px] text-slate-400">
                                        2–20 characters. Starts with a letter.
                                        Letters, numbers and underscores only.
                                    </p>
                                </div>

                                <div className="sm:col-span-2">
                                    <label htmlFor="description" className={LABEL_CLASS}>
                                        Project description
                                    </label>
                                    <textarea
                                        id="description"
                                        maxLength={5000}
                                        value={form.description}
                                        onChange={(event) =>
                                            updateField("description", event.target.value)
                                        }
                                        placeholder="Describe the project's purpose, objectives and scope..."
                                        className={TEXTAREA_CLASS}
                                    />
                                    <p className="mt-1 text-right text-[10px] text-slate-400">
                                        {form.description.length}/5000
                                    </p>
                                </div>
                            </FormSection>

                            <FormSection
                                title="Project ownership and team"
                                description="Choose the project manager and the team responsible for the work."
                                icon={<Users className="size-4" />}
                            >
                                {optionsQuery.isLoading && (
                                    <div className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-500">
                                        <RefreshCw className="size-4 animate-spin" />
                                        Loading project options...
                                    </div>
                                )}

                                {optionsQuery.isError && (
                                    <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                                        Unable to load project options.{" "}
                                        {optionsQuery.error instanceof Error
                                            ? optionsQuery.error.message
                                            : "Please try again."}
                                        <button
                                            type="button"
                                            onClick={() => optionsQuery.refetch()}
                                            className="ml-2 font-semibold underline"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="project_manager" className={LABEL_CLASS}>
                                        Project manager <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        id="project_manager"
                                        required
                                        value={selectedManagerId}
                                        onChange={(event) =>
                                            updateField(
                                                "project_manager_id",
                                                event.target.value,
                                            )
                                        }
                                        disabled={
                                            optionsQuery.isLoading ||
                                            user.role_code === "PM"
                                        }
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">
                                            Select a project manager
                                        </option>
                                        {managers.map((manager) => (
                                            <option
                                                key={manager.id}
                                                value={manager.id}
                                            >
                                                {manager.full_name} — {ROLE_LABELS[manager.role_code]}
                                            </option>
                                        ))}
                                    </select>
                                    {user.role_code === "PM" && (
                                        <p className="mt-1.5 text-[11px] text-slate-400">
                                            Your account will automatically be assigned as project manager.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="team_id" className={LABEL_CLASS}>
                                        Assigned team <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        id="team_id"
                                        required
                                        value={form.team_id}
                                        onChange={(event) =>
                                            handleTeamChange(event.target.value)
                                        }
                                        disabled={optionsQuery.isLoading}
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">Select an active team</option>
                                        {teams.map((team) => (
                                            <option key={team.id} value={team.id}>
                                                {team.name}
                                            </option>
                                        ))}
                                    </select>
                                    {!optionsQuery.isLoading && teams.length === 0 && (
                                        <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                                            No active teams found. Create a team first.
                                        </p>
                                    )}
                                </div>

                                <div className="sm:col-span-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className={LABEL_CLASS}>
                                            Project members
                                        </label>
                                        <span className="text-[10px] text-slate-400">
                                            {form.member_ids.length} selected
                                        </span>
                                    </div>

                                    {!form.team_id ? (
                                        <p className="mt-2 rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-400 dark:border-slate-700">
                                            Select a team to view its active members.
                                        </p>
                                    ) : optionsQuery.isFetching ? (
                                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-700">
                                            <RefreshCw className="size-4 animate-spin" />
                                            Loading team members...
                                        </div>
                                    ) : teamMembers.length === 0 ? (
                                        <p className="mt-2 rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-400 dark:border-slate-700">
                                            No active members are currently available for this team.
                                        </p>
                                    ) : (
                                        <>
                                            <details className="relative mt-2">
                                                <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition hover:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
                                                    <span>{form.member_ids.length > 0 ? `${form.member_ids.length} project members selected` : "Select project members"}</span>
                                                    <ChevronDown className="size-4 text-slate-400" />
                                                </summary>
                                                <div className="absolute left-0 right-0 top-11 z-30 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                                    {teamMembers.map((member) => {
                                                        const checked = form.member_ids.includes(member.id);
                                                        return (
                                                            <label
                                                                key={member.id}
                                                                className={`flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition ${checked ? "bg-violet-50 dark:bg-violet-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={(event) => handleMemberToggle(member.id, event.target.checked)}
                                                                    className="size-4 accent-violet-700"
                                                                />
                                                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                                                                    {member.full_name.trim().split(/\\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                                                                </span>
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{member.full_name}</span>
                                                                    <span className="block text-[10px] text-slate-400">{ROLE_LABELS[member.role_code] ?? member.role_code}</span>
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </details>
                                            {form.member_ids.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {teamMembers.filter((member) => form.member_ids.includes(member.id)).map((member) => (
                                                        <span key={member.id} className="rounded-md bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{member.full_name}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="mt-1.5 text-[11px] text-slate-400">
                                                Select multiple active members from the assigned team.
                                            </p>
                                        </>
                                    )}
                                </div>
                            </FormSection>

                            <FormSection
                                title="Timeline and configuration"
                                description="Set the expected project schedule and visibility."
                                icon={<CalendarDays className="size-4" />}
                            >
                                <div>
                                    <label htmlFor="start_date" className={LABEL_CLASS}>
                                        Start date
                                    </label>
                                    <input
                                        id="start_date"
                                        type="date"
                                        min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)}
                                        value={form.start_date}
                                        onChange={(event) =>
                                            updateField("start_date", event.target.value)
                                        }
                                        max={form.end_date || undefined}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="end_date" className={LABEL_CLASS}>
                                        End date
                                    </label>
                                    <input
                                        id="end_date"
                                        type="date"
                                        value={form.end_date}
                                        onChange={(event) =>
                                            updateField("end_date", event.target.value)
                                        }
                                        min={form.start_date || undefined}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="status" className={LABEL_CLASS}>
                                        Project status
                                    </label>
                                    <select
                                        id="status"
                                        value={form.status}
                                        onChange={(event) =>
                                            updateField(
                                                "status",
                                                event.target.value as FormState["status"],
                                            )
                                        }
                                        className={INPUT_CLASS}
                                    >
                                        <option value="PLANNING">Planning</option>
                                        <option value="ACTIVE">Active</option>
                                        <option value="ON_HOLD">On hold</option>
                                        <option value="COMPLETED">Completed</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="visibility" className={LABEL_CLASS}>
                                        Project visibility
                                    </label>
                                    <select
                                        id="visibility"
                                        value={form.visibility}
                                        onChange={(event) =>
                                            updateField(
                                                "visibility",
                                                event.target.value as FormState["visibility"],
                                            )
                                        }
                                        className={INPUT_CLASS}
                                    >
                                        <option value="INTERNAL">Internal</option>
                                        <option value="PRIVATE">Private</option>
                                    </select>
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
                                            Unable to create project
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
                                    href="/dashboard/projects"
                                    className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                    Cancel
                                </Link>

                                <button
                                    type="submit"
                                    disabled={
                                        createMutation.isPending ||
                                        optionsQuery.isLoading ||
                                        teams.length === 0 ||
                                        managers.length === 0
                                    }
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {createMutation.isPending ? (
                                        <>
                                            <RefreshCw className="size-4 animate-spin" />
                                            Creating project...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="size-4" />
                                            Create project
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