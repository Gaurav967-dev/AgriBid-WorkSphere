"use client";

import {
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Archive,
    CircleAlert,
    Crown,
    Menu,
    PanelLeft,
    Pencil,
    Plus,
    RefreshCw,
    ShieldCheck,
    UserPlus,
    Users,
    X,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";

import {
    addTeamMember,
    archiveTeam,
    createTeam,
    getActiveUsers,
    getTeam,
    getTeams,
    removeTeamMember,
    updateTeam,
    updateTeamLead,
    type CreateTeamInput,
    type Team,
    type TeamDetails,
    type TeamListStatus,
    type TeamUser,
} from "@/features/teams/api/teams-api";

import TeamLine from "@/features/teams/components/team-line";
import { TeamsFilter } from "@/features/teams/components/teams-filter";
import { TeamsDisplayOptions } from "@/features/teams/components/teams-display-options";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";
import { MultiSelectDropdown } from "@/components/multi-select-dropdown";
import { WorkspaceActions } from "@/components/workspace-actions";

import {
    DEFAULT_TEAM_DISPLAY_PROPERTIES,
    type MembershipFilter,
    type TeamDisplayProperties,
    type TeamsOrdering,
    type TeamsSort,
} from "@/features/teams/components/teams-ui-types";

const PAGE_SIZE = 100;
const EMPTY_TEAMS: Team[] = [];
const EMPTY_USERS: TeamUser[] = [];

type FormMode = "create" | "edit" | null;

function formatDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
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

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}

function roleLabel(role: string): string {
    const labels: Record<string, string> = {
        ADMIN: "Admin",
        PM: "Project Manager",
        DEVELOPER: "Developer",
        TESTER: "Tester",
    };

    return labels[role] ?? role;
}

function StatusBadge({ status }: { status: string }) {
    const active = status === "ACTIVE";

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${active
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
        >
            <span
                className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"
                    }`}
            />
            {active ? "Active" : "Archived"}
        </span>
    );
}

function TeamAvatar({
    user,
    size = "normal",
}: {
    user: TeamUser | null;
    size?: "normal" | "small";
}) {
    const sizeClass = size === "small" ? "size-7 text-[10px]" : "size-9 text-xs";

    if (!user) {
        return (
            <span
                className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-100 font-semibold text-slate-400 dark:border-slate-900 dark:bg-slate-800`}
                title="No team lead assigned"
            >
                ?
            </span>
        );
    }

    return (
        <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-violet-100 font-bold text-violet-800 dark:border-slate-900 dark:bg-violet-950 dark:text-violet-200 ${sizeClass}`}
            title={user.full_name}
        >
            {getInitials(user.full_name)}
        </span>
    );
}

export default function TeamsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    const { collapsed, toggleCollapsed } = useWorkspaceSidebarState();

    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<TeamListStatus>("ACTIVE");

    const [formMode, setFormMode] = useState<FormMode>(null);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [teamName, setTeamName] = useState("");
    const [teamDescription, setTeamDescription] = useState("");
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [leadUserId, setLeadUserId] = useState("");

    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [newMemberId, setNewMemberId] = useState("");
    const [newMemberDesignation, setNewMemberDesignation] = useState("");

    const [membershipFilters, setMembershipFilters] = useState<
        MembershipFilter[]
    >([]);

    const [identifierFilters, setIdentifierFilters] = useState<string[]>([]);

    const [sort, setSort] = useState<TeamsSort>("name-asc");

    const [displayProperties, setDisplayProperties] =
        useState<TeamDisplayProperties>({
            ...DEFAULT_TEAM_DISPLAY_PROPERTIES,
        });

    useEffect(() => {
        let active = true;

        verifyToken()
            .then(({ user: verifiedUser }) => {
                if (!active) return;
                setUser(verifiedUser);
                setIsCheckingAuth(false);
            })
            .catch(() => {
                if (active) {
                    router.replace("/");
                }
            });

        return () => {
            active = false;
        };
    }, [router]);

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

    const isAdmin = user?.role_code === "ADMIN";

    const teamsQuery = useQuery({
        queryKey: ["teams", "list", page, statusFilter],
        queryFn: () => getTeams(page, PAGE_SIZE, "", statusFilter),
        enabled: !isCheckingAuth && isAdmin,
        placeholderData: (previousData) => previousData,
    });

    const usersQuery = useQuery({
        queryKey: ["teams", "active-users"],
        queryFn: () => getActiveUsers(1, 100),
        enabled: !isCheckingAuth && isAdmin,
        staleTime: 60_000,
    });

    const detailQuery = useQuery({
        queryKey: ["teams", "detail", selectedTeamId],
        queryFn: () => getTeam(selectedTeamId as string),
        enabled: Boolean(selectedTeamId) && !isCheckingAuth && isAdmin,
    });

    const employees = usersQuery.data?.items ?? EMPTY_USERS;
    const teams = teamsQuery.data?.items ?? EMPTY_TEAMS;
    const total = teamsQuery.data?.total ?? 0;
    const latestTeamUpdate = teams
        .map((team) => team.updated_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    const displayedTeams = useMemo(() => {
        let list = [...teams];

        if (membershipFilters.length > 0) {
            const selected = new Set(membershipFilters);

            list = list.filter((team) =>
                selected.has(team.is_joined ? "Joined" : "Not-Joined"),
            );
        }

        if (identifierFilters.length > 0) {
            const selected = new Set(identifierFilters);

            list = list.filter((team) =>
                selected.has(team.id.slice(0, 8).toUpperCase()),
            );
        }

        list.sort((a, b) => {
            switch (sort) {
                case "name-asc":
                    return a.name.localeCompare(b.name);

                case "name-desc":
                    return b.name.localeCompare(a.name);

                case "members-asc":
                    return a.member_count - b.member_count;

                case "members-desc":
                    return b.member_count - a.member_count;

                case "projects-asc":
                case "projects-desc":
                    // Project counts are not available from the current API.
                    return a.name.localeCompare(b.name);

                default:
                    return a.name.localeCompare(b.name);
            }
        });

        return list;
    }, [teams, membershipFilters, identifierFilters, sort]);

    const ordering: TeamsOrdering = sort.startsWith("members")
        ? "members"
        : sort.startsWith("projects")
            ? "projects"
            : "name";

    function handleOrderingChange(value: TeamsOrdering) {
        setSort(
            value === "members"
                ? "members-desc"
                : value === "projects"
                    ? "projects-desc"
                    : "name-asc",
        );
    }

    function toggleMembership(value: MembershipFilter) {
        setMembershipFilters((current) =>
            current.includes(value)
                ? current.filter((item) => item !== value)
                : [...current, value],
        );
    }

    function toggleIdentifier(value: string) {
        setIdentifierFilters((current) =>
            current.includes(value)
                ? current.filter((item) => item !== value)
                : [...current, value],
        );
    }

    function toggleDisplayProperty(key: keyof TeamDisplayProperties) {
        setDisplayProperties((current) => ({
            ...current,
            [key]: !current[key],
        }));
    }

    function clearTeamFilters() {
        setMembershipFilters([]);
        setIdentifierFilters([]);
        setStatusFilter("ACTIVE");
        setSort("name-asc");
        setPage(1);
    }

    const availableEmployees = useMemo(() => {
        const activeMemberIds = new Set(
            (detailQuery.data?.members ?? []).map((member) => member.user.id),
        );

        return employees.filter(
            (employee) => !activeMemberIds.has(employee.id),
        );
    }, [employees, detailQuery.data?.members]);

    function invalidateTeams(teamId?: string) {
        void queryClient.invalidateQueries({ queryKey: ["teams", "list"] });

        if (teamId) {
            void queryClient.invalidateQueries({
                queryKey: ["teams", "detail", teamId],
            });
        }
    }

    const createMutation = useMutation({
        mutationFn: createTeam,
        onSuccess: () => {
            invalidateTeams();
            closeTeamForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: (input: { teamId: string; data: { name: string; description: string | null } }) =>
            updateTeam(input.teamId, input.data),
        onSuccess: (_data, variables) => {
            invalidateTeams(variables.teamId);
            closeTeamForm();
        },
    });

    const archiveMutation = useMutation({
        mutationFn: archiveTeam,
        onSuccess: (_data, teamId) => {
            invalidateTeams(teamId);
            setSelectedTeamId(null);
        },
    });

    const addMemberMutation = useMutation({
        mutationFn: addTeamMember,
        onSuccess: (_data, variables) => {
            invalidateTeams(variables.teamId);
            setNewMemberId("");
            setNewMemberDesignation("");
        },
    });

    const removeMemberMutation = useMutation({
        mutationFn: removeTeamMember,
        onSuccess: (_data, variables) => {
            invalidateTeams(variables.teamId);
        },
    });

    const leadMutation = useMutation({
        mutationFn: updateTeamLead,
        onSuccess: (_data, variables) => {
            invalidateTeams(variables.teamId);
        },
    });

    function closeTeamForm() {
        setFormMode(null);
        setEditingTeam(null);
        setTeamName("");
        setTeamDescription("");
        setSelectedMemberIds([]);
        setLeadUserId("");
    }

    function openCreateForm() {
        setEditingTeam(null);
        setTeamName("");
        setTeamDescription("");
        setSelectedMemberIds([]);
        setLeadUserId("");
        setFormMode("create");
    }

    function openEditForm(team: Team) {
        setEditingTeam(team);
        setTeamName(team.name);
        setTeamDescription(team.description ?? "");
        setSelectedMemberIds([]);
        setLeadUserId(team.lead?.id ?? "");
        setFormMode("edit");
    }

    function handleSaveTeam(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const name = teamName.trim();
        const description = teamDescription.trim() || null;

        if (!name) return;

        if (formMode === "create") {
            const input: CreateTeamInput = {
                name,
                description,
                lead_user_id: leadUserId || null,
                member_ids: selectedMemberIds,
            };

            createMutation.mutate(input);
        } else if (formMode === "edit" && editingTeam) {
            updateMutation.mutate({
                teamId: editingTeam.id,
                data: { name, description },
            });
        }
    }

    function handleArchive(team: Team) {
        const confirmed = window.confirm(
            `Archive "${team.name}"? Its membership history will be preserved.`,
        );

        if (confirmed) {
            archiveMutation.mutate(team.id);
        }
    }

    function handleRemoveMember(member: TeamDetails["members"][number]) {
        if (!selectedTeamId) return;

        const confirmed = window.confirm(
            `Remove ${member.user.full_name} from this team? Their membership history will be preserved.`,
        );

        if (confirmed) {
            removeMemberMutation.mutate({
                teamId: selectedTeamId,
                userId: member.user.id,
            });
        }
    }

    if (isCheckingAuth || !user) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <RefreshCw className="size-4 animate-spin" />
                    Verifying your session...
                </div>
            </main>
        );
    }

    if (!isAdmin) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
                <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <ShieldCheck className="mx-auto size-10 text-rose-500" />
                    <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                        Access restricted
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        Team Management is available only to Admin accounts.
                    </p>
                    <Link
                        href="/dashboard"
                        className="mt-4 inline-flex rounded-lg bg-violet-700 px-5 py-2 text-xs font-semibold text-white hover:bg-violet-800"
                    >
                        Return to dashboard
                    </Link>
                </section>
            </main>
        );
    }

    const formMutationError = createMutation.error ?? updateMutation.error;
    const detailTeam = detailQuery.data;

    return (
        <div className="workspace-shell flex h-svh min-h-0 w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <WorkspaceSidebar
                user={user}
                collapsed={collapsed}
                mobileOpen={isMobileNavOpen}
                onMobileClose={() => setIsMobileNavOpen(false)}
            />

            <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
                <div className="h-full min-h-0 flex-1 overflow-y-auto">
                    <main className="min-h-full w-full p-0">
                        <section className="w-full">
                            {/* Teams heading */}
                            <div className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                                <div className="flex items-center gap-2">
                                    {/* Desktop sidebar control */}
                                    <button
                                        type="button"
                                        onClick={toggleCollapsed}
                                        aria-label={
                                            collapsed
                                                ? "Expand sidebar"
                                                : "Collapse sidebar"
                                        }
                                        aria-expanded={!collapsed}
                                        className="hidden size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 md:flex dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        <PanelLeft className="size-4" />
                                    </button>

                                    {/* Mobile navigation control */}
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileNavOpen(true)}
                                        aria-label="Open navigation"
                                        aria-expanded={isMobileNavOpen}
                                        className="flex size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        <Menu className="size-4" />
                                    </button>

                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                        Teams
                                    </span>

                                    <span className="rounded-md bg-slate-100 px-1.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        {total}
                                    </span>
                                </div>

                                <WorkspaceActions
                                    user={user}
                                    lastUpdated={relativeUpdate(latestTeamUpdate)}
                                    onSignOut={handleSignOut}
                                    isSigningOut={isSigningOut}
                                />
                            </div>

                            {/* Filter and Display toolbar */}
                            <div className="sticky top-14 z-20 flex h-10 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                                <TeamsFilter
                                    teams={teams}
                                    membership={membershipFilters}
                                    identifiers={identifierFilters}
                                    status={statusFilter}
                                    sort={sort}
                                    onMembershipChange={toggleMembership}
                                    onIdentifierChange={toggleIdentifier}
                                    onStatusChange={(value) => {
                                        setStatusFilter(value);
                                        setPage(1);
                                    }}
                                    onSortChange={setSort}
                                    onClear={clearTeamFilters}
                                />

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={openCreateForm}
                                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                    >
                                        <Plus className="size-3.5" />
                                        Add team
                                    </button>
                                    <TeamsDisplayOptions
                                    ordering={ordering}
                                    displayProperties={displayProperties}
                                    onOrderingChange={handleOrderingChange}
                                    onToggleProperty={toggleDisplayProperty}
                                    />
                                </div>
                            </div>

                            {/* Column headers */}
                            <div className="sticky top-[5.25rem] z-10 flex w-full min-w-[760px] items-center border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 sm:px-6">
                                <div className="min-w-0 flex-1">Name</div>

                                {displayProperties.membership && (
                                    <div className="w-[15%] min-w-[130px] shrink-0">
                                        Membership
                                    </div>
                                )}

                                {displayProperties.owners && (
                                    <div className="hidden w-[70px] shrink-0 lg:block">
                                        Owners
                                    </div>
                                )}

                                <div className="w-[15%] min-w-[120px] shrink-0">
                                    Identifier
                                </div>

                                {displayProperties.members && (
                                    <div className="w-[15%] min-w-[150px] shrink-0">
                                        Members
                                    </div>
                                )}

                                {displayProperties.cycle && (
                                    <div className="hidden w-[80px] shrink-0 md:block">
                                        Cycle
                                    </div>
                                )}

                                {displayProperties.projects && (
                                    <div className="hidden w-[15%] min-w-[100px] shrink-0 sm:block">
                                        Projects
                                    </div>
                                )}

                                {displayProperties.created && (
                                    <div className="hidden w-[90px] shrink-0 xl:block">
                                        Created
                                    </div>
                                )}

                                {displayProperties.updated && (
                                    <div className="hidden w-[90px] shrink-0 xl:block">
                                        Updated
                                    </div>
                                )}
                            </div>

                            {/* Team rows */}
                            <div className="w-full">
                                {teamsQuery.isPending ? (
                                    <div className="flex min-h-32 items-center justify-center gap-2 text-xs text-slate-500">
                                        <RefreshCw className="size-4 animate-spin" />
                                        Loading teams...
                                    </div>
                                ) : teamsQuery.isError ? (
                                    <div className="flex min-h-32 flex-col items-center justify-center text-center">
                                        <CircleAlert className="size-6 text-rose-500" />
                                        <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                                            Unable to load teams
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {teamsQuery.error.message}
                                        </p>
                                    </div>
                                ) : displayedTeams.length === 0 ? (
                                    <div className="flex min-h-28 flex-col items-center justify-center text-center">
                                        <Users className="size-5 text-slate-300 dark:text-slate-600" />
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            {teams.length === 0
                                                ? "No teams yet"
                                                : "No teams match the selected filters"}
                                        </p>

                                        {teams.length === 0 && statusFilter !== "ARCHIVED" && (
                                            <button
                                                type="button"
                                                onClick={openCreateForm}
                                                className="mt-1 text-xs font-medium text-violet-700 hover:text-violet-900 dark:text-violet-300"
                                            >
                                                + Add team
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    displayedTeams.map((team) => (
                                        <TeamLine
                                            key={team.id}
                                            team={team}
                                            displayProperties={displayProperties}
                                            onOpen={() => setSelectedTeamId(team.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </section>
                    </main>
                </div>

                {/* Create / edit team dialog */}
                {formMode && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
                        <section
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="team-form-title"
                            className="my-3 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                        >
                            <div className="flex items-start justify-between border-b border-slate-100 p-4 dark:border-slate-800">
                                <div>
                                    <h2 id="team-form-title" className="text-base font-bold text-slate-900 dark:text-white">
                                        {formMode === "create" ? "Create team" : "Edit team"}
                                    </h2>
                                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                        {formMode === "create"
                                            ? "Add a team and optionally assign its initial members."
                                            : "Update the team's name and description."}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeTeamForm}
                                    aria-label="Close dialog"
                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveTeam} className="space-y-2.5 p-3">
                                {formMutationError && (
                                    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                                        {formMutationError.message}
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="team-name" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        Team name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="team-name"
                                        value={teamName}
                                        onChange={(event) => setTeamName(event.target.value)}
                                        required
                                        maxLength={100}
                                        placeholder="e.g. Backend Engineering"
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-violet-950"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="team-description" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        Description
                                    </label>
                                    <textarea
                                        id="team-description"
                                        value={teamDescription}
                                        onChange={(event) => setTeamDescription(event.target.value)}
                                        maxLength={2000}
                                        rows={3}
                                        placeholder="Describe the team's responsibilities..."
                                        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-violet-950"
                                    />
                                </div>

                                {formMode === "create" && (
                                    <>
                                        <div>
                                            <label htmlFor="team-members-search" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                Initial members
                                            </label>
                                            <MultiSelectDropdown
                                                id="team-members"
                                                label="Initial members"
                                                placeholder="Search active employees by name or email"
                                                selectedValues={selectedMemberIds}
                                                onChange={setSelectedMemberIds}
                                                options={employees.map((employee) => ({
                                                    value: employee.id,
                                                    label: employee.full_name,
                                                    description: `${roleLabel(employee.role_code)} · ${employee.email}`,
                                                }))}
                                                emptyMessage="No active employees are available."
                                            />
                                            <p className="mt-1.5 text-xs text-slate-400">
                                                Select or deselect multiple employees with checkboxes. No keyboard modifier is required.
                                            </p>
                                        </div>

                                        <div>
                                            <label htmlFor="team-lead" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                Team lead
                                            </label>
                                            <select
                                                id="team-lead"
                                                value={leadUserId}
                                                onChange={(event) => setLeadUserId(event.target.value)}
                                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                            >
                                                <option value="">No team lead</option>
                                                {employees.map((employee) => (
                                                    <option key={employee.id} value={employee.id}>
                                                        {employee.full_name} · {roleLabel(employee.role_code)}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="mt-1 text-xs text-slate-400">
                                                A selected lead will automatically be added as a team member.
                                            </p>
                                        </div>
                                    </>
                                )}

                                {formMode === "edit" && (
                                    <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                        Manage team membership and team lead from the team details panel.
                                    </p>
                                )}

                                {usersQuery.isError && formMode === "create" && (
                                    <p role="alert" className="text-sm text-rose-600">
                                        Unable to load active employees. Refresh the page and try again.
                                    </p>
                                )}

                                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={closeTeamForm}
                                        className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            !teamName.trim() ||
                                            createMutation.isPending ||
                                            updateMutation.isPending
                                        }
                                        className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {(createMutation.isPending || updateMutation.isPending) && (
                                            <RefreshCw className="size-4 animate-spin" />
                                        )}
                                        {formMode === "create" ? "Create team" : "Save changes"}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}

                {/* Team detail / membership panel */}
                {selectedTeamId && (
                    <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
                        <section
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="team-detail-title"
                            className="my-3 max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                        >
                            {detailQuery.isPending ? (
                                <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
                                    <RefreshCw className="size-4 animate-spin" />
                                    Loading team details...
                                </div>
                            ) : detailQuery.isError || !detailTeam ? (
                                <div className="p-8 text-center">
                                    <CircleAlert className="mx-auto size-8 text-rose-500" />
                                    <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                                        Unable to load team details
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {detailQuery.error instanceof Error
                                            ? detailQuery.error.message
                                            : "Please try again."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTeamId(null)}
                                        className="mt-5 rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between border-b border-slate-100 p-4 dark:border-slate-800">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 id="team-detail-title" className="truncate text-base font-bold text-slate-900 dark:text-white">
                                                    {detailTeam.name}
                                                </h2>
                                                <StatusBadge status={detailTeam.status} />
                                            </div>
                                            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                                {detailTeam.description || "No team description"}
                                            </p>
                                            <p className="mt-2 text-xs text-slate-400">
                                                Created {formatDate(detailTeam.created_at)}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTeamId(null)}
                                            aria-label="Close team details"
                                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        >
                                            <X className="size-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-3 p-3">
                                        {detailTeam.status === "ACTIVE" && (
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div>
                                                    <label htmlFor="assign-team-lead" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        Team lead
                                                    </label>
                                                    <div className="relative">
                                                        <Crown className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-amber-500" />
                                                        <select
                                                            id="assign-team-lead"
                                                            value={detailTeam.lead?.id ?? ""}
                                                            disabled={leadMutation.isPending}
                                                            onChange={(event) =>
                                                                leadMutation.mutate({
                                                                    teamId: detailTeam.id,
                                                                    userId: event.target.value || null,
                                                                })
                                                            }
                                                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none focus:border-violet-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                                        >
                                                            <option value="">No team lead</option>
                                                            {detailTeam.members.map((member) => (
                                                                <option key={member.user.id} value={member.user.id}>
                                                                    {member.user.full_name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {leadMutation.error && (
                                                        <p className="mt-1 text-xs text-rose-600">
                                                            {leadMutation.error.message}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-end">
                                                    <div className="rounded-lg bg-violet-50 px-3 py-2.5 text-xs text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                                                        <Users className="mr-1 inline size-3.5" />
                                                        {detailTeam.member_count} active members
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                                    Team members
                                                </h3>
                                                <span className="text-xs text-slate-400">
                                                    {detailTeam.members.length} members
                                                </span>
                                            </div>

                                            {detailTeam.members.length === 0 ? (
                                                <p className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-400 dark:border-slate-700">
                                                    No active members in this team yet.
                                                </p>
                                            ) : (
                                                <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                                                    {detailTeam.members.map((member) => (
                                                        <div key={member.id} className="flex items-center justify-between gap-3 px-3 py-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <TeamAvatar user={member.user} />
                                                                <div className="min-w-0">
                                                                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                                        {member.user.full_name}
                                                                        {detailTeam.lead?.id === member.user.id && (
                                                                            <Crown className="size-3.5 shrink-0 text-amber-500" />
                                                                        )}
                                                                    </p>
                                                                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                                                        {member.designation || roleLabel(member.user.role_code)}
                                                                        {" · "}
                                                                        {member.user.email}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {detailTeam.status === "ACTIVE" && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveMember(member)}
                                                                    disabled={removeMemberMutation.isPending}
                                                                    className="shrink-0 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {removeMemberMutation.error && (
                                            <p role="alert" className="text-sm text-rose-600">
                                                {removeMemberMutation.error.message}
                                            </p>
                                        )}

                                        {detailTeam.status === "ACTIVE" && (
                                            <form
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    if (!newMemberId) return;

                                                    addMemberMutation.mutate({
                                                        teamId: detailTeam.id,
                                                        userId: newMemberId,
                                                        designation: newMemberDesignation.trim() || null,
                                                    });
                                                }}
                                                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                                            >
                                                <div className="mb-3 flex items-center gap-2">
                                                    <UserPlus className="size-4 text-violet-700 dark:text-violet-300" />
                                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                        Add team member
                                                    </h3>
                                                </div>

                                                {usersQuery.isError ? (
                                                    <p className="text-sm text-rose-600">
                                                        Unable to load the employee directory.
                                                    </p>
                                                ) : (
                                                    <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
                                                        <select
                                                            value={newMemberId}
                                                            onChange={(event) => setNewMemberId(event.target.value)}
                                                            required
                                                            className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                        >
                                                            <option value="">Select employee</option>
                                                            {availableEmployees.map((employee) => (
                                                                <option key={employee.id} value={employee.id}>
                                                                    {employee.full_name} · {roleLabel(employee.role_code)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            value={newMemberDesignation}
                                                            onChange={(event) => setNewMemberDesignation(event.target.value)}
                                                            maxLength={100}
                                                            placeholder="Designation (optional)"
                                                            className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                                        />
                                                        <button
                                                            type="submit"
                                                            disabled={!newMemberId || addMemberMutation.isPending}
                                                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                                                        >
                                                            {addMemberMutation.isPending ? (
                                                                <RefreshCw className="size-3.5 animate-spin" />
                                                            ) : (
                                                                <Plus className="size-3.5" />
                                                            )}
                                                            Add
                                                        </button>
                                                    </div>
                                                )}

                                                {availableEmployees.length === 0 && employees.length > 0 && (
                                                    <p className="mt-2 text-xs text-slate-400">
                                                        All currently listed active employees are already members of this team.
                                                    </p>
                                                )}

                                                {addMemberMutation.error && (
                                                    <p role="alert" className="mt-2 text-xs text-rose-600">
                                                        {addMemberMutation.error.message}
                                                    </p>
                                                )}
                                            </form>
                                        )}

                                        {detailTeam.status === "ARCHIVED" && (
                                            <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                                This team is archived. Membership changes and lead updates are disabled.
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 dark:border-slate-800">
                                        <div className="flex flex-wrap gap-2">
                                            {detailTeam.status === "ACTIVE" && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            openEditForm(detailTeam);
                                                            setSelectedTeamId(null);
                                                        }}
                                                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                    >
                                                        <Pencil className="size-3.5" />
                                                        Edit team
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleArchive(detailTeam)}
                                                        disabled={archiveMutation.isPending}
                                                        className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                                                    >
                                                        <Archive className="size-3.5" />
                                                        Archive team
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTeamId(null)}
                                            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}