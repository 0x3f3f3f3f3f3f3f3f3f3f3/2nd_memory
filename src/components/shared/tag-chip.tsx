import { cn } from "@/lib/utils"

interface TagChipProps {
  name: string
  color?: string
  size?: "sm" | "md"
  className?: string
}

export function TagChip({ name, color = "#6366f1", size = "md", className }: TagChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
        size === "sm" ? "text-xs" : "text-xs",
        className
      )}
      style={{ borderColor: color + "40", backgroundColor: color + "15", color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  )
}
