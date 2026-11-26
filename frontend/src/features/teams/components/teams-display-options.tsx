"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpNarrowWide, Check, SlidersHorizontal } from "lucide-react";

import {
    TEAM_DISPLAY_PROPERTIES,
    type TeamDisplayProperties,
    type TeamsOrdering,
} from "./teams-ui-types";

type Props = {
    ordering: TeamsOrdering;
    displayProperties: TeamDisplayProperties;
    onOrderingChange: (value: TeamsOrdering) => void;
    onToggleProperty: (key: keyof TeamDisplayProperties) => void;
};

const ORDERINGS: { value: TeamsOrdering; label: string }[] = [
    { value: "name", label: "Name" },
    { value: "members", label: "Members" },
    { value: "projects", label: "Projects" },
];

export function TeamsDisplayOptions({
    ordering,
    displayProperties,
    onOrderingChange,
    onToggleProperty,
}: Props) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) return;

        function handleOutsidePointerDown(event: PointerEvent) {
            const target = event.target;
            if (target instanceof Node && !rootRef.current?.contains(target)) {
                setOpen(false);
            }
        }

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        return () =>
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-label="Display options"
                aria-expanded={open}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
                <SlidersHorizontal className="size-3.5" />
                Display
            </button>

            {open && (
                <div className="absolute top-full right-0 z-50 mt-1 flex w-80 flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                            <ArrowUpNarrowWide className="size-3.5 text-slate-400" />
                            Ordering
                        </span>

                        <select
                            value={ordering}
                            onChange={(event) =>
                                onOrderingChange(event.target.value as TeamsOrdering)
                            }
                            className="h-8 w-32 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                        >
                            {ORDERINGS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                            Display properties
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                            {TEAM_DISPLAY_PROPERTIES.map((property) => {
                                const enabled = displayProperties[property.key];

                                return (
                                    <button
                                        key={property.key}
                                        type="button"
                                        onClick={() => onToggleProperty(property.key)}
                                        aria-pressed={enabled}
                                        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors ${enabled
                                            ? "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                            : "border-slate-200 text-slate-500 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                            }`}
                                    >
                                        {enabled && <Check className="size-3" />}
                                        {property.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
