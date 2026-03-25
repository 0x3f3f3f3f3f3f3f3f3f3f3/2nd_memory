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
    <header
      data-topbar="true"
      className="h-14 glass sticky top-0 z-20 relative rounded-none border-0 safe-area-px"
    >
      <div className="flex h-full items-center gap-3 md:gap-4 px-4 md:pl-6 md:pr-6 lg:pl-7 lg:pr-7">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{displayTitle}</h1>
          {subtitle && <p className="text-xs text-[--muted-foreground] truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {/* Gradient bottom border */}
      <div className="absolute bottom-0 left-0 right-0 gradient-divider" />
    </header>
  )
}
