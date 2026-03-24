import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, isThemePreference, shouldUseDarkTheme } from "@/lib/preferences";
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
  title: {
    template: "%s | Sage",
    default: "Sage",
  },
  description: "Your personal second brain — tasks, knowledge, and time, unified.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sage",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const themeBootstrapScript = `
(() => {
  try {
    const match = document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]+)/);
    const theme = match ? decodeURIComponent(match[1]) : "system";
    const shouldDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", shouldDark);
  } catch {}
})();
`

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies()
  const themeValue = cookieStore.get(THEME_COOKIE)?.value
  const theme = isThemePreference(themeValue) ? themeValue : "system"
  const initialDarkClass = shouldUseDarkTheme(theme, false) ? " dark" : ""

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full${initialDarkClass}`}
      suppressHydrationWarning
    >
      <body className="h-full bg-[--background] text-[--foreground]">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {children}
      </body>
    </html>
  );
}
