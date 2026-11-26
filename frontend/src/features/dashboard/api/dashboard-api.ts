import { authenticatedFetch } from "@/features/auth/api/auth-api";

export type DashboardRole = "ADMIN" | "PM" | "DEVELOPER" | "TESTER";

export type DashboardMetric = {
    key: string;
    title: string;
    value: number;
    description: string;
};

export type DashboardProject = {
    id: string;
    name: string;
    key: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    updated_at: string;
    team_name: string;
    project_manager_name: string;
    member_count: number;
};

export type TeamProjectDistribution = {
    team_id: string;
    team_name: string;
    project_count: number;
};

export type DashboardActivity = {
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

export type DashboardDeadline = {
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

export type DashboardTeamWorkload = {
    team_id: string;
    team_name: string;
    project_count: number;
    open_tickets: number;
    overdue_tickets: number;
};

export type DashboardResponse = {
    role_code: DashboardRole;
    metrics: DashboardMetric[];
    projects: DashboardProject[];
    team_project_distribution: TeamProjectDistribution[];
    recent_activities: DashboardActivity[];
    upcoming_deadlines: DashboardDeadline[];
    team_workload: DashboardTeamWorkload[];
};

type ApiErrorPayload = {
    detail?: unknown;
    message?: unknown;
};

export async function getDashboard(): Promise<DashboardResponse> {
    const response = await authenticatedFetch("/dashboard", {
        method: "GET",
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;

        const message =
            typeof payload.detail === "string"
                ? payload.detail
                : typeof payload.message === "string"
                    ? payload.message
                    : "Unable to load dashboard information.";

        throw new Error(message);
    }

    return (await response.json()) as DashboardResponse;
}
