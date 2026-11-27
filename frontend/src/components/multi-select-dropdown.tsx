"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type MultiSelectOption = {
    value: string;
    label: string;
    description?: string;
};

type MultiSelectDropdownProps = {
    id: string;
    label: string;
    options: MultiSelectOption[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
    emptyMessage?: string;
};

export function MultiSelectDropdown({
    id,
    label,
    options,
    selectedValues,
    onChange,
    placeholder = "Select one or more",
    disabled = false,
    emptyMessage = "No options available.",
}: MultiSelectDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);

    const selectedOptions = useMemo(
        () => options.filter((option) => selectedValues.includes(option.value)),
        [options, selectedValues],
    );

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options;
        return options.filter((option) =>
            `${option.label} ${option.description ?? ""}`.toLowerCase().includes(query),
        );
    }, [options, search]);

    useEffect(() => {
        if (!open) return;

        function handleOutsidePointerDown(event: PointerEvent) {
            if (
                event.target instanceof Node &&
                !rootRef.current?.contains(event.target)
            ) {
                setOpen(false);
                setSearch("");
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpen(false);
                setSearch("");
            }
        }

        document.addEventListener("pointerdown", handleOutsidePointerDown);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    function toggleOption(value: string, checked: boolean) {
        onChange(
            checked
                ? [...selectedValues, value]
                : selectedValues.filter((selected) => selected !== value),
        );
    }

    return (
        <div ref={rootRef} className="relative min-w-0">
            <button
                id={id}
                type="button"
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={label}
                onClick={() => setOpen((current) => !current)}
                className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 outline-none transition hover:border-violet-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-950"
            >
                <span className="min-w-0 truncate">
                    {selectedOptions.length === 0
                        ? <span className="text-slate-400">{placeholder}</span>
                        : selectedOptions.length === 1
                            ? selectedOptions[0].label
                            : `${selectedOptions.length} members selected`}
                </span>
                <ChevronDown className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label={`Select ${label.toLowerCase()}`}
                    className="absolute left-0 top-full z-50 mt-1 w-full min-w-[min(100%,20rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                >
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={`Search ${label.toLowerCase()}...`}
                            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-8 text-xs outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                aria-label="Clear search"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                            >
                                <X className="size-3" />
                            </button>
                        )}
                    </div>

                    <div className="mt-2 max-h-56 overflow-y-auto overscroll-contain">
                        {filteredOptions.length === 0 ? (
                            <p className="px-2 py-5 text-center text-xs text-slate-400">
                                {options.length === 0 ? emptyMessage : "No matching members."}
                            </p>
                        ) : (
                            filteredOptions.map((option) => {
                                const checked = selectedValues.includes(option.value);
                                return (
                                    <label
                                        key={option.value}
                                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition ${checked ? "bg-violet-50 dark:bg-violet-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(event) => toggleOption(option.value, event.target.checked)}
                                            className="size-4 shrink-0 accent-violet-700"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                                                {option.label}
                                            </span>
                                            {option.description && (
                                                <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                                                    {option.description}
                                                </span>
                                            )}
                                        </span>
                                        {checked && <Check className="size-3.5 shrink-0 text-violet-700 dark:text-violet-300" />}
                                    </label>
                                );
                            })
                        )}
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">
                                {selectedValues.length} selected
                            </span>
                            {selectedValues.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onChange([])}
                                    className="text-[10px] font-medium text-violet-700 hover:underline dark:text-violet-300"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setSearch("");
                            }}
                            className="rounded-md bg-violet-700 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-violet-800"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
