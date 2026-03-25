import type { Locale } from "@/lib/i18n"

export type ThemePreference = "light" | "dark" | "system"

export const LOCALE_COOKIE = "locale"
export const TIMEZONE_COOKIE = "tz"
export const THEME_COOKIE = "theme"
export const PWA_INSTALL_HINT_COOKIE = "pwa_install_hint_dismissed"
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function escapeCookieName(name: string) {
  return name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "zh" || value === "en"
}

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system"
}

export function readDocumentCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const pattern = new RegExp(`(?:^|;\\s*)${escapeCookieName(name)}=([^;]+)`)
  const match = document.cookie.match(pattern)
  return match ? decodeURIComponent(match[1]) : null
}

export function writeDocumentCookie(name: string, value: string, maxAge = PREFERENCE_COOKIE_MAX_AGE) {
  if (typeof document === "undefined") return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

export function shouldUseDarkTheme(theme: ThemePreference, prefersDark: boolean) {
  return theme === "dark" || (theme === "system" && prefersDark)
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof document === "undefined") return
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  document.documentElement.classList.toggle("dark", shouldUseDarkTheme(theme, prefersDark))
}
