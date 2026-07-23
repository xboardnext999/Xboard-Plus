import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { get, request } from "@/services/http";
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
    errorMessage,
    formatUnixTime,
    type UnknownRecord,
} from "./react-page-helpers";

export default function DigitalDeliveryManagement() {
    const [rows, setRows] = useState<UnknownRecord[]>([]);
    const [products, setProducts] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState<UnknownRecord | null>(null);
    const [filters, setFilters] = useState({ keyword: "", plan_id: "" });
    const [page, setPage] = useState({
        current: 1,
        size: 20,
        total: 0,
        last: 1,
    });
    const packageName = (item: UnknownRecord) =>
        item.plan?.product_config?.packages?.find(
            (itemPackage: UnknownRecord) =>
                String(itemPackage.id) === String(item.package_id),
        )?.name || "通用库存";
    const deliveredToday = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        return rows.filter(
            (item) => Number(item.sold_at) * 1000 >= start.getTime(),
        ).length;
    }, [rows]);

    const load = useCallback(
        async (
            reset = false,
            requestedPage?: number,
            filterSource = filters,
        ) => {
            const current = reset ? 1 : (requestedPage ?? page.current);
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    current: String(current),
                    pageSize: String(page.size),
                });
                if (filterSource.keyword)
                    params.set("keyword", filterSource.keyword);
                if (filterSource.plan_id)
                    params.set("plan_id", filterSource.plan_id);
                const data = (await request(
                    `/digital-products/deliveries?${params}`,
                )) as UnknownRecord;
                const source = (data?.data ?? data) as
                    | UnknownRecord
                    | UnknownRecord[];
                const items = Array.isArray(source)
                    ? source
                    : source.items || source.data || [];
                const total = Number(
                    Array.isArray(source)
                        ? items.length
                        : source.total || items.length,
                );
                const last = Number(
                    Array.isArray(source)
                        ? Math.max(1, Math.ceil(total / page.size))
                        : source.last_page ||
                              Math.max(1, Math.ceil(total / page.size)),
                );
                setRows(items);
                setPage((previous) => ({ ...previous, current, total, last }));
            } catch (error) {
                toast.error(errorMessage(error));
            } finally {
                setLoading(false);
            }
        },
        [filters, page.current, page.size],
    );

    useEffect(() => {
        void Promise.all([
            load(true),
            get("/digital-products/fetch")
                .then((data: unknown) =>
                    setProducts(Array.isArray(data) ? data : []),
                )
                .catch((error: unknown) => toast.error(errorMessage(error))),
        ]);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <PageShell>
            <PageHeader
                title="交付记录"
                description="查看数字商品实际交付内容、购买用户和关联订单。"
            />
            <MetricGrid>
                <MetricCard label="交付记录" value={page.total} />
                <MetricCard label="本页交付" value={rows.length} />
                <MetricCard label="今日交付" value={deliveredToday} />
            </MetricGrid>
            <Panel className="digital-delivery-filters">
                <div className="grid gap-3 md:grid-cols-[1fr_18rem_auto] md:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={filters.keyword}
                            placeholder="邮箱、订单号或交付内容"
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
                    <SelectField
                        label="数字商品"
                        value={filters.plan_id}
                        onValueChange={(plan_id) => {
                            const next = { ...filters, plan_id };
                            setFilters(next);
                            void load(true, 1, next);
                        }}
                        options={[
                            { value: "", label: "全部商品" },
                            ...products.map((product) => ({
                                value: product.id,
                                label: product.name,
                            })),
                        ]}
                    />
                    <Button onClick={() => void load(true)}>
                        <Search />
                        查询
                    </Button>
                </div>
            </Panel>
            <Panel className="digital-delivery-table">
                {loading ? (
                    <EmptyState>正在加载交付记录…</EmptyState>
                ) : rows.length === 0 ? (
                    <EmptyState>暂无交付记录</EmptyState>
                ) : (
                    <div className="divide-y">
                        {rows.map((item) => (
                            <div
                                key={item.id}
                                className="digital-stock-row flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <strong className="block truncate">
                                        {item.plan?.name || "已删除商品"} ·{" "}
                                        {packageName(item)}
                                    </strong>
                                    <small className="text-muted-foreground">
                                        {item.user?.email ||
                                            `用户 #${item.user_id}`}{" "}
                                        ·{" "}
                                        {item.order?.trade_no ||
                                            `订单 #${item.order_id}`}{" "}
                                        · {formatUnixTime(Number(item.sold_at))}
                                    </small>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDetail(item)}
                                >
                                    查看内容
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>
            {page.last > 1 && (
                <Pagination
                    current={page.current}
                    last={page.last}
                    total={page.total}
                    loading={loading}
                    onChange={(current) => void load(false, current)}
                />
            )}
            <PageDialog
                open={Boolean(detail)}
                onOpenChange={(open) => !open && setDetail(null)}
                title="交付内容"
                description={
                    detail
                        ? `${detail.plan?.name || "已删除商品"} · ${packageName(detail)}`
                        : ""
                }
            >
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
                    {detail?.content}
                </pre>
            </PageDialog>
        </PageShell>
    );
}
