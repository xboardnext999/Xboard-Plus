import * as React from "react"
import { cn } from "@/lib/utils"

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("flex select-none items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
}

export function Field({ label, htmlFor, description, error, children, className }: { label?: React.ReactNode; htmlFor?: string; description?: React.ReactNode; error?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-2", className)}>
    {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
    {children}
    {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    {error ? <p className="text-xs text-destructive">{error}</p> : null}
  </div>
}
