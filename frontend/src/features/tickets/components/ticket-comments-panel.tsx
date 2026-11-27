"use client";

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AtSign,
    Bold,
    Code,
    Italic,
    LoaderCircle,
    MessageSquare,
    Pencil,
    Reply,
    Send,
    Trash2,
    X,
} from "lucide-react";

import type { AuthUser } from "@/features/auth/api/auth-api";
import type { ProjectUser } from "@/features/projects/api/projects-api";
import {
    createTicketComment,
    deleteTicketComment,
    getTicketComments,
    updateTicketComment,
    type TicketComment,
} from "@/features/tickets/api/tickets-api";

type TicketCommentsPanelProps = {
    ticketId: string;
    projectUsers: ProjectUser[];
    currentUser: AuthUser | null;
    canModerate: boolean;
};

type CommentComposerProps = {
    projectUsers: ProjectUser[];
    initialBody?: string;
    initialMentionIds?: string[];
    submitLabel: string;
    pending: boolean;
    onSubmit: (body: string, mentionedUserIds: string[]) => Promise<void>;
    onCancel?: () => void;
    autoFocus?: boolean;
};

function formatCommentDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function renderFormattedBody(body: string): ReactNode[] {
    const tokens = body.split(/(\*\*[^*\n]+\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|`[^`\n]+`)/g);

    return tokens.map((token, index) => {
        if (token.startsWith("**") && token.endsWith("**")) {
            return <strong key={index}>{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith("*") && token.endsWith("*")) {
            return <em key={index}>{token.slice(1, -1)}</em>;
        }
        if (token.startsWith("`") && token.endsWith("`")) {
            return (
                <code
                    key={index}
                    className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] dark:bg-slate-800"
                >
                    {token.slice(1, -1)}
                </code>
            );
        }
        return <span key={index}>{token}</span>;
    });
}

function isMarkdownFormatActive(
    body: string,
    selectionStart: number,
    selectionEnd: number,
    marker: string,
): boolean {
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const markerPositions: number[] = [];

    // Tokenize the requested marker instead of treating each character as a
    // delimiter. In particular, a bold pair (**...**) must never be treated
    // as an italic pair (*...*).
    for (let index = 0; index <= body.length - marker.length; index += 1) {
        if (marker === "*" && body.startsWith("**", index)) {
            index += 1;
            continue;
        }

        if (body[index] === "\\" && index + 1 < body.length) {
            index += 1;
            continue;
        }

        if (body.startsWith(marker, index)) {
            markerPositions.push(index);
            index += marker.length - 1;
        }
    }

    // The user may have selected the content only, or the full Markdown span.
    const selectionIsWrapped =
        markerPositions.includes(start - marker.length) &&
        markerPositions.includes(end);
    const selectionIncludesWrapper =
        markerPositions.includes(start) &&
        markerPositions.includes(end - marker.length);

    if (selectionIsWrapped || selectionIncludesWrapper) {
        return true;
    }

    // With a caret or a partial selection, an odd number of opening markers
    // before the range and a matching closing marker after it means the range
    // is inside this format.
    const markersBeforeSelection = markerPositions.filter(
        (position) => position < start,
    ).length;
    const hasClosingMarker = markerPositions.some(
        (position) => position >= end,
    );

    return markersBeforeSelection % 2 === 1 && hasClosingMarker;
}

function CommentComposer({
    projectUsers,
    initialBody = "",
    initialMentionIds = [],
    submitLabel,
    pending,
    onSubmit,
    onCancel,
    autoFocus = false,
}: CommentComposerProps) {
    const [body, setBody] = useState(initialBody);
    const [mentionedIds, setMentionedIds] = useState<string[]>(initialMentionIds);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [localError, setLocalError] = useState<string | null>(null);

    function captureSelection() {
        const textarea = textareaRef.current;
        if (!textarea) return;
        setSelection({
            start: textarea.selectionStart,
            end: textarea.selectionEnd,
        });
    }

    const suggestions = useMemo(() => {
        if (mentionQuery === null) return [];
        const normalized = mentionQuery.toLocaleLowerCase();
        return projectUsers
            .filter((person) =>
                person.full_name.toLocaleLowerCase().includes(normalized),
            )
            .slice(0, 6);
    }, [mentionQuery, projectUsers]);

    const activeFormats = useMemo(
        () => ({
            bold: isMarkdownFormatActive(body, selection.start, selection.end, "**"),
            italic: isMarkdownFormatActive(body, selection.start, selection.end, "*"),
            code: isMarkdownFormatActive(body, selection.start, selection.end, "`"),
        }),
        [body, selection],
    );

    function updateBody(value: string) {
        setLocalError(null);
        setBody(value.slice(0, 250));
        requestAnimationFrame(captureSelection);
        const match = /(?:^|\s)@([^\s@]*)$/.exec(value);
        setMentionQuery(match ? match[1] : null);
    }

    function selectMention(person: ProjectUser) {
        const marker = body.lastIndexOf("@");
        if (marker < 0) return;

        const nextBody = `${body.slice(0, marker)}@${person.full_name} `;
        if (nextBody.length > 250) {
            setLocalError("Comments cannot exceed 250 characters.");
            return;
        }
        setLocalError(null);
        setBody(nextBody);
        setMentionedIds((current) =>
            current.includes(person.id) ? current : [...current, person.id],
        );
        setMentionQuery(null);
        requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            textarea.focus();
            textarea.setSelectionRange(nextBody.length, nextBody.length);
            setSelection({ start: nextBody.length, end: nextBody.length });
        });
    }

    function wrapSelection(prefix: string, suffix = prefix) {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = body.slice(start, end);

        // Toggle off an existing wrapper immediately outside the selection.
        // This is the normal case after the first toolbar click, because the
        // selected text remains selected between the formatting markers.
        const hasOuterMarkers =
            start >= prefix.length &&
            body.slice(start - prefix.length, start) === prefix &&
            body.slice(end, end + suffix.length) === suffix;

        // Also support users who manually select the full Markdown-wrapped
        // text (including its markers) and then click the same format button.
        const selectionIncludesMarkers =
            selected.length >= prefix.length + suffix.length &&
            selected.startsWith(prefix) &&
            selected.endsWith(suffix);

        let nextBody: string;
        let nextSelectionStart: number;
        let nextSelectionEnd: number;

        if (hasOuterMarkers) {
            nextBody =
                body.slice(0, start - prefix.length) +
                selected +
                body.slice(end + suffix.length);
            nextSelectionStart = start - prefix.length;
            nextSelectionEnd = end - prefix.length;
        } else if (selectionIncludesMarkers) {
            const unwrapped = selected.slice(
                prefix.length,
                selected.length - suffix.length,
            );
            nextBody = body.slice(0, start) + unwrapped + body.slice(end);
            nextSelectionStart = start;
            nextSelectionEnd = start + unwrapped.length;
        } else {
            const content = selected || "text";
            const replacement = `${prefix}${content}${suffix}`;
            nextBody = body.slice(0, start) + replacement + body.slice(end);
            nextSelectionStart = start + prefix.length;
            nextSelectionEnd = nextSelectionStart + content.length;
        }

        if (nextBody.length > 250) {
            setLocalError("Comments cannot exceed 250 characters.");
            return;
        }
        setLocalError(null);
        setBody(nextBody);
        setMentionQuery(null);
        requestAnimationFrame(() => {
            // Keep the textarea focused and retain the selected text when the
            // toolbar is clicked, so repeated clicks can toggle formatting.
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
            setSelection({
                start: nextSelectionStart,
                end: nextSelectionEnd,
            });
        });
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const normalizedBody = body.trim();
        if (!normalizedBody) {
            setLocalError("Write a comment before submitting.");
            return;
        }
        if (normalizedBody.length > 250) {
            setLocalError("Comments cannot exceed 250 characters.");
            return;
        }

        const validMentionIds = mentionedIds.filter((id) => {
            const person = projectUsers.find((item) => item.id === id);
            return Boolean(person && normalizedBody.includes(`@${person.full_name}`));
        });

        setLocalError(null);
        try {
            await onSubmit(normalizedBody, validMentionIds);
            setBody("");
            setMentionedIds([]);
        } catch (error) {
            setLocalError(
                error instanceof Error ? error.message : "Unable to save the comment.",
            );
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[10px] font-medium text-slate-400">
                    Format
                </span>
                <button
                    type="button"
                    title="Bold"
                    aria-pressed={activeFormats.bold}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => wrapSelection("**")}
                    className={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${activeFormats.bold ? "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"}`}
                >
                    <Bold className="size-3.5" />
                </button>
                <button
                    type="button"
                    title="Italic"
                    aria-pressed={activeFormats.italic}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => wrapSelection("*")}
                    className={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${activeFormats.italic ? "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"}`}
                >
                    <Italic className="size-3.5" />
                </button>
                <button
                    type="button"
                    title="Inline code"
                    aria-pressed={activeFormats.code}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => wrapSelection("`")}
                    className={`inline-flex size-7 items-center justify-center rounded-md transition-colors ${activeFormats.code ? "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"}`}
                >
                    <Code className="size-3.5" />
                </button>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <AtSign className="size-3" /> Mention a project member
                </span>
            </div>

            <div className="relative">
                <textarea
                    ref={textareaRef}
                    autoFocus={autoFocus}
                    value={body}
                    maxLength={250}
                    rows={3}
                    onChange={(event) => {
                        updateBody(event.target.value);
                        requestAnimationFrame(captureSelection);
                    }}
                    onSelect={captureSelection}
                    onKeyUp={captureSelection}
                    onMouseUp={captureSelection}
                    onClick={captureSelection}
                    onFocus={captureSelection}
                    placeholder="Write a comment... Use @ to mention a teammate."
                    className="min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-violet-600 dark:focus:ring-violet-950"
                />
                {mentionQuery !== null && suggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 z-20 mb-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        {suggestions.map((person) => (
                            <button
                                key={person.id}
                                type="button"
                                onClick={() => selectMention(person)}
                                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-violet-50 dark:hover:bg-violet-950/40"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        {person.full_name}
                                    </span>
                                    <span className="block truncate text-[10px] text-slate-400">
                                        {person.email}
                                    </span>
                                </span>
                                <span className="ml-3 text-[10px] text-violet-600 dark:text-violet-300">
                                    {person.role_code}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">
                    {body.length}/250 characters
                </span>
                <div className="flex items-center gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={pending}
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                        >
                            <X className="size-3.5" /> Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={pending || !body.trim()}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {pending ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                            <Send className="size-3.5" />
                        )}
                        {submitLabel}
                    </button>
                </div>
            </div>
            {localError && (
                <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                    {localError}
                </p>
            )}
        </form>
    );
}

export function TicketCommentsPanel({
    ticketId,
    projectUsers,
    currentUser,
    canModerate,
}: TicketCommentsPanelProps) {
    const queryClient = useQueryClient();
    const [replyTo, setReplyTo] = useState<TicketComment | null>(null);
    const [editingComment, setEditingComment] = useState<TicketComment | null>(null);
    const [mutationError, setMutationError] = useState<string | null>(null);

    const commentsQuery = useQuery({
        queryKey: ["ticket-comments", ticketId],
        queryFn: () => getTicketComments(ticketId),
        enabled: Boolean(ticketId),
    });

    async function refreshAfterChange() {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["ticket-comments", ticketId] }),
            queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] }),
            queryClient.invalidateQueries({ queryKey: ["ticket-kanban-card-counts", ticketId] }),
        ]);
    }

    const createMutation = useMutation({
        mutationFn: (input: {
            body: string;
            parent_comment_id: string | null;
            mentioned_user_ids: string[];
        }) => createTicketComment(ticketId, input),
        onSuccess: refreshAfterChange,
    });

    const updateMutation = useMutation({
        mutationFn: (input: {
            commentId: string;
            body: string;
            mentioned_user_ids: string[];
        }) =>
            updateTicketComment(ticketId, input.commentId, {
                body: input.body,
                mentioned_user_ids: input.mentioned_user_ids,
            }),
        onSuccess: refreshAfterChange,
    });

    const deleteMutation = useMutation({
        mutationFn: (commentId: string) => deleteTicketComment(ticketId, commentId),
        onSuccess: refreshAfterChange,
    });

    const comments = useMemo(() => {
        return [...(commentsQuery.data?.items ?? [])].sort(
            (left, right) =>
                new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
        );
    }, [commentsQuery.data?.items]);

    const childrenByParent = useMemo(() => {
        const groups = new Map<string | null, TicketComment[]>();
        for (const comment of comments) {
            const siblings = groups.get(comment.parent_comment_id) ?? [];
            siblings.push(comment);
            groups.set(comment.parent_comment_id, siblings);
        }
        return groups;
    }, [comments]);

    async function submitNewComment(body: string, mentionedUserIds: string[], parentId: string | null) {
        setMutationError(null);
        await createMutation.mutateAsync({
            body,
            parent_comment_id: parentId,
            mentioned_user_ids: mentionedUserIds,
        });
        setReplyTo(null);
    }

    async function submitEdit(commentId: string, body: string, mentionedUserIds: string[]) {
        setMutationError(null);
        await updateMutation.mutateAsync({
            commentId,
            body,
            mentioned_user_ids: mentionedUserIds,
        });
        setEditingComment(null);
    }

    async function deleteComment(comment: TicketComment) {
        const approved = window.confirm("Delete this comment? The thread will remain visible as a deleted comment.");
        if (!approved) return;

        setMutationError(null);
        try {
            await deleteMutation.mutateAsync(comment.id);
        } catch (error) {
            setMutationError(
                error instanceof Error ? error.message : "Unable to delete the comment.",
            );
        }
    }

    function renderCommentTree(parentId: string | null, depth = 0): ReactNode {
        const children = childrenByParent.get(parentId) ?? [];
        if (!children.length) return null;

        return children.map((comment) => {
            const isAuthor = Boolean(currentUser?.id && currentUser.id === comment.author.id);
            const canDelete = !comment.is_deleted && (isAuthor || canModerate);
            const canEdit = !comment.is_deleted && isAuthor;
            const hasChildren = (childrenByParent.get(comment.id) ?? []).length > 0;

            return (
                <article key={comment.id} className={depth > 0 ? "ml-3 border-l border-slate-200 pl-3 dark:border-slate-700 sm:ml-5 sm:pl-4" : ""}>
                    <div className="py-2.5">
                        <div className="flex items-start gap-2">
                            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                                {comment.author.full_name.trim().charAt(0).toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        {comment.author.full_name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {formatCommentDate(comment.created_at)}
                                    </span>
                                    {comment.edited_at && !comment.is_deleted && (
                                        <span className="text-[10px] italic text-slate-400">edited</span>
                                    )}
                                </div>

                                {comment.is_deleted ? (
                                    <p className="mt-1.5 text-xs italic text-slate-400">
                                        This comment was deleted.
                                    </p>
                                ) : editingComment?.id === comment.id ? (
                                    <div className="mt-2">
                                        <CommentComposer
                                            projectUsers={projectUsers}
                                            initialBody={comment.body ?? ""}
                                            initialMentionIds={comment.mentioned_users.map((person) => person.id)}
                                            submitLabel="Save"
                                            pending={updateMutation.isPending}
                                            onSubmit={(body, ids) => submitEdit(comment.id, body, ids)}
                                            onCancel={() => setEditingComment(null)}
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
                                        {renderFormattedBody(comment.body ?? "")}
                                    </p>
                                )}

                                {!comment.is_deleted && editingComment?.id !== comment.id && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                                        {!isAuthor && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingComment(null);
                                                    setReplyTo(comment);
                                                }}
                                                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-violet-600 dark:hover:text-violet-300"
                                            >
                                                <Reply className="size-3" /> Reply
                                            </button>
                                        )}
                                        {canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReplyTo(null);
                                                    setEditingComment(comment);
                                                }}
                                                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-violet-600 dark:hover:text-violet-300"
                                            >
                                                <Pencil className="size-3" /> Edit
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                type="button"
                                                disabled={deleteMutation.isPending}
                                                onClick={() => void deleteComment(comment)}
                                                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
                                            >
                                                <Trash2 className="size-3" /> Delete
                                            </button>
                                        )}
                                    </div>
                                )}

                                {replyTo?.id === comment.id && !isAuthor && (
                                    <div className="mt-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/60">
                                        <p className="mb-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                            Replying to {comment.author.full_name}
                                        </p>
                                        <CommentComposer
                                            projectUsers={projectUsers}
                                            submitLabel="Reply"
                                            pending={createMutation.isPending}
                                            onSubmit={(body, ids) => submitNewComment(body, ids, comment.id)}
                                            onCancel={() => setReplyTo(null)}
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {hasChildren && (
                        <div className="border-t border-slate-100 dark:border-slate-800">
                            {renderCommentTree(comment.id, depth + 1)}
                        </div>
                    )}
                </article>
            );
        });
    }

    const commentCount = comments.length;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <MessageSquare className="size-3.5" />
                    {commentCount} {commentCount === 1 ? "comment" : "comments"}
                </p>
                <span className="text-[10px] text-slate-400">Project members can view and participate</span>
            </div>

            <CommentComposer
                projectUsers={projectUsers}
                submitLabel="Add comment"
                pending={createMutation.isPending}
                onSubmit={(body, ids) => submitNewComment(body, ids, null)}
            />

            {(mutationError || createMutation.error || updateMutation.error || deleteMutation.error) && (
                <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                    {mutationError ?? createMutation.error?.message ?? updateMutation.error?.message ?? deleteMutation.error?.message}
                </p>
            )}

            <div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {commentsQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                        <LoaderCircle className="size-4 animate-spin" /> Loading comments...
                    </div>
                ) : commentsQuery.isError ? (
                    <div className="py-5 text-center">
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                            {commentsQuery.error.message || "Unable to load comments."}
                        </p>
                        <button
                            type="button"
                            onClick={() => void commentsQuery.refetch()}
                            className="mt-2 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
                        >
                            Try again
                        </button>
                    </div>
                ) : commentCount === 0 ? (
                    <div className="py-5 text-center">
                        <MessageSquare className="mx-auto size-5 text-slate-300 dark:text-slate-600" />
                        <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                            No comments yet
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                            Start the discussion for this ticket.
                        </p>
                    </div>
                ) : (
                    <div>{renderCommentTree(null)}</div>
                )}
            </div>
        </div>
    );
}
