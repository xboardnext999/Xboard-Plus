import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva("relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-2xl border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-2.5", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      destructive: "border-destructive/30 bg-destructive/5 text-destructive",
      success: "border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    },
  },
  defaultVariants: { variant: "default" },
})
export function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}
export function AlertTitle({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("col-start-2 font-medium leading-none", className)} {...props} /> }
export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("col-start-2 grid justify-items-start gap-1 text-sm opacity-90", className)} {...props} /> }
