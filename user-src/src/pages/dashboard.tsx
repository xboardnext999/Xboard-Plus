import { useQuery } from "@tanstack/react-query"
import { ArrowRight, CircleDollarSign, CreditCard, Gauge, Globe2, Headphones, Network, Server, ShoppingBag, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"
import { useSession } from "@/app/providers"
import { DataTable, ErrorAlert, PageLoading, RichContent, StatCards, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { api } from "@/lib/api"
import { bytes, money, percent } from "@/lib/format"
import { normalizeCollection } from "@/lib/utils"

function online(node: Record<string, any>) { return node.is_online === true || node.is_online === 1 || node.is_online === "1" }

function TrafficOverview({ used, total }: { used: number; total: number }) {
  const ratio = percent(used, total)
  return <div className="grid items-center gap-6 sm:grid-cols-[150px_1fr]">
    <div className="mx-auto grid aspect-square w-36 place-content-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${ratio * 3.6}deg, var(--muted) 0)` }}><div className="grid size-27 place-content-center rounded-full bg-card text-center"><strong className="text-2xl">{ratio}%</strong><span className="text-xs text-muted-foreground">已使用</span></div></div>
    <div><p className="text-sm text-muted-foreground">本周期流量</p><p className="mt-2 text-2xl font-bold">{bytes(used)} <span className="text-sm font-normal text-muted-foreground">/ {total ? bytes(total) : "不限量"}</span></p><Progress className="mt-5" value={ratio} /><div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>已用 {bytes(used)}</span><span>剩余 {total ? bytes(Math.max(total - used, 0)) : "不限量"}</span></div></div>
  </div>
}

function NodePool({ nodes }: { nodes: Record<string, any>[] }) {
  const available = nodes.filter(online).length
  return <div className="relative min-h-65 overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_30%_30%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_35%),linear-gradient(135deg,var(--muted),var(--card))] p-5">
    <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]" />
    <div className="relative flex items-start justify-between"><div><p className="text-sm text-muted-foreground">全球节点池</p><h3 className="mt-1 text-2xl font-bold">{available} 个在线节点</h3></div><Globe2 className="size-8 text-primary" /></div>
    <div className="relative mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">{nodes.slice(0, 9).map((node, index) => <div key={node.id || index} className="flex items-center gap-2 rounded-lg border bg-card/80 p-2 text-xs backdrop-blur"><span className={`size-2 rounded-full ${online(node) ? "bg-emerald-500" : "bg-muted-foreground"}`} /><span className="truncate">{node.name || `节点 ${index + 1}`}</span></div>)}</div>
    {!nodes.length ? <p className="relative mt-10 text-center text-sm text-muted-foreground">暂无节点数据</p> : null}
  </div>
}

export function DashboardPage() {
  const { user, subscribe, comm } = useSession()
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: async ({ signal }) => {
      const [notices, servers] = await Promise.all([
        api.get<any>("/user/notice/fetch", { current: 1 }, { signal }).catch(() => ({ data: [] })),
        api.get<any>("/user/server/fetch", {}, { signal }).catch(() => ({ data: [] })),
      ])
      return { notices: normalizeCollection<any>(notices?.data || notices).slice(0, 2), servers: normalizeCollection<any>(servers?.data || servers) }
    },
  })
  if (query.isLoading) return <PageLoading cards={5} />
  const nodes = query.data?.servers || []
  const notices = query.data?.notices || []
  const used = Number(subscribe?.u || 0) + Number(subscribe?.d || 0)
  const total = Number(subscribe?.transfer_enable || 0)
  const currency = comm?.currency_symbol || "¥"
  const available = nodes.filter(online).length
  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 6 ? "夜深了" : greetingHour < 12 ? "早上好" : greetingHour < 18 ? "下午好" : "晚上好"
  const name = user?.name || user?.email?.split("@")[0] || "欢迎回来"
  const rows = nodes.slice(0, 5).map((node, index) => [
    `#${index + 1}`,
    <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary/70" />{node.name || "-"}</span>,
    node.type || "-", node.rate ?? "-", <StatusBadge ok={online(node)}>{online(node) ? "在线" : "离线"}</StatusBadge>,
  ])
  return <div className="grid gap-5">
    <ErrorAlert error={query.error} />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">{greeting}，{name} 👋</h1><p className="mt-1 text-sm text-muted-foreground">欢迎回来，这里是你的服务概览。</p></div><StatusBadge ok>服务运行正常</StatusBadge></div>
    <StatCards items={[
      { label: "账户余额", value: money(user?.balance, currency), hint: "可用余额", icon: <CircleDollarSign /> },
      { label: "当前套餐", value: subscribe?.plan?.name || "未订阅", hint: subscribe?.plan?.name ? "套餐状态正常" : "购买后即可使用", icon: <CreditCard /> },
      { label: "可用节点", value: `${available} 在线`, hint: `共 ${nodes.length} 个节点`, icon: <Network /> },
      { label: "本月用量", value: `${percent(used, total)}%`, hint: `${bytes(used)} / ${total ? bytes(total) : "不限量"}`, icon: <Gauge /> },
    ]} />
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card><CardHeader className="flex flex-row items-start justify-between"><div><CardDescription>订阅概览</CardDescription><CardTitle className="mt-1 text-xl">{subscribe?.plan?.name || "未订阅套餐"}</CardTitle></div><Button variant="outline" size="sm" asChild><Link to="/subscribe">查看订阅<ArrowRight /></Link></Button></CardHeader><CardContent><TrafficOverview used={used} total={total} /></CardContent></Card>
      <Card><CardHeader><CardDescription>节点分布</CardDescription><CardTitle>全球加速网络</CardTitle></CardHeader><CardContent><NodePool nodes={nodes} /></CardContent></Card>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ["/subscribe", CreditCard, "我的订阅", "复制订阅、冻结与套餐转让"],
      ["/recharge", WalletCards, "充值余额", "快速充值并跟踪订单"],
      ["/tickets", Headphones, "工单中心", "提交问题并查看回复"],
      ["/plans", ShoppingBag, "购买套餐", "选择适合你的订阅方案"],
    ].map(([to, Icon, title, description]) => { const IconComp = Icon as typeof Server; return <Link to={String(to)} key={String(to)}><Card className="h-full transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><CardContent className="flex items-center gap-4"><span className="grid size-11 shrink-0 place-content-center rounded-xl bg-primary/10 text-primary"><IconComp /></span><span><strong className="block">{String(title)}</strong><small className="mt-1 block text-muted-foreground">{String(description)}</small></span></CardContent></Card></Link> })}</div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardDescription>实时更新</CardDescription><CardTitle>节点概览</CardTitle></div><Button asChild variant="ghost" size="sm"><Link to="/nodes">全部<ArrowRight /></Link></Button></CardHeader><CardContent><DataTable headers={["序号","节点名称","协议","倍率","状态"]} rows={rows} empty="暂无可用节点" /></CardContent></Card>
      <Card><CardHeader><CardDescription>站点通知</CardDescription><CardTitle>公告</CardTitle></CardHeader><CardContent className="grid gap-3">{notices.length ? notices.map((notice, index) => <article key={notice.id || index} className="rounded-lg border bg-muted/30 p-4"><h3 className="font-medium">{notice.title || "公告"}</h3><RichContent className="mt-2 line-clamp-3 text-sm text-muted-foreground" html={notice.content || notice.body || ""} /></article>) : <p className="py-8 text-center text-sm text-muted-foreground">暂无公告</p>}</CardContent></Card>
    </div>
  </div>
}
