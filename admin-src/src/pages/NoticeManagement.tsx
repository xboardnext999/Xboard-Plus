import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Plus, RefreshCw, Save, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { get, post } from "@/services/http"
import {
  ConfirmAction,
  EmptyState,
  FormField,
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
} from "./react-page-helpers"

const PAGE_SIZE = 8

interface NoticeRow {
  id: number
  title: string
  content: string
  img_url: string
  tags: string[]
  show: number | boolean
  popup: number | boolean
  created_at?: number | string
  updated_at?: number | string
}

interface NoticeForm {
  id: number | null
  title: string
  content: string
  img_url: string
  tags: string[]
  show: boolean
  popup: boolean
}

function blankForm(): NoticeForm {
  return {
    id: null,
    title: "",
    content: "",
    img_url: "",
    tags: [],
    show: true,
    popup: false,
  }
}

function enabled(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true"
}

function normalizeNotices(value: unknown): NoticeRow[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const source = item && typeof item === "object" ? item as Partial<NoticeRow> : {}
    return {
      ...source,
      id: Number(source.id),
      title: String(source.title || ""),
      content: String(source.content || ""),
      img_url: String(source.img_url || ""),
      tags: Array.isArray(source.tags) ? source.tags.map(String) : [],
      show: source.show ?? 0,
      popup: source.popup ?? 0,
    }
  })
}

function formatTime(value: unknown) {
  if (!value) return "—"
  const numeric = Number(value)
  const date = Number.isFinite(numeric) ? new Date(numeric * 1000) : new Date(String(value))
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false })
}

export default function NoticeManagement() {
  const [notices, setNotices] = useState<NoticeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sorting, setSorting] = useState(false)
  const [sortDirty, setSortDirty] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [previewContent, setPreviewContent] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [form, setForm] = useState<NoticeForm>(blankForm)
  const [currentPage, setCurrentPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setNotices(normalizeNotices(await get("/notice/fetch")))
      setCurrentPage(1)
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
    return notices.filter((notice) => {
      const matchesText = !term || `${notice.title} ${notice.content} ${notice.tags.join(" ")}`.toLocaleLowerCase().includes(term)
      const matchesStatus = statusFilter === "all" || Number(enabled(notice.show)) === Number(statusFilter)
      return matchesText && matchesStatus
    })
  }, [keyword, notices, statusFilter])

  const stats = useMemo(() => ({
    total: notices.length,
    visible: notices.filter((notice) => enabled(notice.show)).length,
    popup: notices.filter((notice) => enabled(notice.popup)).length,
  }), [notices])

  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, lastPage)
  const displayed = sorting
    ? filtered
    : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (currentPage > lastPage) setCurrentPage(lastPage)
  }, [currentPage, lastPage])

  const resetForm = (source?: NoticeRow) => {
    setForm(source ? {
      id: source.id,
      title: source.title,
      content: source.content,
      img_url: source.img_url,
      tags: [...source.tags],
      show: enabled(source.show),
      popup: enabled(source.popup),
    } : blankForm())
    setTagInput("")
    setPreviewContent(false)
  }

  const createNotice = () => {
    resetForm()
    setShowForm(true)
  }

  const editNotice = (notice: NoticeRow) => {
    resetForm(notice)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    resetForm()
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) setForm((current) => ({ ...current, tags: [...current.tags, tag] }))
    setTagInput("")
  }

  const removeTag = (tag: string) => {
    setForm((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))
  }

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("标题和公告内容不能为空")
      return
    }
    setSaving(true)
    try {
      await post("/notice/save", {
        ...form,
        title: form.title.trim(),
        img_url: form.img_url.trim(),
        show: Number(form.show),
        popup: Number(form.popup),
      })
      toast.success(form.id ? "公告已更新" : "公告已创建")
      closeForm()
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleShow = async (notice: NoticeRow) => {
    setBusyId(notice.id)
    try {
      await post("/notice/show", { id: notice.id })
      const nextShow = !enabled(notice.show)
      setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, show: nextShow } : item))
      toast.success(nextShow ? "公告已显示" : "公告已隐藏")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (notice: NoticeRow) => {
    setBusyId(notice.id)
    try {
      await post("/notice/drop", { id: notice.id })
      toast.success("公告已删除")
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const toggleSorting = () => {
    setSorting((current) => !current)
    setSortDirty(false)
  }

  const move = (notice: NoticeRow, direction: -1 | 1) => {
    const index = notices.findIndex((item) => item.id === notice.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= notices.length) return
    setNotices((current) => {
      const next = [...current]
      const sourceItem = next[index]
      const targetItem = next[target]
      if (!sourceItem || !targetItem) return current
      next[index] = targetItem
      next[target] = sourceItem
      return next
    })
    setSortDirty(true)
  }

  const saveSort = async () => {
    setSaving(true)
    try {
      await post("/notice/sort", { ids: notices.map((notice) => notice.id) })
      setSortDirty(false)
      setSorting(false)
      toast.success("公告排序已保存")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="公告管理"
        description="创建站内公告、控制显示与弹窗状态，并调整展示顺序。"
        action={<Button onClick={createNotice}><Plus />添加公告</Button>}
      />

      <MetricGrid>
        <MetricCard label="公告总数" value={stats.total} />
        <MetricCard label="显示中" value={stats.visible} />
        <MetricCard label="弹窗公告" value={stats.popup} />
      </MetricGrid>

      <Panel>
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_12rem_auto] md:items-end">
          <FormField label="搜索">
            <Input
              value={keyword}
              placeholder="标题、内容或标签"
              onChange={(event) => {
                setKeyword(event.target.value)
                setCurrentPage(1)
              }}
            />
          </FormField>
          <SelectField
            label="显示状态"
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value)
              setCurrentPage(1)
            }}
            options={[
              { value: "all", label: "全部状态" },
              { value: "1", label: "显示中" },
              { value: "0", label: "已隐藏" },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={toggleSorting}>
              {sorting ? "退出排序" : "调整排序"}
            </Button>
            {sorting ? (
              <Button disabled={!sortDirty || saving} onClick={() => void saveSort()}><Save />保存排序</Button>
            ) : (
              <Button variant="outline" disabled={loading} onClick={() => void load()}>
                <RefreshCw className={loading ? "animate-spin" : ""} />刷新
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-56 w-full rounded-xl" />)}
        </div>
      ) : displayed.length === 0 ? (
        <Panel><EmptyState>暂无符合条件的公告</EmptyState></Panel>
      ) : (
        <div className={cn("grid gap-4", !sorting && "xl:grid-cols-2")}>
          {displayed.map((notice) => {
            const visible = enabled(notice.show)
            const popup = enabled(notice.popup)
            const index = notices.findIndex((item) => item.id === notice.id)
            return (
              <Panel key={notice.id} className="relative">
                <div className="flex h-full flex-col gap-4 sm:flex-row">
                  {sorting ? (
                    <div className="flex shrink-0 gap-1 sm:flex-col">
                      <Button variant="outline" size="icon-sm" disabled={index === 0} aria-label="上移公告" onClick={() => move(notice, -1)}><ArrowUp /></Button>
                      <Button variant="outline" size="icon-sm" disabled={index === notices.length - 1} aria-label="下移公告" onClick={() => move(notice, 1)}><ArrowDown /></Button>
                    </div>
                  ) : null}
                  {notice.img_url ? (
                    <img src={notice.img_url} alt={notice.title} className="h-36 w-full rounded-xl object-cover sm:h-auto sm:w-36" />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold">{notice.title}</h2>
                        <span className="mt-1 block text-xs text-muted-foreground">#{notice.id} · {formatTime(notice.updated_at || notice.created_at)}</span>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        <StatusBadge tone={visible ? "default" : "neutral"}>{visible ? "显示中" : "已隐藏"}</StatusBadge>
                        {popup ? <Badge variant="secondary">弹窗</Badge> : null}
                      </div>
                    </div>
                    <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{notice.content}</p>
                    {notice.tags.length ? (
                      <div className="flex flex-wrap gap-1">{notice.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
                      <label className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch checked={visible} disabled={busyId === notice.id} onCheckedChange={() => void toggleShow(notice)} />
                        {visible ? "显示中" : "已隐藏"}
                      </label>
                      <Button variant="outline" size="sm" onClick={() => editNotice(notice)}>编辑</Button>
                      <ConfirmAction
                        title="删除公告"
                        description={`确定删除公告「${notice.title}」？此操作无法撤销。`}
                        confirmText="删除公告"
                        disabled={busyId === notice.id}
                        onConfirm={() => remove(notice)}
                      >
                        删除
                      </ConfirmAction>
                    </div>
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      {!sorting && !loading ? (
        <Pagination
          current={safePage}
          last={lastPage}
          total={filtered.length}
          onChange={setCurrentPage}
        />
      ) : null}

      <PageDialog
        open={showForm}
        onOpenChange={(open) => open ? setShowForm(true) : closeForm()}
        title={form.id ? "编辑公告" : "添加公告"}
        description="内容支持 Markdown 或 HTML，由用户端主题负责渲染。"
        className="sm:max-w-4xl"
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>取消</Button>
            <Button disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "保存公告"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="公告标题" className="sm:col-span-2">
            <Input value={form.title} placeholder="请输入公告标题" onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </FormField>
          <FormField label="公告背景图 URL" className="sm:col-span-2">
            <Input type="url" value={form.img_url} placeholder="https://example.com/image.jpg" onChange={(event) => setForm({ ...form, img_url: event.target.value })} />
          </FormField>
          <FormField label="显示状态">
            <label className="flex h-8 items-center gap-3 rounded-lg border px-3 text-sm">
              <Switch checked={form.show} onCheckedChange={(show) => setForm({ ...form, show })} />
              {form.show ? "已显示" : "已隐藏"}
            </label>
          </FormField>
          <FormField label="弹窗展示">
            <label className="flex h-8 items-center gap-3 rounded-lg border px-3 text-sm">
              <Switch checked={form.popup} onCheckedChange={(popup) => setForm({ ...form, popup })} />
              {form.popup ? "弹窗展示" : "不弹窗"}
            </label>
          </FormField>
          <FormField label="公告标签" className="sm:col-span-2">
            <div className="space-y-2 rounded-lg border p-2">
              {form.tags.length ? (
                <div className="flex flex-wrap gap-1">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <Button type="button" variant="ghost" size="icon-xs" className="size-4 rounded-full p-0 hover:bg-foreground/10" title="移除标签" onClick={() => removeTag(tag)}>
                        <X className="size-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              ) : null}
              <Input
                value={tagInput}
                className="border-0 shadow-none focus-visible:ring-0"
                placeholder="输入标签后按回车"
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addTag()
                  }
                }}
                onBlur={addTag}
              />
            </div>
          </FormField>
          <FormField label="公告内容" className="sm:col-span-2">
            <Tabs value={previewContent ? "preview" : "edit"} onValueChange={(value) => setPreviewContent(value === "preview")}>
              <TabsList>
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="preview">文本预览</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <Textarea
                  value={form.content}
                  rows={12}
                  className="min-h-72 resize-y"
                  placeholder="请输入公告内容"
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                />
              </TabsContent>
              <TabsContent value="preview">
                <pre className="min-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">{form.content || "暂无内容"}</pre>
              </TabsContent>
            </Tabs>
          </FormField>
          {form.img_url ? (
            <FormField label="背景预览" className="sm:col-span-2">
              <img src={form.img_url} alt="公告背景预览" className="max-h-72 w-full rounded-xl object-cover" />
            </FormField>
          ) : null}
        </div>
      </PageDialog>
    </PageShell>
  )
}
