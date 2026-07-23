import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Copy,
    Download,
    KeyRound,
    MoreHorizontal,
    RefreshCw,
    RotateCcw,
    ShieldAlert,
    Trash2,
    UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { get, post, request } from "@/services/http";
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
    type UnknownRecord,
} from "./react-page-helpers";

const GIB = 1024 ** 3;
type UserForm = {
    id: number | null;
    email: string;
    password: string;
    plan_id: string | number;
    transfer_gb: number;
    upload_gb: number;
    download_gb: number;
    expired_at: string;
    balance: number;
    commission_balance: number;
    commission_rate: number | string | null;
    discount: number | string | null;
    speed_limit: number;
    device_limit: number;
    banned: boolean;
    is_staff: boolean;
    is_admin: boolean;
    invite_user_email: string;
    remarks: string;
};
type CreateForm = {
    batch: boolean;
    email: string;
    email_prefix: string;
    email_suffix: string;
    generate_count: number;
    password: string;
    plan_id: string | number;
    expired_at: string;
    download_csv: boolean;
};
type CreatePayload = {
    email_prefix: string;
    email_suffix: string;
    password?: string;
    plan_id: string | number | null;
    expired_at: number | null;
    generate_count?: number;
};
type PendingConfirm =
    | { kind: "ban"; user: UnknownRecord; banned: boolean }
    | { kind: "secret"; user: UnknownRecord }
    | { kind: "traffic"; user: UnknownRecord }
    | { kind: "bulk"; banned: boolean }
    | { kind: "privilege" }
    | { kind: "create"; payload: CreatePayload; label: string };

const blankForm = (): UserForm => ({
    id: null,
    email: "",
    password: "",
    plan_id: "",
    transfer_gb: 0,
    upload_gb: 0,
    download_gb: 0,
    expired_at: "",
    balance: 0,
    commission_balance: 0,
    commission_rate: null,
    discount: null,
    speed_limit: 0,
    device_limit: 0,
    banned: false,
    is_staff: false,
    is_admin: false,
    invite_user_email: "",
    remarks: "",
});
const blankCreate = (): CreateForm => ({
    batch: false,
    email: "",
    email_prefix: "user",
    email_suffix: "example.com",
    generate_count: 10,
    password: "",
    plan_id: "",
    expired_at: "",
    download_csv: true,
});
const usedBytes = (user: UnknownRecord) =>
    Number(user.u || 0) + Number(user.d || 0);
const bytesToGiB = (value: unknown) => Number(value || 0) / GIB;
const giBToBytes = (value: unknown) =>
    Math.max(0, Math.round(Number(value || 0) * GIB));
const formatTraffic = (value: unknown) =>
    formatBytes(Math.max(0, Number(value || 0)));
const usagePercent = (user: UnknownRecord) =>
    Number(user.transfer_enable)
        ? Math.min(
              100,
              Math.round(
                  (usedBytes(user) / Number(user.transfer_enable)) * 100,
              ),
          )
        : 0;
const formatTime = (value: unknown) =>
    value
        ? new Date(Number(value) * 1000).toLocaleString("zh-CN", {
              hour12: false,
          })
        : "长期有效";
const localInput = (value: unknown) => {
    if (!value) return "";
    const date = new Date(Number(value) * 1000);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};
const userState = (
    user: UnknownRecord,
): [string, "default" | "neutral" | "warning"] => {
    if (user.banned) return ["已封禁", "neutral"];
    if (user.expired_at && Number(user.expired_at) < Date.now() / 1000)
        return ["已过期", "neutral"];
    if (!user.plan_id) return ["无订阅", "warning"];
    return ["正常", "default"];
};
const csvCell = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function UserManagement() {
    const [users, setUsers] = useState<UnknownRecord[]>([]);
    const [plans, setPlans] = useState<UnknownRecord[]>([]);
    const [groups, setGroups] = useState<UnknownRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [busy, setBusy] = useState<number | null>(null);
    const [selected, setSelected] = useState<UnknownRecord | null>(null);
    const [showEdit, setShowEdit] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [createdUsers, setCreatedUsers] = useState<UnknownRecord[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [exporting, setExporting] = useState(false);
    const [bulkBusy, setBulkBusy] = useState(false);
    const [filters, setFilters] = useState({
        keyword: "",
        plan_id: "",
        state: "all",
    });
    const [page, setPage] = useState({
        current: 1,
        size: 20,
        total: 0,
        last: 1,
    });
    const [form, setForm] = useState<UserForm>(blankForm());
    const [createForm, setCreateForm] = useState<CreateForm>(blankCreate());
    const [pending, setPending] = useState<PendingConfirm | null>(null);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<UnknownRecord | null>(
        null,
    );
    const [deleteEmail, setDeleteEmail] = useState("");

    const buildQuery = useCallback(
        (current: number, size: number, source = filters) => {
            const query = new URLSearchParams({
                current: String(current),
                pageSize: String(size),
            });
            let index = 0;
            const add = (id: string, value: string, logic?: string) => {
                query.set(`filter[${index}][id]`, id);
                query.set(`filter[${index}][value]`, value);
                if (logic) query.set(`filter[${index}][logic]`, logic);
                index += 1;
            };
            if (source.keyword) {
                const value = source.keyword.trim();
                if (/^\d+$/.test(value)) add("id", `eq:${value}`);
                else add("email", `like:${value}`);
            }
            if (source.plan_id) add("plan_id", `eq:${source.plan_id}`);
            if (source.state === "banned") add("banned", "eq:1");
            if (source.state === "active") {
                add("banned", "eq:0");
                add("expired_at", `gt:${Math.floor(Date.now() / 1000)}`);
            }
            if (source.state === "expired")
                add("expired_at", `lte:${Math.floor(Date.now() / 1000)}`);
            if (source.state === "no_plan") add("plan_id", "null:");
            return query.toString();
        },
        [filters],
    );

    const load = useCallback(
        async (
            reset = false,
            requestedPage?: number,
            source = filters,
            requestedSize = page.size,
        ) => {
            const current = reset ? 1 : (requestedPage ?? page.current);
            setLoading(true);
            try {
                const payload = (await request(
                    `/user/fetch?${buildQuery(current, requestedSize, source)}`,
                )) as UnknownRecord;
                const normalized = (payload?.data ?? payload) as
                    | UnknownRecord
                    | UnknownRecord[];
                const rows = Array.isArray(normalized)
                    ? normalized
                    : normalized.items || normalized.data || [];
                const total = Number(
                    Array.isArray(normalized)
                        ? rows.length
                        : normalized.total || rows.length,
                );
                setUsers(rows);
                setPage({
                    current: Number(
                        Array.isArray(normalized)
                            ? current
                            : normalized.current_page || current,
                    ),
                    size: requestedSize,
                    total,
                    last: Number(
                        Array.isArray(normalized)
                            ? Math.max(1, Math.ceil(total / requestedSize))
                            : normalized.last_page ||
                                  Math.max(1, Math.ceil(total / requestedSize)),
                    ),
                });
                setSelectedIds([]);
            } catch (error) {
                toast.error(errorMessage(error));
            } finally {
                setLoading(false);
            }
        },
        [buildQuery, filters, page.current, page.size],
    );

    const loadOptions = useCallback(async () => {
        try {
            const [planData, groupData] = await Promise.all([
                get("/plan/fetch"),
                get("/server/group/fetch"),
            ]);
            setPlans(Array.isArray(planData) ? planData : []);
            setGroups(Array.isArray(groupData) ? groupData : []);
        } catch (error) {
            toast.error(errorMessage(error));
        }
    }, []);
    useEffect(() => {
        void Promise.all([load(true), loadOptions()]);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const stats = useMemo(
        () => ({
            page: users.length,
            active: users.filter((user) => userState(user)[0] === "正常")
                .length,
            banned: users.filter((user) => user.banned).length,
            traffic: users.reduce((sum, user) => sum + usedBytes(user), 0),
        }),
        [users],
    );
    const allSelected =
        users.length > 0 &&
        users.every((user) => selectedIds.includes(Number(user.id)));
    const privilegeEscalation = Boolean(
        selected &&
            ((!selected.is_admin && form.is_admin) ||
                (!selected.is_staff && form.is_staff)),
    );
    const groupName = (id: unknown) =>
        groups.find((group) => Number(group.id) === Number(id))?.name ||
        "无权限组";

    const edit = (user: UnknownRecord) => {
        setSelected(user);
        setForm({
            id: Number(user.id),
            email: String(user.email || ""),
            password: "",
            plan_id: user.plan_id ?? "",
            transfer_gb: bytesToGiB(user.transfer_enable),
            upload_gb: bytesToGiB(user.u),
            download_gb: bytesToGiB(user.d),
            expired_at: localInput(user.expired_at),
            balance: Number(user.balance || 0),
            commission_balance: Number(user.commission_balance || 0),
            commission_rate: user.commission_rate ?? null,
            discount: user.discount ?? null,
            speed_limit: Number(user.speed_limit || 0),
            device_limit: Number(user.device_limit || 0),
            banned: Boolean(user.banned),
            is_staff: Boolean(user.is_staff),
            is_admin: Boolean(user.is_admin),
            invite_user_email: String(user.invite_user?.email || ""),
            remarks: String(user.remarks || ""),
        });
        setShowEdit(true);
    };
    const validateUser = () => {
        if (!form.email.includes("@")) {
            toast.error("请输入正确的邮箱");
            return false;
        }
        if (form.password && form.password.length < 8) {
            toast.error("新密码至少 8 位");
            return false;
        }
        if (
            [form.transfer_gb, form.upload_gb, form.download_gb].some(
                (value) => Number(value) < 0,
            )
        ) {
            toast.error("流量数值不能小于 0");
            return false;
        }
        return true;
    };
    const saveUser = async () => {
        if (!validateUser()) return;
        setSaving(true);
        try {
            const body: UnknownRecord = {
                id: form.id,
                email: form.email,
                plan_id: form.plan_id || null,
                transfer_enable: giBToBytes(form.transfer_gb),
                u: giBToBytes(form.upload_gb),
                d: giBToBytes(form.download_gb),
                expired_at: form.expired_at
                    ? Math.floor(new Date(form.expired_at).getTime() / 1000)
                    : null,
                balance: Number(form.balance || 0),
                commission_balance: Number(form.commission_balance || 0),
                commission_rate:
                    form.commission_rate === "" ? null : form.commission_rate,
                discount: form.discount === "" ? null : form.discount,
                speed_limit: Number(form.speed_limit || 0),
                device_limit: Number(form.device_limit || 0),
                banned: Boolean(form.banned),
                is_staff: Boolean(form.is_staff),
                is_admin: Boolean(form.is_admin),
                invite_user_email: form.invite_user_email || null,
                remarks: form.remarks || null,
            };
            if (form.password) body.password = form.password;
            await post("/user/update", body);
            toast.success("用户资料已更新");
            setShowEdit(false);
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const requestSave = () => {
        if (!validateUser()) return;
        if (privilegeEscalation) setPending({ kind: "privilege" });
        else void saveUser();
    };
    const detail = async (user: UnknownRecord) => {
        setBusy(Number(user.id));
        try {
            setSelected(
                (await get("/user/getUserInfoById", {
                    id: user.id,
                })) as UnknownRecord,
            );
            setShowDetail(true);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };
    const performBan = async (user: UnknownRecord, banned: boolean) => {
        setBusy(Number(user.id));
        try {
            await post("/user/update", { id: user.id, banned });
            toast.success(banned ? "用户已封禁" : "用户已解封");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };
    const performResetSecret = async (user: UnknownRecord) => {
        setBusy(Number(user.id));
        try {
            await post("/user/resetSecret", { id: user.id });
            toast.success("订阅密钥已重置");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };
    const performResetTraffic = async (user: UnknownRecord) => {
        setBusy(Number(user.id));
        try {
            await post("/traffic-reset/reset-user", {
                user_id: user.id,
                reason: "用户管理页面手动重置",
            });
            toast.success("用户流量已重置");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };
    const destroyUser = async () => {
        if (!deleteTarget) return;
        if (deleteEmail !== deleteTarget.email) {
            toast.error("邮箱不匹配，已取消删除");
            return;
        }
        setBusy(Number(deleteTarget.id));
        try {
            await post("/user/destroy", { id: deleteTarget.id });
            toast.success("用户及关联数据已永久删除");
            setDeleteTarget(null);
            setDeleteEmail("");
            await load();
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(null);
        }
    };
    const copy = async (value: unknown, label = "内容") => {
        try {
            await navigator.clipboard.writeText(String(value || ""));
            toast.success(`${label}已复制`);
        } catch {
            toast.error("复制失败，请手动复制");
        }
    };
    const toggleAll = () =>
        setSelectedIds(allSelected ? [] : users.map((user) => Number(user.id)));
    const clearFilters = () => {
        const next = { keyword: "", plan_id: "", state: "all" };
        setFilters(next);
        void load(true, 1, next);
    };
    const performBulkBan = async (banned: boolean) => {
        if (!selectedIds.length) return;
        setBulkBusy(true);
        try {
            const results = await Promise.allSettled(
                selectedIds.map((id) => post("/user/update", { id, banned })),
            );
            const failed = results.filter(
                (item) => item.status === "rejected",
            ).length;
            if (failed)
                toast.error(
                    `已处理 ${results.length - failed} 个，${failed} 个失败`,
                );
            else
                toast.success(
                    `已${banned ? "封禁" : "解封"} ${results.length} 个用户`,
                );
            await load();
        } finally {
            setBulkBusy(false);
        }
    };
    const exportUsers = async () => {
        setExporting(true);
        try {
            const payload = (await request(
                `/user/fetch?${buildQuery(1, 10000)}`,
            )) as UnknownRecord;
            const source = (payload?.data ?? payload) as
                | UnknownRecord
                | UnknownRecord[];
            const list = Array.isArray(source)
                ? source
                : source.items || source.data || [];
            const lines = [
                [
                    "用户ID",
                    "邮箱",
                    "套餐",
                    "权限组",
                    "已用上行(B)",
                    "已用下行(B)",
                    "总已用(B)",
                    "总流量(B)",
                    "余额",
                    "佣金",
                    "状态",
                    "到期时间",
                    "创建时间",
                ],
                ...list.map((user: UnknownRecord) => [
                    user.id,
                    user.email,
                    user.plan?.name || "",
                    user.group?.name || groupName(user.group_id),
                    Number(user.u || 0),
                    Number(user.d || 0),
                    usedBytes(user),
                    Number(user.transfer_enable || 0),
                    user.balance || 0,
                    user.commission_balance || 0,
                    userState(user)[0],
                    formatTime(user.expired_at),
                    formatTime(user.created_at),
                ]),
            ];
            const blob = new Blob(
                [
                    `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\n")}`,
                ],
                { type: "text/csv;charset=utf-8" },
            );
            const anchor = document.createElement("a");
            anchor.href = URL.createObjectURL(blob);
            anchor.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
            anchor.click();
            URL.revokeObjectURL(anchor.href);
            toast.success(`已导出 ${list.length} 个用户`);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setExporting(false);
        }
    };
    const generatePassword = () => {
        const chars =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
        setCreateForm((current) => ({
            ...current,
            password: Array.from(
                crypto.getRandomValues(new Uint32Array(14)),
                (value) => chars[value % chars.length],
            ).join(""),
        }));
    };
    const startCreate = () => {
        setCreateForm(blankCreate());
        setCreatedUsers([]);
        setShowCreate(true);
    };
    const prepareCreate = () => {
        let prefix = createForm.email_prefix.trim();
        let suffix = createForm.email_suffix.trim().replace(/^@/, "");
        if (!createForm.batch) {
            const parts = createForm.email.trim().toLowerCase().split("@");
            if (parts.length !== 2 || !parts[0] || !parts[1])
                return toast.error("请输入正确的用户邮箱");
            prefix = parts[0];
            suffix = parts[1];
        }
        if (!suffix || !prefix) return toast.error("邮箱前缀和域名不能为空");
        if (createForm.password && createForm.password.length < 8)
            return toast.error("密码至少 8 位；留空则使用邮箱作为初始密码");
        if (
            createForm.batch &&
            (Number(createForm.generate_count) < 1 ||
                Number(createForm.generate_count) > 500)
        )
            return toast.error("批量创建数量必须在 1–500 之间");
        const payload: CreatePayload = {
            email_prefix: prefix,
            email_suffix: suffix,
            plan_id: createForm.plan_id || null,
            expired_at: createForm.expired_at
                ? Math.floor(new Date(createForm.expired_at).getTime() / 1000)
                : null,
        };
        if (createForm.password) payload.password = createForm.password;
        if (createForm.batch)
            payload.generate_count = Number(createForm.generate_count);
        setPending({
            kind: "create",
            payload,
            label: createForm.batch
                ? ` ${payload.generate_count} 个`
                : `用户 ${prefix}@${suffix}`,
        });
    };
    const createUsers = async (payload: CreatePayload) => {
        setSaving(true);
        try {
            const data = await post("/user/generate", payload);
            const rows = Array.isArray(data) ? data : [];
            setCreatedUsers(rows);
            toast.success(
                createForm.batch
                    ? `已创建 ${rows.length || payload.generate_count} 个用户`
                    : "用户已创建",
            );
            if (!createForm.batch) {
                setShowCreate(false);
                await load(true);
            }
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };
    const downloadCreated = () => {
        if (!createdUsers.length) return;
        const rows = [
            ["账号", "密码", "过期时间", "UUID", "订阅地址"],
            ...createdUsers.map((user) => [
                user.email,
                user.password,
                user.expired_at,
                user.uuid,
                user.subscribe_url,
            ]),
        ];
        const blob = new Blob(
            [
                `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`,
            ],
            { type: "text/csv;charset=utf-8" },
        );
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `users-${Date.now()}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const confirmMeta = pending
        ? pending.kind === "ban"
            ? {
                  title: pending.banned ? "封禁用户" : "解除封禁",
                  description: `${pending.banned ? "封禁" : "解封"}用户 ${pending.user.email}？${pending.banned ? "封禁会立即清除该用户所有登录会话。" : ""}`,
                  confirm: pending.banned ? "确认封禁" : "确认解封",
                  destructive: pending.banned,
              }
            : pending.kind === "secret"
              ? {
                    title: "重置订阅密钥",
                    description: `重置 ${pending.user.email} 的订阅密钥？旧订阅链接将立即失效。`,
                    confirm: "确认重置",
                    destructive: true,
                }
              : pending.kind === "traffic"
                ? {
                      title: "重置用户流量",
                      description: `手动重置 ${pending.user.email} 的上行、下行与总已用流量？此操作会写入重置日志。`,
                      confirm: "确认重置",
                      destructive: true,
                  }
                : pending.kind === "bulk"
                  ? {
                        title: `批量${pending.banned ? "封禁" : "解封"}`,
                        description: `将处理选中的 ${selectedIds.length} 个用户。`,
                        confirm: "确认执行",
                        destructive: pending.banned,
                    }
                  : pending.kind === "privilege"
                    ? {
                          title: "授予后台权限",
                          description:
                              "你正在提升该用户的后台权限。员工或管理员可以登录管理后台，请确认该账号可信。",
                          confirm: "确认授权",
                          destructive: true,
                      }
                    : {
                          title: "创建用户",
                          description: `确定创建${pending.label}账号？`,
                          confirm: "确认创建",
                          destructive: false,
                      }
        : null;
    const runPending = async () => {
        if (!pending) return;
        setConfirmBusy(true);
        try {
            if (pending.kind === "ban")
                await performBan(pending.user, pending.banned);
            else if (pending.kind === "secret")
                await performResetSecret(pending.user);
            else if (pending.kind === "traffic")
                await performResetTraffic(pending.user);
            else if (pending.kind === "bulk")
                await performBulkBan(pending.banned);
            else if (pending.kind === "privilege") await saveUser();
            else await createUsers(pending.payload);
            setPending(null);
        } finally {
            setConfirmBusy(false);
        }
    };

    return (
        <PageShell>
            <PageHeader
                title="用户管理"
                description="管理用户订阅、流量、余额、推广关系、权限和账号安全状态。"
                action={
                    <>
                        <Button
                            variant="outline"
                            disabled={exporting}
                            onClick={() => void exportUsers()}
                        >
                            <Download />
                            {exporting ? "导出中…" : "导出用户"}
                        </Button>
                        <Button onClick={startCreate}>
                            <UserPlus />
                            创建用户
                        </Button>
                    </>
                }
            />
            <MetricGrid>
                <MetricCard label="当前页用户" value={stats.page} />
                <MetricCard label="当前页正常" value={stats.active} />
                <MetricCard label="当前页封禁" value={stats.banned} />
                <MetricCard
                    label="当前页总已用"
                    value={formatTraffic(stats.traffic)}
                    hint="上行 + 下行"
                />
            </MetricGrid>
            <Panel>
                <div className="user-toolbar grid gap-3 xl:grid-cols-[1fr_13rem_12rem_10rem_auto_auto_auto] xl:items-end">
                    <div className="grid gap-2">
                        <span className="text-sm font-medium">搜索</span>
                        <Input
                            value={filters.keyword}
                            onChange={(event) =>
                                setFilters({
                                    ...filters,
                                    keyword: event.target.value,
                                })
                            }
                            placeholder="邮箱或用户 ID"
                            onKeyDown={(event) =>
                                event.key === "Enter" && void load(true)
                            }
                        />
                    </div>
                    <SelectField
                        label="套餐"
                        value={filters.plan_id}
                        onValueChange={(plan_id) => {
                            const next = { ...filters, plan_id };
                            setFilters(next);
                            void load(true, 1, next);
                        }}
                        options={[
                            { value: "", label: "全部套餐" },
                            ...plans.map((plan) => ({
                                value: plan.id,
                                label: plan.name,
                            })),
                        ]}
                    />
                    <SelectField
                        label="用户状态"
                        value={filters.state}
                        onValueChange={(state) => {
                            const next = { ...filters, state };
                            setFilters(next);
                            void load(true, 1, next);
                        }}
                        options={[
                            { value: "all", label: "全部状态" },
                            { value: "active", label: "正常用户" },
                            { value: "expired", label: "已过期" },
                            { value: "banned", label: "已封禁" },
                            { value: "no_plan", label: "无订阅" },
                        ]}
                    />
                    <SelectField
                        label="每页显示"
                        value={page.size}
                        onValueChange={(value) =>
                            void load(true, 1, filters, Number(value))
                        }
                        options={[
                            { value: 20, label: "20 条" },
                            { value: 50, label: "50 条" },
                            { value: 100, label: "100 条" },
                        ]}
                    />
                    <Button variant="outline" onClick={clearFilters}>
                        重置
                    </Button>
                    <Button onClick={() => void load(true)}>查询</Button>
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
            {selectedIds.length > 0 && (
                <Panel className="user-bulk-bar">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                            已选择 <strong>{selectedIds.length}</strong> 个用户
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={bulkBusy}
                                onClick={() =>
                                    setPending({ kind: "bulk", banned: false })
                                }
                            >
                                批量解封
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={bulkBusy}
                                onClick={() =>
                                    setPending({ kind: "bulk", banned: true })
                                }
                            >
                                批量封禁
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedIds([])}
                            >
                                取消选择
                            </Button>
                        </div>
                    </div>
                </Panel>
            )}
            <Panel className="table-wrap user-table p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">
                                <Checkbox
                                    checked={allSelected}
                                    aria-label="选择当前页全部用户"
                                    onCheckedChange={toggleAll}
                                />
                            </TableHead>
                            <TableHead>用户</TableHead>
                            <TableHead>订阅</TableHead>
                            <TableHead>流量</TableHead>
                            <TableHead>余额 / 佣金</TableHead>
                            <TableHead>限制</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>登录 / 创建</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={9}>
                                    <EmptyState>正在加载用户…</EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={9}>
                                    <EmptyState>暂无符合条件的用户</EmptyState>
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => {
                                const state = userState(user);
                                const usage = usagePercent(user);
                                const checked = selectedIds.includes(
                                    Number(user.id),
                                );
                                return (
                                    <TableRow
                                        key={user.id}
                                        data-state={
                                            checked ? "selected" : undefined
                                        }
                                    >
                                        <TableCell>
                                            <Checkbox
                                                checked={checked}
                                                aria-label={`选择用户 ${user.email}`}
                                                onCheckedChange={(value) =>
                                                    setSelectedIds((current) =>
                                                        value === true
                                                            ? [
                                                                  ...new Set([
                                                                      ...current,
                                                                      Number(
                                                                          user.id,
                                                                      ),
                                                                  ]),
                                                              ]
                                                            : current.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      Number(
                                                                          user.id,
                                                                      ),
                                                              ),
                                                    )
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="link"
                                                className="h-auto justify-start p-0"
                                                onClick={() =>
                                                    void detail(user)
                                                }
                                            >
                                                {user.email}
                                            </Button>
                                            <small className="block text-muted-foreground">
                                                #{user.id}
                                                {user.is_admin
                                                    ? " · 管理员"
                                                    : user.is_staff
                                                      ? " · 员工"
                                                      : ""}
                                            </small>
                                        </TableCell>
                                        <TableCell>
                                            <strong className="block">
                                                {user.plan?.name || "无订阅"}
                                            </strong>
                                            <small className="block text-muted-foreground">
                                                {formatTime(user.expired_at)}
                                            </small>
                                            <small className="block text-muted-foreground">
                                                {user.group?.name ||
                                                    groupName(user.group_id)}
                                            </small>
                                        </TableCell>
                                        <TableCell>
                                            <div className="min-w-48 space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <strong>
                                                        总已用{" "}
                                                        {formatTraffic(
                                                            usedBytes(user),
                                                        )}
                                                    </strong>
                                                    <span>
                                                        /{" "}
                                                        {formatTraffic(
                                                            user.transfer_enable,
                                                        )}
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={usage}
                                                    className={
                                                        usage >= 90
                                                            ? "[&_[data-slot=progress-indicator]]:bg-destructive"
                                                            : ""
                                                    }
                                                />
                                                <small className="block text-muted-foreground">
                                                    已使用 {usage}%
                                                </small>
                                                <small className="block text-muted-foreground">
                                                    上行 {formatTraffic(user.u)}{" "}
                                                    · 下行{" "}
                                                    {formatTraffic(user.d)}
                                                </small>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <strong className="block">
                                                ¥
                                                {Number(
                                                    user.balance || 0,
                                                ).toFixed(2)}
                                            </strong>
                                            <small className="text-muted-foreground">
                                                佣金 ¥
                                                {Number(
                                                    user.commission_balance ||
                                                        0,
                                                ).toFixed(2)}
                                            </small>
                                        </TableCell>
                                        <TableCell>
                                            <span className="block">
                                                {user.speed_limit
                                                    ? `${user.speed_limit} Mbps`
                                                    : "不限速"}
                                            </span>
                                            <small className="text-muted-foreground">
                                                {user.device_limit
                                                    ? `${user.device_limit} 台设备`
                                                    : "设备不限"}
                                            </small>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge tone={state[1]}>
                                                {state[0]}
                                            </StatusBadge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="block">
                                                {formatTime(user.last_login_at)}
                                            </span>
                                            <small className="text-muted-foreground">
                                                创建{" "}
                                                {formatTime(user.created_at)}
                                            </small>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={
                                                        busy === Number(user.id)
                                                    }
                                                    onClick={() =>
                                                        void detail(user)
                                                    }
                                                >
                                                    详情
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => edit(user)}
                                                >
                                                    编辑
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        render={
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                aria-label={`更多用户操作：${user.email}`}
                                                            />
                                                        }
                                                    >
                                                        <MoreHorizontal />
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent
                                                        align="end"
                                                        className="w-44"
                                                    >
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                void copy(
                                                                    user.subscribe_url,
                                                                    "订阅链接",
                                                                )
                                                            }
                                                        >
                                                            <Copy />
                                                            复制订阅链接
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                setPending({
                                                                    kind: "secret",
                                                                    user,
                                                                })
                                                            }
                                                        >
                                                            <KeyRound />
                                                            重置订阅密钥
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                setPending({
                                                                    kind: "traffic",
                                                                    user,
                                                                })
                                                            }
                                                        >
                                                            <RotateCcw />
                                                            重置已用流量
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                setPending({
                                                                    kind: "ban",
                                                                    user,
                                                                    banned: !user.banned,
                                                                })
                                                            }
                                                        >
                                                            <ShieldAlert />
                                                            {user.banned
                                                                ? "解除封禁"
                                                                : "封禁用户"}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            onClick={() => {
                                                                setDeleteTarget(
                                                                    user,
                                                                );
                                                                setDeleteEmail(
                                                                    "",
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 />
                                                            永久删除
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </Panel>
            <Pagination
                current={page.current}
                last={page.last}
                total={page.total}
                loading={loading}
                onChange={(current) => void load(false, current)}
            />

            <PageDialog
                open={showEdit}
                onOpenChange={setShowEdit}
                title="编辑用户"
                description={`#${form.id || ""} · 金额单位为元；流量按 1 GB = 1024³ 字节换算。`}
                className="sm:max-w-4xl"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowEdit(false)}
                        >
                            取消
                        </Button>
                        <Button disabled={saving} onClick={requestSave}>
                            {saving ? "保存中…" : "保存用户"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="grid gap-2 sm:col-span-2">
                            <span className="text-sm font-medium">邮箱 *</span>
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
                            <span className="text-sm font-medium">新密码</span>
                            <Input
                                value={form.password}
                                type="password"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        password: event.target.value,
                                    })
                                }
                                placeholder="留空不修改，至少 8 位"
                            />
                        </div>
                        <SelectField
                            label="订阅套餐"
                            value={form.plan_id}
                            onValueChange={(plan_id) =>
                                setForm({ ...form, plan_id })
                            }
                            options={[
                                { value: "", label: "无订阅" },
                                ...plans.map((plan) => ({
                                    value: plan.id,
                                    label: plan.name,
                                })),
                            ]}
                        />
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                到期时间
                            </span>
                            <Input
                                value={form.expired_at}
                                type="datetime-local"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        expired_at: event.target.value,
                                    })
                                }
                            />
                            <small className="text-muted-foreground">
                                留空表示长期有效
                            </small>
                        </div>
                        <TrafficEditor
                            label="总流量额度（GB）"
                            value={form.transfer_gb}
                            onChange={(transfer_gb) =>
                                setForm({ ...form, transfer_gb })
                            }
                        />
                        <TrafficEditor
                            label="已用上行 u（GB）"
                            value={form.upload_gb}
                            onChange={(upload_gb) =>
                                setForm({ ...form, upload_gb })
                            }
                        />
                        <TrafficEditor
                            label="已用下行 d（GB）"
                            value={form.download_gb}
                            onChange={(download_gb) =>
                                setForm({ ...form, download_gb })
                            }
                        />
                        <div className="rounded-lg border bg-muted/40 p-3">
                            <small className="text-muted-foreground">
                                总已用（u + d）
                            </small>
                            <strong className="mt-1 block">
                                {formatTraffic(
                                    giBToBytes(form.upload_gb) +
                                        giBToBytes(form.download_gb),
                                )}
                            </strong>
                            <small className="text-muted-foreground">
                                {form.upload_gb + form.download_gb} GB
                            </small>
                        </div>
                        <NumberEditor
                            label="余额（元）"
                            value={form.balance}
                            step="0.01"
                            onChange={(balance) =>
                                setForm({ ...form, balance })
                            }
                        />
                        <NumberEditor
                            label="佣金余额（元）"
                            value={form.commission_balance}
                            step="0.01"
                            onChange={(commission_balance) =>
                                setForm({ ...form, commission_balance })
                            }
                        />
                        <OptionalNumberEditor
                            label="返佣比例（%）"
                            value={form.commission_rate}
                            min={0}
                            max={100}
                            onChange={(commission_rate) =>
                                setForm({ ...form, commission_rate })
                            }
                        />
                        <OptionalNumberEditor
                            label="专属折扣（%）"
                            value={form.discount}
                            min={0}
                            max={100}
                            onChange={(discount) =>
                                setForm({ ...form, discount })
                            }
                        />
                        <NumberEditor
                            label="限速（Mbps）"
                            value={form.speed_limit}
                            min={0}
                            hint="0 表示不限速"
                            onChange={(speed_limit) =>
                                setForm({ ...form, speed_limit })
                            }
                        />
                        <NumberEditor
                            label="设备数量限制"
                            value={form.device_limit}
                            min={0}
                            hint="0 表示不限设备"
                            onChange={(device_limit) =>
                                setForm({ ...form, device_limit })
                            }
                        />
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                邀请人邮箱
                            </span>
                            <Input
                                value={form.invite_user_email}
                                type="email"
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        invite_user_email: event.target.value,
                                    })
                                }
                                placeholder="留空解除邀请关系"
                            />
                        </div>
                        <ToggleEditor
                            label="封禁账号"
                            checked={form.banned}
                            onCheckedChange={(banned) =>
                                setForm({ ...form, banned })
                            }
                            onLabel="已封禁"
                            offLabel="正常使用"
                        />
                        <ToggleEditor
                            label="后台员工"
                            checked={form.is_staff}
                            onCheckedChange={(is_staff) =>
                                setForm({ ...form, is_staff })
                            }
                            onLabel="允许登录后台"
                            offLabel="普通用户"
                        />
                        <ToggleEditor
                            label="管理员权限"
                            checked={form.is_admin}
                            onCheckedChange={(is_admin) =>
                                setForm({ ...form, is_admin })
                            }
                            onLabel="完整管理员"
                            offLabel="非管理员"
                        />
                        <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                            <span className="text-sm font-medium">
                                管理员备注
                            </span>
                            <Textarea
                                value={form.remarks}
                                rows={3}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        remarks: event.target.value,
                                    })
                                }
                            />
                        </div>
                    </div>
                    {(form.is_admin || form.is_staff) && (
                        <div className="flex gap-3 rounded-lg bg-destructive/10 p-3 text-destructive">
                            <ShieldAlert className="size-5 shrink-0" />
                            <span>
                                <strong className="block text-sm">
                                    后台权限提醒
                                </strong>
                                <small>
                                    员工或管理员可登录管理后台，请只授予可信账号。
                                </small>
                            </span>
                        </div>
                    )}
                </div>
            </PageDialog>

            <PageDialog
                open={showDetail && Boolean(selected)}
                onOpenChange={setShowDetail}
                title="用户详情"
                description={
                    selected ? `${selected.email} · #${selected.id}` : ""
                }
                className="sm:max-w-4xl"
                footer={
                    <>
                        {selected && (
                            <Button
                                variant="outline"
                                onClick={() => void copy(selected.uuid, "UUID")}
                            >
                                <Copy />
                                复制 UUID
                            </Button>
                        )}
                        <Button
                            onClick={() => {
                                if (!selected) return;
                                setShowDetail(false);
                                edit(
                                    users.find(
                                        (user) => user.id === selected.id,
                                    ) || selected,
                                );
                            }}
                        >
                            编辑用户
                        </Button>
                    </>
                }
            >
                {selected && (
                    <div className="space-y-5">
                        <MetricGrid>
                            <MetricCard
                                label="账号状态"
                                value={userState(selected)[0]}
                            />
                            <MetricCard
                                label="订阅套餐"
                                value={
                                    selected.plan?.name ||
                                    `#${selected.plan_id || "-"}`
                                }
                            />
                            <MetricCard
                                label="余额"
                                value={`¥${(Number(selected.balance || 0) / 100).toFixed(2)}`}
                            />
                            <MetricCard
                                label="到期时间"
                                value={formatTime(selected.expired_at)}
                            />
                        </MetricGrid>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <DetailItem
                                label="总流量额度"
                                value={formatTraffic(selected.transfer_enable)}
                            />
                            <DetailItem
                                label="已用上行 u"
                                value={formatTraffic(selected.u)}
                            />
                            <DetailItem
                                label="已用下行 d"
                                value={formatTraffic(selected.d)}
                            />
                            <DetailItem
                                label="总已用 u + d"
                                value={formatTraffic(usedBytes(selected))}
                            />
                            <DetailItem
                                label="UUID"
                                value={selected.uuid || "-"}
                            />
                            <DetailItem
                                label="邀请人"
                                value={selected.invite_user?.email || "-"}
                            />
                            <DetailItem
                                label="权限组"
                                value={
                                    selected.group?.name ||
                                    groupName(selected.group_id)
                                }
                            />
                            <DetailItem
                                label="限速"
                                value={
                                    selected.speed_limit
                                        ? `${selected.speed_limit} Mbps`
                                        : "不限"
                                }
                            />
                            <DetailItem
                                label="设备限制"
                                value={selected.device_limit || "不限"}
                            />
                            <DetailItem
                                label="最后登录"
                                value={formatTime(selected.last_login_at)}
                            />
                            <DetailItem
                                label="创建时间"
                                value={formatTime(selected.created_at)}
                            />
                            <DetailItem
                                label="Telegram ID"
                                value={selected.telegram_id || "-"}
                            />
                            <DetailItem
                                label="后台权限"
                                value={
                                    selected.is_admin
                                        ? "管理员"
                                        : selected.is_staff
                                          ? "员工"
                                          : "普通用户"
                                }
                            />
                            <DetailItem
                                label="管理员备注"
                                value={selected.remarks || "-"}
                            />
                        </div>
                    </div>
                )}
            </PageDialog>

            <PageDialog
                open={showCreate}
                onOpenChange={setShowCreate}
                title="创建用户"
                description="支持单个账号或最多 500 个批量账号。"
                className="sm:max-w-3xl"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowCreate(false)}
                        >
                            取消
                        </Button>
                        <Button disabled={saving} onClick={prepareCreate}>
                            {saving
                                ? "创建中…"
                                : createForm.batch
                                  ? "批量创建"
                                  : "创建用户"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-5">
                    <label className="flex items-start gap-3 rounded-lg border p-3">
                        <Switch
                            checked={createForm.batch}
                            onCheckedChange={(batch) =>
                                setCreateForm({ ...createForm, batch })
                            }
                        />
                        <span>
                            <strong className="block text-sm">
                                批量创建账号
                            </strong>
                            <small className="text-muted-foreground">
                                {createForm.batch
                                    ? "批量模式：账号格式为“前缀_序号@域名”。"
                                    : "单个创建模式"}
                            </small>
                        </span>
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {!createForm.batch ? (
                            <div className="grid gap-2 sm:col-span-2">
                                <span className="text-sm font-medium">
                                    用户邮箱 *
                                </span>
                                <Input
                                    value={createForm.email}
                                    type="email"
                                    onChange={(event) =>
                                        setCreateForm({
                                            ...createForm,
                                            email: event.target.value,
                                        })
                                    }
                                    placeholder="user@example.com"
                                />
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-2">
                                    <span className="text-sm font-medium">
                                        邮箱前缀 *
                                    </span>
                                    <Input
                                        value={createForm.email_prefix}
                                        onChange={(event) =>
                                            setCreateForm({
                                                ...createForm,
                                                email_prefix:
                                                    event.target.value,
                                            })
                                        }
                                        placeholder="user"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <span className="text-sm font-medium">
                                        邮箱域名 *
                                    </span>
                                    <Input
                                        value={createForm.email_suffix}
                                        onChange={(event) =>
                                            setCreateForm({
                                                ...createForm,
                                                email_suffix:
                                                    event.target.value,
                                            })
                                        }
                                        placeholder="example.com"
                                    />
                                </div>
                                <NumberEditor
                                    label="创建数量 *"
                                    value={createForm.generate_count}
                                    min={1}
                                    max={500}
                                    onChange={(generate_count) =>
                                        setCreateForm({
                                            ...createForm,
                                            generate_count,
                                        })
                                    }
                                />
                            </>
                        )}
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                初始密码
                            </span>
                            <div className="flex gap-2">
                                <Input
                                    value={createForm.password}
                                    type="text"
                                    onChange={(event) =>
                                        setCreateForm({
                                            ...createForm,
                                            password: event.target.value,
                                        })
                                    }
                                    placeholder="留空则使用完整邮箱"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={generatePassword}
                                >
                                    随机生成
                                </Button>
                            </div>
                            <small className="text-muted-foreground">
                                自定义密码至少 8 位
                            </small>
                        </div>
                        <SelectField
                            label="初始套餐"
                            value={createForm.plan_id}
                            onValueChange={(plan_id) =>
                                setCreateForm({ ...createForm, plan_id })
                            }
                            options={[
                                { value: "", label: "无订阅" },
                                ...plans.map((plan) => ({
                                    value: plan.id,
                                    label: plan.name,
                                })),
                            ]}
                        />
                        <div className="grid gap-2">
                            <span className="text-sm font-medium">
                                套餐到期时间
                            </span>
                            <Input
                                value={createForm.expired_at}
                                type="datetime-local"
                                onChange={(event) =>
                                    setCreateForm({
                                        ...createForm,
                                        expired_at: event.target.value,
                                    })
                                }
                            />
                            <small className="text-muted-foreground">
                                留空表示长期有效
                            </small>
                        </div>
                    </div>
                    {createdUsers.length > 0 && (
                        <div className="space-y-3 rounded-lg bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
                            <div className="flex items-center justify-between">
                                <strong>
                                    成功创建 {createdUsers.length} 个账号
                                </strong>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={downloadCreated}
                                >
                                    <Download />
                                    导出 CSV
                                </Button>
                            </div>
                            <p className="text-sm">
                                请及时保存初始密码；关闭弹窗后将不再显示。
                            </p>
                            <div className="grid gap-1">
                                {createdUsers.slice(0, 8).map((user) => (
                                    <code
                                        key={user.email}
                                        className="rounded bg-background p-2 text-foreground"
                                    >
                                        {user.email} · {user.password}
                                    </code>
                                ))}
                                {createdUsers.length > 8 && (
                                    <small>
                                        另有 {createdUsers.length - 8}{" "}
                                        个账号，请导出 CSV 查看
                                    </small>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </PageDialog>

            <PageDialog
                open={Boolean(pending)}
                onOpenChange={(open) => !open && setPending(null)}
                title={confirmMeta?.title || "确认操作"}
                description={confirmMeta?.description}
                className="sm:max-w-md"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setPending(null)}
                        >
                            取消
                        </Button>
                        <Button
                            variant={
                                confirmMeta?.destructive
                                    ? "destructive"
                                    : "default"
                            }
                            disabled={confirmBusy}
                            onClick={() => void runPending()}
                        >
                            {confirmBusy ? "处理中…" : confirmMeta?.confirm}
                        </Button>
                    </>
                }
            >
                <div />
            </PageDialog>
            <PageDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                        setDeleteEmail("");
                    }
                }}
                title="永久删除用户"
                description={`该操作会连带删除用户订单、邀请码、流量统计和工单，且无法恢复。`}
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
                            disabled={
                                !deleteTarget ||
                                deleteEmail !== deleteTarget.email ||
                                busy === Number(deleteTarget?.id)
                            }
                            onClick={() => void destroyUser()}
                        >
                            永久删除
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <p className="text-sm">
                        请输入用户邮箱 <strong>{deleteTarget?.email}</strong>{" "}
                        确认永久删除。
                    </p>
                    <Input
                        value={deleteEmail}
                        onChange={(event) => setDeleteEmail(event.target.value)}
                        placeholder="完整输入用户邮箱"
                        autoComplete="off"
                    />
                </div>
            </PageDialog>
        </PageShell>
    );
}

function TrafficEditor({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <div className="grid gap-2">
            <span className="text-sm font-medium">{label}</span>
            <Input
                value={value}
                type="number"
                min={0}
                step="any"
                onChange={(event) => onChange(Number(event.target.value))}
            />
            <small className="text-muted-foreground">
                {formatTraffic(giBToBytes(value))} ·{" "}
                {giBToBytes(value).toLocaleString("zh-CN")} 字节
            </small>
        </div>
    );
}
function NumberEditor({
    label,
    value,
    onChange,
    min,
    max,
    step,
    hint,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: string;
    hint?: string;
}) {
    return (
        <div className="grid gap-2">
            <span className="text-sm font-medium">{label}</span>
            <Input
                value={value}
                type="number"
                min={min}
                max={max}
                step={step}
                onChange={(event) => onChange(Number(event.target.value))}
            />
            {hint && <small className="text-muted-foreground">{hint}</small>}
        </div>
    );
}
function OptionalNumberEditor({
    label,
    value,
    onChange,
    min,
    max,
}: {
    label: string;
    value: number | string | null;
    onChange: (value: number | string) => void;
    min?: number;
    max?: number;
}) {
    return (
        <div className="grid gap-2">
            <span className="text-sm font-medium">{label}</span>
            <Input
                value={value ?? ""}
                type="number"
                min={min}
                max={max}
                onChange={(event) =>
                    onChange(
                        event.target.value === ""
                            ? ""
                            : Number(event.target.value),
                    )
                }
            />
        </div>
    );
}
function ToggleEditor({
    label,
    checked,
    onCheckedChange,
    onLabel,
    offLabel,
}: {
    label: string;
    checked: boolean;
    onCheckedChange: (value: boolean) => void;
    onLabel: string;
    offLabel: string;
}) {
    return (
        <label className="flex items-center gap-2 text-sm">
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
            <span>
                <strong className="block">{label}</strong>
                <small className="text-muted-foreground">
                    {checked ? onLabel : offLabel}
                </small>
            </span>
        </label>
    );
}
function DetailItem({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="rounded-lg border p-3">
            <small className="text-muted-foreground">{label}</small>
            <strong className="mt-1 block break-words text-sm">
                {String(value ?? "-")}
            </strong>
        </div>
    );
}
