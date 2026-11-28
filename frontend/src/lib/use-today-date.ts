"use client";

import { useEffect, useState } from "react";

/**
 * Return the browser's local calendar date as YYYY-MM-DD.
 * The value is populated after mount so rendering remains pure and stable
 * between server rendering and client hydration.
 */
export function useTodayDate(): string {
    const [today, setToday] = useState("");

    useEffect(() => {
        const now = new Date();
        const localToday = new Date(
            now.getTime() - now.getTimezoneOffset() * 60_000,
        )
            .toISOString()
            .slice(0, 10);

        setToday(localToday);
    }, []);

    return today;
}
