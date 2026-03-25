import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { THEME_COOKIE, isThemePreference, shouldUseDarkTheme } from "@/lib/preferences";
import { ResponsiveProvider } from "@/hooks/use-is-mobile";
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
  applicationName: "Sage",
  description: "Your personal second brain — tasks, knowledge, and time, unified.",
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sage",
  },
};

export const viewport: Viewport = {
  themeColor: "#C96444",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
  const headerStore = await headers()
  const themeValue = cookieStore.get(THEME_COOKIE)?.value
  const theme = isThemePreference(themeValue) ? themeValue : "system"
  const initialDarkClass = shouldUseDarkTheme(theme, false) ? " dark" : ""
  const userAgent = headerStore.get("user-agent")?.toLowerCase() ?? ""
  const initialIsMobileHint = /iphone|ipod|android.+mobile|windows phone|blackberry/.test(userAgent)

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full${initialDarkClass}`}
      suppressHydrationWarning
    >
      <body className="h-full min-h-screen bg-[--background] text-[--foreground] overflow-x-hidden">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <ResponsiveProvider initialIsMobileHint={initialIsMobileHint}>
          {children}
        </ResponsiveProvider>
      </body>
    </html>
  );
}
