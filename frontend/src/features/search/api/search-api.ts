import { authenticatedFetch } from "@/features/auth/api/auth-api";

export type GlobalSearchResponse = {
    projects: Array<{ id: string; name: string; key: string; status: string }>;
    tickets: Array<{
        id: string;
        ticket_key: string;
        title: string;
        status: string;
        priority: string;
        project_id: string;
        project_name: string;
        project_key: string;
    }>;
    users: Array<{ id: string; full_name: string; email: string; role_code: string }>;
    teams: Array<{ id: string; name: string }>;
};

type SearchError = { detail?: unknown; message?: unknown };

export async function searchWorkspace(query: string): Promise<GlobalSearchResponse> {
    const params = new URLSearchParams({ q: query.trim(), limit: "6" });
    const response = await authenticatedFetch(`/search?${params.toString()}`);

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as SearchError;
        const message =
            typeof payload.detail === "string"
                ? payload.detail
                : typeof payload.message === "string"
                    ? payload.message
                    : "Unable to search the workspace.";
        throw new Error(message);
    }

    return (await response.json()) as GlobalSearchResponse;
}
