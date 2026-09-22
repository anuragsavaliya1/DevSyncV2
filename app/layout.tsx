/**
 * Quiet Command Center design system: a Next.js root layout for a white operational
 * workspace with ink-navy hierarchy and restrained Signal Teal activity cues.
 */
import type { Metadata } from "next";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import { AppProviders } from "@/app/providers";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-devsync-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-devsync-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "DevSync v2 — Daily Work Update Portal",
  description: "Secure daily operations for software teams.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className={`${bodyFont.className} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
