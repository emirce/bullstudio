import type { Metadata } from "next";
//import "./globals.css";
import { DM_Sans } from "next/font/google";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import "@bullstudio/ui/styles/globals.css";
import { Toaster } from "@bullstudio/ui/components/sonner";
import { DialogProvider } from "@/components/dialog/DialogProvider";
import { Providers } from "@/components/providers/Providers";

export const metadata: Metadata = {
  icons: {
    icon: "/logo.svg",
  },
  title: "bullstudio",
  description: "Modern queue management for BullMq",
};

const font = DM_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${font.className} font-sans`}>
        <NextThemesProvider
          attribute="class"
          enableSystem
          defaultTheme="dark"
          disableTransitionOnChange
          enableColorScheme
        >
          <Providers>
            <DialogProvider />
            <main>{children}</main>
            <Toaster />
          </Providers>
        </NextThemesProvider>
      </body>
    </html>
  );
}
