import { authenticatedFetch } from "@/features/auth/api/auth-api";

export type Attachment = {
    id: string;
    project_id: string;
    ticket_id: string | null;
    original_filename: string;
    file_size: number;
    mime_type: string;
    uploaded_by: { id: string; full_name: string; email: string };
    uploaded_at: string;
};

type AttachmentListResponse = { items: Attachment[] };

function attachmentPath(projectId: string, ticketId?: string) {
    return ticketId
        ? `/tickets/${encodeURIComponent(ticketId)}/attachments`
        : `/projects/${encodeURIComponent(projectId)}/attachments`;
}

async function parseError(response: Response, fallback: string): Promise<Error> {
    const payload = await response.json().catch(() => ({})) as {
        detail?: unknown;
        message?: unknown;
    };
    if (typeof payload.detail === "string") return new Error(payload.detail);
    if (typeof payload.message === "string") return new Error(payload.message);
    return new Error(fallback);
}

export async function getAttachments(projectId: string, ticketId?: string) {
    const response = await authenticatedFetch(attachmentPath(projectId, ticketId), {
        method: "GET",
    });
    if (!response.ok) throw await parseError(response, "Unable to load attachments.");
    return await response.json() as AttachmentListResponse;
}

export async function uploadAttachments(
    projectId: string,
    files: File[],
    ticketId?: string,
) {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    const response = await authenticatedFetch(attachmentPath(projectId, ticketId), {
        method: "POST",
        body: form,
    });
    if (!response.ok) throw await parseError(response, "Unable to upload attachments.");
    return await response.json() as AttachmentListResponse;
}

export async function deleteAttachment(
    projectId: string,
    attachmentId: string,
    ticketId?: string,
) {
    const response = await authenticatedFetch(
        `${attachmentPath(projectId, ticketId)}/${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" },
    );
    if (!response.ok) throw await parseError(response, "Unable to delete attachment.");
    return await response.json() as { message: string; attachment_id: string };
}

export async function fetchAttachmentContent(
    projectId: string,
    attachmentId: string,
    action: "preview" | "download",
    ticketId?: string,
): Promise<Blob> {
    const response = await authenticatedFetch(
        `${attachmentPath(projectId, ticketId)}/${encodeURIComponent(attachmentId)}/${action}`,
        { method: "GET" },
    );
    if (!response.ok) throw await parseError(response, "Unable to retrieve attachment.");
    return response.blob();
}
