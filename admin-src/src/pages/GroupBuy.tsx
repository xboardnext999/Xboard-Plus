import { useEffect, useMemo, useState } from "react"
import {
  Clock3,
  CopyPlus,
  LoaderCircle,
  Package,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { get, post } from "@/services/http"
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
  type UnknownRecord,
} from "./react-page-helpers"

type EntityId = string | number

interface PlanRow extends UnknownRecord {
  id: EntityId
  name: string
  prices: Record<string, number>
  active_periods: string[]
}

interface PeriodMeta extends UnknownRecord {
  name?: string
}

interface ActivityRow extends UnknownRecord {
  id: EntityId
  title: string
  plan_id: EntityId
  plan_name: string
  period: string
  period_label: string
  period_price: number
  group_size: number
  discount_type: number
  discount_value: number
  discount_label: string
  started_at: number | null
  ended_at: number | null
  expire_minutes: number
  status: number
  groups_count: number
  open_groups_count: number
  completed_groups_count: number
  expired_groups_count: number
}

interface GroupMember extends UnknownRecord {
  id: EntityId
  email: string
  order_trade_no: string | null
  order_status: number | null
  status: number
  status_label: string
  created_at: number | null
}

interface GroupRow extends UnknownRecord {
  id: EntityId
  activity_id: EntityId
  activity_title: string
  leader_email: string
  status: number
  status_label: string
  required_count: number
  current_count: number
  expired_at: number | null
  created_at: number | null
  members: GroupMember[]
}

interface ActivityForm {
  id: EntityId | null
  title: string
  plan_id: EntityId | ""
  period: string
  group_size: number
  discount_type: 1 | 2
  discount_value_yuan: number
  discount_value_percent: number
  started_at: string
  ended_at: string
  expire_minutes: number
  status: number
}

interface ActivityFilters {
  keyword: string
  status: string
  plan_id: EntityId | ""
}

interface PageInfo {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

interface PeriodOption {
  value: string
  label: string
  price: number
}

const PERIOD_LABELS: Record<string, string> = {
  monthly: "月付",
  quarterly: "季付",
  half_yearly: "半年付",
  yearly: "年付",
  two_yearly: "两年付",
  three_yearly: "三年付",
  onetime: "一次性",
  reset_traffic: "重置流量",
}

const ORDER_STATUS: Record<number, string> = {
  0: "待支付",
  1: "开通中",
  2: "已取消",
  3: "已完成",
  4: "已折抵",
}

function objectValue(value: unknown): UnknownRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as UnknownRecord
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as UnknownRecord
        : {}
    } catch {
      return {}
    }
  }
  return {}
}

function defaultForm(): ActivityForm {
  return {
    id: null,
    title: "",
    plan_id: "",
    period: "",
    group_size: 2,
    discount_type: 1,
    discount_value_yuan: 0,
    discount_value_percent: 10,
    started_at: "",
    ended_at: "",
    expire_minutes: 1440,
    status: 1,
  }
}

function normalizePlan(value: unknown): PlanRow {
  const item = objectValue(value)
  const rawPrices = objectValue(item.prices)
  const prices = Object.fromEntries(
    Object.entries(rawPrices).map(([key, price]) => [key, Number(price || 0)]),
  )
  return {
    ...item,
    id: item.id as EntityId,
    name: String(item.name ?? ""),
    prices,
    active_periods: Array.isArray(item.active_periods)
      ? item.active_periods.map(String)
      : [],
  }
}

function normalizeActivity(value: unknown): ActivityRow {
  const item = objectValue(value)
  return {
    ...item,
    id: item.id as EntityId,
    title: String(item.title ?? ""),
    plan_id: item.plan_id as EntityId,
    plan_name: String(item.plan_name ?? "—"),
    period: String(item.period ?? ""),
    period_label: String(item.period_label ?? item.period ?? ""),
    period_price: Number(item.period_price || 0),
    group_size: Number(item.group_size || 2),
    discount_type: Number(item.discount_type || 1),
    discount_value: Number(item.discount_value || 0),
    discount_label: String(item.discount_label ?? ""),
    started_at: item.started_at ? Number(item.started_at) : null,
    ended_at: item.ended_at ? Number(item.ended_at) : null,
    expire_minutes: Number(item.expire_minutes || 0),
    status: Number(item.status || 0),
    groups_count: Number(item.groups_count || 0),
    open_groups_count: Number(item.open_groups_count || 0),
    completed_groups_count: Number(item.completed_groups_count || 0),
    expired_groups_count: Number(item.expired_groups_count || 0),
  }
}

function normalizeMember(value: unknown): GroupMember {
  const item = objectValue(value)
  return {
    ...item,
    id: item.id as EntityId,
    email: String(item.email ?? "—"),
    order_trade_no: item.order_trade_no ? String(item.order_trade_no) : null,
    order_status: item.order_status == null ? null : Number(item.order_status),
    status: Number(item.status || 0),
    status_label: String(item.status_label ?? ""),
    created_at: item.created_at ? Number(item.created_at) : null,
  }
}

function normalizeGroup(value: unknown): GroupRow {
  const item = objectValue(value)
  return {
    ...item,
    id: item.id as EntityId,
    activity_id: item.activity_id as EntityId,
    activity_title: String(item.activity_title ?? ""),
    leader_email: String(item.leader_email ?? "—"),
    status: Number(item.status || 0),
    status_label: String(item.status_label ?? ""),
    required_count: Number(item.required_count || 0),
    current_count: Number(item.current_count || 0),
    expired_at: item.expired_at ? Number(item.expired_at) : null,
    created_at: item.created_at ? Number(item.created_at) : null,
    members: Array.isArray(item.members) ? item.members.map(normalizeMember) : [],
  }
}

function periodOptionsFor(
  planId: EntityId | "",
  plans: PlanRow[],
  periods: Record<string, PeriodMeta>,
): PeriodOption[] {
  const plan = plans.find((item) => String(item.id) === String(planId))
  if (!plan) return []
  return plan.active_periods
    .filter((period) => Number(plan.prices[period] || 0) > 0)
    .map((period) => ({
      value: period,
      label: periods[period]?.name || PERIOD_LABELS[period] || period,
      price: Math.round(Number(plan.prices[period] || 0) * 100),
    }))
}

function toDatetimeInput(timestamp: unknown) {
  if (!timestamp) return ""
  const date = new Date(Number(timestamp) * 1000)
  if (Number.isNaN(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function formatMoney(cents: unknown) {
  return "¥" + (Number(cents || 0) / 100).toFixed(2)
}

function formatTime(timestamp: unknown) {
  if (!timestamp) return "不限"
  const date = new Date(Number(timestamp) * 1000)
  return Number.isNaN(date.getTime())
    ? "不限"
    : date.toLocaleString("zh-CN", { hour12: false })
}

function durationLabel(minutes: unknown) {
  const value = Number(minutes || 0)
  if (value % 1440 === 0) return value / 1440 + " 天"
  if (value % 60 === 0) return value / 60 + " 小时"
  return value + " 分钟"
}

function groupProgress(group: GroupRow) {
  return Math.min(
    100,
    Math.round(
      Number(group.current_count || 0)
        / Math.max(1, Number(group.required_count || 1))
        * 100,
    ),
  )
}

function activityPhase(activity: ActivityRow) {
  if (Number(activity.status) !== 1) {
    return { text: "已停用", tone: "neutral" as const }
  }
  const now = Math.floor(Date.now() / 1000)
  if (activity.started_at && Number(activity.started_at) > now) {
    return { text: "未开始", tone: "warning" as const }
  }
  if (activity.ended_at && Number(activity.ended_at) < now) {
    return { text: "已结束", tone: "neutral" as const }
  }
  return { text: "进行中", tone: "default" as const }
}

function groupTone(status: number): "default" | "neutral" | "warning" {
  if (status === 2) return "default"
  if (status === 1) return "warning"
  return "neutral"
}

export default function GroupBuy() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [groupLoading, setGroupLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [periods, setPeriods] = useState<Record<string, PeriodMeta>>({})
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow | null>(null)
  const [busyId, setBusyId] = useState<EntityId | null>(null)
  const [groupStatus, setGroupStatus] = useState("all")
  const [filters, setFilters] = useState<ActivityFilters>({
    keyword: "",
    status: "all",
    plan_id: "",
  })
  const [form, setForm] = useState<ActivityForm>(defaultForm)
  const [pagination, setPagination] = useState<PageInfo>({
    current_page: 1,
    per_page: 10,
    total: 0,
    last_page: 1,
  })
  const [groupPagination, setGroupPagination] = useState<PageInfo>({
    current_page: 1,
    per_page: 20,
    total: 0,
    last_page: 1,
  })

  async function fetchActivities(
    page = pagination.current_page,
    activeFilters: ActivityFilters = filters,
  ) {
    setLoading(true)
    try {
      const data = await get<UnknownRecord>("/group-buy/fetch", {
        current: page,
        pageSize: pagination.per_page,
        keyword: activeFilters.keyword,
        status: activeFilters.status,
        plan_id: activeFilters.plan_id,
      })
      const items = Array.isArray(data?.items)
        ? data.items.map(normalizeActivity)
        : []
      const nextPlans = Array.isArray(data?.plans)
        ? data.plans.map(normalizePlan)
        : plans
      const nextPeriods = Object.fromEntries(
        Object.entries(objectValue(data?.periods)).map(([key, value]) => [
          key,
          objectValue(value) as PeriodMeta,
        ]),
      )
      setActivities(items)
      setPlans(nextPlans)
      if (Object.keys(nextPeriods).length) setPeriods(nextPeriods)
      setPagination((current) => ({
        current_page: Number(data?.current_page || page),
        per_page: Number(data?.per_page || current.per_page),
        total: Number(data?.total || 0),
        last_page: Number(data?.last_page || 1),
      }))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchActivities(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const periodOptions = useMemo(
    () => periodOptionsFor(form.plan_id, plans, periods),
    [form.plan_id, periods, plans],
  )
  const selectedPeriod = useMemo(
    () => periodOptions.find((item) => item.value === form.period),
    [form.period, periodOptions],
  )
  const previewPrice = useMemo(() => {
    const original = Number(selectedPeriod?.price || 0)
    if (!original) return { original: 0, discount: 0, final: 0 }
    const discount = Number(form.discount_type) === 1
      ? Math.round(Number(form.discount_value_yuan || 0) * 100)
      : Math.round(original * Number(form.discount_value_percent || 0) / 100)
    const safeDiscount = Math.min(original, Math.max(0, discount))
    return {
      original,
      discount: safeDiscount,
      final: Math.max(0, original - safeDiscount),
    }
  }, [
    form.discount_type,
    form.discount_value_percent,
    form.discount_value_yuan,
    selectedPeriod,
  ])
  const summary = useMemo(() => ({
    total: pagination.total,
    enabled: activities.filter((item) => Number(item.status) === 1).length,
    openGroups: activities.reduce(
      (sum, item) => sum + Number(item.open_groups_count || 0),
      0,
    ),
    completedGroups: activities.reduce(
      (sum, item) => sum + Number(item.completed_groups_count || 0),
      0,
    ),
  }), [activities, pagination.total])

  function startCreate() {
    const firstPlan = plans[0]
    const planId = firstPlan?.id ?? ""
    const options = periodOptionsFor(planId, plans, periods)
    setForm({
      ...defaultForm(),
      plan_id: planId,
      period: options[0]?.value || "",
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setForm(defaultForm())
  }

  function selectPlan(planId: string) {
    const options = periodOptionsFor(planId, plans, periods)
    setForm((current) => ({
      ...current,
      plan_id: planId,
      period: options.some((item) => item.value === current.period)
        ? current.period
        : options[0]?.value || "",
    }))
  }

  function editActivity(activity: ActivityRow) {
    setForm({
      ...defaultForm(),
      id: activity.id,
      title: activity.title,
      plan_id: activity.plan_id,
      period: activity.period,
      group_size: activity.group_size,
      discount_type: activity.discount_type === 2 ? 2 : 1,
      discount_value_yuan: activity.discount_type === 1
        ? Number(activity.discount_value || 0) / 100
        : 0,
      discount_value_percent: activity.discount_type === 2
        ? Number(activity.discount_value || 0)
        : 10,
      started_at: toDatetimeInput(activity.started_at),
      ended_at: toDatetimeInput(activity.ended_at),
      expire_minutes: activity.expire_minutes,
      status: activity.status,
    })
    setShowForm(true)
  }

  function copyActivity(activity: ActivityRow) {
    setForm({
      ...defaultForm(),
      id: null,
      title: activity.title + " - 副本",
      plan_id: activity.plan_id,
      period: activity.period,
      group_size: activity.group_size,
      discount_type: activity.discount_type === 2 ? 2 : 1,
      discount_value_yuan: activity.discount_type === 1
        ? Number(activity.discount_value || 0) / 100
        : 0,
      discount_value_percent: activity.discount_type === 2
        ? Number(activity.discount_value || 0)
        : 10,
      started_at: toDatetimeInput(activity.started_at),
      ended_at: toDatetimeInput(activity.ended_at),
      expire_minutes: activity.expire_minutes,
      status: 0,
    })
    setShowForm(true)
  }

  async function saveActivity() {
    if (!form.plan_id || !form.period) {
      toast.error("请选择套餐和周期")
      return
    }
    if (Number(form.group_size) < 2 || Number(form.group_size) > 100) {
      toast.error("成团人数必须在 2–100 人之间")
      return
    }
    if (
      Number(form.discount_type) === 1
      && previewPrice.discount >= previewPrice.original
    ) {
      toast.error("固定优惠必须小于套餐原价")
      return
    }
    if (
      Number(form.discount_type) === 2
      && (
        Number(form.discount_value_percent) <= 0
        || Number(form.discount_value_percent) >= 100
      )
    ) {
      toast.error("折扣比例必须大于 0 且小于 100%")
      return
    }
    if (
      form.started_at
      && form.ended_at
      && new Date(form.ended_at) <= new Date(form.started_at)
    ) {
      toast.error("结束时间必须晚于开始时间")
      return
    }
    setSaving(true)
    try {
      await post("/group-buy/save", {
        id: form.id,
        title: form.title,
        plan_id: form.plan_id,
        period: form.period,
        group_size: form.group_size,
        discount_type: form.discount_type,
        discount_value: form.discount_type === 1
          ? Math.round(Number(form.discount_value_yuan || 0) * 100)
          : Math.round(Number(form.discount_value_percent || 0)),
        started_at: form.started_at,
        ended_at: form.ended_at,
        expire_minutes: form.expire_minutes,
        status: form.status,
      })
      const edited = Boolean(form.id)
      toast.success("已保存拼团活动")
      setShowForm(false)
      await fetchActivities(edited ? pagination.current_page : 1)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivity(activity: ActivityRow) {
    setBusyId(activity.id)
    try {
      await post("/group-buy/update", {
        id: activity.id,
        status: activity.status === 1 ? 0 : 1,
      })
      toast.success("状态已更新")
      await fetchActivities(pagination.current_page)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  async function deleteActivity(activity: ActivityRow) {
    if (Number(activity.groups_count || 0) > 0) {
      toast.error("该活动已有拼团队伍，不能删除，请停用活动")
      return
    }
    setBusyId(activity.id)
    try {
      await post("/group-buy/drop", { id: activity.id })
      toast.success("已删除活动")
      await fetchActivities(pagination.current_page)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  async function openGroups(
    activity: ActivityRow,
    page = 1,
    status = groupStatus,
  ) {
    setSelectedActivity(activity)
    if (page === 1) setGroups([])
    setGroupLoading(true)
    try {
      const data = await get<UnknownRecord>("/group-buy/groups", {
        activity_id: activity.id,
        status,
        current: page,
        pageSize: 20,
      })
      setGroups(Array.isArray(data?.items) ? data.items.map(normalizeGroup) : [])
      setGroupPagination({
        current_page: Number(data?.current_page || page),
        per_page: Number(data?.per_page || 20),
        total: Number(data?.total || 0),
        last_page: Number(data?.last_page || 1),
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setGroupLoading(false)
    }
  }

  function closeGroups() {
    setSelectedActivity(null)
    setGroups([])
  }

  return (
    <PageShell>
      <PageHeader
        title="拼团管理"
        description="管理套餐拼团活动、查看队伍进度，并控制活动启停。"
        action={(
          <Button onClick={startCreate}>
            <Plus />
            新建活动
          </Button>
        )}
      />

      <MetricGrid>
        <MetricCard label="活动总数" value={summary.total} />
        <MetricCard label="启用中" value={summary.enabled} />
        <MetricCard label="进行中队伍" value={summary.openGroups} />
        <MetricCard label="已成团队伍" value={summary.completedGroups} />
      </MetricGrid>

      <Panel>
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_160px_220px_auto] lg:items-end">
          <div className="grid gap-2">
            <Label htmlFor="group-buy-search">搜索</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="group-buy-search"
                className="pl-8"
                value={filters.keyword}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  keyword: event.target.value,
                }))}
                onKeyDown={(event) => event.key === "Enter" && void fetchActivities(1)}
                placeholder="搜索活动 / 套餐名称"
              />
            </div>
          </div>
          <SelectField
            label="活动状态"
            value={filters.status}
            onValueChange={(status) => {
              const next = { ...filters, status: status || "all" }
              setFilters(next)
              void fetchActivities(1, next)
            }}
            options={[
              { value: "all", label: "全部状态" },
              { value: "1", label: "启用" },
              { value: "0", label: "停用" },
            ]}
          />
          <SelectField
            label="绑定套餐"
            value={filters.plan_id}
            onValueChange={(plan_id) => {
              const next = { ...filters, plan_id }
              setFilters(next)
              void fetchActivities(1, next)
            }}
            options={[
              { value: "", label: "全部套餐" },
              ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
            ]}
          />
          <Button variant="outline" disabled={loading} onClick={() => void fetchActivities(1)}>
            {loading ? <LoaderCircle className="animate-spin" /> : <Search />}
            筛选
          </Button>
        </div>
      </Panel>

      <Card>
        <CardHeader className="border-b">
          <div>
            <CardTitle>活动列表</CardTitle>
            <CardDescription>套餐、周期、优惠与队伍数据均来自当前活动配置。</CardDescription>
          </div>
          <Badge variant="outline">共 {pagination.total} 条</Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>活动</TableHead>
                <TableHead>套餐周期</TableHead>
                <TableHead>成团人数</TableHead>
                <TableHead>优惠</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>队伍</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9}><EmptyState>加载中…</EmptyState></TableCell></TableRow>
              ) : activities.length === 0 ? (
                <TableRow><TableCell colSpan={9}><EmptyState>暂无拼团活动</EmptyState></TableCell></TableRow>
              ) : activities.map((activity) => {
                const phase = activityPhase(activity)
                const finalPrice = activity.discount_type === 1
                  ? Math.max(0, activity.period_price - activity.discount_value)
                  : Math.round(activity.period_price * (100 - activity.discount_value) / 100)
                const isBusy = String(busyId) === String(activity.id)
                return (
                  <TableRow key={activity.id}>
                    <TableCell>#{activity.id}</TableCell>
                    <TableCell>
                      <strong className="block max-w-52 truncate">{activity.title}</strong>
                      <small className="text-muted-foreground">{activity.plan_name}</small>
                    </TableCell>
                    <TableCell>
                      <span className="block">{activity.period_label}</span>
                      <small className="block text-muted-foreground">原价 {formatMoney(activity.period_price)}</small>
                      <small className="block font-medium text-primary">实付 {formatMoney(finalPrice)}</small>
                    </TableCell>
                    <TableCell>{activity.group_size} 人</TableCell>
                    <TableCell><Badge variant="secondary">{activity.discount_label}</Badge></TableCell>
                    <TableCell>
                      <small className="block">开始：{formatTime(activity.started_at)}</small>
                      <small className="block">结束：{formatTime(activity.ended_at)}</small>
                      <small className="block text-muted-foreground">队伍有效：{durationLabel(activity.expire_minutes)}</small>
                    </TableCell>
                    <TableCell>
                      <Button variant="link" className="h-auto whitespace-normal p-0 text-left" onClick={() => void openGroups(activity)}>
                        {activity.open_groups_count} 进行中 / {activity.completed_groups_count} 已成团 / {activity.expired_groups_count} 过期
                      </Button>
                    </TableCell>
                    <TableCell><StatusBadge tone={phase.tone}>{phase.text}</StatusBadge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => editActivity(activity)}>编辑</Button>
                        <Button variant="outline" size="sm" onClick={() => copyActivity(activity)}>
                          <CopyPlus />
                          复制
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void toggleActivity(activity)}
                        >
                          {isBusy && <LoaderCircle className="animate-spin" />}
                          {activity.status === 1 ? "停用" : "启用"}
                        </Button>
                        <ConfirmAction
                          title="删除拼团活动"
                          description={"确定删除「" + activity.title + "」？"}
                          confirmText="删除活动"
                          disabled={activity.groups_count > 0 || isBusy}
                          onConfirm={() => deleteActivity(activity)}
                        >
                          <Trash2 />
                          删除
                        </ConfirmAction>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination
        current={pagination.current_page}
        last={pagination.last_page}
        total={pagination.total}
        loading={loading}
        onChange={(page) => void fetchActivities(page)}
      />

      {selectedActivity && (
        <Card>
          <CardHeader className="border-b">
            <div>
              <CardTitle>队伍与参与订单</CardTitle>
              <CardDescription>{selectedActivity.title} 的拼团队伍、成员及关联订单。</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={closeGroups} aria-label="关闭队伍列表">
              <X />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SelectField
                className="w-full sm:w-56"
                label="队伍状态"
                value={groupStatus}
                onValueChange={(status) => {
                  const next = status || "all"
                  setGroupStatus(next)
                  void openGroups(selectedActivity, 1, next)
                }}
                options={[
                  { value: "all", label: "全部队伍" },
                  { value: "1", label: "进行中" },
                  { value: "2", label: "已成团" },
                  { value: "3", label: "已过期" },
                ]}
              />
              <Badge variant="outline">共 {groupPagination.total} 支队伍</Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>队伍</TableHead>
                  <TableHead>团长</TableHead>
                  <TableHead>人数进度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>过期时间</TableHead>
                  <TableHead>参与成员 / 订单</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupLoading ? (
                  <TableRow><TableCell colSpan={6}><EmptyState>加载中…</EmptyState></TableCell></TableRow>
                ) : groups.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState>暂无队伍</EmptyState></TableCell></TableRow>
                ) : groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <strong className="block">#{group.id}</strong>
                      <small className="text-muted-foreground">创建于 {formatTime(group.created_at)}</small>
                    </TableCell>
                    <TableCell>{group.leader_email}</TableCell>
                    <TableCell>
                      <div className="min-w-32 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>{group.current_count} / {group.required_count}</span>
                          <span>{groupProgress(group)}%</span>
                        </div>
                        <Progress value={groupProgress(group)} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={groupTone(group.status)}>{group.status_label}</StatusBadge>
                    </TableCell>
                    <TableCell>{formatTime(group.expired_at)}</TableCell>
                    <TableCell className="max-w-md whitespace-normal">
                      <div className="grid min-w-72 gap-2">
                        {group.members.map((member) => (
                          <div key={member.id} className="rounded-lg border bg-muted/30 p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <strong className="text-xs">{member.email}</strong>
                              <Badge variant={member.status === 2 ? "default" : "secondary"}>
                                {member.status_label}
                              </Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <ReceiptText className="size-3" />
                                {member.order_trade_no || "未关联订单"}
                              </span>
                              {member.order_status != null && (
                                <span>订单：{ORDER_STATUS[member.order_status] || "状态 " + member.order_status}</span>
                              )}
                              <span>加入：{formatTime(member.created_at)}</span>
                            </div>
                          </div>
                        ))}
                        {!group.members.length && <small className="text-muted-foreground">暂无成员数据</small>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination
              current={groupPagination.current_page}
              last={groupPagination.last_page}
              total={groupPagination.total}
              loading={groupLoading}
              onChange={(page) => void openGroups(selectedActivity, page)}
            />
          </CardContent>
        </Card>
      )}

      <PageDialog
        open={showForm}
        onOpenChange={(open) => open ? setShowForm(true) : cancelForm()}
        title={form.id ? "编辑拼团活动" : "新建拼团活动"}
        description="固定优惠按元填写，保存后自动转换为订单金额单位。"
        className="sm:max-w-4xl"
        footer={(
          <>
            <Button variant="outline" onClick={cancelForm}>取消</Button>
            <Button disabled={saving} onClick={() => void saveActivity()}>
              {saving && <LoaderCircle className="animate-spin" />}
              {saving ? "保存中…" : "保存活动"}
            </Button>
          </>
        )}
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="group-buy-title">活动标题</Label>
              <Input
                id="group-buy-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="例如：标准会员拼团"
              />
            </div>
            <SelectField
              label="绑定套餐"
              value={form.plan_id}
              onValueChange={selectPlan}
              options={[
                { value: "", label: "请选择套餐" },
                ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
              ]}
            />
            <SelectField
              label="套餐周期"
              value={form.period}
              onValueChange={(period) => setForm((current) => ({ ...current, period }))}
              options={[
                { value: "", label: "请选择周期" },
                ...periodOptions.map((period) => ({
                  value: period.value,
                  label: period.label + " · " + formatMoney(period.price),
                })),
              ]}
            />
            <div className="grid gap-2">
              <Label htmlFor="group-buy-size">成团人数</Label>
              <Input
                id="group-buy-size"
                type="number"
                min={2}
                max={100}
                value={form.group_size}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  group_size: Number(event.target.value),
                }))}
              />
            </div>
            <SelectField
              label="优惠类型"
              value={form.discount_type}
              onValueChange={(discountType) => setForm((current) => ({
                ...current,
                discount_type: Number(discountType) === 2 ? 2 : 1,
              }))}
              options={[
                { value: 1, label: "固定金额" },
                { value: 2, label: "百分比折扣" },
              ]}
            />
            {form.discount_type === 1 ? (
              <div className="grid gap-2">
                <Label htmlFor="group-buy-fixed">固定优惠（元）</Label>
                <Input
                  id="group-buy-fixed"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discount_value_yuan}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    discount_value_yuan: Number(event.target.value),
                  }))}
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="group-buy-percent">折扣比例（%）</Label>
                <Input
                  id="group-buy-percent"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.discount_value_percent}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    discount_value_percent: Number(event.target.value),
                  }))}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="group-buy-start">开始时间</Label>
              <Input
                id="group-buy-start"
                type="datetime-local"
                value={form.started_at}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  started_at: event.target.value,
                }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-buy-end">结束时间</Label>
              <Input
                id="group-buy-end"
                type="datetime-local"
                value={form.ended_at}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  ended_at: event.target.value,
                }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-buy-expiry">队伍有效期（分钟）</Label>
              <Input
                id="group-buy-expiry"
                type="number"
                min={1}
                max={10_080}
                value={form.expire_minutes}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  expire_minutes: Number(event.target.value),
                }))}
              />
            </div>
            <label className="flex items-center gap-3 self-end rounded-lg border p-3 text-sm">
              <Switch
                checked={form.status === 1}
                onCheckedChange={(enabled) => setForm((current) => ({
                  ...current,
                  status: enabled ? 1 : 0,
                }))}
              />
              <span><strong className="block">活动状态</strong><small className="text-muted-foreground">{form.status === 1 ? "已启用" : "已停用"}</small></span>
            </label>
          </div>

          {selectedPeriod && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["套餐原价", formatMoney(previewPrice.original), Package],
                ["拼团优惠", "- " + formatMoney(previewPrice.discount), Users],
                ["预计实付", formatMoney(previewPrice.final), ReceiptText],
                ["队伍有效期", durationLabel(form.expire_minutes), Clock3],
              ] as const).map(([label, value, Icon], index) => (
                <Card key={label} size="sm" className={cn(index === 2 && "ring-primary")}>
                  <CardContent className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <small className="text-muted-foreground">{label}</small>
                      <strong className={cn("block", index === 2 && "text-primary")}>{value}</strong>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageDialog>
    </PageShell>
  )
}
