import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Plus, RefreshCw, Route, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { get, post } from "@/services/http";
import {
    ConfirmAction,
    EmptyState,
    FormField,
    MetricCard,
    MetricGrid,
    PageDialog,
    PageHeader,
    PageShell,
    Panel,
    SelectField,
    StatusBadge,
    errorMessage,
    formatUnixTime,
    type UnknownRecord,
} from "./react-page-helpers";

const ACTIONS = [
    { value: "block", label: "阻断", hint: "拒绝匹配流量" },
    { value: "direct", label: "直连", hint: "不经过代理直接连接" },
    { value: "dns", label: "DNS", hint: "交给指定 DNS 处理" },
    { value: "proxy", label: "代理", hint: "转发到指定出站" },
];
type RouteRow = UnknownRecord & { linkedNodes: UnknownRecord[] };
const blank = () => ({
    id: null as number | null,
    remarks: "",
    match: [] as string[],
    action: "direct",
    action_value: "",
});

export default function RouteManagement() {
    const [routes, setRoutes] = useState<UnknownRecord[]>([]);
    const [nodes, setNodes] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [matchText, setMatchText] = useState("");
    const [form, setForm] = useState(blank());
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [routeData, nodeData] = await Promise.all([
                get("/server/route/fetch"),
                get("/server/manage/getNodes"),
            ]);
            setRoutes(Array.isArray(routeData) ? routeData : []);
            setNodes(Array.isArray(nodeData) ? nodeData : []);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const items = useMemo<RouteRow[]>(
        () =>
            routes.map((route) => ({
                ...route,
                linkedNodes: nodes.filter((node) =>
                    (node.route_ids || [])
                        .map(Number)
                        .includes(Number(route.id)),
                ),
            })),
        [nodes, routes],
    );
    const filtered = useMemo(
        () =>
            items.filter((item) => {
                const term = keyword.trim().toLowerCase();
                return (
                    (!term ||
                        `${item.remarks} ${(item.match || []).join(" ")}`
                            .toLowerCase()
                            .includes(term)) &&
                    (!actionFilter || item.action === actionFilter)
                );
            }),
        [actionFilter, items, keyword],
    );
    const stats = useMemo(
        () => ({
            total: routes.length,
            used: items.filter((item) => item.linkedNodes.length).length,
            rules: routes.reduce(
                (sum, item) => sum + (item.match || []).length,
                0,
            ),
            blocked: routes.filter((item) => item.action === "block").length,
        }),
        [items, routes],
    );
    const close = () => {
        setShowForm(false);
        setForm(blank());
        setMatchText("");
    };
    const open = (route?: RouteRow) => {
        if (route) {
            setForm({
                id: Number(route.id),
                remarks: String(route.remarks || ""),
                match: [...(route.match || [])],
                action: String(route.action || "direct"),
                action_value: String(route.action_value || ""),
            });
            setMatchText((route.match || []).join("\n"));
        } else {
            setForm(blank());
            setMatchText("");
        }
        setShowForm(true);
    };
    const useTemplate = (type: string) => {
        const templates: Record<string, string[]> = {
            cn: ["geosite:cn", "geoip:cn"],
            ads: ["geosite:category-ads-all"],
            private: ["geoip:private", "domain_suffix:local"],
            stream: ["geosite:netflix", "geosite:disney", "geosite:youtube"],
        };
        const current = matchText
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean);
        setMatchText(
            [...new Set([...current, ...(templates[type] || [])])].join("\n"),
        );
    };
    const save = async () => {
        const matches = [
            ...new Set(
                matchText
                    .split("\n")
                    .map((value) => value.trim())
                    .filter(Boolean),
            ),
        ];
        if (!form.remarks.trim() || !matches.length)
            return toast.error("规则名称和匹配项不能为空");
        if (["dns", "proxy"].includes(form.action) && !form.action_value.trim())
            return toast.error(
                `${form.action === "dns" ? "DNS" : "代理"}动作需要填写动作值`,
            );
        setSaving(true);
        try {
            await post("/server/route/save", {
                ...form,
                match: matches,
                action_value: form.action_value || null,
            });
            toast.success(form.id ? "路由规则已更新" : "路由规则已创建");
            close();
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const remove = async (route: RouteRow): Promise<void> => {
        if (route.linkedNodes.length) {
            toast.error(
                `该规则仍被 ${route.linkedNodes.length} 个节点引用，请先解除绑定`,
            );
            return;
        }
        try {
            await post("/server/route/drop", { id: route.id });
            toast.success("路由规则已删除");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };
    const actionMeta = (value: unknown) =>
        ACTIONS.find((item) => item.value === value) || {
            label: String(value),
            hint: "",
        };
    const matchKind = (value: unknown) =>
        ({
            geosite: "站点集",
            geoip: "IP 集",
            domain: "域名",
            domain_suffix: "域名后缀",
            domain_keyword: "域名关键字",
            ip_cidr: "IP 网段",
            port: "端口",
        })[String(value).split(":")[0] || ""] || "自定义";

    const templates = [
        ["cn", "+ 国内规则"],
        ["ads", "+ 广告拦截"],
        ["private", "+ 私有网络"],
        ["stream", "+ 流媒体"],
    ] as const;
    return (
        <PageShell>
            <PageHeader
                title="路由管理"
                description="按域名、IP、规则集或端口匹配流量，并决定阻断、直连、DNS 或代理动作。"
                action={
                    <Button onClick={() => open()}>
                        <Plus />
                        添加路由规则
                    </Button>
                }
            />
            <MetricGrid>
                <MetricCard label="路由规则" value={stats.total} />
                <MetricCard label="节点使用中" value={stats.used} />
                <MetricCard label="匹配项" value={stats.rules} />
                <MetricCard label="阻断规则" value={stats.blocked} />
            </MetricGrid>
            <Panel>
                <div className="route-toolbar grid gap-3 md:grid-cols-[1fr_14rem_auto] md:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="名称或匹配内容"
                        />
                    </div>
                    <SelectField
                        label="路由动作"
                        value={actionFilter}
                        onValueChange={setActionFilter}
                        options={[
                            { value: "", label: "全部动作" },
                            ...ACTIONS.map((item) => ({
                                value: item.value,
                                label: item.label,
                            })),
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
            <Panel>
                <div className="flex gap-2 text-sm text-muted-foreground">
                    <Info className="size-4 shrink-0 text-primary" />
                    规则更新后会自动通知已绑定节点同步配置；规则顺序由节点中的绑定顺序决定。
                </div>
            </Panel>
            {loading ? (
                <Panel>
                    <EmptyState>正在加载路由规则…</EmptyState>
                </Panel>
            ) : filtered.length === 0 ? (
                <Panel>
                    <EmptyState>暂无符合条件的路由规则</EmptyState>
                </Panel>
            ) : (
                <div className="route-grid grid gap-4 lg:grid-cols-2">
                    {filtered.map((route) => (
                        <Panel key={route.id}>
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <div
                                        className={`rounded-lg p-2 ${route.action === "block" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
                                    >
                                        {route.action === "block" ? (
                                            <ShieldX className="size-5" />
                                        ) : (
                                            <Route className="size-5" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate font-semibold">
                                            {route.remarks}
                                        </h2>
                                        <span className="text-xs text-muted-foreground">
                                            #{route.id} ·{" "}
                                            {formatUnixTime(
                                                Number(route.updated_at),
                                            )}
                                        </span>
                                    </div>
                                    <StatusBadge
                                        tone={
                                            route.action === "block"
                                                ? "danger"
                                                : "neutral"
                                        }
                                    >
                                        {actionMeta(route.action).label}
                                    </StatusBadge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {actionMeta(route.action).hint}
                                    {route.action_value && (
                                        <code> → {route.action_value}</code>
                                    )}
                                </p>
                                <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                                    {(route.match || []).map(
                                        (match: string) => (
                                            <Badge
                                                key={match}
                                                variant="outline"
                                                title={match}
                                            >
                                                {matchKind(match)} · {match}
                                            </Badge>
                                        ),
                                    )}
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            引用节点
                                        </span>
                                        <strong>
                                            {route.linkedNodes.length}
                                        </strong>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {route.linkedNodes
                                            .slice(0, 4)
                                            .map((node) => (
                                                <Badge
                                                    key={node.id}
                                                    variant="secondary"
                                                >
                                                    {node.name}
                                                </Badge>
                                            ))}
                                        {route.linkedNodes.length > 4 && (
                                            <Badge variant="secondary">
                                                +{route.linkedNodes.length - 4}
                                            </Badge>
                                        )}
                                        {route.linkedNodes.length === 0 && (
                                            <small className="text-muted-foreground">
                                                尚未绑定节点
                                            </small>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => open(route)}
                                    >
                                        编辑规则
                                    </Button>
                                    <ConfirmAction
                                        title="删除路由规则"
                                        description={`确定删除路由规则「${route.remarks}」？`}
                                        confirmText="删除"
                                        disabled={route.linkedNodes.length > 0}
                                        onConfirm={() => remove(route)}
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
                title={form.id ? "编辑路由规则" : "添加路由规则"}
                description="每行填写一个匹配项，支持规则集、域名、IP 网段等格式。"
                className="sm:max-w-3xl"
                footer={
                    <>
                        <Button variant="outline" onClick={close}>
                            取消
                        </Button>
                        <Button disabled={saving} onClick={() => void save()}>
                            {saving ? "保存中…" : "保存路由规则"}
                        </Button>
                    </>
                }
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-2">
                        <span className="text-sm font-medium">规则名称</span>
                        <Input
                            value={form.remarks}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    remarks: event.target.value,
                                })
                            }
                            placeholder="例如：国内流量直连"
                        />
                    </div>
                    <SelectField
                        label="执行动作"
                        value={form.action}
                        onValueChange={(action) => setForm({ ...form, action })}
                        options={ACTIONS.map((action) => ({
                            value: action.value,
                            label: `${action.label} — ${action.hint}`,
                        }))}
                    />
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">动作值</span>
                        <Input
                            value={form.action_value}
                            disabled={["block", "direct"].includes(form.action)}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    action_value: event.target.value,
                                })
                            }
                            placeholder={
                                form.action === "dns"
                                    ? "DNS 服务器标签"
                                    : form.action === "proxy"
                                      ? "代理出站标签"
                                      : "当前动作无需填写"
                            }
                        />
                        <small className="text-muted-foreground">
                            DNS 和代理动作必填
                        </small>
                    </div>
                    <FormField
                        label="匹配项"
                        hint="重复项和空行会在保存时自动清理。"
                        className="sm:col-span-2"
                    >
                        <div className="mb-2 flex flex-wrap gap-2">
                            {templates.map(([type, label]) => (
                                <Button
                                    key={type}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => useTemplate(type)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                        <Textarea
                            value={matchText}
                            onChange={(event) =>
                                setMatchText(event.target.value)
                            }
                            rows={12}
                            placeholder={
                                "geosite:cn\ngeoip:cn\ndomain_suffix:example.com\nip_cidr:10.0.0.0/8"
                            }
                        />
                    </FormField>
                </div>
            </PageDialog>
        </PageShell>
    );
}
