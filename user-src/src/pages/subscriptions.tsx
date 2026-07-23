import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Link2, LockKeyhole, Snowflake, Star, UnlockKeyhole, UserRoundCheck } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { useSession } from "@/app/providers"
import { ConfirmDialog, DataTable, ErrorAlert, PageHeader, PageLoading, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { api } from "@/lib/api"
import { bytes, copyText, formatDate, formatTime, money, percent } from "@/lib/format"
import { normalizeCollection } from "@/lib/utils"

type Subscription = Record<string, any>

export function SubscriptionsPage() {
  const { comm, refresh } = useSession()
  const queryClient = useQueryClient()
  const [busy, setBusy] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [freezeTarget, setFreezeTarget] = React.useState<Subscription | null>(null)
  const [freezeDays, setFreezeDays] = React.useState("7")
  const [transferTarget, setTransferTarget] = React.useState<Subscription | null>(null)
  const [transferEmail, setTransferEmail] = React.useState("")

  const query = useQuery({
    queryKey: ["subscriptions-page"],
    queryFn: async ({ signal }) => {
      const [subscribe, servers, data] = await Promise.all([
        api.get<any>("/user/getSubscribe", {}, { signal }),
        api.get<any>("/user/server/fetch", {}, { signal }).catch(() => ({ data: [] })),
        api.get<any>("/user/subscription/fetch", {}, { signal }).catch(() => ({ data: [], summary: {}, transfer: {} })),
      ])
      return { subscribe, servers: normalizeCollection<any>(servers?.data || servers), subscriptions: normalizeCollection<Subscription>(data?.data || data), summary: data?.summary || {}, transfer: data?.transfer || { enabled: false, fee: 0, history: [] } }
    },
  })

  const reload = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["subscriptions-page"] }), refresh()]) }
  async function action(task: () => Promise<unknown>, message: string) {
    setBusy(true)
    try { await task(); await reload(); toast.success(message) }
    catch (error) { toast.error(error instanceof Error ? error.message : "操作失败") }
    finally { setBusy(false) }
  }
  if (query.isLoading) return <PageLoading cards={5} />
  const data = query.data
  const subscribe = data?.subscribe || {}
  const subscriptions = data?.subscriptions || []
  const servers = data?.servers || []
  const transfer = data?.transfer || {}
  const used = Number(subscribe.u || 0) + Number(subscribe.d || 0)
  const total = Number(subscribe.transfer_enable || 0)
  const usage = percent(used, total)
  const currency = comm?.currency_symbol || "¥"
  const transferHistory = normalizeCollection<any>(transfer.history)

  async function resetSecurity() {
    await action(async () => { await api.get("/user/resetSecurity") }, "订阅链接已重置")
    setResetOpen(false)
  }
  async function copySubscribe() { await copyText(subscribe.subscribe_url || ""); toast.success("订阅地址已复制") }
  async function freeze() {
    if (!freezeTarget || Number(freezeDays) < 1) return
    await action(() => api.post("/user/subscription/freeze", { id: freezeTarget.id, days: Number(freezeDays) }), "订阅已冻结")
    setFreezeTarget(null)
  }
  async function transferSubscription() {
    if (!transferTarget || !transferEmail.trim()) return
    await action(() => api.post("/user/subscription/transfer", { id: transferTarget.id, email: transferEmail.trim() }), "套餐已转让")
    setTransferTarget(null); setTransferEmail("")
  }

  const nodeRows = servers.map((node, index) => [`#${index + 1}`, node.name || "-", node.type || "-", node.rate ?? "-", <StatusBadge ok={Boolean(node.is_online)}>{node.is_online ? "在线" : "维护"}</StatusBadge>])
  return <div className="grid gap-5">
    <PageHeader title="我的订阅" description="管理订阅、设备导入、冻结与套餐转让。" actions={<Button asChild><Link to="/plans">购买套餐</Link></Button>} />
    <ErrorAlert error={query.error} />
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{subscriptions.length ? subscriptions.map((item) => <Card key={item.id} className={item.is_primary ? "border-primary/40 bg-primary/5" : item.status === 2 ? "border-amber-500/30" : ""}>
      <CardHeader><div className="flex items-center justify-between"><StatusBadge ok={item.status === 1} warning={item.status === 2}>{item.is_primary ? "主订阅" : item.status_text || "订阅"}</StatusBadge>{item.is_primary ? <Star className="size-4 fill-primary text-primary" /> : null}</div><CardTitle className="mt-2 text-xl">{item.plan_name || "未知套餐"}</CardTitle><CardDescription>{item.expired_at ? `${formatDate(item.expired_at)} 到期` : "长期有效"} · {item.traffic_text || bytes(item.transfer_enable)}</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {item.status === 1 && !item.is_primary ? <Button size="sm" variant="outline" disabled={busy} onClick={() => action(() => api.post("/user/subscription/primary", { id: item.id }), "已设为主订阅")}><Star />设为主订阅</Button> : null}
        {transfer.enabled && item.can_transfer ? <Button size="sm" variant="outline" onClick={() => setTransferTarget(item)}><UserRoundCheck />转让</Button> : null}
        {item.status === 1 ? <Button size="sm" variant="outline" onClick={() => { setFreezeDays("7"); setFreezeTarget(item) }}><Snowflake />冻结</Button> : null}
        {item.status === 2 ? <Button size="sm" variant="outline" disabled={busy} onClick={() => action(() => api.post("/user/subscription/unfreeze", { id: item.id }), "订阅已解冻")}><UnlockKeyhole />解冻</Button> : null}
      </CardContent>
    </Card>) : <Card className="lg:col-span-2 xl:col-span-3"><CardContent className="py-8 text-center"><p className="font-medium">暂无订阅</p><Button className="mt-4" asChild><Link to="/plans">立即购买</Link></Button></CardContent></Card>}</div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <Card><CardHeader><CardDescription>订阅地址</CardDescription><CardTitle>{subscribe.plan?.name || "未订阅套餐"}</CardTitle></CardHeader><CardContent className="grid gap-5">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3"><code className="min-w-0 flex-1 truncate text-xs">{subscribe.subscribe_url || "暂无订阅地址"}</code><Button size="icon-sm" variant="outline" onClick={copySubscribe} disabled={!subscribe.subscribe_url}><Copy /></Button></div>
        <div><div className="mb-2 flex justify-between text-sm"><span>已用 {bytes(used)}</span><span>{total ? `剩余 ${bytes(Math.max(total - used, 0))}` : "不限量"}</span></div><Progress value={usage} /></div>
        <div className="flex flex-wrap gap-2"><Button onClick={copySubscribe} disabled={!subscribe.subscribe_url}><Link2 />复制订阅</Button><Button variant="outline" onClick={() => setResetOpen(true)} disabled={!subscribe.subscribe_url}><LockKeyhole />重置订阅</Button><Button asChild variant="secondary"><Link to="/plans">续费套餐</Link></Button></div>
      </CardContent></Card>
      <Card><CardHeader><CardDescription>客户端导入</CardDescription><CardTitle>一键复制订阅</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2">{["Shadowrocket","Clash Verge","Stash","V2rayN"].map((name) => <Button key={name} variant="outline" onClick={copySubscribe}>{name}</Button>)}</CardContent></Card>
    </div>
    <Card><CardHeader><CardDescription>实时列表</CardDescription><CardTitle>可用节点</CardTitle></CardHeader><CardContent><DataTable headers={["序号","节点名称","协议","倍率","状态"]} rows={nodeRows} empty="暂无可用节点" /></CardContent></Card>
    <Card><CardHeader className="flex flex-row items-start justify-between"><div><CardDescription>套餐流转</CardDescription><CardTitle>套餐转让</CardTitle></div><StatusBadge ok={Boolean(transfer.enabled)}>{transfer.enabled ? "已开启" : "未开启"}</StatusBadge></CardHeader><CardContent className="grid gap-4"><p className="text-sm text-muted-foreground">{transfer.enabled ? `符合条件的套餐可转让给其他账号，默认费用 ${money(transfer.default_fee ?? transfer.fee, currency)}。` : "管理员暂未开启套餐转让。"}</p><DataTable headers={["方向","套餐","对方账号","费用","时间"]} rows={transferHistory.map((record) => [<StatusBadge ok={record.direction !== "out"}>{record.direction === "out" ? "转出" : "转入"}</StatusBadge>, record.plan_name || "-", record.counterparty_email || "-", record.direction === "out" ? money(record.fee, currency) : "-", formatTime(record.transferred_at)])} empty="暂无转让记录" /></CardContent></Card>
    <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} title="重置订阅链接？" description="重置后旧链接将立即失效，已导入旧链接的客户端需要重新配置。" confirmLabel="确认重置" destructive busy={busy} onConfirm={resetSecurity} />
    <Dialog open={Boolean(freezeTarget)} onOpenChange={(open) => !open && !busy && setFreezeTarget(null)}><DialogContent><DialogHeader><DialogTitle>冻结套餐</DialogTitle><DialogDescription>冻结期间套餐不可使用，解冻规则以站点配置为准。</DialogDescription></DialogHeader><Field label="冻结天数"><Input type="number" min={1} value={freezeDays} onChange={(event) => setFreezeDays(event.target.value)} /></Field><DialogFooter><Button variant="outline" onClick={() => setFreezeTarget(null)} disabled={busy}>取消</Button><Button onClick={freeze} disabled={busy || Number(freezeDays) < 1}><Snowflake />确认冻结</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(transferTarget)} onOpenChange={(open) => !open && !busy && setTransferTarget(null)}><DialogContent><DialogHeader><DialogTitle>转让 {transferTarget?.plan_name}</DialogTitle><DialogDescription>转让成功后套餐将立即归接收方所有，费用从余额扣除，此操作不可撤销。</DialogDescription></DialogHeader><Field label="接收方邮箱"><Input type="email" value={transferEmail} onChange={(event) => setTransferEmail(event.target.value)} placeholder="user@example.com" /></Field><div className="flex justify-between rounded-lg bg-muted p-3 text-sm"><span>转让费用</span><strong>{money(transferTarget?.transfer_fee ?? transfer.fee, currency)}</strong></div><DialogFooter><Button variant="outline" onClick={() => setTransferTarget(null)} disabled={busy}>取消</Button><Button onClick={transferSubscription} disabled={busy || !transferEmail.trim()}><UserRoundCheck />确认转让</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
