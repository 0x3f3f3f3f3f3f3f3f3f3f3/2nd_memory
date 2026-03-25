import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt"
import { PageTransition } from "@/components/shared/page-transition"
import { getCurrentUser } from "@/lib/auth"
import { LocaleProvider } from "@/contexts/locale-context"
import { cookies } from "next/headers"
import { LOCALE_COOKIE, THEME_COOKIE, TIMEZONE_COOKIE, isLocale, isThemePreference } from "@/lib/preferences"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { username } = await getCurrentUser()
  const cookieStore = await cookies()
  const localeValue = cookieStore.get(LOCALE_COOKIE)?.value
  const themeValue = cookieStore.get(THEME_COOKIE)?.value
  const locale = isLocale(localeValue) ? localeValue : "zh"
  const timezone = cookieStore.get(TIMEZONE_COOKIE)?.value ?? "UTC"
  const theme = isThemePreference(themeValue) ? themeValue : "system"

  return (
    <LocaleProvider initialLocale={locale} initialTimezone={timezone} initialTheme={theme}>
      <div className="min-h-screen min-h-[100dvh] flex flex-col md:flex-row">
        <Sidebar username={username} />
        <main
          data-dashboard-main="true"
          className="flex-1 md:ml-[var(--sidebar-width)] flex flex-col min-h-screen min-h-[100dvh] overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          <PageTransition>{children}</PageTransition>
        </main>
        <MobileNav />
        <PwaInstallPrompt />
      </div>
    </LocaleProvider>
  )
}
