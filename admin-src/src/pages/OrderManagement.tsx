import { useCallback, useEffect, useMemo, useState } from "react"
import { CreditCard, Download, Plus, RefreshCw, Search, XCircle } from "lucide-react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { get, getEnvelope, post } from "@/services/http"
import {
  EmptyState,
  FormField,
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
} from "./react-page-helpers"

const PAGE_SIZE = 20
const EXPORT_PAGE_SIZE = 1000

const STATUS = {
  0: ["待支付", "warning"],
  1: ["开通中", "warning"],
  2: ["已取消", "neutral"],
  3: ["已完成", "default"],
  4: ["已折抵", "neutral"],
} as const

const TYPES: Record<number, string> = {
  1: "新购",
  2: "续费",
  3: "升级",
  4: "流量重置",
}

const PERIODS = {
  month_price: "月付",
  quarter_price: "季付",
  half_year_price: "半年付",
  year_price: "年付",
  two_year_price: "两年付",
  three_year_price: "三年付",
  onetime_price: "一次性",
  reset_price: "重置流量",
} as const

const PERIOD_PRICE_KEYS: Record<keyof typeof PERIODS, string> = {
  month_price: "monthly",
  quarter_price: "quarterly",
  half_year_price: "half_yearly",
  year_price: "yearly",
  two_year_price: "two_yearly",
  three_year_price: "three_yearly",
  onetime_price: "onetime",
  reset_price: "reset_traffic",
}

type LegacyPeriod = keyof typeof PERIODS
type OrderAction = "paid" | "cancel"
type StatusTone = (typeof STATUS)[keyof typeof STATUS][1]

interface OrderPlan {
  id?: number
  name?: string
  product_type?: string
  prices?: Record<string, string | number | null | undefined>
}

interface OrderUser {
  email?: string
}

interface DigitalItem {
  id: number | string
  content?: string
}

interface OrderRow {
  id: number
  trade_no: string
  user_id?: number
  plan_id?: number
  type?: number | string
  period?: string
  total_amount?: number | string
  discount_amount?: number | string
  group_buy_discount_amount?: number | string
  balance_amount?: number | string
  handling_amount?: number | string
  refund_amount?: number | string
  payment_id?: number | string | null
  callback_no?: string | null
  status?: number | string
  created_at?: number | string
  paid_at?: number | string | null
  plan?: OrderPlan | null
  user?: OrderUser | null
  digitalItems?: DigitalItem[]
  digital_items?: DigitalItem[]
}

interface PlanRow extends OrderPlan {
  id: number
  name: string
}

interface OrderFilters {
  keyword: string
  status: string
  type: string
  plan_id: string
  product_type: string
}

interface PageState {
  current: number
  size: number
  total: number
  last: number
}

interface OrderPageResult {
  items: OrderRow[]
  current: number
  total: number
  last: number
}

interface AssignState {
  email: string
  planId: string
  period: LegacyPeriod | ""
  totalYuan: string
}

function initialFilters(digital: boolean): OrderFilters {
  return {
    keyword: "",
    status: "all",
    type: "all",
    plan_id: "",
    product_type: digital ? "digital" : "all",
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalizeOrders(value: unknown): OrderRow[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const order = asRecord(item)
    return {
      ...order,
      id: Number(order.id),
      trade_no: String(order.trade_no || ""),
    } as OrderRow
  })
}

function parsePage(payload: unknown, fallbackCurrent: number, pageSize: number): OrderPageResult {
  if (Array.isArray(payload)) {
    const items = normalizeOrders(payload)
    return { items, current: fallbackCurrent, total: items.length, last: 1 }
  }

  const envelope = asRecord(payload)
  const nested = asRecord(envelope.data)
  const source = Object.keys(nested).length && (
    Array.isArray(nested.data) || Array.isArray(nested.items) || nested.total != null
  ) ? nested : envelope
  const items = normalizeOrders(
    Array.isArray(source.items)
      ? source.items
      : Array.isArray(source.data)
        ? source.data
        : [],
  )
  const total = Number(source.total ?? items.length)
  const current = Number(source.current_page ?? source.current ?? fallbackCurrent)
  const last = Number(source.last_page ?? source.last ?? Math.max(1, Math.ceil(total / pageSize)))
  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
    current: Number.isFinite(current) ? current : fallbackCurrent,
    last: Number.isFinite(last) ? Math.max(1, last) : 1,
  }
}

function centsInteger(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? Math.round(parsed) : 0
}

function money(value: unknown) {
  const cents = centsInteger(value)
  const absolute = Math.abs(cents)
  const whole = Math.floor(absolute / 100).toLocaleString("zh-CN")
  const fraction = String(absolute % 100).padStart(2, "0")
  return `${cents < 0 ? "-" : ""}¥${whole}.${fraction}`
}

function moneyPlain(value: unknown) {
  const cents = centsInteger(value)
  const absolute = Math.abs(cents)
  return `${cents < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`
}

function yuanToCents(value: string): number | null {
  const normalized = value.trim()
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null
  const [whole = "0", decimal = ""] = normalized.split(".")
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"))
  return Number.isSafeInteger(cents) ? cents : null
}

function displayTime(value: unknown) {
  if (!value) return "—"
  const numeric = Number(value)
  const date = Number.isFinite(numeric) ? new Date(numeric * 1000) : new Date(String(value))
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false })
}

function statusMeta(order: Pick<OrderRow, "status">): { label: string; tone: StatusTone } {
  const meta = STATUS[Number(order.status) as keyof typeof STATUS]
  return meta ? { label: meta[0], tone: meta[1] } : { label: "未知", tone: "neutral" }
}

function typeLabel(value: unknown) {
  return TYPES[Number(value)] || "未知"
}

function periodLabel(value: unknown) {
  const period = String(value || "")
  return PERIODS[period as LegacyPeriod] || period || "—"
}

function productTypeLabel(value: unknown) {
  return ({ subscription: "订阅套餐", forwarding: "转发套餐", digital: "数字商品" } as Record<string, string>)[String(value)] || "其他商品"
}

function planPriceYuan(plan: PlanRow | undefined, period: LegacyPeriod) {
  const prices = plan?.prices || {}
  const legacyKey = period.replace("_price", "")
  return Number(prices[legacyKey] || prices[PERIOD_PRICE_KEYS[period]] || 0)
}

function availablePeriods(plan: PlanRow | undefined): Array<[LegacyPeriod, string]> {
  if (!plan) return []
  return (Object.entries(PERIODS) as Array<[LegacyPeriod, string]>).filter(([period]) => planPriceYuan(plan, period) > 0)
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

export default function OrderManagement() {
  const location = useLocation()
  const digitalRoute = location.pathname.startsWith("/digital/")
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [busy, setBusy] = useState("")
  const [detail, setDetail] = useState<OrderRow | null>(null)
  const [showAssign, setShowAssign] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignConfirm, setAssignConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ order: OrderRow; kind: OrderAction } | null>(null)
  const [filters, setFilters] = useState<OrderFilters>(() => initialFilters(digitalRoute))
  const [page, setPage] = useState<PageState>({ current: 1, size: PAGE_SIZE, total: 0, last: 1 })
  const [assign, setAssign] = useState<AssignState>({ email: "", planId: "", period: "", totalYuan: "0.00" })

  const buildQuery = useCallback((current: number, size: number, source: OrderFilters) => {
    const query = new URLSearchParams({ current: String(current), pageSize: String(size) })
    let index = 0
    const add = (id: string, value: string) => {
      if (value === "" || value === "all") return
      query.set(`filter[${index}][id]`, id)
      query.set(`filter[${index}][value]`, value)
      index += 1
    }
    if (source.keyword.trim()) {
      const keyword = source.keyword.trim()
      const isTrade = /^[A-Za-z0-9_-]{8,}$/.test(keyword)
      add(isTrade ? "trade_no" : "user_id", isTrade ? keyword : `like:${keyword}`)
    }
    add("status", source.status)
    add("type", source.type)
    add("plan_id", source.plan_id)
    add("product_type", source.product_type)
    return query.toString()
  }, [])

  const fetchPage = useCallback(async (current: number, size: number, source: OrderFilters) => {
    const payload = await getEnvelope(`/order/fetch?${buildQuery(current, size, source)}`)
    return parsePage(payload, current, size)
  }, [buildQuery])

  const load = useCallback(async (reset = false, requestedPage = 1, source: OrderFilters) => {
    const current = reset ? 1 : requestedPage
    setLoading(true)
    try {
      const result = await fetchPage(current, PAGE_SIZE, source)
      setOrders(result.items)
      setPage({ current: result.current, size: PAGE_SIZE, total: result.total, last: result.last })
    } catch (error) {
      toast.error(errorMessage(error))
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  const loadPlans = useCallback(async () => {
    try {
      const [normal, digital] = await Promise.all([get("/plan/fetch"), get("/digital-products/fetch")])
      setPlans([
        ...(Array.isArray(normal) ? normal as PlanRow[] : []),
        ...(Array.isArray(digital) ? digital as PlanRow[] : []),
      ])
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }, [])

  useEffect(() => {
    const next = initialFilters(digitalRoute)
    setFilters(next)
    void Promise.all([load(true, 1, next), loadPlans()])
  }, [digitalRoute, load, loadPlans])

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((order) => Number(order.status) === 0).length,
    completed: orders.filter((order) => Number(order.status) === 3).length,
    amount: orders
      .filter((order) => Number(order.status) === 3)
      .reduce((sum, order) => sum + centsInteger(order.total_amount), 0),
  }), [orders])

  const currentPlan = useMemo(
    () => plans.find((plan) => Number(plan.id) === Number(assign.planId)),
    [assign.planId, plans],
  )
  const assignPeriods = useMemo(() => availablePeriods(currentPlan), [currentPlan])

  const updateFilter = (key: keyof OrderFilters, value: string, reload = true) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    if (reload) void load(true, 1, next)
  }

  const openDetail = async (order: OrderRow) => {
    setBusy(order.trade_no)
    try {
      setDetail(await post<OrderRow>("/order/detail", { id: order.id }))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy("")
    }
  }

  const runAction = async () => {
    if (!pendingAction) return
    const { order, kind } = pendingAction
    setBusy(order.trade_no)
    try {
      await post(`/order/${kind}`, { trade_no: order.trade_no })
      toast.success(`订单已${kind === "paid" ? "标记支付" : "取消"}`)
      setPendingAction(null)
      await load(false, page.current, filters)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy("")
    }
  }

  const startAssign = () => {
    const plan = plans[0]
    const periods = availablePeriods(plan)
    const period = periods[0]?.[0] || ""
    setAssign({
      email: "",
      planId: plan ? String(plan.id) : "",
      period,
      totalYuan: period ? String(planPriceYuan(plan, period)) : "0.00",
    })
    setAssignConfirm(false)
    setShowAssign(true)
  }

  const closeAssign = () => {
    setShowAssign(false)
    setAssignConfirm(false)
  }

  const changeAssignPlan = (planId: string) => {
    const plan = plans.find((item) => Number(item.id) === Number(planId))
    const periods = availablePeriods(plan)
    const period = periods[0]?.[0] || ""
    setAssign((current) => ({
      ...current,
      planId,
      period,
      totalYuan: period ? String(planPriceYuan(plan, period)) : "0.00",
    }))
  }

  const changeAssignPeriod = (periodValue: string) => {
    const period = periodValue as LegacyPeriod
    setAssign((current) => ({
      ...current,
      period,
      totalYuan: String(planPriceYuan(currentPlan, period)),
    }))
  }

  const validateAssign = () => {
    if (!assign.email.trim() || !assign.planId || !assign.period) {
      toast.error("请完整填写用户、套餐和周期")
      return null
    }
    if (Number(assign.totalYuan) < 0) {
      toast.error("支付金额不能小于 0")
      return null
    }
    const totalAmount = yuanToCents(assign.totalYuan)
    if (totalAmount == null) {
      toast.error("请输入有效金额，金额最多保留两位小数")
      return null
    }
    return totalAmount
  }

  const requestAssign = () => {
    if (validateAssign() == null) return
    setAssignConfirm(true)
  }

  const saveAssign = async () => {
    const totalAmount = validateAssign()
    if (totalAmount == null) return
    setAssigning(true)
    try {
      const trade = await post<string>("/order/assign", {
        email: assign.email.trim(),
        plan_id: Number(assign.planId),
        period: assign.period,
        total_amount: totalAmount,
      })
      toast.success(`订单已创建：${String(trade)}`)
      closeAssign()
      await load(true, 1, filters)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setAssigning(false)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const exported: OrderRow[] = []
      let current = 1
      let last = 1
      do {
        const result = await fetchPage(current, EXPORT_PAGE_SIZE, filters)
        exported.push(...result.items)
        last = result.last
        current += 1
      } while (current <= last)

      const rows: unknown[][] = [
        ["订单ID", "订单号", "用户ID", "商品", "商品类型", "订单类型", "周期", "订单金额(元)", "优惠金额(元)", "拼团优惠(元)", "支付方式ID", "状态", "支付时间", "创建时间"],
        ...exported.map((order) => [
          order.id,
          order.trade_no,
          order.user_id,
          order.plan?.name || `套餐 #${order.plan_id || ""}`,
          productTypeLabel(order.plan?.product_type),
          typeLabel(order.type),
          periodLabel(order.period),
          moneyPlain(order.total_amount),
          moneyPlain(order.discount_amount),
          moneyPlain(order.group_buy_discount_amount),
          order.payment_id || "",
          statusMeta(order).label,
          displayTime(order.paid_at),
          displayTime(order.created_at),
        ]),
      ]
      const blob = new Blob([
        `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`,
      ], { type: "text/csv;charset=utf-8" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
      toast.success(`已导出 ${exported.length} 条订单`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const detailDigitalItems = detail?.digitalItems || detail?.digital_items || []
  const pendingAssignAmount = yuanToCents(assign.totalYuan)

  return (
    <PageShell>
      <PageHeader
        title="订单管理"
        description="查询订单、核对支付明细，并处理待支付订单和人工分配。"
        action={
          <>
            <Button variant="outline" disabled={exporting} onClick={() => void exportCsv()}>
              <Download />
              {exporting ? "导出中…" : "导出 CSV"}
            </Button>
            <Button onClick={startAssign}>
              <Plus />
              人工分配
            </Button>
          </>
        }
      />

      <MetricGrid>
        <MetricCard label="当前页订单" value={stats.total} />
        <MetricCard label="当前页待支付" value={stats.pending} />
        <MetricCard label="当前页已完成" value={stats.completed} />
        <MetricCard label="当前页成交额" value={money(stats.amount)} />
      </MetricGrid>

      <Panel>
        <div className="grid gap-3 xl:grid-cols-[minmax(14rem,1fr)_10rem_10rem_12rem_11rem_auto] xl:items-end">
          <FormField label="订单号 / 用户 ID">
            <Input
              value={filters.keyword}
              placeholder="输入订单号或用户 ID"
              onChange={(event) => updateFilter("keyword", event.target.value, false)}
              onKeyDown={(event) => event.key === "Enter" && void load(true, 1, filters)}
            />
          </FormField>
          <SelectField
            label="状态"
            value={filters.status}
            onValueChange={(value) => updateFilter("status", value)}
            options={[
              { value: "all", label: "全部状态" },
              ...Object.entries(STATUS).map(([value, meta]) => ({ value, label: meta[0] })),
            ]}
          />
          <SelectField
            label="类型"
            value={filters.type}
            onValueChange={(value) => updateFilter("type", value)}
            options={[
              { value: "all", label: "全部类型" },
              ...Object.entries(TYPES).map(([value, label]) => ({ value, label })),
            ]}
          />
          <SelectField
            label="套餐"
            value={filters.plan_id}
            onValueChange={(value) => updateFilter("plan_id", value)}
            options={[
              { value: "", label: "全部套餐" },
              ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
            ]}
          />
          <SelectField
            label="商品类型"
            value={filters.product_type}
            onValueChange={(value) => updateFilter("product_type", value)}
            options={[
              { value: "all", label: "全部商品" },
              { value: "subscription", label: "订阅套餐" },
              { value: "forwarding", label: "转发套餐" },
              { value: "digital", label: "数字商品" },
            ]}
          />
          <div className="flex gap-2">
            <Button onClick={() => void load(true, 1, filters)}><Search />查询</Button>
            <Button variant="outline" disabled={loading} onClick={() => void load(false, page.current, filters)}>
              <RefreshCw className={loading ? "animate-spin" : ""} />
              刷新
            </Button>
          </div>
        </div>
      </Panel>

      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>订单号</TableHead>
              <TableHead>用户 / 商品</TableHead>
              <TableHead>类型周期</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>支付信息</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3].map((row) => (
                <TableRow key={row}><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={8}><EmptyState>暂无符合条件的订单</EmptyState></TableCell></TableRow>
            ) : orders.map((order) => {
              const meta = statusMeta(order)
              const pending = Number(order.status) === 0
              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <Button variant="link" className="h-auto max-w-44 justify-start truncate p-0" onClick={() => void openDetail(order)}>
                      {order.trade_no}
                    </Button>
                    <span className="mt-1 block text-xs text-muted-foreground">#{order.id}</span>
                  </TableCell>
                  <TableCell className="max-w-60 whitespace-normal">
                    <strong className="block">用户 #{order.user_id}</strong>
                    <span className="mt-1 block text-xs text-muted-foreground">{order.plan?.name || `套餐 #${order.plan_id}`}</span>
                    {order.plan?.product_type === "digital" ? <Badge variant="secondary" className="mt-1">数字商品</Badge> : null}
                  </TableCell>
                  <TableCell>
                    {typeLabel(order.type)}
                    <span className="mt-1 block text-xs text-muted-foreground">{periodLabel(order.period)}</span>
                  </TableCell>
                  <TableCell>
                    <strong>{money(order.total_amount)}</strong>
                    {centsInteger(order.discount_amount) ? <span className="mt-1 block text-xs text-muted-foreground">优惠 {money(order.discount_amount)}</span> : null}
                    {centsInteger(order.group_buy_discount_amount) ? <span className="block text-xs text-muted-foreground">拼团优惠 {money(order.group_buy_discount_amount)}</span> : null}
                  </TableCell>
                  <TableCell>
                    <span>{order.payment_id ? `支付方式 #${order.payment_id}` : "未选择支付"}</span>
                    {order.paid_at ? <span className="mt-1 block text-xs text-muted-foreground">支付于 {displayTime(order.paid_at)}</span> : null}
                  </TableCell>
                  <TableCell><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></TableCell>
                  <TableCell>{displayTime(order.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={busy === order.trade_no} onClick={() => void openDetail(order)}>详情</Button>
                      {pending ? (
                        <Button size="sm" disabled={busy === order.trade_no} onClick={() => setPendingAction({ order, kind: "paid" })}>
                          <CreditCard />标记支付
                        </Button>
                      ) : null}
                      {pending ? (
                        <Button variant="destructive" size="sm" disabled={busy === order.trade_no} onClick={() => setPendingAction({ order, kind: "cancel" })}>
                          <XCircle />取消订单
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Panel>

      <Pagination
        current={page.current}
        last={page.last}
        total={page.total}
        loading={loading}
        onChange={(current) => void load(false, current, filters)}
      />

      <PageDialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        title="订单详情"
        description={detail?.trade_no || ""}
        className="sm:max-w-4xl"
      >
        {detail ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><span className="text-xs text-muted-foreground">状态</span><strong className="mt-1 block">{statusMeta(detail).label}</strong></div>
              <div><span className="text-xs text-muted-foreground">订单类型</span><strong className="mt-1 block">{typeLabel(detail.type)}</strong></div>
              <div><span className="text-xs text-muted-foreground">订单金额</span><strong className="mt-1 block text-primary">{money(detail.total_amount)}</strong></div>
              <div><span className="text-xs text-muted-foreground">支付时间</span><strong className="mt-1 block">{displayTime(detail.paid_at)}</strong></div>
            </div>

            {detail.plan?.product_type === "digital" ? (
              <section className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <h3 className="font-medium">数字商品交付记录</h3>
                {detailDigitalItems.length ? (
                  <div className="space-y-2">
                    {detailDigitalItems.map((item) => (
                      <pre key={item.id} className="overflow-x-auto rounded-lg bg-background p-3 text-xs ring-1 ring-foreground/10">{item.content}</pre>
                    ))}
                  </div>
                ) : <EmptyState>尚未交付</EmptyState>}
              </section>
            ) : null}

            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                ["用户", detail.user?.email || `#${detail.user_id}`],
                ["套餐", detail.plan?.name || `#${detail.plan_id}`],
                ["订阅周期", periodLabel(detail.period)],
                ["支付方式", detail.payment_id ? `#${detail.payment_id}` : "未选择"],
                ["余额支付", money(detail.balance_amount)],
                ["手续费", money(detail.handling_amount)],
                ["优惠金额", money(detail.discount_amount)],
                ["拼团优惠", money(detail.group_buy_discount_amount)],
                ["回调编号", detail.callback_no || "—"],
                ["创建时间", displayTime(detail.created_at)],
              ].map(([label, value]) => (
                <div key={String(label)} className="border-b pb-3">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <strong className="mt-1 block break-all">{value}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : <div />}
      </PageDialog>

      <PageDialog
        open={showAssign}
        onOpenChange={(open) => open ? setShowAssign(true) : closeAssign()}
        title="人工分配订单"
        description="创建待支付订单；如需立即开通，请创建后再执行“标记支付”。"
        className="sm:max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={closeAssign}>取消</Button>
            <Button disabled={assigning} onClick={requestAssign}>{assigning ? "创建中…" : "创建订单"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="用户邮箱 *" className="sm:col-span-2">
            <Input
              type="email"
              value={assign.email}
              placeholder="user@example.com"
              onChange={(event) => setAssign({ ...assign, email: event.target.value })}
            />
          </FormField>
          <SelectField
            label="套餐 *"
            value={assign.planId}
            onValueChange={changeAssignPlan}
            options={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
          />
          <SelectField
            label="订阅周期 *"
            value={assign.period}
            disabled={!assignPeriods.length}
            onValueChange={changeAssignPeriod}
            options={assignPeriods.map(([value, label]) => ({ value, label }))}
          />
          <FormField label="订单金额（元） *" hint="提交时将精确换算为整数分">
            <Input
              type="number"
              min={0}
              step={0.01}
              inputMode="decimal"
              value={assign.totalYuan}
              onChange={(event) => setAssign({ ...assign, totalYuan: event.target.value })}
            />
          </FormField>
        </div>
      </PageDialog>

      <PageDialog
        open={assignConfirm}
        onOpenChange={(open) => !open && setAssignConfirm(false)}
        title="确认人工分配"
        description={`确定为 ${assign.email || "该用户"} 分配套餐？订单金额为 ${money(pendingAssignAmount || 0)}。`}
        className="sm:max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignConfirm(false)}>返回修改</Button>
            <Button disabled={assigning} onClick={() => void saveAssign()}>{assigning ? "创建中…" : "确认创建"}</Button>
          </>
        }
      >
        <div />
      </PageDialog>

      <PageDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction?.kind === "paid" ? "手动标记已支付" : "取消订单"}
        description={pendingAction
          ? `确定${pendingAction.kind === "paid" ? "手动标记已支付" : "取消"}订单 ${pendingAction.order.trade_no}？${pendingAction.kind === "paid" ? "此操作会立即执行开通流程，无法直接撤销。" : ""}`
          : ""}
        className="sm:max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingAction(null)}>返回</Button>
            <Button
              variant={pendingAction?.kind === "cancel" ? "destructive" : "default"}
              disabled={Boolean(pendingAction && busy === pendingAction.order.trade_no)}
              onClick={() => void runAction()}
            >
              {pendingAction?.kind === "paid" ? "确认标记支付" : "确认取消"}
            </Button>
          </>
        }
      >
        <div />
      </PageDialog>
    </PageShell>
  )
}
