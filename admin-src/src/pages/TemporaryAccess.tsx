import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    type UnknownRecord,
} from "./react-page-helpers";

const PERMISSIONS = [
    ["仪表盘", "/dashboard", "概览"],
    ["系统配置", "/system/config", "系统管理"],
    ["操作审计", "/system/audit", "系统管理"],
    ["备份管理", "/system/backup", "系统管理"],
    ["插件管理", "/system/plugin", "系统管理"],
    ["主题配置", "/system/theme", "系统管理"],
    ["公告管理", "/system/notice", "系统管理"],
    ["支付配置", "/system/payment", "系统管理"],
    ["知识库管理", "/system/knowledge", "系统管理"],
    ["服务器管理", "/node/server", "节点管理"],
    ["节点管理", "/node/list", "节点管理"],
    ["权限组管理", "/node/group", "节点管理"],
    ["路由管理", "/node/route", "节点管理"],
    ["节点数据分析", "/node/diagnostic", "节点管理"],
    ["套餐管理", "/subscription/plan", "订阅管理"],
    ["拼团管理", "/finance/plan", "订阅管理"],
    ["订单管理", "/subscription/order", "订阅管理"],
    ["优惠券管理", "/subscription/coupon", "订阅管理"],
    ["礼品卡管理", "/subscription/gift-card", "订阅管理"],
    ["用户管理", "/user/list", "用户管理"],
    ["工单管理", "/user/ticket", "用户管理"],
    ["流量重置日志", "/user/traffic-reset-log", "用户管理"],
    ["商品管理", "/digital/products", "数字商品"],
    ["库存管理", "/digital/inventory", "数字商品"],
    ["订单记录", "/digital/orders", "数字商品"],
    ["交付记录", "/digital/delivery", "数字商品"],
    ["转发概览", "/forwarding/dashboard", "流量转发"],
    ["转发套餐", "/forwarding/plans", "流量转发"],
    ["转发规则", "/forwarding/forwards", "流量转发"],
    ["隧道管理", "/forwarding/tunnels", "流量转发"],
    ["转发节点", "/forwarding/nodes", "流量转发"],
    ["限速策略", "/forwarding/limits", "流量转发"],
    ["用户授权", "/forwarding/access", "流量转发"],
] as const;

type AccessForm = {
    id: number | null;
    email: string;
    password: string;
    expires_at: string;
    max_logins: number;
    active: boolean;
    allowed_ips_text: string;
    permissions: Record<string, string>;
};
const blank = (): AccessForm => ({
    id: null,
    email: "",
    password: "",
    expires_at: new Date(Date.now() + 2 * 3600000).toISOString().slice(0, 16),
    max_logins: 10,
    active: true,
    allowed_ips_text: "",
    permissions: { "/dashboard": "read" },
});
const formatDate = (value: unknown) => {
    if (!value) return "—";
    const date = new Date(
        typeof value === "number" ? value * 1000 : String(value),
    );
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString("zh-CN", { hour12: false });
};
const usable = (row: UnknownRecord) =>
    Boolean(row.active) &&
    new Date(row.expires_at).getTime() > Date.now() &&
    Number(row.login_count) <= Number(row.max_logins);

export default function TemporaryAccess() {
    const [rows, setRows] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [generated, setGenerated] = useState("");
    const [form, setForm] = useState<AccessForm>(blank());
    const stats = useMemo(
        () => ({
            total: rows.length,
            usable: rows.filter(usable).length,
            unavailable: rows.filter((row) => !usable(row)).length,
        }),
        [rows],
    );
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await get("/temporary-access/fetch");
            setRows(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const open = (row?: UnknownRecord) => {
        setGenerated("");
        if (row)
            setForm({
                id: Number(row.id),
                email: String(row.user?.email || ""),
                password: "",
                expires_at: new Date(row.expires_at).toISOString().slice(0, 16),
                max_logins: Number(row.max_logins || 10),
                active: Boolean(row.active),
                allowed_ips_text: (row.allowed_ips || []).join("\n"),
                permissions: { ...(row.permissions || {}) },
            });
        else setForm(blank());
        setShowForm(true);
    };
    const save = async () => {
        setSaving(true);
        try {
            const data = (await post("/temporary-access/save", {
                id: form.id,
                email: form.email,
                password: form.password || null,
                expires_at: new Date(form.expires_at).toISOString(),
                max_logins: Number(form.max_logins),
                active: form.active,
                allowed_ips: form.allowed_ips_text
                    .split(/\s+/)
                    .map((value) => value.trim())
                    .filter(Boolean),
                permissions: form.permissions,
            })) as UnknownRecord;
            setGenerated(String(data.generated_password || ""));
            toast.success("临时访问已保存");
            await load();
            if (!data.generated_password) setShowForm(false);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const revoke = async (row: UnknownRecord) => {
        try {
            await post("/temporary-access/revoke", { id: row.id });
            toast.success("已撤销");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };
    const remove = async (row: UnknownRecord) => {
        try {
            await post("/temporary-access/drop", { id: row.id });
            toast.success("已删除");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };
    const togglePermission = (path: string, checked: boolean) => {
        const permissions = { ...form.permissions };
        if (checked) permissions[path] = "read";
        else delete permissions[path];
        setForm({ ...form, permissions });
    };
    const copyPassword = async () => {
        try {
            await navigator.clipboard.writeText(generated);
            toast.success("初始密码已复制");
        } catch {
            toast.error("复制失败，请手动复制");
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="临时访问"
                description="为运维人员创建限时账号，并按页面分配只读或管理权限。"
                action={
                    <Button onClick={() => open()}>
                        <Plus />
                        创建临时账号
                    </Button>
                }
            />
            <MetricGrid>
                <MetricCard label="账号总数" value={stats.total} />
                <MetricCard label="当前有效" value={stats.usable} />
                <MetricCard label="已过期/撤销" value={stats.unavailable} />
            </MetricGrid>
            <Panel className="table-wrap p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>账号</TableHead>
                            <TableHead>有效期</TableHead>
                            <TableHead>登录次数</TableHead>
                            <TableHead>IP 限制</TableHead>
                            <TableHead>页面权限</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <EmptyState>正在加载…</EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <EmptyState>暂无临时账号</EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        <strong className="block">
                                            {row.user?.email}
                                        </strong>
                                        <small className="text-muted-foreground">
                                            创建人：{row.creator?.email || "—"}
                                        </small>
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(row.expires_at)}
                                    </TableCell>
                                    <TableCell>
                                        {row.login_count} / {row.max_logins}
                                    </TableCell>
                                    <TableCell className="max-w-48 truncate">
                                        {row.allowed_ips?.length
                                            ? row.allowed_ips.join("、")
                                            : "不限 IP"}
                                    </TableCell>
                                    <TableCell>
                                        {
                                            Object.keys(row.permissions || {})
                                                .length
                                        }{" "}
                                        个页面
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge
                                            tone={
                                                usable(row)
                                                    ? "default"
                                                    : "neutral"
                                            }
                                        >
                                            {usable(row) ? "有效" : "不可用"}
                                        </StatusBadge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => open(row)}
                                            >
                                                编辑
                                            </Button>
                                            <ConfirmAction
                                                destructive={false}
                                                variant="outline"
                                                title="撤销临时访问"
                                                description={`立即撤销 ${row.user?.email} 的全部会话？`}
                                                confirmText="立即撤销"
                                                onConfirm={() => revoke(row)}
                                            >
                                                撤销
                                            </ConfirmAction>
                                            <ConfirmAction
                                                title="删除临时账号"
                                                description={`删除 ${row.user?.email} 及其访问记录关联？`}
                                                confirmText="删除账号"
                                                onConfirm={() => remove(row)}
                                            >
                                                删除
                                            </ConfirmAction>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Panel>
            <PageDialog
                open={showForm}
                onOpenChange={setShowForm}
                title={form.id ? "编辑临时访问" : "创建临时访问"}
                description="留空密码将自动生成；保存后仅显示一次。"
                className="sm:max-w-4xl"
            >
                {generated ? (
                    <div className="space-y-3 rounded-lg bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                        <strong className="block">请立即保存初始密码</strong>
                        <div className="flex gap-2">
                            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-background p-2 text-foreground">
                                {generated}
                            </code>
                            <Button
                                variant="outline"
                                onClick={() => void copyPassword()}
                            >
                                <Copy />
                                复制
                            </Button>
                        </div>
                        <small>关闭窗口后将无法再次查看。</small>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <span className="text-sm font-medium">
                                    登录邮箱
                                </span>
                                <Input
                                    value={form.email}
                                    type="email"
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            email: event.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <span className="text-sm font-medium">
                                    {form.id ? "重置密码" : "初始密码"}
                                </span>
                                <Input
                                    value={form.password}
                                    type="password"
                                    minLength={12}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            password: event.target.value,
                                        })
                                    }
                                    placeholder="留空自动生成"
                                />
                            </div>
                            <div className="grid gap-2">
                                <span className="text-sm font-medium">
                                    到期时间
                                </span>
                                <Input
                                    value={form.expires_at}
                                    type="datetime-local"
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            expires_at: event.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <span className="text-sm font-medium">
                                    最大登录次数
                                </span>
                                <Input
                                    value={form.max_logins}
                                    type="number"
                                    min={1}
                                    max={1000}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            max_logins: Number(
                                                event.target.value,
                                            ),
                                        })
                                    }
                                />
                            </div>
                            <label className="flex items-center gap-2 text-sm font-medium">
                                <Switch
                                    checked={form.active}
                                    onCheckedChange={(active) =>
                                        setForm({ ...form, active })
                                    }
                                />
                                {form.active ? "账号已启用" : "账号已停用"}
                            </label>
                            <div className="grid gap-2 sm:col-span-2">
                                <span className="text-sm font-medium">
                                    允许 IP
                                </span>
                                <Textarea
                                    value={form.allowed_ips_text}
                                    rows={3}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            allowed_ips_text:
                                                event.target.value,
                                        })
                                    }
                                    placeholder="每行一个；留空不限制"
                                />
                            </div>
                        </div>
                        <div>
                            <h3 className="mb-3 font-medium">页面权限</h3>
                            <div className="permission-grid grid max-h-[40vh] gap-2 overflow-y-auto sm:grid-cols-2">
                                {PERMISSIONS.map(([title, path, group]) => {
                                    const enabled = Boolean(
                                        form.permissions[path],
                                    );
                                    return (
                                        <div
                                            key={path}
                                            className="grid grid-cols-[auto_1fr_8rem] items-center gap-2 rounded-lg border p-3"
                                        >
                                            <Checkbox
                                                checked={enabled}
                                                onCheckedChange={(checked) =>
                                                    togglePermission(
                                                        path,
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            <div>
                                                <strong className="block text-sm">
                                                    {title}
                                                </strong>
                                                <small className="text-muted-foreground">
                                                    {group}
                                                </small>
                                            </div>
                                            {enabled ? (
                                                <SelectField
                                                    label={
                                                        <span className="sr-only">
                                                            {title}权限
                                                        </span>
                                                    }
                                                    value={
                                                        form.permissions[path]
                                                    }
                                                    onValueChange={(value) =>
                                                        setForm({
                                                            ...form,
                                                            permissions: {
                                                                ...form.permissions,
                                                                [path]: value,
                                                            },
                                                        })
                                                    }
                                                    options={[
                                                        {
                                                            value: "read",
                                                            label: "只读",
                                                        },
                                                        {
                                                            value: "write",
                                                            label: "可管理",
                                                        },
                                                    ]}
                                                />
                                            ) : (
                                                <span />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                disabled={
                                    saving ||
                                    !form.email ||
                                    Object.keys(form.permissions).length === 0
                                }
                                onClick={() => void save()}
                            >
                                {saving ? "保存中…" : "保存临时访问"}
                            </Button>
                        </div>
                    </div>
                )}
            </PageDialog>
        </PageShell>
    );
}
