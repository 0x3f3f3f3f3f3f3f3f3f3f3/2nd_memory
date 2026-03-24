"use client"
import { useState, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Monitor, Shield, Download, Globe, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/contexts/locale-context"

/* ── Curated timezone list ── */
const TIMEZONES = [
  { tz: "Pacific/Honolulu",       label: "Honolulu (Hawaii)" },
  { tz: "America/Anchorage",      label: "Anchorage (Alaska)" },
  { tz: "America/Los_Angeles",    label: "Los Angeles / Seattle (PT)" },
  { tz: "America/Denver",         label: "Denver / Phoenix (MT)" },
  { tz: "America/Chicago",        label: "Chicago / Dallas (CT)" },
  { tz: "America/New_York",       label: "New York / Miami (ET)" },
  { tz: "America/Toronto",        label: "Toronto (ET)" },
  { tz: "America/Halifax",        label: "Halifax (AT)" },
  { tz: "America/Sao_Paulo",      label: "São Paulo (BRT)" },
  { tz: "America/Argentina/Buenos_Aires", label: "Buenos Aires (ART)" },
  { tz: "Atlantic/Azores",        label: "Azores (AZOT)" },
  { tz: "Europe/London",          label: "London (GMT/BST)" },
  { tz: "Europe/Lisbon",          label: "Lisbon (WET/WEST)" },
  { tz: "Europe/Paris",           label: "Paris / Berlin / Rome (CET)" },
  { tz: "Europe/Helsinki",        label: "Helsinki / Kyiv (EET)" },
  { tz: "Europe/Istanbul",        label: "Istanbul (TRT)" },
  { tz: "Europe/Moscow",          label: "Moscow (MSK)" },
  { tz: "Asia/Dubai",             label: "Dubai (GST)" },
  { tz: "Asia/Karachi",           label: "Karachi (PKT)" },
  { tz: "Asia/Kolkata",           label: "India (IST, UTC+5:30)" },
  { tz: "Asia/Dhaka",             label: "Dhaka (BST)" },
  { tz: "Asia/Yangon",            label: "Yangon (MMT, UTC+6:30)" },
  { tz: "Asia/Bangkok",           label: "Bangkok / Jakarta (ICT)" },
  { tz: "Asia/Shanghai",          label: "Shanghai / Beijing (CST)" },
  { tz: "Asia/Hong_Kong",         label: "Hong Kong (HKT)" },
  { tz: "Asia/Taipei",            label: "Taipei (CST)" },
  { tz: "Asia/Singapore",         label: "Singapore (SGT)" },
  { tz: "Asia/Seoul",             label: "Seoul (KST)" },
  { tz: "Asia/Tokyo",             label: "Tokyo (JST)" },
  { tz: "Australia/Perth",        label: "Perth (AWST)" },
  { tz: "Australia/Darwin",       label: "Darwin (ACST)" },
  { tz: "Australia/Adelaide",     label: "Adelaide (ACST/ACDT)" },
  { tz: "Australia/Sydney",       label: "Sydney / Melbourne (AEST)" },
  { tz: "Pacific/Auckland",       label: "Auckland (NZST)" },
  { tz: "UTC",                    label: "UTC (Coordinated Universal Time)" },
]

function tzOffsetLabel(tz: string): string {
  try {
    const now = new Date()
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz, timeZoneName: "shortOffset",
    }).formatToParts(now)
    return parts.find(p => p.type === "timeZoneName")?.value ?? ""
  } catch {
    return ""
  }
}

export function SettingsPanel() {
  const { t, timezone, setTimezone } = useI18n()
  const [theme, setTheme] = useState("system")
  const [tzSearch, setTzSearch] = useState("")
  const detectedTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  const applyTheme = (th: string) => {
    setTheme(th)
    if (th === "dark") document.documentElement.classList.add("dark")
    else if (th === "light") document.documentElement.classList.remove("dark")
    else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }

  const themeOptions = [
    { value: "light", label: t.settings.themeLight, icon: Sun },
    { value: "dark", label: t.settings.themeDark, icon: Moon },
    { value: "system", label: t.settings.themeSystem, icon: Monitor },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">{t.settings.appearance}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{t.settings.theme}</Label>
            <div className="flex gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => applyTheme(value)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors",
                    theme === value ? "border-[--primary] bg-[--primary]/10 text-[--primary]" : "border-white/50 dark:border-white/[0.12] bg-white/30 dark:bg-white/[0.04] hover:bg-white/50 dark:hover:bg-white/[0.08]"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                {t.settings.timezone}
              </Label>
              {timezone !== detectedTz && (
                <button
                  onClick={() => setTimezone(detectedTz)}
                  className="flex items-center gap-1 text-xs text-[--muted-foreground] hover:text-[--foreground] transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  {t.settings.timezoneReset}
                </button>
              )}
            </div>
            <p className="text-xs text-[--muted-foreground]">{t.settings.timezoneDesc}</p>

            <input
              type="text"
              value={tzSearch}
              onChange={e => setTzSearch(e.target.value)}
              placeholder={timezone}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-white/50 dark:border-white/[0.12] bg-white/30 dark:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-[--primary] placeholder:text-[--muted-foreground]/60"
            />

            <div className="max-h-48 overflow-y-auto rounded-lg border border-white/50 dark:border-white/[0.12] bg-white/20 dark:bg-white/[0.02]">
              {TIMEZONES.filter(({ tz, label }) =>
                !tzSearch || tz.toLowerCase().includes(tzSearch.toLowerCase()) || label.toLowerCase().includes(tzSearch.toLowerCase())
              ).map(({ tz, label }) => {
                const offset = tzOffsetLabel(tz)
                const isSelected = timezone === tz
                const isDetected = detectedTz === tz
                return (
                  <button
                    key={tz}
                    onClick={() => { setTimezone(tz); setTzSearch("") }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors",
                      isSelected
                        ? "bg-[--primary]/10 text-[--primary]"
                        : "hover:bg-white/30 dark:hover:bg-white/[0.06]"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{label}</span>
                      {isDetected && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[--primary]/10 text-[--primary]">
                          {t.settings.timezoneDetected}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 ml-2 text-xs text-[--muted-foreground] font-mono">{offset}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t.settings.security}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[--muted-foreground]">
            <Shield className="w-4 h-4" />
            <span>{t.settings.securityDesc}</span>
          </div>
          <Separator />
          <form action="/api/auth/logout" method="POST">
            <Button type="submit" variant="outline" className="text-[--destructive] border-[--destructive]/30 hover:bg-[--destructive]/10">
              {t.settings.logoutBtn}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t.settings.data}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[--muted-foreground] mb-4">
            {t.settings.dataDesc}
          </p>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            {t.settings.exportBtn}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
