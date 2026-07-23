import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CreditCard, LoaderCircle, ReceiptText, WalletCards, XCircle } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useSession } from "@/app/providers"
import { ConfirmDialog, DataTable, ErrorAlert, PageHeader, PageLoading, PaymentMethodPicker, StatCards, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { formatTime, money, statusText } from "@/lib/format"
import { formObject, normalizeCollection } from "@/lib/utils"
import { PaymentResult, usePaymentFlow } from "@/pages/orders"

const rechargeStatus: Record<number, string> = { 0: "待支付", 1: "开通中", 2: "已取消", 3: "已完成", 4: "已折抵" }

export function RechargePage() {
  const [params] = useSearchParams()
  const tradeNo = params.get("trade_no")
  if (tradeNo) return <RechargeDetail tradeNo={tradeNo} />
  return <RechargeList />
}

function RechargeList() {
  const { user, comm } = useSession(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [busy, setBusy] = React.useState(false)
  const query = useQuery({ queryKey: ["recharges"], queryFn: ({ signal }) => api.get<any>("/user/recharge/fetch", {}, { signal }).then((value) => normalizeCollection<any>(value)).catch(() => []) })
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); try { const tradeNo = await api.post<string>("/user/recharge/save", formObject(event.currentTarget)); toast.success("充值单已创建"); await queryClient.invalidateQueries({ queryKey: ["recharges"] }); navigate(`/recharge?trade_no=${encodeURIComponent(tradeNo)}`) } catch (error) { toast.error(error instanceof Error ? error.message : "创建失败") } finally { setBusy(false) } }
  if (query.isLoading) return <PageLoading cards={3} />
  const currency = comm?.currency_symbol || "¥"
  const rows = (query.data || []).map((item) => [<Link className="font-mono text-primary hover:underline" to={`/recharge?trade_no=${encodeURIComponent(item.trade_no)}`}>{item.trade_no}</Link>, money(item.amount,currency), <StatusBadge ok={Number(item.status) === 3} warning={Number(item.status) === 0}>{item.status_text || statusText(item.status,rechargeStatus)}</StatusBadge>, item.payment?.name || "-", formatTime(item.created_at)])
  return <div className="grid gap-5"><PageHeader title="充值余额" description="充值成功后余额自动入账，可用于购买套餐和数字商品。" /><ErrorAlert error={query.error} /><div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><Card><CardHeader><CardDescription>当前余额</CardDescription><CardTitle className="text-4xl text-primary">{money(user?.balance,currency)}</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={submit}><Field label="充值金额"><Input name="amount" type="number" min="0.01" step="0.01" placeholder="100.00" required /></Field><Button size="lg" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <WalletCards />}立即充值</Button></form></CardContent></Card><Card><CardHeader><CardDescription>Recharge notes</CardDescription><CardTitle>充值说明</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground">{["充值成功后余额自动入账","充值订单全程可追踪","余额可抵扣套餐和商品订单"].map((text) => <div key={text} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3"><CreditCard className="size-4 text-primary" />{text}</div>)}</CardContent></Card></div><Card><CardHeader><CardDescription>交易记录</CardDescription><CardTitle>充值记录</CardTitle></CardHeader><CardContent><DataTable headers={["充值单号","金额","状态","支付方式","创建时间"]} rows={rows} empty="暂无充值记录" /></CardContent></Card></div>
}

function RechargeDetail({ tradeNo }: { tradeNo: string }) {
  const { comm } = useSession(); const navigate = useNavigate(); const queryClient = useQueryClient(); const [method,setMethod] = React.useState(""); const [paying,setPaying] = React.useState(false); const [cancelOpen,setCancelOpen] = React.useState(false); const [cancelling,setCancelling] = React.useState(false)
  const query = useQuery({ queryKey: ["recharge-detail",tradeNo], queryFn: async ({ signal }) => { const recharge = await api.get<any>("/user/recharge/detail",{ trade_no: tradeNo },{ signal }); const methods = Number(recharge.status) === 0 ? await api.get<any[]>("/user/recharge/getPaymentMethod",{}, { signal }).catch(() => []) : []; return { recharge,methods } } })
  const refreshDetail = React.useCallback(() => queryClient.invalidateQueries({ queryKey: ["recharge-detail",tradeNo] }),[queryClient,tradeNo]); const payment = usePaymentFlow("recharge",tradeNo,refreshDetail)
  React.useEffect(() => { const first = query.data?.recharge?.payment_id || query.data?.methods?.[0]?.id; if (first && !method) setMethod(String(first)) },[method,query.data])
  if (query.isLoading) return <PageLoading cards={3} />
  const item = query.data?.recharge || {}; const currency = comm?.currency_symbol || "¥"
  async function checkout() { if (!method) return toast.error("请选择支付方式"); setPaying(true); try { payment.handle(await api.post<any>("/user/recharge/checkout",{ trade_no:tradeNo,method })) } catch(error) { toast.error(error instanceof Error ? error.message : "支付失败") } finally { setPaying(false) } }
  async function cancel() { setCancelling(true); try { await api.post("/user/recharge/cancel",{ trade_no:tradeNo }); toast.success("充值单已取消"); navigate("/recharge") } catch(error) { toast.error(error instanceof Error ? error.message : "取消失败") } finally { setCancelling(false); setCancelOpen(false) } }
  return <div className="grid gap-5"><Button variant="ghost" className="w-fit" onClick={() => navigate("/recharge")}><ArrowLeft />返回充值记录</Button><ErrorAlert error={query.error} /><PageHeader title={`充值单 ${item.trade_no || tradeNo}`} description={item.status_text || statusText(item.status,rechargeStatus)} actions={<StatusBadge ok={Number(item.status) === 3} warning={Number(item.status) === 0}>{item.status_text || statusText(item.status,rechargeStatus)}</StatusBadge>} /><StatCards items={[{label:"充值金额",value:money(item.amount,currency)},{label:"手续费",value:money(item.handling_amount,currency)},{label:"支付方式",value:item.payment?.name || "-"},{label:"创建时间",value:formatTime(item.created_at)}]} />{Number(item.status) === 0 ? <Card className="border-primary/25"><CardHeader><CardTitle>支付充值单</CardTitle><CardDescription>选择支付渠道完成充值。</CardDescription></CardHeader><CardContent className="grid gap-4"><PaymentMethodPicker methods={query.data?.methods || []} value={method} onValueChange={setMethod} /><div className="flex gap-2"><Button disabled={paying || !method} onClick={checkout}>{paying ? <LoaderCircle className="animate-spin" /> : <ReceiptText />}立即支付</Button><Button variant="outline" onClick={() => setCancelOpen(true)}><XCircle />取消充值</Button></div><PaymentResult {...payment} /></CardContent></Card> : null}<ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} title="取消该充值单？" description="取消后如需充值，请重新创建充值单。" confirmLabel="确认取消" destructive busy={cancelling} onConfirm={cancel} /></div>
}
