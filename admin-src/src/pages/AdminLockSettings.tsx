import { useEffect, useState } from "react"
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { get, post } from "@/services/http"

interface LockSettings {
  enabled: boolean
  ttl_minutes: number
  password_a_set: boolean
  password_b_set: boolean
}

interface LockForm {
  enabled: boolean
  ttl_minutes: number
  current_password: string
  password_a: string
  password_a_confirmation: string
  password_b: string
  password_b_confirmation: string
}

const initialForm: LockForm = {
  enabled: true,
  ttl_minutes: 480,
  current_password: "",
  password_a: "",
  password_a_confirmation: "",
  password_b: "",
  password_b_confirmation: "",
}

function PasswordInput({ id, label, value, placeholder, hint, visible, onChange }: {
  id: string
  label: string
  value: string
  placeholder: string
  hint?: string
  visible: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        autoComplete="new-password"
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function AdminLockSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<LockSettings>({ enabled: true, ttl_minutes: 480, password_a_set: false, password_b_set: false })
  const [form, setForm] = useState<LockForm>(initialForm)

  const patch = <K extends keyof LockForm>(key: K, value: LockForm[K]) => setForm((current) => ({ ...current, [key]: value }))

  const load = async () => {
    setLoading(true)
    try {
      const data = await get<LockSettings>("/admin-lock/settings")
      setState(data)
      setForm((current) => ({ ...current, enabled: Boolean(data.enabled), ttl_minutes: Number(data.ttl_minutes || 480) }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "访问锁设置加载失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const save = async () => {
    if (form.password_a && form.password_a.length < 8) return toast.error("访问密码 A 至少需要 8 位")
    if (form.password_b && form.password_b.length < 12) return toast.error("访问密码 B 至少需要 12 位")
    if (form.password_a && form.password_a !== form.password_a_confirmation) return toast.error("两次输入的访问密码 A 不一致")
    if (form.password_b && form.password_b !== form.password_b_confirmation) return toast.error("两次输入的访问密码 B 不一致")
    if (form.password_a && form.password_b && form.password_a === form.password_b) return toast.error("两个访问密码不能相同")
    if (!form.current_password) return toast.error("请输入当前访问密码 B 以确认修改")

    setSaving(true)
    try {
      const result = await post<{ requires_unlock?: boolean }>("/admin-lock/settings", {
        enabled: form.enabled,
        ttl_minutes: Number(form.ttl_minutes),
        current_password: form.current_password,
        password_a: form.password_a || null,
        password_b: form.password_b || null,
      })
      setForm((current) => ({ ...current, current_password: "", password_a: "", password_a_confirmation: "", password_b: "", password_b_confirmation: "" }))
      toast.success(result.requires_unlock ? "设置已保存，请使用新密码重新验证" : "访问锁设置已保存")
      if (result.requires_unlock) {
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("admin:locked", { detail: "locked" })), 700)
      } else {
        await load()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="space-y-5 p-4 md:p-6"><Skeleton className="h-20 w-full" /><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div></div>
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">后台访问锁</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理登录后的二次访问验证与有效时间。</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole /></span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">二次访问保护</CardTitle>
            <CardDescription className="mt-1">管理员登录后，仍需通过访问密码验证才能进入受保护页面。</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.enabled} onCheckedChange={(checked) => patch("enabled", checked)} aria-label="启用后台访问锁" />
            <span className="text-sm font-medium">{form.enabled ? "已启用" : "已关闭"}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle className="text-lg">访问凭证 A</CardTitle><CardDescription>用于常规受保护页面的访问验证。</CardDescription></div>
            <Badge variant={state.password_a_set ? "default" : "secondary"}>{state.password_a_set ? "已设置" : "未设置"}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordInput id="password-a" label="新密码" value={form.password_a} placeholder="留空表示不修改" hint="至少 8 位，且不能与另一访问凭证相同。" visible={visible} onChange={(value) => patch("password_a", value)} />
            <PasswordInput id="password-a-confirm" label="确认新密码" value={form.password_a_confirmation} placeholder="再次输入新密码" visible={visible} onChange={(value) => patch("password_a_confirmation", value)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle className="text-lg">访问凭证 B</CardTitle><CardDescription>用于需要更高权限的管理操作验证。</CardDescription></div>
            <Badge variant={state.password_b_set ? "default" : "secondary"}>{state.password_b_set ? "已设置" : "未设置"}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <PasswordInput id="password-b" label="新密码" value={form.password_b} placeholder="留空表示不修改" hint="至少 12 位，建议使用随机强密码。" visible={visible} onChange={(value) => patch("password_b", value)} />
            <PasswordInput id="password-b-confirm" label="确认新密码" value={form.password_b_confirmation} placeholder="再次输入新密码" visible={visible} onChange={(value) => patch("password_b_confirmation", value)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div><CardTitle className="text-lg">验证策略</CardTitle><CardDescription>修改凭证后，现有管理员的验证状态会立即失效。</CardDescription></div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff /> : <Eye />}{visible ? "隐藏密码" : "显示密码"}</Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>验证有效时间</Label>
              <Select value={String(form.ttl_minutes)} onValueChange={(value) => patch("ttl_minutes", Number(value))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{[[30, "30 分钟"], [60, "1 小时"], [240, "4 小时"], [480, "8 小时"], [720, "12 小时"], [1440, "24 小时"], [10080, "7 天"]].map(([value, label]) => <SelectItem key={value} value={String(value)}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="current-password">当前访问凭证 B</Label>
              <Input id="current-password" type={visible ? "text" : "password"} value={form.current_password} autoComplete="current-password" placeholder="保存前需要验证" onChange={(event) => patch("current_password", event.target.value)} />
            </div>
          </div>
          <Alert>
            <ShieldCheck />
            <AlertTitle>凭证安全</AlertTitle>
            <AlertDescription>访问凭证只以不可逆哈希保存，页面与接口不会返回原文。</AlertDescription>
          </Alert>
          <div className="flex justify-end"><Button disabled={saving || !form.current_password} onClick={() => void save()}>{saving ? "保存中…" : "保存并应用"}</Button></div>
        </CardContent>
      </Card>
    </div>
  )
}
