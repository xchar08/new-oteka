import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 hover:scale-[1.02]",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-[var(--primary-fg)] shadow-lg shadow-[var(--primary)]/20 hover:opacity-90",
        destructive: "bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600",
        outline: "border-2 border-[var(--primary)] bg-transparent text-[var(--primary)] hover:bg-[var(--primary)]/5",
        secondary: "bg-[var(--bg-surface-2)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-surface-2)]/80",
        ghost: "hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        success: "bg-[var(--success)] text-white shadow-lg shadow-[var(--success)]/20 hover:opacity-90",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-10 text-base",
        xl: "h-16 px-12 text-lg font-bold",
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
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
