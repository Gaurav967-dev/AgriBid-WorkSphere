"use client";

import { useSyncExternalStore } from "react";

function getLocalToday(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getServerSnapshot(): string {
    // Keep the server render and the client's hydration render identical.
    return "";
}

function subscribeToLocalDate(onStoreChange: () => void): () => void {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    let midnightTimer: number | undefined;

    const scheduleNextMidnight = () => {
        if (midnightTimer !== undefined) {
            window.clearTimeout(midnightTimer);
        }

        const now = new Date();
        const nextMidnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
        );

        midnightTimer = window.setTimeout(() => {
            onStoreChange();
            scheduleNextMidnight();
        }, Math.max(0, nextMidnight.getTime() - now.getTime() + 25));
    };

    const handlePageVisibility = () => {
        if (document.visibilityState === "visible") {
            onStoreChange();
            scheduleNextMidnight();
        }
    };

    window.addEventListener("focus", handlePageVisibility);
    document.addEventListener("visibilitychange", handlePageVisibility);
    scheduleNextMidnight();

    return () => {
        window.removeEventListener("focus", handlePageVisibility);
        document.removeEventListener("visibilitychange", handlePageVisibility);

        if (midnightTimer !== undefined) {
            window.clearTimeout(midnightTimer);
        }
    };
}

/**
 * Return the browser's local calendar date as YYYY-MM-DD.
 * useSyncExternalStore keeps the server and hydration snapshots identical,
 * then reads the browser's date after hydration without effect-driven state.
 */
export function useTodayDate(): string {
    return useSyncExternalStore(
        subscribeToLocalDate,
        getLocalToday,
        getServerSnapshot,
    );
}
