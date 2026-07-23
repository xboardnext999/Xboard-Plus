import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ChevronRight,
    Copy,
    Gauge,
    Info,
    Network,
    Plus,
    RefreshCw,
    ShieldCheck,
    Shuffle,
    Terminal,
    Waypoints,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    type SelectOption,
    type UnknownRecord,
} from "./react-page-helpers";

type EditableResource = "forwards" | "tunnels" | "nodes" | "limits" | "access";
type Resource = "dashboard" | EditableResource;
type FieldType =
    | "text"
    | "number"
    | "password"
    | "textarea"
    | "switch"
    | "nodes"
    | "tunnels"
    | "limits"
    | "users"
    | "strategy"
    | "type"
    | "protocol"
    | "billing";
interface FieldDefinition {
    key: string;
    label: string;
    type: FieldType;
}
interface ResourceConfig {
    title: string;
    description: string;
    columns: string[];
    defaults: UnknownRecord;
    fields: FieldDefinition[];
}

const CONFIGS: Record<EditableResource, ResourceConfig> = {
    forwards: {
        title: "转发规则",
        description: "管理 TCP/UDP 入口端口、目标地址、调度策略和所属用户。",
        columns: [
            "name",
            "user_id",
            "tunnel_id",
            "in_port",
            "remote_addr",
            "traffic",
            "enabled",
        ],
        defaults: {
            name: "",
            user_id: "",
            tunnel_id: "",
            in_port: "",
            out_port: "",
            remote_addr: "",
            strategy: "fifo",
            interface_name: "",
            sort: 0,
            enabled: true,
        },
        fields: (
            [
                ["name", "名称", "text"],
                ["user_id", "所属用户", "users"],
                ["tunnel_id", "所属隧道", "tunnels"],
                ["in_port", "入口端口", "number"],
                ["out_port", "出口端口", "number"],
                ["remote_addr", "目标地址", "textarea"],
                ["strategy", "调度策略", "strategy"],
                ["interface_name", "网卡名称", "text"],
                ["sort", "排序", "number"],
                ["enabled", "启用状态", "switch"],
            ] as Array<[string, string, FieldType]>
        ).map(([key, label, type]) => ({
            key,
            label,
            type: type as FieldType,
        })),
    },
    tunnels: {
        title: "隧道管理",
        description: "配置入口、出口节点，转发协议、计费方向和流量倍率。",
        columns: [
            "name",
            "nodes",
            "type",
            "protocol",
            "billing_mode",
            "traffic_ratio",
            "enabled",
        ],
        defaults: {
            name: "",
            in_node_id: "",
            out_node_id: "",
            in_ip: "",
            out_ip: "",
            type: 1,
            protocol: "tls",
            billing_mode: 2,
            traffic_ratio: 1,
            tcp_listen_addr: "[::]",
            udp_listen_addr: "[::]",
            interface_name: "",
            enabled: true,
        },
        fields: (
            [
                ["name", "隧道名称", "text"],
                ["in_node_id", "入口节点", "nodes"],
                ["out_node_id", "出口节点", "nodes"],
                ["in_ip", "入口 IP", "text"],
                ["out_ip", "出口 IP", "text"],
                ["type", "转发模式", "type"],
                ["protocol", "传输协议", "protocol"],
                ["billing_mode", "计费方式", "billing"],
                ["traffic_ratio", "流量倍率", "number"],
                ["tcp_listen_addr", "TCP 监听地址", "text"],
                ["udp_listen_addr", "UDP 监听地址", "text"],
                ["interface_name", "网卡名称", "text"],
                ["enabled", "启用状态", "switch"],
            ] as Array<[string, string, FieldType]>
        ).map(([key, label, type]) => ({
            key,
            label,
            type: type as FieldType,
        })),
    },
    nodes: {
        title: "转发节点",
        description: "管理转发节点凭据、端口范围、协议能力和心跳状态。",
        columns: [
            "name",
            "server_ip",
            "ports",
            "protocols",
            "version",
            "online",
            "enabled",
        ],
        defaults: {
            name: "",
            secret: "",
            ip: "",
            server_ip: "",
            port_start: 10000,
            port_end: 60000,
            version: "",
            allow_http: false,
            allow_tls: true,
            allow_socks: false,
            enabled: true,
        },
        fields: (
            [
                ["name", "节点名称", "text"],
                ["server_ip", "服务地址", "text"],
                ["ip", "附加 IP", "textarea"],
                ["secret", "节点密钥", "password"],
                ["port_start", "起始端口", "number"],
                ["port_end", "结束端口", "number"],
                ["version", "版本", "text"],
                ["allow_http", "允许 HTTP", "switch"],
                ["allow_tls", "允许 TLS", "switch"],
                ["allow_socks", "允许 SOCKS", "switch"],
                ["enabled", "启用状态", "switch"],
            ] as Array<[string, string, FieldType]>
        ).map(([key, label, type]) => ({
            key,
            label,
            type: type as FieldType,
        })),
    },
    limits: {
        title: "限速策略",
        description: "按隧道创建可复用的带宽限制，并在用户授权中分配。",
        columns: ["name", "tunnel_id", "speed_mbps", "enabled"],
        defaults: { name: "", tunnel_id: "", speed_mbps: 100, enabled: true },
        fields: (
            [
                ["name", "策略名称", "text"],
                ["tunnel_id", "所属隧道", "tunnels"],
                ["speed_mbps", "速度（Mbps）", "number"],
                ["enabled", "启用状态", "switch"],
            ] as Array<[string, string, FieldType]>
        ).map(([key, label, type]) => ({
            key,
            label,
            type: type as FieldType,
        })),
    },
    access: {
        title: "用户授权",
        description:
            "直接关联 Plus 用户，配置可用隧道、转发数量、流量和有效期。",
        columns: [
            "user_id",
            "tunnel_id",
            "speed_limit_id",
            "forward_limit",
            "traffic_limit",
            "expires_at",
            "enabled",
        ],
        defaults: {
            user_id: "",
            tunnel_id: "",
            speed_limit_id: "",
            forward_limit: 1,
            traffic_limit: 0,
            reset_at: "",
            expires_at: "",
            enabled: true,
        },
        fields: (
            [
                ["user_id", "Plus 用户", "users"],
                ["tunnel_id", "授权隧道", "tunnels"],
                ["speed_limit_id", "限速策略", "limits"],
                ["forward_limit", "转发数量", "number"],
                ["traffic_limit", "流量额度（字节，0 不限制）", "number"],
                ["reset_at", "下次重置时间戳", "number"],
                ["expires_at", "到期时间戳", "number"],
                ["enabled", "授权状态", "switch"],
            ] as Array<[string, string, FieldType]>
        ).map(([key, label, type]) => ({
            key,
            label,
            type: type as FieldType,
        })),
    },
};

const MODULES = [
    {
        resource: "forwards",
        title: "转发规则",
        description: "入口端口与目标调度",
        icon: Shuffle,
    },
    {
        resource: "tunnels",
        title: "隧道管理",
        description: "入口和出口链路编排",
        icon: Waypoints,
    },
    {
        resource: "nodes",
        title: "转发节点",
        description: "Agent 状态与协议能力",
        icon: Network,
    },
    {
        resource: "limits",
        title: "限速策略",
        description: "可复用的带宽控制",
        icon: Gauge,
    },
    {
        resource: "access",
        title: "用户授权",
        description: "用户配额与有效期",
        icon: ShieldCheck,
    },
] as const;
const INSTALL_SCRIPT =
    "https://github.com/xboardnext999/Xboard-Plus/releases/download/1.0.0/install.sh";
function shellArgument(value: unknown) {
    return `'${String(value ?? "").replaceAll("'", `'"'"'`)}'`;
}
function normalizeResource(value: string | undefined): Resource {
    return value && value in CONFIGS
        ? (value as EditableResource)
        : "dashboard";
}
function columnName(key: string) {
    return (
        (
            {
                name: "名称",
                user_id: "用户",
                tunnel_id: "隧道",
                in_port: "入口端口",
                remote_addr: "目标地址",
                traffic: "累计流量",
                enabled: "状态",
                nodes: "节点链路",
                type: "模式",
                protocol: "协议",
                billing_mode: "计费",
                traffic_ratio: "倍率",
                server_ip: "服务地址",
                ports: "端口范围",
                protocols: "协议能力",
                version: "版本",
                online: "心跳",
                speed_mbps: "速度",
                speed_limit_id: "限速",
                forward_limit: "转发数",
                traffic_limit: "流量额度",
                expires_at: "到期时间",
            } as Record<string, string>
        )[key] || key
    );
}

export default function FluxManagement() {
    const params = useParams<{ resource?: string }>();
    const resource = normalizeResource(params.resource);
    const config = resource === "dashboard" ? null : CONFIGS[resource];
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<UnknownRecord[]>([]);
    const [options, setOptions] = useState<{
        nodes: UnknownRecord[];
        tunnels: UnknownRecord[];
        limits: UnknownRecord[];
        users: UnknownRecord[];
    }>({ nodes: [], tunnels: [], limits: [], users: [] });
    const [summary, setSummary] = useState<UnknownRecord>({
        counts: {},
        online_nodes: 0,
        traffic: 0,
    });
    const [keyword, setKeyword] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState<UnknownRecord>({});
    const [page, setPage] = useState({ current: 1, last: 1, total: 0 });
    const [deleteTarget, setDeleteTarget] = useState<UnknownRecord | null>(
        null,
    );
    const [installNode, setInstallNode] = useState<UnknownRecord | null>(null);

    const maps = useMemo(
        () => ({
            nodes: Object.fromEntries(
                options.nodes.map((item) => [item.id, item.name]),
            ),
            tunnels: Object.fromEntries(
                options.tunnels.map((item) => [item.id, item.name]),
            ),
            users: Object.fromEntries(
                options.users.map((item) => [item.id, item.email]),
            ),
            limits: Object.fromEntries(
                options.limits.map((item) => [item.id, item.name]),
            ),
        }),
        [options],
    );
    const loadOptions = useCallback(async () => {
        const data = (await get("/forwarding/options")) as UnknownRecord;
        setOptions({
            nodes: Array.isArray(data.nodes) ? data.nodes : [],
            tunnels: Array.isArray(data.tunnels) ? data.tunnels : [],
            limits: Array.isArray(data.limits) ? data.limits : [],
            users: Array.isArray(data.users) ? data.users : [],
        });
    }, []);
    const load = useCallback(
        async (requestedPage = page.current, search = keyword) => {
            setLoading(true);
            try {
                if (resource === "dashboard") {
                    const [summaryData] = await Promise.all([
                        get("/forwarding/summary"),
                        loadOptions(),
                    ]);
                    setSummary(summaryData as UnknownRecord);
                    setRows([]);
                    return;
                }
                const data = (await get(`/forwarding/${resource}`, {
                    keyword: search,
                    page: requestedPage,
                    page_size: 30,
                })) as UnknownRecord;
                setRows(Array.isArray(data.data) ? data.data : []);
                setPage({
                    current: Number(data.current_page || requestedPage),
                    total: Number(data.total || 0),
                    last: Number(data.last_page || 1),
                });
                await loadOptions();
            } catch (error) {
                toast.error(errorMessage(error));
            } finally {
                setLoading(false);
            }
        },
        [keyword, loadOptions, page.current, resource],
    );
    useEffect(() => {
        setPage({ current: 1, last: 1, total: 0 });
        setKeyword("");
        setShowForm(false);
        void load(1, "");
    }, [resource]); // eslint-disable-line react-hooks/exhaustive-deps

    const label = (row: UnknownRecord, key: string) => {
        if (key === "user_id")
            return maps.users[row.user_id] || `用户 #${row.user_id}`;
        if (key === "tunnel_id")
            return maps.tunnels[row.tunnel_id] || `隧道 #${row.tunnel_id}`;
        if (key === "speed_limit_id")
            return row.speed_limit_id
                ? maps.limits[row.speed_limit_id] ||
                      `策略 #${row.speed_limit_id}`
                : "不限速";
        if (key === "nodes")
            return `${maps.nodes[row.in_node_id] || `#${row.in_node_id}`} → ${maps.nodes[row.out_node_id] || `#${row.out_node_id}`}`;
        if (key === "ports") return `${row.port_start}–${row.port_end}`;
        if (key === "protocols")
            return (
                [
                    ["HTTP", row.allow_http],
                    ["TLS", row.allow_tls],
                    ["SOCKS", row.allow_socks],
                ]
                    .filter((item) => item[1])
                    .map((item) => item[0])
                    .join(" / ") || "—"
            );
        if (key === "online")
            return Number(row.last_seen_at) >= Date.now() / 1000 - 180
                ? "在线"
                : "离线";
        if (key === "type")
            return Number(row.type) === 1 ? "端口转发" : "隧道转发";
        if (key === "billing_mode")
            return Number(row.billing_mode) === 1 ? "单向" : "双向";
        if (key === "traffic")
            return formatBytes(
                Number(row.upload_bytes || 0) + Number(row.download_bytes || 0),
            );
        if (key === "traffic_limit")
            return Number(row.traffic_limit)
                ? formatBytes(row.traffic_limit)
                : "不限";
        if (key === "enabled") return row.enabled ? "已启用" : "已停用";
        return row[key] ?? "—";
    };
    const open = (row?: UnknownRecord) => {
        if (!config) return;
        setForm({ ...config.defaults, ...(row || {}) });
        setShowForm(true);
    };
    const save = async () => {
        if (!config || resource === "dashboard") return;
        setSaving(true);
        try {
            const result = (await post(
                `/forwarding/${resource}/save`,
                form,
            )) as UnknownRecord;
            toast.success(form.id ? "配置已更新" : "配置已创建");
            setShowForm(false);
            if (resource === "nodes") {
                const node = result?.data || { ...form, id: result?.id };
                if (node?.secret) setInstallNode(node);
            }
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const remove = async () => {
        if (!deleteTarget || resource === "dashboard") return;
        setSaving(true);
        try {
            await post(`/forwarding/${resource}/drop`, { id: deleteTarget.id });
            toast.success("已删除");
            setDeleteTarget(null);
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const installCommand = (node: UnknownRecord | null) =>
        node?.secret
            ? `curl -L ${INSTALL_SCRIPT} -o ./install.sh && chmod +x ./install.sh && ./install.sh -a ${shellArgument(window.location.host)} -s ${shellArgument(node.secret)}`
            : "";
    const copy = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label}已复制`);
        } catch {
            toast.error("复制失败，请手动复制");
        }
    };
    const selectOptions = (type: FieldType): SelectOption[] => {
        if (type === "strategy")
            return [
                { value: "fifo", label: "顺序" },
                { value: "round", label: "轮询" },
                { value: "random", label: "随机" },
                { value: "hash", label: "哈希" },
            ];
        if (type === "type")
            return [
                { value: 1, label: "端口转发" },
                { value: 2, label: "隧道转发" },
            ];
        if (type === "protocol")
            return ["tcp", "udp", "tls", "ws", "wss"].map((value) => ({
                value,
                label: value.toUpperCase(),
            }));
        if (type === "billing")
            return [
                { value: 1, label: "单向计费" },
                { value: 2, label: "双向计费" },
            ];
        if (type === "nodes")
            return [
                { value: "", label: "请选择节点" },
                ...options.nodes.map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.server_ip}`,
                })),
            ];
        if (type === "tunnels")
            return [
                { value: "", label: "请选择隧道" },
                ...options.tunnels.map((item) => ({
                    value: item.id,
                    label: item.name,
                })),
            ];
        if (type === "users")
            return [
                { value: "", label: "请选择用户" },
                ...options.users.map((item) => ({
                    value: item.id,
                    label: item.email,
                })),
            ];
        if (type === "limits")
            return [
                { value: "", label: "不限制" },
                ...options.limits.map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.speed_mbps} Mbps`,
                })),
            ];
        return [];
    };

    return (
        <PageShell className="flux-page">
            <PageHeader
                title={
                    resource === "dashboard"
                        ? "转发概览"
                        : config?.title || "流量转发"
                }
                description={
                    resource === "dashboard"
                        ? "集中查看转发服务、节点心跳、隧道授权与流量运行情况。"
                        : config?.description || ""
                }
                action={
                    resource !== "dashboard" ? (
                        <Button onClick={() => open()}>
                            <Plus />
                            新建
                            {config?.title
                                .replace("管理", "")
                                .replace("规则", "")}
                        </Button>
                    ) : undefined
                }
            />
            {resource === "dashboard" ? (
                <Dashboard summary={summary} loading={loading} />
            ) : (
                <>
                    <Panel>
                        <div className="flux-toolbar flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="grid flex-1 gap-2">
                                <span className="text-sm font-medium">
                                    搜索
                                </span>
                                <Input
                                    value={keyword}
                                    onChange={(event) =>
                                        setKeyword(event.target.value)
                                    }
                                    placeholder="输入名称、地址或目标"
                                    onKeyDown={(event) =>
                                        event.key === "Enter" && void load(1)
                                    }
                                />
                            </div>
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
                    <Panel className="table-wrap flux-table p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {config?.columns.map((column) => (
                                        <TableHead key={column}>
                                            {columnName(column)}
                                        </TableHead>
                                    ))}
                                    <TableHead className="text-right">
                                        操作
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={
                                                (config?.columns.length || 0) +
                                                1
                                            }
                                        >
                                            <EmptyState>正在加载…</EmptyState>
                                        </TableCell>
                                    </TableRow>
                                ) : rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={
                                                (config?.columns.length || 0) +
                                                1
                                            }
                                        >
                                            <EmptyState>
                                                暂无配置，点击右上角新建
                                            </EmptyState>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row) => (
                                        <TableRow key={row.id}>
                                            {config?.columns.map((column) => (
                                                <TableCell key={column}>
                                                    {[
                                                        "enabled",
                                                        "online",
                                                    ].includes(column) ? (
                                                        <StatusBadge
                                                            tone={
                                                                String(
                                                                    label(
                                                                        row,
                                                                        column,
                                                                    ),
                                                                ).includes(
                                                                    "停用",
                                                                ) ||
                                                                label(
                                                                    row,
                                                                    column,
                                                                ) === "离线"
                                                                    ? "neutral"
                                                                    : "default"
                                                            }
                                                        >
                                                            {label(row, column)}
                                                        </StatusBadge>
                                                    ) : (
                                                        <span className="whitespace-pre-wrap">
                                                            {String(
                                                                label(
                                                                    row,
                                                                    column,
                                                                ),
                                                            )}
                                                        </span>
                                                    )}
                                                </TableCell>
                                            ))}
                                            <TableCell>
                                                <div className="flex justify-end gap-2">
                                                    {resource === "nodes" &&
                                                        row.secret && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    setInstallNode(
                                                                        row,
                                                                    )
                                                                }
                                                            >
                                                                <Terminal />
                                                                安装
                                                            </Button>
                                                        )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            open(row)
                                                        }
                                                    >
                                                        编辑
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() =>
                                                            setDeleteTarget(row)
                                                        }
                                                    >
                                                        删除
                                                    </Button>
                                                </div>
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
                        onChange={(current) => void load(current)}
                    />
                </>
            )}

            <PageDialog
                open={showForm}
                onOpenChange={setShowForm}
                title={`${form.id ? "编辑" : "新建"}${config?.title || "配置"}`}
                description={config?.description}
                className="sm:max-w-3xl"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowForm(false)}
                        >
                            取消
                        </Button>
                        <Button disabled={saving} onClick={() => void save()}>
                            {saving ? "保存中…" : "保存配置"}
                        </Button>
                    </>
                }
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {config?.fields.map((field) => (
                        <FluxField
                            key={field.key}
                            field={field}
                            value={form[field.key]}
                            options={selectOptions(field.type)}
                            onChange={(value) =>
                                setForm({ ...form, [field.key]: value })
                            }
                        />
                    ))}
                    {resource === "nodes" && (
                        <div className="sm:col-span-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                            <strong className="block text-foreground">
                                节点安装说明
                            </strong>
                            节点密钥留空时，后端会在保存时自动生成；保存后将显示可复制的一键安装命令。
                        </div>
                    )}
                </div>
            </PageDialog>
            <PageDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(openState) =>
                    !openState && setDeleteTarget(null)
                }
                title="删除配置"
                description={`确定删除「${deleteTarget?.name || `#${deleteTarget?.id || ""}`}」？关联数据可能同时失效。`}
                className="sm:max-w-md"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
                        >
                            取消
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={saving}
                            onClick={() => void remove()}
                        >
                            {saving ? "删除中…" : "确认删除"}
                        </Button>
                    </>
                }
            >
                <div />
            </PageDialog>
            <PageDialog
                open={Boolean(installNode)}
                onOpenChange={(openState) => !openState && setInstallNode(null)}
                title={`${installNode?.name || "转发节点"} · 安装命令`}
                description="命令包含节点密钥，请仅在目标服务器的可信终端中执行。"
                className="sm:max-w-2xl"
                footer={
                    <Button
                        onClick={() =>
                            void copy(installCommand(installNode), "安装命令")
                        }
                    >
                        <Copy />
                        复制安装命令
                    </Button>
                }
            >
                <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border p-3">
                            <small className="text-muted-foreground">
                                面板通信地址
                            </small>
                            <code className="mt-1 block break-all">
                                {window.location.host}
                            </code>
                        </div>
                        <div className="rounded-lg border p-3">
                            <small className="text-muted-foreground">
                                节点密钥
                            </small>
                            <code className="mt-1 block break-all">
                                {installNode?.secret || "—"}
                            </code>
                        </div>
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-4 text-xs">
                        {installCommand(installNode)}
                    </pre>
                </div>
            </PageDialog>
        </PageShell>
    );
}

function Dashboard({
    summary,
    loading,
}: {
    summary: UnknownRecord;
    loading: boolean;
}) {
    if (loading)
        return (
            <Panel>
                <EmptyState>正在加载转发概览…</EmptyState>
            </Panel>
        );
    return (
        <>
            <MetricGrid>
                <MetricCard
                    label="转发规则"
                    value={summary.counts?.forwards || 0}
                />
                <MetricCard label="隧道" value={summary.counts?.tunnels || 0} />
                <MetricCard
                    label="在线节点"
                    value={`${summary.online_nodes || 0} / ${summary.counts?.nodes || 0}`}
                />
                <MetricCard
                    label="累计流量"
                    value={formatBytes(summary.traffic)}
                />
            </MetricGrid>
            <div className="flux-module-grid grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {MODULES.map((module) => {
                    const Icon = module.icon;
                    return (
                        <Link
                            key={module.resource}
                            to={`/forwarding/${module.resource}`}
                        >
                            <Card className="flux-module h-full transition-colors hover:bg-muted/30">
                                <CardContent className="flex items-center gap-3">
                                    <span className="rounded-lg bg-primary/10 p-2 text-primary">
                                        <Icon className="size-5" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="font-semibold">
                                            {module.title}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            {module.description}
                                        </p>
                                    </div>
                                    <strong className="text-xl">
                                        {summary.counts?.[module.resource] || 0}
                                    </strong>
                                    <ChevronRight className="size-4 text-muted-foreground" />
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
            <Panel className="flux-guide">
                <div className="flex gap-3">
                    <Info className="size-5 shrink-0 text-primary" />
                    <div>
                        <strong>原生集成模式</strong>
                        <p className="mt-1 text-sm text-muted-foreground">
                            转发数据与 Plus
                            用户、后台权限和审计体系统一；节点使用独立密钥通信，不再需要第二套管理员账号。
                        </p>
                    </div>
                </div>
            </Panel>
        </>
    );
}

function FluxField({
    field,
    value,
    options,
    onChange,
}: {
    field: FieldDefinition;
    value: unknown;
    options: SelectOption[];
    onChange: (value: unknown) => void;
}) {
    if (field.type === "switch")
        return (
            <label className="flex items-center gap-3 rounded-lg border p-3">
                <Switch checked={Boolean(value)} onCheckedChange={onChange} />
                <span className="text-sm">
                    <strong className="block">{field.label}</strong>
                    <small className="text-muted-foreground">
                        {value ? "已启用" : "已停用"}
                    </small>
                </span>
            </label>
        );
    if (field.type === "textarea")
        return (
            <div className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium">{field.label}</span>
                <Textarea
                    value={String(value ?? "")}
                    rows={3}
                    onChange={(event) => onChange(event.target.value)}
                />
            </div>
        );
    if (options.length > 0)
        return (
            <SelectField
                label={field.label}
                value={value as string | number | null | undefined}
                onValueChange={(next) =>
                    onChange(
                        ["type", "billing"].includes(field.type) && next !== ""
                            ? Number(next)
                            : next,
                    )
                }
                options={options}
            />
        );
    return (
        <div className="grid gap-2">
            <span className="text-sm font-medium">{field.label}</span>
            <Input
                value={String(value ?? "")}
                type={
                    field.type === "password"
                        ? "password"
                        : field.type === "number"
                          ? "number"
                          : "text"
                }
                min={field.type === "number" ? 0 : undefined}
                onChange={(event) =>
                    onChange(
                        field.type === "number"
                            ? event.target.value === ""
                                ? ""
                                : Number(event.target.value)
                            : event.target.value,
                    )
                }
            />
        </div>
    );
}
