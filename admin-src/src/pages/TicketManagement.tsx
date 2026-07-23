import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminApi, authToken, get, post } from "@/services/http";
import {
    ConfirmAction,
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
    formatUnixTime,
    type UnknownRecord,
} from "./react-page-helpers";

const LEVELS: Record<number, [string, "neutral" | "warning" | "danger"]> = {
    0: ["低", "neutral"],
    1: ["中", "warning"],
    2: ["高", "danger"],
};

export default function TicketManagement() {
    const [tickets, setTickets] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<number | null>(null);
    const [selected, setSelected] = useState<UnknownRecord | null>(null);
    const [showConversation, setShowConversation] = useState(false);
    const [replying, setReplying] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [filters, setFilters] = useState({
        keyword: "",
        status: "all",
        reply_status: "all",
        level: "all",
    });
    const [page, setPage] = useState({
        current: 1,
        size: 20,
        total: 0,
        last: 1,
    });
    const stats = useMemo(
        () => ({
            page: tickets.length,
            waiting: tickets.filter(
                (ticket) =>
                    Number(ticket.status) === 0 &&
                    Number(ticket.reply_status) === 0,
            ).length,
            replied: tickets.filter(
                (ticket) => Number(ticket.reply_status) === 1,
            ).length,
            closed: tickets.filter((ticket) => Number(ticket.status) === 1)
                .length,
        }),
        [tickets],
    );
    const level = (ticket: UnknownRecord) =>
        LEVELS[Number(ticket.level)] || (["未知", "neutral"] as const);

    const query = useCallback(
        (current: number) => {
            const queryParams = new URLSearchParams({
                current: String(current),
                pageSize: String(page.size),
            });
            if (filters.status !== "all")
                queryParams.set("status", filters.status);
            if (filters.reply_status !== "all")
                queryParams.append("reply_status[]", filters.reply_status);
            if (filters.keyword.includes("@"))
                queryParams.set("email", filters.keyword.trim());
            else if (filters.keyword) {
                queryParams.set(
                    "filter[0][id]",
                    /^\d+$/.test(filters.keyword) ? "id" : "subject",
                );
                queryParams.set("filter[0][value]", filters.keyword);
            }
            if (filters.level !== "all") {
                const index =
                    filters.keyword && !filters.keyword.includes("@") ? 1 : 0;
                queryParams.set(`filter[${index}][id]`, "level");
                queryParams.set(`filter[${index}][value]`, filters.level);
            }
            return queryParams.toString();
        },
        [filters, page.size],
    );
    const fetchRaw = async (path: string) => {
        const response = await fetch(adminApi(path), {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${authToken().replace(/^Bearer /, "")}`,
            },
        });
        const json = (await response.json().catch(() => ({}))) as UnknownRecord;
        if (
            !response.ok ||
            json.status === "fail" ||
            (json.code && Number(json.code) !== 0)
        )
            throw new Error(String(json.message || "请求失败"));
        return json;
    };
    const load = useCallback(
        async (
            reset = false,
            requestedPage?: number,
            filterOverride?: typeof filters,
        ) => {
            const current = reset ? 1 : (requestedPage ?? page.current);
            setLoading(true);
            try {
                let queryString: string;
                if (filterOverride) {
                    const params = new URLSearchParams({
                        current: String(current),
                        pageSize: String(page.size),
                    });
                    if (filterOverride.status !== "all")
                        params.set("status", filterOverride.status);
                    if (filterOverride.reply_status !== "all")
                        params.append(
                            "reply_status[]",
                            filterOverride.reply_status,
                        );
                    if (filterOverride.keyword.includes("@"))
                        params.set("email", filterOverride.keyword.trim());
                    else if (filterOverride.keyword) {
                        params.set(
                            "filter[0][id]",
                            /^\d+$/.test(filterOverride.keyword)
                                ? "id"
                                : "subject",
                        );
                        params.set("filter[0][value]", filterOverride.keyword);
                    }
                    if (filterOverride.level !== "all") {
                        const index =
                            filterOverride.keyword &&
                            !filterOverride.keyword.includes("@")
                                ? 1
                                : 0;
                        params.set(`filter[${index}][id]`, "level");
                        params.set(
                            `filter[${index}][value]`,
                            filterOverride.level,
                        );
                    }
                    queryString = params.toString();
                } else queryString = query(current);
                const json = await fetchRaw(`/ticket/fetch?${queryString}`);
                const rows = Array.isArray(json.data) ? json.data : [];
                const total = Number(json.total || rows.length);
                setTickets(rows);
                setPage((previous) => ({
                    ...previous,
                    current,
                    total,
                    last: Math.max(1, Math.ceil(total / previous.size)),
                }));
            } catch (error) {
                toast.error(errorMessage(error));
            } finally {
                setLoading(false);
            }
        },
        [page.current, page.size, query],
    );
    useEffect(() => {
        void load(true);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const updateFilter = (
        key: keyof typeof filters,
        value: string,
        immediate = false,
    ) => {
        const next = { ...filters, [key]: value };
        setFilters(next);
        if (immediate) void load(true, 1, next);
    };
    const openTicket = async (ticket: UnknownRecord) => {
        setBusy(Number(ticket.id));
        try {
            setSelected(
                (await get("/ticket/fetch", {
                    id: ticket.id,
                })) as UnknownRecord,
            );
            setReplyText("");
            setShowConversation(true);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };
    const reply = async () => {
        const message = replyText.trim();
        if (!message) return toast.error("请输入回复内容");
        if (message.length > 10000)
            return toast.error("回复内容不能超过 10,000 字");
        if (!selected) return;
        setReplying(true);
        try {
            await post("/ticket/reply", { id: selected.id, message });
            toast.success("回复已发送，邮件通知已加入队列");
            setReplyText("");
            setSelected(
                (await get("/ticket/fetch", {
                    id: selected.id,
                })) as UnknownRecord,
            );
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setReplying(false);
        }
    };
    const closeTicket = async (ticket: UnknownRecord) => {
        setBusy(Number(ticket.id));
        try {
            await post("/ticket/close", { id: ticket.id });
            toast.success("工单已关闭");
            if (selected?.id === ticket.id) {
                setSelected((previous) =>
                    previous ? { ...previous, status: 1 } : null,
                );
                setShowConversation(false);
            }
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };
    const copy = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value || "");
            toast.success(`${label}已复制`);
        } catch {
            toast.error("复制失败，请手动复制");
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="工单管理"
                description="处理用户咨询、跟踪待回复工单，并查看完整沟通记录。"
                action={
                    <Button
                        variant="outline"
                        disabled={loading}
                        onClick={() => void load()}
                    >
                        <RefreshCw />
                        刷新工单
                    </Button>
                }
            />
            <MetricGrid>
                <MetricCard label="当前页工单" value={stats.page} />
                <MetricCard label="等待回复" value={stats.waiting} />
                <MetricCard label="已回复" value={stats.replied} />
                <MetricCard label="已关闭" value={stats.closed} />
            </MetricGrid>
            <Panel>
                <div className="ticket-toolbar grid gap-3 xl:grid-cols-[1fr_11rem_12rem_10rem_auto] xl:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={filters.keyword}
                            onChange={(event) =>
                                updateFilter("keyword", event.target.value)
                            }
                            placeholder="工单主题、ID 或完整用户邮箱"
                            onKeyDown={(event) =>
                                event.key === "Enter" && void load(true)
                            }
                        />
                    </div>
                    <SelectField
                        label="工单状态"
                        value={filters.status}
                        onValueChange={(value) =>
                            updateFilter("status", value, true)
                        }
                        options={[
                            { value: "all", label: "全部状态" },
                            { value: "0", label: "处理中" },
                            { value: "1", label: "已关闭" },
                        ]}
                    />
                    <SelectField
                        label="回复状态"
                        value={filters.reply_status}
                        onValueChange={(value) =>
                            updateFilter("reply_status", value, true)
                        }
                        options={[
                            { value: "all", label: "全部回复状态" },
                            { value: "0", label: "等待管理员" },
                            { value: "1", label: "管理员已回复" },
                        ]}
                    />
                    <SelectField
                        label="优先级"
                        value={filters.level}
                        onValueChange={(value) =>
                            updateFilter("level", value, true)
                        }
                        options={[
                            { value: "all", label: "全部优先级" },
                            { value: "0", label: "低" },
                            { value: "1", label: "中" },
                            { value: "2", label: "高" },
                        ]}
                    />
                    <Button variant="outline" onClick={() => void load(true)}>
                        查询
                    </Button>
                </div>
            </Panel>
            {loading ? (
                <Panel>
                    <EmptyState>正在加载工单…</EmptyState>
                </Panel>
            ) : tickets.length === 0 ? (
                <Panel>
                    <EmptyState>暂无符合条件的工单</EmptyState>
                </Panel>
            ) : (
                <div className="ticket-list space-y-3">
                    {tickets.map((ticket) => (
                        <Panel
                            key={ticket.id}
                            className={
                                Number(ticket.level) === 2 &&
                                Number(ticket.status) === 0
                                    ? "ring-destructive/40"
                                    : ""
                            }
                        >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                <Button
                                    variant="ghost"
                                    className="ticket-main h-auto min-w-0 flex-1 justify-start p-0 text-left"
                                    onClick={() => void openTicket(ticket)}
                                >
                                    <StatusBadge tone={level(ticket)[1]}>
                                        {level(ticket)[0]}
                                    </StatusBadge>
                                    <div className="min-w-0">
                                        <h2 className="truncate font-semibold">
                                            {ticket.subject}
                                        </h2>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {ticket.user?.email ||
                                                `用户 #${ticket.user_id}`}{" "}
                                            · 工单 #{ticket.id}
                                        </p>
                                    </div>
                                </Button>
                                <div className="ticket-state lg:text-right">
                                    <StatusBadge
                                        tone={
                                            Number(ticket.status) === 1
                                                ? "neutral"
                                                : Number(
                                                        ticket.reply_status,
                                                    ) === 0
                                                  ? "warning"
                                                  : "default"
                                        }
                                    >
                                        {Number(ticket.status) === 1
                                            ? "已关闭"
                                            : Number(ticket.reply_status) === 0
                                              ? "等待回复"
                                              : "已回复"}
                                    </StatusBadge>
                                    <small className="mt-1 block text-muted-foreground">
                                        更新{" "}
                                        {formatUnixTime(
                                            Number(ticket.updated_at),
                                        )}
                                    </small>
                                </div>
                                <div className="ticket-actions flex gap-2">
                                    <Button
                                        size="sm"
                                        disabled={busy === Number(ticket.id)}
                                        onClick={() => void openTicket(ticket)}
                                    >
                                        {Number(ticket.status) === 0
                                            ? "查看并回复"
                                            : "查看记录"}
                                    </Button>
                                    {Number(ticket.status) === 0 && (
                                        <ConfirmAction
                                            destructive={false}
                                            variant="outline"
                                            title="关闭工单"
                                            description={`确定关闭工单 #${ticket.id}「${ticket.subject}」？关闭后用户不能继续回复。`}
                                            confirmText="关闭工单"
                                            disabled={
                                                busy === Number(ticket.id)
                                            }
                                            onConfirm={() =>
                                                closeTicket(ticket)
                                            }
                                        >
                                            关闭工单
                                        </ConfirmAction>
                                    )}
                                </div>
                            </div>
                        </Panel>
                    ))}
                </div>
            )}
            <Pagination
                current={page.current}
                last={page.last}
                total={page.total}
                loading={loading}
                onChange={(current) => void load(false, current)}
            />
            <PageDialog
                open={showConversation && Boolean(selected)}
                onOpenChange={setShowConversation}
                title={String(selected?.subject || "工单详情")}
                description={
                    selected
                        ? `${selected.user?.email || `用户 #${selected.user_id}`} · 工单 #${selected.id} · ${level(selected)[0]}优先级`
                        : ""
                }
                className="sm:max-w-4xl"
            >
                {selected && (
                    <div className="space-y-4">
                        <div className="grid gap-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                            <span className="text-xs text-muted-foreground">
                                用户
                                <strong className="block text-sm text-foreground">
                                    {selected.user?.email}
                                </strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                套餐
                                <strong className="block text-sm text-foreground">
                                    {selected.user?.plan?.name ||
                                        `#${selected.user?.plan_id || "-"}`}
                                </strong>
                            </span>
                            <span className="text-xs text-muted-foreground">
                                余额
                                <strong className="block text-sm text-foreground">
                                    ¥
                                    {Number(
                                        selected.user?.balance || 0,
                                    ).toFixed(2)}
                                </strong>
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    void copy(
                                        String(selected.user?.email || ""),
                                        "邮箱",
                                    )
                                }
                            >
                                <Copy />
                                复制邮箱
                            </Button>
                        </div>
                        <div className="message-timeline max-h-[42vh] space-y-3 overflow-y-auto rounded-lg border p-3">
                            {!selected.messages?.length ? (
                                <EmptyState>暂无消息内容</EmptyState>
                            ) : (
                                selected.messages.map(
                                    (message: UnknownRecord) => (
                                        <article
                                            key={message.id}
                                            className={`max-w-[85%] rounded-lg p-3 ${message.is_from_admin ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}
                                        >
                                            <div className="mb-2 flex justify-between gap-4 text-xs">
                                                <strong>
                                                    {message.is_from_admin
                                                        ? "管理员"
                                                        : selected.user?.email}
                                                </strong>
                                                <small
                                                    className={
                                                        message.is_from_admin
                                                            ? "text-primary-foreground/70"
                                                            : "text-muted-foreground"
                                                    }
                                                >
                                                    {formatUnixTime(
                                                        Number(
                                                            message.created_at,
                                                        ),
                                                    )}
                                                </small>
                                            </div>
                                            <p className="whitespace-pre-wrap text-sm">
                                                {message.message}
                                            </p>
                                        </article>
                                    ),
                                )
                            )}
                        </div>
                        {Number(selected.status) === 0 ? (
                            <div className="ticket-reply space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">
                                        回复用户
                                    </span>
                                    <small className="text-muted-foreground">
                                        {replyText.length} / 10000
                                    </small>
                                </div>
                                <Textarea
                                    value={replyText}
                                    onChange={(event) =>
                                        setReplyText(event.target.value)
                                    }
                                    rows={5}
                                    maxLength={10000}
                                    placeholder="输入回复内容；发送后系统会异步通知用户邮箱。"
                                    onKeyDown={(event) => {
                                        if (
                                            event.ctrlKey &&
                                            event.key === "Enter"
                                        ) {
                                            event.preventDefault();
                                            void reply();
                                        }
                                    }}
                                />
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <small className="mr-auto text-muted-foreground">
                                        Ctrl + Enter 快速发送
                                    </small>
                                    <ConfirmAction
                                        destructive={false}
                                        variant="outline"
                                        title="关闭工单"
                                        description={`确定关闭工单 #${selected.id}「${selected.subject}」？关闭后用户不能继续回复。`}
                                        confirmText="关闭工单"
                                        onConfirm={() => closeTicket(selected)}
                                    >
                                        关闭工单
                                    </ConfirmAction>
                                    <Button
                                        disabled={replying || !replyText.trim()}
                                        onClick={() => void reply()}
                                    >
                                        {replying ? "发送中…" : "发送回复"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                                该工单已关闭，仅可查看历史消息。
                            </p>
                        )}
                    </div>
                )}
            </PageDialog>
        </PageShell>
    );
}
