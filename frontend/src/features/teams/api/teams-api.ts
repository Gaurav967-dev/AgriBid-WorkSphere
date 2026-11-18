import { authenticatedFetch } from "@/features/auth/api/auth-api";

export type TeamStatus = "ACTIVE" | "ARCHIVED";

export type TeamUser = {
    id: string;
    full_name: string;
    email: string;
    role_code: "ADMIN" | "PM" | "DEVELOPER" | "TESTER";
    employee_id: string | null;
};

export type TeamMember = {
    id: string;
    user: TeamUser;
    designation: string | null;
    joined_at: string;
};

export type Team = {
    id: string;
    name: string;
    description: string | null;
    status: TeamStatus;
    lead: TeamUser | null;
    member_count: number;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
    is_joined: boolean;
    members_preview: TeamUser[];
};

export type TeamDetails = Team & {
    members: TeamMember[];
};

export type TeamListResponse = {
    items: Team[];
    total: number;
    page: number;
    page_size: number;
};

export type UserDirectoryResponse = {
    items: TeamUser[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
};

export type TeamListStatus = "ACTIVE" | "ARCHIVED" | "ALL";

export type CreateTeamInput = {
    name: string;
    description: string | null;
    lead_user_id: string | null;
    member_ids: string[];
};

export type UpdateTeamInput = {
    name?: string;
    description?: string | null;
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

async function apiRequest<T>(
    path: string,
    init: RequestInit,
    fallback: string,
): Promise<T> {
    const response = await authenticatedFetch(path, init);

    if (!response.ok) {
        const payload = await readPayload<ApiErrorPayload>(response);
        throw new Error(getErrorMessage(payload, fallback));
    }

    return readPayload<T>(response);
}

export async function getTeams(
    page = 1,
    pageSize = 20,
    search = "",
    status: TeamListStatus = "ACTIVE",
): Promise<TeamListResponse> {
    const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        status,
    });

    if (search.trim()) {
        query.set("search", search.trim());
    }

    return apiRequest<TeamListResponse>(
        `/teams?${query.toString()}`,
        { method: "GET" },
        "Unable to load teams.",
    );
}

export async function getTeam(teamId: string): Promise<TeamDetails> {
    return apiRequest<TeamDetails>(
        `/teams/${encodeURIComponent(teamId)}`,
        { method: "GET" },
        "Unable to load team details.",
    );
}

export async function getActiveUsers(
    page = 1,
    pageSize = 100,
    search = "",
): Promise<UserDirectoryResponse> {
    const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
    });

    if (search.trim()) {
        query.set("search", search.trim());
    }

    return apiRequest<UserDirectoryResponse>(
        `/users?${query.toString()}`,
        { method: "GET" },
        "Unable to load active employees.",
    );
}

export async function createTeam(
    input: CreateTeamInput,
): Promise<TeamDetails> {
    return apiRequest<TeamDetails>(
        "/teams",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        },
        "Unable to create the team.",
    );
}

export async function updateTeam(
    teamId: string,
    input: UpdateTeamInput,
): Promise<TeamDetails> {
    return apiRequest<TeamDetails>(
        `/teams/${encodeURIComponent(teamId)}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        },
        "Unable to update the team.",
    );
}

export async function addTeamMember(input: {
    teamId: string;
    userId: string;
    designation: string | null;
}): Promise<TeamDetails> {
    return apiRequest<TeamDetails>(
        `/teams/${encodeURIComponent(input.teamId)}/members`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: input.userId,
                designation: input.designation,
            }),
        },
        "Unable to add the team member.",
    );
}

export async function removeTeamMember(input: {
    teamId: string;
    userId: string;
}): Promise<{
    message: string;
    team_id: string;
    user_id: string;
    removed_at: string;
}> {
    return apiRequest(
        `/teams/${encodeURIComponent(input.teamId)}/members/${encodeURIComponent(input.userId)}`,
        { method: "DELETE" },
        "Unable to remove the team member.",
    );
}

export async function updateTeamLead(input: {
    teamId: string;
    userId: string | null;
}): Promise<TeamDetails> {
    return apiRequest<TeamDetails>(
        `/teams/${encodeURIComponent(input.teamId)}/lead`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: input.userId }),
        },
        "Unable to update the team lead.",
    );
}

export async function archiveTeam(teamId: string): Promise<TeamDetails> {
    return apiRequest<TeamDetails>(
        `/teams/${encodeURIComponent(teamId)}/archive`,
        { method: "POST" },
        "Unable to archive the team.",
    );
}