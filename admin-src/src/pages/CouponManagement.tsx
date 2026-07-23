import { useEffect, useMemo, useState } from "react"
import { Copy, Download, Plus, RefreshCw, Search, TicketPercent } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { adminApi, authToken, get, post, request } from "@/services/http"
import { ConfirmAction } from "./react-page-helpers"

type Coupon = {
  id: number
  name: string
  code: string
  type: number
  value: number
  started_at: number
  ended_at: number
  limit_use?: number | null
  limit_use_with_user?: number | null
  limit_plan_ids?: number[]
  limit_period?: string[]
  show: boolean
}

type Plan = { id: number; name: string }
type PageData = { items?: Coupon[]; data?: Coupon[]; total?: number; current_page?: number; last_page?: number }

type CouponForm = {
  id: number | null
  name: string
  code: string
  type: number
  value: number
  started_at: string
  ended_at: string
  limit_use: string
  limit_use_with_user: string
  limit_plan_ids: number[]
  limit_period: string[]
  show: boolean
  batch: boolean
  generate_count: number
}

const periods = [
  ["monthly", "月付"], ["quarterly", "季付"], ["half_yearly", "半年付"], ["yearly", "年付"],
  ["two_yearly", "两年付"], ["three_yearly", "三年付"], ["onetime", "一次性"], ["reset_traffic", "重置流量"],
] as const

const localDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const localInput = (timestamp?: number) => timestamp ? localDate(new Date(timestamp * 1000)) : ""
const initialForm = (): CouponForm => ({
  id: null,
  name: "",
  code: "",
  type: 1,
  value: 10,
  started_at: localDate(new Date()),
  ended_at: localDate(new Date(Date.now() + 30 * 86_400_000)),
  limit_use: "",
  limit_use_with_user: "1",
  limit_plan_ids: [],
  limit_period: [],
  show: true,
  batch: false,
  generate_count: 10,
})

function phase(coupon: Coupon): { label: string; variant: "default" | "secondary" | "destructive" } {
  const now = Date.now() / 1000
  if (!coupon.show) return { label: "已隐藏", variant: "secondary" }
  if (coupon.started_at > now) return { label: "未开始", variant: "secondary" }
  if (coupon.ended_at < now) return { label: "已过期", variant: "destructive" }
  return { label: "生效中", variant: "default" }
}

const formatDate = (timestamp?: number) => timestamp ? new Date(timestamp * 1000).toLocaleString("zh-CN", { hour12: false }) : "—"
const couponValue = (coupon: Coupon) => coupon.type === 1 ? `减 ¥${(coupon.value / 100).toFixed(2)}` : `${coupon.value}% 折扣`

export default function CouponManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CouponForm>(initialForm)
  const [keyword, setKeyword] = useState("")
  const [type, setType] = useState("all")
  const [visibility, setVisibility] = useState("all")
  const [page, setPage] = useState({ current: 1, size: 20, total: 0, last: 1 })

  const load = async (current = page.current) => {
    setLoading(true)
    try {
      const query = new URLSearchParams({ current: String(current), pageSize: String(page.size) })
      if (keyword) {
        query.set("filter[0][id]", /^[A-Za-z0-9]{6,}$/.test(keyword) ? "code" : "name")
        query.set("filter[0][value]", keyword)
      }
      const result = await request<PageData | Coupon[]>(`/coupon/fetch?${query}`)
      const payload = Array.isArray(result) ? result : result?.items || result?.data || []
      const total = Array.isArray(result) ? result.length : Number(result?.total || payload.length)
      setCoupons(payload)
      setPage((value) => ({ ...value, current: Array.isArray(result) ? current : Number(result?.current_page || current), total, last: Array.isArray(result) ? Math.max(1, Math.ceil(total / value.size)) : Number(result?.last_page || 1) }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "优惠券加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.all([
      load(1),
      get<Plan[]>("/plan/fetch").then(setPlans).catch(() => setPlans([])),
    ])
    // initial request deliberately only runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayed = useMemo(() => coupons.filter((coupon) => (type === "all" || coupon.type === Number(type)) && (visibility === "all" || Boolean(coupon.show) === (visibility === "1"))), [coupons, type, visibility])
  const stats = useMemo(() => ({
    total: coupons.length,
    visible: coupons.filter((coupon) => coupon.show).length,
    active: coupons.filter((coupon) => phase(coupon).label === "生效中").length,
    expired: coupons.filter((coupon) => coupon.ended_at < Date.now() / 1000).length,
  }), [coupons])

  const createCoupon = () => { setForm(initialForm()); setOpen(true) }
  const editCoupon = (coupon: Coupon) => {
    setForm({
      ...initialForm(),
      id: coupon.id,
      name: coupon.name,
      code: coupon.code,
      type: Number(coupon.type),
      value: coupon.type === 1 ? Number(coupon.value) / 100 : Number(coupon.value),
      started_at: localInput(coupon.started_at),
      ended_at: localInput(coupon.ended_at),
      limit_use: coupon.limit_use == null ? "" : String(coupon.limit_use),
      limit_use_with_user: coupon.limit_use_with_user == null ? "" : String(coupon.limit_use_with_user),
      limit_plan_ids: [...(coupon.limit_plan_ids || [])],
      limit_period: [...(coupon.limit_period || [])],
      show: Boolean(coupon.show),
    })
    setOpen(true)
  }

  const payload = () => ({
    name: form.name.trim(),
    code: form.code.trim() || undefined,
    type: Number(form.type),
    value: form.type === 1 ? Math.round(Number(form.value) * 100) : Math.round(Number(form.value)),
    started_at: Math.floor(new Date(form.started_at).getTime() / 1000),
    ended_at: Math.floor(new Date(form.ended_at).getTime() / 1000),
    limit_use: form.limit_use === "" ? null : Number(form.limit_use),
    limit_use_with_user: form.limit_use_with_user === "" ? null : Number(form.limit_use_with_user),
    limit_plan_ids: form.limit_plan_ids,
    limit_period: form.limit_period,
  })

  const save = async () => {
    if (!form.name.trim()) return toast.error("请输入优惠券名称")
    if (Number(form.value) <= 0) return toast.error("优惠金额或比例必须大于 0")
    if (form.type === 2 && Number(form.value) >= 100) return toast.error("折扣比例必须小于 100%")
    if (!form.started_at || !form.ended_at || new Date(form.ended_at) <= new Date(form.started_at)) return toast.error("结束时间必须晚于开始时间")
    if (form.batch && (form.generate_count < 1 || form.generate_count > 500)) return toast.error("批量数量必须在 1–500 之间")

    setSaving(true)
    try {
      if (form.batch) {
        const response = await fetch(adminApi("/coupon/generate"), {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken().replace(/^Bearer /, "")}`, "Content-Type": "application/json", Accept: "text/csv" },
          body: JSON.stringify({ ...payload(), generate_count: Number(form.generate_count) }),
        })
        if (!response.ok) throw new Error("批量生成失败")
        const url = URL.createObjectURL(await response.blob())
        const link = document.createElement("a")
        link.href = url
        link.download = `coupons-${Date.now()}.csv`
        link.click()
        URL.revokeObjectURL(url)
        toast.success(`已生成 ${form.generate_count} 张优惠券并导出`)
      } else {
        const knownIds = new Set(coupons.map((coupon) => coupon.id))
        await post("/coupon/generate", { ...payload(), id: form.id || undefined })
        await load(form.id ? page.current : 1)
        if (!form.id && !form.show) {
          const refreshed = await request<PageData | Coupon[]>("/coupon/fetch?current=1&pageSize=20")
          const rows = Array.isArray(refreshed) ? refreshed : refreshed?.items || refreshed?.data || []
          const created = rows.find((coupon) => !knownIds.has(coupon.id))
          if (created) await post("/coupon/show", { id: created.id })
        }
        toast.success(form.id ? "优惠券已更新" : "优惠券已创建")
      }
      setOpen(false)
      await load(form.batch || !form.id ? 1 : page.current)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (coupon: Coupon) => {
    setBusy(coupon.id)
    try {
      await post("/coupon/show", { id: coupon.id })
      setCoupons((rows) => rows.map((row) => row.id === coupon.id ? { ...row, show: !row.show } : row))
      toast.success("展示状态已更新")
    } catch (error) { toast.error(error instanceof Error ? error.message : "更新失败") } finally { setBusy(null) }
  }

  const remove = async (coupon: Coupon) => {
    setBusy(coupon.id)
    try {
      await post("/coupon/drop", { id: coupon.id })
      toast.success("优惠券已删除")
      await load(page.current)
    } catch (error) { toast.error(error instanceof Error ? error.message : "删除失败") } finally { setBusy(null) }
  }

  const toggleList = (key: "limit_plan_ids" | "limit_period", value: number | string, checked: boolean) => {
    setForm((current) => ({ ...current, [key]: checked ? [...current[key], value] : current[key].filter((item) => item !== value) } as CouponForm))
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-semibold tracking-tight">优惠券管理</h1><p className="mt-1 text-sm text-muted-foreground">创建金额券与折扣券，并控制适用范围和有效期。</p></div>
        <Button onClick={createCoupon}><Plus />创建优惠券</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["当前页券数", stats.total], ["已展示", stats.visible], ["生效中", stats.active], ["已过期", stats.expired]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></CardContent></Card>)}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <div className="min-w-64 flex-1 space-y-2"><Label htmlFor="coupon-search">搜索</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="coupon-search" className="pl-9" value={keyword} placeholder="优惠券名称或券码" onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load(1)} /></div></div>
          <div className="space-y-2"><Label>类型</Label><Select value={type} onValueChange={(value) => setType(value || "all")}><SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部类型</SelectItem><SelectItem value="1">固定金额</SelectItem><SelectItem value="2">百分比折扣</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>展示状态</Label><Select value={visibility} onValueChange={(value) => setVisibility(value || "all")}><SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="1">已展示</SelectItem><SelectItem value="0">已隐藏</SelectItem></SelectContent></Select></div>
          <Button variant="outline" onClick={() => void load(1)}><Search />查询</Button>
          <Button variant="ghost" disabled={loading} onClick={() => void load(page.current)}><RefreshCw className={loading ? "animate-spin" : ""} />刷新</Button>
        </CardContent>
      </Card>

      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((key) => <Skeleton key={key} className="h-80" />)}</div> : displayed.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayed.map((coupon) => {
            const status = phase(coupon)
            return (
              <Card key={coupon.id} className="overflow-hidden">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="min-w-0"><CardDescription>{coupon.type === 1 ? "金额券" : "折扣券"}</CardDescription><CardTitle className="mt-1 truncate text-lg">{coupon.name}</CardTitle></div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="secondary" className="h-auto w-full justify-between rounded-xl px-3 py-2 text-left font-mono text-sm font-normal" onClick={() => void navigator.clipboard.writeText(coupon.code).then(() => toast.success("券码已复制"))}><span className="truncate">{coupon.code}</span><Copy className="size-4" /></Button>
                  <strong className="block text-3xl tracking-tight text-primary">{couponValue(coupon)}</strong>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-muted-foreground">有效期</dt><dd className="mt-1 leading-5">{formatDate(coupon.started_at)}<br />至 {formatDate(coupon.ended_at)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">使用限制</dt><dd className="mt-1">总计 {coupon.limit_use || "不限"} 次<br />每人 {coupon.limit_use_with_user || "不限"} 次</dd></div>
                    <div><dt className="text-xs text-muted-foreground">适用套餐</dt><dd className="mt-1">{coupon.limit_plan_ids?.length ? `${coupon.limit_plan_ids.length} 个指定套餐` : "全部套餐"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">适用周期</dt><dd className="mt-1">{coupon.limit_period?.length ? coupon.limit_period.map((key) => periods.find((item) => item[0] === key)?.[1] || key).join("、") : "全部周期"}</dd></div>
                  </dl>
                </CardContent>
                <CardFooter className="justify-end gap-2 border-t bg-muted/20 py-3"><Button size="sm" variant="ghost" disabled={busy === coupon.id} onClick={() => void toggle(coupon)}>{coupon.show ? "隐藏" : "展示"}</Button><Button size="sm" variant="outline" onClick={() => editCoupon(coupon)}>编辑</Button><ConfirmAction title="删除优惠券" description={`确定删除优惠券「${coupon.name}」？此操作无法撤销。`} confirmText="删除优惠券" disabled={busy === coupon.id} onConfirm={() => remove(coupon)}>删除</ConfirmAction></CardFooter>
              </Card>
            )
          })}
        </div>
      ) : <Card><CardContent className="grid min-h-52 place-items-center text-center"><div><TicketPercent className="mx-auto size-9 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">暂无符合条件的优惠券</p></div></CardContent></Card>}

      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground"><span>共 {page.total} 条</span><Button size="sm" variant="outline" disabled={page.current <= 1 || loading} onClick={() => void load(page.current - 1)}>上一页</Button><span>{page.current} / {page.last}</span><Button size="sm" variant="outline" disabled={page.current >= page.last || loading} onClick={() => void load(page.current + 1)}>下一页</Button></div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{form.id ? "编辑优惠券" : "创建优惠券"}</DialogTitle><DialogDescription>金额按元填写，系统会在保存时转换为接口使用的分值。</DialogDescription></DialogHeader>
          {!form.id && <div className="flex items-center gap-3 rounded-xl bg-muted p-3"><Switch checked={form.batch} onCheckedChange={(checked) => setForm((current) => ({ ...current, batch: checked }))} /><div><strong className="block text-sm">批量生成随机券码</strong><p className="text-xs text-muted-foreground">一次最多生成 500 张，并自动导出 CSV。</p></div></div>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label htmlFor="coupon-name">优惠券名称</Label><Input id="coupon-name" value={form.name} placeholder="例如：新用户立减券" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
            {!form.batch ? <div className="space-y-2"><Label htmlFor="coupon-code">券码</Label><Input id="coupon-code" value={form.code} placeholder="留空自动生成" onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} /></div> : <div className="space-y-2"><Label htmlFor="coupon-count">生成数量</Label><Input id="coupon-count" type="number" min={1} max={500} value={form.generate_count} onChange={(event) => setForm((current) => ({ ...current, generate_count: Number(event.target.value) }))} /></div>}
            <div className="space-y-2"><Label>优惠类型</Label><Select value={String(form.type)} onValueChange={(value) => setForm((current) => ({ ...current, type: Number(value) }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">固定金额</SelectItem><SelectItem value="2">百分比折扣</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="coupon-value">{form.type === 1 ? "优惠金额（元）" : "优惠比例（%）"}</Label><Input id="coupon-value" type="number" min={0.01} max={form.type === 2 ? 99 : undefined} step={form.type === 1 ? 0.01 : 1} value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: Number(event.target.value) }))} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-start">开始时间</Label><Input id="coupon-start" type="datetime-local" value={form.started_at} onChange={(event) => setForm((current) => ({ ...current, started_at: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-end">结束时间</Label><Input id="coupon-end" type="datetime-local" value={form.ended_at} onChange={(event) => setForm((current) => ({ ...current, ended_at: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-limit">总使用次数</Label><Input id="coupon-limit" type="number" min={1} value={form.limit_use} placeholder="留空不限制" onChange={(event) => setForm((current) => ({ ...current, limit_use: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="coupon-user-limit">每用户使用次数</Label><Input id="coupon-user-limit" type="number" min={1} value={form.limit_use_with_user} placeholder="留空不限制" onChange={(event) => setForm((current) => ({ ...current, limit_use_with_user: event.target.value }))} /></div>
            {!form.batch && <div className="flex items-center gap-3"><Switch checked={form.show} onCheckedChange={(checked) => setForm((current) => ({ ...current, show: checked }))} /><Label>用户端展示</Label></div>}
          </div>
          <div className="space-y-3"><Label>限定套餐</Label><div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">{plans.length ? plans.map((plan) => <label key={plan.id} className="flex items-center gap-2 text-sm"><Checkbox checked={form.limit_plan_ids.includes(plan.id)} onCheckedChange={(checked) => toggleList("limit_plan_ids", plan.id, Boolean(checked))} />{plan.name}</label>) : <span className="text-sm text-muted-foreground">暂无套餐，默认适用于全部套餐</span>}</div></div>
          <div className="space-y-3"><Label>限定周期</Label><div className="grid gap-2 rounded-xl border p-3 sm:grid-cols-4">{periods.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><Checkbox checked={form.limit_period.includes(value)} onCheckedChange={(checked) => toggleList("limit_period", value, Boolean(checked))} />{label}</label>)}</div></div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={saving} onClick={() => void save()}>{form.batch && <Download />}{saving ? "处理中…" : form.batch ? "生成并导出" : "保存优惠券"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
