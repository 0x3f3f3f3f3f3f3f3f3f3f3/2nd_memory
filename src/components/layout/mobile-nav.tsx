"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Sun, Inbox, CheckSquare, BookOpen, RotateCcw } from "lucide-react"

const mobileNavItems = [
  { href: "/today", label: "今天", icon: Sun },
  { href: "/inbox", label: "收件箱", icon: Inbox },
  { href: "/tasks", label: "任务", icon: CheckSquare },
  { href: "/notes", label: "笔记", icon: BookOpen },
  { href: "/review", label: "复习", icon: RotateCcw },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[--border] bg-[--card]/95 backdrop-blur-sm">
      <div className="flex items-center justify-around h-14 px-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[52px]",
                isActive ? "text-[--primary]" : "text-[--muted-foreground]"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
