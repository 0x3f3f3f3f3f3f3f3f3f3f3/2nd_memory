"use client"
import { createContext, useContext, useState, useEffect } from "react"
import { type Locale, type T, getT } from "@/lib/i18n"

interface LocaleContextValue {
  locale: Locale
  t: T
  timezone: string
  setLocale: (l: Locale) => void
  setTimezone: (tz: string) => void
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh",
  t: getT("zh"),
  timezone: "Asia/Shanghai",
  setLocale: () => {},
  setTimezone: () => {},
})

function getCookieLocale(): Locale {
  if (typeof document === "undefined") return "zh"
  const m = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/)
  return (m?.[1] === "en" ? "en" : "zh") as Locale
}

export function LocaleProvider({
  children,
  initialLocale,
  initialTimezone,
}: {
  children: React.ReactNode
  initialLocale: Locale
  initialTimezone: string
}) {
  // Use cookie directly on client to avoid zh→en flash during hydration
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof document !== "undefined" ? getCookieLocale() : initialLocale
  )
  const [timezone, setTimezone_] = useState<string>(initialTimezone)

  // On mount: detect actual device timezone, sync to cookie if different
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected && detected !== timezone) {
      document.cookie = `tz=${detected}; path=/; max-age=31536000; SameSite=Lax`
      setTimezone_(detected)
    }
  }, [])

  const setLocale = (l: Locale) => {
    document.cookie = `locale=${l}; path=/; max-age=31536000; SameSite=Lax`
    setLocaleState(l)
    window.location.reload()
  }

  const setTimezone = (tz: string) => {
    document.cookie = `tz=${tz}; path=/; max-age=31536000; SameSite=Lax`
    setTimezone_(tz)
  }

  return (
    <LocaleContext.Provider value={{ locale, t: getT(locale), timezone, setLocale, setTimezone }}>
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
