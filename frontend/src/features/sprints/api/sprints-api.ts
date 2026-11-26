import { authenticatedFetch } from "@/features/auth/api/auth-api";

export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

export type SprintTicket = {
    id: string;
    ticket_id: string;
    ticket_key: string;
    title: string;
    type: string;
    priority: string;
    status: string;
    assignee_name: string | null;
    due_date: string | null;
    added_at: string;
    status_at_close: string | null;
};

export type Sprint = {
    id: string;
    project_id: string;
    project_name: string;
    project_key: string;
    name: string;
    goal: string;
    start_date: string;
    end_date: string;
    status: SprintStatus;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
    assigned_tickets: number;
    completed_tickets: number;
    pending_tickets: number;
    completion_percentage: number;
    tickets: SprintTicket[];
};

export type SprintListResponse = {
    items: Sprint[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
};

export type SprintBacklogTicket = {
    id: string;
    ticket_key: string;
    title: string;
    type: string;
    priority: string;
    status: string;
    assignee_name: string | null;
    due_date: string | null;
};

export type SprintBacklogResponse = {
    items: SprintBacklogTicket[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
};

export type SprintInput = {
    name: string;
    goal: string;
    start_date: string;
    end_date: string;
};

export type SprintUpdateInput = Partial<SprintInput>;

type ApiErrorPayload = {
    detail?: unknown;
    message?: unknown;
};

async function readPayload<T>(response: Response): Promise<T> {
    return (await response.json().catch(() => ({}))) as T;
}

function getErrorMessage(payload: ApiErrorPayload, fallback: string): string {
    if (typeof payload.detail === "string" && payload.detail.trim()) {
        return payload.detail;
    }
    if (Array.isArray(payload.detail)) {
        const messages = payload.detail
            .map((item) =>
                item && typeof item === "object" && "msg" in item && typeof item.msg === "string"
                    ? item.msg
                    : null,
            )
            .filter((message): message is string => Boolean(message));
        if (messages.length) return messages.join(" ");
    }
    if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
    }
    return fallback;
}

async function apiRequest<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
    const response = await authenticatedFetch(path, init);
    if (!response.ok) {
        const payload = await readPayload<ApiErrorPayload>(response);
        throw new Error(getErrorMessage(payload, fallback));
    }
    return readPayload<T>(response);
}

function jsonRequest(method: "POST" | "PATCH", body?: unknown): RequestInit {
    return {
        method,
        ...(body !== undefined && {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }),
    };
}

export async function getProjectSprints(
    projectId: string,
    page = 1,
    pageSize = 50,
): Promise<SprintListResponse> {
    const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
    });
    return apiRequest(
        `/projects/${encodeURIComponent(projectId)}/sprints?${query.toString()}`,
        { method: "GET" },
        "Unable to load project sprints.",
    );
}

export async function getProjectBacklog(
    projectId: string,
    search = "",
    page = 1,
    pageSize = 50,
): Promise<SprintBacklogResponse> {
    const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
    });
    if (search.trim()) query.set("search", search.trim());
    return apiRequest(
        `/projects/${encodeURIComponent(projectId)}/backlog?${query.toString()}`,
        { method: "GET" },
        "Unable to load the project backlog.",
    );
}

export async function getSprint(sprintId: string): Promise<Sprint> {
    return apiRequest(
        `/sprints/${encodeURIComponent(sprintId)}`,
        { method: "GET" },
        "Unable to load sprint details.",
    );
}

export async function createSprint(projectId: string, input: SprintInput): Promise<Sprint> {
    return apiRequest(
        `/projects/${encodeURIComponent(projectId)}/sprints`,
        jsonRequest("POST", input),
        "Unable to create the sprint.",
    );
}

export async function updateSprint(sprintId: string, input: SprintUpdateInput): Promise<Sprint> {
    return apiRequest(
        `/sprints/${encodeURIComponent(sprintId)}`,
        jsonRequest("PATCH", input),
        "Unable to update the sprint.",
    );
}

export async function addSprintTickets(sprintId: string, ticketIds: string[]): Promise<Sprint> {
    return apiRequest(
        `/sprints/${encodeURIComponent(sprintId)}/tickets`,
        jsonRequest("POST", { ticket_ids: ticketIds }),
        "Unable to add tickets to the sprint.",
    );
}

export async function removeSprintTicket(
    sprintId: string,
    ticketId: string,
): Promise<{ message: string; sprint_id: string; ticket_id: string }> {
    return apiRequest(
        `/sprints/${encodeURIComponent(sprintId)}/tickets/${encodeURIComponent(ticketId)}`,
        { method: "DELETE" },
        "Unable to remove the ticket from the sprint.",
    );
}

export async function startSprint(sprintId: string): Promise<Sprint> {
    return apiRequest(
        `/sprints/${encodeURIComponent(sprintId)}/start`,
        jsonRequest("POST"),
        "Unable to start the sprint.",
    );
}

export async function completeSprint(sprintId: string): Promise<Sprint> {
    return apiRequest(
        `/sprints/${encodeURIComponent(sprintId)}/complete`,
        jsonRequest("POST"),
        "Unable to complete the sprint.",
    );
}
