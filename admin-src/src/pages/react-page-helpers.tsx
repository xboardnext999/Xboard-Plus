import type { ReactNode } from "react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type UnknownRecord = Record<string, any>;

export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "请求失败";
}

export function formatUnixTime(value: unknown, fallback = "—") {
    if (!value) return fallback;
    const raw = typeof value === "number" ? value * 1000 : value;
    const date = new Date(raw as string | number);
    return Number.isNaN(date.getTime())
        ? fallback
        : date.toLocaleString("zh-CN", { hour12: false });
}

export function formatBytes(value: unknown) {
    const bytes = Number(value || 0);
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1,
    );
    return `${(bytes / 1024 ** index).toFixed(index > 2 ? 1 : 0)} ${units[index]}`;
}

export function PageShell({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("page-stack space-y-5", className)}>
            {children}
        </section>
    );
}

export function PageHeader({
    title,
    description,
    action,
}: {
    title: ReactNode;
    description: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="page-heading page-heading-row flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                </h1>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {action && (
                <div className="flex shrink-0 flex-wrap gap-2">{action}</div>
            )}
        </div>
    );
}

export function Panel({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <Card className={cn("panel", className)}>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

export function MetricCard({
    label,
    value,
    hint,
}: {
    label: ReactNode;
    value: ReactNode;
    hint?: ReactNode;
}) {
    return (
        <Card className="stat-card gap-2">
            <CardHeader className="pb-0">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
            {hint && (
                <CardContent className="text-xs text-muted-foreground">
                    {hint}
                </CardContent>
            )}
        </Card>
    );
}

export function MetricGrid({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "stat-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
                className,
            )}
        >
            {children}
        </div>
    );
}

export function FormField({
    label,
    hint,
    children,
    className,
}: {
    label: ReactNode;
    hint?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("field grid gap-2", className)}>
            <Label className="text-sm">{label}</Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

export function TextField({
    label,
    value,
    onChange,
    hint,
    className,
    ...props
}: {
    label: ReactNode;
    value: string | number;
    onChange: (value: string) => void;
    hint?: ReactNode;
    className?: string;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
    const id = useId();
    return (
        <div className={cn("field grid gap-2", className)}>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                {...props}
            />
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

export interface SelectOption {
    value: string | number;
    label: ReactNode;
}

const EMPTY_SELECT_VALUE = "__xboard_empty__";

export function SelectField({
    label,
    value,
    onValueChange,
    options,
    hint,
    disabled,
    className,
}: {
    label: ReactNode;
    value: string | number | null | undefined;
    onValueChange: (value: string) => void;
    options: SelectOption[];
    hint?: ReactNode;
    disabled?: boolean;
    className?: string;
}) {
    const normalized =
        value === "" || value == null ? EMPTY_SELECT_VALUE : String(value);
    return (
        <div className={cn("field grid gap-2", className)}>
            <Label>{label}</Label>
            <Select
                value={normalized}
                onValueChange={(next) =>
                    onValueChange(
                        next === EMPTY_SELECT_VALUE ? "" : String(next),
                    )
                }
                disabled={disabled}
            >
                <SelectTrigger className="w-full">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => {
                        const optionValue =
                            option.value === ""
                                ? EMPTY_SELECT_VALUE
                                : String(option.value);
                        return (
                            <SelectItem key={optionValue} value={optionValue}>
                                {option.label}
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

export function StatusBadge({
    children,
    tone = "default",
}: {
    children: ReactNode;
    tone?: "default" | "neutral" | "danger" | "warning";
}) {
    const variant =
        tone === "danger"
            ? "destructive"
            : tone === "default"
              ? "default"
              : "secondary";
    return (
        <Badge
            variant={variant}
            className={cn(
                tone === "warning" &&
                    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
            )}
        >
            {children}
        </Badge>
    );
}

export function EmptyState({ children }: { children: ReactNode }) {
    return (
        <div className="settings-loading py-10 text-center text-sm text-muted-foreground">
            {children}
        </div>
    );
}

export function PageDialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    className,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    "max-h-[90vh] overflow-y-auto sm:max-w-2xl",
                    className,
                )}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>
                {children}
                {footer && <DialogFooter>{footer}</DialogFooter>}
            </DialogContent>
        </Dialog>
    );
}

export function ConfirmAction({
    children,
    title,
    description,
    confirmText = "确认",
    onConfirm,
    disabled,
    destructive = true,
    variant,
    size = "sm",
}: {
    children: ReactNode;
    title: ReactNode;
    description: ReactNode;
    confirmText?: string;
    onConfirm: () => void | Promise<void>;
    disabled?: boolean;
    destructive?: boolean;
    variant?: React.ComponentProps<typeof Button>["variant"];
    size?: React.ComponentProps<typeof Button>["size"];
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        try {
            await onConfirm();
            setOpen(false);
        } finally {
            setBusy(false);
        }
    };
    return (
        <>
            <Button
                type="button"
                variant={variant ?? (destructive ? "destructive" : "outline")}
                size={size}
                disabled={disabled}
                onClick={() => setOpen(true)}
            >
                {children}
            </Button>
            <PageDialog
                open={open}
                onOpenChange={setOpen}
                title={title}
                description={description}
                className="sm:max-w-md"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            取消
                        </Button>
                        <Button
                            variant={destructive ? "destructive" : "default"}
                            disabled={busy}
                            onClick={run}
                        >
                            {busy ? "处理中…" : confirmText}
                        </Button>
                    </>
                }
            >
                <div />
            </PageDialog>
        </>
    );
}

export function Pagination({
    current,
    last,
    total,
    loading,
    onChange,
}: {
    current: number;
    last: number;
    total?: number;
    loading?: boolean;
    onChange: (page: number) => void;
}) {
    return (
        <div className="pagination flex flex-wrap items-center justify-end gap-2 text-sm text-muted-foreground">
            {total != null && <span className="mr-auto">共 {total} 条</span>}
            <Button
                variant="outline"
                size="sm"
                disabled={current <= 1 || loading}
                onClick={() => onChange(current - 1)}
            >
                上一页
            </Button>
            <span>
                {current} / {Math.max(1, last)}
            </span>
            <Button
                variant="outline"
                size="sm"
                disabled={current >= last || loading}
                onClick={() => onChange(current + 1)}
            >
                下一页
            </Button>
        </div>
    );
}
