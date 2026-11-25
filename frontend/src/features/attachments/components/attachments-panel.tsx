"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, File, FileImage, FileText, Loader2, Paperclip, Trash2, Upload, X } from "lucide-react";

import {
    deleteAttachment,
    fetchAttachmentContent,
    getAttachments,
    uploadAttachments,
    type Attachment,
} from "@/features/attachments/api/attachments-api";

type Props = { projectId: string; ticketId?: string };
type Preview = { url: string; name: string; mimeType: string };

const ACCEPTED = ".jpg,.jpeg,.png,.webp,.pdf,.xls,.xlsx,.csv,.doc,.docx";

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    }).format(date);
}

function FileIcon({ mimeType }: { mimeType: string }) {
    if (mimeType.startsWith("image/")) return <FileImage className="size-4" />;
    if (mimeType === "application/pdf") return <FileText className="size-4" />;
    return <File className="size-4" />;
}

export function AttachmentsPanel({ projectId, ticketId }: Props) {
    const queryClient = useQueryClient();
    const inputRef = useRef<HTMLInputElement>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const queryKey = ["attachments", projectId, ticketId ?? "project"];

    const attachmentsQuery = useQuery({
        queryKey,
        queryFn: () => getAttachments(projectId, ticketId),
        enabled: Boolean(projectId),
    });

    useEffect(() => {
        return () => {
            if (preview?.url) URL.revokeObjectURL(preview.url);
        };
    }, [preview?.url]);

    const uploadMutation = useMutation({
        mutationFn: (files: File[]) => uploadAttachments(projectId, files, ticketId),
        onSuccess: async () => {
            setMessage("Files uploaded successfully.");
            if (inputRef.current) inputRef.current.value = "";
            await queryClient.invalidateQueries({ queryKey });
        },
        onError: (error: Error) => setMessage(error.message),
    });

    const deleteMutation = useMutation({
        mutationFn: (attachmentId: string) =>
            deleteAttachment(projectId, attachmentId, ticketId),
        onSuccess: async () => {
            setMessage("Attachment deleted.");
            await queryClient.invalidateQueries({ queryKey });
        },
        onError: (error: Error) => setMessage(error.message),
    });

    async function openPreview(item: Attachment) {
        try {
            const blob = await fetchAttachmentContent(projectId, item.id, "preview", ticketId);
            const url = URL.createObjectURL(blob);
            setPreview({ url, name: item.original_filename, mimeType: item.mime_type });
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Unable to preview this file.");
        }
    }

    async function download(item: Attachment) {
        try {
            const blob = await fetchAttachmentContent(projectId, item.id, "download", ticketId);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = item.original_filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Unable to download this file.");
        }
    }

    function remove(item: Attachment) {
        if (!window.confirm(`Delete ${item.original_filename}?`)) return;
        deleteMutation.mutate(item.id);
    }

    const items = attachmentsQuery.data?.items ?? [];

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Paperclip className="size-4" />
                    <span>{items.length} {items.length === 1 ? "file" : "files"}</span>
                    {ticketId && <span>· Maximum 5 per ticket</span>}
                    <span>· Maximum 5 MB each</span>
                </div>
                <div>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept={ACCEPTED}
                        className="hidden"
                        onChange={(event) => {
                            const selected = Array.from(event.target.files ?? []);
                            if (selected.length) {
                                setMessage(null);
                                uploadMutation.mutate(selected);
                            }
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploadMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                    >
                        {uploadMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                        {uploadMutation.isPending ? "Uploading..." : "Upload files"}
                    </button>
                </div>
            </div>

            <p className="text-[11px] text-slate-400">
                JPG, JPEG, PNG, WEBP, PDF, XLS, XLSX, CSV, DOC and DOCX.
            </p>

            {message && (
                <div className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <span>{message}</span>
                    <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss"><X className="size-3.5" /></button>
                </div>
            )}

            {attachmentsQuery.isLoading ? (
                <div className="flex justify-center py-5"><Loader2 className="size-5 animate-spin text-violet-600" /></div>
            ) : attachmentsQuery.isError ? (
                <div className="rounded-lg border border-dashed border-rose-200 p-4 text-center text-xs text-rose-600">
                    {attachmentsQuery.error.message}
                    <button type="button" onClick={() => attachmentsQuery.refetch()} className="ml-2 font-semibold underline">Retry</button>
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500 dark:border-slate-700">
                    No files attached yet.
                </div>
            ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                    {items.map((item) => (
                        <AttachmentRow
                            key={item.id}
                            item={item}
                            busy={deleteMutation.isPending}
                            onPreview={() => openPreview(item)}
                            onDownload={() => download(item)}
                            onDelete={() => remove(item)}
                        />
                    ))}
                </div>
            )}

            {preview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`}>
                    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                            <p className="min-w-0 truncate text-sm font-semibold">{preview.name}</p>
                            <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-5" /></button>
                        </div>
                        <div className="min-h-[50vh] flex-1 overflow-auto bg-slate-100 p-2 dark:bg-slate-950">
                            {preview.mimeType === "application/pdf" ? (
                                <iframe src={preview.url} title={preview.name} className="h-[75vh] w-full rounded-md bg-white" />
                            ) : (
                                <Image src={preview.url} alt={preview.name} width={1600} height={1200} unoptimized className="mx-auto max-h-[75vh] max-w-full object-contain" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AttachmentRow({
    item, busy, onPreview, onDownload, onDelete,
}: {
    item: Attachment;
    busy: boolean;
    onPreview: () => void;
    onDownload: () => void;
    onDelete: () => void;
}) {
    const canPreview = item.mime_type.startsWith("image/") || item.mime_type === "application/pdf";
    return (
        <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <FileIcon mimeType={item.mime_type} />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100" title={item.original_filename}>{item.original_filename}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    {formatSize(item.file_size)} · {item.mime_type} · {item.uploaded_by.full_name} · {formatDate(item.uploaded_at)}
                </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                {canPreview && <button type="button" onClick={onPreview} aria-label={`Preview ${item.original_filename}`} title="Preview" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-violet-700 dark:hover:bg-slate-800"><Eye className="size-4" /></button>}
                <button type="button" onClick={onDownload} aria-label={`Download ${item.original_filename}`} title="Download" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-violet-700 dark:hover:bg-slate-800"><Download className="size-4" /></button>
                <button type="button" onClick={onDelete} disabled={busy} aria-label={`Delete ${item.original_filename}`} title="Delete" className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-950"><Trash2 className="size-4" /></button>
            </div>
        </div>
    );
}
