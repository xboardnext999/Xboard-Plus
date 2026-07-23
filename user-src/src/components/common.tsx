import * as React from "react"
import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { sanitizeHtml } from "@/lib/format"

export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>{description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}</div>
    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
  </div>
}

export function ErrorAlert({ error }: { error?: unknown }) {
  if (!error) return null
  return <Alert variant="destructive" className="mb-5"><AlertTriangle /><AlertTitle>加载失败</AlertTitle><AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription></Alert>
}

export function PageLoading({ cards = 3 }: { cards?: number }) {
  return <div className="grid gap-4"><Skeleton className="h-9 w-52" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: cards }).map((_, index) => <Skeleton key={index} className="h-44" />)}</div></div>
}

export function EmptyState({ title = "暂无数据", description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return <div className="grid min-h-32 place-items-center rounded-lg border border-dashed p-6 text-center"><div><p className="font-medium">{title}</p>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</div></div>
}

export function DataTable({ headers, rows, empty = "暂无数据", className }: { headers: React.ReactNode[]; rows: React.ReactNode[][]; empty?: string; className?: string }) {
  return <Table className={className}>
    <TableHeader><TableRow>{headers.map((header, index) => <TableHead key={index}>{header}</TableHead>)}</TableRow></TableHeader>
    <TableBody>{rows.length ? rows.map((row, rowIndex) => <TableRow key={rowIndex}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={headers.length}><EmptyState title={empty} /></TableCell></TableRow>}</TableBody>
  </Table>
}

export function StatCards({ items }: { items: Array<{ label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }> }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <Card key={item.label} className="gap-3 py-4"><CardHeader className="flex flex-row items-center justify-between"><CardDescription>{item.label}</CardDescription>{item.icon ? <span className="text-primary">{item.icon}</span> : null}</CardHeader><CardContent><CardTitle className="text-2xl">{item.value}</CardTitle>{item.hint ? <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p> : null}</CardContent></Card>)}</div>
}

export function StatusBadge({ ok, children, warning = false }: { ok?: boolean; warning?: boolean; children: React.ReactNode }) {
  return <Badge variant={warning ? "warning" : ok ? "success" : "secondary"}>{children}</Badge>
}

export function RichContent({ html, markdown = false, className }: { html: unknown; markdown?: boolean; className?: string }) {
  const value = React.useMemo(() => markdown ? sanitizeHtml(String(html || "").replaceAll("\n", "<br>")) : sanitizeHtml(html), [html, markdown])
  return <div className={cn("rich-content", className)} dangerouslySetInnerHTML={{ __html: value }} />
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "确认", destructive = false, busy = false, onConfirm, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: React.ReactNode; confirmLabel?: string; destructive?: boolean; busy?: boolean; onConfirm: () => void | Promise<void>; children?: React.ReactNode
}) {
  return <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>{title}</DialogTitle>{description ? <DialogDescription asChild><div>{description}</div></DialogDescription> : null}</DialogHeader>{children}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>取消</Button><Button variant={destructive ? "destructive" : "default"} disabled={busy} onClick={onConfirm}>{busy ? <LoaderCircle className="animate-spin" /> : destructive ? <AlertTriangle /> : <CheckCircle2 />}{busy ? "处理中…" : confirmLabel}</Button></DialogFooter></DialogContent></Dialog>
}

export interface PaymentMethod { id: string | number; name?: string; payment?: string; icon?: string; balance?: number }
export function PaymentMethodPicker({ methods, value, onValueChange, name = "method" }: { methods: PaymentMethod[]; value: string; onValueChange: (value: string) => void; name?: string }) {
  if (!methods.length) return <EmptyState title="暂无可用支付方式" description="请联系管理员配置支付渠道" />
  return <RadioGroup name={name} value={value} onValueChange={onValueChange} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{methods.map((method) => {
    const id = String(method.id)
    return <Label key={id} htmlFor={`${name}-${id}`} className={cn("cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50", value === id && "border-primary bg-primary/5")}>
      <RadioGroupItem id={`${name}-${id}`} value={id} />
      {method.icon ? <img className="size-7 object-contain" src={method.icon} alt="" /> : <span className="grid size-7 place-content-center rounded-md bg-primary/10 text-primary">¥</span>}
      <span className="grid"><strong className="font-medium">{method.name || method.payment || `支付方式 ${id}`}</strong>{method.balance !== undefined ? <small className="text-muted-foreground">余额 {method.balance}</small> : null}</span>
    </Label>
  })}</RadioGroup>
}
