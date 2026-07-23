import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { getEnvelope } from "@/services/http";
import {
    EmptyState,
    PageDialog,
    PageHeader,
    PageShell,
    Pagination,
    Panel,
    StatusBadge,
    errorMessage,
    formatUnixTime,
    type UnknownRecord,
} from "./react-page-helpers";

function responseStatus(row: UnknownRecord) {
    try {
        return Number(
            JSON.parse(String(row.request_data || "{}"))?._response_status ||
                200,
        );
    } catch {
        return 200;
    }
}

function requestPayload(row: UnknownRecord) {
    try {
        const payload = JSON.parse(
            String(row.request_data || "{}"),
        ) as UnknownRecord;
        delete payload._response_status;
        return JSON.stringify(payload, null, 2);
    } catch {
        return String(row.request_data || "{}");
    }
}

export default function AuditManagement() {
    const [rows, setRows] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<UnknownRecord | null>(null);
    const [filters, setFilters] = useState({
        keyword: "",
        action: "",
        admin_id: "",
    });
    const [page, setPage] = useState({
        current: 1,
        size: 20,
        total: 0,
        last: 1,
    });

    const load = useCallback(
        async (reset = false, requestedPage?: number) => {
            const current = reset ? 1 : (requestedPage ?? page.current);
            setLoading(true);
            try {
                const payload = (await getEnvelope("/system/getAuditLog", {
                    ...filters,
                    current,
                    page_size: page.size,
                })) as UnknownRecord;
                const data = Array.isArray(payload.data) ? payload.data : [];
                const total = Number(payload.total || 0);
                setRows(data);
                setPage((previous) => ({
                    ...previous,
                    current,
                    total,
                    last: Math.max(1, Math.ceil(total / previous.size)),
                }));
            } catch (error) {
                toast.error(errorMessage(error));
            } finally {
                setLoading(false);
            }
        },
        [filters, page.current, page.size],
    );

    useEffect(() => {
        void load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const dialogDescription = useMemo(
        () => (detail ? `${detail.method || "—"} · ${detail.uri || "—"}` : ""),
        [detail],
    );

    return (
        <PageShell>
            <PageHeader
                title="操作审计"
                description="追踪管理员操作、来源 IP、请求结果和脱敏后的参数。"
            />
            <Panel className="audit-toolbar">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_12rem_auto] md:items-end">
                    <div className="grid gap-2">
                        <Label>关键字</Label>
                        <Input
                            value={filters.keyword}
                            placeholder="接口或参数"
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    keyword: event.target.value,
                                })
                            }
                            onKeyDown={(event) =>
                                event.key === "Enter" && void load(true)
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>操作标识</Label>
                        <Input
                            value={filters.action}
                            placeholder="例如 user.update"
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    action: event.target.value,
                                })
                            }
                            onKeyDown={(event) =>
                                event.key === "Enter" && void load(true)
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>管理员 ID</Label>
                        <Input
                            value={filters.admin_id}
                            type="number"
                            min={1}
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    admin_id: event.target.value,
                                })
                            }
                            onKeyDown={(event) =>
                                event.key === "Enter" && void load(true)
                            }
                        />
                    </div>
                    <Button onClick={() => void load(true)}>
                        <Search />
                        查询
                    </Button>
                </div>
            </Panel>
            <Panel className="table-wrap audit-table p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>时间</TableHead>
                            <TableHead>管理员</TableHead>
                            <TableHead>操作</TableHead>
                            <TableHead>来源 IP</TableHead>
                            <TableHead>请求</TableHead>
                            <TableHead>结果</TableHead>
                            <TableHead className="text-right">详情</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <EmptyState>正在读取审计记录…</EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <EmptyState>暂无符合条件的记录</EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => {
                                const status = responseStatus(row);
                                return (
                                    <TableRow key={row.id}>
                                        <TableCell>
                                            {formatUnixTime(row.created_at)}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {row.admin?.email ||
                                                `管理员 #${row.admin_id}`}
                                        </TableCell>
                                        <TableCell>
                                            <code>{row.action}</code>
                                        </TableCell>
                                        <TableCell>
                                            <code>{row.ip || "—"}</code>
                                        </TableCell>
                                        <TableCell>
                                            <div className="grid max-w-xs gap-1">
                                                <StatusBadge tone="neutral">
                                                    {row.method || "—"}
                                                </StatusBadge>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {row.uri || "—"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                tone={
                                                    status >= 400
                                                        ? "danger"
                                                        : "default"
                                                }
                                            >
                                                {status}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDetail(row)}
                                            >
                                                查看
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
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
                open={Boolean(detail)}
                onOpenChange={(open) => !open && setDetail(null)}
                title={String(detail?.action || "审计详情")}
                description={dialogDescription}
                className="sm:max-w-3xl"
            >
                {detail && (
                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2">
                            <span className="text-xs text-muted-foreground">
                                管理员
                                <strong className="mt-1 block text-sm text-foreground">
                                    {detail.admin?.email || detail.admin_id}
                                </strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                来源 IP
                                <strong className="mt-1 block text-sm text-foreground">
                                    {detail.ip || "—"}
                                </strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                响应状态
                                <strong className="mt-1 block text-sm text-foreground">
                                    {responseStatus(detail)}
                                </strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                时间
                                <strong className="mt-1 block text-sm text-foreground">
                                    {formatUnixTime(detail.created_at)}
                                </strong>
                            </span>
                        </div>
                        <div>
                            <h3 className="mb-2 font-medium">脱敏请求参数</h3>
                            <pre className="max-h-[45vh] overflow-auto rounded-lg bg-muted p-4 text-xs">
                                {requestPayload(detail)}
                            </pre>
                        </div>
                    </div>
                )}
            </PageDialog>
        </PageShell>
    );
}
