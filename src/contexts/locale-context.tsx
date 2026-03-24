"use client"
import { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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

export function LocaleProvider({
  children,
  initialLocale,
  initialTimezone,
}: {
  children: React.ReactNode
  initialLocale: Locale
  initialTimezone: string
}) {
  const router = useRouter()
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
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
    router.refresh()
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
