import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

const PERIODS = [
    ["monthly", "月付"],
    ["quarterly", "季付"],
    ["half_yearly", "半年付"],
    ["yearly", "年付"],
    ["onetime", "一次性"],
] as const;
type ForwardingForm = {
    id: number | null;
    name: string;
    content: string;
    transfer_enable: number;
    prices: Record<string, number | string>;
    show: boolean;
    sell: boolean;
    renew: boolean;
    capacity_limit: number | null;
    product_type: string;
    product_config: {
        tunnel_id: string | number;
        speed_limit_id: string | number;
        forward_limit: number;
        traffic_limit_gb: number;
    };
};
const blank = (): ForwardingForm => ({
    id: null,
    name: "",
    content: "",
    transfer_enable: 100,
    prices: {},
    show: true,
    sell: true,
    renew: true,
    capacity_limit: null,
    product_type: "forwarding",
    product_config: {
        tunnel_id: "",
        speed_limit_id: "",
        forward_limit: 1,
        traffic_limit_gb: 100,
    },
});

export default function ForwardingPlanManagement() {
    const [rows, setRows] = useState<UnknownRecord[]>([]);
    const [options, setOptions] = useState<{
        tunnels: UnknownRecord[];
        limits: UnknownRecord[];
    }>({ tunnels: [], limits: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [form, setForm] = useState<ForwardingForm>(blank());
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [plans, forwarding] = await Promise.all([
                get("/plan/fetch?product_type=forwarding"),
                get("/forwarding/options"),
            ]);
            setRows(Array.isArray(plans) ? plans : []);
            const source = forwarding as UnknownRecord;
            setOptions({
                tunnels: Array.isArray(source?.tunnels) ? source.tunnels : [],
                limits: Array.isArray(source?.limits) ? source.limits : [],
            });
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
            rows.filter(
                (row) =>
                    !keyword.trim() ||
                    `${row.name} ${row.content || ""}`
                        .toLowerCase()
                        .includes(keyword.trim().toLowerCase()),
            ),
        [keyword, rows],
    );
    const tunnelName = (id: unknown) =>
        options.tunnels.find((item) => Number(item.id) === Number(id))?.name ||
        `隧道 #${id}`;
    const limitName = (id: unknown) =>
        options.limits.find((item) => Number(item.id) === Number(id))?.name ||
        "不限速";
    const close = () => {
        setShowForm(false);
        setForm(blank());
    };
    const open = (row?: UnknownRecord) => {
        if (!row) setForm(blank());
        else
            setForm({
                ...blank(),
                ...row,
                id: Number(row.id),
                name: String(row.name || ""),
                content: String(row.content || ""),
                transfer_enable: Number(row.transfer_enable || 100),
                prices: { ...(row.prices || {}) },
                show: Boolean(row.show),
                sell: Boolean(row.sell),
                renew: Boolean(row.renew),
                capacity_limit:
                    row.capacity_limit == null
                        ? null
                        : Number(row.capacity_limit),
                product_type: "forwarding",
                product_config: {
                    ...blank().product_config,
                    ...(row.product_config || {}),
                },
            });
        setShowForm(true);
    };
    const save = async () => {
        const prices = Object.fromEntries(
            Object.entries(form.prices).filter(
                ([, value]) => Number(value) > 0,
            ),
        );
        if (!form.name.trim()) return toast.error("请输入套餐名称");
        if (!form.product_config.tunnel_id)
            return toast.error("请选择绑定隧道");
        if (!Number(form.transfer_enable) || Number(form.transfer_enable) < 1)
            return toast.error("流量额度必须大于 0 GB");
        if (!Object.keys(prices).length)
            return toast.error("请至少设置一个销售周期价格");
        setSaving(true);
        try {
            await post("/plan/save", {
                ...form,
                product_type: "forwarding",
                group_id: null,
                reset_traffic_method: 2,
                product_config: {
                    ...form.product_config,
                    forward_limit: Math.max(
                        1,
                        Number(form.product_config.forward_limit || 1),
                    ),
                    traffic_limit_gb: Number(
                        form.product_config.traffic_limit_gb ||
                            form.transfer_enable,
                    ),
                },
                prices,
            });
            toast.success(form.id ? "转发套餐已更新" : "转发套餐已创建");
            close();
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const setToggle = async (
        row: UnknownRecord,
        field: "sell" | "show" | "renew",
        value: boolean,
    ) => {
        const previous = Boolean(row[field]);
        setRows((current) =>
            current.map((item) =>
                item.id === row.id ? { ...item, [field]: value } : item,
            ),
        );
        try {
            await post("/plan/update", { id: row.id, [field]: value });
            toast.success("状态已更新");
        } catch (error) {
            setRows((current) =>
                current.map((item) =>
                    item.id === row.id ? { ...item, [field]: previous } : item,
                ),
            );
            toast.error(errorMessage(error));
        }
    };
    const remove = async (row: UnknownRecord) => {
        try {
            await post("/plan/drop", { id: row.id });
            toast.success("转发套餐已删除");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    return (
        <PageShell className="forwarding-plans-page">
            <PageHeader
                title="转发套餐"
                description="独立销售转发服务。用户购买后会自动获得对应隧道的流量、限速和转发数量授权。"
                action={
                    <Button onClick={() => open()}>
                        <Plus />
                        新建转发套餐
                    </Button>
                }
            />
            <MetricGrid>
                <MetricCard label="套餐数量" value={rows.length} />
                <MetricCard
                    label="销售中"
                    value={rows.filter((row) => row.show && row.sell).length}
                />
                <MetricCard
                    label="绑定隧道"
                    value={
                        new Set(
                            rows
                                .map((row) => row.product_config?.tunnel_id)
                                .filter(Boolean),
                        ).size
                    }
                />
                <MetricCard
                    label="已授权用户"
                    value={rows.reduce(
                        (sum, row) => sum + Number(row.active_users_count || 0),
                        0,
                    )}
                />
            </MetricGrid>
            <Panel>
                <div className="forwarding-plans-toolbar flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="grid flex-1 gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="套餐名称或说明"
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
            {loading ? (
                <Panel>
                    <EmptyState>正在加载转发套餐…</EmptyState>
                </Panel>
            ) : filtered.length === 0 ? (
                <Panel>
                    <EmptyState>暂无转发套餐，点击右上角新建</EmptyState>
                </Panel>
            ) : (
                <div className="forwarding-plan-grid grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((row) => (
                        <Panel key={row.id}>
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="min-w-0 flex-1">
                                        <span className="text-xs text-primary">
                                            {tunnelName(
                                                row.product_config?.tunnel_id,
                                            )}
                                        </span>
                                        <h2 className="truncate font-semibold">
                                            {row.name}
                                        </h2>
                                        <small className="text-muted-foreground">
                                            #{row.id} ·{" "}
                                            {limitName(
                                                row.product_config
                                                    ?.speed_limit_id,
                                            )}
                                        </small>
                                    </div>
                                    <StatusBadge
                                        tone={row.sell ? "default" : "neutral"}
                                    >
                                        {row.sell ? "销售中" : "已停售"}
                                    </StatusBadge>
                                </div>
                                <p className="line-clamp-3 text-sm text-muted-foreground">
                                    {row.content || "未填写套餐说明"}
                                </p>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <span className="rounded-lg bg-muted/50 p-2">
                                        流量额度
                                        <strong className="block text-base">
                                            {row.transfer_enable} GB
                                        </strong>
                                    </span>
                                    <span className="rounded-lg bg-muted/50 p-2">
                                        转发数量
                                        <strong className="block text-base">
                                            {row.product_config
                                                ?.forward_limit || 1}
                                        </strong>
                                    </span>
                                    <span className="rounded-lg bg-muted/50 p-2">
                                        有效用户
                                        <strong className="block text-base">
                                            {row.active_users_count || 0}
                                        </strong>
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {PERIODS.filter(
                                        ([key]) =>
                                            Number(row.prices?.[key]) > 0,
                                    ).map(([key, label]) => (
                                        <span
                                            key={key}
                                            className="rounded-lg border px-2 py-1 text-xs"
                                        >
                                            <small className="mr-2 text-muted-foreground">
                                                {label}
                                            </small>
                                            <strong>
                                                ¥{" "}
                                                {Number(
                                                    row.prices[key],
                                                ).toFixed(2)}
                                            </strong>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <label className="mr-auto flex items-center gap-2 text-xs">
                                        <Switch
                                            checked={Boolean(row.sell)}
                                            onCheckedChange={(value) =>
                                                void setToggle(
                                                    row,
                                                    "sell",
                                                    value,
                                                )
                                            }
                                        />
                                        {row.sell ? "允许购买" : "停止购买"}
                                    </label>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => open(row)}
                                    >
                                        编辑
                                    </Button>
                                    <ConfirmAction
                                        title="删除转发套餐"
                                        description={`确定删除转发套餐「${row.name}」？`}
                                        confirmText="删除套餐"
                                        onConfirm={() => remove(row)}
                                    >
                                        删除
                                    </ConfirmAction>
                                </div>
                            </div>
                        </Panel>
                    ))}
                </div>
            )}
            <PageDialog
                open={showForm}
                onOpenChange={(openState) =>
                    openState ? setShowForm(true) : close()
                }
                title={form.id ? "编辑转发套餐" : "新建转发套餐"}
                description="价格单位为元，购买成功后按配置自动开通转发授权。"
                className="sm:max-w-3xl"
                footer={
                    <>
                        <Button variant="outline" onClick={close}>
                            取消
                        </Button>
                        <Button disabled={saving} onClick={() => void save()}>
                            {saving ? "保存中…" : "保存套餐"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2 sm:col-span-2">
                            <span className="text-sm font-medium">
                                套餐名称 *
                            </span>
                            <Input
                                value={form.name}
                                maxLength={100}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        name: event.target.value,
                                    })
                                }
                                placeholder="例如：入门转发 100GB"
                            />
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                            <span className="text-sm font-medium">
                                套餐说明
                            </span>
                            <Textarea
                                value={form.content}
                                rows={3}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        content: event.target.value,
                                    })
                                }
                                placeholder="说明线路、适用场景和售后规则"
                            />
                        </div>
                        <SelectField
                            label="绑定隧道 *"
                            value={form.product_config.tunnel_id}
                            onValueChange={(tunnel_id) =>
                                setForm({
                                    ...form,
                                    product_config: {
                                        ...form.product_config,
                                        tunnel_id,
                                    },
                                })
                            }
                            options={[
                                { value: "", label: "请选择隧道" },
                                ...options.tunnels.map((item) => ({
                                    value: item.id,
                                    label: item.name,
                                })),
                            ]}
                        />
                        <SelectField
                            label="限速策略"
                            value={form.product_config.speed_limit_id}
                            onValueChange={(speed_limit_id) =>
                                setForm({
                                    ...form,
                                    product_config: {
                                        ...form.product_config,
                                        speed_limit_id,
                                    },
                                })
                            }
                            options={[
                                { value: "", label: "不限速" },
                                ...options.limits.map((item) => ({
                                    value: item.id,
                                    label: `${item.name} · ${item.speed_mbps} Mbps`,
                                })),
                            ]}
                        />
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                流量额度（GB） *
                            </span>
                            <Input
                                value={form.transfer_enable}
                                type="number"
                                min={1}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        transfer_enable: Number(
                                            event.target.value,
                                        ),
                                    })
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                转发数量
                            </span>
                            <Input
                                value={form.product_config.forward_limit}
                                type="number"
                                min={1}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        product_config: {
                                            ...form.product_config,
                                            forward_limit: Number(
                                                event.target.value,
                                            ),
                                        },
                                    })
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                授权流量（GB）
                            </span>
                            <Input
                                value={form.product_config.traffic_limit_gb}
                                type="number"
                                min={0}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        product_config: {
                                            ...form.product_config,
                                            traffic_limit_gb: Number(
                                                event.target.value,
                                            ),
                                        },
                                    })
                                }
                            />
                            <small className="text-muted-foreground">
                                0 表示使用上方流量额度
                            </small>
                        </div>
                        <div className="flex flex-wrap gap-5 sm:col-span-2">
                            {[
                                ["show", "展示状态", "已展示", "已隐藏"],
                                ["sell", "购买状态", "允许购买", "停止购买"],
                                ["renew", "续费状态", "允许续费", "停止续费"],
                            ].map(([field, label, on, off]) => (
                                <label
                                    key={field}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Switch
                                        checked={Boolean(
                                            form[
                                                field as
                                                    | "show"
                                                    | "sell"
                                                    | "renew"
                                            ],
                                        )}
                                        onCheckedChange={(value) =>
                                            setForm({
                                                ...form,
                                                [field as
                                                    | "show"
                                                    | "sell"
                                                    | "renew"]: value,
                                            })
                                        }
                                    />
                                    {label}：
                                    {form[field as "show" | "sell" | "renew"]
                                        ? on
                                        : off}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="mb-3 font-medium">销售周期价格 *</h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {PERIODS.map(([key, label]) => (
                                <div key={key} className="grid gap-2">
                                    <span className="text-sm">{label}</span>
                                    <Input
                                        value={form.prices[key] ?? ""}
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                prices: {
                                                    ...form.prices,
                                                    [key]: event.target.value,
                                                },
                                            })
                                        }
                                        placeholder="留空不销售"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </PageDialog>
        </PageShell>
    );
}
