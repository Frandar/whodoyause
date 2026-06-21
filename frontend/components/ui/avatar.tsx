import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Initials-only avatar. The data model has no user images (recommenders are
// just display names), so this renders deterministic initials on a tinted
// surface — no <img>, no remote fetch.
const avatarVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-secondary font-medium text-secondary-foreground uppercase",
  {
    variants: {
      size: {
        sm: "size-7 text-xs",
        default: "size-9 text-sm",
        lg: "size-12 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2)
  return parts[0][0] + parts[parts.length - 1][0]
}

function Avatar({
  name,
  size,
  className,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof avatarVariants> & { name: string }) {
  return (
    <span
      data-slot="avatar"
      aria-hidden
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      {initials(name)}
    </span>
  )
}

export { Avatar }
