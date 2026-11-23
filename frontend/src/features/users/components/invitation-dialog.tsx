"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

    const mutation = useMutation({
        mutationFn: createInvitation,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["users", "invitations"],
            });
        },
    });

    const teamsQuery = useQuery({
        queryKey: ["teams", "invitation-options"],
        queryFn: () => getTeams(1, 100, "", "ACTIVE"),
        enabled: open,
        staleTime: 60_000,
    });

    const activeTeams = teamsQuery.data?.items ?? [];

    function toggleTeam(teamId: string) {
        setSelectedTeamIds((current) =>
            current.includes(teamId)
                ? current.filter((id) => id !== teamId)
                : [...current, teamId],
        );
    }

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
                className="my-auto max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2
                            id="invitation-dialog-title"
                            className="mt-0 text-lg font-bold tracking-tight text-slate-900"
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
                    <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <p className="text-sm font-semibold text-emerald-800">
                                Invitation successfully created
                            </p>
                            <p className="mt-1 text-sm text-emerald-700">
                                {createdInvitation.full_name} ·{" "}
                                {createdInvitation.email}
                            </p>
                            <p className="mt-1 text-xs text-emerald-700">
                                Teams: {createdInvitation.teams.length
                                    ? createdInvitation.teams.map((team) => team.name).join(", ")
                                    : "No team assigned"}
                            </p>
                        </div>

                        <div>
                            <label
                                htmlFor="invitation-url"
                                className="mb-1.5 block text-xs font-medium text-slate-700"
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
                    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                        <div>
                            <label
                                htmlFor="invite-full-name"
                                className="mb-1.5 block text-xs font-medium text-slate-700"
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
                                className="mb-1.5 block text-xs font-medium text-slate-700"
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
                                className="mb-1.5 block text-xs font-medium text-slate-700"
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
                                className="mb-1.5 block text-xs font-medium text-slate-700"
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
                            <legend className="block text-sm font-medium text-slate-700">
                                Assign teams{" "}
                                <span className="font-normal text-slate-400">
                                    (Optional · Multiple teams allowed)
                                </span>
                            </legend>

                            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                                {teamsQuery.isPending ? (
                                    <p className="px-2 py-3 text-xs text-slate-500" role="status">
                                        Loading active teams...
                                    </p>
                                ) : teamsQuery.isError ? (
                                    <div className="flex items-center justify-between gap-3 px-2 py-2">
                                        <p className="text-xs text-rose-600">
                                            Unable to load active teams.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => void teamsQuery.refetch()}
                                            className="shrink-0 text-xs font-semibold text-violet-700 hover:text-violet-900"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : activeTeams.length === 0 ? (
                                    <p className="px-2 py-3 text-xs text-slate-500">
                                        No active teams are currently available.
                                    </p>
                                ) : (
                                    activeTeams.map((team) => (
                                        <label
                                            key={team.id}
                                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedTeamIds.includes(team.id)}
                                                onChange={() => toggleTeam(team.id)}
                                                disabled={mutation.isPending}
                                                className="size-4 rounded border-slate-300 text-violet-700 accent-violet-700 focus:ring-violet-500"
                                            />
                                            <span className="min-w-0 flex-1 truncate">
                                                {team.name}
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                {team.member_count} {team.member_count === 1 ? "member" : "members"}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>

                            <p className="text-xs leading-5 text-slate-500">
                                The employee will be added to the selected active teams after accepting the invitation.
                            </p>
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
                                disabled={mutation.isPending || teamsQuery.isPending || teamsQuery.isError}
                                title={teamsQuery.isError ? "Retry loading active teams before creating the invitation." : undefined}
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