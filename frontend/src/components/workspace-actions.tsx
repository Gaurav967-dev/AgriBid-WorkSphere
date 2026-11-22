"use client";

import { useTheme } from "next-themes";
import { GitBranch, Moon, Sun } from "lucide-react";

export function WorkspaceActions() {
    const { resolvedTheme, setTheme } = useTheme();

    const isDark = resolvedTheme === "dark";

    const githubUrl =
        process.env.NEXT_PUBLIC_GITHUB_PROFILE_URL?.trim() ||
        "https://github.com";

    return (
        <div className="flex shrink-0 items-center gap-2">
            <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open GitHub"
                title="GitHub"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
                <GitBranch className="size-4" />
                <span className="hidden sm:inline">GitHub</span>
            </a>

            <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                aria-label={
                    isDark
                        ? "Switch to light mode"
                        : "Switch to dark mode"
                }
                title={
                    isDark
                        ? "Switch to light mode"
                        : "Switch to dark mode"
                }
                className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-violet-300"
            >
                {isDark ? (
                    <Sun className="size-4" />
                ) : (
                    <Moon className="size-4" />
                )}
            </button>
        </div>
    );
}