"use client"
import { createContext, useContext, useState, useEffect } from "react"
import { type Locale, type T, getT } from "@/lib/i18n"
import {
  LOCALE_COOKIE,
  TIMEZONE_COOKIE,
  THEME_COOKIE,
  type ThemePreference,
  isLocale,
  isThemePreference,
  readDocumentCookie,
  writeDocumentCookie,
  applyThemePreference,
} from "@/lib/preferences"

interface LocaleContextValue {
  locale: Locale
  t: T
  timezone: string
  theme: ThemePreference
  setLocale: (l: Locale) => void
  setTimezone: (tz: string) => void
  setTheme: (theme: ThemePreference) => void
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh",
  t: getT("zh"),
  timezone: "UTC",
  theme: "system",
  setLocale: () => {},
  setTimezone: () => {},
  setTheme: () => {},
})

function getCookieLocale(initialLocale: Locale): Locale {
  const value = readDocumentCookie(LOCALE_COOKIE)
  return isLocale(value) ? value : initialLocale
}

function getCookieTheme(initialTheme: ThemePreference): ThemePreference {
  const value = readDocumentCookie(THEME_COOKIE)
  return isThemePreference(value) ? value : initialTheme
}

export function LocaleProvider({
  children,
  initialLocale,
  initialTimezone,
  initialTheme,
}: {
  children: React.ReactNode
  initialLocale: Locale
  initialTimezone: string
  initialTheme: ThemePreference
}) {
  // Use cookie directly on client to avoid zh→en flash during hydration
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof document !== "undefined" ? getCookieLocale(initialLocale) : initialLocale
  )
  const [timezone, setTimezone_] = useState<string>(initialTimezone)
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    typeof document !== "undefined" ? getCookieTheme(initialTheme) : initialTheme
  )

  // Auto-detect timezone only for first-time visitors without a saved cookie.
  useEffect(() => {
    const savedTz = readDocumentCookie(TIMEZONE_COOKIE)
    if (savedTz) return
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected && detected !== timezone) {
      writeDocumentCookie(TIMEZONE_COOKIE, detected)
      setTimezone_(detected)
    }
  }, [timezone])

  useEffect(() => {
    applyThemePreference(theme)
    if (theme !== "system") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => applyThemePreference("system")

    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [theme])

  const setLocale = (l: Locale) => {
    writeDocumentCookie(LOCALE_COOKIE, l)
    setLocaleState(l)
    window.location.reload()
  }

  const setTimezone = (tz: string) => {
    writeDocumentCookie(TIMEZONE_COOKIE, tz)
    setTimezone_(tz)
  }

  const setTheme = (nextTheme: ThemePreference) => {
    writeDocumentCookie(THEME_COOKIE, nextTheme)
    setThemeState(nextTheme)
    applyThemePreference(nextTheme)
  }

  return (
    <LocaleContext.Provider value={{ locale, t: getT(locale), timezone, theme, setLocale, setTimezone, setTheme }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useI18n() {
  return useContext(LocaleContext)
}

export function useT() {
  return useContext(LocaleContext).t
}

export function useLocale() {
  return useContext(LocaleContext).locale
}

export function useTimezone() {
  return useContext(LocaleContext).timezone
}
