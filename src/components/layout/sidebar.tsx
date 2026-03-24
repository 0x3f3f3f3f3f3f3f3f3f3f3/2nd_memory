"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Sun, Inbox, CheckSquare, Calendar, Flag, BookOpen, RotateCcw,
  Tag, Search, Settings, Sprout, LogOut, Sparkles
} from "lucide-react"
import { useI18n } from "@/contexts/locale-context"

export function Sidebar() {
  const pathname = usePathname()
  const { t, locale, setLocale } = useI18n()

  const navItems = [
    { href: "/today", label: t.nav.today, icon: Sun },
    { href: "/inbox", label: t.nav.inbox, icon: Inbox },
    { href: "/tasks", label: t.nav.tasks, icon: CheckSquare },
    { href: "/timeline", label: t.nav.timeline, icon: Calendar },
    { href: "/ddl", label: t.nav.ddl, icon: Flag },
    { href: "/ai", label: t.nav.ai, icon: Sparkles },
    { href: "/notes", label: t.nav.notes, icon: BookOpen },
    { href: "/review", label: t.nav.review, icon: RotateCcw },
    { href: "/tags", label: t.nav.tags, icon: Tag },
    { href: "/search", label: t.nav.search, icon: Search },
  ]

  return (
    <aside className="hidden md:flex flex-col w-[var(--sidebar-width)] glass-sidebar h-full fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#C96444] to-[#E08060] flex items-center justify-center shadow-[0_4px_12px_rgba(201,100,68,0.25)]">
          <Sprout className="w-4.5 h-4.5 text-[--primary-foreground]" />
        </div>
        <span className="font-semibold text-sm">{t.appName}</span>
        <button
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          className={cn(
            "ml-auto text-[10px] px-1.5 py-0.5 rounded-md transition-colors",
            "border border-white/40 dark:border-white/[0.1]",
            "text-[--muted-foreground] hover:text-[--foreground]",
            "hover:border-white/60 dark:hover:border-white/[0.2]",
            "hover:bg-white/40 dark:hover:bg-white/[0.05]",
          )}
        >
          {t.switchLanguage}
        </button>
      </div>

      {/* Gradient divider */}
      <div className="gradient-divider mx-3" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm nav-item",
                isActive
                  ? "nav-pill-glow font-medium"
                  : "text-[--muted-foreground] hover:bg-[--accent]/60 hover:text-[--foreground]"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Gradient divider */}
      <div className="gradient-divider mx-3" />

      {/* User info */}
      <div className="px-4 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C96444] to-[#E08A68] flex items-center justify-center text-xs font-bold text-[--primary-foreground] shadow-sm">
          园
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{t.owner}</p>
          <p className="text-[10px] text-[--muted-foreground] truncate">{t.tagline}</p>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="p-2 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full",
            pathname === "/settings"
              ? "nav-pill-glow font-medium"
              : "text-[--muted-foreground] hover:bg-[--accent]/60 hover:text-[--foreground]"
          )}
        >
          <Settings className="w-4 h-4" />
          {t.nav.settings}
        </Link>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full text-[--muted-foreground] hover:bg-[--accent]/60 hover:text-[--foreground] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t.nav.logout}
          </button>
        </form>
      </div>
    </aside>
  )
}
