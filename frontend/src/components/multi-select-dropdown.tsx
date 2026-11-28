"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

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
    const [search, setSearch] = useState("");

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options;
        return options.filter((option) =>
            `${option.label} ${option.description ?? ""}`.toLowerCase().includes(query),
        );
    }, [options, search]);

    function toggleOption(value: string, checked: boolean) {
        onChange(
            checked
                ? selectedValues.includes(value)
                    ? selectedValues
                    : [...selectedValues, value]
                : selectedValues.filter((selected) => selected !== value),
        );
    }

    return (
        <section
            aria-label={label}
            className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950"
        >
            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                    id={`${id}-search`}
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    aria-label={`Search ${label.toLowerCase()}`}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-violet-950"
                />
            </div>

            <div
                role="group"
                aria-label={`${label} options`}
                className="mt-2 max-h-44 overflow-y-auto overscroll-contain rounded-md border border-slate-100 dark:border-slate-800"
            >
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
                                className={`flex cursor-pointer items-center gap-2.5 px-2.5 py-2 transition ${checked
                                    ? "bg-violet-50 dark:bg-violet-950/40"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
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
                                {checked && (
                                    <Check className="size-3.5 shrink-0 text-violet-700 dark:text-violet-300" />
                                )}
                            </label>
                        );
                    })
                )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="text-[10px] font-medium text-slate-500">
                        {selectedValues.length} selected
                    </span>
                    {selectedValues.length > 0 && (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange([])}
                            className="text-[10px] font-medium text-violet-700 hover:underline disabled:opacity-50 dark:text-violet-300"
                        >
                            Clear selection
                        </button>
                    )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                    <Check className="size-3" />
                    Select multiple
                </span>
            </div>
        </section>
    );
}
