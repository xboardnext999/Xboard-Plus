import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { get, getEnvelope, post } from "@/services/http";
import {
    EmptyState,
    MetricCard,
    MetricGrid,
    PageDialog,
    PageHeader,
    PageShell,
    Pagination,
    Panel,
    SelectField,
    StatusBadge,
    errorMessage,
    formatBytes,
    type UnknownRecord,
} from "./react-page-helpers";

const TYPES: Array<[string, string]> = [
    ["monthly", "按月重置"],
    ["first_day_month", "每月首日"],
    ["yearly", "按年重置"],
    ["first_day_year", "每年首日"],
    ["manual", "人工重置"],
    ["purchase", "购买触发"],
];
const SOURCES: Array<[string, string]> = [
    ["auto", "自动触发"],
    ["manual", "管理员手动"],
    ["api", "API 调用"],
    ["cron", "定时任务"],
    ["user_access", "用户访问"],
    ["order", "订单触发"],
    ["gift_card", "礼品卡触发"],
];
const displayTime = (value: unknown) => {
    if (!value) return "—";
    const date = new Date(value as string);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString("zh-CN", { hour12: false });
};

export default function TrafficResetManagement() {
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [showReset, setShowReset] = useState(false);
    const [detail, setDetail] = useState<UnknownRecord | null>(null);
    const [rows, setRows] = useState<UnknownRecord[]>([]);
    const [stats, setStats] = useState<UnknownRecord>({});
    const [filters, setFilters] = useState({
        user_email: "",
        reset_type: "",
        trigger_source: "",
        start_date: "",
        end_date: "",
    });
    const [page, setPage] = useState({
        current: 1,
        last: 1,
        total: 0,
        perPage: 20,
    });
    const [resetForm, setResetForm] = useState({ user_id: "", reason: "" });
    const params = useCallback(
        (current = page.current, extra: UnknownRecord = {}, source = filters) =>
            Object.fromEntries(
                Object.entries({
                    ...source,
                    page: current,
                    per_page: page.perPage,
                    ...extra,
                }).filter(([, value]) => value !== "" && value != null),
            ),
        [filters, page.current, page.perPage],
    );
    const load = useCallback(
        async (reset = false, requestedPage?: number, source = filters) => {
            const current = reset ? 1 : (requestedPage ?? page.current);
            setLoading(true);
            try {
                const payload = (await getEnvelope(
                    "/traffic-reset/logs",
                    params(current, {}, source),
                )) as UnknownRecord;
                setRows(Array.isArray(payload.data) ? payload.data : []);
                setPage((previous) => ({
                    ...previous,
                    current: Number(
                        payload.pagination?.current_page || current,
                    ),
                    last: Number(payload.pagination?.last_page || 1),
                    total: Number(payload.pagination?.total || 0),
                }));
            } catch (error) {
                toast.error(errorMessage(error));
                setRows([]);
            } finally {
                setLoading(false);
            }
        },
        [filters, page.current, params],
    );
    const loadStats = useCallback(async () => {
        try {
            setStats(
                (await get("/traffic-reset/stats", {
                    days: 30,
                })) as UnknownRecord,
            );
        } catch (error) {
            toast.error(errorMessage(error));
        }
    }, []);
    useEffect(() => {
        void Promise.all([load(), loadStats()]);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const clearFilters = () => {
        const next = {
            user_email: "",
            reset_type: "",
            trigger_source: "",
            start_date: "",
            end_date: "",
        };
        setFilters(next);
        void load(true, 1, next);
    };
    const resetUser = async () => {
        if (!resetForm.user_id) return toast.error("请输入用户 ID");
        setResetting(true);
        try {
            const result = (await post("/traffic-reset/reset-user", {
                user_id: Number(resetForm.user_id),
                reason: resetForm.reason.trim(),
            })) as UnknownRecord;
            toast.success(
                `用户 ${result?.email || `#${resetForm.user_id}`} 流量已重置`,
            );
            setShowReset(false);
            setResetForm({ user_id: "", reason: "" });
            await Promise.all([load(true), loadStats()]);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setResetting(false);
        }
    };
    const exportCsv = async () => {
        setExporting(true);
        try {
            const payload = (await getEnvelope(
                "/traffic-reset/logs",
                params(1, { page: 1, per_page: 10000 }),
            )) as UnknownRecord;
            const csvCell = (value: unknown) =>
                `"${String(value ?? "").replaceAll('"', '""')}"`;
            const head = [
                "日志ID",
                "用户ID",
                "用户邮箱",
                "重置类型",
                "触发来源",
                "重置前流量",
                "重置后流量",
                "重置时间",
            ];
            const lines = [
                head,
                ...(payload.data || []).map((row: UnknownRecord) => [
                    row.id,
                    row.user_id,
                    row.user_email,
                    row.reset_type_name,
                    row.trigger_source_name,
                    row.old_traffic?.formatted,
                    row.new_traffic?.formatted,
                    row.reset_time,
                ]),
            ];
            const blob = new Blob(
                [
                    `\uFEFF${lines.map((line: unknown[]) => line.map(csvCell).join(",")).join("\n")}`,
                ],
                { type: "text/csv;charset=utf-8" },
            );
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `traffic-reset-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setExporting(false);
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="流量重置日志"
                description="追踪自动、定时和人工重置记录，核对用户重置前后的流量变化。"
                action={
                    <>
                        <Button
                            variant="outline"
                            disabled={exporting}
                            onClick={() => void exportCsv()}
                        >
                            <Download />
                            {exporting ? "导出中…" : "导出 CSV"}
                        </Button>
                        <Button onClick={() => setShowReset(true)}>
                            <RotateCcw />
                            手动重置
                        </Button>
                    </>
                }
            />
            <MetricGrid>
                <MetricCard
                    label="近 30 天重置"
                    value={stats.total_resets || 0}
                    hint="全部触发来源"
                />
                <MetricCard
                    label="自动重置"
                    value={stats.auto_resets || 0}
                    hint="订阅周期自动执行"
                />
                <MetricCard
                    label="定时任务"
                    value={stats.cron_resets || 0}
                    hint="计划任务触发"
                />
                <MetricCard
                    label="人工重置"
                    value={stats.manual_resets || 0}
                    hint="管理员主动执行"
                />
            </MetricGrid>
            <Panel>
                <div className="reset-filters grid gap-3 xl:grid-cols-[1fr_11rem_11rem_10rem_10rem_auto] xl:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">用户邮箱</span>
                        <Input
                            value={filters.user_email}
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    user_email: event.target.value,
                                })
                            }
                            placeholder="输入完整或部分邮箱"
                            onKeyDown={(event) =>
                                event.key === "Enter" && void load(true)
                            }
                        />
                    </div>
                    <SelectField
                        label="重置类型"
                        value={filters.reset_type}
                        onValueChange={(reset_type) =>
                            setFilters({ ...filters, reset_type })
                        }
                        options={[
                            { value: "", label: "全部类型" },
                            ...TYPES.map(([value, label]) => ({
                                value,
                                label,
                            })),
                        ]}
                    />
                    <SelectField
                        label="触发来源"
                        value={filters.trigger_source}
                        onValueChange={(trigger_source) =>
                            setFilters({ ...filters, trigger_source })
                        }
                        options={[
                            { value: "", label: "全部来源" },
                            ...SOURCES.map(([value, label]) => ({
                                value,
                                label,
                            })),
                        ]}
                    />
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">开始日期</span>
                        <Input
                            type="date"
                            value={filters.start_date}
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    start_date: event.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">结束日期</span>
                        <Input
                            type="date"
                            value={filters.end_date}
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    end_date: event.target.value,
                                })
                            }
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={clearFilters}>
                            重置
                        </Button>
                        <Button onClick={() => void load(true)}>查询</Button>
                    </div>
                </div>
            </Panel>
            <Panel className="table-wrap p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>用户</TableHead>
                            <TableHead>重置类型</TableHead>
                            <TableHead>流量变化</TableHead>
                            <TableHead>触发来源</TableHead>
                            <TableHead>重置时间</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6}>
                                    <EmptyState>正在加载重置日志…</EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6}>
                                    <EmptyState>
                                        暂无符合条件的重置记录
                                    </EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        <strong className="block">
                                            {row.user_email}
                                        </strong>
                                        <small className="text-muted-foreground">
                                            #{row.user_id} · 日志 #{row.id}
                                        </small>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge>
                                            {row.reset_type_name}
                                        </StatusBadge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span>
                                                {row.old_traffic?.formatted ||
                                                    formatBytes(
                                                        row.old_traffic?.total,
                                                    )}
                                            </span>
                                            <ArrowRight className="size-3" />
                                            <strong>
                                                {row.new_traffic?.formatted ||
                                                    formatBytes(
                                                        row.new_traffic?.total,
                                                    )}
                                            </strong>
                                        </div>
                                        <small className="text-muted-foreground">
                                            减少{" "}
                                            {formatBytes(
                                                Math.max(
                                                    0,
                                                    Number(
                                                        row.old_traffic
                                                            ?.total || 0,
                                                    ) -
                                                        Number(
                                                            row.new_traffic
                                                                ?.total || 0,
                                                        ),
                                                ),
                                            )}
                                        </small>
                                    </TableCell>
                                    <TableCell>
                                        <strong className="block">
                                            {row.trigger_source_name}
                                        </strong>
                                        {row.metadata?.reason && (
                                            <small className="text-muted-foreground">
                                                {row.metadata.reason}
                                            </small>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {displayTime(row.reset_time)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setDetail(row)}
                                        >
                                            详情
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Panel>
            <Pagination
                current={page.current}
                last={page.last}
                total={page.total}
                loading={loading}
                onChange={(current) => void load(false, current)}
            />
            <PageDialog
                open={showReset}
                onOpenChange={setShowReset}
                title="手动重置用户流量"
                description="该操作会清零当前已用流量，并写入管理员操作记录。"
                className="sm:max-w-lg"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowReset(false)}
                        >
                            取消
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={resetting || !resetForm.user_id}
                            onClick={() => void resetUser()}
                        >
                            {resetting ? "正在重置…" : "确认重置流量"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        <strong className="block">请确认用户 ID</strong>
                        重置后无法从后台直接恢复，请在原因中写明操作依据。
                    </p>
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">用户 ID *</span>
                        <Input
                            value={resetForm.user_id}
                            type="number"
                            min={1}
                            onChange={(event) =>
                                setResetForm({
                                    ...resetForm,
                                    user_id: event.target.value,
                                })
                            }
                            placeholder="例如 1024"
                        />
                    </div>
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">重置原因</span>
                        <Textarea
                            value={resetForm.reason}
                            rows={4}
                            maxLength={255}
                            onChange={(event) =>
                                setResetForm({
                                    ...resetForm,
                                    reason: event.target.value,
                                })
                            }
                            placeholder="例如：用户套餐补偿、异常流量修正"
                        />
                    </div>
                </div>
            </PageDialog>
            <PageDialog
                open={Boolean(detail)}
                onOpenChange={(open) => !open && setDetail(null)}
                title={`重置日志 #${detail?.id || ""}`}
                description={
                    detail
                        ? `${detail.user_email} · ${displayTime(detail.reset_time)}`
                        : ""
                }
            >
                {detail && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                            <span className="text-xs text-muted-foreground">
                                用户
                                <strong className="block text-sm text-foreground">
                                    #{detail.user_id}
                                </strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                类型
                                <strong className="block text-sm text-foreground">
                                    {detail.reset_type_name}
                                </strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                来源
                                <strong className="block text-sm text-foreground">
                                    {detail.trigger_source_name}
                                </strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                流量变化
                                <strong className="block text-sm text-foreground">
                                    {detail.old_traffic?.formatted} →{" "}
                                    {detail.new_traffic?.formatted}
                                </strong>
                            </span>
                        </div>
                        <div>
                            <h3 className="mb-2 font-medium">附加信息</h3>
                            <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs">
                                {JSON.stringify(detail.metadata || {}, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </PageDialog>
        </PageShell>
    );
}
