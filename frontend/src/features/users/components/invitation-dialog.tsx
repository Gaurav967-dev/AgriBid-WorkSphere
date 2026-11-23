"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    createInvitation,
    type InvitationCreated,
    type UserRole,
} from "@/features/users/api/users-api";
import { getTeams } from "@/features/teams/api/teams-api";

type InvitationDialogProps = {
    open: boolean;
    onClose: () => void;
};

const roles: { value: UserRole; label: string }[] = [
    { value: "ADMIN", label: "Admin" },
    { value: "PM", label: "Project Manager" },
    { value: "DEVELOPER", label: "Developer" },
    { value: "TESTER", label: "Tester" },
];

export function InvitationDialog({
    open,
    onClose,
}: InvitationDialogProps) {
    const queryClient = useQueryClient();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [employeeId, setEmployeeId] = useState("");
    const [roleCode, setRoleCode] = useState<UserRole>("DEVELOPER");
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

    const [createdInvitation, setCreatedInvitation] =
        useState<InvitationCreated | null>(null);
    const [copyMessage, setCopyMessage] = useState("");

    const teamsQuery = useQuery({
        queryKey: ["teams", "active-for-invitation"],
        queryFn: () => getTeams(1, 100, "", "ACTIVE"),
        enabled: open && !createdInvitation,
        staleTime: 60_000,
    });

    const mutation = useMutation({
        mutationFn: createInvitation,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["users", "invitations"],
            });
        },
    });

    useEffect(() => {
        if (!open) return;

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, onClose]);

    if (!open) return null;

    function handleClose() {
        setFullName("");
        setEmail("");
        setEmployeeId("");
        setRoleCode("DEVELOPER");
        setSelectedTeamIds([]);
        setCreatedInvitation(null);
        setCopyMessage("");
        mutation.reset();
        onClose();
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setCopyMessage("");

        try {
            const result = await mutation.mutateAsync({
                full_name: fullName.trim(),
                email: email.trim().toLowerCase(),
                employee_id: employeeId.trim() || null,
                role_code: roleCode,
                team_ids: selectedTeamIds,
            });

            setCreatedInvitation(result);
        } catch {
            // The mutation error is displayed below the form.
        }
    }

    async function handleCopyLink() {
        if (!createdInvitation) return;

        try {
            await navigator.clipboard.writeText(
                createdInvitation.invitation_url,
            );
            setCopyMessage("Invitation link copied.");
        } catch {
            setCopyMessage(
                "Copy failed. Select and copy the invitation link manually.",
            );
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    handleClose();
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="invitation-dialog-title"
                className="my-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                            User Management
                        </p>
                        <h2
                            id="invitation-dialog-title"
                            className="mt-2 text-xl font-bold tracking-tight text-slate-900"
                        >
                            {createdInvitation
                                ? "Invitation created"
                                : "Invite a new employee"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {createdInvitation
                                ? "Share this secure invitation link with the employee."
                                : "Send an invitation to give an employee access to AgriBid WorkSphere."}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close dialog"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <span aria-hidden="true" className="text-xl leading-none">
                            ×
                        </span>
                    </button>
                </div>

                {createdInvitation ? (
                    <div className="mt-7 space-y-5">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <p className="text-sm font-semibold text-emerald-800">
                                Invitation successfully created
                            </p>
                            <p className="mt-1 text-sm text-emerald-700">
                                {createdInvitation.full_name} ·{" "}
                                {createdInvitation.email}
                            </p>

                            {createdInvitation.teams.length > 0 && (
                                <p className="mt-2 text-xs text-emerald-700">
                                    Assigned teams:{" "}
                                    {createdInvitation.teams
                                        .map((team) => team.name)
                                        .join(", ")}
                                </p>
                            )}
                        </div>

                        <div>
                            <label
                                htmlFor="invitation-url"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                One-time invitation link
                            </label>
                            <textarea
                                id="invitation-url"
                                readOnly
                                rows={3}
                                value={createdInvitation.invitation_url}
                                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 outline-none"
                            />
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                This link contains a private invitation token.
                                Copy it now and share it only with the intended
                                employee. The raw token is not available from
                                the invitation list later.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleCopyLink}
                            className="w-full rounded-lg bg-violet-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
                        >
                            Copy invitation link
                        </button>

                        {copyMessage && (
                            <p
                                role="status"
                                className="text-center text-sm text-slate-600"
                            >
                                {copyMessage}
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                        <div>
                            <label
                                htmlFor="invite-full-name"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Full name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                id="invite-full-name"
                                type="text"
                                autoComplete="name"
                                required
                                maxLength={150}
                                value={fullName}
                                onChange={(event) =>
                                    setFullName(event.target.value)
                                }
                                placeholder="Enter employee's full name"
                                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="invite-email"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Company email{" "}
                                <span className="text-rose-500">*</span>
                            </label>
                            <input
                                id="invite-email"
                                type="email"
                                autoComplete="email"
                                required
                                maxLength={320}
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                placeholder="name@agribid.ai"
                                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="invite-employee-id"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Employee ID{" "}
                                <span className="font-normal text-slate-400">
                                    (Optional)
                                </span>
                            </label>
                            <input
                                id="invite-employee-id"
                                type="text"
                                maxLength={50}
                                value={employeeId}
                                onChange={(event) =>
                                    setEmployeeId(event.target.value)
                                }
                                placeholder="Enter employee ID"
                                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="invite-role"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Assign role{" "}
                                <span className="text-rose-500">*</span>
                            </label>
                            <select
                                id="invite-role"
                                value={roleCode}
                                onChange={(event) =>
                                    setRoleCode(event.target.value as UserRole)
                                }
                                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
                            >
                                {roles.map((role) => (
                                    <option
                                        key={role.value}
                                        value={role.value}
                                    >
                                        {role.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-slate-700">
                                Assign teams{" "}
                                <span className="font-normal text-slate-400">
                                    (Optional)
                                </span>
                            </legend>

                            <p className="text-xs leading-5 text-slate-500">
                                Select one or multiple teams for this employee.
                                Team memberships will be activated after the invitation is accepted.
                            </p>

                            {teamsQuery.isPending ? (
                                <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm text-slate-500">
                                    <span className="size-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                                    Loading active teams...
                                </div>
                            ) : teamsQuery.isError ? (
                                <div
                                    role="alert"
                                    className="rounded-lg border border-rose-200 bg-rose-50 p-3"
                                >
                                    <p className="text-sm text-rose-700">
                                        {teamsQuery.error instanceof Error
                                            ? teamsQuery.error.message
                                            : "Unable to load active teams."}
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => void teamsQuery.refetch()}
                                        className="mt-2 text-xs font-semibold text-rose-700 underline underline-offset-2"
                                    >
                                        Retry loading teams
                                    </button>
                                </div>
                            ) : teamsQuery.data?.items.length ? (
                                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                                    {teamsQuery.data.items.map((team) => {
                                        const selected = selectedTeamIds.includes(team.id);

                                        return (
                                            <label
                                                key={team.id}
                                                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition ${selected
                                                        ? "border-violet-300 bg-violet-50"
                                                        : "border-slate-100 bg-white hover:bg-slate-50"
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={(event) => {
                                                        setSelectedTeamIds((current) =>
                                                            event.target.checked
                                                                ? [...current, team.id]
                                                                : current.filter(
                                                                    (id) => id !== team.id,
                                                                ),
                                                        );
                                                    }}
                                                    className="size-4 accent-violet-700"
                                                />

                                                <span className="text-sm font-medium text-slate-700">
                                                    {team.name}
                                                </span>

                                                {selected && (
                                                    <span className="ml-auto text-xs font-semibold text-violet-700">
                                                        Selected
                                                    </span>
                                                )}
                                            </label>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
                                    <p className="text-sm font-medium text-slate-600">
                                        No active teams found
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        Create an active team before assigning employees.
                                    </p>
                                </div>
                            )}

                            {selectedTeamIds.length > 0 && (
                                <p className="text-xs font-medium text-violet-700">
                                    {selectedTeamIds.length}{" "}
                                    {selectedTeamIds.length === 1 ? "team" : "teams"} selected
                                </p>
                            )}
                        </fieldset>

                        {mutation.error && (
                            <div
                                role="alert"
                                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
                            >
                                {mutation.error instanceof Error
                                    ? mutation.error.message
                                    : "Unable to create the invitation."}
                            </div>
                        )}

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={mutation.isPending}
                                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={
                                    mutation.isPending ||
                                    teamsQuery.isPending ||
                                    teamsQuery.isError
                                }
                                className="rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {mutation.isPending
                                    ? "Creating invitation..."
                                    : "Send invitation"}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}