import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] md:min-h-[60px] w-full rounded-md border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-input-bg)] px-3 py-3 md:py-2 text-base md:text-sm shadow-[var(--liquid-glass-shadow-soft)] backdrop-blur-md transition-colors duration-150 placeholder:text-[--muted-foreground] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--ring] disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none dark:backdrop-blur-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
