"use client";

import {
    createContext,
    useCallback,
    useContext,
    useSyncExternalStore,
    type ReactNode,
} from "react";

const STORAGE_KEY = "agribid-workspace-sidebar-collapsed";

type WorkspaceSidebarContextValue = {
    collapsed: boolean;
    toggleCollapsed: () => void;
};

const WorkspaceSidebarContext =
    createContext<WorkspaceSidebarContextValue | null>(null);

let fallbackCollapsed = false;

const subscribers = new Set<() => void>();

function getCollapsedSnapshot(): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    try {
        const savedPreference = window.localStorage.getItem(STORAGE_KEY);

        return savedPreference === null
            ? fallbackCollapsed
            : savedPreference === "true";
    } catch {
        return fallbackCollapsed;
    }
}

function getServerSnapshot(): boolean {
    return false;
}

function subscribe(listener: () => void) {
    subscribers.add(listener);

    function handleStorage(event: StorageEvent) {
        if (event.key === STORAGE_KEY || event.key === null) {
            listener();
        }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
        subscribers.delete(listener);
        window.removeEventListener("storage", handleStorage);
    };
}

function updateCollapsedPreference(value: boolean) {
    fallbackCollapsed = value;

    try {
        window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
        // In-memory preference remains available if storage is unavailable.
    }

    subscribers.forEach((listener) => listener());
}

export function WorkspaceSidebarStateProvider({
    children,
}: {
    children: ReactNode;
}) {
    const collapsed = useSyncExternalStore(
        subscribe,
        getCollapsedSnapshot,
        getServerSnapshot,
    );

    const toggleCollapsed = useCallback(() => {
        updateCollapsedPreference(!getCollapsedSnapshot());
    }, []);

    return (
        <WorkspaceSidebarContext.Provider
            value={{ collapsed, toggleCollapsed }}
        >
            {children}
        </WorkspaceSidebarContext.Provider>
    );
}

export function useWorkspaceSidebarState() {
    const context = useContext(WorkspaceSidebarContext);

    if (!context) {
        throw new Error(
            "useWorkspaceSidebarState must be used inside WorkspaceSidebarStateProvider.",
        );
    }

    return context;
}