import { authenticatedFetch } from "@/features/auth/api/auth-api";

export type ReportBucket = {
    key: string;
    label: string;
    count: number;
};

export type ReportProjectOption = {
    id: string;
    name: string;
    key: string;
    status: string;
};

export type ReportTeamOption = {
    id: string;
    name: string;
    project_count: number;
};

export type ReportSprintOption = {
    id: string;
    project_id: string;
    project_key: string;
    name: string;
    status: string;
    start_date: string;
    end_date: string;
};

export type ReportsOptions = {
    projects: ReportProjectOption[];
    teams: ReportTeamOption[];
    sprints: ReportSprintOption[];
};

export type ProjectReport = {
    project_id: string;
    project_name: string;
    project_key: string;
    project_status: string;
    team_name: string;
    total_tickets: number;
    completed_tickets: number;
    pending_tickets: number;
    overdue_tickets: number;
    completion_percentage: number;
    tickets_by_priority: ReportBucket[];
    tickets_by_status: ReportBucket[];
    tickets_by_type: ReportBucket[];
};

export type TeamMemberWorkload = {
    user_id: string;
    full_name: string;
    role_code: string;
    assigned_tickets: number;
    completed_tickets: number;
    pending_tickets: number;
    overdue_tickets: number;
    in_progress_tickets: number;
    completion_percentage: number;
};

export type TeamReport = {
    team_id: string;
    team_name: string;
    project_count: number;
    total_assigned_tickets: number;
    completed_tickets: number;
    pending_tickets: number;
    overdue_tickets: number;
    completion_percentage: number;
    workload_by_member: TeamMemberWorkload[];
    tickets_by_status: ReportBucket[];
    interpretation_note: string;
};

export type SprintScopeChange = {
    ticket_id: string;
    ticket_key: string;
    title: string;
    change_type: "ADDED_AFTER_START" | "REMOVED_AFTER_START";
    occurred_at: string;
};

export type SprintReportTicket = {
    ticket_id: string;
    ticket_key: string;
    title: string;
    status: string;
    priority: string;
    type: string;
    assignee_name: string | null;
    added_at: string;
};

export type SprintReport = {
    sprint_id: string;
    sprint_name: string;
    project_id: string;
    project_name: string;
    project_key: string;
    sprint_status: string;
    start_date: string;
    end_date: string;
    started_at: string | null;
    completed_at: string | null;
    total_tickets: number;
    completed_work: number;
    incomplete_work: number;
    cancelled_work: number;
    completion_rate: number;
    tickets_added_after_start: number;
    tickets_removed_after_start: number;
    scope_change_count: number;
    tickets: SprintReportTicket[];
    scope_changes: SprintScopeChange[];
};

type ApiErrorPayload = {
    detail?: unknown;
    message?: unknown;
};

async function readError(response: Response, fallback: string): Promise<Error> {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    if (typeof payload.detail === "string" && payload.detail.trim()) {
        return new Error(payload.detail);
    }
    if (typeof payload.message === "string" && payload.message.trim()) {
        return new Error(payload.message);
    }
    return new Error(fallback);
}

async function getReport<T>(path: string, fallback: string): Promise<T> {
    const response = await authenticatedFetch(path, { method: "GET" });
    if (!response.ok) throw await readError(response, fallback);
    return (await response.json()) as T;
}

export function getReportsOptions(): Promise<ReportsOptions> {
    return getReport("/reports/options", "Unable to load report options.");
}

export function getProjectReport(projectId: string): Promise<ProjectReport> {
    return getReport(
        `/reports/projects/${encodeURIComponent(projectId)}`,
        "Unable to load the project report.",
    );
}

export function getTeamReport(teamId: string): Promise<TeamReport> {
    return getReport(
        `/reports/teams/${encodeURIComponent(teamId)}`,
        "Unable to load the team report.",
    );
}

export function getSprintReport(sprintId: string): Promise<SprintReport> {
    return getReport(
        `/reports/sprints/${encodeURIComponent(sprintId)}`,
        "Unable to load the sprint report.",
    );
}

export async function downloadReportCsv(
    reportType: "project" | "team" | "sprint",
    reportId: string,
): Promise<void> {
    const response = await authenticatedFetch(
        `/reports/${reportType}/${encodeURIComponent(reportId)}/export.csv`,
        { method: "GET" },
    );
    if (!response.ok) throw await readError(response, "Unable to export this report.");

    const blob = await response.blob();
    const contentDisposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1] ?? `${reportType}-report.csv`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
