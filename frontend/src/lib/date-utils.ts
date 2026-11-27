/**
 * Return today's date in the workspace's India business timezone for date inputs.
 * Formatting as YYYY-MM-DD avoids UTC offsets shifting the calendar day.
 */
export function todayDateInputValue(): string {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? "";

    return `${value("year")}-${value("month")}-${value("day")}`;
}

/**
 * Format a server-provided update timestamp for the workspace header.
 * Uses elapsed calendar-day intervals and never substitutes the current time
 * when the source timestamp is missing or invalid.
 */
export function relativeUpdateLabel(value?: string | null): string {
    if (!value) return "—";

    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return "—";

    const elapsedDays = Math.max(
        0,
        Math.floor((Date.now() - timestamp) / 86_400_000),
    );

    if (elapsedDays === 0) return "Today";
    if (elapsedDays === 1) return "1 day ago";
    return `${elapsedDays} days ago`;
}
