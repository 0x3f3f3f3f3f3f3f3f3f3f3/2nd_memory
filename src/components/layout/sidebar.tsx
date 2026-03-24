"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Inbox, CheckSquare, Calendar, BookOpen,
  Tag, Search, Settings, Sprout, LogOut, Sparkles
} from "lucide-react"
import { useI18n } from "@/contexts/locale-context"

export function Sidebar({ username }: { username: string }) {
  const pathname = usePathname()
  const { t, locale, setLocale } = useI18n()
  const logoutAction = `/api/auth/logout?from=${encodeURIComponent(pathname || "/")}`

  const navItems = [
    { href: "/inbox", label: t.nav.inbox, icon: Inbox },
    { href: "/ddl", label: t.nav.tasks, icon: CheckSquare },
    { href: "/timeline", label: t.nav.timeline, icon: Calendar },
    { href: "/ai", label: t.nav.ai, icon: Sparkles },
    { href: "/notes", label: t.nav.notes, icon: BookOpen },
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
            "border border-[var(--liquid-glass-border)]",
            "text-[--muted-foreground] hover:text-[--foreground]",
            "hover:border-[var(--liquid-glass-border)]",
            "hover:bg-[var(--liquid-glass-hover-bg)]",
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
      <div className="mx-2 mb-1 px-3 py-2.5 rounded-xl flex items-center gap-2.5 bg-[var(--liquid-glass-bg)] border border-[var(--liquid-glass-border)] shadow-[var(--liquid-glass-shadow-soft)]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C96444] to-[#E08060] flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(201,100,68,0.3)]">
          <span className="text-[11px] font-bold text-white leading-none">
            {username.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{username}</p>
          <p className="text-[10px] text-[--muted-foreground]/60 truncate">{t.nav.personalSpace}</p>
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
        <form action={logoutAction} method="POST">
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
