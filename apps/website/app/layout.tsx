import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "bullstudio - Modern Queue Management for BullMQ",
  description:
    "The modern, cloud-hosted observability and management dashboard for Bull and BullMQ queues. Real-time insights, job management, alerts, and metrics for Node.js developers.",
  keywords: [
    "BullMQ",
    "Bull",
    "queue management",
    "Redis",
    "Node.js",
    "job queue",
    "background jobs",
    "queue monitoring",
    "observability",
  ],
  authors: [{ name: "bullstudio" }],
  openGraph: {
    title: "bullstudio - Modern Queue Management for BullMQ",
    description:
      "Real-time queue monitoring, job management, and observability for BullMQ. Built for developers.",
    type: "website",
    siteName: "bullstudio",
  },
  twitter: {
    card: "summary_large_image",
    title: "bullstudio - Modern Queue Management for BullMQ",
    description:
      "Real-time queue monitoring, job management, and observability for BullMQ. Built for developers.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
