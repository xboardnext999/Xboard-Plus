import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  Database,
  Info,
  MonitorSmartphone,
  Network,
  Radio,
  RefreshCw,
  Server,
  Ticket,
  Users,
  WalletCards,
} from "lucide-react"
import { toast } from "sonner"

import { get } from "@/services/http"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

type Numeric = number | string | null | undefined

interface Stats {
  todayIncome?: Numeric
  currentMonthIncome?: Numeric
  dayIncomeGrowth?: Numeric
  monthIncomeGrowth?: Numeric
  activeUsers?: Numeric
  totalUsers?: Numeric
  currentMonthNewUsers?: Numeric
  todayTraffic?: { total?: Numeric }
  monthTraffic?: { total?: Numeric; upload?: Numeric; download?: Numeric }
  totalTraffic?: { total?: Numeric }
  ticketPendingTotal?: Numeric
  commissionPendingTotal?: Numeric
  onlineUsers?: Numeric
  onlineDevices?: Numeric
  onlineNodes?: Numeric
}

interface OrderPoint { date: string; paid_total?: Numeric; paid_count?: Numeric }
interface RankItem { id: string | number; name: string; value?: Numeric; change?: Numeric }
interface QueueStats {
  status?: boolean
  mode?: string
  modeLabel?: string
  processes?: Numeric
  readyJobs?: Numeric
  reservedJobs?: Numeric
  delayedJobs?: Numeric
  jobsPerMinute?: Numeric
  recentJobs?: Numeric
  failedJobs?: Numeric
  pausedMasters?: Numeric
  waitUnit?: string
  wait?: Record<string, Numeric>
}
interface WorkloadItem { name: string; length?: Numeric; reserved?: Numeric; delayed?: Numeric }
interface FailedJob {
  id?: string | number
  name?: string
  connection?: string
  queue?: string
  failed_at?: string
  status?: string
  exception?: string
  payload?: Record<string, unknown> & { displayName?: string; job?: string; exception?: string }
}

const queueMeta: Record<string, [string, string]> = {
  default: ["通用任务", "未指定专属队列的后台任务"],
  order_handle: ["订单处理", "开通订单与超时取消"],
  traffic_fetch: ["流量采集", "采集节点上报的用户流量"],
  stat: ["统计入库", "记录用户与节点流量统计"],
  user_alive_sync: ["在线同步", "同步用户在线状态"],
  send_email: ["邮件通知", "验证码、提醒与工单邮件"],
  send_email_mass: ["群发邮件", "批量用户邮件通知"],
  send_telegram: ["Telegram", "机器人消息通知"],
  node_sync: ["节点同步", "同步用户权限与节点配置"],
}

const count = (value: Numeric) => Number(value || 0).toLocaleString("zh-CN")
const money = (value: Numeric) => `¥${(Number(value || 0) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const traffic = (value: Numeric) => {
  let amount = Number(value || 0)
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let index = 0
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1 }
  return `${amount.toFixed(index ? 1 : 0)} ${units[index]}`
}
const growth = (value: Numeric) => `${Number(value || 0) > 0 ? "+" : ""}${Number(value || 0).toFixed(1)}%`
const growthTone = (value: Numeric) => Number(value || 0) > 0 ? "text-emerald-600" : Number(value || 0) < 0 ? "text-red-500" : "text-muted-foreground"
const formatDate = (value?: string) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "—"

function range() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 13)
  const format = (value: Date) => value.toISOString().slice(0, 10)
  return `start_date=${format(start)}&end_date=${format(end)}`
}

function KpiCard({ label, value, note, icon, tone }: { label: string; value: string; note: React.ReactNode; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight">{value}</p>
          <div className="mt-1 text-xs text-muted-foreground">{note}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function RankingCard({ title, description, items, href, linkText }: { title: string; description: string; items: RankItem[]; href: string; linkText: string }) {
  const maximum = Math.max(...items.map((item) => Number(item.value || 0)), 1)
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div><CardTitle>{title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></div>
        <Link to={href} className={buttonVariants({ variant: "ghost", size: "sm" })}>{linkText}<ChevronRight /></Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length ? items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3">
            <span className={`grid size-8 place-items-center rounded-xl text-xs font-semibold ${index < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{index + 1}</span>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3"><strong className="truncate text-sm">{item.name}</strong><span className="text-sm font-medium">{traffic(item.value)}</span></div>
              <Progress className="mt-2 h-1.5" value={Number(item.value || 0) / maximum * 100} />
            </div>
            <span className={`text-xs ${growthTone(item.change)}`}>{growth(item.change)}</span>
          </div>
        )) : <p className="py-10 text-center text-sm text-muted-foreground">近 7 天暂无流量记录</p>}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({})
  const [orders, setOrders] = useState<OrderPoint[]>([])
  const [nodeRank, setNodeRank] = useState<RankItem[]>([])
  const [userRank, setUserRank] = useState<RankItem[]>([])
  const [queue, setQueue] = useState<QueueStats>({})
  const [workload, setWorkload] = useState<WorkloadItem[]>([])
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([])
  const [selectedJob, setSelectedJob] = useState<FailedJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = async () => {
    setRefreshing(true)
    try {
      const [overview, orderData, nodes, users, queueStats, queueWorkload, jobs] = await Promise.all([
        get("/stat/getStats"),
        get(`/stat/getOrder?${range()}`),
        get("/stat/getTrafficRank?type=node"),
        get("/stat/getTrafficRank?type=user"),
        get("/system/getQueueStats"),
        get("/system/getQueueWorkload"),
        get("/system/getHorizonFailedJobs?current=1&page_size=10"),
      ]) as [Stats, { list?: OrderPoint[] }, RankItem[], RankItem[], QueueStats, WorkloadItem[], FailedJob[]]
      setStats(overview || {})
      setOrders(orderData?.list || [])
      setNodeRank(nodes || [])
      setUserRank(users || [])
      setQueue(queueStats || {})
      setWorkload(queueWorkload || [])
      setFailedJobs(jobs || [])
      setUpdatedAt(new Date())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "仪表盘数据加载失败")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [])

  const chart = useMemo(() => {
    const maximum = Math.max(...orders.map((item) => Number(item.paid_total || 0)), 1)
    const points = orders.map((item, index) => `${(index / Math.max(orders.length - 1, 1)) * 620},${180 - (Number(item.paid_total || 0) / maximum) * 150}`).join(" ")
    return {
      points,
      total: orders.reduce((sum, item) => sum + Number(item.paid_total || 0), 0),
      orders: orders.reduce((sum, item) => sum + Number(item.paid_count || 0), 0),
    }
  }, [orders])

  const queueWait = Math.max(...Object.values(queue.wait || {}).map(Number), 0)
  const queueWaitText = queue.waitUnit === "jobs" ? `${count(queueWait)} 个任务` : queueWait > 0 ? `${queueWait.toFixed(1)} 秒` : "无等待"
  const queueInfo = (name: string) => queueMeta[name] || [name, "后台异步任务"]
  const jobName = (job?: FailedJob | null) => job?.name || job?.payload?.displayName || job?.payload?.job || "未知作业"
  const jobException = (job?: FailedJob | null) => String(job?.exception || job?.payload?.exception || "暂无异常详情")

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">经营仪表盘</h1>
          <p className="mt-1 text-sm text-muted-foreground">收入、用户与服务运行状态一屏掌握。</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && <span className="text-xs text-muted-foreground">更新于 {updatedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>}
          <Button variant="outline" onClick={() => void load()} disabled={refreshing}><RefreshCw className={refreshing ? "animate-spin" : ""} />{refreshing ? "更新中" : "刷新数据"}</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="今日收入" value={loading ? "—" : money(stats.todayIncome)} icon={<WalletCards />} tone="bg-blue-50 text-primary" note={<><span className={growthTone(stats.dayIncomeGrowth)}>{growth(stats.dayIncomeGrowth)}</span> 较昨日</>} />
        <KpiCard label="本月收入" value={loading ? "—" : money(stats.currentMonthIncome)} icon={<BadgeDollarSign />} tone="bg-violet-50 text-violet-600" note={<><span className={growthTone(stats.monthIncomeGrowth)}>{growth(stats.monthIncomeGrowth)}</span> 较上月</>} />
        <KpiCard label="有效用户" value={loading ? "—" : count(stats.activeUsers)} icon={<Users />} tone="bg-emerald-50 text-emerald-600" note={`总用户 ${count(stats.totalUsers)} · 本月 +${count(stats.currentMonthNewUsers)}`} />
        <KpiCard label="今日流量" value={loading ? "—" : traffic(stats.todayTraffic?.total)} icon={<Activity />} tone="bg-orange-50 text-orange-600" note={`本月 ${traffic(stats.monthTraffic?.total)}`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,.8fr)]">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle>近 14 天收入趋势</CardTitle><CardDescription>已支付订单的每日收入与成交笔数。</CardDescription></div>
            <div className="flex gap-5 text-right text-xs text-muted-foreground"><span>累计收入<strong className="mt-1 block text-base text-foreground">{money(chart.total)}</strong></span><span>成交订单<strong className="mt-1 block text-base text-foreground">{count(chart.orders)}</strong></span></div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52 w-full" /> : orders.length ? (
              <div className="h-52 w-full">
                <svg viewBox="0 0 620 200" preserveAspectRatio="none" className="h-full w-full" aria-label="收入趋势图">
                  <defs><linearGradient id="dashboard-area-react" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#027bfe" stopOpacity=".22" /><stop offset="100%" stopColor="#027bfe" stopOpacity="0" /></linearGradient></defs>
                  {[30, 80, 130, 180].map((y) => <line key={y} x1="0" y1={y} x2="620" y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />)}
                  <polygon points={`0,180 ${chart.points} 620,180`} fill="url(#dashboard-area-react)" />
                  <polyline points={chart.points} fill="none" stroke="#027bfe" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ) : <p className="grid h-52 place-items-center text-sm text-muted-foreground">近 14 天暂无订单统计</p>}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle>待办事项</CardTitle><CardDescription>优先处理影响用户体验的事项。</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {[
              ["/user/ticket", <Ticket />, "待处理工单", "及时回复用户咨询与故障反馈", stats.ticketPendingTotal],
              ["/subscription/order", <BadgeDollarSign />, "待结算佣金", "核对已完成订单的邀请佣金", stats.commissionPendingTotal],
              ["/node/diagnostic", <Server />, "节点运行检查", Number(stats.onlineNodes || 0) > 0 ? "运行正常" : "暂无在线节点", stats.onlineNodes],
            ].map(([href, icon, title, note, value]) => (
              <Link key={String(href)} to={String(href)} className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/70">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon as React.ReactNode}</span>
                <span className="min-w-0 flex-1"><strong className="block text-sm">{String(title)}</strong><small className="block truncate text-xs text-muted-foreground">{String(note)}</small></span>
                <Badge variant="secondary">{count(value as Numeric)}</Badge><ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RankingCard title="节点流量排行" description="近 7 天高负载节点。" items={nodeRank} href="/node/list" linkText="节点管理" />
        <RankingCard title="用户流量排行" description="近 7 天高用量用户。" items={userRank} href="/user/list" linkText="用户管理" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle>队列状态</CardTitle><CardDescription>{queue.modeLabel || "任务队列"} · 实时进程与积压情况。</CardDescription></div>
            <Badge variant={queue.status ? "default" : "destructive"}>{queue.status ? "运行中" : "未运行"}</Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            {queue.mode === "worker" && <div className="flex gap-2 rounded-xl bg-primary/5 p-3 text-xs text-primary"><Info className="size-4 shrink-0" /><span>当前使用普通 Redis Worker；已完成作业不会保留历史，吞吐指标仅 Horizon 模式支持。</span></div>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(queue.mode === "worker" ? [["工作进程", queue.processes], ["待处理", queue.readyJobs], ["执行中", queue.reservedJobs], ["延迟任务", queue.delayedJobs]] : [["工作进程", queue.processes], ["每分钟作业", queue.jobsPerMinute], ["近期作业", queue.recentJobs], ["失败作业", queue.failedJobs]]).map(([label, value]) => <div key={String(label)} className="rounded-xl bg-muted/60 p-3"><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-1 block text-xl">{count(value)}</strong></div>)}
            </div>
            <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border p-3"><span className="text-xs text-muted-foreground">{queue.waitUnit === "jobs" ? "最大队列积压" : "最大等待"}</span><strong className="mt-1 block text-sm">{queueWaitText}</strong></div><div className="rounded-xl border p-3"><span className="text-xs text-muted-foreground">{queue.mode === "worker" ? "累计失败作业" : "暂停主进程"}</span><strong className="mt-1 block text-sm">{count(queue.mode === "worker" ? queue.failedJobs : queue.pausedMasters)}</strong></div></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><strong className="text-sm">业务队列</strong><span className="text-xs text-muted-foreground">{workload.length} 个队列共享 {count(queue.processes)} 个 Worker</span></div>
              {workload.length ? workload.map((item) => <div key={item.name} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"><span className="min-w-0 flex-1"><strong className="block text-sm">{queueInfo(item.name)[0]}</strong><small className="text-xs text-muted-foreground">{queueInfo(item.name)[1]}</small></span><span className="text-xs text-muted-foreground">{count(item.length)} 等待 · {count(item.reserved)} 执行 · {count(item.delayed)} 延迟</span></div>) : <p className="py-6 text-center text-sm text-muted-foreground">暂无队列负载数据</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>作业详情</CardTitle><CardDescription>失败作业会持久保存，可查看完整负载与错误信息。</CardDescription></div><Badge variant="secondary">{failedJobs.length} 条记录</Badge></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-72 w-full" /> : failedJobs.length ? <div className="space-y-2">{failedJobs.map((job) => <Button key={job.id} type="button" variant="ghost" onClick={() => setSelectedJob(job)} className="h-auto w-full justify-start gap-3 rounded-xl p-3 text-left font-normal"><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{jobName(job)}</strong><small className="text-xs text-muted-foreground">{job.connection || "redis"} / {job.queue || "default"}</small></span><span className="hidden max-w-60 truncate text-xs text-red-500 sm:block">{jobException(job).split("\n")[0]}</span><ChevronRight className="size-4 text-muted-foreground" /></Button>)}</div> : (
              <div className="grid min-h-72 place-items-center text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 /></span><strong className="mt-4 block">队列运行正常</strong><p className="mt-1 text-sm text-muted-foreground">当前没有失败或需要人工介入的作业。</p><div className="mt-5 flex flex-wrap justify-center gap-2">{["订单开通", "流量采集", "统计入库", "节点同步", "邮件通知", "Telegram"].map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</div></div></div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle>实时运行</CardTitle><CardDescription>10 分钟内服务状态</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[[<Radio />, "在线用户", stats.onlineUsers], [<MonitorSmartphone />, "在线设备", stats.onlineDevices], [<Network />, "在线节点", stats.onlineNodes], [<Database />, "累计流量", traffic(stats.totalTraffic?.total)]].map(([icon, label, value]) => <div key={String(label)} className="flex items-center gap-3 rounded-xl bg-muted/60 p-4"><span className="text-primary">{icon as React.ReactNode}</span><span className="text-xs text-muted-foreground">{label}<strong className="mt-1 block text-lg text-foreground">{typeof value === "string" ? value : count(value as Numeric)}</strong></span></div>)}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedJob)} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{jobName(selectedJob)}</DialogTitle><DialogDescription>{selectedJob?.connection || "redis"} / {selectedJob?.queue || "default"} · {formatDate(selectedJob?.failed_at)}</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["作业 ID", selectedJob?.id], ["状态", selectedJob?.status || "失败"], ["连接", selectedJob?.connection || "redis"], ["队列", selectedJob?.queue || "default"]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-muted p-3"><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-1 block truncate text-sm">{String(value || "—")}</strong></div>)}</div>
          <div><h3 className="mb-2 text-sm font-medium">异常信息</h3><pre className="max-h-56 overflow-auto rounded-xl bg-red-50 p-4 text-xs text-red-700">{jobException(selectedJob)}</pre></div>
          <div><h3 className="mb-2 text-sm font-medium">作业负载</h3><pre className="max-h-72 overflow-auto rounded-xl bg-muted p-4 text-xs">{JSON.stringify(selectedJob?.payload || {}, null, 2)}</pre></div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
