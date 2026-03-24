"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Sun, Inbox, Calendar, Sparkles, BookOpen, MoreHorizontal,
  CheckSquare, Flag, RefreshCw, Tags, Search, Settings, LogOut, Globe,
} from "lucide-react"
import { useI18n } from "@/contexts/locale-context"

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()
  const [moreOpen, setMoreOpen] = useState(false)

  const mainItems = [
    { href: "/today", label: t.nav.today, icon: Sun },
    { href: "/inbox", label: t.nav.inboxMobile, icon: Inbox },
    { href: "/timeline", label: t.nav.scheduleMobile, icon: Calendar },
    { href: "/ai", label: t.nav.aiMobile, icon: Sparkles },
    { href: "/notes", label: t.nav.notesMobile, icon: BookOpen },
  ]

  const moreItems = [
    { href: "/tasks", label: t.nav.tasks, icon: CheckSquare },
    { href: "/ddl", label: t.nav.ddl, icon: Flag },
    { href: "/review", label: t.nav.review, icon: RefreshCw },
    { href: "/tags", label: t.nav.tags, icon: Tags },
    { href: "/search", label: t.nav.search, icon: Search },
    { href: "/settings", label: t.nav.settings, icon: Settings },
  ]

  const isMoreActive = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  )

  return (
    <>
      {/* More drawer overlay + sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          {/* Bottom sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 glass rounded-t-2xl border-t border-white/40 dark:border-white/[0.08]"
            style={{ animation: "sheet-up 0.25s ease-out" }}
          >
            <div className="sheet-pill mt-3" />
            <div className="px-4 pt-2 pb-2">
              <div className="grid grid-cols-3 gap-2">
                {moreItems.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-colors tap-scale",
                        active
                          ? "bg-[--primary]/10 text-[--primary]"
                          : "text-[--foreground] active:bg-[--accent]"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </div>

              {/* Bottom row: language + logout */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/30 dark:border-white/[0.06] pb-1 safe-area-pb">
                <button
                  onClick={() => { setLocale(locale === "zh" ? "en" : "zh"); setMoreOpen(false) }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[--muted-foreground] active:bg-[--accent] transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  {t.switchLanguage}
                </button>
                <div className="flex-1" />
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[--destructive] active:bg-[--destructive]/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.nav.logout}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass rounded-none border-0">
        <div className="absolute top-0 left-0 right-0 gradient-divider" />
        <div className="flex items-center justify-around h-16 px-2 safe-area-pb">
          {mainItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[56px] tap-scale",
                  isActive ? "text-[--primary]" : "text-[--muted-foreground]"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0.5 w-4 h-0.5 rounded-full bg-[--primary] shadow-[0_0_6px_rgba(201,100,68,0.4)]" />
                )}
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              "relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[56px] tap-scale",
              moreOpen || isMoreActive ? "text-[--primary]" : "text-[--muted-foreground]"
            )}
          >
            <MoreHorizontal className={cn("w-5 h-5", (moreOpen || isMoreActive) && "stroke-[2.5px]")} />
            <span className="text-[10px] font-medium">{t.nav.more}</span>
            {isMoreActive && !moreOpen && (
              <span className="absolute bottom-0.5 w-4 h-0.5 rounded-full bg-[--primary] shadow-[0_0_6px_rgba(201,100,68,0.4)]" />
            )}
          </button>
        </div>
      </nav>
    </>
  )
}
