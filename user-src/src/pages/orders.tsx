import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Check, CheckCircle2, Clock3, Copy, Download, LoaderCircle, PackageCheck, ReceiptText, WalletCards, XCircle } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useSession } from "@/app/providers"
import { ConfirmDialog, DataTable, EmptyState, ErrorAlert, PageHeader, PageLoading, PaymentMethodPicker, RichContent, StatusBadge } from "@/components/common"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { copyText, formatTime, money, sanitizeHtml, statusText } from "@/lib/format"
import { normalizeCollection } from "@/lib/utils"

const orderStatus: Record<number, string> = { 0: "待支付", 1: "开通中", 2: "已取消", 3: "已完成", 4: "已折抵" }

interface PaymentResultState { html: string; message: string; polling: boolean }
export function usePaymentFlow(kind: "order" | "recharge", tradeNo: string, onPaid?: () => void | Promise<void>) {
  const { refresh } = useSession()
  const [state, setState] = React.useState<PaymentResultState>({ html: "", message: "", polling: false })
  const attempts = React.useRef(0)
  React.useEffect(() => {
    if (!state.polling) return
    attempts.current = 0
    let stopped = false
    const endpoint = kind === "recharge" ? "/user/recharge/check" : "/user/order/check"
    const poll = async () => {
      attempts.current += 1
      try {
        const status = await api.get<any>(endpoint, { trade_no: tradeNo })
        if (Number(status) === 3 && !stopped) {
          setState((value) => ({ ...value, polling: false, message: "支付成功" }))
          await refresh().catch(() => undefined)
          await onPaid?.()
          toast.success("支付成功")
        } else if (attempts.current >= 60) setState((value) => ({ ...value, polling: false }))
      } catch { if (attempts.current >= 10) setState((value) => ({ ...value, polling: false })) }
    }
    const timer = window.setInterval(poll, 3000)
    poll()
    return () => { stopped = true; window.clearInterval(timer) }
  }, [kind, onPaid, refresh, state.polling, tradeNo])
  const handle = React.useCallback((result: any) => {
    if (result?.type === 1 && typeof result.data === "string") { window.location.assign(result.data); return }
    if (result?.type === -1 || result?.data === true) { setState({ html: "", message: "支付已完成，正在刷新状态…", polling: true }); return }
    if (typeof result?.data === "string") { setState({ html: sanitizeHtml(result.data), message: "请完成支付，页面将自动更新。", polling: true }); return }
    setState({ html: "", message: typeof result === "string" ? result : JSON.stringify(result), polling: true })
  }, [])
  return { ...state, handle }
}

export function PaymentResult({ html, message, polling }: PaymentResultState) {
  return <>{message ? <Alert variant={message === "支付成功" ? "success" : "default"}>{polling ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}<AlertTitle>{message}</AlertTitle><AlertDescription>{polling ? "正在检查最新支付状态，请勿重复提交。" : "订单状态已更新。"}</AlertDescription></Alert> : null}{html ? <div className="payment-html" dangerouslySetInnerHTML={{ __html: html }} /> : null}</>
}

function deliveryFields(content: unknown) {
  const raw = String(content ?? "").trim(); if (!raw) return [] as Array<{ label: string; value: string }>
  try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return Object.entries(parsed).map(([label,value]) => ({ label, value: typeof value === "object" ? JSON.stringify(value) : String(value) })) } catch { /* plain text */ }
  const rows = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => { const match = line.match(/^([^:=：]+)[:=：]\s*(.+)$/); return match ? { label: match[1].trim(), value: match[2].trim() } : { label: "内容", value: line } })
  return rows.length ? rows : [{ label: "内容", value: raw }]
}
function deliveryFile(content: unknown) {
  const raw = String(content ?? "").trim(); if (!raw) return null
  try { const value = JSON.parse(raw); if (value?.url && /^https?:\/\/|^\//.test(value.url)) return { url: String(value.url), name: String(value.name || "交付文件"), meta: value.size || value.type || "" } } catch { /* not json */ }
  if (/^https?:\/\/|^\//.test(raw) && /\.(zip|rar|7z|pdf|txt|json|ya?ml|csv)(\?|$)/i.test(raw)) return { url: raw, name: raw.split("/").pop() || "交付文件", meta: "" }
  return null
}

export function OrdersPage() {
  const [params] = useSearchParams()
  const tradeNo = params.get("trade_no")
  if (tradeNo) return <OrderDetailPage tradeNo={tradeNo} initialMethod={params.get("method") || ""} />
  return <OrderList />
}

function OrderList() {
  const { comm } = useSession()
  const query = useQuery({ queryKey: ["orders"], queryFn: ({ signal }) => api.get<any>("/user/order/fetch", {}, { signal }).then((data) => normalizeCollection<any>(data)) })
  if (query.isLoading) return <PageLoading cards={2} />
  const rows = (query.data || []).map((order) => [<Link className="font-mono text-primary hover:underline" to={`/orders?trade_no=${encodeURIComponent(order.trade_no)}`}>{order.trade_no}</Link>, order.plan?.name || "-", <StatusBadge ok={Number(order.status) === 3} warning={Number(order.status) === 0}>{statusText(order.status, orderStatus)}</StatusBadge>, money(order.total_amount, comm?.currency_symbol || "¥"), formatTime(order.created_at)])
  return <div><PageHeader title="订单记录" description="查看套餐与数字商品订单状态。" /><ErrorAlert error={query.error} /><Card><CardContent><DataTable headers={["订单号","商品 / 套餐","状态","金额","创建时间"]} rows={rows} empty="暂无订单" /></CardContent></Card></div>
}

function OrderDetailPage({ tradeNo, initialMethod }: { tradeNo: string; initialMethod: string }) {
  const { comm } = useSession(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [method, setMethod] = React.useState(initialMethod); const [paying, setPaying] = React.useState(false); const [cancelOpen, setCancelOpen] = React.useState(false); const [cancelling, setCancelling] = React.useState(false)
  const query = useQuery({ queryKey: ["order-detail", tradeNo], queryFn: async ({ signal }) => { const order = await api.get<any>("/user/order/detail", { trade_no: tradeNo }, { signal }); const methods = Number(order.status) === 0 && Number(order.total_amount) > 0 ? await api.get<any[]>("/user/order/getPaymentMethod", {}, { signal }).catch(() => []) : []; return { order, methods } } })
  const refreshDetail = React.useCallback(() => queryClient.invalidateQueries({ queryKey: ["order-detail", tradeNo] }), [queryClient, tradeNo])
  const payment = usePaymentFlow("order", tradeNo, refreshDetail)
  React.useEffect(() => { const first = initialMethod || query.data?.order?.payment_id || query.data?.methods?.[0]?.id; if (first && !method) setMethod(String(first)) }, [initialMethod, method, query.data])
  if (query.isLoading) return <PageLoading cards={4} />
  const order = query.data?.order || {}; const completed = Number(order.status) === 3; const isDigital = order.plan?.product_type === "digital"; const currency = comm?.currency_symbol || "¥"; const balance = Number(order.balance_amount || 0); const paid = Math.max(0, Number(order.total_amount || 0) + balance); const selectedPackage = normalizeCollection<any>(order.plan?.product_config?.packages).find((item) => String(item.id) === String(order.period)); const productImage = order.plan?.product_config?.image_url
  async function checkout() { if (Number(order.total_amount) > 0 && !method) return toast.error("请选择支付方式"); setPaying(true); try { const result = await api.post<any>("/user/order/checkout", { trade_no: tradeNo, method: method || null }); payment.handle(result) } catch (error) { toast.error(error instanceof Error ? error.message : "支付失败") } finally { setPaying(false) } }
  async function cancel() { setCancelling(true); try { await api.post("/user/order/cancel", { trade_no: tradeNo }); toast.success("订单已取消"); navigate("/orders") } catch (error) { toast.error(error instanceof Error ? error.message : "取消失败") } finally { setCancelling(false); setCancelOpen(false) } }
  const steps = [["提交订单", order.created_at, true],["支付成功", order.updated_at, completed || Number(order.status) === 1],["处理完成", order.updated_at, completed],["已完成", order.updated_at, completed]]
  return <div className="grid gap-5"><Button variant="ghost" className="w-fit" onClick={() => navigate("/orders")}><ArrowLeft />返回订单列表</Button><ErrorAlert error={query.error} />
    <PageHeader title={`订单 ${order.trade_no || tradeNo}`} description={statusText(order.status, orderStatus)} actions={<StatusBadge ok={completed} warning={Number(order.status) === 0}>{statusText(order.status, orderStatus)}</StatusBadge>} />
    {Number(order.status) === 0 ? <Card className="border-primary/25"><CardHeader><CardTitle>支付订单</CardTitle><CardDescription>{Number(order.total_amount) > 0 ? "选择支付方式后发起支付。" : "确认后将使用余额完成本单。"}</CardDescription></CardHeader><CardContent className="grid gap-4">{Number(order.total_amount) > 0 ? <PaymentMethodPicker methods={query.data?.methods || []} value={method} onValueChange={setMethod} /> : <Alert><WalletCards /><AlertTitle>{balance > 0 ? "余额已全额抵扣" : "本单无需额外支付"}</AlertTitle><AlertDescription>无需选择其他支付渠道，确认后即可继续处理订单。</AlertDescription></Alert>}<div className="flex gap-2"><Button onClick={checkout} disabled={paying || (Number(order.total_amount) > 0 && !method)}>{paying ? <LoaderCircle className="animate-spin" /> : Number(order.total_amount) > 0 ? <ReceiptText /> : <WalletCards />}{paying ? "处理中…" : Number(order.total_amount) > 0 ? "立即支付" : balance > 0 ? "确认余额支付" : "确认订单"}</Button><Button variant="outline" onClick={() => setCancelOpen(true)}><XCircle />取消订单</Button></div><PaymentResult {...payment} /></CardContent></Card> : null}
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]"><div className="grid gap-5"><Card><CardHeader><CardTitle>订单状态</CardTitle></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-4">{steps.map(([label,time,done], index) => <div key={String(label)} className="relative"><div className={`mb-2 grid size-9 place-content-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{done ? <Check /> : <Clock3 />}</div><strong className="text-sm">{String(label)}</strong><p className="mt-1 text-xs text-muted-foreground">{done && time ? formatTime(time) : "等待处理"}</p>{index < steps.length - 1 ? <div className="absolute left-10 top-4 hidden h-px w-[calc(100%-2.5rem)] bg-border sm:block" /> : null}</div>)}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>商品信息</CardTitle></CardHeader><CardContent className="grid gap-5"><div className="flex items-center gap-4"><div className="grid size-20 place-content-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground bg-cover bg-center" style={productImage ? { backgroundImage: `url("${productImage}")` } : undefined}>{productImage ? null : String(order.plan?.name || "商").slice(0,1)}</div><div><strong className="text-lg">{order.plan?.name || "订单商品"}</strong><p className="mt-1 text-sm text-muted-foreground">{selectedPackage?.name || order.period || "默认规格"}</p></div></div><RichContent className="rounded-lg bg-muted/35 p-4 text-sm" html={selectedPackage?.description || order.plan?.content || "—"} /></CardContent></Card>
      {normalizeCollection<any>(order.digital_delivery).length ? <Card><CardHeader><CardTitle>交付信息</CardTitle><CardDescription>请妥善保存交付内容。</CardDescription></CardHeader><CardContent className="grid gap-3">{normalizeCollection<any>(order.digital_delivery).map((item,index) => { const file = deliveryFile(item.content); const fields = deliveryFields(item.content); return <div key={item.id || index} className="rounded-lg border p-4">{file ? <div className="flex items-center justify-between gap-3"><div><strong>{file.name}</strong><p className="text-xs text-muted-foreground">{file.meta}</p></div><Button asChild variant="outline"><a href={file.url} target="_blank" rel="noopener noreferrer" download><Download />下载</a></Button></div> : <div className="grid gap-2">{fields.map((field, fieldIndex) => <div key={fieldIndex} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 p-3"><div className="min-w-0"><small className="text-muted-foreground">{field.label}</small><strong className="block break-all text-sm">{field.value}</strong></div><Button variant="ghost" size="icon-sm" onClick={() => copyText(field.value).then(() => toast.success(`${field.label}已复制`))}><Copy /></Button></div>)}</div>}</div> })}</CardContent></Card> : completed && isDigital ? <Alert><PackageCheck /><AlertTitle>交付内容正在生成</AlertTitle><AlertDescription>请稍后刷新订单详情。</AlertDescription></Alert> : null}</div>
      <Card className="xl:sticky xl:top-23"><CardHeader><CardTitle>订单信息</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm">{[["商品名称",order.plan?.name || "订单商品"],["订单类型",isDigital ? "数字商品" : "订阅套餐"],["订单号",order.trade_no || tradeNo],["创建时间",formatTime(order.created_at)],["商品金额",money(paid + Number(order.discount_amount || 0),currency)],["优惠金额",`-${money(order.discount_amount || 0,currency)}`],["余额抵扣",`-${money(balance,currency)}`],["支付方式",balance > 0 ? (Number(order.total_amount) > 0 && order.payment?.name ? `余额 + ${order.payment.name}` : "本地余额支付") : order.payment?.name || "—"]].map(([label,value]) => <div key={label} className="flex justify-between gap-4 border-b pb-3 last:border-0"><span className="text-muted-foreground">{label}</span><strong className="break-all text-right">{value}</strong></div>)}<div className="flex items-end justify-between pt-2"><span>实付金额</span><strong className="text-2xl text-primary">{money(completed ? paid : order.total_amount,currency)}</strong></div></CardContent></Card></div>
    <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="取消该订单？" description="取消后如需购买，请重新创建订单。" confirmLabel="确认取消" destructive busy={cancelling} onConfirm={cancel} />
  </div>
}
