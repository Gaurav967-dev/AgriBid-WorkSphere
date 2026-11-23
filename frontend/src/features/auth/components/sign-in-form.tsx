
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut, verifyIdToken } from "@/features/auth/api/auth-api";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Mail,
    LockKeyhole,
    Eye,
    EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const signInSchema = z.object({
    email: z.string().trim().email("Please enter a valid email address."),
    password: z.string().min(1, "Password is required."),
    rememberMe: z.boolean(),
});

type SignInValues = z.infer<typeof signInSchema>;

function AuthIllustration() {
    return (
        <svg
            viewBox="0 0 260 125"
            className="h-[125px] w-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Laptop displaying a checklist beside a small plant"
        >
            <defs>
                <linearGradient id="screen" x1="70" y1="5" x2="150" y2="100">
                    <stop stopColor="#9B83FF" />
                    <stop offset="1" stopColor="#4F3CB5" />
                </linearGradient>
                <linearGradient id="laptop" x1="75" y1="90" x2="205" y2="115">
                    <stop stopColor="#A999F1" />
                    <stop offset="1" stopColor="#6655BD" />
                </linearGradient>
                <linearGradient id="pot" x1="207" y1="85" x2="235" y2="120">
                    <stop stopColor="#D0B6FF" />
                    <stop offset="1" stopColor="#9875E7" />
                </linearGradient>
            </defs>

            {/* Soft ground shadow */}
            <ellipse cx="131" cy="113" rx="113" ry="7" fill="#DED8FC" opacity=".55" />

            {/* Laptop base */}
            <path
                d="M75 91L178 79L225 101L119 116L75 104V91Z"
                fill="url(#laptop)"
            />
            <path
                d="M119 116L225 101L216 107L118 121L75 107L75 104L119 116Z"
                fill="#51439C"
            />
            <path
                d="M105 105L177 95L195 103L124 113L105 105Z"
                fill="#AFA2EF"
            />

            {/* Laptop screen frame */}
            <path
                d="M61 16L154 8Q160 8 161 14L172 85L72 97L57 24Q56 18 61 16Z"
                fill="#5747B8"
            />
            <path
                d="M66 21L152 14L163 80L75 90L66 21Z"
                fill="url(#screen)"
            />
            <path
                d="M72 25L148 19L158 76L79 84L72 25Z"
                fill="white"
            />

            {/* Checklist content */}
            <g stroke="#725FE2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M83 39L87 43L95 34" />
                <path d="M83 53L87 57L95 48" />
                <path d="M85 68L89 72L97 63" />
            </g>

            <g stroke="#D7D1F9" strokeWidth="4" strokeLinecap="round">
                <path d="M103 38L132 35" />
                <path d="M104 44L145 40" />
                <path d="M105 53L136 50" />
                <path d="M106 59L147 55" />
            </g>

            <g stroke="#846DF0" strokeWidth="3" strokeLinecap="round">
                <path d="M106 69L142 65" />
                <path d="M107 75L148 71" />
            </g>

            {/* Plant leaves */}
            <path d="M221 82C203 62 201 48 205 39C219 48 227 63 221 82Z" fill="#7FD6B7" />
            <path d="M222 83C226 58 237 49 245 48C245 64 235 78 222 83Z" fill="#45B992" />
            <path d="M221 82C210 66 193 65 190 70C197 84 210 87 221 82Z" fill="#A0E6CF" />
            <path d="M220 80L218 39" stroke="#43AA89" strokeWidth="2" strokeLinecap="round" />

            {/* Plant pot */}
            <path d="M207 85H237L232 113Q231 116 227 116H215Q212 116 211 112L207 85Z" fill="url(#pot)" />
            <ellipse cx="222" cy="85" rx="15" ry="4" fill="#BBA2F4" />
            <ellipse cx="222" cy="85" rx="11" ry="2" fill="#7B5DCA" opacity=".5" />
        </svg>
    );
}

function BrandLogo() {
    return (
        <div className="flex items-center justify-center gap-2">
            <svg
                viewBox="0 0 36 28"
                className="h-7 w-9"
                fill="none"
                aria-hidden="true"
            >
                <path
                    d="M3 12.5L9 7L19 16L29 2.5C32 0 37 4 34 8L21 25C19 28 15 28 12 25L3 17C1 16 1 14 3 12.5Z"
                    fill="#6842E8"
                />
                <path
                    d="M3 12.5L9 7L19 16L24 10L17 20L12 19L3 12.5Z"
                    fill="#8C74F8"
                />
            </svg>

            <span className="whitespace-nowrap text-[17px] font-bold tracking-tight text-[#19163B]">
                AgriBid WorkSphere
            </span>
        </div>
    );
}

export function SignInForm() {
    const [showPassword, setShowPassword] = useState(false);
    const [notice, setNotice] = useState("");
    const [noticeIsError, setNoticeIsError] = useState(false);
    const router = useRouter();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignInValues>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: "",
            password: "",
            rememberMe: false,
        },
    });

    async function onSubmit(values: SignInValues) {
        setNotice("");
        setNoticeIsError(false);

        try {
            await signIn({
                email: values.email,
                password: values.password,
            });
            try {
                await verifyIdToken();
            } catch (verificationError) {
                await signOut();
                throw verificationError;
            }
            router.replace("/dashboard");
            router.refresh();
        } catch (error) {
            setNoticeIsError(true);
            setNotice(
                error instanceof Error
                    ? error.message
                    : "Unable to sign in. Please try again."
            );
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#EFEBFF] px-4 py-8">

            {/* Background decorations */}
            <div className="pointer-events-none absolute -right-12 -top-24 h-56 w-52 rotate-[25deg] rounded-[65px] bg-[#A68AFF]/60" />

            <div className="pointer-events-none absolute -bottom-28 -left-24 h-52 w-52 rounded-full bg-[#A58AFF]/65" />

            <div className="pointer-events-none absolute left-1/4 top-0 h-52 w-52 rounded-full bg-white/30 blur-3xl" />

            {/* Authentication card */}
            <section className="relative z-10 flex min-h-[560px] w-full max-w-[316px] flex-col rounded-[19px] border border-[#DCD5FF] bg-white px-[25px] pb-5 pt-[25px] shadow-[0_8px_30px_rgba(86,61,180,0.13)]">

                {/* Branding */}
                <BrandLogo />

                {/* Illustration */}
                <div className="mt-[20px]">
                    <AuthIllustration />
                </div>

                {/* Heading */}
                <div className="mt-[7px] text-center">
                    <h1 className="text-[21px] font-bold leading-tight tracking-[-0.5px] text-[#17152E]">
                        Welcome Back!
                    </h1>

                    <p className="mt-[7px] whitespace-nowrap text-[11px] text-[#55516F]">
                        Sign in to continue to your account
                    </p>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                    className="mt-[21px] flex flex-col gap-[10px]"
                >

                    {/* Email */}
                    <div className="space-y-1">
                        <div className="relative">
                            <Mail className="pointer-events-none absolute left-[12px] top-1/2 z-10 h-[15px] w-[15px] -translate-y-1/2 text-[#29264E]" />
                            <Input
                                {...register("email")}
                                type="email"
                                placeholder="Email Address"
                                autoComplete="email"
                                aria-label="Email Address"
                                aria-invalid={Boolean(errors.email)}
                                className="h-[36px] rounded-[10px] border-[#DFDDED] bg-white pl-[40px] pr-3 text-[11px] text-[#272342] placeholder:text-[#85819B] shadow-none focus-visible:border-[#7350E8] focus-visible:ring-2 focus-visible:ring-[#7350E8]/15"
                            />
                        </div>

                        {errors.email && (
                            <p className="text-[10px] leading-4 text-red-600" role="alert">
                                {errors.email.message}
                            </p>
                        )}
                    </div>


                    {/* Password */}
                    <div className="space-y-1">
                        <div className="relative">
                            <LockKeyhole className="pointer-events-none absolute left-[12px] top-1/2 z-10 h-[15px] w-[15px] -translate-y-1/2 text-[#29264E]" />

                            <Input
                                {...register("password")}
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                autoComplete="current-password"
                                aria-label="Password"
                                aria-invalid={Boolean(errors.password)}
                                className="h-[36px] rounded-[10px] border-[#DFDDED] bg-white pl-[40px] pr-[40px] text-[11px] text-[#272342] placeholder:text-[#85819B] shadow-none focus-visible:border-[#7350E8] focus-visible:ring-2 focus-visible:ring-[#7350E8]/15"
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword((value) => !value)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute right-[11px] top-1/2 -translate-y-1/2 text-[#29264E] transition-colors hover:text-[#6842E8]"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-[15px] w-[15px]" />
                                ) : (
                                    <Eye className="h-[15px] w-[15px]" />
                                )}
                            </button>
                        </div>

                        {errors.password && (
                            <p className="text-[10px] leading-4 text-red-600" role="alert">
                                {errors.password.message}
                            </p>
                        )}
                    </div>

                    {/* Remember me and Forgot Password */}
                    <div className="flex items-center justify-between gap-2 pt-[1px]">

                        <label className="flex cursor-pointer items-center gap-[8px] text-[10px] font-medium text-[#292640]">
                            <input
                                {...register("rememberMe")}
                                type="checkbox"
                                className="h-[15px] w-[15px] cursor-pointer rounded-[4px] border border-[#C9C3DD] accent-[#653AE0]"
                            />
                            Remember me
                        </label>

                        <button
                            type="button"
                            onClick={() =>
                                setNotice("The forgot password screen will be available next.")
                            }
                            className="whitespace-nowrap text-[10px] font-semibold text-[#6031E6] hover:text-[#4120B8]"
                        >
                            Forgot Password?
                        </button>
                    </div>

                    {/* Sign in button */}
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-[5px] h-[37px] w-full rounded-[10px] bg-gradient-to-r from-[#5830D8] to-[#6030CE] text-[12px] font-semibold text-white shadow-none transition hover:from-[#4925C5] hover:to-[#5125B9] disabled:opacity-60"
                    >
                        {isSubmitting ? "Signing in..." : "Sign In"}
                    </Button>

                    {notice && (
                        <p
                            role="status"
                            aria-live="polite"
                            className={`rounded-md p-2 text-center text-[10px] leading-4 ${noticeIsError ? "bg-red-50 text-red-700" : "bg-violet-50 text-violet-800"}`}
                        >
                            {notice}
                        </p>
                    )}
                </form>

                {/* Invitation-only footer */}
                <div className="mt-auto border-t border-[#ECE9F5] pt-4 text-center">
                    <p className="text-[10px] leading-4 text-[#37334D]">
                        Don&apos;t have access?
                        <span className="ml-1 font-semibold text-[#6031E6]">
                            Contact your Admin
                        </span>
                    </p>
                </div>
            </section>
        </main>
    );
}