import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "AgriBid WorkSphere | Project Management",
    description:
        "AgriBid WorkSphere - Internal project management and team collaboration platform.",
};

export default function RootLayout({
    children,
}: Readonly<LayoutProps<"/">>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}