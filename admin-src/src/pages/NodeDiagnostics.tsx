import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { get } from "@/services/http";
import {
    EmptyState,
    MetricCard,
    MetricGrid,
    PageDialog,
    PageHeader,
    PageShell,
    Panel,
    SelectField,
    StatusBadge,
    errorMessage,
    formatBytes,
    formatUnixTime,
    type UnknownRecord,
} from "./react-page-helpers";

const healthLabel = (value: unknown) =>
    ({ normal: "正常", warning: "警告", blocked: "已阻断" })[String(value)] ||
    String(value || "—");
const nodeLabel = (value: unknown) =>
    ({ online: "在线", online_no_push: "在线未推送", offline: "离线" })[
        String(value)
    ] || String(value || "—");
const trafficPercent = (user: UnknownRecord) =>
    user.transfer_enable
        ? Math.min(
              100,
              Math.round(
                  (Number(user.used_traffic || 0) /
                      Number(user.transfer_enable)) *
                      100,
              ),
          )
        : 100;

export default function NodeDiagnostics() {
    const [rows, setRows] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [healthFilter, setHealthFilter] = useState("all");
    const [includeHidden, setIncludeHidden] = useState(false);
    const [detail, setDetail] = useState<UnknownRecord | null>(null);
    const [detailTab, setDetailTab] = useState<"users" | "access">("users");
    const [usersPayload, setUsersPayload] = useState<UnknownRecord | null>(
        null,
    );
    const [accessPayload, setAccessPayload] = useState<UnknownRecord | null>(
        null,
    );
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailSearch, setDetailSearch] = useState("");

    const load = useCallback(
        async (withHidden = includeHidden) => {
            setLoading(true);
            try {
                const data = await get("/node-sync-diagnostic/snapshots", {
                    include_hidden: withHidden ? 1 : 0,
                    pageSize: 100,
                    current: 1,
                    sort_field: "synced_at",
                    sort_order: "desc",
                });
                setRows(Array.isArray(data) ? data : []);
            } catch (error) {
                toast.error(errorMessage(error));
            } finally {
                setLoading(false);
            }
        },
        [includeHidden],
    );
    useEffect(() => {
        void load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const types = useMemo(
        () => [
            ...new Set(
                rows.map((row) => String(row.node_type || "")).filter(Boolean),
            ),
        ],
        [rows],
    );
    const filtered = useMemo(
        () =>
            rows.filter((row) => {
                const term = keyword.trim().toLowerCase();
                return (
                    (!term ||
                        `${row.node_name} ${row.node_type} ${row.group_names} ${row.abnormal_reason}`
                            .toLowerCase()
                            .includes(term)) &&
                    (!typeFilter || row.node_type === typeFilter) &&
                    (healthFilter === "all" ||
                        row.abnormal_status === healthFilter)
                );
            }),
        [healthFilter, keyword, rows, typeFilter],
    );
    const stats = useMemo(
        () => ({
            total: rows.length,
            online: rows.filter((row) => row.node_status === "online").length,
            abnormal: rows.filter((row) => row.abnormal_status !== "normal")
                .length,
            users: rows.reduce(
                (sum, row) => sum + Number(row.fetched_users || 0),
                0,
            ),
            excluded: rows.reduce(
                (sum, row) =>
                    sum +
                    Number(row.excluded_banned || 0) +
                    Number(row.excluded_expired || 0) +
                    Number(row.excluded_traffic || 0),
                0,
            ),
        }),
        [rows],
    );
    const shownUsers = useMemo(() => {
        const list = usersPayload?.users || [];
        const term = detailSearch.trim().toLowerCase();
        return term
            ? list.filter((user: UnknownRecord) =>
                  `${user.email} ${user.xray_email} ${user.uuid} ${user.reason_label}`
                      .toLowerCase()
                      .includes(term),
              )
            : list;
    }, [detailSearch, usersPayload]);
    const shownAccess = useMemo(() => {
        const list = accessPayload?.access || [];
        const term = detailSearch.trim().toLowerCase();
        return term
            ? list.filter((item: UnknownRecord) =>
                  `${item.email} ${item.source} ${item.destination} ${item.network}`
                      .toLowerCase()
                      .includes(term),
              )
            : list;
    }, [accessPayload, detailSearch]);

    const openDetail = async (row: UnknownRecord) => {
        setDetail(row);
        setDetailTab("users");
        setDetailSearch("");
        setDetailLoading(true);
        setUsersPayload(null);
        setAccessPayload(null);
        try {
            const [users, access] = await Promise.all([
                get("/node-sync-diagnostic/node-users", {
                    node_id: row.node_id,
                }),
                get("/node-sync-diagnostic/access", {
                    node_id: row.node_id,
                    limit: 200,
                }),
            ]);
            setUsersPayload(users as UnknownRecord);
            setAccessPayload(access as UnknownRecord);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="节点数据分析"
                description="检查节点在线状态、用户同步差异、排除原因和近期访问记录。"
                action={
                    <Button
                        variant="outline"
                        disabled={loading}
                        onClick={() => void load()}
                    >
                        <RefreshCw />
                        刷新诊断
                    </Button>
                }
            />
            <MetricGrid className="diagnostic-stats xl:grid-cols-5">
                <MetricCard label="诊断节点" value={stats.total} />
                <MetricCard label="在线节点" value={stats.online} />
                <MetricCard label="异常节点" value={stats.abnormal} />
                <MetricCard label="同步用户" value={stats.users} />
                <MetricCard label="被排除用户" value={stats.excluded} />
            </MetricGrid>
            <Panel>
                <div className="diagnostic-toolbar grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto] lg:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="节点、协议、权限组或异常原因"
                        />
                    </div>
                    <SelectField
                        label="协议"
                        value={typeFilter}
                        onValueChange={setTypeFilter}
                        options={[
                            { value: "", label: "全部协议" },
                            ...types.map((type) => ({
                                value: type,
                                label: type,
                            })),
                        ]}
                    />
                    <SelectField
                        label="同步健康"
                        value={healthFilter}
                        onValueChange={setHealthFilter}
                        options={[
                            { value: "all", label: "全部状态" },
                            { value: "normal", label: "正常" },
                            { value: "warning", label: "警告" },
                            { value: "blocked", label: "已阻断" },
                        ]}
                    />
                    <label className="flex h-8 items-center gap-2 text-sm">
                        <Switch
                            checked={includeHidden}
                            onCheckedChange={(checked) => {
                                setIncludeHidden(checked);
                                void load(checked);
                            }}
                        />
                        包含已下架节点
                    </label>
                </div>
            </Panel>
            <Panel className="diagnostic-guide">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                        此页面完全只读。异常通常来自权限组不匹配、封禁、套餐过期、流量耗尽或同步用户数突变。
                    </span>
                </div>
            </Panel>
            {loading ? (
                <Panel>
                    <EmptyState>正在读取节点诊断快照…</EmptyState>
                </Panel>
            ) : filtered.length === 0 ? (
                <Panel>
                    <EmptyState>暂无符合条件的诊断数据</EmptyState>
                </Panel>
            ) : (
                <div className="diagnostic-grid grid gap-4 xl:grid-cols-2">
                    {filtered.map((row) => (
                        <Panel
                            key={row.node_id}
                            className={`diagnostic-card ${row.abnormal_status || ""}`}
                        >
                            <div className="space-y-4">
                                <div className="diagnostic-head flex items-start gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                        <Activity className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate font-semibold">
                                            {row.node_name}
                                        </h2>
                                        <span className="text-xs text-muted-foreground">
                                            #{row.node_id} · {row.node_type} ·{" "}
                                            {row.group_names || "未分组"}
                                        </span>
                                    </div>
                                    <StatusBadge
                                        tone={
                                            row.abnormal_status === "normal"
                                                ? "default"
                                                : row.abnormal_status ===
                                                    "blocked"
                                                  ? "danger"
                                                  : "warning"
                                        }
                                    >
                                        {healthLabel(row.abnormal_status)}
                                    </StatusBadge>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <StatusBadge
                                        tone={
                                            row.node_status === "offline"
                                                ? "danger"
                                                : "neutral"
                                        }
                                    >
                                        {nodeLabel(row.node_status)}
                                    </StatusBadge>
                                    <span>{row.online_users} 位在线用户</span>
                                    <span>·</span>
                                    <span>{row.online_connections} 个连接</span>
                                    <span>·</span>
                                    <span>机器 #{row.machine_id || "—"}</span>
                                </div>
                                <div className="sync-flow grid grid-cols-4 gap-2 rounded-lg bg-muted/50 p-3 text-center">
                                    <div>
                                        <small className="block text-muted-foreground">
                                            上次用户
                                        </small>
                                        <strong>{row.previous_users}</strong>
                                    </div>
                                    <div>
                                        <small className="block text-muted-foreground">
                                            本次同步
                                        </small>
                                        <strong>{row.fetched_users}</strong>
                                    </div>
                                    <div>
                                        <small className="block text-muted-foreground">
                                            新增
                                        </small>
                                        <strong className="text-emerald-600">
                                            +{row.added}
                                        </strong>
                                    </div>
                                    <div>
                                        <small className="block text-muted-foreground">
                                            移除
                                        </small>
                                        <strong className="text-destructive">
                                            -{row.removed}
                                        </strong>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <span className="rounded-md border p-2">
                                        封禁排除
                                        <strong className="block text-base">
                                            {row.excluded_banned}
                                        </strong>
                                    </span>
                                    <span className="rounded-md border p-2">
                                        过期排除
                                        <strong className="block text-base">
                                            {row.excluded_expired}
                                        </strong>
                                    </span>
                                    <span className="rounded-md border p-2">
                                        流量排除
                                        <strong className="block text-base">
                                            {row.excluded_traffic}
                                        </strong>
                                    </span>
                                </div>
                                {row.abnormal_reason && (
                                    <div className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                                        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                                        {row.abnormal_reason}
                                    </div>
                                )}
                                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                                    <span>
                                        同步：
                                        {formatUnixTime(
                                            Number(row.synced_at),
                                            "暂无记录",
                                        )}
                                    </span>
                                    <span>
                                        检查：
                                        {formatUnixTime(
                                            Number(row.last_check_at),
                                            "暂无记录",
                                        )}
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => void openDetail(row)}
                                >
                                    查看用户与访问详情
                                </Button>
                            </div>
                        </Panel>
                    ))}
                </div>
            )}
            <PageDialog
                open={Boolean(detail)}
                onOpenChange={(open) => !open && setDetail(null)}
                title={`${detail?.node_name || "节点"} · 诊断详情`}
                description={`${detail?.node_type || "—"} · 最近同步 ${formatUnixTime(Number(detail?.synced_at), "暂无记录")}`}
                className="sm:max-w-5xl"
            >
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Button
                            variant={
                                detailTab === "users" ? "default" : "outline"
                            }
                            onClick={() => {
                                setDetailTab("users");
                                setDetailSearch("");
                            }}
                        >
                            同步用户（{usersPayload?.summary?.total || 0}）
                        </Button>
                        <Button
                            variant={
                                detailTab === "access" ? "default" : "outline"
                            }
                            onClick={() => {
                                setDetailTab("access");
                                setDetailSearch("");
                            }}
                        >
                            访问记录（{accessPayload?.total || 0}）
                        </Button>
                    </div>
                    <Input
                        value={detailSearch}
                        onChange={(event) =>
                            setDetailSearch(event.target.value)
                        }
                        placeholder={
                            detailTab === "users"
                                ? "邮箱、UUID 或不可用原因"
                                : "用户、来源或目标地址"
                        }
                    />
                    {detailLoading ? (
                        <EmptyState>正在读取诊断详情…</EmptyState>
                    ) : detailTab === "users" ? (
                        <>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <MetricCard
                                    label="在线"
                                    value={usersPayload?.summary?.online || 0}
                                />
                                <MetricCard
                                    label="离线"
                                    value={usersPayload?.summary?.offline || 0}
                                />
                                <MetricCard
                                    label="不可用"
                                    value={
                                        usersPayload?.summary?.unavailable || 0
                                    }
                                />
                                <MetricCard
                                    label="未在当前同步"
                                    value={
                                        usersPayload?.summary
                                            ?.not_current_sync || 0
                                    }
                                />
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>用户</TableHead>
                                        <TableHead>状态</TableHead>
                                        <TableHead>同步</TableHead>
                                        <TableHead>流量</TableHead>
                                        <TableHead>连接/设备</TableHead>
                                        <TableHead>到期时间</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shownUsers.map((user: UnknownRecord) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <strong className="block">
                                                    {user.email}
                                                </strong>
                                                <small className="text-muted-foreground">
                                                    #{user.id} ·{" "}
                                                    {user.xray_email}
                                                </small>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge
                                                    tone={
                                                        user.status === "online"
                                                            ? "default"
                                                            : "neutral"
                                                    }
                                                >
                                                    {user.status === "online"
                                                        ? "在线"
                                                        : user.status ===
                                                            "offline"
                                                          ? "离线"
                                                          : "不可用"}
                                                </StatusBadge>
                                                {!user.available_now && (
                                                    <small className="mt-1 block text-destructive">
                                                        {user.reason_label}
                                                    </small>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <strong className="block">
                                                    {user.included_in_current_sync
                                                        ? "当前已包含"
                                                        : "当前未包含"}
                                                </strong>
                                                <small className="text-muted-foreground">
                                                    上次：
                                                    {user.included_in_last_sync ==
                                                    null
                                                        ? "未知"
                                                        : user.included_in_last_sync
                                                          ? "已包含"
                                                          : "未包含"}
                                                </small>
                                            </TableCell>
                                            <TableCell>
                                                <strong className="block">
                                                    {formatBytes(
                                                        user.used_traffic,
                                                    )}{" "}
                                                    /{" "}
                                                    {formatBytes(
                                                        user.transfer_enable,
                                                    )}
                                                </strong>
                                                <Progress
                                                    className="mt-1"
                                                    value={trafficPercent(user)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {user.connections} /{" "}
                                                {user.node_devices}
                                            </TableCell>
                                            <TableCell>
                                                {user.expired_at_text}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {shownUsers.length === 0 && (
                                <EmptyState>暂无符合条件的用户</EmptyState>
                            )}
                        </>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>时间</TableHead>
                                        <TableHead>用户</TableHead>
                                        <TableHead>来源</TableHead>
                                        <TableHead>目标</TableHead>
                                        <TableHead>网络</TableHead>
                                        <TableHead>流量</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shownAccess.map((item: UnknownRecord) => (
                                        <TableRow
                                            key={`${item.session_id}-${item.timestamp}`}
                                        >
                                            <TableCell>
                                                {formatUnixTime(
                                                    Number(item.timestamp),
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <strong className="block">
                                                    {item.email ||
                                                        item.xray_email}
                                                </strong>
                                                <small className="text-muted-foreground">
                                                    #{item.user_id}
                                                </small>
                                            </TableCell>
                                            <TableCell>
                                                <code>
                                                    {item.source || "—"}
                                                </code>
                                            </TableCell>
                                            <TableCell>
                                                <code>
                                                    {item.destination || "—"}
                                                </code>
                                            </TableCell>
                                            <TableCell>
                                                {item.network || "—"}
                                            </TableCell>
                                            <TableCell>
                                                {formatBytes(item.total)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {shownAccess.length === 0 && (
                                <EmptyState>暂无符合条件的访问记录</EmptyState>
                            )}
                        </>
                    )}
                </div>
            </PageDialog>
        </PageShell>
    );
}
