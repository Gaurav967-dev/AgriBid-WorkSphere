"use client";

import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    CalendarDays,
    CircleAlert,
    MessageCircle,
    Paperclip,
    Link2,
    Loader2,
    Plus,
} from "lucide-react";

import type { AuthUser } from "@/features/auth/api/auth-api";
import { getTicketComments, type Ticket, type TicketStatus } from "@/features/tickets/api/tickets-api";
import { getAttachments } from "@/features/attachments/api/attachments-api";

const BOARD_STATUSES: { value: TicketStatus; label: string; accent: string; dot: string }[] = [
    { value: "BACKLOG", label: "Backlog", accent: "border-t-slate-400", dot: "bg-slate-400" },
    { value: "TODO", label: "To do", accent: "border-t-sky-500", dot: "bg-sky-500" },
    { value: "IN_PROGRESS", label: "In progress", accent: "border-t-blue-500", dot: "bg-blue-500" },
    { value: "IN_REVIEW", label: "In review", accent: "border-t-violet-500", dot: "bg-violet-500" },
    { value: "TESTING", label: "Testing", accent: "border-t-amber-500", dot: "bg-amber-500" },
    { value: "TESTING_DONE", label: "Testing done", accent: "border-t-teal-500", dot: "bg-teal-500" },
    { value: "BUG_FIXED", label: "Bug fixed", accent: "border-t-orange-500", dot: "bg-orange-500" },
    { value: "COMPLETED", label: "Completed", accent: "border-t-emerald-500", dot: "bg-emerald-500" },
    { value: "BLOCKED", label: "Blocked", accent: "border-t-rose-500", dot: "bg-rose-500" },
    { value: "REOPENED", label: "Reopened", accent: "border-t-pink-500", dot: "bg-pink-500" },
    { value: "CANCELLED", label: "Cancelled", accent: "border-t-slate-400", dot: "bg-slate-400" },
];

function getAllowedTicketTransitions(
    ticket: Ticket,
    currentUser: AuthUser,
): TicketStatus[] {
    if (currentUser.role_code === "ADMIN" || currentUser.role_code === "PM") {
        return BOARD_STATUSES
            .map((status) => status.value)
            .filter((status) => status !== ticket.status);
    }

    if (
        ticket.status === "IN_REVIEW" &&
        ticket.reviewer?.id === currentUser.id
    ) {
        return ["TESTING"];
    }

    if (
        currentUser.role_code === "DEVELOPER" &&
        ticket.assignee?.id === currentUser.id
    ) {
        const transitions: Partial<Record<TicketStatus, TicketStatus[]>> = {
            TODO: ["IN_PROGRESS"],
            IN_PROGRESS: ["IN_REVIEW"],
            REOPENED: ["IN_PROGRESS"],
        };
        return transitions[ticket.status] ?? [];
    }

    if (
        currentUser.role_code === "TESTER" &&
        ticket.tester?.id === currentUser.id
    ) {
        const transitions: Partial<Record<TicketStatus, TicketStatus[]>> = {
            TESTING: ["TESTING_DONE", "BUG_FIXED", "REOPENED", "IN_PROGRESS"],
        };
        return transitions[ticket.status] ?? [];
    }

    return [];
}


const PRIORITY_STYLES = {
    LOW: { text: "text-slate-500 dark:text-slate-400", border: "border-l-slate-300 dark:border-l-slate-600", label: "Low" },
    MEDIUM: { text: "text-sky-600 dark:text-sky-400", border: "border-l-sky-500", label: "Medium" },
    HIGH: { text: "text-orange-600 dark:text-orange-400", border: "border-l-orange-500", label: "High" },
    CRITICAL: { text: "text-rose-600 dark:text-rose-400", border: "border-l-rose-500", label: "Critical" },
} as const;

const TYPE_LABELS = {
    EPIC: "Epic",
    STORY: "Story",
    TASK: "Task",
    SUBTASK: "Subtask",
    BUG: "Bug",
    IMPROVEMENT: "Improvement",
    TECHNICAL_DEBT: "Technical debt",
} as const;

function formatDueDate(value: string | null): string {
    if (!value) return "No due date";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "No due date";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
    }).format(date);
}

function isOverdue(ticket: Ticket): boolean {
    if (!ticket.due_date || ["COMPLETED", "CANCELLED"].includes(ticket.status)) {
        return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${ticket.due_date}T00:00:00`) < today;
}

function getInitials(fullName: string | undefined): string {
    if (!fullName?.trim()) return "—";
    return fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}

type TicketCardProps = {
    ticket: Ticket;
    isMoving: boolean;
    isDragging: boolean;
    canDrag: boolean;
    onDragStart: (event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
};

function TicketCard({ ticket, isMoving, isDragging, canDrag, onDragStart, onDragEnd }: TicketCardProps) {
    const [loadCounts, setLoadCounts] = useState(false);

    // Counts are secondary card metadata. Request them only after the user
    // interacts with a card so initial board navigation is not flooded with
    // per-ticket comments and attachment requests.
    const countsQuery = useQuery({
        queryKey: ["ticket-kanban-card-counts", ticket.id],
        enabled: loadCounts,
        staleTime: 10_000,
        queryFn: async () => {
            const [commentResponse, attachmentResponse] = await Promise.all([
                getTicketComments(ticket.id),
                getAttachments(ticket.project.id, ticket.id),
            ]);
            const comments = commentResponse.items.filter((comment) => !comment.is_deleted);
            const textToScan = [ticket.description ?? "", ...comments.map((comment) => comment.body ?? "")].join("\n");
            const linkMatches = textToScan.match(/https?:\/\/[^\s<>\"')\]]+/gi) ?? [];
            const uniqueLinks = new Set(linkMatches.map((value) => value.replace(/[),.;!?]+$/, "")).filter(Boolean));
            return { comments: comments.length, attachments: attachmentResponse.items.length, links: uniqueLinks.size };
        },
    });

    const overdue = isOverdue(ticket);
    const priority = PRIORITY_STYLES[ticket.priority];
    const countLabel = (value: number | undefined) => countsQuery.isError ? "—" : value ?? "…";

    return (
        <article
            onMouseEnter={() => setLoadCounts(true)}
            onFocusCapture={() => setLoadCounts(true)}
            draggable={canDrag && !isMoving}
            aria-label={`${ticket.ticket_key}: ${ticket.title}`}
            title={
                canDrag
                    ? "Drag to a status permitted for your role."
                    : "No status transition is available for your role or this ticket is not assigned to you."
            }
            onDragStart={(event) => {
                if (!canDrag || isMoving) {
                    event.preventDefault();
                    return;
                }
                onDragStart(event);
            }}
            onDragEnd={onDragEnd}
            className={`rounded-lg border border-l-[3px] border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-950 ${priority.border} ${isDragging ? "opacity-50" : ""}`}
        >
            <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-[10px] font-bold text-violet-700 dark:text-violet-300">{ticket.ticket_key}</span>
                <span className={`shrink-0 text-[10px] font-semibold ${priority.text}`}>{priority.label}</span>
            </div>
            <Link prefetch={false} href={`/dashboard/tickets/${ticket.id}`} className="mt-1 block line-clamp-2 text-[12px] font-semibold leading-4 text-slate-800 hover:text-violet-700 dark:text-slate-100 dark:hover:text-violet-300">{ticket.title}</Link>
            {ticket.description && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{ticket.description}</p>}

            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{TYPE_LABELS[ticket.type]}</span>
                <Link prefetch={false} href={`/dashboard/tickets/${ticket.id}`} className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 hover:underline dark:bg-violet-950/50 dark:text-violet-300">{ticket.project.key}</Link>
                {ticket.labels.slice(0, 2).map((label) => <span key={label} className="max-w-full truncate rounded-full bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-500 dark:bg-slate-900 dark:text-slate-400">{label}</span>)}
                {ticket.labels.length > 2 && <span className="text-[9px] text-slate-400">+{ticket.labels.length - 2}</span>}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-1.5" title={ticket.assignee?.full_name ?? "Unassigned"}>
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[8px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">{getInitials(ticket.assignee?.full_name)}</span>
                    <span className="truncate text-[9px] text-slate-500 dark:text-slate-400">{ticket.assignee?.full_name ?? "Unassigned"}</span>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 text-[9px] ${overdue ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-400"}`}><CalendarDays className="size-3" />{formatDueDate(ticket.due_date)}{overdue ? " · Overdue" : ""}</span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="Task activity counts">
                <span title="Active comments" aria-label={`${countLabel(countsQuery.data?.comments)} comments`} className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 px-1.5 text-[9px] text-slate-500 dark:border-slate-700 dark:text-slate-400"><MessageCircle className="size-3" />{countLabel(countsQuery.data?.comments)}</span>
                <span title="Attached files" aria-label={`${countLabel(countsQuery.data?.attachments)} attachments`} className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 px-1.5 text-[9px] text-slate-500 dark:border-slate-700 dark:text-slate-400"><Paperclip className="size-3" />{countLabel(countsQuery.data?.attachments)}</span>
                <span title="Unique URLs in the task description and active comments" aria-label={`${countLabel(countsQuery.data?.links)} links`} className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 px-1.5 text-[9px] text-slate-500 dark:border-slate-700 dark:text-slate-400"><Link2 className="size-3" />{countLabel(countsQuery.data?.links)}</span>
            </div>

        </article>
    );
}

export type TicketKanbanBoardProps = {
    tickets: Ticket[];
    currentUser: AuthUser;
    projectFilter: string;
    isMoving: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    notice: string | null;
    onDismissNotice: () => void;
    onStatusChange: (ticket: Ticket, nextStatus: TicketStatus, reason?: string) => void;
    onLoadMore: () => void;
};

export function TicketKanbanBoard({
    tickets,
    currentUser,
    projectFilter,
    isMoving,
    isLoadingMore,
    hasMore,
    notice,
    onDismissNotice,
    onStatusChange,
    onLoadMore,
}: TicketKanbanBoardProps) {
    const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<TicketStatus | null>(null);
    const [moveMessage, setMoveMessage] = useState<string | null>(null);
    const boardViewportRef = useRef<HTMLDivElement | null>(null);
    const dragPointerXRef = useRef<number | null>(null);
    const isDraggingRef = useRef(false);
    const autoScrollFrameRef = useRef<number | null>(null);

    function stopBoardAutoScroll() {
        isDraggingRef.current = false;
        dragPointerXRef.current = null;
        if (autoScrollFrameRef.current !== null) {
            window.cancelAnimationFrame(autoScrollFrameRef.current);
            autoScrollFrameRef.current = null;
        }
    }

    function autoScrollBoardFrame() {
        const viewport = boardViewportRef.current;
        const pointerX = dragPointerXRef.current;
        if (!viewport || !isDraggingRef.current || pointerX === null) {
            autoScrollFrameRef.current = null;
            return;
        }

        const bounds = viewport.getBoundingClientRect();
        const edgeSize = Math.min(104, Math.max(56, bounds.width * 0.1));
        const leftEdge = bounds.left + edgeSize;
        const rightEdge = bounds.right - edgeSize;
        let scrollDelta = 0;

        if (pointerX < leftEdge) {
            const proximity = Math.min(1, (leftEdge - pointerX) / edgeSize);
            scrollDelta = -Math.ceil(7 + proximity * 17);
        } else if (pointerX > rightEdge) {
            const proximity = Math.min(1, (pointerX - rightEdge) / edgeSize);
            scrollDelta = Math.ceil(7 + proximity * 17);
        }

        if (scrollDelta !== 0) {
            const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
            viewport.scrollLeft = Math.min(
                maxScrollLeft,
                Math.max(0, viewport.scrollLeft + scrollDelta),
            );
        }

        autoScrollFrameRef.current = window.requestAnimationFrame(autoScrollBoardFrame);
    }

    function handleBoardDragOver(event: DragEvent<HTMLDivElement>) {
        if (!isDraggingRef.current) return;
        event.preventDefault();
        dragPointerXRef.current = event.clientX;
        if (autoScrollFrameRef.current === null) {
            autoScrollFrameRef.current = window.requestAnimationFrame(autoScrollBoardFrame);
        }
    }

    function requestMove(ticket: Ticket, nextStatus: TicketStatus) {
        if (ticket.status === nextStatus || isMoving) return;

        const allowedTransitions = getAllowedTicketTransitions(ticket, currentUser);
        if (!allowedTransitions.includes(nextStatus)) {
            setMoveMessage(
                currentUser.role_code === "TESTER" && ticket.tester?.id !== currentUser.id
                    ? "This ticket is visible to you, but it is not assigned to you as its Tester. Ask the Project Manager to assign you in the ticket details."
                    : "That status transition is not permitted for your role and the ticket's current status."
            );
            return;
        }

        const requiresReason =
            ["BLOCKED", "REOPENED", "CANCELLED"].includes(nextStatus) ||
            ticket.status === "BLOCKED" ||
            (currentUser.role_code === "TESTER" &&
                ticket.status === "TESTING" &&
                nextStatus === "IN_PROGRESS");

        let reason: string | undefined;
        if (requiresReason) {
            const entered = window.prompt(
                `Enter a reason for moving ${ticket.ticket_key} to ${nextStatus.replaceAll("_", " ")}:`,
            );
            if (entered === null) return;
            reason = entered.trim();
            if (!reason) {
                setMoveMessage("A reason is required for this status transition.");
                return;
            }
        }

        setMoveMessage(null);
        onStatusChange(ticket, nextStatus, reason);
    }

    function handleDrop(event: DragEvent<HTMLElement>, nextStatus: TicketStatus) {
        event.preventDefault();
        const ticketId = event.dataTransfer.getData("text/plain") || draggingTicketId;
        const ticket = tickets.find((item) => item.id === ticketId);
        stopBoardAutoScroll();
        setDraggingTicketId(null);
        setDropTarget(null);
        if (ticket) requestMove(ticket, nextStatus);
    }

    const grouped = Object.fromEntries(
        BOARD_STATUSES.map(({ value }) => [value, tickets.filter((ticket) => ticket.status === value)]),
    ) as Record<TicketStatus, Ticket[]>;

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
            {(notice || moveMessage) && (
                <div
                    role="alert"
                    className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                >
                    <span className="flex items-start gap-2">
                        <CircleAlert className="mt-0.5 size-4 shrink-0" />
                        {moveMessage ?? notice}
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setMoveMessage(null);
                            onDismissNotice();
                        }}
                        className="font-semibold underline underline-offset-2"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <div
                ref={boardViewportRef}
                onDragOver={handleBoardDragOver}
                onWheel={(event) => {
                    const viewport = boardViewportRef.current;
                    if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return;

                    const target = event.target;
                    const columnBody =
                        target instanceof HTMLElement
                            ? target.closest<HTMLElement>("[data-kanban-column-scroll]")
                            : null;
                    const columnCanScrollVertically = Boolean(
                        columnBody &&
                        columnBody.scrollHeight > columnBody.clientHeight &&
                        ((event.deltaY < 0 && columnBody.scrollTop > 0) ||
                            (event.deltaY > 0 &&
                                columnBody.scrollTop + columnBody.clientHeight < columnBody.scrollHeight)),
                    );
                    const hasHorizontalWheel = Math.abs(event.deltaX) > 0;
                    const useVerticalWheelForHorizontal =
                        event.shiftKey || !columnCanScrollVertically;

                    if (hasHorizontalWheel) {
                        event.preventDefault();
                        viewport.scrollLeft += event.deltaX;
                    } else if (useVerticalWheelForHorizontal && event.deltaY !== 0) {
                        event.preventDefault();
                        viewport.scrollLeft += event.deltaY;
                    }
                }}
                aria-label="Kanban columns. Use the mouse wheel to scroll horizontally."
                className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
            >
                <div className="flex h-full w-max min-w-full min-h-[320px] items-stretch gap-2">
                    {BOARD_STATUSES.map((column) => {
                        const columnTickets = grouped[column.value];
                        const isTarget = dropTarget === column.value;
                        const canAddTask = currentUser.role_code === "ADMIN" || currentUser.role_code === "PM";

                        return (
                            <section
                                key={column.value}
                                aria-label={`${column.label} tasks`}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";
                                    setDropTarget(column.value);
                                }}
                                onDragLeave={(event) => {
                                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                        setDropTarget((current) => current === column.value ? null : current);
                                    }
                                }}
                                onDrop={(event) => handleDrop(event, column.value)}
                                className={`flex h-full w-[320px] max-w-[calc(100vw-300px)] shrink-0 flex-col overflow-hidden rounded-lg border border-t-[3px] bg-slate-100/80 transition-colors dark:border-slate-800 dark:bg-slate-900/70 ${column.accent} ${isTarget ? "ring-2 ring-violet-400 ring-offset-2 dark:ring-offset-slate-950" : ""}`}
                            >
                                <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 px-3 dark:border-slate-800">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className={`size-2 shrink-0 rounded-full ${column.dot}`} />
                                        <h2 className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                                            {column.label}
                                        </h2>
                                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                            {columnTickets.length}
                                        </span>
                                    </div>
                                    {canAddTask && (
                                        <Link
                                            href={`/dashboard/tickets/new?status=${encodeURIComponent(column.value)}${projectFilter !== "ALL" ? `&project_id=${encodeURIComponent(projectFilter)}` : ""}`}
                                            aria-label={`Add a task to ${column.label}`}
                                            title={`Add task to ${column.label}`}
                                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-violet-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-violet-300"
                                        >
                                            <Plus className="size-4" />
                                        </Link>
                                    )}
                                </header>

                                <div data-kanban-column-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-5">
                                    <div className="flex min-h-full flex-col gap-2">
                                        {columnTickets.length === 0 ? (
                                            <div className={`flex min-h-28 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-slate-400 dark:border-slate-700 ${isTarget ? "border-violet-400 bg-violet-50/70 dark:bg-violet-950/20" : "border-slate-300"}`}>
                                                {isTarget ? "Drop task here" : "No tasks in this column"}
                                            </div>
                                        ) : (
                                            columnTickets.map((ticket) => (
                                                <TicketCard
                                                    key={ticket.id}
                                                    ticket={ticket}
                                                    isMoving={isMoving}
                                                    isDragging={draggingTicketId === ticket.id}
                                                    canDrag={getAllowedTicketTransitions(ticket, currentUser).length > 0}
                                                    onDragStart={(event) => {
                                                        event.dataTransfer.setData("text/plain", ticket.id);
                                                        event.dataTransfer.effectAllowed = "move";
                                                        isDraggingRef.current = true;
                                                        dragPointerXRef.current = event.clientX;
                                                        setDraggingTicketId(ticket.id);
                                                        setMoveMessage(null);
                                                    }}
                                                    onDragEnd={() => {
                                                        stopBoardAutoScroll();
                                                        setDraggingTicketId(null);
                                                        setDropTarget(null);
                                                    }}
                                                />
                                            ))
                                        )}

                                        {canAddTask && (
                                            <Link
                                                href={`/dashboard/tickets/new?status=${encodeURIComponent(column.value)}${projectFilter !== "ALL" ? `&project_id=${encodeURIComponent(projectFilter)}` : ""}`}
                                                className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-violet-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-violet-300"
                                            >
                                                <Plus className="size-4" /> Add task
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>

            {hasMore && (
                <div className="flex h-7 shrink-0 items-center justify-center">
                    <button type="button" onClick={onLoadMore} disabled={isLoadingMore} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-violet-700 disabled:cursor-wait disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-violet-300">
                        {isLoadingMore && <Loader2 className="size-3 animate-spin" />}
                        {isLoadingMore ? "Loading more tasks..." : "Load more tasks"}
                    </button>
                </div>
            )}
        </div>
    );
}
