import { authenticatedFetch } from "@/features/auth/api/auth-api";

export type UserRole = "ADMIN" | "PM" | "DEVELOPER" | "TESTER";

export type InvitationStatus =
    | "PENDING"
    | "ACCEPTED"
    | "REVOKED"
    | "EXPIRED";

export type InvitationTeam = {
    id: string;
    name: string;
};

export type Invitation = {
    id: string;
    full_name: string;
    email: string;
    employee_id: string | null;
    role_code: UserRole;
    role_name: string;
    teams: InvitationTeam[];
    created_at: string;
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
    status: InvitationStatus;
};

export type InvitationCreated = Invitation & {
    invitation_url: string;
};

export type InvitationListResponse = {
    items: Invitation[];
    total: number;
    page: number;
    page_size: number;
};

export type CreateInvitationInput = {
    full_name: string;
    email: string;
    employee_id?: string | null;
    role_code: UserRole;
    team_ids: string[];
};

export type RevokeInvitationResponse = {
    message: string;
    invitation_id: string;
    revoked_at: string;
};

type ApiErrorPayload = {
    detail?: unknown;
    message?: unknown;
};

async function readPayload<T>(response: Response): Promise<T> {
    return (await response.json().catch(() => ({}))) as T;
}

function getErrorMessage(
    payload: ApiErrorPayload,
    fallback: string,
): string {
    if (typeof payload.detail === "string" && payload.detail.trim()) {
        return payload.detail;
    }

    if (Array.isArray(payload.detail)) {
        const messages = payload.detail
            .map((item) => {
                if (
                    item &&
                    typeof item === "object" &&
                    "msg" in item &&
                    typeof item.msg === "string"
                ) {
                    return item.msg;
                }

                return null;
            })
            .filter((message): message is string => Boolean(message));

        if (messages.length) {
            return messages.join(" ");
        }
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
    }

    return fallback;
}

async function ensureSuccess(
    response: Response,
    fallback: string,
): Promise<void> {
    if (response.ok) {
        return;
    }

    const payload = await readPayload<ApiErrorPayload>(response);

    throw new Error(getErrorMessage(payload, fallback));
}

export async function getInvitations(
    page = 1,
    pageSize = 20,
): Promise<InvitationListResponse> {
    const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
    });

    const response = await authenticatedFetch(
        `/users/invitations?${query.toString()}`,
        { method: "GET" },
    );

    await ensureSuccess(response, "Unable to load invitations.");

    return readPayload<InvitationListResponse>(response);
}

export async function createInvitation(
    input: CreateInvitationInput,
): Promise<InvitationCreated> {
    const response = await authenticatedFetch("/users/invitations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            ...input,
            email: input.email.trim().toLowerCase(),
            full_name: input.full_name.trim(),
            employee_id: input.employee_id?.trim() || null,
            team_ids: input.team_ids,
        }),
    });

    await ensureSuccess(response, "Unable to create the invitation.");

    return readPayload<InvitationCreated>(response);
}

export async function revokeInvitation(
    invitationId: string,
): Promise<RevokeInvitationResponse> {
    const response = await authenticatedFetch(
        `/users/invitations/${encodeURIComponent(invitationId)}/revoke`,
        { method: "POST" },
    );

    await ensureSuccess(response, "Unable to revoke the invitation.");

    return readPayload<RevokeInvitationResponse>(response);
}