import { authenticatedFetch } from "@/features/auth/api/auth-api";

export type ProjectStatus =
    | "PLANNING"
    | "ACTIVE"
    | "ON_HOLD"
    | "COMPLETED"
    | "ARCHIVED";

export type ProjectUser = {
    id: string;
    full_name: string;
    email: string;
    role_code: "ADMIN" | "PM" | "DEVELOPER" | "TESTER";
    employee_id: string | null;
};

export type ProjectTeam = {
    id: string;
    name: string;
};

export type ProjectMember = {
    id: string;
    user: ProjectUser;
    joined_at: string;
};

export type Project = {
    id: string;
    name: string;
    key: string;
    description: string | null;
    logo_key: string | null;
    project_manager: ProjectUser;
    team: ProjectTeam;
    project_managers?: ProjectUser[];
    teams?: ProjectTeam[];
    start_date: string | null;
    end_date: string | null;
    status: ProjectStatus;
    visibility: string;
    member_count: number;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
};

export type ProjectDetails = Project & {
    members: ProjectMember[];
};

export type ProjectListResponse = {
    items: Project[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
};

export type ProjectListStatus = ProjectStatus | "ALL";

export type ProjectListParams = {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: ProjectListStatus;
};

export type CreateProjectInput = {
    name: string;
    key: string;
    description?: string | null;
    logo_key?: string | null;
    project_manager_id: string;
    team_id: string;
    project_manager_ids: string[];
    team_ids: string[];
    start_date?: string | null;
    end_date?: string | null;
    status?: ProjectStatus;
    visibility?: string;
    member_ids?: string[];
};

export type UpdateProjectInput = {
    name?: string;
    key?: string;
    description?: string | null;
    logo_key?: string | null;
    project_manager_id?: string;
    team_id?: string;
    project_manager_ids?: string[];
    team_ids?: string[];
    start_date?: string | null;
    end_date?: string | null;
    status?: ProjectStatus;
    visibility?: string;
};


export type ProjectTicketDistribution = {
    status: string;
    count: number;
};

export type ProjectOverviewMember = {
    user_id: string;
    full_name: string;
    email: string;
    role_code: string;
    joined_at: string;
};

export type ProjectOverviewActivity = {
    id: string;
    ticket_id: string;
    ticket_key: string;
    ticket_title: string;
    project_id: string;
    project_name: string;
    actor_name: string;
    action: string;
    description: string | null;
    created_at: string;
};

export type ProjectOverviewDeadline = {
    ticket_id: string;
    ticket_key: string;
    title: string;
    project_id: string;
    project_name: string;
    due_date: string;
    status: string;
    priority: string;
    assignee_name: string | null;
    tester_name: string | null;
};

export type ProjectOverview = {
    project_id: string;
    project_name: string;
    project_key: string;
    total_tickets: number;
    completed_tickets: number;
    completion_percentage: number;
    ticket_distribution: ProjectTicketDistribution[];
    team_members: ProjectOverviewMember[];
    recent_activities: ProjectOverviewActivity[];
    upcoming_deadlines: ProjectOverviewDeadline[];
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

export async function getProjects(
    params: ProjectListParams = {},
): Promise<ProjectListResponse> {
    const query = new URLSearchParams({
        page: String(params.page ?? 1),
        page_size: String(params.pageSize ?? 20),
        status: params.status ?? "ALL",
    });

    if (params.search?.trim()) {
        query.set("search", params.search.trim());
    }

    return apiRequest<ProjectListResponse>(
        `/projects?${query.toString()}`,
        { method: "GET" },
        "Unable to load projects.",
    );
}

export async function getProject(
    projectId: string,
): Promise<ProjectDetails> {
    return apiRequest<ProjectDetails>(
        `/projects/${encodeURIComponent(projectId)}`,
        { method: "GET" },
        "Unable to load project details.",
    );
}

export async function getProjectOverview(
    projectId: string,
): Promise<ProjectOverview> {
    return apiRequest<ProjectOverview>(
        `/projects/${encodeURIComponent(projectId)}/overview`,
        { method: "GET" },
        "Unable to load project overview.",
    );
}

export async function createProject(
    input: CreateProjectInput,
): Promise<ProjectDetails> {
    return apiRequest<ProjectDetails>(
        "/projects",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...input,
                name: input.name.trim(),
                key: input.key.trim().toUpperCase(),
                description: input.description?.trim() || null,
                logo_key: input.logo_key?.trim() || null,
                visibility: input.visibility?.trim().toUpperCase() || "INTERNAL",
                member_ids: input.member_ids ?? [],
            }),
        },
        "Unable to create the project.",
    );
}

export async function updateProject(
    projectId: string,
    input: UpdateProjectInput,
): Promise<ProjectDetails> {
    const payload = {
        ...input,
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.key !== undefined && { key: input.key.trim().toUpperCase() }),
        ...(input.description !== undefined && {
            description: input.description?.trim() || null,
        }),
        ...(input.logo_key !== undefined && {
            logo_key: input.logo_key?.trim() || null,
        }),
        ...(input.visibility !== undefined && {
            visibility: input.visibility.trim().toUpperCase(),
        }),
    };

    return apiRequest<ProjectDetails>(
        `/projects/${encodeURIComponent(projectId)}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        },
        "Unable to update the project.",
    );
}

export async function archiveProject(
    projectId: string,
): Promise<ProjectDetails> {
    return apiRequest<ProjectDetails>(
        `/projects/${encodeURIComponent(projectId)}/archive`,
        { method: "POST" },
        "Unable to archive the project.",
    );
}

export async function addProjectMember(input: {
    projectId: string;
    userId: string;
}): Promise<ProjectDetails> {
    return apiRequest<ProjectDetails>(
        `/projects/${encodeURIComponent(input.projectId)}/members`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: input.userId }),
        },
        "Unable to add the project member.",
    );
}

export async function removeProjectMember(input: {
    projectId: string;
    userId: string;
}): Promise<{
    message: string;
    project_id: string;
    user_id: string;
    removed_at: string;
}> {
    return apiRequest(
        `/projects/${encodeURIComponent(input.projectId)}/members/${encodeURIComponent(input.userId)}`,
        { method: "DELETE" },
        "Unable to remove the project member.",
    );
}

export type ProjectOptionsResponse = {
    teams: ProjectTeam[];
    project_managers: ProjectUser[];
    team_members: ProjectUser[];
};

export async function getProjectOptions(
    teamIds: string[] = [],
): Promise<ProjectOptionsResponse> {
    const query = new URLSearchParams();
    teamIds.forEach((teamId) => query.append("team_ids", teamId));
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : "";

    return apiRequest<ProjectOptionsResponse>(
        `/projects/options${suffix}`,
        { method: "GET" },
        "Unable to load project options.",
    );
}
