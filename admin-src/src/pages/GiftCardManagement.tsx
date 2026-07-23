import { useEffect, useMemo, useState } from "react"
import {
  Copy,
  Download,
  Gift,
  KeyRound,
  LoaderCircle,
  PackagePlus,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { adminApi, authToken, get, getEnvelope, post } from "@/services/http"
import {
  ConfirmAction,
  EmptyState,
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
  type UnknownRecord,
} from "./react-page-helpers"

type TabKey = "templates" | "codes" | "usages"
type EntityId = string | number

interface GiftTemplate extends UnknownRecord {
  id: EntityId
  name: string
  description: string
  type: number
  type_name?: string
  status: boolean
  rewards: UnknownRecord
  conditions: UnknownRecord
  limits: UnknownRecord
  special_config: UnknownRecord
  icon: string
  background_image: string
  theme_color: string
  sort: number
  created_at?: number
}

interface GiftCode extends UnknownRecord {
  id: EntityId
  code: string
  template_id: EntityId
  batch_id: string
  status: number
  status_name?: string
  usage_count: number
  max_usage: number
  expires_at?: number
}

interface GiftUsage extends UnknownRecord {
  id: EntityId
  rewards_given: UnknownRecord
  multiplier_applied: number
  created_at?: number
}

interface PlanRow extends UnknownRecord {
  id: EntityId
  name: string
}

interface PageInfo {
  page: number
  total: number
  last: number
}

interface Pages {
  templates: PageInfo
  codes: PageInfo
  usages: PageInfo
}

interface TemplateForm {
  id: EntityId | null
  name: string
  description: string
  type: number
  status: boolean
  balance_yuan: number
  traffic_gb: number
  device_limit: number
  expire_days: number
  reset_package: boolean
  plan_id: EntityId | ""
  plan_validity_days: number
  invite_reward_percent: number
  new_user_only: boolean
  new_user_max_days: number
  paid_user_only: boolean
  require_invite: boolean
  allowed_plans: EntityId[]
  max_use_per_user: number
  cooldown_hours: number
  advanced: boolean
  rewards_text: string
  conditions_text: string
  limits_text: string
  special_config_text: string
  icon: string
  background_image: string
  theme_color: string
  sort: number
}

interface GenerateForm {
  template_id: EntityId | ""
  count: number
  prefix: string
  expires_hours: number | ""
  max_usage: number
  download: boolean
}

interface CodeFilter {
  template_id: EntityId | ""
  status: string
  batch_id: string
}

interface UsageFilter {
  template_id: EntityId | ""
  user_id: string
}

const PER_PAGE = 15
const GIB = 1_073_741_824
const DEFAULT_TYPES: Record<string, string> = {
  "1": "通用礼品卡",
  "2": "套餐礼品卡",
  "3": "盲盒礼品卡",
}
const CODE_STATUS = ["未使用", "已使用", "已过期", "已禁用"] as const

function objectValue(value: unknown): UnknownRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as UnknownRecord
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as UnknownRecord
        : {}
    } catch {
      return {}
    }
  }
  return {}
}

function booleanValue(value: unknown, fallback = false) {
  if (value == null) return fallback
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true"
  return Boolean(value)
}

function templateForm(): TemplateForm {
  return {
    id: null,
    name: "",
    description: "",
    type: 1,
    status: true,
    balance_yuan: 10,
    traffic_gb: 0,
    device_limit: 0,
    expire_days: 0,
    reset_package: false,
    plan_id: "",
    plan_validity_days: 30,
    invite_reward_percent: 0,
    new_user_only: false,
    new_user_max_days: 7,
    paid_user_only: false,
    require_invite: false,
    allowed_plans: [],
    max_use_per_user: 1,
    cooldown_hours: 0,
    advanced: false,
    rewards_text: "{}",
    conditions_text: "{}",
    limits_text: "{}",
    special_config_text: "{}",
    icon: "🎁",
    background_image: "",
    theme_color: "#1890ff",
    sort: 0,
  }
}

function generateForm(templateId: EntityId | "" = ""): GenerateForm {
  return {
    template_id: templateId,
    count: 10,
    prefix: "GC",
    expires_hours: 720,
    max_usage: 1,
    download: true,
  }
}

function normalizeTemplate(value: unknown): GiftTemplate {
  const item = objectValue(value)
  return {
    ...item,
    id: item.id as EntityId,
    name: String(item.name ?? ""),
    description: String(item.description ?? ""),
    type: Number(item.type || 1),
    type_name: item.type_name ? String(item.type_name) : undefined,
    status: booleanValue(item.status, true),
    rewards: objectValue(item.rewards),
    conditions: objectValue(item.conditions),
    limits: objectValue(item.limits),
    special_config: objectValue(item.special_config),
    icon: String(item.icon || "🎁"),
    background_image: String(item.background_image || ""),
    theme_color: String(item.theme_color || "#1890ff"),
    sort: Number(item.sort || 0),
    created_at: Number(item.created_at || 0),
  }
}

function normalizeCode(value: unknown): GiftCode {
  const item = objectValue(value)
  return {
    ...item,
    id: item.id as EntityId,
    code: String(item.code ?? ""),
    template_id: item.template_id as EntityId,
    batch_id: String(item.batch_id ?? ""),
    status: Number(item.status || 0),
    status_name: item.status_name ? String(item.status_name) : undefined,
    usage_count: Number(item.usage_count || 0),
    max_usage: Number(item.max_usage || 0),
    expires_at: Number(item.expires_at || 0),
  }
}

function normalizeUsage(value: unknown): GiftUsage {
  const item = objectValue(value)
  return {
    ...item,
    id: item.id as EntityId,
    rewards_given: objectValue(item.rewards_given),
    multiplier_applied: Number(item.multiplier_applied || 1),
    created_at: Number(item.created_at || 0),
  }
}

function normalizePlan(value: unknown): PlanRow {
  const item = objectValue(value)
  return {
    ...item,
    id: item.id as EntityId,
    name: String(item.name ?? ""),
  }
}

function normalizePage<T>(
  value: unknown,
  currentPage: number,
  normalizeItem: (item: unknown) => T,
) {
  const root = objectValue(value)
  const source = root.data ?? value
  if (Array.isArray(source)) {
    const items = source.map(normalizeItem)
    return {
      items,
      total: Number(root.total || items.length),
      page: Number(root.current_page || root.current || currentPage),
      last: Number(root.last_page || Math.max(1, Math.ceil(Number(root.total || items.length) / PER_PAGE))),
    }
  }
  const record = objectValue(source)
  const rawItems = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.data)
      ? record.data
      : []
  const items = rawItems.map(normalizeItem)
  const total = Number(record.total || root.total || items.length)
  return {
    items,
    total,
    page: Number(record.current_page || record.current || root.current_page || root.current || currentPage),
    last: Number(record.last_page || root.last_page || Math.max(1, Math.ceil(total / PER_PAGE))),
  }
}

function jsonText(value: unknown) {
  return JSON.stringify(value || {}, null, 2)
}

function formatTime(value: unknown) {
  const seconds = Number(value || 0)
  if (!seconds) return "长期有效"
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime())
    ? "长期有效"
    : date.toLocaleString("zh-CN", { hour12: false })
}

function safeColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#1890ff"
}

function safeImage(value: string) {
  const source = value.trim()
  return source && !/^(javascript|vbscript|data:text\/html):/i.test(source) ? source : ""
}

function rewardSummary(value: unknown) {
  const rewards = objectValue(value)
  const parts: string[] = []
  if (rewards.balance) parts.push("余额 ¥" + (Number(rewards.balance) / 100).toFixed(2))
  if (rewards.transfer_enable) parts.push("流量 " + (Number(rewards.transfer_enable) / GIB).toFixed(2) + " GB")
  if (rewards.expire_days) parts.push("有效期 +" + rewards.expire_days + " 天")
  if (rewards.device_limit) parts.push("设备 +" + rewards.device_limit)
  if (rewards.plan_id) parts.push("套餐 #" + rewards.plan_id + " / " + (rewards.plan_validity_days || 0) + " 天")
  if (rewards.reset_package) parts.push("重置流量")
  if (Array.isArray(rewards.random_rewards)) parts.push(rewards.random_rewards.length + " 个盲盒奖励")
  return parts.join(" · ") || "未配置"
}

function parseObject(text: string, label: string, required = false) {
  let value: unknown
  try {
    value = JSON.parse(text || "{}")
  } catch {
    throw new Error(label + " JSON 格式不正确")
  }
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(label + "必须是" + (required ? "非空" : "") + " JSON 对象")
  }
  const record = value as UnknownRecord
  if (required && !Object.keys(record).length) {
    throw new Error(label + "必须是非空 JSON 对象")
  }
  return record
}

function visualConfig(form: TemplateForm) {
  const rewards: UnknownRecord = {}
  if (Number(form.balance_yuan) > 0) rewards.balance = Math.round(Number(form.balance_yuan) * 100)
  if (Number(form.traffic_gb) > 0) rewards.transfer_enable = Math.round(Number(form.traffic_gb) * GIB)
  if (Number(form.device_limit) > 0) rewards.device_limit = Number(form.device_limit)
  if (Number(form.expire_days) > 0) rewards.expire_days = Number(form.expire_days)
  if (form.reset_package) rewards.reset_package = true
  if (form.plan_id) {
    rewards.plan_id = Number(form.plan_id)
    rewards.plan_validity_days = Number(form.plan_validity_days || 0)
  }
  if (Number(form.invite_reward_percent) > 0) {
    rewards.invite_reward_rate = Number(form.invite_reward_percent) / 100
  }

  const conditions: UnknownRecord = {}
  if (form.new_user_only) {
    conditions.new_user_only = true
    conditions.new_user_max_days = Number(form.new_user_max_days || 7)
  }
  if (form.paid_user_only) conditions.paid_user_only = true
  if (form.require_invite) conditions.require_invite = true
  if (form.allowed_plans.length) conditions.allowed_plans = form.allowed_plans.map(Number)

  const limits: UnknownRecord = {}
  if (Number(form.max_use_per_user) > 0) limits.max_use_per_user = Number(form.max_use_per_user)
  if (Number(form.cooldown_hours) > 0) limits.cooldown_hours = Number(form.cooldown_hours)

  return { rewards, conditions, limits, special_config: {} }
}

function codeTone(status: number): "default" | "neutral" | "warning" {
  if (status === 0) return "default"
  if (status === 1) return "warning"
  return "neutral"
}

export default function GiftCardManagement() {
  const [tab, setTab] = useState<TabKey>("templates")
  const [templates, setTemplates] = useState<GiftTemplate[]>([])
  const [codes, setCodes] = useState<GiftCode[]>([])
  const [usages, setUsages] = useState<GiftUsage[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [types, setTypes] = useState<Record<string, string>>(DEFAULT_TYPES)
  const [stats, setStats] = useState<UnknownRecord>({})
  const [pages, setPages] = useState<Pages>({
    templates: { page: 1, total: 0, last: 1 },
    codes: { page: 1, total: 0, last: 1 },
    usages: { page: 1, total: 0, last: 1 },
  })
  const [templateState, setTemplateState] = useState<TemplateForm>(templateForm)
  const [generateState, setGenerateState] = useState<GenerateForm>(() => generateForm())
  const [codeFilter, setCodeFilter] = useState<CodeFilter>({
    template_id: "",
    status: "all",
    batch_id: "",
  })
  const [usageFilter, setUsageFilter] = useState<UsageFilter>({
    template_id: "",
    user_id: "",
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [showTemplate, setShowTemplate] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)

  async function loadStats() {
    try {
      const data = await get<UnknownRecord>("/gift-card/statistics")
      setStats(objectValue(data?.total_stats))
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function loadTemplates(reset = false, requestedPage?: number) {
    const page = reset ? 1 : requestedPage ?? pages.templates.page
    setLoading(true)
    try {
      const data = await getEnvelope("/gift-card/templates", {
        page,
        per_page: PER_PAGE,
      })
      const normalized = normalizePage(data, page, normalizeTemplate)
      setTemplates(normalized.items)
      setPages((current) => ({
        ...current,
        templates: {
          page: normalized.page,
          total: normalized.total,
          last: normalized.last,
        },
      }))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function loadCodes(
    reset = false,
    requestedPage?: number,
    filters: CodeFilter = codeFilter,
  ) {
    const page = reset ? 1 : requestedPage ?? pages.codes.page
    setLoading(true)
    try {
      const data = await getEnvelope("/gift-card/codes", {
        page,
        per_page: PER_PAGE,
        template_id: filters.template_id || undefined,
        status: filters.status === "all" ? undefined : filters.status,
        batch_id: filters.batch_id || undefined,
      })
      const normalized = normalizePage(data, page, normalizeCode)
      setCodes(normalized.items)
      setPages((current) => ({
        ...current,
        codes: {
          page: normalized.page,
          total: normalized.total,
          last: normalized.last,
        },
      }))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function loadUsages(
    reset = false,
    requestedPage?: number,
    filters: UsageFilter = usageFilter,
  ) {
    const page = reset ? 1 : requestedPage ?? pages.usages.page
    setLoading(true)
    try {
      const data = await getEnvelope("/gift-card/usages", {
        page,
        per_page: PER_PAGE,
        template_id: filters.template_id || undefined,
        user_id: filters.user_id || undefined,
      })
      const normalized = normalizePage(data, page, normalizeUsage)
      setUsages(normalized.items)
      setPages((current) => ({
        ...current,
        usages: {
          page: normalized.page,
          total: normalized.total,
          last: normalized.last,
        },
      }))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        const typeData = await get<UnknownRecord>("/gift-card/types")
        const normalizedTypes = Object.fromEntries(
          Object.entries(objectValue(typeData)).map(([key, value]) => [key, String(value)]),
        )
        if (Object.keys(normalizedTypes).length) setTypes(normalizedTypes)
      } catch {
        // Keep the built-in type labels when the optional endpoint is unavailable.
      }
      try {
        const planData = await get<unknown[]>("/plan/fetch")
        setPlans(Array.isArray(planData) ? planData.map(normalizePlan) : [])
      } catch {
        // Template rewards can still be managed without plan options.
      }
      await Promise.all([loadTemplates(true), loadStats()])
    }
    void initialize()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function switchTab(next: TabKey) {
    setTab(next)
    if (next === "templates") await loadTemplates()
    if (next === "codes") await loadCodes()
    if (next === "usages") await loadUsages()
  }

  function createTemplate() {
    setTemplateState(templateForm())
    setShowTemplate(true)
  }

  function editTemplate(template: GiftTemplate) {
    const rewards = objectValue(template.rewards)
    const conditions = objectValue(template.conditions)
    const limits = objectValue(template.limits)
    setTemplateState({
      ...templateForm(),
      id: template.id,
      name: template.name,
      description: template.description,
      type: Number(template.type || 1),
      status: template.status,
      balance_yuan: Number(rewards.balance || 0) / 100,
      traffic_gb: Number(rewards.transfer_enable || 0) / GIB,
      device_limit: Number(rewards.device_limit || 0),
      expire_days: Number(rewards.expire_days || 0),
      reset_package: Boolean(rewards.reset_package),
      plan_id: (rewards.plan_id as EntityId) || "",
      plan_validity_days: Number(rewards.plan_validity_days || 30),
      invite_reward_percent: Number(rewards.invite_reward_rate || 0) * 100,
      new_user_only: Boolean(conditions.new_user_only),
      new_user_max_days: Number(conditions.new_user_max_days || 7),
      paid_user_only: Boolean(conditions.paid_user_only),
      require_invite: Boolean(conditions.require_invite),
      allowed_plans: Array.isArray(conditions.allowed_plans)
        ? [...conditions.allowed_plans] as EntityId[]
        : [],
      max_use_per_user: Number(limits.max_use_per_user || 1),
      cooldown_hours: Number(limits.cooldown_hours || 0),
      rewards_text: jsonText(rewards),
      conditions_text: jsonText(conditions),
      limits_text: jsonText(limits),
      special_config_text: jsonText(template.special_config),
      icon: template.icon || "🎁",
      background_image: template.background_image || "",
      theme_color: template.theme_color || "#1890ff",
      sort: Number(template.sort || 0),
    })
    setShowTemplate(true)
  }

  async function saveTemplate() {
    setSaving(true)
    try {
      const visual = templateState.advanced ? null : visualConfig(templateState)
      const payload = {
        id: templateState.id || undefined,
        name: templateState.name.trim(),
        description: templateState.description || null,
        type: Number(templateState.type),
        status: Boolean(templateState.status),
        rewards: visual?.rewards || parseObject(templateState.rewards_text, "奖励配置", true),
        conditions: visual?.conditions || parseObject(templateState.conditions_text, "使用条件"),
        limits: visual?.limits || parseObject(templateState.limits_text, "使用限制"),
        special_config: visual?.special_config || parseObject(templateState.special_config_text, "特殊配置"),
        icon: templateState.icon || null,
        background_image: templateState.background_image || null,
        theme_color: templateState.theme_color,
        sort: Number(templateState.sort || 0),
      }
      if (!payload.name) throw new Error("请输入模板名称")
      if (!Object.keys(payload.rewards).length) throw new Error("请至少配置一项奖励")
      await post(
        templateState.id ? "/gift-card/update-template" : "/gift-card/create-template",
        payload,
      )
      toast.success(templateState.id ? "模板已更新" : "模板已创建")
      setShowTemplate(false)
      await Promise.all([loadTemplates(true), loadStats()])
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function toggleTemplate(template: GiftTemplate) {
    const busyKey = "t" + template.id
    setBusy(busyKey)
    try {
      await post("/gift-card/update-template", {
        id: template.id,
        status: !template.status,
      })
      setTemplates((current) => current.map((item) => (
        String(item.id) === String(template.id)
          ? { ...item, status: !template.status }
          : item
      )))
      toast.success("模板状态已更新")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function removeTemplate(template: GiftTemplate) {
    const busyKey = "t" + template.id
    setBusy(busyKey)
    try {
      await post("/gift-card/delete-template", { id: template.id })
      toast.success("模板已删除")
      await Promise.all([loadTemplates(), loadStats()])
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  function startGenerate(template?: GiftTemplate | null) {
    const defaultId = template?.id
      ?? templates.find((item) => item.status)?.id
      ?? ""
    setGenerateState(generateForm(defaultId))
    setShowGenerate(true)
  }

  async function downloadBatch(batch: string) {
    const response = await fetch(
      adminApi("/gift-card/export-codes") + "?batch_id=" + encodeURIComponent(batch),
      {
        headers: {
          Authorization: "Bearer " + authToken().replace(/^Bearer /, ""),
        },
      },
    )
    if (!response.ok) throw new Error("导出失败")
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "gift_cards_" + batch + ".txt"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function exportCurrentBatch() {
    if (!codeFilter.batch_id.trim()) return toast.error("请先输入批次号")
    setBusy("export")
    try {
      await downloadBatch(codeFilter.batch_id.trim())
      toast.success("兑换码已导出")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function generate() {
    if (!generateState.template_id) return toast.error("请选择礼品卡模板")
    if (Number(generateState.count) < 1 || Number(generateState.count) > 10_000) {
      return toast.error("生成数量必须在 1–10000 之间")
    }
    if (!/^[A-Z0-9]*$/.test(generateState.prefix)) {
      return toast.error("前缀只能包含大写字母和数字")
    }
    setSaving(true)
    try {
      const data = await post<UnknownRecord>("/gift-card/generate-codes", {
        template_id: generateState.template_id,
        count: Number(generateState.count),
        prefix: generateState.prefix,
        expires_hours: generateState.expires_hours || undefined,
        max_usage: Number(generateState.max_usage),
      })
      const batchId = String(data?.batch_id || "")
      if (generateState.download && batchId) await downloadBatch(batchId)
      toast.success("已生成 " + Number(data?.count || generateState.count) + " 个兑换码")
      setShowGenerate(false)
      const nextFilter = { ...codeFilter, batch_id: batchId }
      setCodeFilter(nextFilter)
      setTab("codes")
      await Promise.all([loadCodes(true, 1, nextFilter), loadStats()])
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function copyCode(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("兑换码已复制")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复制失败")
    }
  }

  async function toggleCode(code: GiftCode) {
    const enable = Number(code.status) === 3
    const busyKey = "c" + code.id
    setBusy(busyKey)
    try {
      await post("/gift-card/toggle-code", {
        id: code.id,
        action: enable ? "enable" : "disable",
      })
      toast.success(enable ? "兑换码已启用" : "兑换码已禁用")
      await loadCodes()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function removeCode(code: GiftCode) {
    if (Number(code.status) === 1) {
      toast.error("已使用的兑换码不能删除")
      return
    }
    const busyKey = "c" + code.id
    setBusy(busyKey)
    try {
      await post("/gift-card/delete-code", { id: code.id })
      toast.success("兑换码已删除")
      await Promise.all([loadCodes(), loadStats()])
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  function toggleAllowedPlan(planId: EntityId, checked: boolean) {
    setTemplateState((current) => ({
      ...current,
      allowed_plans: checked
        ? current.allowed_plans.some((id) => String(id) === String(planId))
          ? current.allowed_plans
          : [...current.allowed_plans, planId]
        : current.allowed_plans.filter((id) => String(id) !== String(planId)),
    }))
  }

  const typeOptions = useMemo(
    () => Object.entries(types).map(([value, label]) => ({ value, label })),
    [types],
  )
  const activeTemplates = useMemo(
    () => templates.filter((template) => template.status),
    [templates],
  )
  const previewColor = safeColor(templateState.theme_color)
  const previewImage = safeImage(templateState.background_image)
  const previewBackground = previewImage
    ? "linear-gradient(90deg, " + previewColor + "ee, " + previewColor + "aa), url(" + JSON.stringify(previewImage) + ")"
    : "linear-gradient(135deg, " + previewColor + ", " + previewColor + "bb)"

  return (
    <PageShell>
      <PageHeader
        title="礼品卡管理"
        description="管理奖励模板、批量生成兑换码，并审计兑换使用记录。"
        action={(
          <>
            <Button variant="outline" onClick={() => startGenerate()}>
              <KeyRound />
              生成卡密
            </Button>
            <Button onClick={createTemplate}>
              <Plus />
              创建模板
            </Button>
          </>
        )}
      />

      <MetricGrid className="xl:grid-cols-5">
        <MetricCard label="模板总数" value={stats.templates_count || 0} />
        <MetricCard label="启用模板" value={stats.active_templates_count || 0} />
        <MetricCard label="兑换码总数" value={stats.codes_count || 0} />
        <MetricCard label="已使用卡密" value={stats.used_codes_count || 0} />
        <MetricCard label="兑换次数" value={stats.usages_count || 0} />
      </MetricGrid>

      <Tabs value={tab} onValueChange={(value) => void switchTab(value as TabKey)}>
        <TabsList>
          <TabsTrigger value="templates"><Gift />奖励模板</TabsTrigger>
          <TabsTrigger value="codes"><KeyRound />兑换码</TabsTrigger>
          <TabsTrigger value="usages"><Sparkles />使用记录</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "templates" && (
        <>
          {loading ? (
            <Panel><EmptyState>正在加载模板…</EmptyState></Panel>
          ) : !templates.length ? (
            <Panel><EmptyState>暂无礼品卡模板</EmptyState></Panel>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {templates.map((template) => {
                const busyKey = "t" + template.id
                const color = safeColor(template.theme_color)
                return (
                  <Card
                    key={template.id}
                    className="relative border-l-4"
                    style={{ borderLeftColor: color }}
                  >
                    <CardHeader>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl">
                          {template.icon || "🎁"}
                        </span>
                        <div className="min-w-0">
                          <CardDescription>{template.type_name || types[String(template.type)] || "礼品卡模板"}</CardDescription>
                          <CardTitle className="truncate">{template.name}</CardTitle>
                        </div>
                      </div>
                      <StatusBadge tone={template.status ? "default" : "neutral"}>
                        {template.status ? "启用" : "停用"}
                      </StatusBadge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="min-h-10 text-sm text-muted-foreground">
                        {template.description || "暂无模板说明"}
                      </p>
                      <div className="rounded-xl bg-muted/50 p-3">
                        <small className="text-muted-foreground">奖励配置</small>
                        <code className="mt-1 block whitespace-normal text-xs leading-5">
                          {rewardSummary(template.rewards)}
                        </code>
                      </div>
                      <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                        <span>排序 #{template.sort || 0}</span>
                        <span>创建于 {formatTime(template.created_at)}</span>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => startGenerate(template)}>
                          <PackagePlus />
                          生成卡密
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy === busyKey}
                          onClick={() => void toggleTemplate(template)}
                        >
                          {busy === busyKey && <LoaderCircle className="animate-spin" />}
                          {template.status ? "停用" : "启用"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => editTemplate(template)}>
                          编辑
                        </Button>
                        <ConfirmAction
                          title="删除礼品卡模板"
                          description={"确定删除模板「" + template.name + "」？存在关联卡密时后端会阻止删除。"}
                          confirmText="删除模板"
                          disabled={busy === busyKey}
                          onConfirm={() => removeTemplate(template)}
                        >
                          <Trash2 />
                          删除
                        </ConfirmAction>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
          {pages.templates.last > 1 && (
            <Pagination
              current={pages.templates.page}
              last={pages.templates.last}
              total={pages.templates.total}
              loading={loading}
              onChange={(page) => void loadTemplates(false, page)}
            />
          )}
        </>
      )}

      {tab === "codes" && (
        <>
          <Panel>
            <div className="grid gap-3 lg:grid-cols-[180px_150px_minmax(220px,1fr)_auto_auto_auto] lg:items-end">
              <SelectField
                label="模板"
                value={codeFilter.template_id}
                onValueChange={(template_id) => {
                  const next = { ...codeFilter, template_id }
                  setCodeFilter(next)
                  void loadCodes(true, 1, next)
                }}
                options={[
                  { value: "", label: "全部模板" },
                  ...templates.map((template) => ({ value: template.id, label: template.name })),
                ]}
              />
              <SelectField
                label="状态"
                value={codeFilter.status}
                onValueChange={(status) => {
                  const next = { ...codeFilter, status: status || "all" }
                  setCodeFilter(next)
                  void loadCodes(true, 1, next)
                }}
                options={[
                  { value: "all", label: "全部状态" },
                  { value: "0", label: "未使用" },
                  { value: "1", label: "已使用" },
                  { value: "2", label: "已过期" },
                  { value: "3", label: "已禁用" },
                ]}
              />
              <div className="grid gap-2">
                <Label htmlFor="gift-batch-filter">批次号</Label>
                <Input
                  id="gift-batch-filter"
                  value={codeFilter.batch_id}
                  onChange={(event) => setCodeFilter((current) => ({ ...current, batch_id: event.target.value }))}
                  onKeyDown={(event) => event.key === "Enter" && void loadCodes(true)}
                  placeholder="batch_..."
                />
              </div>
              <Button variant="outline" onClick={() => void loadCodes(true)}>
                <Search />
                查询
              </Button>
              <Button
                variant="outline"
                disabled={!codeFilter.batch_id.trim() || busy === "export"}
                onClick={() => void exportCurrentBatch()}
              >
                {busy === "export" ? <LoaderCircle className="animate-spin" /> : <Download />}
                导出批次
              </Button>
              <Button onClick={() => startGenerate()}>
                <Plus />
                生成卡密
              </Button>
            </div>
          </Panel>

          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>兑换码</TableHead>
                    <TableHead>模板 / 批次</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>使用次数</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>使用用户</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7}><EmptyState>正在加载兑换码…</EmptyState></TableCell></TableRow>
                  ) : !codes.length ? (
                    <TableRow><TableCell colSpan={7}><EmptyState>暂无兑换码</EmptyState></TableCell></TableRow>
                  ) : codes.map((code) => {
                    const busyKey = "c" + code.id
                    const template = objectValue(code.template)
                    const user = objectValue(code.user)
                    return (
                      <TableRow key={code.id}>
                        <TableCell>
                          <Button variant="link" className="h-auto p-0 font-mono" onClick={() => void copyCode(code.code)}>
                            {code.code}
                            <Copy />
                          </Button>
                          <small className="block text-muted-foreground">#{code.id}</small>
                        </TableCell>
                        <TableCell>
                          <span className="block">{template.name || code.template_name || "模板 #" + code.template_id}</span>
                          <small className="text-muted-foreground">{code.batch_id}</small>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={codeTone(code.status)}>
                            {code.status_name || CODE_STATUS[code.status] || "未知状态"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{code.usage_count || 0} / {code.max_usage}</TableCell>
                        <TableCell>{formatTime(code.expires_at)}</TableCell>
                        <TableCell>{user.email || code.user_email || "—"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {[0, 3].includes(Number(code.status)) && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy === busyKey}
                                onClick={() => void toggleCode(code)}
                              >
                                {busy === busyKey && <LoaderCircle className="animate-spin" />}
                                {Number(code.status) === 3 ? "启用" : "禁用"}
                              </Button>
                            )}
                            <ConfirmAction
                              title="删除兑换码"
                              description={"确定删除兑换码 " + code.code + "？"}
                              confirmText="删除兑换码"
                              disabled={Number(code.status) === 1 || busy === busyKey}
                              onConfirm={() => removeCode(code)}
                            >
                              <Trash2 />
                              删除
                            </ConfirmAction>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Pagination
            current={pages.codes.page}
            last={pages.codes.last}
            total={pages.codes.total}
            loading={loading}
            onChange={(page) => void loadCodes(false, page)}
          />
        </>
      )}

      {tab === "usages" && (
        <>
          <Panel>
            <div className="grid gap-3 lg:grid-cols-[220px_minmax(220px,1fr)_auto] lg:items-end">
              <SelectField
                label="模板"
                value={usageFilter.template_id}
                onValueChange={(template_id) => {
                  const next = { ...usageFilter, template_id }
                  setUsageFilter(next)
                  void loadUsages(true, 1, next)
                }}
                options={[
                  { value: "", label: "全部模板" },
                  ...templates.map((template) => ({ value: template.id, label: template.name })),
                ]}
              />
              <div className="grid gap-2">
                <Label htmlFor="gift-usage-user">用户 ID</Label>
                <Input
                  id="gift-usage-user"
                  type="number"
                  value={usageFilter.user_id}
                  onChange={(event) => setUsageFilter((current) => ({ ...current, user_id: event.target.value }))}
                  onKeyDown={(event) => event.key === "Enter" && void loadUsages(true)}
                  placeholder="输入用户 ID"
                />
              </div>
              <Button variant="outline" onClick={() => void loadUsages(true)}>
                <Search />
                查询
              </Button>
            </div>
          </Panel>

          <Card>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>兑换码</TableHead>
                    <TableHead>模板</TableHead>
                    <TableHead>使用用户</TableHead>
                    <TableHead>邀请用户</TableHead>
                    <TableHead>奖励</TableHead>
                    <TableHead>倍率</TableHead>
                    <TableHead>兑换时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7}><EmptyState>正在加载使用记录…</EmptyState></TableCell></TableRow>
                  ) : !usages.length ? (
                    <TableRow><TableCell colSpan={7}><EmptyState>暂无使用记录</EmptyState></TableCell></TableRow>
                  ) : usages.map((usage) => {
                    const code = objectValue(usage.code)
                    const template = objectValue(usage.template)
                    const user = objectValue(usage.user)
                    return (
                      <TableRow key={usage.id}>
                        <TableCell><code>{code.code || usage.code}</code></TableCell>
                        <TableCell>{template.name || usage.template_name || "—"}</TableCell>
                        <TableCell>{user.email || usage.user_email || "—"}</TableCell>
                        <TableCell>{usage.invite_user_email || "—"}</TableCell>
                        <TableCell className="max-w-80 whitespace-normal">
                          <code className="text-xs">{rewardSummary(usage.rewards_given)}</code>
                        </TableCell>
                        <TableCell>{usage.multiplier_applied || 1}×</TableCell>
                        <TableCell>{formatTime(usage.created_at)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Pagination
            current={pages.usages.page}
            last={pages.usages.last}
            total={pages.usages.total}
            loading={loading}
            onChange={(page) => void loadUsages(false, page)}
          />
        </>
      )}

      <PageDialog
        open={showTemplate}
        onOpenChange={setShowTemplate}
        title={templateState.id ? "编辑礼品卡模板" : "创建礼品卡模板"}
        description="可视化配置常用奖励；盲盒等复杂规则可切换高级 JSON。"
        className="sm:max-w-6xl"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowTemplate(false)}>取消</Button>
            <Button disabled={saving} onClick={() => void saveTemplate()}>
              {saving && <LoaderCircle className="animate-spin" />}
              {saving ? "保存中…" : "保存模板"}
            </Button>
          </>
        )}
      >
        <div className="space-y-6">
          <div
            className="flex min-h-36 items-center gap-4 rounded-2xl bg-cover bg-center p-6 text-white shadow-lg"
            style={{ backgroundImage: previewBackground }}
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-3xl backdrop-blur">
              {templateState.icon || "🎁"}
            </span>
            <div className="min-w-0">
              <small className="text-white/75">{types[String(templateState.type)]}</small>
              <strong className="mt-1 block truncate text-2xl">{templateState.name || "礼品卡模板预览"}</strong>
              <p className="mt-1 text-sm text-white/80">{templateState.description || "填写模板说明后将在这里预览"}</p>
            </div>
          </div>

          <section className="space-y-4">
            <div>
              <h3 className="font-medium">模板资料</h3>
              <p className="text-sm text-muted-foreground">配置名称、视觉样式、模板类型和启用状态。</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="gift-template-name">模板名称 *</Label>
                <Input
                  id="gift-template-name"
                  value={templateState.name}
                  maxLength={255}
                  onChange={(event) => setTemplateState((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <SelectField
                label="模板类型 *"
                value={templateState.type}
                onValueChange={(type) => setTemplateState((current) => ({ ...current, type: Number(type) }))}
                options={typeOptions}
              />
              <div className="grid gap-2">
                <Label htmlFor="gift-template-icon">图标</Label>
                <Input
                  id="gift-template-icon"
                  value={templateState.icon}
                  onChange={(event) => setTemplateState((current) => ({ ...current, icon: event.target.value }))}
                  placeholder="例如 🎁"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gift-template-color">主题颜色</Label>
                <Input
                  id="gift-template-color"
                  type="color"
                  value={safeColor(templateState.theme_color)}
                  onChange={(event) => setTemplateState((current) => ({ ...current, theme_color: event.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gift-template-sort">排序</Label>
                <Input
                  id="gift-template-sort"
                  type="number"
                  min={0}
                  value={templateState.sort}
                  onChange={(event) => setTemplateState((current) => ({ ...current, sort: Number(event.target.value) }))}
                />
              </div>
              <label className="flex items-center gap-3 self-end rounded-lg border p-3 text-sm">
                <Switch
                  checked={templateState.status}
                  onCheckedChange={(status) => setTemplateState((current) => ({ ...current, status }))}
                />
                <span><strong className="block">模板状态</strong><small className="text-muted-foreground">{templateState.status ? "已启用" : "已停用"}</small></span>
              </label>
              <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="gift-template-description">模板说明</Label>
                <Textarea
                  id="gift-template-description"
                  value={templateState.description}
                  rows={3}
                  onChange={(event) => setTemplateState((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="gift-template-background">背景图片 URL</Label>
                <Input
                  id="gift-template-background"
                  type="url"
                  value={templateState.background_image}
                  onChange={(event) => setTemplateState((current) => ({ ...current, background_image: event.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">奖励与使用规则</h3>
                <p className="text-sm text-muted-foreground">
                  {templateState.advanced ? "直接编辑后端支持的完整 JSON 配置。" : "使用常用字段可视化生成奖励配置。"}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setTemplateState((current) => ({ ...current, advanced: !current.advanced }))}
              >
                {templateState.advanced ? "返回可视化配置" : "高级 JSON"}
              </Button>
            </div>

            {!templateState.advanced ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">兑换奖励（至少一项）</h4>
                  <div className="grid gap-4 rounded-xl bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    {([
                      ["余额奖励（元）", "balance_yuan", 0.01],
                      ["流量奖励（GB）", "traffic_gb", 0.01],
                      ["设备数增加", "device_limit", 1],
                      ["订阅有效期增加（天）", "expire_days", 1],
                    ] as const).map(([label, field, step]) => (
                      <div key={String(field)} className="grid gap-2">
                        <Label>{label}</Label>
                        <Input
                          type="number"
                          min={0}
                          step={Number(step)}
                          value={templateState[field as "balance_yuan" | "traffic_gb" | "device_limit" | "expire_days"]}
                          onChange={(event) => setTemplateState((current) => ({
                            ...current,
                            [field]: Number(event.target.value),
                          }))}
                        />
                      </div>
                    ))}
                    <SelectField
                      label="赠送套餐"
                      value={templateState.plan_id}
                      onValueChange={(plan_id) => setTemplateState((current) => ({ ...current, plan_id }))}
                      options={[
                        { value: "", label: "不赠送套餐" },
                        ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
                      ]}
                    />
                    {templateState.plan_id && (
                      <div className="grid gap-2">
                        <Label>套餐有效期（天）</Label>
                        <Input
                          type="number"
                          min={1}
                          value={templateState.plan_validity_days}
                          onChange={(event) => setTemplateState((current) => ({
                            ...current,
                            plan_validity_days: Number(event.target.value),
                          }))}
                        />
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label>邀请人奖励比例（%）</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={templateState.invite_reward_percent}
                        onChange={(event) => setTemplateState((current) => ({
                          ...current,
                          invite_reward_percent: Number(event.target.value),
                        }))}
                      />
                    </div>
                    <label className="flex items-center gap-3 self-end rounded-lg border bg-background p-3 text-sm">
                      <Switch
                        checked={templateState.reset_package}
                        onCheckedChange={(reset_package) => setTemplateState((current) => ({ ...current, reset_package }))}
                      />
                      <span><strong className="block">重置套餐流量</strong><small className="text-muted-foreground">{templateState.reset_package ? "兑换时重置" : "不重置流量"}</small></span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">领取条件</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <Switch
                        checked={templateState.new_user_only}
                        onCheckedChange={(new_user_only) => setTemplateState((current) => ({ ...current, new_user_only }))}
                      />
                      <span><strong className="block">仅限新用户</strong><small className="text-muted-foreground">{templateState.new_user_only ? "启用限制" : "不限用户"}</small></span>
                    </label>
                    {templateState.new_user_only && (
                      <div className="grid gap-2">
                        <Label>注册不超过（天）</Label>
                        <Input
                          type="number"
                          min={1}
                          value={templateState.new_user_max_days}
                          onChange={(event) => setTemplateState((current) => ({
                            ...current,
                            new_user_max_days: Number(event.target.value),
                          }))}
                        />
                      </div>
                    )}
                    <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <Switch
                        checked={templateState.paid_user_only}
                        onCheckedChange={(paid_user_only) => setTemplateState((current) => ({ ...current, paid_user_only }))}
                      />
                      <span><strong className="block">仅限付费用户</strong><small className="text-muted-foreground">{templateState.paid_user_only ? "启用限制" : "不限付费状态"}</small></span>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <Switch
                        checked={templateState.require_invite}
                        onCheckedChange={(require_invite) => setTemplateState((current) => ({ ...current, require_invite }))}
                      />
                      <span><strong className="block">必须存在邀请人</strong><small className="text-muted-foreground">{templateState.require_invite ? "启用限制" : "无需邀请人"}</small></span>
                    </label>
                  </div>
                  <div className="grid gap-2">
                    <Label>允许领取的当前套餐</Label>
                    <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {plans.length ? plans.map((plan) => {
                        const checked = templateState.allowed_plans.some(
                          (id) => String(id) === String(plan.id),
                        )
                        return (
                          <label key={plan.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleAllowedPlan(plan.id, Boolean(value))}
                            />
                            {plan.name}
                          </label>
                        )
                      }) : <span className="text-sm text-muted-foreground">暂无套餐</span>}
                    </div>
                    <small className="text-muted-foreground">不选择表示不限制当前套餐。</small>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">频率限制</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>每用户最大兑换次数</Label>
                      <Input
                        type="number"
                        min={1}
                        value={templateState.max_use_per_user}
                        onChange={(event) => setTemplateState((current) => ({
                          ...current,
                          max_use_per_user: Number(event.target.value),
                        }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>两次兑换冷却（小时）</Label>
                      <Input
                        type="number"
                        min={0}
                        value={templateState.cooldown_hours}
                        onChange={(event) => setTemplateState((current) => ({
                          ...current,
                          cooldown_hours: Number(event.target.value),
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {([
                  ["奖励配置 *", "支持 random_rewards 等高级规则", "rewards_text"],
                  ["使用条件", "", "conditions_text"],
                  ["使用限制", "", "limits_text"],
                  ["特殊配置", "", "special_config_text"],
                ] as const).map(([label, hint, field]) => (
                  <div key={field} className="grid gap-2">
                    <Label>{label} {hint && <small className="font-normal text-muted-foreground">{hint}</small>}</Label>
                    <Textarea
                      className="min-h-44 font-mono text-xs"
                      value={templateState[field as "rewards_text" | "conditions_text" | "limits_text" | "special_config_text"]}
                      onChange={(event) => setTemplateState((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </PageDialog>

      <PageDialog
        open={showGenerate}
        onOpenChange={setShowGenerate}
        title="批量生成兑换码"
        description="单次最多 10,000 个，生成后可自动导出文本文件。"
        className="sm:max-w-2xl"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>取消</Button>
            <Button disabled={saving} onClick={() => void generate()}>
              {saving && <LoaderCircle className="animate-spin" />}
              {saving ? "生成中…" : "生成兑换码"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            className="sm:col-span-2"
            label="礼品卡模板 *"
            value={generateState.template_id}
            onValueChange={(template_id) => setGenerateState((current) => ({ ...current, template_id }))}
            options={[
              { value: "", label: "请选择启用模板" },
              ...activeTemplates.map((template) => ({ value: template.id, label: template.name })),
            ]}
          />
          <div className="grid gap-2">
            <Label htmlFor="gift-generate-count">生成数量 *</Label>
            <Input
              id="gift-generate-count"
              type="number"
              min={1}
              max={10_000}
              value={generateState.count}
              onChange={(event) => setGenerateState((current) => ({ ...current, count: Number(event.target.value) }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gift-generate-prefix">卡密前缀</Label>
            <Input
              id="gift-generate-prefix"
              value={generateState.prefix}
              maxLength={10}
              onChange={(event) => setGenerateState((current) => ({ ...current, prefix: event.target.value.trim() }))}
              placeholder="GC"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gift-generate-expiry">有效期（小时）</Label>
            <Input
              id="gift-generate-expiry"
              type="number"
              min={1}
              value={generateState.expires_hours}
              onChange={(event) => setGenerateState((current) => ({
                ...current,
                expires_hours: event.target.value === "" ? "" : Number(event.target.value),
              }))}
              placeholder="留空长期有效"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gift-generate-max-use">最大使用次数</Label>
            <Input
              id="gift-generate-max-use"
              type="number"
              min={1}
              max={1000}
              value={generateState.max_usage}
              onChange={(event) => setGenerateState((current) => ({ ...current, max_usage: Number(event.target.value) }))}
            />
          </div>
          <label className="flex items-center gap-3 rounded-lg border p-3 text-sm sm:col-span-2">
            <Switch
              checked={generateState.download}
              onCheckedChange={(download) => setGenerateState((current) => ({ ...current, download }))}
            />
            <span><strong className="block">生成后自动下载</strong><small className="text-muted-foreground">导出本批次全部兑换码 TXT 文件。</small></span>
          </label>
        </div>
      </PageDialog>
    </PageShell>
  )
}
