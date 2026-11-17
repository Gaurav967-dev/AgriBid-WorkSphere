"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, verifyToken, type AuthUser } from "@/features/auth/api/auth-api";

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isChecking, setIsChecking] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);

    useEffect(() => {
        let active = true;

        verifyToken()
            .then(({ user: verifiedUser }) => {
                if (!active) return;
                setUser(verifiedUser);
                setIsChecking(false);
            })
            .catch(() => {
                if (active) router.replace("/");
            });

        return () => {
            active = false;
        };
    }, [router]);

    async function handleSignOut() {
        setIsSigningOut(true);
        try {
            await signOut();
        } catch {
            // The API may already have expired the session; still return to sign-in.
        } finally {
            router.replace("/");
            router.refresh();
        }
    }

    if (isChecking || !user) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
                <p className="text-sm text-slate-600" role="status" aria-live="polite">
                    Verifying your session...
                </p>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
                    <div>
                        <p className="text-lg font-bold tracking-tight text-violet-800">AgriBid WorkSphere</p>
                        <p className="text-xs text-slate-500">Employee workspace</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                        {isSigningOut ? "Signing out..." : "Sign out"}
                    </button>
                </div>
            </header>

            <section className="mx-auto max-w-6xl px-6 py-10">
                <p className="text-sm font-medium text-violet-700">Workspace overview</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome to AgriBid WorkSphere</h1>
                <p className="mt-2 text-sm text-slate-600">
                    Your sign-in is verified. The dashboard modules will be added in the next implementation steps.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-500">Signed-in account</h2>
                        <p className="mt-2 break-all text-base font-semibold">{user.email ?? "Authenticated employee"}</p>
                    </article>
                    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-500">Assigned role</h2>
                        <p className="mt-2 text-base font-semibold">{user.role_name ?? user.role_code ?? "Not provided by API"}</p>
                    </article>
                </div>
            </section>
        </main>
    );
}
