import { cookies } from "next/headers"
import { LocaleProvider } from "@/contexts/locale-context"
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt"
import { LOCALE_COOKIE, THEME_COOKIE, TIMEZONE_COOKIE, isLocale, isThemePreference } from "@/lib/preferences"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const localeValue = cookieStore.get(LOCALE_COOKIE)?.value
  const themeValue = cookieStore.get(THEME_COOKIE)?.value
  const locale = isLocale(localeValue) ? localeValue : "zh"
  const timezone = cookieStore.get(TIMEZONE_COOKIE)?.value ?? "UTC"
  const theme = isThemePreference(themeValue) ? themeValue : "system"

  return (
    <LocaleProvider initialLocale={locale} initialTimezone={timezone} initialTheme={theme}>
      {children}
      <PwaInstallPrompt />
    </LocaleProvider>
  )
}
