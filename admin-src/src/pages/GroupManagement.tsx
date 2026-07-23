import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, Plus, RefreshCw, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
    formatUnixTime,
    type UnknownRecord,
} from "./react-page-helpers";

type GroupRow = UnknownRecord & {
    linkedNodes: UnknownRecord[];
    linkedPlans: UnknownRecord[];
    used: boolean;
};

export default function GroupManagement() {
    const [groups, setGroups] = useState<UnknownRecord[]>([]);
    const [nodes, setNodes] = useState<UnknownRecord[]>([]);
    const [plans, setPlans] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [keyword, setKeyword] = useState("");
    const [usageFilter, setUsageFilter] = useState("all");
    const [showForm, setShowForm] = useState(false);
    const [detail, setDetail] = useState<GroupRow | null>(null);
    const [form, setForm] = useState<{ id: number | null; name: string }>({
        id: null,
        name: "",
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [groupData, nodeData, planData] = await Promise.all([
                get("/server/group/fetch"),
                get("/server/manage/getNodes"),
                get("/plan/fetch"),
            ]);
            setGroups(Array.isArray(groupData) ? groupData : []);
            setNodes(Array.isArray(nodeData) ? nodeData : []);
            setPlans(Array.isArray(planData) ? planData : []);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        void load();
    }, [load]);
    const items = useMemo<GroupRow[]>(
        () =>
            groups.map((group) => {
                const linkedNodes = nodes.filter((node) =>
                    (node.group_ids || [])
                        .map(Number)
                        .includes(Number(group.id)),
                );
                const linkedPlans = plans.filter(
                    (plan) => Number(plan.group_id) === Number(group.id),
                );
                return {
                    ...group,
                    linkedNodes,
                    linkedPlans,
                    used:
                        Number(group.users_count || 0) > 0 ||
                        linkedNodes.length > 0 ||
                        linkedPlans.length > 0,
                };
            }),
        [groups, nodes, plans],
    );
    const filtered = useMemo(
        () =>
            items.filter((item) => {
                const term = keyword.trim().toLowerCase();
                return (
                    (!term || String(item.name).toLowerCase().includes(term)) &&
                    (usageFilter === "all" ||
                        (usageFilter === "used" ? item.used : !item.used))
                );
            }),
        [items, keyword, usageFilter],
    );
    const stats = useMemo(
        () => ({
            total: groups.length,
            users: groups.reduce(
                (sum, item) => sum + Number(item.users_count || 0),
                0,
            ),
            nodes: new Set(
                items.flatMap((item) =>
                    item.linkedNodes.map((node) => node.id),
                ),
            ).size,
            unused: items.filter((item) => !item.used).length,
        }),
        [groups, items],
    );
    const close = () => {
        setShowForm(false);
        setForm({ id: null, name: "" });
    };
    const save = async () => {
        if (!form.name.trim()) return toast.error("权限组名称不能为空");
        setSaving(true);
        try {
            await post("/server/group/save", form);
            toast.success(form.id ? "权限组已更新" : "权限组已创建");
            close();
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const remove = async (group: GroupRow): Promise<void> => {
        if (group.used) {
            toast.error("该权限组仍有关联用户、节点或套餐，无法删除");
            return;
        }
        try {
            await post("/server/group/drop", { id: group.id });
            toast.success("权限组已删除");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="权限组管理"
                description="管理用户可访问的节点范围，并检查套餐、用户与节点关联。"
                action={
                    <Button
                        onClick={() => {
                            setForm({ id: null, name: "" });
                            setShowForm(true);
                        }}
                    >
                        <Plus />
                        添加权限组
                    </Button>
                }
            />
            <MetricGrid>
                <MetricCard label="权限组" value={stats.total} />
                <MetricCard label="关联用户" value={stats.users} />
                <MetricCard label="已分配节点" value={stats.nodes} />
                <MetricCard label="未使用组" value={stats.unused} />
            </MetricGrid>
            <Panel>
                <div className="group-toolbar grid gap-3 md:grid-cols-[1fr_14rem_auto] md:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="权限组名称"
                        />
                    </div>
                    <SelectField
                        label="使用状态"
                        value={usageFilter}
                        onValueChange={setUsageFilter}
                        options={[
                            { value: "all", label: "全部状态" },
                            { value: "used", label: "正在使用" },
                            { value: "unused", label: "未使用" },
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
                    用户通过权限组获得节点访问范围；套餐绑定权限组后，购买该套餐的用户会继承对应权限。
                </div>
            </Panel>
            {loading ? (
                <Panel>
                    <EmptyState>正在加载权限组…</EmptyState>
                </Panel>
            ) : filtered.length === 0 ? (
                <Panel>
                    <EmptyState>暂无符合条件的权限组</EmptyState>
                </Panel>
            ) : (
                <div className="group-grid grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((group) => (
                        <Panel key={group.id}>
                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                        <Shield className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate font-semibold">
                                            {group.name}
                                        </h2>
                                        <span className="text-xs text-muted-foreground">
                                            #{group.id} ·{" "}
                                            {formatUnixTime(
                                                Number(group.updated_at),
                                            )}
                                        </span>
                                    </div>
                                    <StatusBadge
                                        tone={
                                            group.used ? "default" : "neutral"
                                        }
                                    >
                                        {group.used ? "正在使用" : "未使用"}
                                    </StatusBadge>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        ["用户", group.users_count || 0],
                                        ["节点", group.linkedNodes.length],
                                        ["套餐", group.linkedPlans.length],
                                    ].map(([label, value]) => (
                                        <Button
                                            key={String(label)}
                                            variant="outline"
                                            className="h-auto flex-col py-2"
                                            onClick={() => setDetail(group)}
                                        >
                                            <span className="text-xs text-muted-foreground">
                                                {label}
                                            </span>
                                            <strong>{value}</strong>
                                        </Button>
                                    ))}
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDetail(group)}
                                    >
                                        查看关联
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setForm({
                                                id: Number(group.id),
                                                name: String(group.name),
                                            });
                                            setShowForm(true);
                                        }}
                                    >
                                        重命名
                                    </Button>
                                    <ConfirmAction
                                        title="删除权限组"
                                        description={`确定删除权限组「${group.name}」？`}
                                        confirmText="删除"
                                        disabled={group.used}
                                        onConfirm={() => remove(group)}
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
                onOpenChange={(open) => (open ? setShowForm(true) : close())}
                title={form.id ? "重命名权限组" : "添加权限组"}
                description="创建后可在节点和订阅套餐中绑定该权限组。"
                className="sm:max-w-md"
                footer={
                    <>
                        <Button variant="outline" onClick={close}>
                            取消
                        </Button>
                        <Button disabled={saving} onClick={() => void save()}>
                            {saving ? "保存中…" : "保存权限组"}
                        </Button>
                    </>
                }
            >
                <Input
                    value={form.name}
                    onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                    }
                    placeholder="例如：高级线路"
                    onKeyDown={(event) => event.key === "Enter" && void save()}
                />
            </PageDialog>
            <PageDialog
                open={Boolean(detail)}
                onOpenChange={(open) => !open && setDetail(null)}
                title={`${detail?.name || "权限组"} · 关联资源`}
                description="删除权限组前必须解除以下全部关联。"
                className="sm:max-w-3xl"
            >
                {detail && (
                    <div className="space-y-5">
                        <MetricGrid>
                            <MetricCard
                                label="用户"
                                value={detail.users_count || 0}
                            />
                            <MetricCard
                                label="节点"
                                value={detail.linkedNodes.length}
                            />
                            <MetricCard
                                label="套餐"
                                value={detail.linkedPlans.length}
                            />
                        </MetricGrid>
                        <div>
                            <h3 className="mb-2 font-medium">关联节点</h3>
                            {detail.linkedNodes.length ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>节点</TableHead>
                                            <TableHead>地址</TableHead>
                                            <TableHead>状态</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detail.linkedNodes.map((node) => (
                                            <TableRow key={node.id}>
                                                <TableCell className="font-medium">
                                                    {node.name}
                                                </TableCell>
                                                <TableCell>
                                                    <code>
                                                        {node.type} ·{" "}
                                                        {node.host}:{node.port}
                                                    </code>
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge
                                                        tone={
                                                            Number(node.show)
                                                                ? "default"
                                                                : "neutral"
                                                        }
                                                    >
                                                        {Number(node.show)
                                                            ? "已上架"
                                                            : "已下架"}
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
                            <h3 className="mb-2 font-medium">关联套餐</h3>
                            {detail.linkedPlans.length ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>套餐</TableHead>
                                            <TableHead>用户</TableHead>
                                            <TableHead>状态</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detail.linkedPlans.map((plan) => (
                                            <TableRow key={plan.id}>
                                                <TableCell className="font-medium">
                                                    {plan.name}
                                                </TableCell>
                                                <TableCell>
                                                    {plan.users_count || 0}{" "}
                                                    位用户
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge
                                                        tone={
                                                            Number(plan.show)
                                                                ? "default"
                                                                : "neutral"
                                                        }
                                                    >
                                                        {Number(plan.show)
                                                            ? "销售中"
                                                            : "已隐藏"}
                                                    </StatusBadge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <EmptyState>暂无关联套餐</EmptyState>
                            )}
                        </div>
                        {Number(detail.users_count) > 0 && (
                            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                另有 {detail.users_count}{" "}
                                位用户直接绑定此权限组，请在用户管理中调整。
                            </p>
                        )}
                    </div>
                )}
            </PageDialog>
        </PageShell>
    );
}
