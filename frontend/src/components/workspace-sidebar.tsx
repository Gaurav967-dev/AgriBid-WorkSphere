"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Activity,
    CalendarDays,
    CircleHelp,
    FileText,
    FolderKanban,
    LayoutDashboard,
    ListTodo,
    Search,
    Settings,
    ShieldCheck,
    Users,
    Workflow,
    type LucideIcon,
} from "lucide-react";

import type { AuthUser } from "@/features/auth/api/auth-api";

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
    { label: "Backlog", icon: Workflow, disabled: true },
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
}: {
    user: AuthUser | null;
    collapsed: boolean;
    onNavigate: () => void;
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
                    <div
                        className="flex h-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                        title="Search workspace"
                        aria-label="Search workspace"
                    >
                        <Search className="size-4" />
                    </div>
                ) : (
                    <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 dark:border-slate-700 dark:bg-slate-800">
                        <Search className="size-3.5 text-slate-400" />
                        <span className="text-[11px] text-slate-400">
                            Search workspace
                        </span>
                        <span className="ml-auto rounded border border-slate-200 bg-white px-1 py-0.5 text-[9px] text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                            Ctrl K
                        </span>
                    </div>
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

export function WorkspaceSidebar({
    user,
    collapsed = false,
    mobileOpen,
    onMobileClose,
}: WorkspaceSidebarProps) {
    return (
        <>
            <div className="sticky top-0 hidden h-screen shrink-0 self-start md:block">
                <SidebarPanel
                    user={user}
                    collapsed={collapsed}
                    onNavigate={onMobileClose}
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
                        />
                    </div>
                </div>
            )}
        </>
    );
}