import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Shared empty / zero-result surface. Directive, not moody (FRONTEND.md copy
// rules) — pass an `action` (e.g. a Button) to give the user a way forward.
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-soft">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export { EmptyState }
