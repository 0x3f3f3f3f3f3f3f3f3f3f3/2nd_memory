"use client"
import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useT } from "@/contexts/locale-context"
import type { T } from "@/lib/i18n"

interface TopbarProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
}

function getPageTitle(pathname: string, t: T): string {
  if (pathname === "/inbox") return t.inbox.pageTitle
  if (pathname === "/tasks") return t.tasks.pageTitle
  if (pathname === "/ddl") return t.tasks.pageTitle
  if (pathname === "/timeline") return t.timeline.pageTitle
  if (pathname === "/ai") return t.ai.pageTitle
  if (pathname === "/notes/new") return t.notes.newNote
  if (pathname.startsWith("/notes/") && pathname.endsWith("/edit")) return t.notes.editNote
  if (pathname === "/notes") return t.notes.pageTitle
  if (pathname === "/tags") return t.nav.tags
  if (pathname === "/search") return t.nav.search
  if (pathname === "/settings") return t.settings.pageTitle
  return ""
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const pathname = usePathname()
  const t = useT()
  const displayTitle = title || getPageTitle(pathname, t)

  return (
    <header className="h-14 glass flex items-center px-4 md:px-6 gap-4 sticky top-0 z-20 relative rounded-none border-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold truncate">{displayTitle}</h1>
        {subtitle && <p className="text-xs text-[--muted-foreground] truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
      {/* Gradient bottom border */}
      <div className="absolute bottom-0 left-0 right-0 gradient-divider" />
    </header>
  )
}
