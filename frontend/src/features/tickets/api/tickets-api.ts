import { authenticatedFetch } from "@/features/auth/api/auth-api";

export type TicketType =
    | "EPIC"
    | "STORY"
    | "TASK"
    | "SUBTASK"
    | "BUG"
    | "IMPROVEMENT"
    | "TECHNICAL_DEBT";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TicketStatus =
    | "BACKLOG"
    | "TODO"
    | "IN_PROGRESS"
    | "IN_REVIEW"
    | "TESTING"
    | "TESTING_DONE"
    | "BUG_FIXED"
    | "COMPLETED"
    | "BLOCKED"
    | "REOPENED"
    | "CANCELLED";

export type TicketUser = {
    id: string;
    full_name: string;
    email: string;
    role_code: "ADMIN" | "PM" | "DEVELOPER" | "TESTER";
};

export type TicketProject = {
    id: string;
    name: string;
    key: string;
};

export type Ticket = {
    id: string;
    project: TicketProject;
    number: number;
    ticket_key: string;
    title: string;
    description: string | null;
    type: TicketType;
    priority: TicketPriority;
    status: TicketStatus;
    reporter: TicketUser;
    assignee: TicketUser | null;
    reviewer: TicketUser | null;
    tester: TicketUser | null;
    start_date: string | null;
    due_date: string | null;
    estimated_effort: string | number | null;
    labels: string[];
    parent_ticket_id: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
};

export type TicketActivity = {
    id: string;
    actor: TicketUser;
    action: string;
    field_name: string | null;
    old_value: unknown;
    new_value: unknown;
    description: string | null;
    created_at: string;
};

export type TicketDetails = Ticket & {
    activities: TicketActivity[];
};

export type TicketListResponse = {
    items: Ticket[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
};

export type TicketListParams = {
    projectId?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    ticketType?: TicketType;
    assigneeId?: string;
    search?: string;
    sortBy?: "created_at" | "updated_at" | "due_date" | "priority" | "title" | "number";
    sortOrder?: "asc" | "desc";
    page?: number;
    pageSize?: number;
};

export type CreateTicketInput = {
    project_id: string;
    title: string;
    description?: string | null;
    type: TicketType;
    priority: TicketPriority;
    assignee_id?: string | null;
    reviewer_id?: string | null;
    tester_id?: string | null;
    start_date?: string | null;
    due_date?: string | null;
    estimated_effort?: number | null;
    labels?: string[];
    parent_ticket_id?: string | null;
};

export type UpdateTicketInput = {
    title?: string;
    description?: string | null;
    type?: TicketType;
    priority?: TicketPriority;
    assignee_id?: string | null;
    reviewer_id?: string | null;
    tester_id?: string | null;
    start_date?: string | null;
    due_date?: string | null;
    estimated_effort?: number | null;
    labels?: string[];
    parent_ticket_id?: string | null;
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

export async function getTickets(
    params: TicketListParams = {},
): Promise<TicketListResponse> {
    const query = new URLSearchParams({
        page: String(params.page ?? 1),
        page_size: String(params.pageSize ?? 10),
        sort_by: params.sortBy ?? "updated_at",
        sort_order: params.sortOrder ?? "desc",
    });

    if (params.projectId) query.set("project_id", params.projectId);
    if (params.status) query.set("status", params.status);
    if (params.priority) query.set("priority", params.priority);
    if (params.ticketType) query.set("ticket_type", params.ticketType);
    if (params.assigneeId) query.set("assignee_id", params.assigneeId);
    if (params.search?.trim()) query.set("search", params.search.trim());

    return apiRequest<TicketListResponse>(
        `/tickets?${query.toString()}`,
        { method: "GET" },
        "Unable to load tickets.",
    );
}

export async function getTicket(ticketId: string): Promise<TicketDetails> {
    return apiRequest<TicketDetails>(
        `/tickets/${encodeURIComponent(ticketId)}`,
        { method: "GET" },
        "Unable to load ticket details.",
    );
}

export async function createTicket(
    input: CreateTicketInput,
): Promise<TicketDetails> {
    return apiRequest<TicketDetails>(
        "/tickets",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        },
        "Unable to create the ticket.",
    );
}

export async function updateTicket(
    ticketId: string,
    input: UpdateTicketInput,
): Promise<TicketDetails> {
    return apiRequest<TicketDetails>(
        `/tickets/${encodeURIComponent(ticketId)}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        },
        "Unable to update the ticket.",
    );
}

export async function changeTicketStatus(
    ticketId: string,
    status: TicketStatus,
    reason?: string,
): Promise<TicketDetails> {
    return apiRequest<TicketDetails>(
        `/tickets/${encodeURIComponent(ticketId)}/status`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, reason }),
        },
        "Unable to change the ticket status.",
    );
}

export async function deleteTicket(ticketId: string): Promise<{
    message: string;
    ticket_id: string;
    deleted_at: string;
}> {
    return apiRequest(
        `/tickets/${encodeURIComponent(ticketId)}`,
        { method: "DELETE" },
        "Unable to delete the ticket.",
    );
}