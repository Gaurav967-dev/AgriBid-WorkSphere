import type { ReactNode } from "react";
import { WorkspaceSidebarStateProvider } from "@/components/workspace-sidebar-state";

export default function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <WorkspaceSidebarStateProvider>
            {children}
        </WorkspaceSidebarStateProvider>
    );
}