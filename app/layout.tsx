/**
 * Quiet Command Center design system: a Next.js root layout for a white operational
 * workspace with ink-navy hierarchy and restrained Signal Teal activity cues.
 */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevSync v2 — Daily Work Update Portal",
  description: "Secure daily operations for software teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
