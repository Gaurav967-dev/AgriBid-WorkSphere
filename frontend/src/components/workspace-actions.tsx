"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Link2, Moon, Sun } from "lucide-react";
import type { AuthUser } from "@/features/auth/api/auth-api";

type WorkspaceActionsProps = {
    user?: AuthUser | null;
    lastUpdated?: string;
    onSignOut?: () => void;
    isSigningOut?: boolean;
};

export function WorkspaceActions({
    user,
    lastUpdated,
    onSignOut,
    isSigningOut = false,
}: WorkspaceActionsProps) {
    const { resolvedTheme, setTheme } = useTheme();
    const [shareState, setShareState] = useState<"idle" | "copied">("idle");
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const accountMenuRef = useRef<HTMLDivElement>(null);
    const isDark = resolvedTheme === "dark";
    const githubUrl =
        process.env.NEXT_PUBLIC_GITHUB_REPOSITORY_URL?.trim() ||
        "https://github.com/Gaurav967-dev/AgriBid-WorkSphere";

    useEffect(() => {
        if (!accountMenuOpen) return;

        function handleOutsidePointerDown(event: PointerEvent) {
            const target = event.target;
            if (
                target instanceof Node &&
                !accountMenuRef.current?.contains(target)
            ) {
                setAccountMenuOpen(false);
            }
        }

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        return () =>
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
    }, [accountMenuOpen]);

    async function shareWorkspace() {
        const shareData = {
            title: "AgriBid WorkSphere",
            text: "Open AgriBid WorkSphere",
            url: window.location.href,
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                setShareState("copied");
                window.setTimeout(() => setShareState("idle"), 1800);
            }
        } catch {
            // Sharing can be dismissed by the user.
        }
    }

    const initials = (user?.full_name || user?.email || "U")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");

    return (
        <div className="flex shrink-0 items-center gap-2">
            <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open GitHub"
                title="GitHub"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
                    <path d="M12 .297a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.74.08-.74 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.62-2.8 5.64-5.48 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .297Z" />
                </svg>
                <span className="hidden sm:inline">GitHub</span>
            </a>

            <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
                {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            {lastUpdated && lastUpdated !== "—" && (
                <span className="hidden whitespace-nowrap text-xs text-slate-500 xl:inline">
                    Last update <span className="font-medium text-slate-700 dark:text-slate-300">{lastUpdated}</span>
                </span>
            )}

            {user && (
                <div ref={accountMenuRef} className="relative">
                    <button
                        type="button"
                        onClick={() => setAccountMenuOpen((open) => !open)}
                        aria-label="Open account menu"
                        aria-expanded={accountMenuOpen}
                        title={`${user.full_name || user.email} · ${user.role_name || user.role_code || "Workspace member"}`}
                        className="flex size-9 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-xs font-bold text-violet-800 transition hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200"
                    >
                        {initials}
                    </button>
                    {accountMenuOpen && (
                        <div className="absolute right-0 top-11 z-50 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {user.full_name || user.email}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                                {user.role_name || user.role_code || "Workspace member"}
                            </p>
                            {onSignOut && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAccountMenuOpen(false);
                                        onSignOut();
                                    }}
                                    disabled={isSigningOut}
                                    className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    {isSigningOut ? "Signing out..." : "Sign out"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            <button
                type="button"
                onClick={shareWorkspace}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
                <Link2 className="size-4" />
                <span>{shareState === "copied" ? "Copied" : "Share"}</span>
            </button>
        </div>
    );
}
