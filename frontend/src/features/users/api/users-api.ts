import { authenticatedFetch, unauthenticatedFetch } from "@/features/auth/api/auth-api";

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

export type ActiveUser = {
    id: string;
    full_name: string;
    email: string;
    employee_id: string | null;
    role_code: UserRole;
    role_name: string;
    is_active: boolean;
};

export type ActiveUserListResponse = {
    items: ActiveUser[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
};
export type InvitationAcceptedUser = {
    id: string;
    full_name: string;
    email: string;
    role_code: UserRole;
    role_name: string;
    is_active: boolean;
};

export type InvitationAcceptResponse = {
    message: string;
    user: InvitationAcceptedUser;
};

export type InvitationAcceptInput = {
    token: string;
    password: string;
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

export async function acceptInvitation(
    input: InvitationAcceptInput,
): Promise<InvitationAcceptResponse> {
    const response = await unauthenticatedFetch(
        "/users/invitations/accept",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
        },
    );

    await ensureSuccess(response, "Unable to accept the invitation.");

    return readPayload<InvitationAcceptResponse>(response);
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

export type EmployeeStatusFilter = "ACTIVE" | "INACTIVE" | "ALL";

export async function getActiveUsers(
    page = 1,
    pageSize = 12,
    search = "",
    accountStatus: EmployeeStatusFilter = "ACTIVE",
): Promise<ActiveUserListResponse> {
    const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        account_status: accountStatus,
    });

    const searchTerm = search.trim();

    if (searchTerm) {
        query.set("search", searchTerm);
    }

    const response = await authenticatedFetch(
        `/users?${query.toString()}`,
        { method: "GET" },
    );

    await ensureSuccess(response, "Unable to load active employees.");

    return readPayload<ActiveUserListResponse>(response);
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
export type UserTeamSummary = {
    id: string;
    name: string;
};

export type UserDetails = ActiveUser & {
    profile_image_key: string | null;
    created_at: string;
    updated_at: string;
    last_login_at: string | null;
    deactivated_at: string | null;
    teams: UserTeamSummary[];
};

export type UpdateUserInput = {
    full_name?: string;
    employee_id?: string | null;
    role_code?: UserRole;
    team_ids?: string[];
};

export async function getUserDetails(userId: string): Promise<UserDetails> {
    const response = await authenticatedFetch(
        `/users/${encodeURIComponent(userId)}`,
        { method: "GET" },
    );

    await ensureSuccess(response, "Unable to load employee details.");
    return readPayload<UserDetails>(response);
}

export async function updateUser(
    userId: string,
    input: UpdateUserInput,
): Promise<UserDetails> {
    const response = await authenticatedFetch(
        `/users/${encodeURIComponent(userId)}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...input,
                full_name: input.full_name?.trim(),
                employee_id: input.employee_id?.trim() || null,
            }),
        },
    );

    await ensureSuccess(response, "Unable to update the employee.");
    return readPayload<UserDetails>(response);
}

export async function updateUserStatus(
    userId: string,
    isActive: boolean,
): Promise<UserDetails> {
    const response = await authenticatedFetch(
        `/users/${encodeURIComponent(userId)}/status`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: isActive }),
        },
    );

    await ensureSuccess(response, "Unable to update employee status.");
    return readPayload<UserDetails>(response);
}


export type ManagementAccountStatus =
    | "ACTIVE"
    | "INACTIVE"
    | "PENDING"
    | "REVOKED"
    | "EXPIRED";

export type UserManagementSortField =
    | "full_name"
    | "email"
    | "employee_id"
    | "role"
    | "teams"
    | "status"
    | "created_at"
    | "last_login_at";

export type UserManagementRecord = {
    id: string;
    record_type: "EMPLOYEE" | "INVITATION";
    user_id: string | null;
    invitation_id: string | null;
    full_name: string;
    email: string;
    profile_image_key: string | null;
    employee_id: string | null;
    role_code: UserRole;
    role_name: string;
    teams: UserTeamSummary[];
    account_status: ManagementAccountStatus;
    created_at: string;
    last_login_at: string | null;
    expires_at: string | null;
};

export type UserManagementListResponse = {
    items: UserManagementRecord[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
};

export type UserManagementQuery = {
    page: number;
    pageSize: number;
    search?: string;
    accountStatus?: ManagementAccountStatus | "ALL";
    roleCode?: UserRole | "ALL";
    teamId?: string;
    sortBy: UserManagementSortField;
    sortOrder: "asc" | "desc";
};

export async function getUserManagementRecords(
    input: UserManagementQuery,
): Promise<UserManagementListResponse> {
    const query = new URLSearchParams({
        page: String(input.page),
        page_size: String(input.pageSize),
        account_status: input.accountStatus ?? "ALL",
        sort_by: input.sortBy,
        sort_order: input.sortOrder,
    });

    const searchTerm = input.search?.trim();
    if (searchTerm) query.set("search", searchTerm);
    if (input.roleCode && input.roleCode !== "ALL") {
        query.set("role_code", input.roleCode);
    }
    if (input.teamId) query.set("team_id", input.teamId);

    const response = await authenticatedFetch(
        `/users/management?${query.toString()}`,
        { method: "GET" },
    );

    await ensureSuccess(response, "Unable to load user-management records.");
    return readPayload<UserManagementListResponse>(response);
}
