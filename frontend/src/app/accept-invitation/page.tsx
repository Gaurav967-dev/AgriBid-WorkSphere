
"use client";

import { useEffect, useState, type FormEvent } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Eye,
    EyeOff,
    LockKeyhole,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    LoaderCircle,
} from "lucide-react";

import { acceptInvitation } from "@/features/users/api/users-api";

export default function AcceptInvitationPage() {
    const router = useRouter();

    const [token, setToken] = useState("");
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const fragment = window.location.hash.startsWith("#")
                ? window.location.hash.slice(1)
                : window.location.hash;

            const invitationToken =
                new URLSearchParams(fragment).get("token") ?? "";

            // Remove the one-time token from the visible browser URL.
            window.history.replaceState(
                window.history.state,
                document.title,
                `${window.location.pathname}${window.location.search}`,
            );

            setToken(
                invitationToken.length >= 32 &&
                invitationToken.length <= 512
                    ? invitationToken
                    : "",
            );
            setIsHydrated(true);
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [isAccepted, setIsAccepted] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");

        if (!token) {
            setError("The invitation link is invalid or missing its token.");
            return;
        }

        if (!password.trim()) {
            setError("Please enter a password.");
            return;
        }

        if (
            password.length < 8 ||
            !/[A-Z]/.test(password) ||
            !/[0-9]/.test(password)
        ) {
            setError(
                "Use at least 8 characters, one uppercase letter, and one number.",
            );
            return;
        }

        if (password !== confirmPassword) {
            setError("The passwords do not match.");
            return;
        }

        setIsSubmitting(true);

        try {
            await acceptInvitation({
                token,
                password,
            });

            setIsAccepted(true);

            window.setTimeout(() => {
                router.replace("/");
                router.refresh();
            }, 1800);
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "Unable to accept the invitation. Please try again.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-4 py-6 dark:bg-slate-950">
            <div className="w-full max-w-md">
                <div className="mb-7 flex items-center justify-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-violet-700 text-white shadow-sm">
                        <ShieldCheck className="size-5" />
                    </div>

                    <div>
                        <p className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                            AgriBid WorkSphere
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Company workspace
                        </p>
                    </div>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                    {isAccepted ? (
                        <div className="py-6 text-center">
                            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                                <CheckCircle2 className="size-7" />
                            </div>

                            <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">
                                Invitation accepted!
                            </h1>

                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                Your account has been created successfully.
                                You can now sign in to AgriBid WorkSphere.
                            </p>

                            <Link
                                href="/"
                                className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-violet-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-800"
                            >
                                Go to sign in
                            </Link>

                            <p className="mt-3 text-xs text-slate-400">
                                Redirecting to sign in...
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-7">
                                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-700 dark:text-violet-300">
                                    Employee onboarding
                                </p>

                                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    Accept your invitation
                                </h1>

                                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    Create your password to activate your
                                    AgriBid WorkSphere account.
                                </p>
                            </div>

                            {!isHydrated ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Preparing your invitation...
                                </div>
                            ) : !token ? (
                                <div
                                    role="alert"
                                    className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30"
                                >
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                                        <div>
                                            <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                                                Invalid invitation link
                                            </p>
                                            <p className="mt-1 text-xs leading-5 text-rose-700 dark:text-rose-300">
                                                The invitation token is missing.
                                                Please use the complete invitation
                                                link provided by your administrator.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form
                                    onSubmit={handleSubmit}
                                    className="space-y-5"
                                >
                                    <div>
                                        <label
                                            htmlFor="password"
                                            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                                        >
                                            Create password
                                        </label>

                                        <div className="relative">
                                            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

                                            <input
                                                id="password"
                                                type={
                                                    showPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={password}
                                                onChange={(event) =>
                                                    setPassword(event.target.value)
                                                }
                                                required
                                                autoComplete="new-password"
                                                placeholder="Enter your password"
                                                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-violet-950"
                                            />

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowPassword((current) => !current)
                                                }
                                                aria-label={
                                                    showPassword
                                                        ? "Hide password"
                                                        : "Show password"
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                            >
                                                {showPassword ? (
                                                    <EyeOff className="size-4" />
                                                ) : (
                                                    <Eye className="size-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="confirm-password"
                                            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
                                        >
                                            Confirm password
                                        </label>

                                        <div className="relative">
                                            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />

                                            <input
                                                id="confirm-password"
                                                type={
                                                    showConfirmPassword
                                                        ? "text"
                                                        : "password"
                                                }
                                                value={confirmPassword}
                                                onChange={(event) =>
                                                    setConfirmPassword(
                                                        event.target.value,
                                                    )
                                                }
                                                required
                                                autoComplete="new-password"
                                                placeholder="Re-enter your password"
                                                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-violet-950"
                                            />

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setShowConfirmPassword(
                                                        (current) => !current,
                                                    )
                                                }
                                                aria-label={
                                                    showConfirmPassword
                                                        ? "Hide confirmation password"
                                                        : "Show confirmation password"
                                                }
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="size-4" />
                                                ) : (
                                                    <Eye className="size-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {error && (
                                        <div
                                            role="alert"
                                            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                                        >
                                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                            <p>{error}</p>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <LoaderCircle className="size-4 animate-spin" />
                                                Creating account...
                                            </>
                                        ) : (
                                            "Accept invitation"
                                        )}
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </section>

                {!isAccepted && (
                    <div className="mt-5 text-center">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300"
                        >
                            <ArrowLeft className="size-3.5" />
                            Back to sign in
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
