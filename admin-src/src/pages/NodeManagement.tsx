import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { get, post } from "@/services/http"
import {
  EmptyState,
  FormField,
  MetricCard,
  MetricGrid,
  PageDialog,
  PageHeader,
  PageShell,
  Panel,
  SelectField,
  errorMessage,
  formatBytes,
} from "./react-page-helpers"

const TYPES = [
  "hysteria",
  "vless",
  "trojan",
  "vmess",
  "tuic",
  "shadowsocks",
  "anytls",
  "socks",
  "naive",
  "http",
  "mieru",
] as const

type NodeType = (typeof TYPES)[number]
type BatchAction = "show" | "hide" | "enable" | "disable" | "reset" | "delete"
type NodeAction = "copy" | "reset" | "delete"

interface Relation {
  id: number
  name: string
}

interface RouteRelation {
  id: number
  remarks?: string
}

interface FlagDefinition {
  name?: string
  value?: string
  remark?: string
  names?: Record<string, string>
}

interface NodeRow {
  id: number
  type: string
  name: string
  host: string
  port: number
  server_port: number
  rate: number
  show: number | boolean
  enabled: number | boolean
  is_online?: number | boolean
  machine_id?: number | null
  parent_id?: number | null
  group_ids?: number[]
  route_ids?: number[]
  tags?: string[]
  transfer_enable?: number
  protocol_settings?: Record<string, unknown>
  u?: number
  d?: number
  parent?: Relation | null
  groups?: Relation[]
}

interface NodeForm {
  id: number | null
  type: NodeType
  name: string
  host: string
  port: number
  server_port: number
  rate: number
  show: boolean
  enabled: boolean
  machine_id: number | null
  parent_id: number | null
  group_ids: number[]
  route_ids: number[]
  tags: string[]
  transfer_enable: number
  protocol_settings: Record<string, unknown>
}

interface MultiSelectOption {
  value: number
  label: string
}

const BATCH_LABELS: Record<BatchAction, string> = {
  show: "批量上架",
  hide: "批量下架",
  enable: "批量启用运行",
  disable: "批量停用运行",
  reset: "批量清零流量",
  delete: "批量删除",
}

const ACTION_COPY: Record<NodeAction, { title: string; verb: string; description: (node: NodeRow) => string }> = {
  copy: {
    title: "复制节点",
    verb: "确认复制",
    description: (node) => `复制节点「${node.name}」？副本默认下架。`,
  },
  reset: {
    title: "清零节点流量",
    verb: "确认清零",
    description: (node) => `确定清零「${node.name}」的上下行流量？`,
  },
  delete: {
    title: "删除节点",
    verb: "删除节点",
    description: (node) => `确定删除节点「${node.name}」？此操作无法撤销。`,
  },
}

function protocolDefaults(type: string): Record<string, unknown> {
  return (
    {
      shadowsocks: { cipher: "2022-blake3-aes-128-gcm" },
      vmess: { tls: 1, network: "tcp" },
      trojan: { tls: 1, network: "tcp" },
      hysteria: { version: 2 },
      vless: { tls: 1, network: "tcp" },
      socks: { tls: 0 },
      naive: { tls: 1 },
      http: { tls: 1 },
      tuic: { version: 5 },
      mieru: { transport: "TCP", traffic_pattern: "" },
      anytls: {},
    } as Record<string, Record<string, unknown>>
  )[type] ?? {}
}

function blankForm(): NodeForm {
  return {
    id: null,
    type: "vless",
    name: "",
    host: "",
    port: 443,
    server_port: 443,
    rate: 1,
    show: true,
    enabled: true,
    machine_id: null,
    parent_id: null,
    group_ids: [],
    route_ids: [],
    tags: [],
    transfer_enable: 0,
    protocol_settings: protocolDefaults("vless"),
  }
}

function isOn(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true"
}

function numberList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : []
}

function normalizeNodes(value: unknown): NodeRow[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = item as Partial<NodeRow>
    return {
      ...row,
      id: Number(row.id),
      type: String(row.type || "vless"),
      name: String(row.name || ""),
      host: String(row.host || ""),
      port: Number(row.port || 0),
      server_port: Number(row.server_port || 0),
      rate: Number(row.rate ?? 1),
      show: row.show ?? 0,
      enabled: row.enabled ?? false,
      group_ids: numberList(row.group_ids),
      route_ids: numberList(row.route_ids),
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      groups: Array.isArray(row.groups) ? row.groups : [],
    }
  })
}

function MultiSelectField({
  label,
  values,
  options,
  placeholder,
  onChange,
}: {
  label: string
  values: number[]
  options: MultiSelectOption[]
  placeholder: string
  onChange: (values: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedOptions = options.filter((option) => values.includes(option.value))

  const toggle = (value: number) => {
    onChange(values.includes(value) ? values.filter((current) => current !== value) : [...values, value])
  }

  return (
    <FormField label={label}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-8 w-full justify-between px-2.5 text-left font-normal"
              aria-expanded={open}
            />
          }
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selectedOptions.length ? (
              selectedOptions.slice(0, 3).map((option) => (
                <Badge key={option.value} variant="secondary" className="max-w-28 truncate">
                  {option.label}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {selectedOptions.length > 3 ? <Badge variant="secondary">+{selectedOptions.length - 3}</Badge> : null}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(22rem,var(--available-width))] p-0">
          <Command>
            <CommandInput placeholder={`搜索${label}`} />
            <CommandList>
              <CommandEmpty>没有可选项目</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const checked = values.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.value}`}
                      data-checked={checked}
                      onSelect={() => toggle(option.value)}
                    >
                      <Checkbox checked={checked} className="pointer-events-none" tabIndex={-1} />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FormField>
  )
}

export default function NodeManagement() {
  const [nodes, setNodes] = useState<NodeRow[]>([])
  const [groups, setGroups] = useState<Relation[]>([])
  const [routes, setRoutes] = useState<RouteRelation[]>([])
  const [machines, setMachines] = useState<Relation[]>([])
  const [flags, setFlags] = useState<FlagDefinition[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [keyword, setKeyword] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sorting, setSorting] = useState(false)
  const [sortDirty, setSortDirty] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [protocolJson, setProtocolJson] = useState("{}")
  const [protocolError, setProtocolError] = useState("")
  const [form, setForm] = useState<NodeForm>(blankForm)
  const [pendingAction, setPendingAction] = useState<{ kind: NodeAction; node: NodeRow } | null>(null)
  const [pendingBatch, setPendingBatch] = useState<BatchAction | null>(null)
  const flagCache = useRef(new Map<string, string | null>())
  const loadedFlags = useRef<FlagDefinition[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nodeData, groupData, routeData, machineData, flagData] = await Promise.all([
        get("/server/manage/getNodes"),
        get("/server/group/fetch"),
        get("/server/route/fetch"),
        get("/server/machine/fetch"),
        loadedFlags.current.length
          ? Promise.resolve(loadedFlags.current)
          : fetch("/flags/flags.json").then((response) => (response.ok ? response.json() : [])),
      ])
      const nextNodes = normalizeNodes(nodeData)
      setNodes(nextNodes)
      setGroups(Array.isArray(groupData) ? (groupData as Relation[]) : [])
      setRoutes(Array.isArray(routeData) ? (routeData as RouteRelation[]) : [])
      setMachines(Array.isArray(machineData) ? (machineData as Relation[]) : [])
      const nextFlags = Array.isArray(flagData) ? (flagData as FlagDefinition[]) : []
      loadedFlags.current = nextFlags
      setFlags(nextFlags)
      flagCache.current.clear()
      setSelected((current) => current.filter((id) => nextNodes.some((node) => node.id === id)))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = keyword.trim().toLocaleLowerCase()
    return nodes.filter((item) => {
      const matchesSearch = !term || `${item.name} ${item.host} ${item.type}`.toLocaleLowerCase().includes(term)
      const matchesType = !typeFilter || item.type === typeFilter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "online"
          ? isOn(item.is_online)
          : statusFilter === "visible"
            ? isOn(item.show)
            : !isOn(item.enabled))
      return matchesSearch && matchesType && matchesStatus
    })
  }, [keyword, nodes, statusFilter, typeFilter])

  const displayed = sorting ? nodes : filtered
  const allSelected = displayed.length > 0 && displayed.every((item) => selected.includes(item.id))
  const stats = useMemo(
    () => ({
      total: nodes.length,
      online: nodes.filter((item) => isOn(item.is_online)).length,
      visible: nodes.filter((item) => isOn(item.show)).length,
      traffic: nodes.reduce((sum, item) => sum + Number(item.u || 0) + Number(item.d || 0), 0),
    }),
    [nodes],
  )

  const flagForName = useCallback(
    (name: string) => {
      if (flagCache.current.has(name)) return flagCache.current.get(name) ?? null
      const text = String(name || "").toLocaleLowerCase()
      let best: { length: number; file: string } | null = null

      for (const flag of flags) {
        const file = String(flag.value || "")
        const code = file.replace(/\.png$/i, "")
        const aliases: unknown[] = [flag.name, ...Object.values(flag.names || {})]
        try {
          const parsed = JSON.parse(flag.remark || "{}") as { name?: unknown[] }
          aliases.push(...(Array.isArray(parsed.name) ? parsed.name : []))
        } catch {
          // A malformed optional remark must not block the remaining flag aliases.
        }

        for (const alias of new Set(aliases.filter(Boolean))) {
          const candidate = String(alias).toLocaleLowerCase()
          const isCode = candidate.length === 2 && candidate.toUpperCase() === code.toUpperCase()
          const matched = isCode
            ? new RegExp(`(?:^|[^a-z0-9])${candidate}(?=$|[^a-z0-9])`, "iu").test(text)
            : text.includes(candidate)
          if (matched && file && (!best || candidate.length > best.length)) {
            best = { length: candidate.length, file }
          }
        }
      }

      const result = best?.file ?? null
      flagCache.current.set(name, result)
      return result
    },
    [flags],
  )

  const createNode = () => {
    const next = blankForm()
    setForm(next)
    setProtocolJson(JSON.stringify(next.protocol_settings, null, 2))
    setProtocolError("")
    setAdvanced(false)
    setShowForm(true)
  }

  const editNode = (item: NodeRow) => {
    const type = (TYPES.includes(item.type as NodeType) ? item.type : "vless") as NodeType
    const groupIds = item.group_ids?.length ? item.group_ids : (item.groups || []).map((group) => Number(group.id))
    const next: NodeForm = {
      ...blankForm(),
      id: item.id,
      type,
      name: item.name,
      host: item.host,
      port: Number(item.port),
      server_port: Number(item.server_port),
      rate: Number(item.rate ?? 1),
      show: isOn(item.show),
      enabled: isOn(item.enabled),
      machine_id: item.machine_id ? Number(item.machine_id) : null,
      parent_id: item.parent_id ? Number(item.parent_id) : null,
      group_ids: [...groupIds],
      route_ids: [...(item.route_ids || [])],
      tags: [...(item.tags || [])],
      transfer_enable: Number(item.transfer_enable || 0),
      protocol_settings: item.protocol_settings || protocolDefaults(type),
    }
    setForm(next)
    setProtocolJson(JSON.stringify(next.protocol_settings, null, 2))
    setProtocolError("")
    setAdvanced(false)
    setShowForm(true)
  }

  const closeForm = () => {
    setAdvanced(false)
    setShowForm(false)
    setForm(blankForm())
    setProtocolError("")
  }

  const changeType = (type: string) => {
    const nextType = type as NodeType
    const protocolSettings = protocolDefaults(nextType)
    setForm((current) => ({ ...current, type: nextType, protocol_settings: protocolSettings }))
    setProtocolJson(JSON.stringify(protocolSettings, null, 2))
    setProtocolError("")
  }

  const formatProtocol = () => {
    try {
      setProtocolJson(JSON.stringify(JSON.parse(protocolJson || "{}"), null, 2))
      setProtocolError("")
    } catch {
      setProtocolError("JSON 格式有误，请检查括号、引号和逗号。")
    }
  }

  const resetProtocol = () => {
    setProtocolJson(JSON.stringify(protocolDefaults(form.type), null, 2))
    setProtocolError("")
  }

  const applyProtocol = () => {
    try {
      const settings = JSON.parse(protocolJson || "{}") as Record<string, unknown>
      setForm((current) => ({ ...current, protocol_settings: settings }))
      setProtocolJson(JSON.stringify(settings, null, 2))
      setProtocolError("")
      setAdvanced(false)
      toast.success("高级协议参数已应用，请保存节点使其生效")
    } catch {
      setProtocolError("JSON 格式有误，请检查括号、引号和逗号。")
    }
  }

  const save = async () => {
    if (!form.name.trim() || !form.host.trim() || !form.port || !form.server_port) {
      toast.error("名称、地址和端口不能为空")
      return
    }

    let protocol: Record<string, unknown>
    try {
      protocol = JSON.parse(protocolJson || "{}") as Record<string, unknown>
    } catch {
      setProtocolError("JSON 格式有误，请检查括号、引号和逗号。")
      setAdvanced(true)
      toast.error("高级协议参数格式有误")
      return
    }

    setSaving(true)
    try {
      await post("/server/manage/save", {
        ...form,
        machine_id: form.machine_id || null,
        parent_id: form.parent_id || null,
        show: Number(form.show),
        enabled: Boolean(form.enabled),
        protocol_settings: protocol,
      })
      toast.success(form.id ? "节点已更新" : "节点已创建")
      closeForm()
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const quickUpdate = async (item: NodeRow, field: "show" | "enabled", value: number | boolean) => {
    setBusyId(item.id)
    try {
      await post("/server/manage/update", { id: item.id, [field]: value })
      setNodes((current) => current.map((node) => (node.id === item.id ? { ...node, [field]: value } : node)))
      toast.success(
        field === "show"
          ? value
            ? "节点已上架"
            : "节点已下架"
          : value
            ? "节点运行已启用"
            : "节点运行已停用",
      )
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const runNodeAction = async () => {
    if (!pendingAction) return
    const { kind, node } = pendingAction
    setBusyId(node.id)
    try {
      if (kind === "copy") await post("/server/manage/copy", { id: node.id })
      if (kind === "reset") await post("/server/manage/resetTraffic", { id: node.id })
      if (kind === "delete") await post("/server/manage/drop", { id: node.id })
      toast.success(kind === "copy" ? "节点已复制" : kind === "reset" ? "节点流量已清零" : "节点已删除")
      setPendingAction(null)
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const toggleAll = () => {
    const ids = displayed.map((item) => item.id)
    setSelected((current) =>
      allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])],
    )
  }

  const toggleSelected = (id: number) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const runBatch = async () => {
    if (!pendingBatch || !selected.length) return
    const action = pendingBatch
    setSaving(true)
    try {
      if (action === "delete") {
        await post("/server/manage/batchDelete", { ids: selected })
      } else if (action === "reset") {
        await post("/server/manage/batchResetTraffic", { ids: selected })
      } else {
        await post("/server/manage/batchUpdate", {
          ids: selected,
          ...(action === "show" || action === "hide"
            ? { show: action === "show" ? 1 : 0 }
            : { enabled: action === "enable" }),
        })
      }
      toast.success(`${BATCH_LABELS[action]}成功`)
      setSelected([])
      setPendingBatch(null)
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const enterSorting = () => {
    setSorting((current) => !current)
    setSortDirty(false)
    if (!sorting) {
      setKeyword("")
      setTypeFilter("")
      setStatusFilter("all")
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= nodes.length) return
    setNodes((current) => {
      const next = [...current]
      const sourceNode = next[index]
      const targetNode = next[target]
      if (!sourceNode || !targetNode) return current
      next[index] = targetNode
      next[target] = sourceNode
      return next
    })
    setSortDirty(true)
  }

  const saveSort = async () => {
    setSaving(true)
    try {
      await post(
        "/server/manage/sort",
        nodes.map((item, index) => ({ id: item.id, order: index + 1 })),
      )
      setSorting(false)
      setSortDirty(false)
      toast.success("节点排序已保存")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const groupOptions = groups.map((group) => ({ value: Number(group.id), label: String(group.name) }))
  const routeOptions = routes.map((route) => ({
    value: Number(route.id),
    label: String(route.remarks || `路由 #${route.id}`),
  }))
  const pendingCopy = pendingAction ? ACTION_COPY[pendingAction.kind] : null

  return (
    <PageShell>
      <PageHeader
        title="节点管理"
        description="统一管理节点协议、入口参数、权限、机器绑定和运行状态。"
        action={
          <Button onClick={createNode}>
            <Plus />
            添加节点
          </Button>
        }
      />

      <MetricGrid>
        <MetricCard label="节点总数" value={stats.total} />
        <MetricCard label="在线节点" value={stats.online} />
        <MetricCard label="已上架" value={stats.visible} />
        <MetricCard label="累计流量" value={formatBytes(stats.traffic)} />
      </MetricGrid>

      <Panel>
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto] lg:items-end">
          <FormField label="搜索">
            <Input
              value={keyword}
              disabled={sorting}
              placeholder="节点名称、地址或协议"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </FormField>
          <SelectField
            label="协议"
            value={typeFilter}
            disabled={sorting}
            onValueChange={setTypeFilter}
            options={[{ value: "", label: "全部协议" }, ...TYPES.map((type) => ({ value: type, label: type }))]}
          />
          <SelectField
            label="状态"
            value={statusFilter}
            disabled={sorting}
            onValueChange={setStatusFilter}
            options={[
              { value: "all", label: "全部状态" },
              { value: "online", label: "在线" },
              { value: "visible", label: "已上架" },
              { value: "disabled", label: "运行已停用" },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={enterSorting}>
              <Settings2 />
              {sorting ? "退出排序" : "调整排序"}
            </Button>
            {sorting ? (
              <Button disabled={!sortDirty || saving} onClick={() => void saveSort()}>
                <Save />
                保存排序
              </Button>
            ) : (
              <Button variant="outline" disabled={loading} onClick={() => void load()}>
                <RefreshCw className={cn(loading && "animate-spin")} />
                刷新
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {selected.length ? (
        <Panel className="border-primary/30 bg-primary/5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <strong className="text-sm">已选择 {selected.length} 个节点</strong>
            <div className="flex flex-wrap gap-2">
              {(["show", "hide", "enable", "disable", "reset"] as const).map((action) => (
                <Button key={action} variant="outline" size="sm" disabled={saving} onClick={() => setPendingBatch(action)}>
                  {BATCH_LABELS[action].replace("批量", "")}
                </Button>
              ))}
              <Button variant="destructive" size="sm" disabled={saving} onClick={() => setPendingBatch("delete")}>
                <Trash2 />
                删除
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {loading ? (
        <Panel>
          <div className="space-y-3 py-3">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
          </div>
        </Panel>
      ) : displayed.length === 0 ? (
        <Panel><EmptyState>暂无符合条件的节点</EmptyState></Panel>
      ) : (
        <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="选择当前全部节点" />
                </TableHead>
                <TableHead>节点 / 上线</TableHead>
                <TableHead>入口</TableHead>
                <TableHead>权限组</TableHead>
                <TableHead>流量 / 倍率</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((item, index) => {
                const flag = flagForName(item.name)
                const online = isOn(item.is_online)
                const visible = isOn(item.show)
                const enabled = isOn(item.enabled)
                return (
                  <TableRow key={item.id} data-state={selected.includes(item.id) ? "selected" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selected.includes(item.id)}
                          onCheckedChange={() => toggleSelected(item.id)}
                          aria-label={`选择节点 ${item.name}`}
                        />
                        {sorting ? (
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              disabled={index === 0}
                              aria-label="上移节点"
                              onClick={() => move(index, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              disabled={index === nodes.length - 1}
                              aria-label="下移节点"
                              onClick={() => move(index, 1)}
                            >
                              <ArrowDown />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-72 whitespace-normal">
                      <div className="flex items-center gap-3">
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <Switch
                            checked={visible}
                            disabled={busyId === item.id}
                            aria-label={visible ? "下架节点" : "上架节点"}
                            onCheckedChange={(checked) => void quickUpdate(item, "show", checked ? 1 : 0)}
                          />
                          <span className={cn("text-[10px]", visible ? "text-primary" : "text-muted-foreground")}>
                            {visible ? "已上架" : "已下架"}
                          </span>
                        </div>
                        {flag ? <img src={`/flags/${flag}`} alt="" className="size-7 rounded-full object-cover shadow-sm" /> : null}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="max-w-56 truncate">{item.name}</strong>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "gap-1",
                                online
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                  : "text-muted-foreground",
                              )}
                            >
                              <span className={cn("size-1.5 rounded-full", online ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                              {online ? "在线" : "离线"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            #{item.id} · {item.type}
                            {item.parent ? ` · 子节点：${item.parent.name}` : ""}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="block text-xs">{item.host}:{item.port}</code>
                      <span className="mt-1 block text-xs text-muted-foreground">服务端口 {item.server_port}</span>
                    </TableCell>
                    <TableCell className="max-w-52 whitespace-normal">
                      <div className="flex flex-wrap gap-1">
                        {(item.groups || []).length ? (
                          (item.groups || []).map((group) => <Badge key={group.id} variant="outline">{group.name}</Badge>)
                        ) : (
                          <span className="text-xs text-muted-foreground">未分配</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <strong>{formatBytes(Number(item.u || 0) + Number(item.d || 0))}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">倍率 × {item.rate}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => editNode(item)}>编辑</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => setPendingAction({ kind: "copy", node: item })}
                        >
                          <Copy />
                          复制
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" aria-label={`更多节点操作：${item.name}`} />}
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              disabled={busyId === item.id}
                              onClick={() => void quickUpdate(item, "enabled", !enabled)}
                            >
                              <Check />
                              {enabled ? "停用运行" : "启用运行"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPendingAction({ kind: "reset", node: item })}>
                              <RotateCcw />
                              清零流量
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setPendingAction({ kind: "delete", node: item })}>
                              <Trash2 />
                              删除节点
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Panel>
      )}

      <PageDialog
        open={showForm}
        onOpenChange={(open) => (open ? setShowForm(true) : closeForm())}
        title={form.id ? "编辑节点" : "添加节点"}
        description="基础入口与关联配置；高级区用于协议特有参数。"
        className="sm:max-w-5xl"
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>取消</Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "保存中…" : "保存节点"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="节点名称">
            <Input
              value={form.name}
              placeholder="例如：香港 IEPL 01"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </FormField>
          <SelectField
            label="协议类型"
            value={form.type}
            disabled={Boolean(form.id)}
            onValueChange={changeType}
            options={TYPES.map((type) => ({ value: type, label: type }))}
          />
          <FormField label="连接地址">
            <Input
              value={form.host}
              placeholder="域名或 IP"
              onChange={(event) => setForm({ ...form, host: event.target.value })}
            />
          </FormField>
          <FormField label="用户端口">
            <Input
              type="number"
              min={1}
              max={65535}
              value={form.port}
              onChange={(event) => setForm({ ...form, port: Number(event.target.value) })}
            />
          </FormField>
          <FormField label="服务端口">
            <Input
              type="number"
              min={1}
              max={65535}
              value={form.server_port}
              onChange={(event) => setForm({ ...form, server_port: Number(event.target.value) })}
            />
          </FormField>
          <FormField label="流量倍率">
            <Input
              type="number"
              min={0}
              step={0.1}
              value={form.rate}
              onChange={(event) => setForm({ ...form, rate: Number(event.target.value) })}
            />
          </FormField>
          <SelectField
            label="所属机器"
            value={form.machine_id}
            onValueChange={(value) => setForm({ ...form, machine_id: value ? Number(value) : null })}
            options={[
              { value: "", label: "不绑定" },
              ...machines.map((machine) => ({ value: Number(machine.id), label: String(machine.name) })),
            ]}
          />
          <SelectField
            label="父节点"
            value={form.parent_id}
            onValueChange={(value) => setForm({ ...form, parent_id: value ? Number(value) : null })}
            options={[
              { value: "", label: "无父节点" },
              ...nodes
                .filter((node) => node.id !== form.id)
                .map((node) => ({ value: node.id, label: node.name })),
            ]}
          />
          <FormField label="流量上限（字节）" hint="0 表示不限制">
            <Input
              type="number"
              min={0}
              value={form.transfer_enable}
              onChange={(event) => setForm({ ...form, transfer_enable: Number(event.target.value) })}
            />
          </FormField>
          <FormField label="用户端展示">
            <label className="flex h-8 items-center gap-3 rounded-lg border px-3 text-sm">
              <Switch checked={form.show} onCheckedChange={(show) => setForm({ ...form, show })} />
              {form.show ? "已上架" : "已下架"}
            </label>
          </FormField>
          <FormField label="运行状态">
            <label className="flex h-8 items-center gap-3 rounded-lg border px-3 text-sm">
              <Switch checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} />
              {form.enabled ? "运行中" : "已停用"}
            </label>
          </FormField>
          <div className="hidden lg:block" />
          <MultiSelectField
            label="权限组（可多选）"
            values={form.group_ids}
            options={groupOptions}
            placeholder="未分配权限组"
            onChange={(group_ids) => setForm({ ...form, group_ids })}
          />
          <MultiSelectField
            label="路由规则（可多选）"
            values={form.route_ids}
            options={routeOptions}
            placeholder="未绑定路由规则"
            onChange={(route_ids) => setForm({ ...form, route_ids })}
          />
          <FormField label="标签（每行一个）" className="sm:col-span-2 lg:col-span-3">
            <Textarea
              rows={3}
              value={form.tags.join("\n")}
              onChange={(event) =>
                setForm({
                  ...form,
                  tags: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean),
                })
              }
            />
          </FormField>
        </div>
        <Button type="button" variant="outline" className="mt-2 h-auto w-full justify-between p-4" onClick={() => {
          setProtocolError("")
          setAdvanced(true)
        }}>
          <span className="flex items-center gap-3 text-left">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><Settings2 /></span>
            <span>
              <strong className="block">高级协议参数</strong>
              <small className="text-muted-foreground">在独立窗口中编辑 {form.type} 配置</small>
            </span>
          </span>
          <ChevronDown className="-rotate-90" />
        </Button>
      </PageDialog>

      <PageDialog
        open={advanced}
        onOpenChange={setAdvanced}
        title="高级协议参数"
        description="编辑 protocol_settings JSON；应用后需保存节点才会生效。"
        className="sm:max-w-4xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setAdvanced(false)}>取消</Button>
            <Button onClick={applyProtocol}>应用参数</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge>{form.type}</Badge>
              <p className="mt-1 text-xs text-muted-foreground">仅修改当前节点的协议扩展参数</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resetProtocol}><RotateCcw />恢复默认值</Button>
              <Button variant="outline" size="sm" onClick={formatProtocol}><Settings2 />格式化 JSON</Button>
            </div>
          </div>
          <div>
            <Label htmlFor="node-protocol-json">JSON 配置</Label>
            <Textarea
              id="node-protocol-json"
              rows={18}
              spellCheck={false}
              className="mt-2 min-h-96 resize-y font-mono text-xs leading-5"
              value={protocolJson}
              onChange={(event) => {
                setProtocolJson(event.target.value)
                setProtocolError("")
              }}
            />
          </div>
          {protocolError ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{protocolError}</p> : null}
          <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            未填写的参数将使用服务端默认值；恢复默认值只影响当前编辑内容。
          </p>
        </div>
      </PageDialog>

      <PageDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingCopy?.title || "节点操作"}
        description={pendingAction && pendingCopy ? pendingCopy.description(pendingAction.node) : ""}
        className="sm:max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingAction(null)}>取消</Button>
            <Button
              variant={pendingAction?.kind === "delete" ? "destructive" : "default"}
              disabled={Boolean(pendingAction && busyId === pendingAction.node.id)}
              onClick={() => void runNodeAction()}
            >
              {pendingCopy?.verb || "确认"}
            </Button>
          </>
        }
      >
        <div />
      </PageDialog>

      <PageDialog
        open={Boolean(pendingBatch)}
        onOpenChange={(open) => !open && setPendingBatch(null)}
        title={pendingBatch ? BATCH_LABELS[pendingBatch] : "批量操作"}
        description={pendingBatch ? `确定${BATCH_LABELS[pendingBatch]}选中的 ${selected.length} 个节点？` : ""}
        className="sm:max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingBatch(null)}>取消</Button>
            <Button
              variant={pendingBatch === "delete" ? "destructive" : "default"}
              disabled={saving}
              onClick={() => void runBatch()}
            >
              {saving ? "处理中…" : "确认执行"}
            </Button>
          </>
        }
      >
        <div />
      </PageDialog>
    </PageShell>
  )
}
