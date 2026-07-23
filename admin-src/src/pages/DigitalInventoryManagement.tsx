import { useCallback, useEffect, useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { get, post, request } from "@/services/http";
import {
    ConfirmAction,
    EmptyState,
    MetricCard,
    MetricGrid,
    PageHeader,
    PageShell,
    Pagination,
    Panel,
    SelectField,
    errorMessage,
    type UnknownRecord,
} from "./react-page-helpers";

export default function DigitalInventoryManagement() {
    const [products, setProducts] = useState<UnknownRecord[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [items, setItems] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [stockText, setStockText] = useState("");
    const [stockPackage, setStockPackage] = useState("");
    const [filters, setFilters] = useState({ keyword: "", status: "" });
    const [page, setPage] = useState({
        current: 1,
        size: 20,
        total: 0,
        last: 1,
    });
    const selectedProduct = useMemo(
        () =>
            products.find((item) => String(item.id) === String(selectedId)) ||
            null,
        [products, selectedId],
    );

    const loadProducts = useCallback(async () => {
        try {
            const data = await get("/digital-products/fetch");
            const next = Array.isArray(data) ? data : [];
            setProducts(next);
            setSelectedId((previous) => previous || String(next[0]?.id || ""));
            return String(selectedId || next[0]?.id || "");
        } catch (error) {
            toast.error(errorMessage(error));
            return "";
        }
    }, [selectedId]);

    const loadStock = useCallback(
        async (
            reset = false,
            requestedPage?: number,
            productId?: string,
            filterSource = filters,
        ) => {
            const planId = productId ?? selectedId;
            if (!planId) {
                setItems([]);
                return;
            }
            const current = reset ? 1 : (requestedPage ?? page.current);
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    plan_id: planId,
                    current: String(current),
                    pageSize: String(page.size),
                });
                if (filterSource.keyword)
                    params.set("keyword", filterSource.keyword);
                if (filterSource.status)
                    params.set("status", filterSource.status);
                const data = (await request(
                    `/digital-products/stock?${params}`,
                )) as UnknownRecord;
                const source = (data?.data ?? data) as
                    | UnknownRecord
                    | UnknownRecord[];
                const next = Array.isArray(source)
                    ? source
                    : source.items || source.data || [];
                const total = Number(
                    Array.isArray(source)
                        ? next.length
                        : source.total || next.length,
                );
                setItems(next);
                setPage((previous) => ({
                    ...previous,
                    current,
                    total,
                    last: Number(
                        Array.isArray(source)
                            ? Math.max(1, Math.ceil(total / previous.size))
                            : source.last_page ||
                                  Math.max(1, Math.ceil(total / previous.size)),
                    ),
                }));
            } catch (error) {
                toast.error(errorMessage(error));
            } finally {
                setLoading(false);
            }
        },
        [filters, page.current, page.size, selectedId],
    );

    useEffect(() => {
        void loadProducts().then((id) => loadStock(true, 1, id));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const refresh = async () => {
        await Promise.all([loadStock(), loadProducts()]);
    };
    const importStock = async () => {
        if (!selectedProduct || !stockText.trim()) return;
        setImporting(true);
        try {
            await post("/digital-products/stock/import", {
                plan_id: selectedProduct.id,
                package_id: stockPackage || null,
                content: stockText,
            });
            setStockText("");
            setStockPackage("");
            toast.success("库存导入成功");
            await refresh();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setImporting(false);
        }
    };
    const remove = async (item: UnknownRecord) => {
        try {
            await post("/digital-products/stock/drop", { id: item.id });
            toast.success("库存已删除");
            await refresh();
        } catch (error) {
            toast.error(errorMessage(error));
        }
    };
    const packageName = (id: unknown) =>
        selectedProduct?.product_config?.packages?.find(
            (item: UnknownRecord) => String(item.id) === String(id),
        )?.name || "通用库存";
    const available = Number(selectedProduct?.stock_count || 0);
    const sold = Number(selectedProduct?.sold_count || 0);

    return (
        <PageShell>
            <PageHeader
                title="库存管理"
                description="统一管理数字商品库存、套餐归属和交付状态。"
            />
            <Panel className="digital-inventory-toolbar">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <SelectField
                        label="选择商品"
                        value={selectedId}
                        onValueChange={(id) => {
                            setSelectedId(id);
                            setStockPackage("");
                            void loadStock(true, 1, id);
                        }}
                        options={[
                            { value: "", label: "请选择数字商品" },
                            ...products.map((product) => ({
                                value: product.id,
                                label: product.name,
                            })),
                        ]}
                    />
                    <SelectField
                        label="导入到套餐"
                        value={stockPackage}
                        disabled={!selectedProduct}
                        onValueChange={setStockPackage}
                        options={[
                            { value: "", label: "通用库存" },
                            ...(
                                selectedProduct?.product_config?.packages || []
                            ).map((item: UnknownRecord) => ({
                                value: item.id,
                                label: item.name,
                            })),
                        ]}
                    />
                    <Button
                        disabled={
                            importing || !selectedProduct || !stockText.trim()
                        }
                        onClick={() => void importStock()}
                    >
                        <PackagePlus />
                        {importing ? "导入中…" : "导入库存"}
                    </Button>
                </div>
            </Panel>
            {selectedProduct && (
                <MetricGrid>
                    <MetricCard label="库存总数" value={available + sold} />
                    <MetricCard label="可交付" value={available} />
                    <MetricCard label="已交付" value={sold} />
                </MetricGrid>
            )}
            <Panel className="digital-inventory-import">
                <Textarea
                    rows={4}
                    value={stockText}
                    onChange={(event) => setStockText(event.target.value)}
                    placeholder={"每行一条库存内容，例如：CODE-001\nCODE-002"}
                />
            </Panel>
            <Panel className="digital-inventory-table">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="font-medium">
                            {selectedProduct?.name || "库存记录"}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            已售库存仅保留记录，不允许删除。
                        </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                        {page.total} 条记录
                    </span>
                </div>
                <div className="mb-4 grid gap-3 md:grid-cols-[1fr_12rem_auto] md:items-end">
                    <Input
                        value={filters.keyword}
                        placeholder="搜索库存内容"
                        onChange={(event) =>
                            setFilters({
                                ...filters,
                                keyword: event.target.value,
                            })
                        }
                        onKeyDown={(event) =>
                            event.key === "Enter" && void loadStock(true)
                        }
                    />
                    <SelectField
                        label="交付状态"
                        value={filters.status}
                        onValueChange={(status) => {
                            const next = { ...filters, status };
                            setFilters(next);
                            void loadStock(true, 1, undefined, next);
                        }}
                        options={[
                            { value: "", label: "全部状态" },
                            { value: "available", label: "未交付" },
                            { value: "sold", label: "已交付" },
                        ]}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void loadStock(true)}
                    >
                        <Search />
                        查询
                    </Button>
                </div>
                {loading ? (
                    <EmptyState>正在加载库存…</EmptyState>
                ) : items.length === 0 ? (
                    <EmptyState>暂无库存记录</EmptyState>
                ) : (
                    <div className="divide-y">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="digital-stock-row flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <strong className="block truncate">
                                        {item.content}
                                    </strong>
                                    <small className="text-muted-foreground">
                                        {packageName(item.package_id)} ·{" "}
                                        {item.status === "available"
                                            ? "未交付"
                                            : "已交付"}
                                    </small>
                                </div>
                                {item.status === "available" && (
                                    <ConfirmAction
                                        title="删除未售库存"
                                        description="确定删除这条未售库存吗？该操作无法撤销。"
                                        confirmText="删除"
                                        onConfirm={() => remove(item)}
                                    >
                                        删除
                                    </ConfirmAction>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {page.last > 1 && (
                    <div className="mt-4">
                        <Pagination
                            current={page.current}
                            last={page.last}
                            total={page.total}
                            loading={loading}
                            onChange={(current) =>
                                void loadStock(false, current)
                            }
                        />
                    </div>
                )}
            </Panel>
        </PageShell>
    );
}
