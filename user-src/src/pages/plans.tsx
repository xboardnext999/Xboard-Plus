import * as React from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { BadgePercent, Check, LoaderCircle, ShoppingBag, Sparkles, Users, WalletCards } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useSession } from "@/app/providers"
import { ErrorAlert, PageHeader, PageLoading, PaymentMethodPicker, RichContent } from "@/components/common"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { bytes, money } from "@/lib/format"
import { cn, normalizeCollection } from "@/lib/utils"

const NO_SELECTION = "__none__"

const periods = [
  ["month_price", "月付"], ["quarter_price", "季付"], ["half_year_price", "半年付"], ["year_price", "年付"],
  ["two_year_price", "两年付"], ["three_year_price", "三年付"], ["onetime_price", "一次性"], ["reset_price", "流量重置"],
] as const

function periodOptions(plan: Record<string, any>, currency: string) {
  return periods.filter(([key]) => plan[key] !== null && plan[key] !== undefined).map(([key, label]) => ({ key, label: `${label} ${money(plan[key], currency)}` }))
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delay); return () => window.clearTimeout(timer) }, [value, delay])
  return debounced
}

function PriceLine({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><strong className={tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : ""}>{value}</strong></div>
}

function PurchasePanel({ plan, index, methods, methodsError, groupBuy, currency }: { plan: Record<string, any>; index: number; methods: any[]; methodsError: string; groupBuy: any; currency: string }) {
  const navigate = useNavigate()
  const options = periodOptions(plan, currency)
  const [period, setPeriod] = React.useState<string>(options[0]?.key || "")
  const [coupon, setCoupon] = React.useState("")
  const [method, setMethod] = React.useState(methods[0]?.id ? String(methods[0].id) : "")
  const [activity, setActivity] = React.useState("")
  const [group, setGroup] = React.useState("")
  const [createdGroups, setCreatedGroups] = React.useState<any[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [groupCreating, setGroupCreating] = React.useState(false)
  React.useEffect(() => { setPeriod(options[0]?.key || ""); setCoupon(""); setActivity(""); setGroup("") }, [plan.id])
  React.useEffect(() => { if (!method && methods[0]?.id) setMethod(String(methods[0].id)) }, [method, methods])
  const quoteInput = useDebounced({ period, coupon: coupon.trim(), method, activity }, 260)
  const quote = useQuery({
    queryKey: ["plan-quote", plan.id, quoteInput],
    enabled: Boolean(quoteInput.period),
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: ({ signal }) => api.post<any>("/user/order/quote", {
      plan_id: plan.id, period: quoteInput.period, coupon_code: quoteInput.coupon, method: quoteInput.method,
      subscription_mode: "append", group_buy_activity_id: quoteInput.activity || null,
    }, { signal }),
  })
  const activities = normalizeCollection<any>(groupBuy?.activities).filter((item) => Number(item.plan_id) === Number(plan.id) && (!period || item.period === period))
  const groups = [...createdGroups, ...normalizeCollection<any>(groupBuy?.groups)].filter((item, idx, all) => all.findIndex((candidate) => String(candidate.id) === String(item.id)) === idx).filter((item) => Number(item.plan_id) === Number(plan.id) && (!activity || Number(item.activity_id) === Number(activity)))
  const price = quote.data || {}
  const original = price.original_amount ?? Number(plan[period] || 0)
  const couponDiscount = Number(price.coupon_discount_amount || 0)
  const vipDiscount = Number(price.vip_discount_amount || 0)
  const groupDiscount = Number(price.group_buy_discount_amount || 0)
  const surplus = Number(price.surplus_amount || 0)
  const balance = Number(price.balance_amount || 0)
  const handling = Number(price.handling_amount || 0)
  const pay = price.pay_amount ?? price.total_amount ?? original
  const requiresMethod = Number(pay || 0) > 0

  async function createGroup(silent = false) {
    if (!activity) return null
    setGroupCreating(true)
    try {
      const created = await api.post<any>("/user/group-buy/create", { activity_id: activity })
      setCreatedGroups((items) => [created, ...items])
      setGroup(String(created.id))
      if (!silent) toast.success("拼团已创建")
      return created
    } catch (error) { if (!silent) toast.error(error instanceof Error ? error.message : "开团失败"); throw error }
    finally { setGroupCreating(false) }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!period || quote.isFetching || quote.error) return
    setSubmitting(true)
    try {
      let groupId = group
      if (activity && !groupId) groupId = String((await createGroup(true))?.id || "")
      const tradeNo = await api.post<string>("/user/order/save", {
        plan_id: plan.id, period, coupon_code: coupon.trim(), subscription_mode: "append",
        group_buy_activity_id: activity || null, group_buy_group_id: groupId || null,
      })
      toast.success("订单已创建")
      navigate(`/orders?trade_no=${encodeURIComponent(tradeNo)}${requiresMethod && method ? `&method=${encodeURIComponent(method)}` : ""}`)
    } catch (error) { toast.error(error instanceof Error ? error.message : "创建订单失败") }
    finally { setSubmitting(false) }
  }
  const traffic = plan.transfer_enable ? bytes(Number(plan.transfer_enable) * 1024 ** 3) : "不限流量"
  return <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
    <Card className={index === 1 ? "border-primary/40" : ""}><CardHeader><div className="mb-2 flex items-center justify-between"><Badge variant={index === 1 ? "default" : "secondary"}>{index === 1 ? "推荐套餐" : `套餐 ${index + 1}`}</Badge>{index === 1 ? <Sparkles className="text-primary" /> : null}</div><CardTitle className="text-3xl">{plan.name}</CardTitle><CardDescription>稳定、安全的网络订阅服务</CardDescription></CardHeader><CardContent className="grid gap-5">
      <RichContent html={plan.content || "稳定、安全的网络订阅服务。"} />
      <div className="grid grid-cols-3 gap-3">{[["套餐流量",traffic],["速率限制",plan.speed_limit ? `${plan.speed_limit} Mbps` : "不限速"],["在线设备",plan.device_limit ? `${plan.device_limit} 台` : "不限设备"]].map(([label,value]) => <div key={label} className="rounded-lg bg-muted p-3"><small className="text-muted-foreground">{label}</small><strong className="mt-1 block text-sm">{value}</strong></div>)}</div>
      <div className="rounded-lg border bg-primary/5 p-4"><div className="flex items-center gap-2 text-primary"><Check className="size-4" /><strong className="text-sm">购买后自动开通</strong></div><p className="mt-2 text-xs leading-5 text-muted-foreground">套餐流量、设备数量与价格以当前结算结果为准。</p></div>
    </CardContent></Card>
    <Card><CardHeader><CardDescription>Order configuration</CardDescription><CardTitle>购买配置</CardTitle></CardHeader><CardContent className="grid gap-5">
      <Field label="购买周期"><Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-full"><SelectValue placeholder="选择购买周期" /></SelectTrigger><SelectContent>{options.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="优惠码" description="输入后会自动重新计算价格"><Input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="选填" /></Field>
      {requiresMethod ? <Field label="支付方式" error={methodsError || undefined}><PaymentMethodPicker name={`method-${plan.id}`} methods={methods} value={method} onValueChange={setMethod} /></Field> : <Alert><WalletCards /><AlertTitle>余额已全额抵扣</AlertTitle><AlertDescription>本单无需选择其他支付渠道，创建订单后确认余额支付即可。</AlertDescription></Alert>}
      {activities.length ? <Field label="拼团优惠"><Select value={activity || NO_SELECTION} onValueChange={(value) => { setActivity(value === NO_SELECTION ? "" : value); setGroup("") }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_SELECTION}>不参与拼团</SelectItem>{activities.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.title} · {item.group_size} 人成团</SelectItem>)}</SelectContent></Select>{activity ? <div className="mt-2 flex gap-2"><Select value={group || NO_SELECTION} onValueChange={(value) => setGroup(value === NO_SELECTION ? "" : value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_SELECTION}>自己开团</SelectItem>{groups.map((item) => <SelectItem key={item.id} value={String(item.id)}>加入团 #{item.id} · {item.current_count}/{item.required_count}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" disabled={groupCreating} onClick={() => createGroup(false)}>{groupCreating ? <LoaderCircle className="animate-spin" /> : <Users />}开团</Button></div> : null}</Field> : null}
      <div className="grid gap-2 rounded-xl border bg-muted/25 p-4"><div className="flex items-end justify-between"><span className="text-sm text-muted-foreground">预计实付</span><strong className="text-3xl text-primary">{quote.isFetching ? "计算中…" : money(pay, currency)}</strong></div><div className="my-2 h-px bg-border" /><PriceLine label="套餐原价" value={money(original, currency)} />{couponDiscount > 0 ? <PriceLine label="优惠券" value={`-${money(couponDiscount, currency)}`} tone="ok" /> : null}{vipDiscount > 0 ? <PriceLine label="会员优惠" value={`-${money(vipDiscount, currency)}`} tone="ok" /> : null}{groupDiscount > 0 ? <PriceLine label="拼团优惠" value={`-${money(groupDiscount, currency)}`} tone="ok" /> : null}{surplus > 0 ? <PriceLine label="套餐折抵" value={`-${money(surplus, currency)}`} tone="ok" /> : null}{balance > 0 ? <PriceLine label="余额抵扣" value={`-${money(balance, currency)}`} tone="ok" /> : null}{handling > 0 ? <PriceLine label="支付手续费" value={money(handling, currency)} tone="warn" /> : null}{quote.error ? <p className="mt-2 text-xs text-destructive">{quote.error.message}</p> : null}</div>
      <Button size="lg" disabled={submitting || quote.isFetching || Boolean(quote.error) || !period || (requiresMethod && !method)}>{submitting ? <LoaderCircle className="animate-spin" /> : <ShoppingBag />}{submitting ? "正在创建订单…" : "确认购买"}</Button>
    </CardContent></Card>
  </form>
}

export function PlansPage() {
  const { comm } = useSession()
  const [selectedId, setSelectedId] = React.useState("")
  const query = useQuery({
    queryKey: ["plans-page"],
    queryFn: async ({ signal }) => {
      let methodsError = ""
      const [plans, methods, groupBuy] = await Promise.all([
        api.get<any>("/user/plan/fetch", {}, { signal }),
        api.get<any[]>("/user/order/getPaymentMethod", {}, { signal }).catch((error) => { methodsError = error.message || "支付渠道加载失败"; return [] }),
        api.get<any>("/user/group-buy/fetch", {}, { signal }).catch(() => ({ activities: [], groups: [] })),
      ])
      return { plans: normalizeCollection<any>(plans), methods: methods || [], groupBuy, methodsError }
    },
  })
  React.useEffect(() => { if (query.data?.plans.length && !query.data.plans.some((item) => String(item.id) === selectedId)) setSelectedId(String(query.data.plans[0].id)) }, [query.data, selectedId])
  if (query.isLoading) return <PageLoading cards={3} />
  const plans = query.data?.plans || []
  const selectedIndex = Math.max(0, plans.findIndex((item) => String(item.id) === selectedId))
  const selected = plans[selectedIndex]
  const currency = comm?.currency_symbol || "¥"
  return <div className="grid gap-5"><PageHeader title="购买套餐" description="选择套餐并实时查看优惠、余额抵扣与最终支付金额。" /><ErrorAlert error={query.error} />
    {plans.length > 1 ? <div className="flex gap-3 overflow-x-auto pb-2">{plans.map((plan, index) => <Button type="button" variant="outline" key={plan.id} onClick={() => setSelectedId(String(plan.id))} aria-pressed={String(plan.id) === selectedId} className={cn("h-auto min-w-52 flex-col items-start p-4 text-left whitespace-normal", String(plan.id) === selectedId ? "border-primary bg-primary/10 text-foreground shadow-sm hover:bg-primary/15" : "bg-card hover:border-primary/30")}><Badge variant={index === 1 ? "default" : "secondary"}>{index === 1 ? "推荐" : `套餐 ${index + 1}`}</Badge><strong className="mt-2 block text-lg">{plan.name}</strong><small className="block text-muted-foreground">{periodOptions(plan, currency)[0]?.label || "查看套餐价格"}</small></Button>)}</div> : null}
    {selected ? <PurchasePanel key={selected.id} plan={selected} index={selectedIndex} methods={query.data?.methods || []} methodsError={query.data?.methodsError || ""} groupBuy={query.data?.groupBuy || {}} currency={currency} /> : <Card><CardContent className="py-12 text-center text-muted-foreground"><BadgePercent className="mx-auto mb-3" />暂无可购买套餐</CardContent></Card>}
  </div>
}
