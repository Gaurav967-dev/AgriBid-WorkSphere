"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    CalendarDays,
    CheckCircle2,
    Circle,
    CircleAlert,
    CircleCheck,
    CircleDashed,
    CircleDot,
    CircleSlash,
    FileText,
    Hexagon,
    Info,
    Link2,
    Loader2,
    MessageSquare,
    Plus,
    RotateCcw,
    Sparkles,
} from "lucide-react";

import type { AuthUser } from "@/features/auth/api/auth-api";
import { getTicketComments, type Ticket, type TicketStatus } from "@/features/tickets/api/tickets-api";
import { getAttachments } from "@/features/attachments/api/attachments-api";

const BOARD_STATUSES: { value: TicketStatus; label: string }[] = [
    { value: "BACKLOG", label: "Backlog" },
    { value: "TODO", label: "To do" },
    { value: "IN_PROGRESS", label: "In progress" },
    { value: "IN_REVIEW", label: "In review" },
    { value: "TESTING", label: "Testing" },
    { value: "TESTING_DONE", label: "Testing done" },
    { value: "BUG_FIXED", label: "Bug fixed" },
    { value: "COMPLETED", label: "Completed" },
    { value: "BLOCKED", label: "Blocked" },
    { value: "REOPENED", label: "Reopened" },
    { value: "CANCELLED", label: "Cancelled" },
];

function TicketStatusGlyph({
    status,
    className = "size-4",
}: {
    status: TicketStatus;
    className?: string;
}) {
    const classes: Record<TicketStatus, string> = {
        BACKLOG: "text-slate-500",
        TODO: "text-slate-500",
        IN_PROGRESS: "text-amber-500",
        IN_REVIEW: "text-emerald-500",
        TESTING: "text-amber-500",
        TESTING_DONE: "text-teal-500",
        BUG_FIXED: "text-orange-500",
        COMPLETED: "text-emerald-500",
        BLOCKED: "text-rose-500",
        REOPENED: "text-pink-500",
        CANCELLED: "text-slate-400",
    };
    const iconClass = `${className} shrink-0 ${classes[status]}`;

    switch (status) {
        case "BACKLOG":
            return <CircleDashed className={iconClass} />;
        case "TODO":
            return <Circle className={iconClass} />;
        case "IN_PROGRESS":
        case "TESTING":
            return <CircleDot className={iconClass} />;
        case "IN_REVIEW":
            return <Circle className={iconClass} />;
        case "TESTING_DONE":
        case "BUG_FIXED":
        case "COMPLETED":
            return <CircleCheck className={iconClass} />;
        case "BLOCKED":
            return <CircleAlert className={iconClass} />;
        case "REOPENED":
            return <RotateCcw className={iconClass} />;
        case "CANCELLED":
            return <CircleSlash className={iconClass} />;
    }
}

function TicketPriorityGlyph({
    priority,
    status,
}: {
    priority: Ticket["priority"];
    status: TicketStatus;
}) {
    if (status === "COMPLETED") {
        return <CheckCircle2 aria-label="Completed" className="size-4 shrink-0 text-emerald-500" />;
    }

    switch (priority) {
        case "CRITICAL":
            return <Sparkles aria-label="Critical priority" className="size-4 shrink-0 text-pink-500" />;
        case "HIGH":
            return <Info aria-label="High priority" className="size-4 shrink-0 text-red-500" />;
        case "MEDIUM":
            return <Hexagon aria-label="Medium priority" className="size-4 shrink-0 text-cyan-500" />;
        case "LOW":
            return null;
    }
}

const LABEL_BADGE_PALETTE = [
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200",
    "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-200",
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200",
    "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
    "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
];

function labelBadgeClass(label: string): string {
    const hash = Array.from(label.toLowerCase()).reduce(
        (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
        0,
    );
    return LABEL_BADGE_PALETTE[hash % LABEL_BADGE_PALETTE.length];
}

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
        (
            ticket.reviewer?.id === currentUser.id ||
            ticket.reviewers?.some((reviewer) => reviewer.id === currentUser.id) === true
        )
    ) {
        return ["TESTING"];
    }

    if (
        currentUser.role_code === "DEVELOPER" &&
        (
            ticket.assignee?.id === currentUser.id ||
            ticket.assignees?.some((assignee) => assignee.id === currentUser.id) === true
        )
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
        (
            ticket.tester?.id === currentUser.id ||
            ticket.testers?.some((tester) => tester.id === currentUser.id) === true
        )
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
    const cardRef = useRef<HTMLElement | null>(null);
    const [loadCounts, setLoadCounts] = useState(false);

    // Load activity metadata only as a card approaches the viewport.
    useEffect(() => {
        const element = cardRef.current;
        if (!element) return;
        if (typeof IntersectionObserver === "undefined") {
            const timeoutId = globalThis.setTimeout(() => setLoadCounts(true), 0);
            return () => globalThis.clearTimeout(timeoutId);
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setLoadCounts(true);
                observer.disconnect();
            }
        }, { root: null, rootMargin: "140px" });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

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
            return {
                comments: comments.length,
                attachments: attachmentResponse.items.length,
                links: uniqueLinks.size,
            };
        },
    });

    const overdue = isOverdue(ticket);
    const assignees = ticket.assignees?.length
        ? ticket.assignees
        : ticket.assignee
            ? [ticket.assignee]
            : [];

    return (
        <article
            ref={cardRef}
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
            className={`shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-sm dark:border-slate-700 dark:bg-slate-950 ${isDragging ? "opacity-50" : ""}`}
        >
            <div className="px-3 py-2.5">
                <div className="mb-2 flex min-w-0 items-center gap-2">
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-slate-100 p-1 dark:bg-slate-800">
                        <TicketStatusGlyph status={ticket.status} className="size-3.5" />
                    </div>
                    <h3 className="min-w-0 flex-1 text-sm font-medium leading-tight">
                        <Link
                            href={`/dashboard/tickets/${ticket.id}`}
                            className="line-clamp-2 hover:underline"
                        >
                            {ticket.title}
                        </Link>
                    </h3>
                    <span title={`${ticket.priority.toLowerCase()} priority`}>
                        <TicketPriorityGlyph priority={ticket.priority} status={ticket.status} />
                    </span>
                </div>

                {ticket.description && (
                    <p className="mb-3 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {ticket.description}
                    </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                    <span className="w-fit shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {TYPE_LABELS[ticket.type]}
                    </span>
                    <Link
                        href={`/dashboard/tickets/${ticket.id}`}
                        title={ticket.project.name}
                        className="w-fit shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:underline dark:bg-slate-800 dark:text-slate-300"
                    >
                        {ticket.project.key}
                    </Link>
                    {ticket.labels.slice(0, 3).map((label) => (
                        <span
                            key={label}
                            className={`max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium ${labelBadgeClass(label)}`}
                        >
                            {label}
                        </span>
                    ))}
                    {ticket.labels.length > 3 && (
                        <span className="self-center text-[10px] text-slate-400">
                            +{ticket.labels.length - 3}
                        </span>
                    )}
                </div>
            </div>

            <div className="border-t border-dashed border-slate-200 px-3 py-2.5 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        {ticket.due_date && (
                            <div
                                className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 ${overdue
                                    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                                    : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                }`}
                                title={overdue ? "Overdue" : "Due date"}
                            >
                                <CalendarDays className="size-3" />
                                <span>{formatDueDate(ticket.due_date)}</span>
                                {overdue && <span className="font-semibold">· Overdue</span>}
                            </div>
                        )}
                        {Boolean(countsQuery.data?.comments) && (
                            <span
                                title="Active comments"
                                aria-label={`${countsQuery.data?.comments} comments`}
                                className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 px-2 py-1 dark:border-slate-700"
                            >
                                <MessageSquare className="size-3" />
                                {countsQuery.data?.comments}
                            </span>
                        )}
                        {Boolean(countsQuery.data?.attachments) && (
                            <span
                                title="Attachments"
                                aria-label={`${countsQuery.data?.attachments} attachments`}
                                className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 px-2 py-1 dark:border-slate-700"
                            >
                                <FileText className="size-3" />
                                {countsQuery.data?.attachments}
                            </span>
                        )}
                        {Boolean(countsQuery.data?.links) && (
                            <span
                                title="Links in the description and active comments"
                                aria-label={`${countsQuery.data?.links} links`}
                                className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 px-2 py-1 dark:border-slate-700"
                            >
                                <Link2 className="size-3" />
                                {countsQuery.data?.links}
                            </span>
                        )}
                    </div>

                    {assignees.length > 0 && (
                        <div
                            className="flex shrink-0 -space-x-2"
                            title={assignees.map((person) => person.full_name).join(", ")}
                            aria-label={`Assigned to ${assignees.map((person) => person.full_name).join(", ")}`}
                        >
                            {assignees.slice(0, 4).map((person) => (
                                <span
                                    key={person.id}
                                    title={person.full_name}
                                    className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[8px] font-semibold text-slate-700 dark:border-slate-950 dark:bg-slate-700 dark:text-slate-100"
                                >
                                    {getInitials(person.full_name)}
                                </span>
                            ))}
                            {assignees.length > 4 && (
                                <span className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[8px] font-semibold text-slate-600 dark:border-slate-950 dark:bg-slate-800 dark:text-slate-300">
                                    +{assignees.length - 4}
                                </span>
                            )}
                        </div>
                    )}
                </div>
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
            const isAssignedTester =
                ticket.tester?.id === currentUser.id ||
                ticket.testers?.some((tester) => tester.id === currentUser.id) === true;

            setMoveMessage(
                currentUser.role_code === "TESTER" && !isAssignedTester
                    ? "This ticket is visible to you, but it is not assigned to you as its Tester. Ask the Project Manager to assign you in the ticket details."
                    : "That status transition is not permitted for your role and the ticket's current status.",
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
                    if (!viewport) return;

                    const target = event.target as HTMLElement;
                    const columnScroller = target.closest<HTMLElement>("[data-kanban-column-scroll]");
                    const canScrollColumnVertically = Boolean(
                        columnScroller &&
                        columnScroller.scrollHeight > columnScroller.clientHeight &&
                        ((event.deltaY < 0 && columnScroller.scrollTop > 0) ||
                            (event.deltaY > 0 &&
                                columnScroller.scrollTop + columnScroller.clientHeight < columnScroller.scrollHeight)),
                    );

                    if (!event.shiftKey && event.deltaX === 0 && canScrollColumnVertically) {
                        return;
                    }

                    const horizontalDelta =
                        event.deltaX !== 0 ? event.deltaX : event.deltaY;
                    if (horizontalDelta !== 0) {
                        event.preventDefault();
                        viewport.scrollLeft += horizontalDelta;
                    }
                }}
                className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
            >
                <div className="flex h-full w-max min-w-full min-h-[320px] items-stretch gap-3">
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
                                className={`flex h-full w-[300px] max-w-[calc(100vw-300px)] shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-100/70 p-3 transition-colors dark:border-slate-800 dark:bg-slate-900/60 lg:w-[360px] ${isTarget ? "ring-2 ring-slate-400 ring-offset-2 dark:ring-offset-slate-950" : ""}`}
                            >
                                <header className="mb-2 flex shrink-0 items-center justify-between rounded-lg">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <TicketStatusGlyph status={column.value} />
                                        <h2 className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                            {column.label}
                                        </h2>
                                    </div>
                                    {canAddTask && (
                                        <Link
                                            href={`/dashboard/tickets/new?status=${column.value}${projectFilter !== "ALL" ? `&project_id=${encodeURIComponent(projectFilter)}` : ""}`}
                                            aria-label={`Add a task to ${column.label}`}
                                            title={`Add task to ${column.label}`}
                                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-slate-700 transition hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                            <Plus className="size-4" />
                                        </Link>
                                    )}
                                </header>

                                <div data-kanban-column-scroll className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                                    <div className="flex min-h-full flex-col gap-3 pb-2">
                                        {columnTickets.map((ticket) => (
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
                                        ))}

                                        {isTarget && columnTickets.length === 0 && (
                                            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                                                Drop task here
                                            </div>
                                        )}

                                        {canAddTask && (
                                            <Link
                                                href={`/dashboard/tickets/new?status=${column.value}${projectFilter !== "ALL" ? `&project_id=${encodeURIComponent(projectFilter)}` : ""}`}
                                                className="inline-flex h-auto shrink-0 items-center gap-2 self-start px-0 py-1 text-xs text-slate-700 hover:bg-transparent hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
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
                    <button type="button" onClick={onLoadMore} disabled={isLoadingMore} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                        {isLoadingMore && <Loader2 className="size-3 animate-spin" />}
                        {isLoadingMore ? "Loading more tasks..." : "Load more tasks"}
                    </button>
                </div>
            )}
        </div>
    );
}
