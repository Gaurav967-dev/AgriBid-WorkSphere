"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowLeft,
    LoaderCircle,
    Save,
    ShieldCheck,
    UserRound,
    Users,
    X,
} from "lucide-react";

import { verifyToken, type AuthUser } from "@/features/auth/api/auth-api";
import {
    getUserDetails,
    updateUser,
    updateUserStatus,
    type UpdateUserInput,
    type UserRole,
} from "@/features/users/api/users-api";
import { getProjectOptions } from "@/features/projects/api/projects-api";

function formatDateTime(value: string | null): string {
    if (!value) return "Not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";
    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
    { value: "ADMIN", label: "Admin" },
    { value: "PM", label: "Project Manager" },
    { value: "DEVELOPER", label: "Developer" },
    { value: "TESTER", label: "Tester" },
];

export default function EmployeeDetailsPage() {
    const params = useParams<{ userId: string }>();
    const userId = params.userId;
    const router = useRouter();
    const queryClient = useQueryClient();

    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [editing, setEditing] = useState(false);
    const [fullName, setFullName] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [roleCode, setRoleCode] = useState<UserRole>("DEVELOPER");
    const [teamIds, setTeamIds] = useState<string[]>([]);

    useEffect(() => {
        let mounted = true;
        verifyToken()
            .then(({ user }) => {
                if (!mounted) return;
                if (user.role_code !== "ADMIN") {
                    router.replace("/dashboard");
                    return;
                }
                setCurrentUser(user);
                setCheckingAuth(false);
            })
            .catch(() => {
                if (mounted) router.replace("/");
            });
        return () => {
            mounted = false;
        };
    }, [router]);

    const employeeQuery = useQuery({
        queryKey: ["users", "detail", userId],
        queryFn: () => getUserDetails(userId),
        enabled: !checkingAuth && currentUser?.role_code === "ADMIN" && Boolean(userId),
    });

    const teamOptionsQuery = useQuery({
        queryKey: ["users", "team-options"],
        queryFn: () => getProjectOptions(),
        enabled: editing && !checkingAuth && currentUser?.role_code === "ADMIN",
        staleTime: 60_000,
    });

    const updateMutation = useMutation({
        mutationFn: (input: UpdateUserInput) => updateUser(userId, input),
        onSuccess: async (updated) => {
            queryClient.setQueryData(["users", "detail", userId], updated);
            await queryClient.invalidateQueries({ queryKey: ["users"] });
            setEditing(false);
        },
    });

    const statusMutation = useMutation({
        mutationFn: (isActive: boolean) => updateUserStatus(userId, isActive),
        onSuccess: async (updated) => {
            queryClient.setQueryData(["users", "detail", userId], updated);
            await queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });

    const employee = employeeQuery.data;

    function startEditing() {
        if (!employee) return;
        setFullName(employee.full_name);
        setEmployeeId(employee.employee_id ?? "");
        setRoleCode(employee.role_code);
        setTeamIds(employee.teams.map((team) => team.id));
        setEditing(true);
    }

    function cancelEditing() {
        setEditing(false);
        updateMutation.reset();
    }

    function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        updateMutation.mutate({
            full_name: fullName.trim(),
            employee_id: employeeId.trim() || null,
            role_code: roleCode,
            team_ids: teamIds,
        });
    }

    function handleStatusChange() {
        if (!employee) return;
        const nextStatus = !employee.is_active;
        const confirmed = window.confirm(
            nextStatus
                ? `Reactivate ${employee.full_name}'s account?`
                : `Deactivate ${employee.full_name}'s account? Their active sessions will be revoked.`,
        );
        if (confirmed) statusMutation.mutate(nextStatus);
    }

    if (checkingAuth || employeeQuery.isPending) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-slate-500">
                <LoaderCircle className="size-5 animate-spin" />
                Loading employee details...
            </main>
        );
    }

    if (employeeQuery.isError || !employee) {
        return (
            <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
                <Link href="/dashboard/users" className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-900">
                    <ArrowLeft className="size-4" /> Back to User Management
                </Link>
                <section className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {employeeQuery.error instanceof Error
                        ? employeeQuery.error.message
                        : "Unable to load employee details."}
                </section>
            </main>
        );
    }

    return (
        <main className="workspace-shell mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <Link href="/dashboard/users" className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 transition hover:text-violet-900">
                <ArrowLeft className="size-4" /> Back to User Management
            </Link>

            <header className="mt-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:p-4">
                <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                        <UserRound className="size-7" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="mt-0 truncate text-xl font-bold text-slate-900 sm:text-2xl">{employee.full_name}</h1>
                        <p className="mt-1 truncate text-sm text-slate-500">{employee.email}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${employee.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                        {employee.is_active ? "Active" : "Inactive"}
                    </span>
                    {!editing && (
                        <button type="button" onClick={startEditing} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800">
                            Edit employee
                        </button>
                    )}
                </div>
            </header>

            {statusMutation.isError && (
                <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {statusMutation.error instanceof Error ? statusMutation.error.message : "Unable to update account status."}
                </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="size-5 text-violet-700" />
                        <h2 className="text-base font-bold text-slate-900">Employee information</h2>
                    </div>

                    {editing ? (
                        <form onSubmit={handleSave} className="mt-5 space-y-3">
                            <div>
                                <label htmlFor="employee-full-name" className="mb-1.5 block text-sm font-medium text-slate-700">Full name</label>
                                <input id="employee-full-name" required maxLength={150} value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label htmlFor="employee-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
                                <input id="employee-email" value={employee.email} readOnly disabled className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500" />
                                <p className="mt-1 text-xs text-slate-400">Email cannot be changed.</p>
                            </div>
                            <div>
                                <label htmlFor="employee-id" className="mb-1.5 block text-sm font-medium text-slate-700">Employee ID</label>
                                <input id="employee-id" maxLength={50} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100" />
                            </div>
                            <div>
                                <label htmlFor="employee-role" className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
                                <select id="employee-role" value={roleCode} onChange={(event) => setRoleCode(event.target.value as UserRole)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100">
                                    {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                                </select>
                            </div>
                            <fieldset>
                                <legend className="mb-2 text-sm font-medium text-slate-700">Team memberships</legend>
                                {teamOptionsQuery.isPending ? (
                                    <p className="text-sm text-slate-500">Loading teams...</p>
                                ) : teamOptionsQuery.isError ? (
                                    <p className="text-sm text-rose-600">Unable to load team options. Cancel editing and try again.</p>
                                ) : (teamOptionsQuery.data?.teams ?? []).length === 0 ? (
                                    <p className="text-sm text-slate-500">No active teams available.</p>
                                ) : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {(teamOptionsQuery.data?.teams ?? []).map((team) => (
                                            <label key={team.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                                                <input type="checkbox" checked={teamIds.includes(team.id)} onChange={(event) => setTeamIds((current) => event.target.checked ? [...current, team.id] : current.filter((id) => id !== team.id))} className="size-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500" />
                                                <span>{team.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <p className="mt-2 text-xs text-slate-400">An employee may belong to multiple teams.</p>
                            </fieldset>
                            {updateMutation.isError && (
                                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                                    {updateMutation.error instanceof Error ? updateMutation.error.message : "Unable to save employee changes."}
                                </div>
                            )}
                            <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white/95 px-5 pt-4 backdrop-blur sm:-mx-6 sm:px-6">
                                <button type="button" onClick={cancelEditing} disabled={updateMutation.isPending} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                    <X className="size-4" /> Cancel
                                </button>
                                <button type="submit" disabled={updateMutation.isPending || teamOptionsQuery.isPending || teamOptionsQuery.isError} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
                                    {updateMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                                    Save changes
                                </button>
                            </div>
                        </form>
                    ) : (
                        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Full name</dt><dd className="mt-1 text-sm font-medium text-slate-800">{employee.full_name}</dd></div>
                            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 break-all text-sm font-medium text-slate-800">{employee.email}</dd></div>
                            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Employee ID</dt><dd className="mt-1 text-sm font-medium text-slate-800">{employee.employee_id || "Not provided"}</dd></div>
                            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Role</dt><dd className="mt-1 text-sm font-medium text-slate-800">{employee.role_name}</dd></div>
                            <div className="sm:col-span-2">
                                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Teams</dt>
                                <dd className="mt-2 flex flex-wrap gap-2">
                                    {employee.teams.length ? employee.teams.map((team) => <span key={team.id} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{team.name}</span>) : <span className="text-sm text-slate-500">No team assigned</span>}
                                </dd>
                            </div>
                        </dl>
                    )}
                </section>

                <aside className="space-y-6">
                    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Users className="size-5 text-violet-700" />
                            <h2 className="text-sm font-bold text-slate-900">Account activity</h2>
                        </div>
                        <dl className="mt-4 space-y-3">
                            <div><dt className="text-xs text-slate-400">Added on</dt><dd className="mt-1 text-sm font-medium text-slate-700">{formatDateTime(employee.created_at)}</dd></div>
                            <div><dt className="text-xs text-slate-400">Last login</dt><dd className="mt-1 text-sm font-medium text-slate-700">{formatDateTime(employee.last_login_at)}</dd></div>
                            {employee.deactivated_at && <div><dt className="text-xs text-slate-400">Deactivated on</dt><dd className="mt-1 text-sm font-medium text-slate-700">{formatDateTime(employee.deactivated_at)}</dd></div>}
                        </dl>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h2 className="text-sm font-bold text-slate-900">Account status</h2>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                            {employee.is_active
                                ? "This employee can sign in to the workspace."
                                : "This employee cannot sign in until the account is reactivated."}
                        </p>
                        <button
                            type="button"
                            onClick={handleStatusChange}
                            disabled={statusMutation.isPending || employee.id === currentUser?.id || editing}
                            className={`mt-4 w-full rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${employee.is_active ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                        >
                            {statusMutation.isPending ? "Updating..." : employee.is_active ? "Deactivate account" : "Reactivate account"}
                        </button>
                        {employee.id === currentUser?.id && <p className="mt-2 text-xs text-slate-400">You cannot deactivate your own account.</p>}
                    </section>
                </aside>
            </div>
        </main>
    );
}