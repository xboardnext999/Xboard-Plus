import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Plus, RefreshCw, Server } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { get, post } from "@/services/http";
import {
    ConfirmAction,
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

type MachineForm = {
    id: number | null;
    name: string;
    notes: string;
    is_active: boolean;
};
const blank = (): MachineForm => ({
    id: null,
    name: "",
    notes: "",
    is_active: true,
});
const percent = (used: unknown, total: unknown) =>
    Number(total)
        ? Math.min(100, Math.round((Number(used || 0) / Number(total)) * 100))
        : 0;
const speed = (value: unknown) => `${formatBytes(value)}/s`;
const isOnline = (item: UnknownRecord) =>
    Boolean(item.is_active) &&
    Number(item.last_seen_at || 0) > Math.floor(Date.now() / 1000) - 180;

export default function ServerManagement() {
    const [machines, setMachines] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [showForm, setShowForm] = useState(false);
    const [detail, setDetail] = useState<UnknownRecord | null>(null);
    const [nodes, setNodes] = useState<UnknownRecord[]>([]);
    const [history, setHistory] = useState<UnknownRecord[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [credential, setCredential] = useState({ token: "", command: "" });
    const [form, setForm] = useState<MachineForm>(blank());
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await get("/server/machine/fetch");
            setMachines(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const filtered = useMemo(
        () =>
            machines.filter((item) => {
                const term = keyword.trim().toLowerCase();
                return (
                    (!term ||
                        `${item.name} ${item.notes || ""}`
                            .toLowerCase()
                            .includes(term)) &&
                    (statusFilter === "all" ||
                        Boolean(item.is_active) === (statusFilter === "1"))
                );
            }),
        [keyword, machines, statusFilter],
    );
    const stats = useMemo(
        () => ({
            total: machines.length,
            online: machines.filter(isOnline).length,
            nodes: machines.reduce(
                (sum, item) => sum + Number(item.servers_count || 0),
                0,
            ),
        }),
        [machines],
    );
    const closeForm = () => {
        setShowForm(false);
        setForm(blank());
        setCredential({ token: "", command: "" });
    };
    const open = (item?: UnknownRecord) => {
        setForm(
            item
                ? {
                      id: Number(item.id),
                      name: String(item.name || ""),
                      notes: String(item.notes || ""),
                      is_active: Boolean(item.is_active),
                  }
                : blank(),
        );
        setCredential({ token: "", command: "" });
        setShowForm(true);
    };
    const save = async () => {
        if (!form.name.trim()) return toast.error("机器名称不能为空");
        setSaving(true);
        try {
            const creating = !form.id;
            const result = (await post(
                "/server/machine/save",
                form,
            )) as UnknownRecord;
            if (creating && result) {
                setForm((previous) => ({ ...previous, id: Number(result.id) }));
                setCredential({
                    token: String(result.token || ""),
                    command: String(result.install_command || ""),
                });
                toast.success("机器已创建，请保存安装凭据");
            } else {
                toast.success("机器配置已更新");
                closeForm();
            }
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const openDetail = async (item: UnknownRecord) => {
        setDetail(item);
        setDetailLoading(true);
        setNodes([]);
        setHistory([]);
        try {
            const [nodeData, historyData] = await Promise.all([
                get("/server/machine/nodes", { machine_id: item.id }),
                get("/server/machine/history", {
                    machine_id: item.id,
                    range_hours: 24,
                    limit: 120,
                }),
            ]);
            setNodes(Array.isArray(nodeData) ? nodeData : []);
            setHistory(Array.isArray(historyData) ? historyData : []);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setDetailLoading(false);
        }
    };
    const showCredentials = async (item: UnknownRecord) => {
        setBusyId(Number(item.id));
        try {
            const [tokenData, commandData] = (await Promise.all([
                get("/server/machine/getToken", { id: item.id }),
                get("/server/machine/installCommand", { id: item.id }),
            ])) as [UnknownRecord, UnknownRecord];
            setForm({
                id: Number(item.id),
                name: String(item.name || ""),
                notes: String(item.notes || ""),
                is_active: Boolean(item.is_active),
            });
            setCredential({
                token: String(tokenData.token || ""),
                command: String(commandData.command || ""),
            });
            setShowForm(true);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusyId(null);
        }
    };
    const resetToken = async () => {
        if (!form.id) return;
        setSaving(true);
        try {
            const data = (await post("/server/machine/resetToken", {
                id: form.id,
            })) as UnknownRecord;
            const commandData = (await get("/server/machine/installCommand", {
                id: form.id,
            })) as UnknownRecord;
            setCredential({
                token: String(data.token || ""),
                command: String(commandData.command || ""),
            });
            toast.success("Token 已重置");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const remove = async (item: UnknownRecord) => {
        setBusyId(Number(item.id));
        try {
            await post("/server/machine/drop", { id: item.id });
            toast.success("机器已删除");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusyId(null);
        }
    };
    const copy = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label}已复制`);
        } catch {
            toast.error("复制失败，请手动复制");
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="服务器管理"
                description="管理机器代理、安装凭据、关联节点与实时资源负载。"
                action={
                    <Button onClick={() => open()}>
                        <Plus />
                        添加服务器
                    </Button>
                }
            />
            <MetricGrid>
                <MetricCard label="服务器总数" value={stats.total} />
                <MetricCard label="在线服务器" value={stats.online} />
                <MetricCard label="关联节点" value={stats.nodes} />
            </MetricGrid>
            <Panel>
                <div className="machine-toolbar grid gap-3 md:grid-cols-[1fr_14rem_auto] md:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="服务器名称或备注"
                        />
                    </div>
                    <SelectField
                        label="启用状态"
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                        options={[
                            { value: "all", label: "全部状态" },
                            { value: "1", label: "已启用" },
                            { value: "0", label: "已停用" },
                        ]}
                    />
                    <Button
                        variant="outline"
                        disabled={loading}
                        onClick={() => void load()}
                    >
                        <RefreshCw />
                        刷新
                    </Button>
                </div>
            </Panel>
            {loading ? (
                <Panel>
                    <EmptyState>正在加载服务器…</EmptyState>
                </Panel>
            ) : filtered.length === 0 ? (
                <Panel>
                    <EmptyState>暂无符合条件的服务器</EmptyState>
                </Panel>
            ) : (
                <div className="machine-grid grid gap-4 lg:grid-cols-2">
                    {filtered.map((item) => {
                        const cpu = Number(item.load_status?.cpu || 0);
                        const memory = percent(
                            item.load_status?.mem?.used,
                            item.load_status?.mem?.total,
                        );
                        const disk = percent(
                            item.load_status?.disk?.used,
                            item.load_status?.disk?.total,
                        );
                        return (
                            <Panel key={item.id}>
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                            <Server className="size-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h2 className="truncate font-semibold">
                                                {item.name}
                                            </h2>
                                            <span className="text-xs text-muted-foreground">
                                                #{item.id} ·{" "}
                                                {item.servers_count || 0} 个节点
                                            </span>
                                        </div>
                                        <StatusBadge
                                            tone={
                                                isOnline(item)
                                                    ? "default"
                                                    : "neutral"
                                            }
                                        >
                                            {isOnline(item)
                                                ? "在线"
                                                : item.is_active
                                                  ? "离线"
                                                  : "已停用"}
                                        </StatusBadge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {item.notes || "暂无备注"}
                                    </p>
                                    <div className="load-grid grid gap-3 sm:grid-cols-3">
                                        {[
                                            ["CPU", cpu],
                                            ["内存", memory],
                                            ["磁盘", disk],
                                        ].map(([label, value]) => (
                                            <div key={String(label)}>
                                                <div className="mb-1 flex justify-between text-xs">
                                                    <span>{label}</span>
                                                    <b>
                                                        {Number(value).toFixed(
                                                            label === "CPU"
                                                                ? 1
                                                                : 0,
                                                        )}
                                                        %
                                                    </b>
                                                </div>
                                                <Progress
                                                    value={Number(value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                                        <span>
                                            最后心跳：
                                            {formatUnixTime(
                                                Number(item.last_seen_at),
                                                "从未连接",
                                            )}
                                        </span>
                                        {item.load_status?.net && (
                                            <span>
                                                ↓{" "}
                                                {speed(
                                                    item.load_status.net
                                                        .in_speed,
                                                )}
                                                　↑{" "}
                                                {speed(
                                                    item.load_status.net
                                                        .out_speed,
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                void openDetail(item)
                                            }
                                        >
                                            节点与负载
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                                busyId === Number(item.id)
                                            }
                                            onClick={() =>
                                                void showCredentials(item)
                                            }
                                        >
                                            <KeyRound />
                                            安装凭据
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => open(item)}
                                        >
                                            编辑
                                        </Button>
                                        <ConfirmAction
                                            title="删除服务器"
                                            description={`确定删除机器「${item.name}」？关联的 ${item.servers_count || 0} 个节点将自动解除绑定。`}
                                            confirmText="删除服务器"
                                            disabled={
                                                busyId === Number(item.id)
                                            }
                                            onConfirm={() => remove(item)}
                                        >
                                            删除
                                        </ConfirmAction>
                                    </div>
                                </div>
                            </Panel>
                        );
                    })}
                </div>
            )}
            <PageDialog
                open={showForm}
                onOpenChange={(openState) =>
                    openState ? setShowForm(true) : closeForm()
                }
                title={form.id ? "服务器配置" : "添加服务器"}
                description="机器代理连接面板后会自动上报负载与心跳。"
                className="sm:max-w-2xl"
                footer={
                    <>
                        {form.id && (
                            <ConfirmAction
                                title="重置机器 Token"
                                description="旧 Token 会立即失效，机器代理必须重新配置。"
                                confirmText="重置 Token"
                                disabled={saving}
                                onConfirm={resetToken}
                            >
                                重置 Token
                            </ConfirmAction>
                        )}
                        <Button disabled={saving} onClick={() => void save()}>
                            {saving
                                ? "保存中…"
                                : form.id
                                  ? "保存配置"
                                  : "创建服务器"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                服务器名称
                            </span>
                            <Input
                                value={form.name}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        name: event.target.value,
                                    })
                                }
                                placeholder="例如：香港入口机"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium">
                            <Switch
                                checked={form.is_active}
                                onCheckedChange={(is_active) =>
                                    setForm({ ...form, is_active })
                                }
                            />
                            {form.is_active ? "已启用" : "已停用"}
                        </label>
                        <div className="grid gap-2 sm:col-span-2">
                            <span className="text-sm font-medium">备注</span>
                            <Textarea
                                value={form.notes}
                                rows={3}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        notes: event.target.value,
                                    })
                                }
                                placeholder="机房、用途或维护说明"
                            />
                        </div>
                    </div>
                    {(credential.token || credential.command) && (
                        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                            <p className="text-sm">
                                Token 属于敏感凭据，请仅在受信任的服务器上使用。
                            </p>
                            {credential.token && (
                                <div>
                                    <span className="text-xs">机器 Token</span>
                                    <div className="mt-1 flex gap-2">
                                        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-background p-2 text-foreground">
                                            {credential.token}
                                        </code>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                void copy(
                                                    credential.token,
                                                    "Token",
                                                )
                                            }
                                        >
                                            <Copy />
                                            复制
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {credential.command && (
                                <div>
                                    <span className="text-xs">
                                        一键安装命令
                                    </span>
                                    <div className="mt-1 flex gap-2">
                                        <code className="min-w-0 flex-1 overflow-x-auto rounded bg-background p-2 text-foreground">
                                            {credential.command}
                                        </code>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                void copy(
                                                    credential.command,
                                                    "安装命令",
                                                )
                                            }
                                        >
                                            <Copy />
                                            复制
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </PageDialog>
            <PageDialog
                open={Boolean(detail)}
                onOpenChange={(openState) => !openState && setDetail(null)}
                title={`${detail?.name || "服务器"} · 运行详情`}
                description="最近 24 小时负载采样与当前关联节点。"
                className="sm:max-w-5xl"
            >
                {detailLoading ? (
                    <EmptyState>正在加载运行数据…</EmptyState>
                ) : (
                    <div className="space-y-5">
                        <div>
                            <h3 className="mb-2 font-medium">
                                关联节点（{nodes.length}）
                            </h3>
                            {nodes.length ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>节点</TableHead>
                                            <TableHead>地址</TableHead>
                                            <TableHead>类型</TableHead>
                                            <TableHead>状态</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {nodes.map((node) => (
                                            <TableRow key={node.id}>
                                                <TableCell className="font-medium">
                                                    {node.name}
                                                </TableCell>
                                                <TableCell>
                                                    <code>
                                                        {node.host}:{node.port}
                                                    </code>
                                                </TableCell>
                                                <TableCell>
                                                    {node.type}
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge
                                                        tone={
                                                            node.enabled
                                                                ? "default"
                                                                : "neutral"
                                                        }
                                                    >
                                                        {node.enabled
                                                            ? "已启用"
                                                            : "已停用"}
                                                    </StatusBadge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <EmptyState>暂无关联节点</EmptyState>
                            )}
                        </div>
                        <div>
                            <h3 className="mb-2 font-medium">
                                负载历史（{history.length} 条）
                            </h3>
                            {history.length ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>时间</TableHead>
                                            <TableHead>CPU</TableHead>
                                            <TableHead>内存</TableHead>
                                            <TableHead>磁盘</TableHead>
                                            <TableHead>网络</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {history
                                            .slice(-30)
                                            .reverse()
                                            .map((row) => (
                                                <TableRow key={row.recorded_at}>
                                                    <TableCell>
                                                        {formatUnixTime(
                                                            Number(
                                                                row.recorded_at,
                                                            ),
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {Number(
                                                            row.cpu,
                                                        ).toFixed(1)}
                                                        %
                                                    </TableCell>
                                                    <TableCell>
                                                        {percent(
                                                            row.mem_used,
                                                            row.mem_total,
                                                        )}
                                                        %
                                                    </TableCell>
                                                    <TableCell>
                                                        {percent(
                                                            row.disk_used,
                                                            row.disk_total,
                                                        )}
                                                        %
                                                    </TableCell>
                                                    <TableCell>
                                                        ↓{" "}
                                                        {speed(
                                                            row.net_in_speed,
                                                        )}{" "}
                                                        / ↑{" "}
                                                        {speed(
                                                            row.net_out_speed,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <EmptyState>暂无负载历史</EmptyState>
                            )}
                        </div>
                    </div>
                )}
            </PageDialog>
        </PageShell>
    );
}
