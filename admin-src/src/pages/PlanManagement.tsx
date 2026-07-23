import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Info, Plus, RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
    ["two_yearly", "两年付"],
    ["three_yearly", "三年付"],
    ["onetime", "一次性"],
    ["reset_traffic", "重置流量"],
] as const;
const RESET_METHODS = [
    ["", "跟随系统设置"],
    ["0", "每月 1 号"],
    ["1", "按订阅周期每月"],
    ["2", "不重置"],
    ["3", "每年 1 月 1 日"],
    ["4", "按订阅周期每年"],
] as const;
type PlanForm = {
    id: number | null;
    name: string;
    content: string;
    group_id: string | number;
    transfer_enable: number;
    speed_limit: number;
    device_limit: number;
    capacity_limit: number;
    reset_traffic_method: string | number;
    transfer_price: string | number;
    prices: Record<string, string | number>;
    tags: string[];
    show: boolean;
    sell: boolean;
    renew: boolean;
    force_update: boolean;
    product_type: string;
    product_config: {
        tunnel_id: string | number;
        speed_limit_id: string | number;
        forward_limit: number;
        traffic_limit_gb: number;
    };
};
const blank = (forwarding: boolean): PlanForm => ({
    id: null,
    name: "",
    content: "",
    group_id: "",
    transfer_enable: 100,
    speed_limit: 0,
    device_limit: 0,
    capacity_limit: 0,
    reset_traffic_method: "",
    transfer_price: "",
    prices: {},
    tags: [],
    show: true,
    sell: true,
    renew: true,
    force_update: false,
    product_type: forwarding ? "forwarding" : "subscription",
    product_config: {
        tunnel_id: "",
        speed_limit_id: "",
        forward_limit: 1,
        traffic_limit_gb: 100,
    },
});

export default function PlanManagement() {
    const location = useLocation();
    const isForwarding = location.pathname.startsWith("/forwarding/plans");
    const [plans, setPlans] = useState<UnknownRecord[]>([]);
    const [groups, setGroups] = useState<UnknownRecord[]>([]);
    const [forwardingOptions, setForwardingOptions] = useState<{
        tunnels: UnknownRecord[];
        limits: UnknownRecord[];
    }>({ tunnels: [], limits: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [groupFilter, setGroupFilter] = useState("");
    const [sorting, setSorting] = useState(false);
    const [sortDirty, setSortDirty] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [form, setForm] = useState<PlanForm>(() => blank(isForwarding));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const requests: Promise<unknown>[] = [
                get(
                    `/plan/fetch?product_type=${isForwarding ? "forwarding" : "subscription"}`,
                ),
                get("/server/group/fetch"),
            ];
            if (isForwarding) requests.push(get("/forwarding/options"));
            const [planData, groupData, forwardingData] =
                await Promise.all(requests);
            setPlans(Array.isArray(planData) ? planData : []);
            setGroups(Array.isArray(groupData) ? groupData : []);
            if (forwardingData) {
                const data = forwardingData as UnknownRecord;
                setForwardingOptions({
                    tunnels: Array.isArray(data.tunnels) ? data.tunnels : [],
                    limits: Array.isArray(data.limits) ? data.limits : [],
                });
            }
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [isForwarding]);
    useEffect(() => {
        setForm(blank(isForwarding));
        void load();
    }, [isForwarding, load]);
    const filtered = useMemo(
        () =>
            plans.filter((plan) => {
                const term = keyword.trim().toLowerCase();
                return (
                    (!term ||
                        `${plan.name} ${(plan.tags || []).join(" ")}`
                            .toLowerCase()
                            .includes(term)) &&
                    (isForwarding ||
                        !groupFilter ||
                        Number(plan.group_id) === Number(groupFilter)) &&
                    (statusFilter === "all" ||
                        (statusFilter === "selling"
                            ? plan.show && plan.sell
                            : statusFilter === "hidden"
                              ? !plan.show
                              : !plan.sell))
                );
            }),
        [groupFilter, isForwarding, keyword, plans, statusFilter],
    );
    const displayed = sorting ? plans : filtered;
    const stats = useMemo(
        () => ({
            total: plans.length,
            selling: plans.filter((plan) => plan.show && plan.sell).length,
            users: plans.reduce(
                (sum, plan) => sum + Number(plan.users_count || 0),
                0,
            ),
            active: plans.reduce(
                (sum, plan) => sum + Number(plan.active_users_count || 0),
                0,
            ),
        }),
        [plans],
    );
    const closeForm = () => {
        setShowForm(false);
        setShowCloseConfirm(false);
        setForm(blank(isForwarding));
        setTagInput("");
    };
    const openPlan = (source?: UnknownRecord, copy = false) => {
        const base = blank(isForwarding);
        if (!source) setForm(base);
        else
            setForm({
                ...base,
                ...source,
                id: copy ? null : Number(source.id),
                name: copy
                    ? `${source.name} - 副本`
                    : String(source.name || ""),
                content: String(source.content || ""),
                group_id: source.group_id ?? "",
                transfer_enable: Number(source.transfer_enable || 100),
                speed_limit: Number(source.speed_limit || 0),
                device_limit: Number(source.device_limit || 0),
                capacity_limit: Number(source.capacity_limit || 0),
                reset_traffic_method: source.reset_traffic_method ?? "",
                transfer_price: source.transfer_price ?? "",
                prices: { ...(source.prices || {}) },
                tags: [...(source.tags || [])],
                show: Boolean(source.show),
                sell: Boolean(source.sell),
                renew: Boolean(source.renew),
                force_update: false,
                product_type: isForwarding ? "forwarding" : "subscription",
                product_config: {
                    ...base.product_config,
                    ...(source.product_config || {}),
                },
            });
        setTagInput("");
        setShowForm(true);
    };
    const addTag = () => {
        const value = tagInput.trim();
        if (value && !form.tags.includes(value))
            setForm({ ...form, tags: [...form.tags, value] });
        setTagInput("");
    };
    const save = async (): Promise<void> => {
        const validPrices = Object.fromEntries(
            Object.entries(form.prices).filter(
                ([, value]) =>
                    value !== "" && value != null && Number(value) > 0,
            ),
        );
        if (!form.name.trim()) {
            toast.error("请输入套餐名称");
            return;
        }
        if (Number(form.transfer_enable) < 1) {
            toast.error("流量配额必须大于 0 GB");
            return;
        }
        if (isForwarding && !form.product_config.tunnel_id) {
            toast.error("请选择绑定隧道");
            return;
        }
        if (
            [form.speed_limit, form.device_limit, form.capacity_limit].some(
                (value) => Number(value) < 0,
            )
        ) {
            toast.error("限制数值不能小于 0");
            return;
        }
        if (!Object.keys(validPrices).length) {
            toast.error("请至少设置一个大于 0 的周期价格");
            return;
        }
        const existingIds = new Set(plans.map((plan) => Number(plan.id)));
        setSaving(true);
        try {
            const payload = {
                ...form,
                product_type: isForwarding ? "forwarding" : "subscription",
                product_config: isForwarding
                    ? { ...form.product_config }
                    : null,
                group_id: isForwarding ? null : form.group_id || null,
                reset_traffic_method: isForwarding
                    ? 2
                    : form.reset_traffic_method === ""
                      ? null
                      : Number(form.reset_traffic_method),
                transfer_price:
                    form.transfer_price === ""
                        ? null
                        : Number(form.transfer_price),
                prices: validPrices,
            };
            const result = await post<unknown>("/plan/save", payload);
            let id = form.id || Number((result as UnknownRecord | null)?.id || 0);
            if (!id) {
                const refreshed = await get<unknown[]>(
                    `/plan/fetch?product_type=${isForwarding ? "forwarding" : "subscription"}`,
                );
                const rows = Array.isArray(refreshed)
                    ? (refreshed as UnknownRecord[])
                    : [];
                setPlans(rows);
                id = Number(
                    rows
                        .filter((plan) => !existingIds.has(Number(plan.id)))
                        .sort((left, right) => Number(right.id) - Number(left.id))[0]
                        ?.id || 0,
                );
            }
            if (id)
                await post("/plan/update", {
                    id,
                    show: Boolean(form.show),
                    sell: Boolean(form.sell),
                    renew: Boolean(form.renew),
                });
            toast.success(form.id ? "套餐已更新" : "套餐已创建");
            closeForm();
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const toggle = async (
        plan: UnknownRecord,
        field: "show" | "sell" | "renew",
    ) => {
        setBusyId(Number(plan.id));
        try {
            await post("/plan/update", { id: plan.id, [field]: !plan[field] });
            setPlans((current) =>
                current.map((item) =>
                    item.id === plan.id
                        ? { ...item, [field]: !item[field] }
                        : item,
                ),
            );
            toast.success("套餐状态已更新");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusyId(null);
        }
    };
    const remove = async (plan: UnknownRecord): Promise<void> => {
        if (plan.users_count) {
            toast.error("该套餐仍有关联用户，无法删除");
            return;
        }
        setBusyId(Number(plan.id));
        try {
            await post("/plan/drop", { id: plan.id });
            toast.success("套餐已删除");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusyId(null);
        }
    };
    const enterSorting = () => {
        setSorting((value) => !value);
        setSortDirty(false);
        if (!sorting) {
            setKeyword("");
            setStatusFilter("all");
            setGroupFilter("");
        }
    };
    const move = (index: number, direction: number) => {
        const target = index + direction;
        if (target < 0 || target >= plans.length) return;
        setPlans((current) => {
            const next = [...current];
            const source = next[index];
            const destination = next[target];
            if (!source || !destination) return current;
            next[index] = destination;
            next[target] = source;
            return next;
        });
        setSortDirty(true);
    };
    const saveSort = async () => {
        setSaving(true);
        try {
            await post("/plan/sort", { ids: plans.map((plan) => plan.id) });
            setSorting(false);
            setSortDirty(false);
            toast.success("套餐排序已保存");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const capacity = (plan: UnknownRecord) =>
        Number(plan.capacity_limit || 0)
            ? Math.min(
                  100,
                  Math.round(
                      (Number(plan.active_users_count || 0) /
                          Number(plan.capacity_limit)) *
                          100,
                  ),
              )
            : 0;
    const resetLabel = (value: unknown) =>
        RESET_METHODS.find(
            ([key]) => String(key) === String(value ?? ""),
        )?.[1] || "跟随系统设置";
    const periodCount = (plan: UnknownRecord) =>
        PERIODS.filter(([key]) => Number(plan.prices?.[key]) > 0).length;
    const monthlyEquivalent = (key: string, value: unknown) => {
        const months: Record<string, number> = {
            quarterly: 3,
            half_yearly: 6,
            yearly: 12,
            two_yearly: 24,
            three_yearly: 36,
        };
        const price = Number(value);
        return months[key] && Number.isFinite(price) && price > 0
            ? `约 ¥${(price / months[key]).toFixed(2)}/月`
            : "";
    };
    const tunnelName = (id: unknown) =>
        forwardingOptions.tunnels.find((item) => Number(item.id) === Number(id))
            ?.name || `隧道 #${id}`;

    return (
        <PageShell>
            <PageHeader
                title={isForwarding ? "转发套餐管理" : "套餐管理"}
                description={
                    isForwarding
                        ? "配置转发隧道的流量额度、转发数量、限速和销售周期。购买后自动开通对应转发授权。"
                        : "配置订阅价格、流量权益、权限组、销售状态和容量限制。"
                }
                action={
                    <Button onClick={() => openPlan()}>
                        <Plus />
                        添加{isForwarding ? "转发" : ""}套餐
                    </Button>
                }
            />
            <MetricGrid>
                <MetricCard
                    label={isForwarding ? "转发套餐" : "套餐总数"}
                    value={stats.total}
                />
                <MetricCard label="销售中" value={stats.selling} />
                <MetricCard
                    label={isForwarding ? "转发授权用户" : "累计用户"}
                    value={stats.users}
                />
                <MetricCard
                    label={isForwarding ? "当前有效授权" : "有效用户"}
                    value={stats.active}
                />
            </MetricGrid>
            <Panel>
                <div className="plan-toolbar grid gap-3 xl:grid-cols-[1fr_13rem_12rem_auto_auto] xl:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={keyword}
                            disabled={sorting}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="套餐名称或标签"
                        />
                    </div>
                    {!isForwarding && (
                        <SelectField
                            label="权限组"
                            value={groupFilter}
                            disabled={sorting}
                            onValueChange={setGroupFilter}
                            options={[
                                { value: "", label: "全部权限组" },
                                ...groups.map((group) => ({
                                    value: group.id,
                                    label: group.name,
                                })),
                            ]}
                        />
                    )}
                    <SelectField
                        label="销售状态"
                        value={statusFilter}
                        disabled={sorting}
                        onValueChange={setStatusFilter}
                        options={[
                            { value: "all", label: "全部状态" },
                            { value: "selling", label: "销售中" },
                            { value: "hidden", label: "已隐藏" },
                            { value: "stopped", label: "停止新购" },
                        ]}
                    />
                    <Button variant="outline" onClick={enterSorting}>
                        {sorting ? "退出排序" : "调整排序"}
                    </Button>
                    {sorting ? (
                        <Button
                            disabled={!sortDirty || saving}
                            onClick={() => void saveSort()}
                        >
                            保存排序
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            disabled={loading}
                            onClick={() => void load()}
                        >
                            <RefreshCw />
                            刷新
                        </Button>
                    )}
                </div>
            </Panel>
            {loading ? (
                <Panel>
                    <EmptyState>正在加载套餐…</EmptyState>
                </Panel>
            ) : displayed.length === 0 ? (
                <Panel>
                    <EmptyState>暂无符合条件的套餐</EmptyState>
                </Panel>
            ) : (
                <div className="plan-grid grid gap-4 lg:grid-cols-2">
                    {displayed.map((plan, index) => (
                        <Panel
                            key={plan.id}
                            className={
                                capacity(plan) >= 90 ? "ring-amber-400" : ""
                            }
                        >
                            <div className="space-y-4">
                                {sorting && (
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            title="上移"
                                            disabled={index === 0}
                                            onClick={() => move(index, -1)}
                                        >
                                            <ArrowUp />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            title="下移"
                                            disabled={
                                                index === plans.length - 1
                                            }
                                            onClick={() => move(index, 1)}
                                        >
                                            <ArrowDown />
                                        </Button>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <div className="min-w-0 flex-1">
                                        <span className="text-xs text-primary">
                                            {isForwarding
                                                ? tunnelName(
                                                      plan.product_config
                                                          ?.tunnel_id,
                                                  )
                                                : plan.group?.name ||
                                                  "未绑定权限组"}
                                        </span>
                                        <h2 className="truncate font-semibold">
                                            {plan.name}
                                        </h2>
                                        <small className="text-muted-foreground">
                                            #{plan.id} ·{" "}
                                            {resetLabel(
                                                plan.reset_traffic_method,
                                            )}{" "}
                                            · {periodCount(plan)} 个价格周期
                                        </small>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <StatusBadge
                                            tone={
                                                plan.show
                                                    ? "default"
                                                    : "neutral"
                                            }
                                        >
                                            {plan.show ? "已展示" : "已隐藏"}
                                        </StatusBadge>
                                        <StatusBadge
                                            tone={
                                                plan.sell
                                                    ? "default"
                                                    : "neutral"
                                            }
                                        >
                                            {plan.sell ? "可新购" : "停新购"}
                                        </StatusBadge>
                                        <StatusBadge
                                            tone={
                                                plan.renew
                                                    ? "default"
                                                    : "neutral"
                                            }
                                        >
                                            {plan.renew ? "可续费" : "停续费"}
                                        </StatusBadge>
                                    </div>
                                </div>
                                <p className="line-clamp-3 text-sm text-muted-foreground">
                                    {plan.content || "暂无套餐说明"}
                                </p>
                                {plan.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {plan.tags.map((tag: string) => (
                                            <Badge
                                                key={tag}
                                                variant="secondary"
                                            >
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                                    <span className="rounded-lg bg-muted/50 p-2">
                                        流量
                                        <strong className="block text-base">
                                            {plan.transfer_enable} GB
                                        </strong>
                                    </span>
                                    <span className="rounded-lg bg-muted/50 p-2">
                                        限速
                                        <strong className="block text-base">
                                            {plan.speed_limit
                                                ? `${plan.speed_limit} Mbps`
                                                : "不限"}
                                        </strong>
                                    </span>
                                    <span className="rounded-lg bg-muted/50 p-2">
                                        设备
                                        <strong className="block text-base">
                                            {plan.device_limit || "不限"}
                                        </strong>
                                    </span>
                                    <span className="rounded-lg bg-muted/50 p-2">
                                        有效用户
                                        <strong className="block text-base">
                                            {plan.active_users_count || 0} /{" "}
                                            {plan.capacity_limit || "∞"}
                                        </strong>
                                    </span>
                                </div>
                                {plan.capacity_limit > 0 && (
                                    <div>
                                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                            <span>容量</span>
                                            <span>
                                                {capacity(plan) >= 100
                                                    ? "容量已满"
                                                    : `${capacity(plan)}%`}
                                            </span>
                                        </div>
                                        <Progress value={capacity(plan)} />
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {PERIODS.filter(
                                        ([key]) =>
                                            Number(plan.prices?.[key]) > 0,
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
                                                    plan.prices[key],
                                                ).toFixed(2)}
                                            </strong>
                                            {monthlyEquivalent(
                                                key,
                                                plan.prices[key],
                                            ) && (
                                                <em className="ml-2 text-muted-foreground">
                                                    {monthlyEquivalent(
                                                        key,
                                                        plan.prices[key],
                                                    )}
                                                </em>
                                            )}
                                        </span>
                                    ))}
                                    {periodCount(plan) === 0 && (
                                        <span className="text-sm text-destructive">
                                            未设置可购买价格，用户无法购买
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busyId === Number(plan.id)}
                                        onClick={() =>
                                            void toggle(plan, "show")
                                        }
                                    >
                                        {plan.show ? "隐藏" : "展示"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busyId === Number(plan.id)}
                                        onClick={() =>
                                            void toggle(plan, "sell")
                                        }
                                    >
                                        {plan.sell ? "停止新购" : "允许新购"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={busyId === Number(plan.id)}
                                        onClick={() =>
                                            void toggle(plan, "renew")
                                        }
                                    >
                                        {plan.renew ? "停止续费" : "允许续费"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openPlan(plan, true)}
                                    >
                                        复制
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openPlan(plan)}
                                    >
                                        编辑
                                    </Button>
                                    <ConfirmAction
                                        title="删除套餐"
                                        description={`确定删除套餐「${plan.name}」？存在历史订单时后端仍会阻止删除。`}
                                        confirmText="删除套餐"
                                        disabled={
                                            Boolean(plan.users_count) ||
                                            busyId === Number(plan.id)
                                        }
                                        onConfirm={() => remove(plan)}
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
                    openState ? setShowForm(true) : setShowCloseConfirm(true)
                }
                title={form.id ? "编辑套餐" : "添加套餐"}
                description="带 * 为必填项；金额单位为元，流量单位为 GB。"
                className="sm:max-w-4xl"
                footer={
                    <>
                        <ConfirmAction
                            destructive={false}
                            variant="outline"
                            title="放弃未保存的修改？"
                            description="尚未保存的套餐配置将会丢失。"
                            confirmText="放弃修改"
                            disabled={saving}
                            onConfirm={async () => closeForm()}
                        >
                            取消
                        </ConfirmAction>
                        {form.force_update ? (
                            <ConfirmAction
                                destructive={false}
                                variant="default"
                                title="强制同步现有用户？"
                                description="强制同步会立即覆盖该套餐所有用户的权限组、流量、限速和设备数。"
                                confirmText="确认并保存"
                                disabled={saving}
                                onConfirm={save}
                            >
                                {saving ? "保存中…" : "保存套餐"}
                            </ConfirmAction>
                        ) : (
                            <Button
                                disabled={saving}
                                onClick={() => void save()}
                            >
                                {saving ? "保存中…" : "保存套餐"}
                            </Button>
                        )}
                    </>
                }
            >
                <div className="space-y-5">
                    <p className="flex gap-2 rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground">
                        <Info className="size-4 shrink-0 text-primary" />
                        新套餐默认展示并允许购买；至少配置一个价格周期后才能保存。
                    </p>
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
                                placeholder="例如：标准年付套餐"
                            />
                        </div>
                        {isForwarding ? (
                            <>
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
                                        ...forwardingOptions.tunnels.map(
                                            (item) => ({
                                                value: item.id,
                                                label: item.name,
                                            }),
                                        ),
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
                                        ...forwardingOptions.limits.map(
                                            (item) => ({
                                                value: item.id,
                                                label: `${item.name} · ${item.speed_mbps} Mbps`,
                                            }),
                                        ),
                                    ]}
                                />
                                <div className="grid gap-2">
                                    <span className="text-sm font-medium">
                                        转发数量
                                    </span>
                                    <Input
                                        value={
                                            form.product_config.forward_limit
                                        }
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
                                        value={
                                            form.product_config.traffic_limit_gb
                                        }
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
                                </div>
                            </>
                        ) : (
                            <>
                                <SelectField
                                    label="权限组"
                                    value={form.group_id}
                                    onValueChange={(group_id) =>
                                        setForm({ ...form, group_id })
                                    }
                                    options={[
                                        { value: "", label: "不绑定" },
                                        ...groups.map((group) => ({
                                            value: group.id,
                                            label: group.name,
                                        })),
                                    ]}
                                />
                                <SelectField
                                    label="流量重置方式"
                                    value={form.reset_traffic_method}
                                    onValueChange={(reset_traffic_method) =>
                                        setForm({
                                            ...form,
                                            reset_traffic_method,
                                        })
                                    }
                                    options={RESET_METHODS.map(
                                        ([value, label]) => ({ value, label }),
                                    )}
                                />
                            </>
                        )}
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                流量配额（GB） *
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
                        {!isForwarding && (
                            <>
                                <div className="grid gap-2">
                                    <span className="text-sm font-medium">
                                        速度限制（Mbps）
                                    </span>
                                    <Input
                                        value={form.speed_limit}
                                        type="number"
                                        min={0}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                speed_limit: Number(
                                                    event.target.value,
                                                ),
                                            })
                                        }
                                    />
                                    <small className="text-muted-foreground">
                                        0 表示不限速
                                    </small>
                                </div>
                                <div className="grid gap-2">
                                    <span className="text-sm font-medium">
                                        设备数量限制
                                    </span>
                                    <Input
                                        value={form.device_limit}
                                        type="number"
                                        min={0}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                device_limit: Number(
                                                    event.target.value,
                                                ),
                                            })
                                        }
                                    />
                                    <small className="text-muted-foreground">
                                        0 表示不限制
                                    </small>
                                </div>
                                <div className="grid gap-2">
                                    <span className="text-sm font-medium">
                                        容量限制
                                    </span>
                                    <Input
                                        value={form.capacity_limit}
                                        type="number"
                                        min={0}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                capacity_limit: Number(
                                                    event.target.value,
                                                ),
                                            })
                                        }
                                    />
                                    <small className="text-muted-foreground">
                                        0 表示不限人数
                                    </small>
                                </div>
                                <div className="grid gap-2">
                                    <span className="text-sm font-medium">
                                        套餐转让费（分）
                                    </span>
                                    <Input
                                        value={form.transfer_price}
                                        type="number"
                                        min={0}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                transfer_price:
                                                    event.target.value,
                                            })
                                        }
                                        placeholder="留空继承系统设置"
                                    />
                                    <small className="text-muted-foreground">
                                        100 分 = 1 元
                                    </small>
                                </div>
                            </>
                        )}
                        <div className="flex flex-wrap gap-5 sm:col-span-2">
                            {[
                                ["show", "用户端展示", "已展示", "已隐藏"],
                                ["sell", "允许新购", "允许购买", "停止购买"],
                                ["renew", "允许续费", "允许续费", "停止续费"],
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
                        <div className="grid gap-2 sm:col-span-2">
                            <span className="text-sm font-medium">
                                套餐说明
                            </span>
                            <Textarea
                                value={form.content}
                                rows={5}
                                maxLength={10000}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        content: event.target.value,
                                    })
                                }
                                placeholder="支持 Markdown，可填写套餐权益和购买说明"
                            />
                        </div>
                        <div className="grid gap-2 sm:col-span-2">
                            <span className="text-sm font-medium">标签</span>
                            <div className="flex flex-wrap gap-1">
                                {form.tags.map((tag) => (
                                    <Button
                                        key={tag}
                                        type="button"
                                        variant="secondary"
                                        size="xs"
                                        onClick={() =>
                                            setForm({
                                                ...form,
                                                tags: form.tags.filter(
                                                    (value) => value !== tag,
                                                ),
                                            })
                                        }
                                    >
                                        {tag} ×
                                    </Button>
                                ))}
                            </div>
                            <Input
                                value={tagInput}
                                maxLength={30}
                                onChange={(event) =>
                                    setTagInput(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addTag();
                                    }
                                }}
                                onBlur={addTag}
                                placeholder="输入标签后按回车"
                            />
                        </div>
                    </div>
                    <div>
                        <h3 className="mb-3 font-medium">周期价格（元） *</h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                                        placeholder="不提供则留空"
                                    />
                                    {monthlyEquivalent(
                                        key,
                                        form.prices[key],
                                    ) && (
                                        <small className="text-muted-foreground">
                                            {monthlyEquivalent(
                                                key,
                                                form.prices[key],
                                            )}
                                        </small>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {form.id && (
                        <label className="flex items-start gap-3 rounded-lg border p-3">
                            <Switch
                                checked={form.force_update}
                                onCheckedChange={(force_update) =>
                                    setForm({ ...form, force_update })
                                }
                            />
                            <span>
                                <strong className="block text-sm">
                                    强制同步现有用户
                                </strong>
                                <small className="text-muted-foreground">
                                    将权限组、流量配额、限速和设备数立即覆盖到该套餐全部用户。
                                </small>
                            </span>
                        </label>
                    )}
                </div>
            </PageDialog>
            <PageDialog
                open={showCloseConfirm}
                onOpenChange={setShowCloseConfirm}
                title="放弃未保存的修改？"
                description="尚未保存的套餐配置将会丢失。"
                className="sm:max-w-md"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowCloseConfirm(false)}
                        >
                            继续编辑
                        </Button>
                        <Button variant="destructive" onClick={closeForm}>
                            放弃修改
                        </Button>
                    </>
                }
            >
                <div />
            </PageDialog>
        </PageShell>
    );
}
