import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { get, post } from "@/services/http";
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
    type SelectOption,
    type UnknownRecord,
} from "./react-page-helpers";

type PaymentForm = {
    id: number | null;
    name: string;
    icon: string;
    payment: string;
    notify_domain: string;
    handling_fee_fixed: number;
    handling_fee_percent: number;
    config: UnknownRecord;
};
type ConfigField = {
    key: string;
    label: string;
    type: string;
    placeholder?: string;
    help?: string;
    required: boolean;
    options: Array<{ value: unknown; label: unknown }>;
};
const blank = (): PaymentForm => ({
    id: null,
    name: "",
    icon: "",
    payment: "",
    notify_domain: "",
    handling_fee_fixed: 0,
    handling_fee_percent: 0,
    config: {},
});

function normalizeOptions(
    options: unknown,
): Array<{ value: unknown; label: unknown }> {
    if (Array.isArray(options))
        return options.map((item) =>
            typeof item === "object" && item !== null
                ? {
                      value: (item as UnknownRecord).value,
                      label:
                          (item as UnknownRecord).label ??
                          (item as UnknownRecord).value,
                  }
                : { value: item, label: item },
        );
    if (options && typeof options === "object")
        return Object.entries(options).map(([value, label]) => ({
            value,
            label,
        }));
    return [];
}
function normalizeFields(schema: UnknownRecord): ConfigField[] {
    return Object.entries(schema || {}).map(([key, raw]) => {
        const field = (
            raw && typeof raw === "object" ? raw : {}
        ) as UnknownRecord;
        return {
            key,
            label: String(field.label || key),
            type:
                field.type === "string" ? "text" : String(field.type || "text"),
            placeholder:
                field.placeholder == null
                    ? undefined
                    : String(field.placeholder),
            help:
                field.description == null
                    ? undefined
                    : String(field.description),
            required: Boolean(field.required),
            options: normalizeOptions(field.options),
        };
    });
}

export default function PaymentManagement() {
    const [payments, setPayments] = useState<UnknownRecord[]>([]);
    const [methods, setMethods] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sorting, setSorting] = useState(false);
    const [sortDirty, setSortDirty] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [configFields, setConfigFields] = useState<ConfigField[]>([]);
    const [form, setForm] = useState<PaymentForm>(blank());
    const [deleteTarget, setDeleteTarget] = useState<UnknownRecord | null>(
        null,
    );

    const filtered = useMemo(
        () =>
            payments.filter((item) => {
                const term = keyword.trim().toLowerCase();
                return (
                    (!term ||
                        `${item.name} ${item.payment}`
                            .toLowerCase()
                            .includes(term)) &&
                    (statusFilter === "all" ||
                        Number(item.enable) === Number(statusFilter))
                );
            }),
        [keyword, payments, statusFilter],
    );
    const stats = useMemo(
        () => ({
            total: payments.length,
            enabled: payments.filter((item) => Number(item.enable)).length,
            methods: new Set(payments.map((item) => item.payment)).size,
        }),
        [payments],
    );
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [rows, available] = await Promise.all([
                get("/payment/fetch"),
                get("/payment/getPaymentMethods"),
            ]);
            setPayments(Array.isArray(rows) ? rows : []);
            setMethods(Array.isArray(available) ? available.map(String) : []);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);

    const loadSchema = async (payment: string, id: number | null = null) => {
        if (!payment) {
            setConfigFields([]);
            setForm((current) => ({ ...current, config: {} }));
            return;
        }
        setSchemaLoading(true);
        try {
            const schema = (await post("/payment/getPaymentForm", {
                payment,
                id,
            })) as UnknownRecord;
            setConfigFields(normalizeFields(schema));
            setForm((current) => ({
                ...current,
                config: Object.fromEntries(
                    Object.entries(schema || {}).map(([key, raw]) => {
                        const field = (
                            raw && typeof raw === "object" ? raw : {}
                        ) as UnknownRecord;
                        return [key, field.value ?? ""];
                    }),
                ),
            }));
        } catch (error) {
            setConfigFields([]);
            toast.error(errorMessage(error));
        } finally {
            setSchemaLoading(false);
        }
    };
    const createPayment = () => {
        setForm(blank());
        setConfigFields([]);
        setShowForm(true);
    };
    const editPayment = async (item: UnknownRecord) => {
        setForm({
            ...blank(),
            ...item,
            id: Number(item.id),
            name: String(item.name || ""),
            icon: String(item.icon || ""),
            payment: String(item.payment || ""),
            notify_domain: String(item.notify_domain || ""),
            handling_fee_fixed: Number(item.handling_fee_fixed || 0),
            handling_fee_percent: Number(item.handling_fee_percent || 0),
            config: {},
        });
        setShowForm(true);
        await loadSchema(String(item.payment || ""), Number(item.id));
    };
    const closeForm = () => {
        setShowForm(false);
        setForm(blank());
        setConfigFields([]);
        setSchemaLoading(false);
    };
    const changeMethod = async (payment: string) => {
        setForm((current) => ({ ...current, payment, config: {} }));
        await loadSchema(payment);
    };
    const save = async () => {
        if (!form.name.trim() || !form.payment)
            return toast.error("请填写显示名称并选择支付网关");
        const missing = configFields.find(
            (field) =>
                field.required &&
                (form.config[field.key] === "" ||
                    form.config[field.key] == null),
        );
        if (missing) return toast.error(`请填写${missing.label}`);
        setSaving(true);
        try {
            await post("/payment/save", {
                ...form,
                handling_fee_fixed: Number(form.handling_fee_fixed || 0),
                handling_fee_percent: Number(form.handling_fee_percent || 0),
            });
            toast.success(form.id ? "支付方式已更新" : "支付方式已添加");
            closeForm();
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const toggle = async (item: UnknownRecord) => {
        setBusyId(Number(item.id));
        try {
            await post("/payment/show", { id: item.id });
            setPayments((current) =>
                current.map((payment) =>
                    payment.id === item.id
                        ? { ...payment, enable: !payment.enable }
                        : payment,
                ),
            );
            toast.success(
                Number(item.enable) ? "支付方式已停用" : "支付方式已启用",
            );
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusyId(null);
        }
    };
    const remove = async () => {
        if (!deleteTarget) return;
        setBusyId(Number(deleteTarget.id));
        try {
            await post("/payment/drop", { id: deleteTarget.id });
            toast.success("支付方式已删除");
            setDeleteTarget(null);
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusyId(null);
        }
    };
    const move = (index: number, direction: number) => {
        const target = index + direction;
        if (target < 0 || target >= payments.length) return;
        setPayments((current) => {
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
            await post("/payment/sort", {
                ids: payments.map((item) => item.id),
            });
            setSorting(false);
            setSortDirty(false);
            toast.success("支付排序已保存");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const copyUrl = async (url: unknown) => {
        try {
            await navigator.clipboard.writeText(String(url || ""));
            toast.success("回调地址已复制");
        } catch {
            toast.error("复制失败，请手动复制");
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="支付配置"
                description="配置收款网关、手续费、回调地址与用户端可用状态。"
                action={
                    <Button disabled={!methods.length} onClick={createPayment}>
                        <Plus />
                        添加支付方式
                    </Button>
                }
            />
            <MetricGrid>
                <MetricCard label="支付方式" value={stats.total} />
                <MetricCard label="已启用" value={stats.enabled} />
                <MetricCard label="网关类型" value={stats.methods} />
            </MetricGrid>
            {!loading && methods.length === 0 && (
                <Panel className="payment-tip">
                    <p className="text-sm text-muted-foreground">
                        暂无可用支付网关，请先到“插件管理”安装并启用支付插件。
                    </p>
                </Panel>
            )}
            <Panel>
                <div className="payment-toolbar grid gap-3 md:grid-cols-[1fr_14rem_auto_auto] md:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="名称或网关代码"
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
                        onClick={() => {
                            setSorting((current) => !current);
                            setSortDirty(false);
                        }}
                    >
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
                    <EmptyState>正在加载支付配置…</EmptyState>
                </Panel>
            ) : filtered.length === 0 ? (
                <Panel>
                    <EmptyState>暂无符合条件的支付方式</EmptyState>
                </Panel>
            ) : (
                <div className="payment-grid grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((item) => {
                        const index = payments.indexOf(item);
                        return (
                            <Panel key={item.id} className="payment-card">
                                <div className="space-y-4">
                                    {sorting && (
                                        <div className="sort-controls flex justify-end gap-1">
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
                                                    index ===
                                                    payments.length - 1
                                                }
                                                onClick={() => move(index, 1)}
                                            >
                                                <ArrowDown />
                                            </Button>
                                        </div>
                                    )}
                                    <div className="payment-card-head flex items-start gap-3">
                                        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-lg text-primary">
                                            {item.icon || "¥"}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h2 className="truncate font-semibold">
                                                {item.name}
                                            </h2>
                                            <code className="text-xs text-muted-foreground">
                                                {item.payment}
                                            </code>
                                        </div>
                                        <StatusBadge
                                            tone={
                                                Number(item.enable)
                                                    ? "default"
                                                    : "neutral"
                                            }
                                        >
                                            {Number(item.enable)
                                                ? "已启用"
                                                : "已停用"}
                                        </StatusBadge>
                                    </div>
                                    <div className="payment-fees grid grid-cols-2 gap-2 text-sm">
                                        <span className="rounded-lg bg-muted/50 p-3 text-muted-foreground">
                                            固定手续费
                                            <strong className="mt-1 block text-foreground">
                                                ¥{" "}
                                                {(
                                                    Number(
                                                        item.handling_fee_fixed ||
                                                            0,
                                                    ) / 100
                                                ).toFixed(2)}
                                            </strong>
                                        </span>
                                        <span className="rounded-lg bg-muted/50 p-3 text-muted-foreground">
                                            比例手续费
                                            <strong className="mt-1 block text-foreground">
                                                {Number(
                                                    item.handling_fee_percent ||
                                                        0,
                                                )}
                                                %
                                            </strong>
                                        </span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="payment-callback h-auto w-full min-w-0 justify-start p-3 text-left"
                                        title="点击复制"
                                        onClick={() =>
                                            void copyUrl(item.notify_url)
                                        }
                                    >
                                        <span className="min-w-0 flex-1">
                                            <small className="block text-muted-foreground">
                                                异步回调地址
                                            </small>
                                            <code className="block truncate">
                                                {item.notify_url}
                                            </code>
                                        </span>
                                        <Copy />
                                    </Button>
                                    <div className="payment-actions flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                                busyId === Number(item.id)
                                            }
                                            onClick={() => void toggle(item)}
                                        >
                                            {Number(item.enable)
                                                ? "停用"
                                                : "启用"}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                void editPayment(item)
                                            }
                                        >
                                            编辑配置
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={
                                                busyId === Number(item.id)
                                            }
                                            onClick={() =>
                                                setDeleteTarget(item)
                                            }
                                        >
                                            删除
                                        </Button>
                                    </div>
                                </div>
                            </Panel>
                        );
                    })}
                </div>
            )}

            <PageDialog
                open={showForm}
                onOpenChange={(open) =>
                    open ? setShowForm(true) : closeForm()
                }
                title={form.id ? "编辑支付方式" : "添加支付方式"}
                description="配置项由所选支付插件动态提供。"
                className="sm:max-w-3xl"
                footer={
                    <Button
                        disabled={saving || !form.payment}
                        onClick={() => void save()}
                    >
                        {saving ? "保存中…" : "保存支付方式"}
                    </Button>
                }
            >
                <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                显示名称
                            </span>
                            <Input
                                value={form.name}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        name: event.target.value,
                                    })
                                }
                                placeholder="例如：支付宝"
                            />
                        </div>
                        <SelectField
                            label="支付网关"
                            value={form.payment}
                            disabled={Boolean(form.id)}
                            onValueChange={(payment) =>
                                void changeMethod(payment)
                            }
                            options={[
                                { value: "", label: "请选择网关" },
                                ...methods.map((method) => ({
                                    value: method,
                                    label: method,
                                })),
                            ]}
                            hint={
                                form.id
                                    ? "已创建的支付方式不可切换网关"
                                    : undefined
                            }
                        />
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">图标</span>
                            <Input
                                value={form.icon}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        icon: event.target.value,
                                    })
                                }
                                placeholder="Emoji 或图标 URL"
                            />
                        </div>
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                自定义回调域名
                            </span>
                            <Input
                                value={form.notify_domain}
                                type="url"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        notify_domain: event.target.value,
                                    })
                                }
                                placeholder="https://pay.example.com"
                            />
                            <small className="text-muted-foreground">
                                留空时使用当前站点域名
                            </small>
                        </div>
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                固定手续费（分）
                            </span>
                            <Input
                                value={form.handling_fee_fixed}
                                type="number"
                                min={0}
                                step={1}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        handling_fee_fixed: Number(
                                            event.target.value,
                                        ),
                                    })
                                }
                            />
                            <small className="text-muted-foreground">
                                当前为 ¥
                                {(
                                    Number(form.handling_fee_fixed || 0) / 100
                                ).toFixed(2)}
                            </small>
                        </div>
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                比例手续费（%）
                            </span>
                            <Input
                                value={form.handling_fee_percent}
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        handling_fee_percent: Number(
                                            event.target.value,
                                        ),
                                    })
                                }
                            />
                        </div>
                    </div>
                    {form.payment && (
                        <div className="gateway-config space-y-3">
                            <h3 className="font-medium">网关参数</h3>
                            {schemaLoading ? (
                                <EmptyState>正在读取网关参数…</EmptyState>
                            ) : configFields.length > 0 ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {configFields.map((field) => (
                                        <GatewayField
                                            key={field.key}
                                            field={field}
                                            value={form.config[field.key]}
                                            onChange={(value) =>
                                                setForm({
                                                    ...form,
                                                    config: {
                                                        ...form.config,
                                                        [field.key]: value,
                                                    },
                                                })
                                            }
                                        />
                                    ))}
                                </div>
                            ) : (
                                <EmptyState>暂无网关参数</EmptyState>
                            )}
                        </div>
                    )}
                </div>
            </PageDialog>
            <PageDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="删除支付方式"
                description={`确定删除支付方式「${deleteTarget?.name || ""}」？删除后用户将无法使用。`}
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
                            disabled={busyId === Number(deleteTarget?.id)}
                            onClick={() => void remove()}
                        >
                            {busyId === Number(deleteTarget?.id)
                                ? "删除中…"
                                : "确认删除"}
                        </Button>
                    </>
                }
            >
                <div />
            </PageDialog>
        </PageShell>
    );
}

function GatewayField({
    field,
    value,
    onChange,
}: {
    field: ConfigField;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const label = (
        <>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
        </>
    );
    if (field.type === "boolean")
        return (
            <label className="flex items-center gap-3 rounded-lg border p-3">
                <Switch
                    checked={Boolean(Number(value || 0))}
                    onCheckedChange={(checked) => onChange(checked ? 1 : 0)}
                />
                <span>
                    <strong className="block text-sm">{label}</strong>
                    {field.help && (
                        <small className="text-muted-foreground">
                            {field.help}
                        </small>
                    )}
                </span>
            </label>
        );
    if (field.type === "select") {
        const optionValue = (index: number) => `__gateway_option_${index}`;
        const selectedIndex = field.options.findIndex(
            (option) => String(option.value) === String(value),
        );
        const options: SelectOption[] = field.options.map((option, index) => ({
            value: optionValue(index),
            label: String(option.label ?? option.value ?? ""),
        }));
        return (
            <SelectField
                label={label}
                value={selectedIndex >= 0 ? optionValue(selectedIndex) : ""}
                onValueChange={(next) => {
                    const index = Number(next.replace("__gateway_option_", ""));
                    onChange(field.options[index]?.value ?? next);
                }}
                options={options}
                hint={field.help}
            />
        );
    }
    if (field.type === "lines")
        return (
            <div className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium">{label}</span>
                <Textarea
                    value={
                        Array.isArray(value)
                            ? value.join("\n")
                            : String(value || "")
                    }
                    rows={5}
                    onChange={(event) =>
                        onChange(
                            event.target.value
                                .split("\n")
                                .map((line) => line.trim())
                                .filter(Boolean),
                        )
                    }
                    placeholder={field.placeholder}
                />
                {field.help && (
                    <small className="text-muted-foreground">
                        {field.help}
                    </small>
                )}
            </div>
        );
    if (field.type === "textarea")
        return (
            <div className="grid gap-2 sm:col-span-2">
                <span className="text-sm font-medium">{label}</span>
                <Textarea
                    value={String(value || "")}
                    rows={5}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={field.placeholder}
                />
                {field.help && (
                    <small className="text-muted-foreground">
                        {field.help}
                    </small>
                )}
            </div>
        );
    if (field.type === "json") {
        return (
            <JsonGatewayField field={field} value={value} onChange={onChange} />
        );
    }
    return (
        <div className="grid gap-2">
            <span className="text-sm font-medium">{label}</span>
            <Input
                value={String(value ?? "")}
                type={
                    field.type === "number"
                        ? "number"
                        : field.type === "password"
                          ? "password"
                          : "text"
                }
                placeholder={field.placeholder}
                onChange={(event) =>
                    onChange(
                        field.type === "number" && event.target.value !== ""
                            ? Number(event.target.value)
                            : event.target.value,
                    )
                }
            />
            {field.help && (
                <small className="text-muted-foreground">{field.help}</small>
            )}
        </div>
    );
}

function JsonGatewayField({
    field,
    value,
    onChange,
}: {
    field: ConfigField;
    value: unknown;
    onChange: (value: unknown) => void;
}) {
    const serialize = (current: unknown) =>
        typeof current === "string"
            ? current
            : JSON.stringify(current ?? {}, null, 2);
    const [raw, setRaw] = useState(() => serialize(value));
    useEffect(() => setRaw(serialize(value)), [value]);
    const label = (
        <>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
        </>
    );
    return (
        <div className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium">{label}</span>
            <Textarea
                className="font-mono"
                value={raw}
                rows={7}
                onChange={(event) => setRaw(event.target.value)}
                onBlur={() => {
                    try {
                        onChange(JSON.parse(raw));
                    } catch {
                        onChange(raw);
                    }
                }}
                placeholder={field.placeholder}
            />
            {field.help && (
                <small className="text-muted-foreground">{field.help}</small>
            )}
        </div>
    );
}
