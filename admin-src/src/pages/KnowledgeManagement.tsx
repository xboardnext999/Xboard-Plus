import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, BookOpen, Plus, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
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
  Panel,
  SelectField,
  StatusBadge,
  errorMessage,
} from "./react-page-helpers"

const DEFAULT_LANGUAGES = ["zh-CN", "zh-TW", "en-US", "ja-JP"] as const
const VARIABLES = [
  ["站点名称", "{{siteName}}"],
  ["订阅地址", "{{subscribeUrl}}"],
  ["URL 编码订阅", "{{urlEncodeSubscribeUrl}}"],
] as const

interface ArticleRow {
  id: number
  category: string
  language: string
  title: string
  body: string
  show: number | boolean
  created_at?: number | string
  updated_at?: number | string
}

interface ArticleForm {
  id: number | null
  category: string
  language: string
  title: string
  body: string
  show: boolean
}

function blankForm(): ArticleForm {
  return {
    id: null,
    category: "",
    language: "zh-CN",
    title: "",
    body: "",
    show: true,
  }
}

function enabled(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true"
}

function articleFrom(value: unknown, fallback?: Partial<ArticleRow>): ArticleRow {
  const source = value && typeof value === "object" ? value as Partial<ArticleRow> : {}
  return {
    id: Number(source.id ?? fallback?.id),
    category: String(source.category ?? fallback?.category ?? ""),
    language: String(source.language ?? fallback?.language ?? ""),
    title: String(source.title ?? fallback?.title ?? ""),
    body: String(source.body ?? fallback?.body ?? ""),
    show: source.show ?? fallback?.show ?? false,
    created_at: source.created_at ?? fallback?.created_at,
    updated_at: source.updated_at ?? fallback?.updated_at,
  }
}

function normalizeArticles(value: unknown) {
  return Array.isArray(value) ? value.map((item) => articleFrom(item)) : []
}

function formatTime(value: unknown) {
  if (!value) return "—"
  const numeric = Number(value)
  const date = Number.isFinite(numeric) ? new Date(numeric * 1000) : new Date(String(value))
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("zh-CN", { hour12: false })
}

export default function KnowledgeManagement() {
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [keyword, setKeyword] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [languageFilter, setLanguageFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sorting, setSorting] = useState(false)
  const [sortDirty, setSortDirty] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [preview, setPreview] = useState(false)
  const [form, setForm] = useState<ArticleForm>(blankForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rowData, categoryData] = await Promise.all([
        get("/knowledge/fetch"),
        get("/knowledge/getCategory"),
      ])
      const summaries = normalizeArticles(rowData)
      const hydrated = await Promise.all(summaries.map(async (summary) => {
        try {
          return articleFrom(await get("/knowledge/fetch", { id: summary.id }), summary)
        } catch {
          return summary
        }
      }))
      setArticles(hydrated)
      setCategories(Array.isArray(categoryData) ? categoryData.map(String).filter(Boolean) : [])
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const languages = useMemo(() => [
    ...new Set([...DEFAULT_LANGUAGES, ...articles.map((article) => article.language).filter(Boolean)]),
  ], [articles])

  const filtered = useMemo(() => {
    const term = keyword.trim().toLocaleLowerCase()
    return articles.filter((article) => (
      (!term || `${article.title} ${article.category}`.toLocaleLowerCase().includes(term)) &&
      (!categoryFilter || article.category === categoryFilter) &&
      (!languageFilter || article.language === languageFilter) &&
      (statusFilter === "all" || Number(enabled(article.show)) === Number(statusFilter))
    ))
  }, [articles, categoryFilter, keyword, languageFilter, statusFilter])

  const displayed = sorting ? articles : filtered
  const stats = useMemo(() => ({
    total: articles.length,
    visible: articles.filter((article) => enabled(article.show)).length,
    categories: new Set(articles.map((article) => article.category).filter(Boolean)).size,
    languages: new Set(articles.map((article) => article.language).filter(Boolean)).size,
  }), [articles])

  const createArticle = () => {
    setForm({ ...blankForm(), category: categoryFilter || categories[0] || "" })
    setPreview(false)
    setShowForm(true)
  }

  const editArticle = async (article: ArticleRow) => {
    setBusyId(article.id)
    try {
      const detail = articleFrom(await get("/knowledge/fetch", { id: article.id }), article)
      setForm({
        id: detail.id,
        category: detail.category,
        language: detail.language || "zh-CN",
        title: detail.title,
        body: detail.body,
        show: enabled(detail.show),
      })
      setPreview(false)
      setShowForm(true)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(blankForm())
    setPreview(false)
  }

  const save = async () => {
    if (!form.category.trim() || !form.language.trim() || !form.title.trim() || !form.body.trim()) {
      toast.error("分类、语言、标题和正文不能为空")
      return
    }
    setSaving(true)
    try {
      await post("/knowledge/save", {
        ...form,
        category: form.category.trim(),
        language: form.language.trim(),
        title: form.title.trim(),
        show: Boolean(form.show),
      })
      toast.success(form.id ? "文章已更新" : "文章已创建")
      closeForm()
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (article: ArticleRow) => {
    setBusyId(article.id)
    try {
      await post("/knowledge/show", { id: article.id })
      const nextShow = !enabled(article.show)
      setArticles((current) => current.map((item) => item.id === article.id ? { ...item, show: nextShow } : item))
      toast.success(nextShow ? "文章已显示" : "文章已隐藏")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (article: ArticleRow) => {
    setBusyId(article.id)
    try {
      await post("/knowledge/drop", { id: article.id })
      toast.success("文章已删除")
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const enterSorting = () => {
    const entering = !sorting
    setSorting(entering)
    setSortDirty(false)
    if (entering) {
      setKeyword("")
      setCategoryFilter("")
      setLanguageFilter("")
      setStatusFilter("all")
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= articles.length) return
    setArticles((current) => {
      const next = [...current]
      const sourceArticle = next[index]
      const targetArticle = next[target]
      if (!sourceArticle || !targetArticle) return current
      next[index] = targetArticle
      next[target] = sourceArticle
      return next
    })
    setSortDirty(true)
  }

  const saveSort = async () => {
    setSaving(true)
    try {
      await post("/knowledge/sort", { ids: articles.map((article) => article.id) })
      setSorting(false)
      setSortDirty(false)
      toast.success("文章排序已保存")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const insertVariable = (value: string) => {
    setForm((current) => ({
      ...current,
      body: `${current.body}${current.body && !current.body.endsWith("\n") ? "\n" : ""}${value}`,
    }))
  }

  return (
    <PageShell>
      <PageHeader
        title="知识库管理"
        description="维护帮助文章、分类和多语言内容，并控制用户端展示顺序。"
        action={<Button onClick={createArticle}><Plus />添加文章</Button>}
      />

      <MetricGrid>
        <MetricCard label="文章总数" value={stats.total} />
        <MetricCard label="显示中" value={stats.visible} />
        <MetricCard label="分类数量" value={stats.categories} />
        <MetricCard label="内容语言" value={stats.languages} />
      </MetricGrid>

      <Panel>
        <div className="grid gap-3 xl:grid-cols-[minmax(14rem,1fr)_12rem_11rem_11rem_auto] xl:items-end">
          <FormField label="搜索">
            <Input
              value={keyword}
              disabled={sorting}
              placeholder="文章标题或分类"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </FormField>
          <SelectField
            label="文章分类"
            value={categoryFilter}
            disabled={sorting}
            onValueChange={setCategoryFilter}
            options={[
              { value: "", label: "全部分类" },
              ...categories.map((category) => ({ value: category, label: category })),
            ]}
          />
          <SelectField
            label="内容语言"
            value={languageFilter}
            disabled={sorting}
            onValueChange={setLanguageFilter}
            options={[
              { value: "", label: "全部语言" },
              ...languages.map((language) => ({ value: language, label: language })),
            ]}
          />
          <SelectField
            label="显示状态"
            value={statusFilter}
            disabled={sorting}
            onValueChange={setStatusFilter}
            options={[
              { value: "all", label: "全部状态" },
              { value: "1", label: "显示中" },
              { value: "0", label: "已隐藏" },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={enterSorting}>{sorting ? "退出排序" : "调整排序"}</Button>
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

      {sorting ? (
        <Panel className="border-primary/20 bg-primary/5">
          <p className="text-sm text-muted-foreground">排序模式会显示全部文章；上下移动后点击“保存排序”生效。</p>
        </Panel>
      ) : null}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 w-full rounded-xl" />)}</div>
      ) : displayed.length === 0 ? (
        <Panel><EmptyState>暂无符合条件的文章</EmptyState></Panel>
      ) : (
        <div className="space-y-3">
          {displayed.map((article, index) => {
            const visible = enabled(article.show)
            return (
              <Panel key={article.id}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  {sorting ? (
                    <div className="flex shrink-0 gap-1 md:flex-col">
                      <Button variant="outline" size="icon-sm" disabled={index === 0} aria-label="上移文章" onClick={() => move(index, -1)}><ArrowUp /></Button>
                      <Button variant="outline" size="icon-sm" disabled={index === articles.length - 1} aria-label="下移文章" onClick={() => move(index, 1)}><ArrowDown /></Button>
                    </div>
                  ) : null}
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BookOpen /></div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{article.category || "未分类"}</Badge>
                      {article.language ? <Badge variant="secondary">{article.language}</Badge> : null}
                    </div>
                    <h2 className="truncate text-base font-semibold">{article.title}</h2>
                    <span className="mt-1 block text-xs text-muted-foreground">#{article.id} · 更新于 {formatTime(article.updated_at)}</span>
                  </div>
                  <StatusBadge tone={visible ? "default" : "neutral"}>{visible ? "显示中" : "已隐藏"}</StatusBadge>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={visible} disabled={busyId === article.id} onCheckedChange={() => void toggle(article)} />
                      {visible ? "显示" : "隐藏"}
                    </label>
                    <Button variant="outline" size="sm" disabled={busyId === article.id} onClick={() => void editArticle(article)}>编辑</Button>
                    <ConfirmAction
                      title="删除知识库文章"
                      description={`确定删除知识库文章「${article.title}」？此操作无法撤销。`}
                      confirmText="删除文章"
                      disabled={busyId === article.id}
                      onConfirm={() => remove(article)}
                    >
                      删除
                    </ConfirmAction>
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      <PageDialog
        open={showForm}
        onOpenChange={(open) => open ? setShowForm(true) : closeForm()}
        title={form.id ? "编辑文章" : "添加文章"}
        description="正文支持 Markdown 或 HTML，并可插入用户专属变量。"
        className="sm:max-w-5xl"
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>取消</Button>
            <Button disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : "保存文章"}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="文章分类">
            <Input
              list="knowledge-categories"
              value={form.category}
              placeholder="例如：使用教程"
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            />
            <datalist id="knowledge-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
          </FormField>
          <FormField label="内容语言">
            <Input
              list="knowledge-languages"
              value={form.language}
              placeholder="zh-CN"
              onChange={(event) => setForm({ ...form, language: event.target.value })}
            />
            <datalist id="knowledge-languages">{languages.map((language) => <option key={language} value={language} />)}</datalist>
          </FormField>
          <FormField label="文章标题" className="sm:col-span-2">
            <Input value={form.title} placeholder="请输入文章标题" onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </FormField>
          <FormField label="显示状态">
            <label className="flex h-8 items-center gap-3 rounded-lg border px-3 text-sm">
              <Switch checked={form.show} onCheckedChange={(show) => setForm({ ...form, show })} />
              {form.show ? "已显示" : "已隐藏"}
            </label>
          </FormField>
        </div>

        <Tabs
          value={preview ? "preview" : "edit"}
          onValueChange={(value) => setPreview(value === "preview")}
          className="mt-4 rounded-xl border p-3"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <TabsList>
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="preview">文本预览</TabsTrigger>
              </TabsList>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map(([label, value]) => (
                <Button key={value} type="button" variant="outline" size="sm" onClick={() => insertVariable(value)}>{label}</Button>
              ))}
            </div>
          </div>
          <TabsContent value="preview">
            <pre className="min-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">{form.body || "暂无内容"}</pre>
          </TabsContent>
          <TabsContent value="edit">
            <Textarea
              value={form.body}
              rows={18}
              className="min-h-96 resize-y font-mono text-sm leading-6"
              placeholder="请输入文章正文"
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
          </TabsContent>
          <p className="mt-3 text-xs text-muted-foreground">
            需要订阅后才能查看的内容，可放在 <code className="rounded bg-muted px-1">&lt;!--access start--&gt;</code> 与 <code className="rounded bg-muted px-1">&lt;!--access end--&gt;</code> 之间。
          </p>
        </Tabs>
      </PageDialog>
    </PageShell>
  )
}
