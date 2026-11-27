"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    AlertCircle,
    ArrowDownUp,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Columns3,
    FileJson,
    FileSpreadsheet,
    FileText,
    Filter,
    FolderKanban,
    List,
    Menu,
    PanelLeft,
    Plus,
    Search,
    Upload,
    X,
} from "lucide-react";

import {
    signOut,
    verifyToken,
    type AuthUser,
} from "@/features/auth/api/auth-api";
import {
    changeTicketStatus,
    createTicket,
    getTickets,
    getTicketFilterOptions,
    type CreateTicketInput,
    type Ticket,
    type TicketPriority,
    type TicketStatus,
    type TicketType,
} from "@/features/tickets/api/tickets-api";
import { getProjects } from "@/features/projects/api/projects-api";
import { TicketKanbanBoard } from "@/features/tickets/components/ticket-kanban-board";
import { WorkspaceActions } from "@/components/workspace-actions";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { useWorkspaceSidebarState } from "@/components/workspace-sidebar-state";

const PAGE_SIZE = 12;
const BOARD_PAGE_SIZE = 40;
const IMPORT_LIMIT = 100;

type TaskView = "board" | "list" | "calendar" | "backlog";
type CalendarMode = "month" | "week";
type SortField = "created_at" | "updated_at" | "due_date" | "priority" | "title";
type ImportFormat = "json" | "csv";

type TicketMetadata = Ticket & {
    reporter?: { full_name: string } | null;
    created_by?: { full_name: string } | null;
    updated_at?: string | null;
    comment_count?: number;
    comments_count?: number;
    attachment_count?: number;
    attachments_count?: number;
    link_count?: number;
    links_count?: number;
};

const STATUS_OPTIONS: { label: string; value: TicketStatus | "ALL" }[] = [
    { label: "All statuses", value: "ALL" },
    { label: "Backlog", value: "BACKLOG" },
    { label: "To do", value: "TODO" },
    { label: "In progress", value: "IN_PROGRESS" },
    { label: "In review", value: "IN_REVIEW" },
    { label: "Testing", value: "TESTING" },
    { label: "Testing done", value: "TESTING_DONE" },
    { label: "Bug fixed", value: "BUG_FIXED" },
    { label: "Completed", value: "COMPLETED" },
    { label: "Blocked", value: "BLOCKED" },
    { label: "Reopened", value: "REOPENED" },
    { label: "Cancelled", value: "CANCELLED" },
];

const PRIORITY_OPTIONS: { label: string; value: TicketPriority | "ALL" }[] = [
    { label: "All priorities", value: "ALL" },
    { label: "Low", value: "LOW" },
    { label: "Medium", value: "MEDIUM" },
    { label: "High", value: "HIGH" },
    { label: "Critical", value: "CRITICAL" },
];

const TYPE_OPTIONS: { label: string; value: TicketType | "ALL" }[] = [
    { label: "All types", value: "ALL" },
    { label: "Epic", value: "EPIC" },
    { label: "Story", value: "STORY" },
    { label: "Task", value: "TASK" },
    { label: "Subtask", value: "SUBTASK" },
    { label: "Bug", value: "BUG" },
    { label: "Improvement", value: "IMPROVEMENT" },
    { label: "Technical debt", value: "TECHNICAL_DEBT" },
];

const STATUS_STYLES: Record<TicketStatus, string> = {
    BACKLOG: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
    TODO: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
    IN_REVIEW: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
    TESTING: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    TESTING_DONE: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300",
    BUG_FIXED: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
    COMPLETED: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
    BLOCKED: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    REOPENED: "border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-300",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
    LOW: "text-slate-500",
    MEDIUM: "text-sky-600 dark:text-sky-400",
    HIGH: "text-orange-600 dark:text-orange-400",
    CRITICAL: "text-rose-600 dark:text-rose-400",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
    BACKLOG: "Backlog",
    TODO: "To do",
    IN_PROGRESS: "In progress",
    IN_REVIEW: "In review",
    TESTING: "Testing",
    TESTING_DONE: "Testing done",
    BUG_FIXED: "Bug fixed",
    COMPLETED: "Completed",
    BLOCKED: "Blocked",
    REOPENED: "Reopened",
    CANCELLED: "Cancelled",
};

const TYPE_LABELS: Record<TicketType, string> = {
    EPIC: "Epic",
    STORY: "Story",
    TASK: "Task",
    SUBTASK: "Subtask",
    BUG: "Bug",
    IMPROVEMENT: "Improvement",
    TECHNICAL_DEBT: "Technical debt",
};

const SORT_OPTIONS: { label: string; sortBy: SortField; sortOrder: "asc" | "desc" }[] = [
    { label: "Recently updated", sortBy: "updated_at", sortOrder: "desc" },
    { label: "Oldest updated", sortBy: "updated_at", sortOrder: "asc" },
    { label: "Newest created", sortBy: "created_at", sortOrder: "desc" },
    { label: "Oldest created", sortBy: "created_at", sortOrder: "asc" },
    { label: "Due date · earliest first", sortBy: "due_date", sortOrder: "asc" },
    { label: "Due date · latest first", sortBy: "due_date", sortOrder: "desc" },
    { label: "Priority · highest first", sortBy: "priority", sortOrder: "desc" },
    { label: "Priority · lowest first", sortBy: "priority", sortOrder: "asc" },
    { label: "Title · A to Z", sortBy: "title", sortOrder: "asc" },
    { label: "Title · Z to A", sortBy: "title", sortOrder: "desc" },
];

function dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatDate(value: string | null | undefined): string {
    if (!value) return "No due date";
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "No due date";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function formatToolbarDate(date: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

function formatOptionalDate(value: string | null | undefined): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function isOverdue(ticket: Ticket): boolean {
    if (!ticket.due_date || ["COMPLETED", "CANCELLED"].includes(ticket.status)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${ticket.due_date.slice(0, 10)}T00:00:00`) < today;
}

function StatusBadge({ status }: { status: TicketStatus }) {
    return (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
            <span className="mr-1.5 size-1.5 rounded-full bg-current" />
            {STATUS_LABELS[status]}
        </span>
    );
}

function PriorityLabel({ priority }: { priority: TicketPriority }) {
    return <span className={`text-xs font-semibold ${PRIORITY_STYLES[priority]}`}>{priority.charAt(0) + priority.slice(1).toLowerCase()}</span>;
}

function TicketRow({ ticket }: { ticket: Ticket }) {
    const extended = ticket as TicketMetadata;
    const reporter = extended.reporter?.full_name ?? extended.created_by?.full_name ?? "—";
    const updatedAt = extended.updated_at ?? null;
    const overdue = isOverdue(ticket);

    return (
        <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40">
            <td className="whitespace-nowrap px-4 py-3.5">
                <Link href={`/dashboard/tickets/${ticket.id}`} className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">{ticket.ticket_key}</Link>
            </td>
            <td className="min-w-[230px] px-4 py-3.5">
                <Link href={`/dashboard/tickets/${ticket.id}`} className="block max-w-sm truncate text-sm font-semibold text-slate-800 hover:text-violet-700 dark:text-slate-100 dark:hover:text-violet-300">{ticket.title}</Link>
                <p className="mt-1 text-[11px] text-slate-400">{ticket.project.key} · {ticket.project.name}</p>
            </td>
            <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600 dark:text-slate-300">{TYPE_LABELS[ticket.type]}</td>
            <td className="px-4 py-3.5"><PriorityLabel priority={ticket.priority} /></td>
            <td className="px-4 py-3.5"><StatusBadge status={ticket.status} /></td>
            <td className="px-4 py-3.5">
                <div className="flex min-w-[130px] items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">{ticket.assignee?.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() ?? "—"}</span>
                    <span className="truncate text-xs text-slate-600 dark:text-slate-300">{ticket.assignee?.full_name ?? "Unassigned"}</span>
                </div>
            </td>
            <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">{reporter}</td>
            <td className="whitespace-nowrap px-4 py-3.5">
                <span className={`flex items-center gap-1.5 text-xs ${overdue ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
                    <CalendarDays className="size-3.5" />{formatDate(ticket.due_date)}
                </span>
                {overdue && <span className="ml-5 text-[10px] font-semibold text-rose-600">Overdue</span>}
            </td>
            <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">{formatOptionalDate(updatedAt)}</td>
        </tr>
    );
}

function CalendarGrid({
    date,
    mode,
    tickets,
    selectedDay,
    onSelectDay,
}: {
    date: Date;
    mode: CalendarMode;
    tickets: Ticket[];
    selectedDay: string;
    onSelectDay: (value: string) => void;
}) {
    const days = useMemo(() => {
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        if (mode === "month") {
            start.setDate(start.getDate() - start.getDay());
            return Array.from({ length: 42 }, (_, index) => {
                const day = new Date(start);
                day.setDate(start.getDate() + index);
                return day;
            });
        }
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return Array.from({ length: 7 }, (_, index) => {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + index);
            return day;
        });
    }, [date, mode]);

    const grouped = useMemo(() => {
        const map = new Map<string, Ticket[]>();
        for (const ticket of tickets) {
            if (!ticket.due_date) continue;
            const key = ticket.due_date.slice(0, 10);
            map.set(key, [...(map.get(key) ?? []), ticket]);
        }
        return map;
    }, [tickets]);

    return (
        <div className={`grid h-full min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${mode === "month" ? "grid-cols-7 grid-rows-[26px_repeat(6,minmax(0,1fr))]" : "grid-cols-7 grid-rows-[26px_minmax(0,1fr)]"}`}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="border-b border-slate-200 bg-slate-50 px-1 py-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:bg-slate-950/60">{day}</div>
            ))}
            {days.map((day) => {
                const key = dateKey(day);
                const dayTickets = grouped.get(key) ?? [];
                const inMonth = day.getMonth() === date.getMonth();
                return (
                    <button key={key} type="button" onClick={() => onSelectDay(key)} className={`min-h-0 overflow-hidden border-b border-r border-slate-100 p-1.5 text-left transition hover:bg-violet-50/60 dark:border-slate-800 dark:hover:bg-violet-950/20 ${selectedDay === key ? "bg-violet-50 ring-1 ring-inset ring-violet-300 dark:bg-violet-950/30 dark:ring-violet-800" : "bg-white dark:bg-slate-900"} ${mode === "month" && !inMonth ? "opacity-45" : ""}`}>
                        <span className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${selectedDay === key ? "bg-violet-700 text-white" : "text-slate-600 dark:text-slate-300"}`}>{day.getDate()}</span>
                        <span className="mt-0.5 block space-y-0.5">
                            {dayTickets.slice(0, mode === "month" ? 1 : 3).map((ticket) => (
                                <span key={ticket.id} className={`block truncate rounded px-1 py-0.5 text-[8px] font-medium ${isOverdue(ticket) ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"}`}>{ticket.ticket_key} · {ticket.title}</span>
                            ))}
                            {dayTickets.length > (mode === "month" ? 1 : 3) && <span className="block px-1 text-[8px] text-slate-400">+{dayTickets.length - (mode === "month" ? 1 : 3)} more</span>}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function parseCsv(content: string): Record<string, string>[] {
    const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
        const cells: string[] = [];
        let value = "";
        let quoted = false;
        for (let index = 0; index < line.length; index += 1) {
            const char = line[index];
            if (char === '"' && line[index + 1] === '"' && quoted) {
                value += '"';
                index += 1;
            } else if (char === '"') {
                quoted = !quoted;
            } else if (char === "," && !quoted) {
                cells.push(value);
                value = "";
            } else {
                value += char;
            }
        }
        cells.push(value);
        return cells;
    };

    const headers = parseLine(lines[0]).map((header) => header.trim().toLowerCase());
    return lines.slice(1).map((line) => {
        const values = parseLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
}

function csvCell(value: unknown): string {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export default function TicketsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [user, setUser] = useState<AuthUser | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [view, setView] = useState<TaskView>("board");
    const [boardNotice, setBoardNotice] = useState<string | null>(null);
    const [importNotice, setImportNotice] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [status, setStatus] = useState<TicketStatus | "ALL">("ALL");
    const [priority, setPriority] = useState<TicketPriority | "ALL">("ALL");
    const [ticketType, setTicketType] = useState<TicketType | "ALL">("ALL");
    const [projectId, setProjectId] = useState("ALL");
    const [assigneeId, setAssigneeId] = useState("ALL");
    const [reporterId, setReporterId] = useState("ALL");
    const [teamId, setTeamId] = useState("ALL");
    const [dueDateFrom, setDueDateFrom] = useState("");
    const [dueDateTo, setDueDateTo] = useState("");
    const [createdDateFrom, setCreatedDateFrom] = useState("");
    const [createdDateTo, setCreatedDateTo] = useState("");
    const [labelFilter, setLabelFilter] = useState("");
    const [sprintId, setSprintId] = useState("ALL");
    const [filtersInitialized, setFiltersInitialized] = useState(false);
    const [sortBy, setSortBy] = useState<SortField>("updated_at");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    const [filterOpen, setFilterOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);
    const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
    const [importExportOpen, setImportExportOpen] = useState(false);
    const [calendarDate, setCalendarDate] = useState(() => new Date());
    const [selectedCalendarDay, setSelectedCalendarDay] = useState(() => dateKey(new Date()));
    const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
    const [importFormat, setImportFormat] = useState<ImportFormat>("json");
    const [isImporting, setIsImporting] = useState(false);
    const filterDropdownRef = useRef<HTMLDivElement | null>(null);
    const sortDropdownRef = useRef<HTMLDivElement | null>(null);
    const calendarDropdownRef = useRef<HTMLDivElement | null>(null);
    const importExportDropdownRef = useRef<HTMLDivElement | null>(null);
    const importInputRef = useRef<HTMLInputElement | null>(null);

    const { collapsed, toggleCollapsed } = useWorkspaceSidebarState();

    // Close an open toolbar menu when the pointer lands outside that menu.
    // The refs include each trigger and its popover, so interacting inside a
    // menu (including its controls) does not dismiss it.
    useEffect(() => {
        const handleDropdownPointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;

            if (filterOpen && !filterDropdownRef.current?.contains(target)) {
                setFilterOpen(false);
            }
            if (sortOpen && !sortDropdownRef.current?.contains(target)) {
                setSortOpen(false);
            }
            if (
                calendarPickerOpen &&
                !calendarDropdownRef.current?.contains(target)
            ) {
                setCalendarPickerOpen(false);
            }
            if (
                importExportOpen &&
                !importExportDropdownRef.current?.contains(target)
            ) {
                setImportExportOpen(false);
            }
        };

        const handleDropdownKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setFilterOpen(false);
            setSortOpen(false);
            setCalendarPickerOpen(false);
            setImportExportOpen(false);
        };

        document.addEventListener("pointerdown", handleDropdownPointerDown);
        document.addEventListener("keydown", handleDropdownKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handleDropdownPointerDown);
            document.removeEventListener("keydown", handleDropdownKeyDown);
        };
    }, [filterOpen, sortOpen, calendarPickerOpen, importExportOpen]);

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => window.clearTimeout(timeout);
    }, [search]);

    useEffect(() => {
        if (!filtersInitialized) return;
        const params = new URLSearchParams();
        if (view !== "board") params.set("view", view);
        if (page > 1) params.set("page", String(page));
        if (search.trim()) params.set("q", search.trim());
        if (projectId !== "ALL") params.set("project", projectId);
        if (status !== "ALL") params.set("status", status);
        if (priority !== "ALL") params.set("priority", priority);
        if (ticketType !== "ALL") params.set("type", ticketType);
        if (assigneeId !== "ALL") params.set("assignee", assigneeId);
        if (reporterId !== "ALL") params.set("reporter", reporterId);
        if (teamId !== "ALL") params.set("team", teamId);
        if (dueDateFrom) params.set("due_from", dueDateFrom);
        if (dueDateTo) params.set("due_to", dueDateTo);
        if (createdDateFrom) params.set("created_from", createdDateFrom);
        if (createdDateTo) params.set("created_to", createdDateTo);
        if (labelFilter.trim()) params.set("label", labelFilter.trim());
        if (sprintId !== "ALL") params.set("sprint", sprintId);
        if (sortBy !== "updated_at" || sortOrder !== "desc") {
            params.set("sort", sortBy);
            params.set("order", sortOrder);
        }
        const query = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }, [
        filtersInitialized, view, page, search, projectId, status, priority, ticketType,
        assigneeId, reporterId, teamId, dueDateFrom, dueDateTo, createdDateFrom,
        createdDateTo, labelFilter, sprintId, sortBy, sortOrder,
    ]);

    useEffect(() => {
        let active = true;
        verifyToken()
            .then(({ user: verifiedUser }) => {
                if (!active) return;
                const params = new URLSearchParams(window.location.search);
                const initialView = params.get("view");
                if (initialView === "board" || initialView === "list" || initialView === "calendar" || initialView === "backlog") {
                    setView(initialView);
                }
                setSearch((params.get("q") ?? "").slice(0, 100));
                setPage(Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1));

                const initialStatus = params.get("status") as TicketStatus | null;
                if (initialStatus && STATUS_OPTIONS.some((option) => option.value === initialStatus)) setStatus(initialStatus);
                const initialPriority = params.get("priority") as TicketPriority | null;
                if (initialPriority && PRIORITY_OPTIONS.some((option) => option.value === initialPriority)) setPriority(initialPriority);
                const initialType = params.get("type") as TicketType | null;
                if (initialType && TYPE_OPTIONS.some((option) => option.value === initialType)) setTicketType(initialType);

                setProjectId(params.get("project") || "ALL");
                setAssigneeId(params.get("assignee") || "ALL");
                setReporterId(params.get("reporter") || "ALL");
                setTeamId(params.get("team") || "ALL");
                setDueDateFrom(params.get("due_from") || "");
                setDueDateTo(params.get("due_to") || "");
                setCreatedDateFrom(params.get("created_from") || "");
                setCreatedDateTo(params.get("created_to") || "");
                setLabelFilter((params.get("label") ?? "").slice(0, 100));
                setSprintId(params.get("sprint") || "ALL");

                const initialSort = params.get("sort") as SortField | null;
                if (initialSort && SORT_OPTIONS.some((option) => option.sortBy === initialSort)) setSortBy(initialSort);
                const initialOrder = params.get("order");
                if (initialOrder === "asc" || initialOrder === "desc") setSortOrder(initialOrder);
                setFiltersInitialized(true);

                setUser(verifiedUser);
                setIsCheckingAuth(false);
            })
            .catch(() => {
                if (active) router.replace("/");
            });
        return () => {
            active = false;
        };
    }, [router]);

    const projectsQuery = useQuery({
        queryKey: ["ticket-project-filter-options"],
        queryFn: () => getProjects({ page: 1, pageSize: 100, status: "ALL" }),
        enabled: !isCheckingAuth && Boolean(user),
    });

    const filterOptionsQuery = useQuery({
        queryKey: ["ticket-filter-options", projectId],
        queryFn: () => getTicketFilterOptions(projectId === "ALL" ? undefined : projectId),
        enabled: !isCheckingAuth && Boolean(user) && filtersInitialized,
    });

    const ticketFilters = {
        search: debouncedSearch,
        status: status === "ALL" ? undefined : status,
        priority: priority === "ALL" ? undefined : priority,
        ticketType: ticketType === "ALL" ? undefined : ticketType,
        projectId: projectId === "ALL" ? undefined : projectId,
        assigneeId: assigneeId === "ALL" || assigneeId === "UNASSIGNED" ? undefined : assigneeId,
        assigneeUnassigned: assigneeId === "UNASSIGNED",
        reporterId: reporterId === "ALL" ? undefined : reporterId,
        teamId: teamId === "ALL" ? undefined : teamId,
        dueDateFrom: dueDateFrom || undefined,
        dueDateTo: dueDateTo || undefined,
        createdDateFrom: createdDateFrom || undefined,
        createdDateTo: createdDateTo || undefined,
        label: labelFilter.trim() || undefined,
        sprintId: sprintId === "ALL" ? undefined : sprintId,
        sortBy,
        sortOrder,
    };

    const ticketsQuery = useQuery({
        queryKey: ["tickets", "list", page, PAGE_SIZE, ticketFilters],
        queryFn: () => getTickets({ page, pageSize: PAGE_SIZE, ...ticketFilters }),
        enabled: !isCheckingAuth && Boolean(user) && filtersInitialized && view === "list",
    });

    const boardQuery = useInfiniteQuery({
        queryKey: ["tickets", "board", ticketFilters],
        queryFn: ({ pageParam }) => getTickets({ page: pageParam, pageSize: BOARD_PAGE_SIZE, ...ticketFilters }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
        enabled: !isCheckingAuth && Boolean(user) && filtersInitialized && view !== "list",
    });

    const statusMutation = useMutation({
        mutationFn: (input: { ticketId: string; nextStatus: TicketStatus; reason?: string }) =>
            changeTicketStatus(input.ticketId, input.nextStatus, input.reason),
        onSuccess: async () => {
            setBoardNotice(null);
            await queryClient.invalidateQueries({ queryKey: ["tickets"] });
        },
        onError: (error: Error) => setBoardNotice(error.message),
    });

    const boardTickets = boardQuery.data?.pages.flatMap((item) => item.items) ?? [];
    const tickets = view === "list" ? ticketsQuery.data?.items ?? [] : boardTickets;
    const visibleTickets = tickets;
    const visibleBoardTickets = boardTickets;
    const totalPages = Math.max(1, ticketsQuery.data?.total_pages ?? 1);
    const hasNextBoardPage = Boolean(boardQuery.hasNextPage);
    const isLoadingTickets = view === "list" ? ticketsQuery.isLoading : boardQuery.isLoading;
    const ticketsError = view === "list" ? ticketsQuery.error : boardQuery.error;
    const projects = projectsQuery.data?.items ?? [];
    const canCreateTicket = user?.role_code === "ADMIN" || user?.role_code === "PM";
    const activeFilterCount = [
        status !== "ALL", priority !== "ALL", ticketType !== "ALL", projectId !== "ALL",
        assigneeId !== "ALL", reporterId !== "ALL", teamId !== "ALL", dueDateFrom !== "",
        dueDateTo !== "", createdDateFrom !== "", createdDateTo !== "", labelFilter.trim() !== "",
        sprintId !== "ALL",
    ].filter(Boolean).length;

    function resetPage() {
        setPage(1);
    }

    function clearFilters() {
        setSearch("");
        setStatus("ALL");
        setPriority("ALL");
        setTicketType("ALL");
        setProjectId("ALL");
        setAssigneeId("ALL");
        setReporterId("ALL");
        setTeamId("ALL");
        setDueDateFrom("");
        setDueDateTo("");
        setCreatedDateFrom("");
        setCreatedDateTo("");
        setLabelFilter("");
        setSprintId("ALL");
        setSortBy("updated_at");
        setSortOrder("desc");
        resetPage();
    }

    function handleBoardStatusChange(ticket: Ticket, nextStatus: TicketStatus, reason?: string) {
        if (ticket.status === nextStatus || statusMutation.isPending) return;
        setBoardNotice(null);
        statusMutation.mutate({ ticketId: ticket.id, nextStatus, reason });
    }

    async function handleSignOut() {
        setIsSigningOut(true);
        try {
            await signOut();
        } catch {
            // The session may already have expired.
        } finally {
            router.replace("/");

        }
    }

    async function loadAllFilteredTickets(): Promise<{ items: Ticket[]; truncated: boolean }> {
        const collected: Ticket[] = [];
        let currentPage = 1;
        let totalPageCount = 1;
        do {
            const response = await getTickets({ page: currentPage, pageSize: 100, ...ticketFilters });
            collected.push(...response.items);
            totalPageCount = response.total_pages;
            currentPage += 1;
        } while (currentPage <= totalPageCount && collected.length < 5000);
        return { items: collected, truncated: currentPage <= totalPageCount };
    }

    async function exportTickets(format: "json" | "csv" | "markdown") {
        setImportExportOpen(false);
        setImportNotice(null);
        try {
            const exported = await loadAllFilteredTickets();
            const data = exported.items;
            const stamp = dateKey(new Date());
            if (format === "json") {
                const portable = data.map((ticket) => ({
                    project_id: ticket.project.id,
                    project_key: ticket.project.key,
                    title: ticket.title,
                    description: ticket.description,
                    type: ticket.type,
                    priority: ticket.priority,
                    assignee_id: (ticket as TicketMetadata & { assignee?: { id: string } | null }).assignee?.id ?? null,
                    reviewer_id: (ticket as TicketMetadata & { reviewer?: { id: string } | null }).reviewer?.id ?? null,
                    tester_id: (ticket as TicketMetadata & { tester?: { id: string } | null }).tester?.id ?? null,
                    start_date: ticket.start_date,
                    due_date: ticket.due_date,
                    estimated_effort: (ticket as TicketMetadata & { estimated_effort?: number | null }).estimated_effort ?? null,
                    labels: ticket.labels,
                    parent_ticket_id: (ticket as TicketMetadata & { parent_ticket_id?: string | null }).parent_ticket_id ?? null,
                }));
                downloadFile(`agribid-tasks-${stamp}.json`, JSON.stringify(portable, null, 2), "application/json;charset=utf-8");
            } else if (format === "csv") {
                const headers = ["project_id", "project_key", "title", "description", "type", "priority", "assignee_id", "reviewer_id", "tester_id", "start_date", "due_date", "estimated_effort", "labels", "parent_ticket_id"];
                const rows = data.map((ticket) => {
                    const record = ticket as TicketMetadata & { reviewer?: { id: string } | null; tester?: { id: string } | null; estimated_effort?: number | null; parent_ticket_id?: string | null };
                    return [ticket.project.id, ticket.project.key, ticket.title, ticket.description, ticket.type, ticket.priority, ticket.assignee?.id ?? "", record.reviewer?.id ?? "", record.tester?.id ?? "", ticket.start_date, ticket.due_date, record.estimated_effort ?? "", ticket.labels.join("|"), record.parent_ticket_id ?? ""];
                });
                const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
                downloadFile(`agribid-tasks-${stamp}.csv`, csv, "text/csv;charset=utf-8");
            } else {
                const markdown = [
                    "| Ticket | Title | Project | Type | Priority | Status | Assignee | Due date |",
                    "| --- | --- | --- | --- | --- | --- | --- | --- |",
                    ...data.map((ticket) => `| ${ticket.ticket_key} | ${ticket.title.replace(/\|/g, "\\|")} | ${ticket.project.key} | ${TYPE_LABELS[ticket.type]} | ${ticket.priority} | ${STATUS_LABELS[ticket.status]} | ${ticket.assignee?.full_name ?? "Unassigned"} | ${ticket.due_date ?? "—"} |`),
                ].join("\n");
                downloadFile(`agribid-tasks-${stamp}.md`, markdown, "text/markdown;charset=utf-8");
            }
            setImportNotice(exported.truncated
                ? `Exported the first ${data.length.toLocaleString("en-IN")} tasks. Refine filters to export a smaller result set.`
                : `Exported ${data.length} task${data.length === 1 ? "" : "s"}.`);
        } catch (error) {
            setImportNotice(error instanceof Error ? error.message : "Unable to export tasks.");
        }
    }

    function openImport(format: ImportFormat) {
        setImportFormat(format);
        setImportExportOpen(false);
        importInputRef.current?.click();
    }

    async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
        const inputElement = event.currentTarget;
        const file = inputElement.files?.[0];
        if (!file) return;
        setIsImporting(true);
        setImportNotice(null);
        let created = 0;
        try {
            const contents = await file.text();
            let records: Record<string, unknown>[];
            if (importFormat === "json") {
                const parsed: unknown = JSON.parse(contents);
                const value = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] })?.items;
                if (!Array.isArray(value)) throw new Error("JSON import must contain an array of task objects or an { items: [] } object.");
                records = value as Record<string, unknown>[];
            } else {
                records = parseCsv(contents);
            }
            if (records.length === 0) throw new Error("The selected file does not contain any task rows.");
            if (records.length > IMPORT_LIMIT) throw new Error(`Import is limited to ${IMPORT_LIMIT} tasks per file.`);

            const projectByKey = new Map(projects.map((project) => [project.key.toLowerCase(), project.id]));
            for (const [index, record] of records.entries()) {
                if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`Row ${index + 2}: expected a task object.`);
                const title = String(record.title ?? record.name ?? "").trim();
                const rawProjectId = String(record.project_id ?? "").trim();
                const rawProjectKey = String(record.project_key ?? record.project ?? "").trim();
                const mappedProjectId = rawProjectKey ? projectByKey.get(rawProjectKey.toLowerCase()) : undefined;
                const resolvedProjectId = [rawProjectId, mappedProjectId, projectId !== "ALL" ? projectId : ""].find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? "";
                const rawType = String(record.type ?? record.ticket_type ?? "TASK").toUpperCase() as TicketType;
                const rawPriority = String(record.priority ?? "MEDIUM").toUpperCase() as TicketPriority;
                if (!title) throw new Error(`Row ${index + 2}: title is required.`);
                if (!resolvedProjectId) throw new Error(`Row ${index + 2}: provide a valid project_id or project_key.`);
                if (!TYPE_OPTIONS.some((option) => option.value === rawType)) throw new Error(`Row ${index + 2}: unsupported ticket type.`);
                if (!PRIORITY_OPTIONS.some((option) => option.value === rawPriority)) throw new Error(`Row ${index + 2}: unsupported priority.`);

                const labelsValue = record.labels;
                const labels = Array.isArray(labelsValue)
                    ? labelsValue.map(String).map((label) => label.trim()).filter(Boolean)
                    : String(labelsValue ?? "").split(/[|;,]/).map((label) => label.trim()).filter(Boolean);
                const input: CreateTicketInput = {
                    project_id: resolvedProjectId,
                    title,
                    description: String(record.description ?? "").trim() || null,
                    type: rawType,
                    priority: rawPriority,
                    assignee_id: String(record.assignee_id ?? "").trim() || null,
                    reviewer_id: String(record.reviewer_id ?? "").trim() || null,
                    tester_id: String(record.tester_id ?? "").trim() || null,
                    start_date: String(record.start_date ?? "").trim() || null,
                    due_date: String(record.due_date ?? "").trim() || null,
                    estimated_effort: record.estimated_effort === undefined || record.estimated_effort === "" || record.estimated_effort === null ? null : Number(record.estimated_effort),
                    labels,
                    parent_ticket_id: String(record.parent_ticket_id ?? "").trim() || null,
                };
                if (input.estimated_effort != null && (!Number.isFinite(input.estimated_effort) || input.estimated_effort < 0)) {
                    throw new Error(`Row ${index + 2}: estimated effort must be a non-negative number.`);
                }
                await createTicket(input);
                created += 1;
            }
            await queryClient.invalidateQueries({ queryKey: ["tickets"] });
            setImportNotice(`Successfully imported ${created} task${created === 1 ? "" : "s"}.`);
        } catch (error) {
            if (created > 0) await queryClient.invalidateQueries({ queryKey: ["tickets"] });
            setImportNotice(`${created ? `Imported ${created} task(s) before the error. ` : ""}${error instanceof Error ? error.message : "Unable to import tasks."}`);
        } finally {
            setIsImporting(false);
            inputElement.value = "";
        }
    }

    if (isCheckingAuth || !user) {
        return (
            <main className="workspace-shell flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <p className="text-sm text-slate-600 dark:text-slate-300" role="status">Verifying your session...</p>
            </main>
        );
    }

    const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(calendarDate);
    const datePickerStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    datePickerStart.setDate(datePickerStart.getDate() - datePickerStart.getDay());
    const pickerDays = Array.from({ length: 42 }, (_, index) => {
        const day = new Date(datePickerStart);
        day.setDate(datePickerStart.getDate() + index);
        return day;
    });

    const dueDateTickets = visibleTickets.filter((ticket) => Boolean(ticket.due_date));
    const selectedDayTickets = dueDateTickets.filter((ticket) => ticket.due_date?.slice(0, 10) === selectedCalendarDay);
    const todayKey = dateKey(new Date());
    const priorityScore: Record<TicketPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const prioritizedTickets = [...visibleBoardTickets].sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority]);
    const unassignedTickets = visibleBoardTickets.filter((ticket) => !ticket.assignee);
    const futureTickets = visibleBoardTickets.filter((ticket) => ticket.due_date && ticket.due_date.slice(0, 10) > todayKey && !["COMPLETED", "CANCELLED"].includes(ticket.status));
    const sprintReadyTickets = visibleBoardTickets.filter((ticket) => ticket.status === "BACKLOG" && !ticket.assignee);

    return (
        <main className="workspace-shell flex h-dvh w-full min-w-0 max-w-full min-h-0 overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <WorkspaceSidebar user={user} collapsed={collapsed} mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

            <div className="flex h-full w-0 min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="hidden size-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 md:flex dark:text-slate-300 dark:hover:bg-slate-800"><PanelLeft className="size-4" /></button>
                        <button type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"><Menu className="size-5" /></button>
                        <p className="truncate text-sm font-semibold">Tasks</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2"><WorkspaceActions user={user} onSignOut={handleSignOut} isSigningOut={isSigningOut} /></div>
                </header>

                <section className="flex h-full w-full max-w-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden px-3 pb-2 pt-2 sm:px-4 lg:px-5">
                    <div className="mt-2 mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <div ref={filterDropdownRef} className="relative shrink-0">
                                <button type="button" onClick={() => { setFilterOpen((open) => !open); setSortOpen(false); setCalendarPickerOpen(false); setImportExportOpen(false); }} aria-expanded={filterOpen} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"><Filter className="size-4" /> Filter {activeFilterCount > 0 && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">{activeFilterCount}</span>}<ChevronDown className="size-3.5" /></button>
                                {filterOpen && (
                                    <div className="absolute left-0 top-11 z-40 max-h-[75vh] w-[min(94vw,420px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Filter tasks</h2><button type="button" onClick={() => setFilterOpen(false)} aria-label="Close filters" className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="size-4" /></button></div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Project</span><select value={projectId} onChange={(event) => { setProjectId(event.target.value); setAssigneeId("ALL"); setReporterId("ALL"); setTeamId("ALL"); setSprintId("ALL"); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"><option value="ALL">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.key} · {project.name}</option>)}</select></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Status</span><select value={status} onChange={(event) => { setStatus(event.target.value as TicketStatus | "ALL"); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950">{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Priority</span><select value={priority} onChange={(event) => { setPriority(event.target.value as TicketPriority | "ALL"); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950">{PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Type</span><select value={ticketType} onChange={(event) => { setTicketType(event.target.value as TicketType | "ALL"); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950">{TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Assignee</span><select value={assigneeId} onChange={(event) => { setAssigneeId(event.target.value); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"><option value="ALL">All assignees</option><option value="UNASSIGNED">Unassigned</option>{(filterOptionsQuery.data?.people ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Reporter</span><select value={reporterId} onChange={(event) => { setReporterId(event.target.value); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"><option value="ALL">All reporters</option>{(filterOptionsQuery.data?.people ?? []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Team</span><select value={teamId} onChange={(event) => { setTeamId(event.target.value); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"><option value="ALL">All teams</option>{(filterOptionsQuery.data?.teams ?? []).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Sprint</span><select value={sprintId} onChange={(event) => { setSprintId(event.target.value); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"><option value="ALL">All sprints</option>{(filterOptionsQuery.data?.sprints ?? []).map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.project_key} · {sprint.name}</option>)}</select></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Due date from</span><input type="date" value={dueDateFrom} max={dueDateTo || undefined} onChange={(event) => { setDueDateFrom(event.target.value); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950" /></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Due date to</span><input type="date" value={dueDateTo} min={dueDateFrom || undefined} onChange={(event) => { setDueDateTo(event.target.value); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950" /></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Created date from</span><input type="date" value={createdDateFrom} max={createdDateTo || undefined} onChange={(event) => { setCreatedDateFrom(event.target.value); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950" /></label>
                                            <label><span className="mb-1.5 block text-xs font-medium text-slate-500">Created date to</span><input type="date" value={createdDateTo} min={createdDateFrom || undefined} onChange={(event) => { setCreatedDateTo(event.target.value); resetPage(); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950" /></label>
                                            <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium text-slate-500">Label</span><input value={labelFilter} maxLength={100} onChange={(event) => { setLabelFilter(event.target.value); resetPage(); }} placeholder="Filter by exact label" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-950" /></label>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800"><button type="button" onClick={clearFilters} className="text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-violet-700">Clear all filters</button><button type="button" onClick={() => setFilterOpen(false)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">Apply</button></div>
                                    </div>
                                )}
                            </div>

                            <div ref={sortDropdownRef} className="relative">
                                <button type="button" onClick={() => { setSortOpen((open) => !open); setFilterOpen(false); setCalendarPickerOpen(false); setImportExportOpen(false); }} aria-expanded={sortOpen} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"><ArrowDownUp className="size-4" /> Sort <ChevronDown className="size-3.5" /></button>
                                {sortOpen && <div className="absolute left-0 top-11 z-40 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"><p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sort tasks</p>{SORT_OPTIONS.map((option) => { const selected = sortBy === option.sortBy && sortOrder === option.sortOrder; return <button key={`${option.sortBy}:${option.sortOrder}`} type="button" onClick={() => { setSortBy(option.sortBy); setSortOrder(option.sortOrder); resetPage(); setSortOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${selected ? "bg-violet-50 font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{option.label}{selected && <span>✓</span>}</button>; })}</div>}
                            </div>
                            <div className="relative w-[min(260px,30vw)] min-w-[170px]">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                                <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Search tasks..." aria-label="Search tasks" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-violet-950" />
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            <div ref={calendarDropdownRef} className="relative">
                                <button type="button" onClick={() => { setCalendarPickerOpen((open) => !open); setFilterOpen(false); setSortOpen(false); setImportExportOpen(false); }} aria-expanded={calendarPickerOpen} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"><CalendarDays className="size-4" />{formatToolbarDate(parseDateKey(selectedCalendarDay))}<ChevronDown className="size-3.5" /></button>
                                {calendarPickerOpen && <div className="absolute right-0 top-11 z-40 w-[296px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                    <div className="mb-3 flex items-center justify-between"><button type="button" aria-label="Previous month" onClick={() => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="size-4" /></button><span className="text-sm font-semibold">{monthLabel}</span><button type="button" aria-label="Next month" onClick={() => setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="size-4" /></button></div>
                                    <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-slate-400">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day} className="py-1">{day}</span>)}</div>
                                    <div className="grid grid-cols-7 gap-1">{pickerDays.map((day) => { const key = dateKey(day); const selected = key === selectedCalendarDay; const inMonth = day.getMonth() === calendarDate.getMonth(); return <button key={key} type="button" onClick={() => { setSelectedCalendarDay(key); setCalendarDate(day); setView("calendar"); setCalendarPickerOpen(false); }} className={`size-8 rounded-lg text-xs transition ${selected ? "bg-violet-700 font-semibold text-white" : inMonth ? "text-slate-700 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-violet-950/50" : "text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-800"}`}>{day.getDate()}</button>; })}</div>
                                    <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800"><button type="button" onClick={() => { const today = new Date(); setCalendarDate(today); setSelectedCalendarDay(dateKey(today)); }} className="w-full rounded-lg px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40">Today</button></div>
                                </div>}
                            </div>

                            <div ref={importExportDropdownRef} className="relative">
                                <button type="button" onClick={() => { setImportExportOpen((open) => !open); setFilterOpen(false); setSortOpen(false); setCalendarPickerOpen(false); }} aria-expanded={importExportOpen} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Import / Export <ChevronDown className="size-3.5" /></button>
                                {importExportOpen && <div className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                    <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Export current results</p>
                                    <button type="button" onClick={() => void exportTickets("json")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><FileJson className="size-4 text-slate-400" />Export as JSON</button>
                                    <button type="button" onClick={() => void exportTickets("csv")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><FileSpreadsheet className="size-4 text-slate-400" />Export as CSV</button>
                                    <button type="button" onClick={() => void exportTickets("markdown")} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><FileText className="size-4 text-slate-400" />Export as Markdown</button>
                                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                                    <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Import</p>
                                    <button type="button" onClick={() => openImport("json")} disabled={!canCreateTicket || isImporting} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"><Upload className="size-4 text-slate-400" />Import from JSON</button>
                                    <button type="button" onClick={() => openImport("csv")} disabled={!canCreateTicket || isImporting} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"><Upload className="size-4 text-slate-400" />Import from CSV</button>
                                </div>}
                            </div>

                            {canCreateTicket && <Link href="/dashboard/tickets/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"><Plus className="size-4" />Request task</Link>}
                            <input ref={importInputRef} type="file" accept={importFormat === "json" ? ".json,application/json" : ".csv,text/csv"} onChange={(event) => void handleImportFile(event)} className="hidden" />
                        </div>
                    </div>

                    <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                            {(["board", "list", "calendar", "backlog"] as TaskView[]).map((item) => {
                                const label = item === "board" ? "Board" : item === "list" ? "List" : item === "calendar" ? "Calendar" : "Backlog";
                                const Icon = item === "board" ? Columns3 : item === "list" ? List : item === "calendar" ? CalendarDays : FolderKanban;
                                return <button key={item} type="button" onClick={() => setView(item)} aria-pressed={view === item} className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold transition ${view === item ? "bg-violet-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><Icon className="size-3.5" />{label}</button>;
                            })}
                        </div>
                        <Link href={projectId !== "ALL" ? `/dashboard/projects/${projectId}` : "/dashboard/projects"} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-violet-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-violet-300"><FolderKanban className="size-3.5" />Project overview <ChevronRight className="size-3" /></Link>
                    </div>

                    {(importNotice || isImporting) && (
                        <div className="mb-1 flex shrink-0 items-center justify-between gap-3">
                            {importNotice && <p role="status" className={`text-[11px] ${importNotice.toLowerCase().includes("error") || importNotice.toLowerCase().includes("row ") || importNotice.toLowerCase().includes("unable") ? "text-rose-600" : "text-slate-500 dark:text-slate-400"}`}>{importNotice}</p>}
                            {isImporting && <span className="text-[11px] text-violet-600 dark:text-violet-300">Importing tasks...</span>}
                        </div>
                    )}

                    {projectsQuery.isError && <div role="alert" className="mb-2 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Project filters are temporarily unavailable. Existing task views remain available.</div>}

                    {ticketsError && (
                        <div className="mb-2 flex shrink-0 items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                            <AlertCircle className="mt-0.5 size-5 shrink-0" />
                            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Unable to load tasks</p><p className="mt-1 text-sm">{ticketsError instanceof Error ? ticketsError.message : "An unexpected error occurred."}</p><button type="button" onClick={() => { if (view === "list") void ticketsQuery.refetch(); else void boardQuery.refetch(); }} className="mt-2 text-sm font-semibold underline underline-offset-2">Try again</button></div>
                        </div>
                    )}

                    {isLoadingTickets ? (
                        <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-slate-400" role="status">Loading tasks...</div>
                    ) : view === "board" ? (
                        <TicketKanbanBoard tickets={visibleBoardTickets} currentUser={user} projectFilter={projectId} isMoving={statusMutation.isPending} isLoadingMore={boardQuery.isFetchingNextPage} hasMore={hasNextBoardPage} notice={boardNotice} onDismissNotice={() => setBoardNotice(null)} onStatusChange={handleBoardStatusChange} onLoadMore={() => void boardQuery.fetchNextPage()} />
                    ) : view === "list" ? (
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            {visibleTickets.length === 0 ? <div className="flex min-h-[320px] flex-col items-center justify-center px-5 text-center"><FileText className="size-8 text-slate-300" /><h2 className="mt-3 text-sm font-semibold">No matching tasks</h2><p className="mt-1 text-xs text-slate-500">Try another search or adjust your filters.</p></div> : <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[1200px] border-separate border-spacing-0 text-left"><thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60"><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{["Ticket ID", "Title", "Type", "Priority", "Status", "Assignee", "Reporter", "Due date", "Updated date"].map((header) => <th key={header} className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">{header}</th>)}</tr></thead><tbody>{visibleTickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)}</tbody></table></div>}
                            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-3 py-2 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</p><div className="flex items-center justify-end gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || ticketsQuery.isFetching} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronLeft className="size-3.5" />Previous</button><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || ticketsQuery.isFetching} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Next<ChevronRight className="size-3.5" /></button></div></div>
                        </div>
                    ) : view === "calendar" ? (
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                            <div className="flex shrink-0 items-center justify-between gap-2">
                                <div className="min-w-0"><h2 className="text-sm font-semibold">Due date calendar</h2><p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">Upcoming and overdue task deadlines</p></div>
                                <div className="inline-flex shrink-0 rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"><button type="button" onClick={() => setCalendarMode("month")} className={`rounded px-2.5 py-1 text-[10px] font-semibold ${calendarMode === "month" ? "bg-violet-700 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>Month</button><button type="button" onClick={() => setCalendarMode("week")} className={`rounded px-2.5 py-1 text-[10px] font-semibold ${calendarMode === "week" ? "bg-violet-700 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>Week</button></div>
                            </div>
                            <div className="flex h-7 shrink-0 items-center justify-between">
                                <button type="button" aria-label="Previous calendar period" onClick={() => setCalendarDate((current) => calendarMode === "month" ? new Date(current.getFullYear(), current.getMonth() - 1, 1) : new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))} className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><ChevronLeft className="size-3.5" /></button>
                                <p className="text-xs font-semibold">{calendarMode === "month" ? monthLabel : `${formatToolbarDate(parseDateKey(dateKey(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate() - calendarDate.getDay()))))} – ${formatToolbarDate(parseDateKey(dateKey(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate() - calendarDate.getDay() + 6))))}`}</p>
                                <button type="button" aria-label="Next calendar period" onClick={() => setCalendarDate((current) => calendarMode === "month" ? new Date(current.getFullYear(), current.getMonth() + 1, 1) : new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))} className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><ChevronRight className="size-3.5" /></button>
                            </div>
                            <div className="min-h-0 flex-1">
                                <CalendarGrid date={calendarDate} mode={calendarMode} tickets={dueDateTickets} selectedDay={selectedCalendarDay} onSelectDay={(value) => { setSelectedCalendarDay(value); setCalendarDate(parseDateKey(value)); }} />
                            </div>
                            <section className="max-h-[104px] shrink-0 overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                                <div className="mb-1.5 flex items-center justify-between gap-2"><h3 className="text-[11px] font-semibold">Tasks due {formatToolbarDate(parseDateKey(selectedCalendarDay))}</h3><span className="text-[10px] text-slate-400">{selectedDayTickets.length} task(s)</span></div>
                                {selectedDayTickets.length === 0 ? <p className="py-1 text-center text-[10px] text-slate-400">No tasks are due on this date.</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{selectedDayTickets.map((ticket) => <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`} className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-[9px] font-semibold text-violet-700 dark:text-violet-300">{ticket.ticket_key} · {ticket.project.key}</p><p className="truncate text-[11px] font-semibold">{ticket.title}</p></div><div className="flex shrink-0 items-center gap-1.5"><StatusBadge status={ticket.status} /><span className={`text-[9px] font-semibold ${isOverdue(ticket) ? "text-rose-600" : "text-slate-400"}`}>{isOverdue(ticket) ? "Overdue" : "Upcoming"}</span></div></Link>)}</div>}
                                {hasNextBoardPage && <button type="button" onClick={() => void boardQuery.fetchNextPage()} disabled={boardQuery.isFetchingNextPage} className="mt-1 text-[9px] font-semibold text-violet-700 hover:underline disabled:opacity-50 dark:text-violet-300">{boardQuery.isFetchingNextPage ? "Loading..." : "Load more tasks"}</button>}
                            </section>
                        </div>) : (
                        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 xl:overflow-hidden">
                            <div className="shrink-0"><h2 className="text-sm font-semibold">Backlog overview</h2><p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Unassigned and future work, sorted by priority. Sprint-ready candidates are unassigned backlog tasks; sprint assignment is managed separately.</p></div>
                            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto xl:grid-cols-2 xl:grid-rows-2 xl:overflow-hidden">
                                {[{ title: "Unassigned tasks", subtitle: "Tasks without an assigned owner", items: unassignedTickets }, { title: "Future tasks", subtitle: "Open tasks with a future due date", items: futureTickets }, { title: "Prioritized work", subtitle: "Current filtered tasks, highest priority first", items: prioritizedTickets }, { title: "Sprint-ready candidates", subtitle: "Unassigned tasks still in Backlog", items: sprintReadyTickets }].map((group) => <section key={group.title} className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><div className="mb-2 flex shrink-0 items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{group.title}</h3><p className="mt-1 text-[11px] text-slate-400">{group.subtitle}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{group.items.length}</span></div>{group.items.length === 0 ? <p className="py-6 text-center text-xs text-slate-400">No tasks in this group.</p> : <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100 pr-1 dark:divide-slate-800">{(group.title === "Prioritized work" ? group.items : group.items.slice(0, 8)).map((ticket) => <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">{ticket.ticket_key} · {ticket.project.key}</p><p className="mt-0.5 truncate text-xs font-semibold">{ticket.title}</p></div><div className="flex shrink-0 items-center gap-2"><PriorityLabel priority={ticket.priority} /><StatusBadge status={ticket.status} /></div></Link>)}</div>}</section>)}
                            </div>
                            {hasNextBoardPage && <div className="flex shrink-0 justify-center"><button type="button" onClick={() => void boardQuery.fetchNextPage()} disabled={boardQuery.isFetchingNextPage} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">{boardQuery.isFetchingNextPage ? "Loading..." : "Load more backlog tasks"}</button></div>}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
