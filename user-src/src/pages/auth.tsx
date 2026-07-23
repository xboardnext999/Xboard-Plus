import * as React from "react"
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserPlus } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useSession } from "@/app/providers"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { formObject } from "@/lib/utils"

function AuthHeading({ icon: Icon, eyebrow, title, description }: { icon: React.ComponentType<{ className?: string }>; eyebrow: string; title: string; description: string }) {
  return <div className="mb-7">
    <div className="mb-5 flex items-center gap-3"><div className="grid size-10 place-content-center rounded-full bg-primary/10 text-primary"><Icon className="size-5" /></div><Badge variant="secondary">{eyebrow}</Badge></div>
    <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
    <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
}

function PasswordInput({ id, name, autoComplete, placeholder = "至少 8 位字符" }: { id: string; name: string; autoComplete: string; placeholder?: string }) {
  const [visible, setVisible] = React.useState(false)
  return <div className="relative"><Input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={8} required placeholder={placeholder} className="pr-11" /><Button type="button" variant="ghost" size="icon-sm" className="absolute right-0.5 top-1/2 -translate-y-1/2" onClick={() => setVisible((value) => !value)} aria-label={visible ? "隐藏密码" : "显示密码"}>{visible ? <EyeOff /> : <Eye />}</Button></div>
}

function SubmitButton({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: React.ReactNode }) {
  return <Button className="mt-1 w-full" size="lg" disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : null}{busy ? busyLabel : children}</Button>
}

function AuthFooter({ prompt, label, to }: { prompt: string; label: string; to: string }) {
  return <><div className="my-6 flex items-center gap-3"><Separator className="flex-1" /><span className="text-xs text-muted-foreground">或</span><Separator className="flex-1" /></div><p className="text-center text-sm text-muted-foreground">{prompt}<Button asChild variant="link" className="h-auto px-1"><Link to={to}>{label}</Link></Button></p></>
}

function EmailCodeButton({ sending, onClick }: { sending: boolean; onClick: React.MouseEventHandler<HTMLButtonElement> }) {
  return <Button type="button" variant="outline" className="shrink-0" disabled={sending} onClick={onClick}>{sending ? <LoaderCircle className="animate-spin" /> : <Mail />}{sending ? "发送中" : "发送验证码"}</Button>
}

export function LoginPage() {
  const { loginWithToken } = useSession()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [busy, setBusy] = React.useState(false)
  const verifyHandled = React.useRef(false)

  React.useEffect(() => {
    const verify = params.get("verify")
    if (!verify || verifyHandled.current) return
    verifyHandled.current = true
    setBusy(true)
    api.get<any>("/passport/auth/token2Login", { verify }, { auth: false }).then(async (payload) => {
      const data = payload?.data || payload
      if (!data?.auth_data) throw new Error("登录凭证无效")
      await loginWithToken(data.auth_data)
      toast.success("登录成功")
      navigate(`/${params.get("redirect") || "dashboard"}`, { replace: true })
    }).catch((error) => toast.error(error.message || "登录链接已失效")).finally(() => setBusy(false))
  }, [loginWithToken, navigate, params])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const data = await api.post<{ auth_data: string }>("/passport/auth/login", formObject(event.currentTarget), { auth: false })
      await loginWithToken(data.auth_data)
      toast.success("登录成功")
      navigate(`/${params.get("redirect") || "dashboard"}`, { replace: true })
    } catch (error) { toast.error(error instanceof Error ? error.message : "登录失败") }
    finally { setBusy(false) }
  }

  return <div className="w-full"><AuthHeading icon={ShieldCheck} eyebrow="安全登录" title="欢迎回来" description="登录后继续管理你的订阅、数字商品、节点与账户余额。" />
    <form className="grid gap-4" onSubmit={submit}>
      <Field label="邮箱" htmlFor="login-email"><Input id="login-email" name="email" type="email" autoComplete="email" required placeholder="name@example.com" /></Field>
      <div className="grid gap-2"><div className="flex items-center justify-between"><Label htmlFor="login-password">密码</Label><Button asChild variant="link" className="h-auto p-0 text-xs"><Link to="/forgot">忘记密码？</Link></Button></div><PasswordInput id="login-password" name="password" autoComplete="current-password" /></div>
      <SubmitButton busy={busy} busyLabel="正在登录…">登录账户</SubmitButton>
    </form>
    <AuthFooter prompt="还没有账号？" label="免费注册" to="/register" />
  </div>
}

function useEmailCode() {
  const [sending, setSending] = React.useState(false)
  const send = async (form: HTMLFormElement) => {
    const email = String(new FormData(form).get("email") || "")
    if (!email) return toast.error("请先输入邮箱")
    setSending(true)
    try {
      await api.post("/passport/comm/sendEmailVerify", { email }, { auth: false })
      toast.success("验证码已发送")
      await new Promise((resolve) => window.setTimeout(resolve, 3000))
    } catch (error) { toast.error(error instanceof Error ? error.message : "发送失败") }
    finally { setSending(false) }
  }
  return { sending, send }
}

export function RegisterPage() {
  const { guest, loginWithToken } = useSession()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { sending, send } = useEmailCode()
  const [busy, setBusy] = React.useState(false)
  const inviteCode = params.get("invite_code") || ""
  const showCode = Number(guest.is_email_verify) === 1
  const forceInvite = Number(guest.is_invite_force) === 1 || Boolean(inviteCode)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      const data = await api.post<{ auth_data: string }>("/passport/auth/register", formObject(event.currentTarget), { auth: false })
      await loginWithToken(data.auth_data)
      toast.success("注册成功")
      navigate("/dashboard", { replace: true })
    } catch (error) { toast.error(error instanceof Error ? error.message : "注册失败") }
    finally { setBusy(false) }
  }

  return <div className="w-full"><AuthHeading icon={UserPlus} eyebrow="创建账号" title="开始使用 Xboard Plus" description="完成注册即可购买套餐、管理订阅，并获取数字商品的自动交付内容。" />
    <form className="grid gap-4" onSubmit={submit}>
      <Field label="邮箱" htmlFor="register-email"><Input id="register-email" name="email" type="email" autoComplete="email" required placeholder="name@example.com" /></Field>
      <Field label="密码" htmlFor="register-password"><PasswordInput id="register-password" name="password" autoComplete="new-password" /></Field>
      {showCode ? <Field label="邮箱验证码" htmlFor="register-code"><div className="flex gap-2"><Input id="register-code" name="email_code" inputMode="numeric" maxLength={6} required placeholder="6 位验证码" /><EmailCodeButton sending={sending} onClick={(event) => send(event.currentTarget.form!)} /></div></Field> : null}
      {forceInvite ? <Field label="邀请码" htmlFor="register-invite"><Input id="register-invite" name="invite_code" defaultValue={inviteCode} required={Number(guest.is_invite_force) === 1} placeholder="输入邀请码" /></Field> : null}
      <SubmitButton busy={busy} busyLabel="正在创建…">创建账号</SubmitButton>
    </form>
    <div className="mt-5 flex items-start gap-2 rounded-2xl bg-muted/70 p-3 text-xs leading-5 text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /><span>注册即表示你同意遵守站点服务规则；账号信息仅用于登录与服务通知。</span></div>
    <AuthFooter prompt="已经有账号？" label="返回登录" to="/login" />
  </div>
}

export function ForgotPage() {
  const navigate = useNavigate()
  const { sending, send } = useEmailCode()
  const [busy, setBusy] = React.useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    try {
      await api.post("/passport/auth/forget", formObject(event.currentTarget), { auth: false })
      toast.success("密码已重置，请登录")
      navigate("/login")
    } catch (error) { toast.error(error instanceof Error ? error.message : "重置失败") }
    finally { setBusy(false) }
  }
  return <div className="w-full"><Button asChild variant="ghost" size="sm" className="mb-5 -ml-2"><Link to="/login"><ArrowLeft />返回登录</Link></Button>
    <AuthHeading icon={KeyRound} eyebrow="账号恢复" title="重置登录密码" description="验证码会发送到你的注册邮箱，验证通过后即可设置新密码。" />
    <Alert className="mb-5"><LockKeyhole /><AlertTitle>安全提示</AlertTitle><AlertDescription>请勿向任何人透露邮箱验证码。</AlertDescription></Alert>
    <form className="grid gap-4" onSubmit={submit}>
      <Field label="邮箱" htmlFor="forgot-email"><div className="flex gap-2"><Input id="forgot-email" name="email" type="email" autoComplete="email" required placeholder="name@example.com" /><EmailCodeButton sending={sending} onClick={(event) => send(event.currentTarget.form!)} /></div></Field>
      <Field label="邮箱验证码" htmlFor="forgot-code"><Input id="forgot-code" name="email_code" inputMode="numeric" maxLength={6} required placeholder="6 位验证码" /></Field>
      <Field label="新密码" htmlFor="forgot-password"><PasswordInput id="forgot-password" name="password" autoComplete="new-password" /></Field>
      <SubmitButton busy={busy} busyLabel="正在重置…">重置密码</SubmitButton>
    </form>
  </div>
}
