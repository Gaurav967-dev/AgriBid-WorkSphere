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
