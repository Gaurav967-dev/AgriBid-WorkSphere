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

export type DashboardResponse = {
    role_code: DashboardRole;
    metrics: DashboardMetric[];
    projects: DashboardProject[];
    team_project_distribution: TeamProjectDistribution[];
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