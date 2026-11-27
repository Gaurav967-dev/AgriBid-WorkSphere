"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Users,
    X,
    Menu,
    PanelLeft,
    Filter,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";

import {
    getUserManagementRecords,
    revokeInvitation,
    type ManagementAccountStatus,
    type UserManagementRecord,
    type UserManagementSortField,
    type UserRole,
} from "@/features/users/api/users-api";
import { getTeams } from "@/features/teams/api/teams-api";

import { InvitationDialog } from "@/features/users/components/invitation-dialog";
import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

const MANAGEMENT_PAGE_SIZE = 12;

type ManagementStatusFilter = "ALL" | ManagementAccountStatus;
type ManagementRoleFilter = "ALL" | UserRole;

function formatDate(value?: string | null): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
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

function statusLabel(status: ManagementAccountStatus): string {
    const labels: Record<ManagementAccountStatus, string> = {
        ACTIVE: "Active",
        INACTIVE: "Inactive",
        PENDING: "Invitation pending",
        REVOKED: "Invitation revoked",
        EXPIRED: "Invitation expired",
    };
    return labels[status];
}

function statusClasses(status: ManagementAccountStatus): string {
    const styles: Record<ManagementAccountStatus, string> = {
        ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
        INACTIVE: "border-slate-200 bg-slate-100 text-slate-600",
        PENDING: "border-amber-200 bg-amber-50 text-amber-700",
        REVOKED: "border-slate-200 bg-slate-100 text-slate-600",
        EXPIRED: "border-rose-200 bg-rose-50 text-rose-700",
    };
    return styles[status];
}

function RoleBadge({ role }: { role: string }) {
    const labels: Record<string, string> = {
        ADMIN: "Admin",
        PM: "Project Manager",
        DEVELOPER: "Developer",
        TESTER: "Tester",
    };

    return (
        <span className="inline-flex rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
            {labels[role] ?? role}
        </span>
    );
}

export default function UsersPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { collapsed, toggleCollapsed } = useWorkspaceSidebarState();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] =
        useState<ManagementStatusFilter>("ALL");
    const [roleFilter, setRoleFilter] =
        useState<ManagementRoleFilter>("ALL");
    const [teamFilter, setTeamFilter] = useState("");
    const [sortBy, setSortBy] =
        useState<UserManagementSortField>("created_at");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [isInvitationDialogOpen, setIsInvitationDialogOpen] =
        useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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

    const isAdmin = user?.role_code === "ADMIN";

    const managementQuery = useQuery({
        queryKey: [
            "users",
            "management",
            page,
            MANAGEMENT_PAGE_SIZE,
            search.trim(),
            statusFilter,
            roleFilter,
            teamFilter,
            sortBy,
            sortOrder,
        ],
        queryFn: () =>
            getUserManagementRecords({
                page,
                pageSize: MANAGEMENT_PAGE_SIZE,
                search,
                accountStatus: statusFilter,
                roleCode: roleFilter,
                teamId: teamFilter,
                sortBy,
                sortOrder,
            }),
        enabled: !isCheckingAuth && isAdmin,
    });

    const teamsQuery = useQuery({
        queryKey: ["teams", "users-filter-options"],
        queryFn: () => getTeams(1, 100, "", "ACTIVE"),
        enabled: !isCheckingAuth && isAdmin,
        staleTime: 60_000,
    });

    const revokeMutation = useMutation({
        mutationFn: revokeInvitation,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["users", "management"],
            });
        },
    });

    const managementRows = managementQuery.data?.items ?? [];
    const total = managementQuery.data?.total ?? 0;
    const totalPages = Math.max(1, managementQuery.data?.total_pages ?? 1);
    const latestInvitationUpdate = managementRows.reduce<string | null>(
        (latest, row) =>
            !latest || new Date(row.created_at).getTime() > new Date(latest).getTime()
                ? row.created_at
                : latest,
        null,
    );

    function toggleSort(field: UserManagementSortField) {
        if (sortBy === field) {
            setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(field);
            setSortOrder("asc");
        }
        setPage(1);
    }

    async function handleSignOut() {
        setIsSigningOut(true);

        try {
            await signOut();
        } catch {
            // Return to sign-in even when the server session has expired.
        } finally {
            router.replace("/");

        }
    }

    function handleRevoke(record: UserManagementRecord) {
        if (!record.invitation_id) return;
        const confirmed = window.confirm(
            `Revoke the invitation for ${record.full_name}? The invitation link will no longer be usable.`,
        );
        if (!confirmed) return;

        setRevokingId(record.invitation_id);
        revokeMutation.mutate(record.invitation_id, {
            onSettled: () => setRevokingId(null),
        });
    }

    if (isCheckingAuth || !user) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 px-6">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                    <RefreshCw className="size-4 animate-spin" />
                    Verifying your session...
                </div>
            </main>
        );
    }

    if (!isAdmin) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 px-6">
                <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <ShieldCheck className="mx-auto size-10 text-rose-500" />
                    <h1 className="mt-4 text-xl font-bold text-slate-900">
                        Access restricted
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        User Management is available only to Admin accounts.
                    </p>
                    <Link
                        href="/dashboard"
                        className="mt-4 inline-flex rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
                    >
                        Return to dashboard
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <div className="workspace-shell flex !h-dvh !min-h-0 !overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <WorkspaceSidebar
                user={user}
                collapsed={collapsed}
                mobileOpen={isMobileNavOpen}
                onMobileClose={() => setIsMobileNavOpen(false)}
            />
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                    <div className="flex h-full w-full min-w-0 items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                onClick={toggleCollapsed}
                                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                                aria-expanded={!collapsed}
                                className="hidden size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 md:flex"
                            >
                                <PanelLeft className="size-4" />
                            </button><button
                                type="button"
                                onClick={() =>
                                    setIsMobileNavOpen((current) => !current)
                                }
                                aria-label={
                                    isMobileNavOpen ? "Close navigation" : "Open navigation"
                                }
                                aria-expanded={isMobileNavOpen}
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 md:hidden"
                            >
                                {isMobileNavOpen ? (
                                    <X className="size-4" />
                                ) : (
                                    <Menu className="size-4" />
                                )}
                            </button>

                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    User Management
                                </p>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            <WorkspaceActions user={user} lastUpdated={relativeUpdate(latestInvitationUpdate)}  onSignOut={handleSignOut} isSigningOut={isSigningOut} />
                        </div>
                    </div>
                </header>


                <main className="flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden px-3 pb-3 pt-0 sm:px-4">
                    <div className="mb-1 shrink-0">
                        <div className="mt-0 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                            <div>
                                <h1 className="mt-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                    User Management
                                </h1>
                                <p className="mt-0.5 max-w-2xl text-xs leading-4 text-slate-500">
                                    Invite employees, manage pending invitations,
                                    and track account onboarding.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsInvitationDialogOpen(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-violet-300"
                            >
                                <Plus className="size-4" />
                                Invite employee
                            </button>
                        </div>
                    </div>

                    <section className="mt-0 flex min-h-0 flex-1 flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800 sm:px-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 xl:w-[230px] xl:shrink-0">
                                <h2 className="text-base font-bold leading-tight text-slate-900 dark:text-slate-100">
                                    Employee directory
                                </h2>
                                <p className="mt-0.5 text-xs leading-4 text-slate-500 dark:text-slate-400">
                                    Employee accounts and outstanding invitations in one place.
                                </p>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                    <div className="relative min-w-0 flex-1 sm:max-w-[360px]">
                                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="search"
                                            value={search}
                                            maxLength={100}
                                            onChange={(event) => {
                                                setSearch(event.target.value);
                                                setPage(1);
                                            }}
                                            placeholder="Search name, email or employee ID"
                                            aria-label="Search user management records"
                                            className="h-9 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
                                        <details className="relative">
                                            <summary
                                                aria-label="Open user filters"
                                                className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden"
                                            >
                                                <Filter className="size-3.5" />
                                                Filter
                                                {(() => {
                                                    const activeCount = [
                                                        statusFilter !== "ALL",
                                                        roleFilter !== "ALL",
                                                        Boolean(teamFilter),
                                                    ].filter(Boolean).length;
                                                    return activeCount > 0 ? (
                                                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                                            {activeCount}
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </summary>

                                            <div
                                                role="group"
                                                aria-label="User directory filters"
                                                className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 max-h-[min(70vh,420px)] overflow-y-auto"
                                            >
                                                <div className="mb-3 flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                        Filter employees
                                                    </h3>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setStatusFilter("ALL");
                                                            setRoleFilter("ALL");
                                                            setTeamFilter("");
                                                            setPage(1);
                                                        }}
                                                        className="text-xs font-semibold text-violet-700 hover:text-violet-800 dark:text-violet-300"
                                                    >
                                                        Clear all
                                                    </button>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="block">
                                                        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                            Account status
                                                        </span>
                                                        <select
                                                            value={statusFilter}
                                                            onChange={(event) => {
                                                                setStatusFilter(event.target.value as ManagementStatusFilter);
                                                                setPage(1);
                                                            }}
                                                            aria-label="Filter by account status"
                                                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                        >
                                                            <option value="ALL">All statuses</option>
                                                            <option value="ACTIVE">Active</option>
                                                            <option value="INACTIVE">Inactive</option>
                                                            <option value="PENDING">Invitation pending</option>
                                                            <option value="REVOKED">Invitation revoked</option>
                                                            <option value="EXPIRED">Invitation expired</option>
                                                        </select>
                                                    </label>

                                                    <label className="block">
                                                        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                            Role
                                                        </span>
                                                        <select
                                                            value={roleFilter}
                                                            onChange={(event) => {
                                                                setRoleFilter(event.target.value as ManagementRoleFilter);
                                                                setPage(1);
                                                            }}
                                                            aria-label="Filter by role"
                                                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                        >
                                                            <option value="ALL">All roles</option>
                                                            <option value="ADMIN">Admin</option>
                                                            <option value="PM">Project Manager</option>
                                                            <option value="DEVELOPER">Developer</option>
                                                            <option value="TESTER">Tester</option>
                                                        </select>
                                                    </label>

                                                    <label className="block">
                                                        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                                                            Team
                                                        </span>
                                                        <select
                                                            value={teamFilter}
                                                            onChange={(event) => {
                                                                setTeamFilter(event.target.value);
                                                                setPage(1);
                                                            }}
                                                            aria-label="Filter by team"
                                                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                        >
                                                            <option value="">All teams</option>
                                                            {(teamsQuery.data?.items ?? []).map((team) => (
                                                                <option key={team.id} value={team.id}>{team.name}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                </div>
                                            </div>
                                        </details>

                                        <label className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                                            Sort by
                                            <select
                                                value={sortBy}
                                                onChange={(event) => {
                                                    setSortBy(event.target.value as UserManagementSortField);
                                                    setPage(1);
                                                }}
                                                aria-label="Sort user records by"
                                                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                            >
                                                <option value="created_at">Created date</option>
                                                <option value="full_name">Full name</option>
                                                <option value="email">Email</option>
                                                <option value="employee_id">Employee ID</option>
                                                <option value="role">Role</option>
                                                <option value="teams">Team</option>
                                                <option value="status">Account status</option>
                                                <option value="last_login_at">Last login</option>
                                            </select>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSortOrder((current) => current === "asc" ? "desc" : "asc");
                                                setPage(1);
                                            }}
                                            aria-label={`Sort ${sortOrder === "asc" ? "descending" : "ascending"}`}
                                            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            {sortOrder === "asc" ? "Ascending" : "Descending"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => void managementQuery.refetch()}
                                            disabled={managementQuery.isFetching}
                                            aria-label="Refresh user management records"
                                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            <RefreshCw className={`size-3.5 ${managementQuery.isFetching ? "animate-spin" : ""}`} />
                                            Refresh
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
{revokeMutation.error && (
                            <div role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                                {revokeMutation.error instanceof Error ? revokeMutation.error.message : "Unable to revoke the invitation."}
                            </div>
                        )}

                        {managementQuery.isPending ? (
                            <div className="flex min-h-48 flex-1 items-center justify-center gap-3 text-sm text-slate-500" role="status">
                                <RefreshCw className="size-4 animate-spin" /> Loading user records...
                            </div>
                        ) : managementQuery.isError ? (
                            <div className="flex min-h-48 flex-1 flex-col items-center justify-center px-6 text-center">
                                <AlertCircle className="size-9 text-rose-500" />
                                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Unable to load user records</h3>
                                <p className="mt-1 max-w-md text-sm text-slate-500">{managementQuery.error instanceof Error ? managementQuery.error.message : "Something went wrong while retrieving users."}</p>
                                <button type="button" onClick={() => void managementQuery.refetch()} className="mt-4 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">Try again</button>
                            </div>
                        ) : managementRows.length === 0 ? (
                            <div className="flex min-h-48 flex-1 flex-col items-center justify-center px-6 text-center">
                                <Users className="size-9 text-slate-300" />
                                <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">No matching records</h3>
                                <p className="mt-1 text-sm text-slate-500">Try changing your search or filters, or invite a new employee.</p>
                                <button type="button" onClick={() => setIsInvitationDialogOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">
                                    <Plus className="size-4" /> Invite employee
                                </button>
                            </div>
                        ) : (
                            <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
                                <table className="w-full min-w-[1250px] border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/60">
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">Profile / Employee</th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">
                                                <button type="button" onClick={() => toggleSort("employee_id")} className="hover:text-violet-700">Employee ID ↕</button>
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">
                                                <button type="button" onClick={() => toggleSort("role")} className="hover:text-violet-700">Role ↕</button>
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">
                                                <button type="button" onClick={() => toggleSort("teams")} className="hover:text-violet-700">Team(s) ↕</button>
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">
                                                <button type="button" onClick={() => toggleSort("status")} className="hover:text-violet-700">Account status ↕</button>
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">
                                                <button type="button" onClick={() => toggleSort("created_at")} className="hover:text-violet-700">Created date ↕</button>
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">
                                                <button type="button" onClick={() => toggleSort("last_login_at")} className="hover:text-violet-700">Last login ↕</button>
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 sticky top-0 z-20 bg-slate-50 dark:bg-slate-950">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {managementRows.map((record) => {
                                            const initials = record.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
                                            return (
                                                <tr key={`${record.record_type}-${record.id}`} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div title={record.profile_image_key ? "Profile image is stored" : "No profile image stored"} className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${record.profile_image_key ? "bg-violet-100 text-violet-800 ring-2 ring-violet-300" : "bg-slate-100 text-slate-600"}`}>
                                                                {initials || "U"}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="max-w-64 truncate text-[13px] leading-4 font-semibold text-slate-900 dark:text-slate-100">{record.full_name}</p>
                                                                <p className="max-w-64 truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">{record.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">{record.employee_id || "—"}</td>
                                                    <td className="px-3 py-1.5"><RoleBadge role={record.role_code} /></td>
                                                    <td className="px-3 py-1.5">
                                                        {record.teams.length ? (
                                                            <div className="flex max-w-56 flex-wrap gap-1">
                                                                {record.teams.slice(0, 2).map((team) => <span key={team.id} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{team.name}</span>)}
                                                                {record.teams.length > 2 && <span className="px-1 py-0.5 text-[11px] text-slate-500">+{record.teams.length - 2} more</span>}
                                                            </div>
                                                        ) : <span className="text-[11px] text-slate-400">—</span>}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(record.account_status)}`}>{statusLabel(record.account_status)}</span>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">{formatDate(record.created_at)}</td>
                                                    <td className="px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">{formatDate(record.last_login_at)}</td>
                                                    <td className="px-3 py-1.5 text-right">
                                                        {record.record_type === "EMPLOYEE" && record.user_id ? (
                                                            <Link href={`/dashboard/users/${record.user_id}`} className="inline-flex items-center rounded-lg border border-violet-200 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50">View details</Link>
                                                        ) : record.account_status === "PENDING" ? (
                                                            <button type="button" onClick={() => handleRevoke(record)} disabled={revokingId === record.invitation_id} className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">{revokingId === record.invitation_id ? "Revoking..." : "Revoke"}</button>
                                                        ) : <span className="text-[11px] text-slate-400">—</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!managementQuery.isPending && !managementQuery.isError && total > 0 && (
                            <div className="mt-auto flex shrink-0 flex-col gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <p className="text-xs text-slate-500">Showing {(page - 1) * MANAGEMENT_PAGE_SIZE + 1}–{Math.min(page * MANAGEMENT_PAGE_SIZE, total)} of {total} records</p>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || managementQuery.isFetching} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                                        <ChevronLeft className="size-4" /> Previous
                                    </button>
                                    <span className="px-2 text-xs font-medium text-slate-500">Page {page} of {totalPages}</span>
                                    <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || managementQuery.isFetching} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                                        Next <ChevronRight className="size-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    <p className="mt-auto shrink-0 pt-4 pb-1 text-center text-xs text-slate-400">
                        AgriBid WorkSphere · Internal employee workspace
                    </p>
                </main>
            </div>

            <InvitationDialog
                open={isInvitationDialogOpen}
                onClose={() => setIsInvitationDialogOpen(false)}
            />
        </div>
    );
}
