"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    ArrowUpRight,
    CalendarDays,
    CircleHelp,
    FileText,
    FolderKanban,
    LayoutDashboard,
    ListTodo,
    Loader2,
    Search,
    X,
    Settings,
    ShieldCheck,
    Users,
    Workflow,
    type LucideIcon,
} from "lucide-react";

import type { AuthUser } from "@/features/auth/api/auth-api";
import { searchWorkspace } from "@/features/search/api/search-api";

type WorkspaceSidebarProps = {
    user: AuthUser | null;
    collapsed?: boolean;
    mobileOpen: boolean;
    onMobileClose: () => void;
};

type NavigationItem = {
    label: string;
    href?: string;
    icon: LucideIcon;
    adminOnly?: boolean;
    disabled?: boolean;
};

const MAIN_NAVIGATION: NavigationItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "My Work", icon: ListTodo, disabled: true },
    { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
    { label: "Teams", href: "/dashboard/teams", icon: Users, adminOnly: true },
    { label: "Tasks", href: "/dashboard/tickets", icon: FileText },
    { label: "Sprints & Backlog", href: "/dashboard/sprints", icon: Workflow },
    { label: "Calendar", icon: CalendarDays, disabled: true },
];

const MANAGEMENT_NAVIGATION: NavigationItem[] = [
    {
        label: "User Management",
        href: "/dashboard/users",
        icon: ShieldCheck,
        adminOnly: true,
    },
    { label: "Reports", icon: Activity, disabled: true },
    { label: "GitHub Activity", icon: FolderKanban, disabled: true },
    { label: "Settings", icon: Settings, disabled: true },
];

function roleLabel(roleCode?: string): string {
    const labels: Record<string, string> = {
        ADMIN: "Administrator",
        PM: "Project Manager",
        DEVELOPER: "Developer",
        TESTER: "Tester",
    };

    return labels[roleCode ?? ""] ?? "Workspace member";
}

function SidebarSection({
    title,
    items,
    pathname,
    isAdmin,
    collapsed,
    onNavigate,
}: {
    title: string;
    items: NavigationItem[];
    pathname: string;
    isAdmin: boolean;
    collapsed: boolean;
    onNavigate: () => void;
}) {
    const visibleItems = items.filter(
        (item) => !item.adminOnly || isAdmin,
    );

    return (
        <section>
            {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {title}
                </p>
            )}

            <div className="space-y-0.5">
                {visibleItems.map((item) => {
                    const Icon = item.icon;

                    const active = Boolean(
                        item.href &&
                        (pathname === item.href ||
                            (item.href !== "/dashboard" &&
                                pathname.startsWith(`${item.href}/`))),
                    );

                    const className = [
                        "flex min-h-9 items-center rounded-md py-1.5 text-[12px] transition-colors",
                        collapsed
                            ? "justify-center px-2"
                            : "gap-2.5 px-3",
                        active
                            ? "bg-violet-50 font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                            : item.disabled
                                ? "cursor-not-allowed text-slate-400 dark:text-slate-600"
                                : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                    ].join(" ");

                    if (item.disabled || !item.href) {
                        return (
                            <div
                                key={item.label}
                                aria-disabled="true"
                                aria-label={item.label}
                                title={`${item.label} is not available yet`}
                                className={className}
                            >
                                <Icon className="size-4 shrink-0" />
                                {!collapsed && <span>{item.label}</span>}
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            aria-label={item.label}
                            title={collapsed ? item.label : undefined}
                            className={className}
                        >
                            <Icon className="size-4 shrink-0" />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}

function SidebarPanel({
    user,
    collapsed,
    onNavigate,
    onOpenSearch,
}: {
    user: AuthUser | null;
    collapsed: boolean;
    onNavigate: () => void;
    onOpenSearch: () => void;
}) {
    const pathname = usePathname();
    const isAdmin = user?.role_code === "ADMIN";

    return (
        <aside
            className={`flex h-full shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900 ${collapsed ? "w-16" : "w-[224px]"
                }`}
        >
            <div
                className={`flex h-12 shrink-0 items-center border-b border-slate-100 dark:border-slate-800 ${collapsed ? "justify-center px-2" : "gap-2.5 px-3"
                    }`}
            >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-violet-700 text-white">
                    <ShieldCheck className="size-4" />
                </div>

                {!collapsed && (
                    <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-slate-900 dark:text-slate-100">
                            AgriBid WorkSphere
                        </p>
                        <p className="text-[10px] text-slate-400">
                            Company workspace
                        </p>
                    </div>
                )}
            </div>

            <div className={collapsed ? "px-2 py-3" : "px-3 pb-3 pt-3"}>
                {collapsed ? (
                    <button
                        type="button"
                        onClick={onOpenSearch}
                        className="flex h-9 w-full items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:text-violet-300"
                        title="Search workspace"
                        aria-label="Search workspace"
                    >
                        <Search className="size-4" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onOpenSearch}
                        className="flex h-8 w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-left hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800"
                    >
                        <Search className="size-3.5 text-slate-400" />
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Search workspace
                        </span>
                        <span className="ml-auto rounded border border-slate-200 bg-white px-1 py-0.5 text-[9px] text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                            Ctrl K
                        </span>
                    </button>
                )}
            </div>

            <nav
                className={`min-h-0 flex-1 space-y-5 overflow-y-auto pb-4 ${collapsed ? "px-2" : "px-2.5"
                    }`}
            >
                <SidebarSection
                    title="Workspace"
                    items={MAIN_NAVIGATION}
                    pathname={pathname}
                    isAdmin={isAdmin}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                />

                <div className="border-t border-slate-100 dark:border-slate-800" />

                <SidebarSection
                    title="Management"
                    items={MANAGEMENT_NAVIGATION}
                    pathname={pathname}
                    isAdmin={isAdmin}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                />
            </nav>

            <div
                className={`shrink-0 border-t border-slate-100 dark:border-slate-800 ${collapsed ? "flex justify-center p-2" : "p-3"
                    }`}
            >
                {collapsed ? (
                    <div
                        className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                        title={`${user?.full_name || user?.email || "Workspace user"} · ${roleLabel(user?.role_code)}`}
                    >
                        {user?.full_name?.trim().charAt(0).toUpperCase() ||
                            "U"}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2.5 rounded-md px-1 py-1">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                                {user?.full_name
                                    ?.trim()
                                    .charAt(0)
                                    .toUpperCase() || "U"}
                            </div>

                            <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                                    {user?.full_name ||
                                        user?.email ||
                                        "Workspace user"}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {roleLabel(user?.role_code)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-2 flex items-center gap-2 px-1 text-[10px] text-slate-400">
                            <CircleHelp className="size-3.5" />
                            <span>AgriBid internal workspace</span>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}

function GlobalSearchDialog({
    user,
    onClose,
}: {
    user: AuthUser | null;
    onClose: () => void;
}) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const trimmedQuery = query.trim();

    useEffect(() => {
        const timeout = window.setTimeout(
            () => setDebouncedQuery(trimmedQuery),
            250,
        );
        return () => window.clearTimeout(timeout);
    }, [trimmedQuery]);

    const searchQuery = useQuery({
        queryKey: ["workspace-global-search", debouncedQuery],
        queryFn: () => searchWorkspace(debouncedQuery),
        enabled: debouncedQuery.length >= 2,
        staleTime: 10_000,
        retry: false,
    });
    const results = searchQuery.data;
    const isAdmin = user?.role_code === "ADMIN";

    function navigate(href: string) {
        router.push(href);
        onClose();
    }

    const resultClass = "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-violet-50 dark:hover:bg-violet-950/30";
    const metaClass = "truncate text-[10px] text-slate-400";

    return (
        <div
            className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/45 px-3 pt-[12vh] backdrop-blur-[2px]"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="workspace-search-title"
                className="flex max-h-[76vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
                <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
                    <Search className="size-5 shrink-0 text-slate-400" />
                    <label htmlFor="workspace-global-search" className="sr-only" id="workspace-search-title">Search workspace</label>
                    <input
                        id="workspace-global-search"
                        autoFocus
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search projects, tickets, users and teams..."
                        className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close search"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {trimmedQuery.length < 2 ? (
                        <p className="px-3 py-8 text-center text-xs text-slate-400">Enter at least 2 characters to search the workspace.</p>
                    ) : searchQuery.isFetching ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 className="size-4 animate-spin" /> Searching workspace...</div>
                    ) : searchQuery.isError ? (
                        <p role="alert" className="px-3 py-8 text-center text-xs text-rose-600">{searchQuery.error.message}</p>
                    ) : !results || (!results.projects.length && !results.tickets.length && !results.users.length && !results.teams.length) ? (
                        <p className="px-3 py-8 text-center text-xs text-slate-400">No matching workspace records found.</p>
                    ) : (
                        <div className="space-y-4">
                            {results.projects.length > 0 && <section>
                                <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Projects</h3>
                                {results.projects.map((project) => (
                                    <button key={project.id} type="button" onClick={() => navigate(`/dashboard/projects/${project.id}`)} className={resultClass}>
                                        <span className="min-w-0"><span className="block truncate text-xs font-semibold">{project.key} · {project.name}</span><span className={metaClass}>{project.status.replaceAll("_", " ")}</span></span><ArrowUpRight className="size-3.5 shrink-0 text-slate-400" />
                                    </button>
                                ))}
                            </section>}
                            {results.tickets.length > 0 && <section>
                                <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tickets</h3>
                                {results.tickets.map((ticket) => (
                                    <button key={ticket.id} type="button" onClick={() => navigate(`/dashboard/tickets/${ticket.id}`)} className={resultClass}>
                                        <span className="min-w-0"><span className="block truncate text-xs font-semibold">{ticket.ticket_key} · {ticket.title}</span><span className={metaClass}>{ticket.project_key} · {ticket.status.replaceAll("_", " ")} · {ticket.priority}</span></span><ArrowUpRight className="size-3.5 shrink-0 text-slate-400" />
                                    </button>
                                ))}
                            </section>}
                            {results.users.length > 0 && <section>
                                <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Users</h3>
                                {results.users.map((person) => isAdmin ? (
                                    <button key={person.id} type="button" onClick={() => navigate(`/dashboard/users/${person.id}`)} className={resultClass}>
                                        <span className="min-w-0"><span className="block truncate text-xs font-semibold">{person.full_name}</span><span className={metaClass}>{person.email} · {person.role_code}</span></span><ArrowUpRight className="size-3.5 shrink-0 text-slate-400" />
                                    </button>
                                ) : (
                                    <div key={person.id} className={resultClass}><span className="min-w-0"><span className="block truncate text-xs font-semibold">{person.full_name}</span><span className={metaClass}>{person.email} · {person.role_code}</span></span></div>
                                ))}
                            </section>}
                            {results.teams.length > 0 && <section>
                                <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Teams</h3>
                                {results.teams.map((team) => isAdmin ? (
                                    <button key={team.id} type="button" onClick={() => navigate("/dashboard/teams")} className={resultClass}>
                                        <span className="block truncate text-xs font-semibold">{team.name}</span><ArrowUpRight className="size-3.5 shrink-0 text-slate-400" />
                                    </button>
                                ) : (
                                    <div key={team.id} className={resultClass}><span className="block truncate text-xs font-semibold">{team.name}</span></div>
                                ))}
                            </section>}
                        </div>
                    )}
                </div>
                <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-800">
                    <span>Search is restricted to records you can access.</span>
                    <span>Esc to close</span>
                </div>
            </div>
        </div>
    );
}

export function WorkspaceSidebar({
    user,
    collapsed = false,
    mobileOpen,
    onMobileClose,
}: WorkspaceSidebarProps) {
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setSearchOpen(true);
            }
            if (event.key === "Escape") setSearchOpen(false);
        };
        window.addEventListener("keydown", handleShortcut);
        return () => window.removeEventListener("keydown", handleShortcut);
    }, []);

    return (
        <>
            <div className="sticky top-0 hidden h-screen shrink-0 self-start md:block">
                <SidebarPanel
                    user={user}
                    collapsed={collapsed}
                    onNavigate={onMobileClose}
                    onOpenSearch={() => setSearchOpen(true)}
                />
            </div>

            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={onMobileClose}
                        className="absolute inset-0 bg-slate-950/40"
                    />

                    <div className="absolute inset-y-0 left-0 shadow-xl">
                        <SidebarPanel
                            user={user}
                            collapsed={false}
                            onNavigate={onMobileClose}
                            onOpenSearch={() => {
                                setSearchOpen(true);
                                onMobileClose();
                            }}
                        />
                    </div>
                </div>
            )}

            {searchOpen && <GlobalSearchDialog user={user} onClose={() => setSearchOpen(false)} />}
        </>
    );
}