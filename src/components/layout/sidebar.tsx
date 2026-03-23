"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Sun, Inbox, CheckSquare, Calendar, BookOpen, RotateCcw,
  Tag, Search, Settings, Sprout, LogOut
} from "lucide-react"

const navItems = [
  { href: "/today", label: "今天", icon: Sun },
  { href: "/inbox", label: "收件箱", icon: Inbox },
  { href: "/tasks", label: "任务", icon: CheckSquare },
  { href: "/timeline", label: "时间线", icon: Calendar },
  { href: "/notes", label: "知识库", icon: BookOpen },
  { href: "/review", label: "复习", icon: RotateCcw },
  { href: "/tags", label: "标签", icon: Tag },
  { href: "/search", label: "搜索", icon: Search },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-[var(--sidebar-width)] border-r border-[--border] bg-[--card] h-full fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-[--border]">
        <div className="w-7 h-7 rounded-lg bg-[--primary] flex items-center justify-center">
          <Sprout className="w-4 h-4 text-[--primary-foreground]" />
        </div>
        <span className="font-semibold text-sm">记忆花园</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
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
                  ? "bg-[--primary] text-[--primary-foreground] font-medium shadow-sm"
                  : "text-[--muted-foreground] hover:bg-[--accent] hover:text-[--foreground]"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-[--border] space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full",
            pathname === "/settings"
              ? "bg-[--primary] text-[--primary-foreground]"
              : "text-[--muted-foreground] hover:bg-[--accent] hover:text-[--foreground]"
          )}
        >
          <Settings className="w-4 h-4" />
          设置
        </Link>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full text-[--muted-foreground] hover:bg-[--accent] hover:text-[--foreground] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出
          </button>
        </form>
      </div>
    </aside>
  )
}
