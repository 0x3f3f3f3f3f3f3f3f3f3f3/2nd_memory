import { ReactNode } from "react"

interface TopbarProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header className="h-14 glass flex items-center px-4 md:px-6 gap-4 sticky top-0 z-20 relative rounded-none border-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold truncate">{title}</h1>
        {subtitle && <p className="text-xs text-[--muted-foreground] truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
      {/* Gradient bottom border */}
      <div className="absolute bottom-0 left-0 right-0 gradient-divider" />
    </header>
  )
}
