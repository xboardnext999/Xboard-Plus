import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { CircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"
export function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) { return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid w-full gap-3", className)} {...props} /> }
export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) { return <RadioGroupPrimitive.Item data-slot="radio-group-item" className={cn("aspect-square size-4 shrink-0 rounded-full border border-transparent bg-input/90 text-primary outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground", className)} {...props}><RadioGroupPrimitive.Indicator className="grid place-content-center"><CircleIcon className="size-2 fill-primary-foreground text-primary-foreground" /></RadioGroupPrimitive.Indicator></RadioGroupPrimitive.Item> }
