import * as React from "react"
import { cn } from "@/lib/utils"

export function Card({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return <div data-slot="card" data-size={size} className={cn("group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-4xl border border-transparent bg-card py-(--card-spacing) text-sm text-card-foreground shadow-md ring-1 ring-foreground/5 [--card-spacing:--spacing(6)] data-[size=sm]:[--card-spacing:--spacing(4)] dark:ring-foreground/10", className)} {...props} />
}
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("grid auto-rows-min items-start gap-1.5 rounded-t-4xl px-(--card-spacing) [.border-b]:pb-(--card-spacing)", className)} {...props} />
}
export function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("font-heading text-base font-medium leading-none", className)} {...props} />
}
export function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}
export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />
}
export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center rounded-b-4xl px-(--card-spacing) [.border-t]:pt-(--card-spacing)", className)} {...props} />
}
