import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] disabled:pointer-events-none disabled:opacity-50 btn-animate",
  {
    variants: {
      variant: {
        default: "bg-[--primary] text-[--primary-foreground] hover:opacity-90 shadow-sm",
        destructive: "bg-[--destructive] text-[--destructive-foreground] hover:opacity-90 shadow-sm",
        outline: "border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg-soft)] hover:text-[--accent-foreground] backdrop-blur-sm btn-ghost-animate",
        secondary: "bg-[--secondary] text-[--secondary-foreground] hover:bg-[--secondary]/80 btn-ghost-animate",
        ghost: "hover:bg-[--accent] hover:text-[--accent-foreground] btn-ghost-animate",
        link: "text-[--primary] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[44px] md:min-h-9 px-4 py-2.5 md:py-2",
        sm: "min-h-[40px] md:min-h-8 rounded-md px-3 text-sm md:text-xs",
        lg: "min-h-[48px] md:min-h-10 rounded-md px-8",
        icon: "h-11 w-11 md:h-9 md:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
