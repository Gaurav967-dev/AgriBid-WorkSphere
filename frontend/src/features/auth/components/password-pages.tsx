"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    changePassword,
    forgotPassword,
    resetPassword,
    verifyToken,
} from "@/features/auth/api/auth-api";

const passwordPolicy = z
    .string()
    .min(8, "Password must contain at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.");

const forgotSchema = z.object({
    email: z.string().trim().email("Please enter a valid email address."),
});

const resetSchema = z
    .object({
        newPassword: passwordPolicy,
        confirmPassword: z.string().min(1, "Please confirm your new password."),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
        path: ["confirmPassword"],
        message: "Passwords do not match.",
    });

const changeSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required."),
        newPassword: passwordPolicy,
        confirmPassword: z.string().min(1, "Please confirm your new password."),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
        path: ["confirmPassword"],
        message: "Passwords do not match.",
    })
    .refine((values) => values.newPassword !== values.currentPassword, {
        path: ["newPassword"],
        message: "New password must be different from your current password.",
    });

type ForgotValues = z.infer<typeof forgotSchema>;
type ResetValues = z.infer<typeof resetSchema>;
type ChangeValues = z.infer<typeof changeSchema>;

type Feedback = {
    message: string;
    isError: boolean;
};

function PasswordPageShell({
    title,
    description,
    children,
    backHref = "/",
    backLabel = "Back to sign in",
}: {
    title: string;
    description: string;
    children: ReactNode;
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#EFEBFF] px-4 py-8">
            <div className="pointer-events-none absolute -right-12 -top-24 h-56 w-52 rotate-[25deg] rounded-[65px] bg-[#A68AFF]/60" />
            <div className="pointer-events-none absolute -bottom-28 -left-24 h-52 w-52 rounded-full bg-[#A58AFF]/65" />
            <div className="pointer-events-none absolute left-1/4 top-0 h-52 w-52 rounded-full bg-white/30 blur-3xl" />

            <section className="relative z-10 flex w-full max-w-[370px] flex-col rounded-[19px] border border-[#DCD5FF] bg-white px-7 py-7 shadow-[0_8px_30px_rgba(86,61,180,0.13)]">
                <div className="flex items-center justify-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6842E8] text-sm font-bold text-white">
                        A
                    </span>
                    <span className="text-[17px] font-bold tracking-tight text-[#19163B]">
                        AgriBid WorkSphere
                    </span>
                </div>

                <div className="mt-7 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                        <KeyRound className="h-5 w-5" />
                    </div>
                    <h1 className="mt-4 text-[21px] font-bold tracking-tight text-[#17152E]">
                        {title}
                    </h1>
                    <p className="mt-2 text-xs leading-5 text-[#55516F]">
                        {description}
                    </p>
                </div>

                <div className="mt-6">{children}</div>

                <div className="mt-6 border-t border-[#ECE9F5] pt-4 text-center">
                    <Link
                        href={backHref}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6031E6] hover:text-[#4120B8]"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        {backLabel}
                    </Link>
                </div>
            </section>
        </main>
    );
}

function FeedbackMessage({ feedback }: { feedback: Feedback | null }) {
    if (!feedback) return null;

    return (
        <p
            role={feedback.isError ? "alert" : "status"}
            aria-live="polite"
            className={`rounded-lg p-3 text-xs leading-5 ${
                feedback.isError
                    ? "bg-red-50 text-red-700"
                    : "bg-violet-50 text-violet-800"
            }`}
        >
            {feedback.message}
        </p>
    );
}

function PasswordField({
    id,
    label,
    placeholder,
    autoComplete,
    registration,
    error,
}: {
    id: string;
    label: string;
    placeholder: string;
    autoComplete: string;
    registration: object;
    error?: string;
}) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="text-xs font-semibold text-[#292640]"
            >
                {label}
            </label>
            <div className="relative">
                <Input
                    id={id}
                    {...registration}
                    type={showPassword ? "text" : "password"}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    aria-invalid={Boolean(error)}
                    className="h-10 rounded-[10px] border-[#DFDDED] bg-white px-3 pr-10 text-xs text-[#272342] placeholder:text-[#85819B] shadow-none focus-visible:border-[#7350E8] focus-visible:ring-2 focus-visible:ring-[#7350E8]/15"
                />

                <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77718F] transition-colors hover:text-[#6842E8]"
                >
                    {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                    ) : (
                        <Eye className="h-4 w-4" />
                    )}
                </button>
            </div>
            {error && (
                <p className="text-[11px] leading-4 text-red-600" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

export function ForgotPasswordForm() {
    const [feedback, setFeedback] = useState<Feedback | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotValues>({
        resolver: zodResolver(forgotSchema),
        defaultValues: { email: "" },
    });

    async function onSubmit(values: ForgotValues) {
        setFeedback(null);

        try {
            const message = await forgotPassword(values.email);
            setFeedback({ message, isError: false });
        } catch (error) {
            setFeedback({
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to process your request. Please try again.",
                isError: true,
            });
        }
    }

    return (
        <PasswordPageShell
            title="Forgot Password?"
            description="Enter your company email address to request a password-reset link."
        >
            <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="flex flex-col gap-4"
            >
                <div className="space-y-1.5">
                    <label
                        htmlFor="forgot-email"
                        className="text-xs font-semibold text-[#292640]"
                    >
                        Company email address
                    </label>
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77718F]" />
                        <Input
                            id="forgot-email"
                            {...register("email")}
                            type="email"
                            placeholder="name@agribid.ai"
                            autoComplete="email"
                            aria-invalid={Boolean(errors.email)}
                            className="h-10 rounded-[10px] border-[#DFDDED] bg-white pl-10 text-xs text-[#272342] placeholder:text-[#85819B] shadow-none focus-visible:border-[#7350E8] focus-visible:ring-2 focus-visible:ring-[#7350E8]/15"
                        />
                    </div>
                    {errors.email && (
                        <p className="text-[11px] text-red-600" role="alert">
                            {errors.email.message}
                        </p>
                    )}
                </div>

                <FeedbackMessage feedback={feedback} />

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 w-full rounded-[10px] bg-gradient-to-r from-[#5830D8] to-[#6030CE] text-xs font-semibold text-white hover:from-[#4925C5] hover:to-[#5125B9] disabled:opacity-60"
                >
                    {isSubmitting ? "Submitting..." : "Send reset instructions"}
                </Button>

                <p className="text-[10px] leading-4 text-[#77718F]">
                    Local development: the reset link is written to the backend
                    console. Actual email delivery still needs to be configured.
                </p>
            </form>
        </PasswordPageShell>
    );
}

export function ResetPasswordForm() {
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [completed, setCompleted] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ResetValues>({
        resolver: zodResolver(resetSchema),
        defaultValues: {
            newPassword: "",
            confirmPassword: "",
        },
    });

    async function onSubmit(values: ResetValues) {
        setFeedback(null);

        // The backend places the one-time token in the URL fragment.
        // Read it only when submitting; do not persist it in browser storage.
        const token =
            typeof window === "undefined"
                ? ""
                : new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";

        if (!token) {
            setFeedback({
                message: "This reset link is missing its token. Request a new link.",
                isError: true,
            });
            return;
        }

        try {
            const message = await resetPassword({
                token,
                new_password: values.newPassword,
            });
            setFeedback({ message, isError: false });
            setCompleted(true);
        } catch (error) {
            setFeedback({
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to reset your password. Request a new link.",
                isError: true,
            });
        }
    }

    return (
        <PasswordPageShell
            title={completed ? "Password Reset" : "Create New Password"}
            description={
                completed
                    ? "Your password has been updated."
                    : "Choose a new password for your AgriBid WorkSphere account."
            }
        >
            {completed ? (
                <div className="space-y-4">
                    <FeedbackMessage feedback={feedback} />
                    <Link
                        href="/"
                        className="flex h-10 w-full items-center justify-center rounded-[10px] bg-gradient-to-r from-[#5830D8] to-[#6030CE] text-xs font-semibold text-white hover:from-[#4925C5] hover:to-[#5125B9]"
                    >
                        Continue to sign in
                    </Link>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    className="flex flex-col gap-4"
                >
                    <PasswordField
                        id="reset-new-password"
                        label="New password"
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        registration={register("newPassword")}
                        error={errors.newPassword?.message}
                    />

                    <PasswordField
                        id="reset-confirm-password"
                        label="Confirm new password"
                        placeholder="Re-enter new password"
                        autoComplete="new-password"
                        registration={register("confirmPassword")}
                        error={errors.confirmPassword?.message}
                    />

                    <p className="text-[10px] leading-4 text-[#77718F]">
                        Minimum 8 characters, including at least one uppercase
                        letter and one number.
                    </p>

                    <FeedbackMessage feedback={feedback} />

                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-10 w-full rounded-[10px] bg-gradient-to-r from-[#5830D8] to-[#6030CE] text-xs font-semibold text-white hover:from-[#4925C5] hover:to-[#5125B9] disabled:opacity-60"
                    >
                        {isSubmitting ? "Updating password..." : "Reset password"}
                    </Button>
                </form>
            )}
        </PasswordPageShell>
    );
}

export function ChangePasswordForm() {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);
    const [completed, setCompleted] = useState(false);
    const [feedback, setFeedback] = useState<Feedback | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ChangeValues>({
        resolver: zodResolver(changeSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    useEffect(() => {
        let active = true;

        verifyToken()
            .then(() => {
                if (active) setIsChecking(false);
            })
            .catch(() => {
                if (active) router.replace("/");
            });

        return () => {
            active = false;
        };
    }, [router]);

    async function onSubmit(values: ChangeValues) {
        setFeedback(null);

        try {
            const message = await changePassword({
                current_password: values.currentPassword,
                new_password: values.newPassword,
            });
            setFeedback({ message, isError: false });
            setCompleted(true);
        } catch (error) {
            setFeedback({
                message:
                    error instanceof Error
                        ? error.message
                        : "Unable to change your password. Please try again.",
                isError: true,
            });
        }
    }

    if (isChecking) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#EFEBFF] px-6">
                <p className="text-sm text-[#55516F]" role="status">
                    Verifying your session...
                </p>
            </main>
        );
    }

    return (
        <PasswordPageShell
            title={completed ? "Password Changed" : "Change Password"}
            description={
                completed
                    ? "Your password has been updated successfully."
                    : "Verify your current password and choose a new one."
            }
            backHref="/dashboard"
            backLabel="Back to dashboard"
        >
            {completed ? (
                <div className="space-y-4">
                    <FeedbackMessage feedback={feedback} />
                    <p className="text-xs leading-5 text-[#55516F]">
                        All active sessions have been signed out. Sign in again
                        using your new password.
                    </p>
                    <Link
                        href="/"
                        className="flex h-10 w-full items-center justify-center rounded-[10px] bg-gradient-to-r from-[#5830D8] to-[#6030CE] text-xs font-semibold text-white hover:from-[#4925C5] hover:to-[#5125B9]"
                    >
                        Go to sign in
                    </Link>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    className="flex flex-col gap-4"
                >
                    <PasswordField
                        id="current-password"
                        label="Current password"
                        placeholder="Enter current password"
                        autoComplete="current-password"
                        registration={register("currentPassword")}
                        error={errors.currentPassword?.message}
                    />

                    <PasswordField
                        id="change-new-password"
                        label="New password"
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        registration={register("newPassword")}
                        error={errors.newPassword?.message}
                    />

                    <PasswordField
                        id="change-confirm-password"
                        label="Confirm new password"
                        placeholder="Re-enter new password"
                        autoComplete="new-password"
                        registration={register("confirmPassword")}
                        error={errors.confirmPassword?.message}
                    />

                    <p className="text-[10px] leading-4 text-[#77718F]">
                        Minimum 8 characters, including at least one uppercase
                        letter and one number.
                    </p>

                    <FeedbackMessage feedback={feedback} />

                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-10 w-full rounded-[10px] bg-gradient-to-r from-[#5830D8] to-[#6030CE] text-xs font-semibold text-white hover:from-[#4925C5] hover:to-[#5125B9] disabled:opacity-60"
                    >
                        {isSubmitting ? "Changing password..." : "Save new password"}
                    </Button>
                </form>
            )}
        </PasswordPageShell>
    );
}
