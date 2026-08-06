import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { RhythmProvider } from "@/components/rhythm-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rhythm — your calm personal OS",
    template: "%s · Rhythm",
  },
  description:
    "A calm, AI-guided personal operating system for tasks, time, and recurring responsibilities.",
  applicationName: "Rhythm",
  openGraph: {
    title: "Rhythm — your calm personal OS",
    description: "Know what deserves your attention right now.",
    type: "website",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "Rhythm calm personal task OS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rhythm — your calm personal OS",
    description: "Know what deserves your attention right now.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#eeefe9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <RhythmProvider>
          <AppShell>{children}</AppShell>
        </RhythmProvider>
      </body>
    </html>
  );
}
