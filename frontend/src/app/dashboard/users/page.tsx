"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    LayoutDashboard,
    LogOut,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Users,
    XCircle,
    X,
    Menu,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";

import {
    getInvitations,
    revokeInvitation,
    type Invitation,
    type InvitationStatus,
} from "@/features/users/api/users-api";

import { InvitationDialog } from "@/features/users/components/invitation-dialog";
import { WorkspaceActions } from "@/components/workspace-actions";

const PAGE_SIZE = 10;
const EMPTY_INVITATIONS: Invitation[] = [];

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

function SummaryCard({
    title,
    value,
    detail,
    icon,
}: {
    title: string;
    value: string | number;
    detail: string;
    icon: React.ReactNode;
}) {
    return (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <span className="rounded-lg bg-violet-50 p-2 text-violet-700">
                    {icon}
                </span>
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                {value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </article>
    );
}

export default function UsersPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
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

    const pendingOnPage = invitations.filter(
        (item) => item.status === "PENDING",
    ).length;

    const acceptedOnPage = invitations.filter(
        (item) => item.status === "ACCEPTED",
    ).length;

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
            <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                    <RefreshCw className="size-4 animate-spin" />
                    Verifying your session...
                </div>
            </main>
        );
    }

    if (!isAdmin) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
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
                        className="mt-6 inline-flex rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
                    >
                        Return to dashboard
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <div className="workspace-shell min-h-screen bg-[#f7f8fc] text-slate-900">
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-slate-200 bg-white md:flex xl:w-64">
                <div className="flex h-20 items-center justify-center gap-3 border-b border-slate-100 px-2 xl:justify-start xl:px-6">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-white">
                        <ShieldCheck className="size-5" />
                    </div>
                    <div className="hidden xl:block">
                        <p className="text-sm font-bold tracking-tight text-slate-900">
                            AgriBid
                        </p>
                        <p className="text-xs text-slate-500">WorkSphere</p>
                    </div>
                </div>

                <div className="px-2 pt-7 xl:px-4">
                    <p className="hidden px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 xl:block">
                        Workspace
                    </p>

                    <nav className="mt-3 space-y-1">
                        <Link
                            href="/dashboard"
                            title="Overview"
                            className="flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 xl:justify-start"
                        >
                            <LayoutDashboard className="size-4 shrink-0" />
                            <span className="hidden xl:inline">Overview</span>
                        </Link>

                        <Link
                            href="/dashboard/teams"
                            title="Teams"
                            className="flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 xl:justify-start"
                        >
                            <Users className="size-4 shrink-0" />
                            <span className="hidden xl:inline">Teams</span>
                        </Link>

                        <Link
                            href="/dashboard/users"
                            title="User Management"
                            aria-current="page"
                            className="flex items-center justify-center gap-3 rounded-lg bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-800 xl:justify-start"
                        >
                            <Users className="size-4 shrink-0" />
                            <span className="hidden xl:inline">User Management</span>
                        </Link>
                    </nav>
                </div>

                <div className="mt-auto border-t border-slate-100 p-3 xl:p-5">
                    <div className="hidden xl:block">
                        <p className="text-xs font-semibold text-slate-700">
                            Signed in as
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                            {user.email}
                        </p>
                        <span className="mt-2 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                            Administrator
                        </span>
                    </div>

                    <div
                        className="flex justify-center xl:hidden"
                        title="Administrator account"
                    >
                        <ShieldCheck className="size-5 text-violet-700" />
                    </div>
                </div>
            </aside>

            <div className="md:pl-16 xl:pl-64">
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-8">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setIsMobileNavOpen((current) => !current)
                                }
                                aria-label={
                                    isMobileNavOpen ? "Close navigation" : "Open navigation"
                                }
                                aria-expanded={isMobileNavOpen}
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 md:hidden"
                            >
                                {isMobileNavOpen ? (
                                    <X className="size-4" />
                                ) : (
                                    <Menu className="size-4" />
                                )}
                            </button>

                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                    AgriBid WorkSphere
                                </p>
                                <p className="hidden text-xs text-slate-500 sm:block">
                                    Project and team workspace
                                </p>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                            <WorkspaceActions />
                            <div className="hidden text-right sm:block">
                                <p className="max-w-48 truncate text-sm font-medium text-slate-800">
                                    {user.full_name ?? user.email}
                                </p>
                                <p className="text-xs text-slate-500">Administrator</p>
                            </div>

                            <button
                                type="button"
                                onClick={handleSignOut}
                                disabled={isSigningOut}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                <LogOut className="size-4" />
                                <span className="hidden sm:inline">
                                    {isSigningOut ? "Signing out..." : "Sign out"}
                                </span>
                            </button>
                        </div>
                    </div>
                </header>

                {isMobileNavOpen && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <button
                            type="button"
                            aria-label="Close navigation drawer"
                            onClick={() => setIsMobileNavOpen(false)}
                            className="absolute inset-0 bg-slate-950/40"
                        />

                        <aside className="absolute inset-y-0 left-0 flex w-[min(84vw,18rem)] flex-col border-r border-slate-200 bg-white shadow-xl">
                            <div className="flex h-20 items-center justify-between border-b border-slate-100 px-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 items-center justify-center rounded-xl bg-violet-700 text-white">
                                        <ShieldCheck className="size-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">
                                            AgriBid
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            WorkSphere
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsMobileNavOpen(false)}
                                    aria-label="Close navigation"
                                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <nav className="space-y-1 px-4 py-6">
                                <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    Workspace
                                </p>

                                <Link
                                    href="/dashboard"
                                    onClick={() => setIsMobileNavOpen(false)}
                                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                                >
                                    <LayoutDashboard className="size-4" />
                                    Overview
                                </Link>

                                <Link
                                    href="/dashboard/teams"
                                    onClick={() => setIsMobileNavOpen(false)}
                                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                                >
                                    <Users className="size-4" />
                                    Teams
                                </Link>

                                <Link
                                    href="/dashboard/users"
                                    onClick={() => setIsMobileNavOpen(false)}
                                    aria-current="page"
                                    className="flex items-center gap-3 rounded-lg bg-violet-50 px-3 py-3 text-sm font-semibold text-violet-800"
                                >
                                    <Users className="size-4" />
                                    User Management
                                </Link>
                            </nav>

                            <div className="mt-auto border-t border-slate-100 p-5">
                                <p className="text-xs font-semibold text-slate-700">
                                    Signed in as
                                </p>
                                <p className="mt-1 truncate text-sm text-slate-500">
                                    {user.email}
                                </p>
                                <span className="mt-2 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                                    Administrator
                                </span>
                            </div>
                        </aside>
                    </div>
                )}

                <main className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
                    <div className="mb-7">
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-violet-700"
                        >
                            <ArrowLeft className="size-3.5" />
                            Back to overview
                        </Link>

                        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-700">
                                    Workspace administration
                                </p>
                                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                                    User Management
                                </h1>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
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

                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <SummaryCard
                            title="Total invitations"
                            value={total}
                            detail="All invitations recorded"
                            icon={<Users className="size-5" />}
                        />
                        <SummaryCard
                            title="Pending on this page"
                            value={pendingOnPage}
                            detail="Awaiting employee acceptance"
                            icon={<Clock3 className="size-5" />}
                        />
                        <SummaryCard
                            title="Accepted on this page"
                            value={acceptedOnPage}
                            detail="Accounts created from invitations"
                            icon={<CheckCircle2 className="size-5" />}
                        />
                    </section>

                    <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">
                                    Employee invitations
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Review and manage invitations sent to employees.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                <div className="relative min-w-0 flex-1">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={search}
                                        onChange={(event) =>
                                            setSearch(event.target.value)
                                        }
                                        placeholder="Search this page by name, email or employee ID"
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
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
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
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <RefreshCw
                                        className={`size-4 ${invitationsQuery.isFetching
                                                ? "animate-spin"
                                                : ""
                                            }`}
                                    />
                                    <span>Refresh</span>
                                </button>
                            </div>

                            <p className="text-xs text-slate-400">
                                Search and status filters apply to the currently
                                loaded page of invitations.
                            </p>
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
                                                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                                                        <td className="px-6 py-4">
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

                                                        <td className="px-5 py-4">
                                                            <RoleBadge
                                                                role={invitation.role_code}
                                                            />
                                                        </td>

                                                        <td className="px-5 py-4">
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

                                                        <td className="px-5 py-4">
                                                            <StatusBadge
                                                                status={invitation.status}
                                                            />
                                                        </td>

                                                        <td className="px-5 py-4 text-xs text-slate-600">
                                                            {formatDate(
                                                                invitation.created_at,
                                                            )}
                                                        </td>

                                                        <td className="px-5 py-4 text-xs text-slate-600">
                                                            {formatDate(
                                                                invitation.expires_at,
                                                            )}
                                                        </td>

                                                        <td className="px-5 py-4 text-right">
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

                                <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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

                    <p className="mt-6 text-center text-xs text-slate-400">
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