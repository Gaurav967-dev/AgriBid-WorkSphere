"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,

    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Users,
    XCircle,
    X,
    Menu,
    PanelLeft,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";

import {
    getActiveUsers,
    getInvitations,
    revokeInvitation,
    type ActiveUser,
    type EmployeeStatusFilter,
    type Invitation,
    type InvitationStatus,
} from "@/features/users/api/users-api";

import { InvitationDialog } from "@/features/users/components/invitation-dialog";
import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

const PAGE_SIZE = 10;
const ACTIVE_USER_PAGE_SIZE = 12;
const EMPTY_INVITATIONS: Invitation[] = [];
const EMPTY_ACTIVE_USERS: ActiveUser[] = [];

type StatusFilter = "ALL" | InvitationStatus;

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

function StatusBadge({ status }: { status: InvitationStatus }) {
    const styles: Record<InvitationStatus, string> = {
        PENDING: "border-amber-200 bg-amber-50 text-amber-700",
        ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
        REVOKED: "border-slate-200 bg-slate-100 text-slate-600",
        EXPIRED: "border-rose-200 bg-rose-50 text-rose-700",
    };

    const icons = {
        PENDING: <Clock3 className="size-3.5" />,
        ACCEPTED: <CheckCircle2 className="size-3.5" />,
        REVOKED: <XCircle className="size-3.5" />,
        EXPIRED: <AlertCircle className="size-3.5" />,
    };

    const labels: Record<InvitationStatus, string> = {
        PENDING: "Pending",
        ACCEPTED: "Accepted",
        REVOKED: "Revoked",
        EXPIRED: "Expired",
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
        >
            {icons[status]}
            {labels[status]}
        </span>
    );
}

function RoleBadge({ role }: { role: string }) {
    const labels: Record<string, string> = {
        ADMIN: "Admin",
        PM: "Project Manager",
        DEVELOPER: "Developer",
        TESTER: "Tester",
    };

    return (
        <span className="inline-flex rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
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

    const [employeePage, setEmployeePage] = useState(1);
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [employeeStatusFilter, setEmployeeStatusFilter] =
        useState<EmployeeStatusFilter>("ACTIVE");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
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

    const invitationsQuery = useQuery({
        queryKey: ["users", "invitations", page, PAGE_SIZE],
        queryFn: () => getInvitations(page, PAGE_SIZE),
        enabled: !isCheckingAuth && isAdmin,
    });

    const activeUsersQuery = useQuery({
        queryKey: [
            "users",
            "active",
            employeePage,
            ACTIVE_USER_PAGE_SIZE,
            employeeSearch.trim(),
            employeeStatusFilter,
        ],
        queryFn: () =>
            getActiveUsers(
                employeePage,
                ACTIVE_USER_PAGE_SIZE,
                employeeSearch,
                employeeStatusFilter,
            ),
        enabled: !isCheckingAuth && isAdmin,
    });
    const revokeMutation = useMutation({
        mutationFn: revokeInvitation,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["users", "invitations"],
            });
        },
    });

    const invitations =
        invitationsQuery.data?.items ?? EMPTY_INVITATIONS;
    const total = invitationsQuery.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const filteredInvitations = useMemo(() => {
        const searchValue = search.trim().toLowerCase();

        return invitations.filter((invitation) => {
            const matchesSearch =
                !searchValue ||
                invitation.full_name.toLowerCase().includes(searchValue) ||
                invitation.email.toLowerCase().includes(searchValue) ||
                (invitation.employee_id ?? "")
                    .toLowerCase()
                    .includes(searchValue);

            const matchesStatus =
                statusFilter === "ALL" ||
                invitation.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [invitations, search, statusFilter]);

    const activeUsers =
        activeUsersQuery.data?.items ?? EMPTY_ACTIVE_USERS;
    const activeUserTotal = activeUsersQuery.data?.total ?? 0;
    const totalActiveUserPages = Math.max(
        1,
        activeUsersQuery.data?.total_pages ?? 1,
    );
    const latestInvitationUpdate = invitations
        .map((item) => item.created_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    async function handleSignOut() {
        setIsSigningOut(true);

        try {
            await signOut();
        } catch {
            // Return to sign-in even when the server session has expired.
        } finally {
            router.replace("/");
            router.refresh();
        }
    }

    function handleRevoke(invitation: Invitation) {
        const confirmed = window.confirm(
            `Revoke the invitation for ${invitation.full_name}? The invitation link will no longer be usable.`,
        );

        if (!confirmed) return;

        setRevokingId(invitation.id);

        revokeMutation.mutate(invitation.id, {
            onSettled: () => {
                setRevokingId(null);
            },
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
        <div className="workspace-shell flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <WorkspaceSidebar
                user={user}
                collapsed={collapsed}
                mobileOpen={isMobileNavOpen}
                onMobileClose={() => setIsMobileNavOpen(false)}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
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


                <main className="w-full max-w-none px-3 pb-3 pt-1 sm:px-4">
                    <div className="mb-3">
                        <div className="mt-0 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                            <div>
                                <h1 className="mt-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                                    User Management
                                </h1>
                                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
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

                    <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">
                                    Employee accounts
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Search employees, review their details, and manage account status.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="relative min-w-0 sm:w-80">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={employeeSearch}
                                        maxLength={100}
                                        onChange={(event) => {
                                            setEmployeeSearch(event.target.value);
                                            setEmployeePage(1);
                                        }}
                                        placeholder="Search name, email or employee ID"
                                        aria-label="Search employees"
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
                                    />
                                </div>

                                <select
                                    value={employeeStatusFilter}
                                    onChange={(event) => {
                                        setEmployeeStatusFilter(
                                            event.target.value as EmployeeStatusFilter,
                                        );
                                        setEmployeePage(1);
                                    }}
                                    aria-label="Filter employees by account status"
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
                                >
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                    <option value="ALL">All employees</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={() => void activeUsersQuery.refetch()}
                                    disabled={activeUsersQuery.isFetching}
                                    aria-label="Refresh employees"
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <RefreshCw
                                        className={`size-4 ${
                                            activeUsersQuery.isFetching
                                                ? "animate-spin"
                                                : ""
                                        }`}
                                    />
                                    <span>Refresh</span>
                                </button>
                            </div>
                        </div>

                        {activeUsersQuery.isPending ? (
                            <div
                                className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500"
                                role="status"
                            >
                                <RefreshCw className="size-4 animate-spin" />
                                Loading employees...
                            </div>
                        ) : activeUsersQuery.isError ? (
                            <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                                <AlertCircle className="size-9 text-rose-500" />
                                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                                    Unable to load employees
                                </h3>
                                <p className="mt-1 max-w-md text-sm text-slate-500">
                                    {activeUsersQuery.error instanceof Error
                                        ? activeUsersQuery.error.message
                                        : "Something went wrong while retrieving employees."}
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        void activeUsersQuery.refetch()
                                    }
                                    className="mt-4 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : activeUsers.length === 0 ? (
                            <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
                                <Users className="size-9 text-slate-300" />
                                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                                    No employees found
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {employeeSearch.trim()
                                        ? "Try another name, email or employee ID."
                                        : "Accepted employee invitations will appear here."}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[900px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Employee
                                                </th>
                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Employee ID
                                                </th>
                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Role
                                                </th>
                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Account status
                                                </th>
                                                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {activeUsers.map((employee) => (
                                                <tr
                                                    key={employee.id}
                                                    className="transition hover:bg-slate-50/70"
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold text-slate-900">
                                                                {employee.full_name}
                                                            </p>
                                                            <p className="mt-1 truncate text-xs text-slate-500">
                                                                {employee.email}
                                                            </p>
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-3 text-sm text-slate-600">
                                                        {employee.employee_id || "—"}
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        <RoleBadge
                                                            role={employee.role_code}
                                                        />
                                                    </td>

                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                                employee.is_active
                                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                                    : "border-slate-200 bg-slate-100 text-slate-600"
                                                            }`}
                                                        >
                                                            {employee.is_active
                                                                ? "Active"
                                                                : "Inactive"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link
                                                            href={`/dashboard/users/${employee.id}`}
                                                            className="inline-flex items-center rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
                                                        >
                                                            View details
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                    <p className="text-xs text-slate-500">
                                        Showing{" "}
                                        {(employeePage - 1) *
                                            ACTIVE_USER_PAGE_SIZE +
                                            1}
                                        –
                                        {Math.min(
                                            (employeePage - 1) *
                                                ACTIVE_USER_PAGE_SIZE +
                                                activeUsers.length,
                                            activeUserTotal,
                                        )}{" "}
                                        of {activeUserTotal} employees
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEmployeePage((current) =>
                                                    Math.max(1, current - 1),
                                                )
                                            }
                                            disabled={
                                                employeePage <= 1 ||
                                                activeUsersQuery.isFetching
                                            }
                                            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <ChevronLeft className="size-4" />
                                            Previous
                                        </button>

                                        <span className="px-2 text-xs font-medium text-slate-500">
                                            Page {employeePage} of{" "}
                                            {totalActiveUserPages}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEmployeePage((current) =>
                                                    Math.min(
                                                        totalActiveUserPages,
                                                        current + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                employeePage >=
                                                    totalActiveUserPages ||
                                                activeUsersQuery.isFetching
                                            }
                                            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Next
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>
                    <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div className="min-w-0 shrink-0">
                                <h2 className="text-base font-bold text-slate-900">
                                    Employee invitations
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Review and manage invitations sent to employees.
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                    Search and status filters apply to the currently loaded page.
                                </p>
                            </div>

                            <div className="flex min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                                <div className="relative min-w-0 sm:w-72 sm:flex-1 sm:max-w-[360px]">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search invitations by name, email or ID"
                                        aria-label="Search invitations on this page"
                                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
                                    />
                                </div>

                                <select
                                    value={statusFilter}
                                    onChange={(event) =>
                                        setStatusFilter(
                                            event.target.value as StatusFilter,
                                        )
                                    }
                                    aria-label="Filter invitations by status"
                                    className="h-10 w-full shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100 sm:w-36"
                                >
                                    <option value="ALL">All statuses</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="ACCEPTED">Accepted</option>
                                    <option value="REVOKED">Revoked</option>
                                    <option value="EXPIRED">Expired</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={() => void invitationsQuery.refetch()}
                                    disabled={invitationsQuery.isFetching}
                                    aria-label="Refresh invitations"
                                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <RefreshCw
                                        className={`size-4 ${invitationsQuery.isFetching ? "animate-spin" : ""}`}
                                    />
                                    <span>Refresh</span>
                                </button>
                            </div>
                        </div>

                        {revokeMutation.error && (
                            <div
                                role="alert"
                                className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:mx-6"
                            >
                                {revokeMutation.error instanceof Error
                                    ? revokeMutation.error.message
                                    : "Unable to revoke the invitation."}
                            </div>
                        )}

                        {invitationsQuery.isPending ? (
                            <div
                                className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500"
                                role="status"
                            >
                                <RefreshCw className="size-4 animate-spin" />
                                Loading invitations...
                            </div>
                        ) : invitationsQuery.isError ? (
                            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                                <AlertCircle className="size-9 text-rose-500" />
                                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                                    Unable to load invitations
                                </h3>
                                <p className="mt-1 max-w-md text-sm text-slate-500">
                                    {invitationsQuery.error instanceof Error
                                        ? invitationsQuery.error.message
                                        : "Something went wrong while retrieving invitations."}
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        void invitationsQuery.refetch()
                                    }
                                    className="mt-4 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : filteredInvitations.length === 0 ? (
                            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                                    <Users className="size-6" />
                                </div>
                                <h3 className="mt-4 text-sm font-semibold text-slate-900">
                                    {invitations.length === 0
                                        ? "No invitations yet"
                                        : "No matching invitations"}
                                </h3>
                                <p className="mt-1 max-w-md text-sm text-slate-500">
                                    {invitations.length === 0
                                        ? "Create an invitation to start onboarding an employee."
                                        : "Try changing your search term or status filter."}
                                </p>
                                {invitations.length === 0 && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsInvitationDialogOpen(true)
                                        }
                                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
                                    >
                                        <Plus className="size-4" />
                                        Invite employee
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1050px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Employee
                                                </th>
                                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Role
                                                </th>
                                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Teams
                                                </th>
                                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Status
                                                </th>
                                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Invited
                                                </th>
                                                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Expires
                                                </th>
                                                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {filteredInvitations.map(
                                                (invitation) => (
                                                    <tr
                                                        key={invitation.id}
                                                        className="transition hover:bg-slate-50/70"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800">
                                                                    {invitation.full_name
                                                                        .trim()
                                                                        .split(/\s+/)
                                                                        .slice(0, 2)
                                                                        .map((part) =>
                                                                            part
                                                                                .charAt(0)
                                                                                .toUpperCase(),
                                                                        )
                                                                        .join("")}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="max-w-56 truncate text-sm font-semibold text-slate-800">
                                                                        {invitation.full_name}
                                                                    </p>
                                                                    <p className="max-w-56 truncate text-xs text-slate-500">
                                                                        {invitation.email}
                                                                    </p>
                                                                    {invitation.employee_id && (
                                                                        <p className="mt-0.5 text-[11px] text-slate-400">
                                                                            ID:{" "}
                                                                            {invitation.employee_id}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <RoleBadge
                                                                role={invitation.role_code}
                                                            />
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            {invitation.teams.length ? (
                                                                <div className="flex max-w-48 flex-wrap gap-1">
                                                                    {invitation.teams.map(
                                                                        (team) => (
                                                                            <span
                                                                                key={team.id}
                                                                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                                                                            >
                                                                                {team.name}
                                                                            </span>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-400">
                                                                    No team assigned
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <StatusBadge
                                                                status={invitation.status}
                                                            />
                                                        </td>

                                                        <td className="px-4 py-3 text-xs text-slate-600">
                                                            {formatDate(
                                                                invitation.created_at,
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-xs text-slate-600">
                                                            {formatDate(
                                                                invitation.expires_at,
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right">
                                                            {invitation.status ===
                                                                "PENDING" ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleRevoke(
                                                                            invitation,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        revokingId ===
                                                                        invitation.id
                                                                    }
                                                                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                                                                >
                                                                    {revokingId ===
                                                                        invitation.id
                                                                        ? "Revoking..."
                                                                        : "Revoke"}
                                                                </button>
                                                            ) : (
                                                                <span className="pr-3 text-xs text-slate-300">
                                                                    —
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                    <p className="text-xs text-slate-500">
                                        Showing{" "}
                                        {total === 0
                                            ? 0
                                            : (page - 1) * PAGE_SIZE + 1}{" "}
                                        to{" "}
                                        {Math.min(page * PAGE_SIZE, total)} of{" "}
                                        {total} invitations
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPage((current) =>
                                                    Math.max(1, current - 1),
                                                )
                                            }
                                            disabled={
                                                page <= 1 ||
                                                invitationsQuery.isFetching
                                            }
                                            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <ChevronLeft className="size-4" />
                                            Previous
                                        </button>

                                        <span className="px-2 text-xs font-medium text-slate-600">
                                            Page {page} of {totalPages}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPage((current) =>
                                                    Math.min(
                                                        totalPages,
                                                        current + 1,
                                                    ),
                                                )
                                            }
                                            disabled={
                                                page >= totalPages ||
                                                invitationsQuery.isFetching
                                            }
                                            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Next
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>

                    <p className="mt-4 text-center text-xs text-slate-400">
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
