import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Database,
  GripVertical,
  ImageIcon,
  Layers3,
  LoaderCircle,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { get, post } from "@/services/http"
import {
  ConfirmAction,
  EmptyState,
  MetricCard,
  MetricGrid,
  PageDialog,
  PageHeader,
  PageShell,
  SelectField,
  StatusBadge,
  errorMessage,
  type UnknownRecord,
} from "./react-page-helpers"

type EntityId = string | number
type StatusFilter = "all" | "selling" | "off" | "low"
type UploadTarget = "banner" | "cover"

interface ProductPackage extends UnknownRecord {
  id: string
  name: string
  price: number
  original_price: number
  description: string
  stock_count?: number
}

interface ProductConfig extends UnknownRecord {
  delivery_type: "code" | "text"
  category: string
  image_url: string
  detail_markdown: string
  gallery: string[]
  featured: boolean
  packages: ProductPackage[]
}

interface ProductRow extends UnknownRecord {
  id: EntityId
  digital_category_id: EntityId | null
  name: string
  content: string
  show: boolean
  sell: boolean
  stock_count: number
  sold_count: number
  product_config: ProductConfig
}

interface CategoryRow extends UnknownRecord {
  id: EntityId
  name: string
  enabled: boolean
  plans_count: number
}

interface FaqRow extends UnknownRecord {
  id: EntityId
  title: string
  content: string
  enabled: boolean
  sort: number
}

interface BannerForm extends UnknownRecord {
  image_url: string
  title: string
  subtitle: string
  button_text: string
  link_url: string
}

interface CategoryForm {
  id: EntityId | null
  name: string
  enabled: boolean
}

interface FaqForm {
  id: EntityId | null
  title: string
  content: string
  enabled: boolean
  sort: number
}

interface ProductForm {
  id: EntityId | null
  digital_category_id: EntityId | null
  name: string
  content: string
  show: boolean
  sell: boolean
  product_config: ProductConfig
}

const DEFAULT_BANNER: BannerForm = {
  image_url: "",
  title: "数字商品中心",
  subtitle: "",
  button_text: "了解更多",
  link_url: "#digital-products",
}

let packageSequence = 0

function booleanValue(value: unknown, fallback = false) {
  if (value == null) return fallback
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true"
  return Boolean(value)
}

function objectValue(value: unknown): UnknownRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as UnknownRecord
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

function emptyPackage(): ProductPackage {
  packageSequence += 1
  return {
    id: "spec-" + Date.now() + "-" + packageSequence,
    name: "标准版",
    price: 0,
    original_price: 0,
    description: "",
  }
}

function normalizePackage(value: unknown): ProductPackage {
  const item = objectValue(value)
  return {
    ...item,
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
    price: Number(item.price || 0),
    original_price: Number(item.original_price || 0),
    description: String(item.description ?? ""),
    stock_count: Number(item.stock_count || 0),
  }
}

function normalizeProduct(value: unknown): ProductRow {
  const row = objectValue(value)
  const config = objectValue(row.product_config)
  const packages = Array.isArray(config.packages)
    ? config.packages.map(normalizePackage)
    : []
  return {
    ...row,
    id: row.id as EntityId,
    digital_category_id: (row.digital_category_id as EntityId | null) ?? null,
    name: String(row.name ?? ""),
    content: String(row.content ?? ""),
    show: booleanValue(row.show, true),
    sell: booleanValue(row.sell, true),
    stock_count: Number(row.stock_count || 0),
    sold_count: Number(row.sold_count || 0),
    product_config: {
      ...config,
      delivery_type: config.delivery_type === "text" ? "text" : "code",
      category: String(config.category || "数字商品"),
      image_url: String(config.image_url || ""),
      detail_markdown: String(config.detail_markdown || ""),
      gallery: Array.isArray(config.gallery)
        ? config.gallery.map((item) => String(item)).filter(Boolean)
        : [],
      featured: booleanValue(config.featured),
      packages,
    },
  }
}

function normalizeCategory(value: unknown): CategoryRow {
  const item = objectValue(value)
  return {
    ...item,
    id: item.id as EntityId,
    name: String(item.name ?? ""),
    enabled: booleanValue(item.enabled, true),
    plans_count: Number(item.plans_count || 0),
  }
}

function normalizeFaq(value: unknown): FaqRow {
  const item = objectValue(value)
  return {
    ...item,
    id: item.id as EntityId,
    title: String(item.title ?? ""),
    content: String(item.content ?? ""),
    enabled: booleanValue(item.enabled, true),
    sort: Number(item.sort || 0),
  }
}

function normalizeBanner(value: unknown): BannerForm {
  const item = objectValue(value)
  return {
    ...DEFAULT_BANNER,
    ...item,
    image_url: String(item.image_url ?? DEFAULT_BANNER.image_url),
    title: String(item.title ?? DEFAULT_BANNER.title),
    subtitle: String(item.subtitle ?? DEFAULT_BANNER.subtitle),
    button_text: String(item.button_text ?? DEFAULT_BANNER.button_text),
    link_url: String(item.link_url ?? DEFAULT_BANNER.link_url),
  }
}

function newProductForm(categories: CategoryRow[], row?: ProductRow | null): ProductForm {
  const selectedCategoryId = row?.digital_category_id
    ?? categories.find((item) => item.enabled)?.id
    ?? null
  const selectedCategory = categories.find(
    (item) => String(item.id) === String(selectedCategoryId),
  )
  const config = row?.product_config
  return {
    id: row?.id ?? null,
    digital_category_id: selectedCategoryId,
    name: row?.name ?? "",
    content: row?.content ?? "",
    show: row?.show ?? true,
    sell: row?.sell ?? true,
    product_config: {
      ...(config || {}),
      delivery_type: config?.delivery_type === "text" ? "text" : "code",
      category: config?.category || selectedCategory?.name || "数字商品",
      image_url: config?.image_url || "",
      detail_markdown: config?.detail_markdown || "",
      gallery: [...(config?.gallery || [])],
      featured: Boolean(config?.featured),
      packages: config?.packages?.length
        ? config.packages.map((item) => ({ ...item }))
        : [emptyPackage()],
    },
  }
}

function lowestPrice(row: ProductRow) {
  const prices = row.product_config.packages
    .map((item) => Number(item.price || 0))
    .filter((price) => price > 0)
  return prices.length ? Math.min(...prices) : 0
}

function safeMediaUrl(value: string) {
  const source = value.trim()
  return source && !/^(javascript|vbscript|data:text\/html):/i.test(source) ? source : ""
}

function MarkdownInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\x60[^\x60]+\x60|\[[^\]]+\]\((?:https?:\/\/|\/(?!\/))[^\s)]+\))/g)
  return parts.map((part, index): ReactNode => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.charCodeAt(0) === 96 && part.charCodeAt(part.length - 1) === 96) {
      return <code key={index} className="rounded bg-muted px-1 py-0.5">{part.slice(1, -1)}</code>
    }
    const link = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/(?!\/))[^\s)]+)\)$/)
    if (link?.[1] && link[2]) {
      return <a key={index} className="text-primary underline underline-offset-4" href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    }
    return part
  })
}

function MarkdownPreview({ source }: { source: string }) {
  const lines = (source.trim() || "暂无详情内容").split(/\r?\n/)
  return (
    <article className="min-h-64 space-y-2 rounded-xl border bg-muted/30 p-4 text-sm leading-7">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-2" />
        const image = line.match(/^!\[([^\]]*)\]\(((?:https?:\/\/|\/(?!\/))[^\s)]+)\)$/)
        if (image?.[2]) {
          return <img key={index} className="max-h-80 rounded-lg border object-contain" src={image[2]} alt={image[1] || ""} />
        }
        const heading = line.match(/^(#{1,3})\s+(.+)$/)
        if (heading?.[1] && heading[2]) {
          const level = heading[1].length
          if (level === 1) return <h1 key={index} className="text-2xl font-semibold"><MarkdownInline text={heading[2]} /></h1>
          if (level === 2) return <h2 key={index} className="text-xl font-semibold"><MarkdownInline text={heading[2]} /></h2>
          return <h3 key={index} className="text-lg font-semibold"><MarkdownInline text={heading[2]} /></h3>
        }
        const listItem = line.match(/^[-*]\s+(.+)$/)
        if (listItem?.[1]) {
          return <div key={index} className="flex gap-2 pl-2"><span className="text-primary">•</span><span><MarkdownInline text={listItem[1]} /></span></div>
        }
        return <p key={index}><MarkdownInline text={line} /></p>
      })}
    </article>
  )
}

export default function DigitalProductManagement() {
  const navigate = useNavigate()
  const coverInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const detailEditorRef = useRef<HTMLTextAreaElement>(null)
  const productDragSnapshot = useRef<EntityId[]>([])
  const faqDragSnapshot = useRef<FaqRow[]>([])

  const [rows, setRows] = useState<ProductRow[]>([])
  const [managedCategories, setManagedCategories] = useState<CategoryRow[]>([])
  const [managedFaqs, setManagedFaqs] = useState<FaqRow[]>([])
  const [banner, setBanner] = useState<BannerForm>(DEFAULT_BANNER)
  const [form, setForm] = useState<ProductForm>(() => newProductForm([]))
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({
    id: null,
    name: "",
    enabled: true,
  })
  const [faqForm, setFaqForm] = useState<FaqForm>({
    id: null,
    title: "",
    content: "",
    enabled: true,
    sort: 1,
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingBanner, setSavingBanner] = useState(false)
  const [categorySaving, setCategorySaving] = useState(false)
  const [faqSaving, setFaqSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [sorting, setSorting] = useState(false)
  const [faqSorting, setFaqSorting] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [showBannerForm, setShowBannerForm] = useState(false)
  const [showCategoryEditor, setShowCategoryEditor] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showFaqEditor, setShowFaqEditor] = useState(false)
  const [detailPreview, setDetailPreview] = useState(false)

  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [draggingId, setDraggingId] = useState<EntityId | null>(null)
  const [dragOverId, setDragOverId] = useState<EntityId | null>(null)
  const [faqDraggingId, setFaqDraggingId] = useState<EntityId | null>(null)
  const [faqDragOverId, setFaqDragOverId] = useState<EntityId | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [productData, bannerData, categoryData, faqData] = await Promise.all([
        get<unknown[]>("/digital-products/fetch"),
        get<UnknownRecord>("/digital-products/banner"),
        get<unknown[]>("/digital-products/categories"),
        get<unknown[]>("/digital-products/faqs"),
      ])
      const products = Array.isArray(productData) ? productData.map(normalizeProduct) : []
      const categories = Array.isArray(categoryData) ? categoryData.map(normalizeCategory) : []
      const faqs = Array.isArray(faqData) ? faqData.map(normalizeFaq) : []
      setRows(products)
      setManagedCategories(categories)
      setManagedFaqs(faqs)
      setBanner(normalizeBanner(bannerData))
      setFaqForm((current) => current.id ? current : { ...current, sort: faqs.length + 1 })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const productCategoryName = useCallback((row: ProductRow) => {
    return managedCategories.find(
      (item) => String(item.id) === String(row.digital_category_id),
    )?.name || row.product_config.category || "数字商品"
  }, [managedCategories])

  const selling = useMemo(
    () => rows.filter((row) => row.show && row.sell),
    [rows],
  )
  const totalStock = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.stock_count || 0), 0),
    [rows],
  )
  const totalDelivered = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.sold_count || 0), 0),
    [rows],
  )
  const lowStock = useMemo(
    () => [...rows]
      .filter((row) => Number(row.stock_count || 0) <= 10)
      .sort((left, right) => Number(left.stock_count || 0) - Number(right.stock_count || 0))
      .slice(0, 4),
    [rows],
  )
  const filteredRows = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return rows.filter((row) => {
      const category = productCategoryName(row)
      const text = (row.name + " " + row.content + " " + category).toLowerCase()
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "selling" && row.show && row.sell)
        || (statusFilter === "off" && (!row.show || !row.sell))
        || (statusFilter === "low" && Number(row.stock_count || 0) <= 10)
      return text.includes(query)
        && matchesStatus
        && (categoryFilter === "all" || category === categoryFilter)
    })
  }, [categoryFilter, keyword, productCategoryName, rows, statusFilter])

  function openProduct(row?: ProductRow | null) {
    setForm(newProductForm(managedCategories, row))
    setDetailPreview(false)
    setShowForm(true)
  }

  function openCategory(item?: CategoryRow | null) {
    setCategoryForm({
      id: item?.id ?? null,
      name: item?.name ?? "",
      enabled: item?.enabled ?? true,
    })
    setShowCategoryEditor(true)
  }

  function openFaq(item?: FaqRow | null) {
    setFaqForm({
      id: item?.id ?? null,
      title: item?.title ?? "",
      content: item?.content ?? "",
      enabled: item?.enabled ?? true,
      sort: item?.sort ?? managedFaqs.length + 1,
    })
    setShowFaqEditor(true)
  }

  function shouldCancelDrag(event: DragEvent<HTMLElement>) {
    const target = event.target as HTMLElement
    return Boolean(target.closest("button, input, textarea, select, a, [role=switch]"))
  }

  function startProductDrag(event: DragEvent<HTMLTableRowElement>, row: ProductRow) {
    if (sorting || shouldCancelDrag(event)) {
      event.preventDefault()
      return
    }
    productDragSnapshot.current = rows.map((item) => item.id)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(row.id))
    setDraggingId(row.id)
    setDragOverId(null)
  }

  function finishProductDrag() {
    setDraggingId(null)
    setDragOverId(null)
  }

  async function dropProduct(event: DragEvent<HTMLTableRowElement>, target: ProductRow) {
    event.preventDefault()
    if (draggingId == null) return
    const sourceIndex = rows.findIndex((item) => String(item.id) === String(draggingId))
    const targetIndex = rows.findIndex((item) => String(item.id) === String(target.id))
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      finishProductDrag()
      return
    }
    const next = [...rows]
    const moved = next.splice(sourceIndex, 1)[0]
    if (!moved) return
    next.splice(targetIndex, 0, moved)
    setRows(next)
    setSorting(true)
    try {
      await post("/digital-products/sort", { ids: next.map((item) => item.id) })
      toast.success("商品排序已保存")
    } catch (error) {
      setRows(
        productDragSnapshot.current
          .map((id) => next.find((item) => String(item.id) === String(id)))
          .filter((item): item is ProductRow => Boolean(item)),
      )
      toast.error(errorMessage(error))
    } finally {
      setSorting(false)
      finishProductDrag()
    }
  }

  async function toggleSelling(row: ProductRow, enabled: boolean) {
    const previous = { show: row.show, sell: row.sell }
    setRows((current) => current.map((item) => (
      String(item.id) === String(row.id)
        ? { ...item, show: enabled, sell: enabled }
        : item
    )))
    try {
      await post("/digital-products/status", { id: row.id, enabled })
      toast.success(enabled ? "商品已上架销售" : "商品已下架")
    } catch (error) {
      setRows((current) => current.map((item) => (
        String(item.id) === String(row.id) ? { ...item, ...previous } : item
      )))
      toast.error(errorMessage(error))
    }
  }

  async function saveProduct() {
    const packages = form.product_config.packages.filter(
      (item) => item.id.trim() && item.name.trim() && Number(item.price) > 0,
    )
    if (!form.name.trim()) return toast.error("请输入商品名称")
    if (!form.digital_category_id) return toast.error("请选择商品分类")
    if (!packages.length) return toast.error("请至少设置一个有效规格")
    setSaving(true)
    try {
      await post("/digital-products/save", {
        ...form,
        prices: {},
        product_config: { ...form.product_config, packages },
      })
      setShowForm(false)
      toast.success(form.id ? "商品已更新" : "商品已创建")
      await load()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  function patchProductPackage(index: number, patch: Partial<ProductPackage>) {
    setForm((current) => ({
      ...current,
      product_config: {
        ...current.product_config,
        packages: current.product_config.packages.map((item, itemIndex) => (
          itemIndex === index ? { ...item, ...patch } : item
        )),
      },
    }))
  }

  function selectProductCategory(value: string) {
    const category = managedCategories.find((item) => String(item.id) === value)
    setForm((current) => ({
      ...current,
      digital_category_id: value || null,
      product_config: {
        ...current.product_config,
        category: category?.name || current.product_config.category,
      },
    }))
  }

  async function uploadSingle(
    target: UploadTarget,
    path: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const body = new FormData()
    body.append("file", file)
    const setUploading = target === "banner" ? setUploadingBanner : setUploadingCover
    setUploading(true)
    try {
      const result = await post<{ url?: string }>(path, body)
      if (!result.url) throw new Error("上传接口未返回图片地址")
      if (target === "banner") {
        setBanner((current) => ({ ...current, image_url: String(result.url) }))
      } else {
        setForm((current) => ({
          ...current,
          product_config: {
            ...current.product_config,
            image_url: String(result.url),
          },
        }))
      }
      toast.success("图片上传成功")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setUploading(false)
      input.value = ""
    }
  }

  async function uploadGallery(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const files = Array.from(input.files || [])
    if (!files.length) return
    setUploadingGallery(true)
    try {
      const urls: string[] = []
      for (const file of files) {
        const body = new FormData()
        body.append("file", file)
        const result = await post<{ url?: string }>("/digital-products/cover/upload", body)
        if (result.url) urls.push(String(result.url))
      }
      setForm((current) => ({
        ...current,
        product_config: {
          ...current.product_config,
          gallery: [...current.product_config.gallery, ...urls],
        },
      }))
      toast.success("详情图片上传成功")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setUploadingGallery(false)
      input.value = ""
    }
  }

  function insertMarkdown(prefix: string, suffix = "", placeholder = "内容") {
    const textarea = detailEditorRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const source = form.product_config.detail_markdown || ""
    const selected = source.slice(start, end) || placeholder
    const insertion = prefix + selected + suffix
    setForm((current) => ({
      ...current,
      product_config: {
        ...current.product_config,
        detail_markdown: source.slice(0, start) + insertion + source.slice(end),
      },
    }))
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + insertion.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  async function saveBanner() {
    if (!banner.title.trim()) return toast.error("请输入 Banner 标题")
    setSavingBanner(true)
    try {
      const saved = await post<unknown>("/digital-products/banner/save", banner)
      const savedFields = objectValue(saved)
      if (Object.keys(savedFields).length) {
        setBanner((current) => normalizeBanner({ ...current, ...savedFields }))
      }
      setShowBannerForm(false)
      toast.success("商城 Banner 已保存")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSavingBanner(false)
    }
  }

  async function saveCategory() {
    if (!categoryForm.name.trim()) return toast.error("请输入分类名称")
    setCategorySaving(true)
    try {
      await post("/digital-products/categories/save", categoryForm)
      const data = await get<unknown[]>("/digital-products/categories")
      setManagedCategories(Array.isArray(data) ? data.map(normalizeCategory) : [])
      setShowCategoryEditor(false)
      setCategoryForm({ id: null, name: "", enabled: true })
      toast.success(categoryForm.id ? "分类已更新" : "分类已创建")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setCategorySaving(false)
    }
  }

  async function toggleCategory(item: CategoryRow, enabled: boolean) {
    setManagedCategories((current) => current.map((entry) => (
      String(entry.id) === String(item.id) ? { ...entry, enabled } : entry
    )))
    try {
      await post("/digital-products/categories/save", { ...item, enabled })
      toast.success(enabled ? "分类已启用" : "分类已停用")
    } catch (error) {
      setManagedCategories((current) => current.map((entry) => (
        String(entry.id) === String(item.id) ? { ...entry, enabled: item.enabled } : entry
      )))
      toast.error(errorMessage(error))
    }
  }

  async function moveCategory(index: number, offset: number) {
    const targetIndex = index + offset
    if (targetIndex < 0 || targetIndex >= managedCategories.length) return
    const previous = [...managedCategories]
    const next = [...managedCategories]
    const moved = next.splice(index, 1)[0]
    if (!moved) return
    next.splice(targetIndex, 0, moved)
    setManagedCategories(next)
    try {
      await post("/digital-products/categories/sort", { ids: next.map((item) => item.id) })
      toast.success("分类排序已保存")
    } catch (error) {
      setManagedCategories(previous)
      toast.error(errorMessage(error))
    }
  }

  async function dropCategory(item: CategoryRow) {
    try {
      await post("/digital-products/categories/drop", { id: item.id })
      setManagedCategories((current) => current.filter(
        (entry) => String(entry.id) !== String(item.id),
      ))
      if (categoryFilter === item.name) setCategoryFilter("all")
      toast.success("分类已删除")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  async function saveFaq() {
    if (!faqForm.title.trim()) return toast.error("请输入问题标题")
    if (!faqForm.content.trim()) return toast.error("请输入问题内容")
    setFaqSaving(true)
    try {
      await post("/digital-products/faqs/save", faqForm)
      const data = await get<unknown[]>("/digital-products/faqs")
      const faqs = Array.isArray(data) ? data.map(normalizeFaq) : []
      setManagedFaqs(faqs)
      setFaqForm({
        id: null,
        title: "",
        content: "",
        enabled: true,
        sort: faqs.length + 1,
      })
      setShowFaqEditor(false)
      toast.success("常见问题已保存")
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setFaqSaving(false)
    }
  }

  async function toggleFaq(item: FaqRow, enabled: boolean) {
    setManagedFaqs((current) => current.map((entry) => (
      String(entry.id) === String(item.id) ? { ...entry, enabled } : entry
    )))
    try {
      await post("/digital-products/faqs/save", { ...item, enabled })
      toast.success(enabled ? "问题已显示" : "问题已隐藏")
    } catch (error) {
      setManagedFaqs((current) => current.map((entry) => (
        String(entry.id) === String(item.id) ? { ...entry, enabled: item.enabled } : entry
      )))
      toast.error(errorMessage(error))
    }
  }

  async function dropFaq(item: FaqRow) {
    try {
      await post("/digital-products/faqs/drop", { id: item.id })
      const next = managedFaqs.filter((entry) => String(entry.id) !== String(item.id))
      setManagedFaqs(next)
      if (String(faqForm.id) === String(item.id)) {
        setFaqForm({
          id: null,
          title: "",
          content: "",
          enabled: true,
          sort: next.length + 1,
        })
      }
      toast.success("常见问题已删除")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  function startFaqDrag(event: DragEvent<HTMLDivElement>, item: FaqRow) {
    if (faqSorting || shouldCancelDrag(event)) {
      event.preventDefault()
      return
    }
    faqDragSnapshot.current = managedFaqs.map((entry) => ({ ...entry }))
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(item.id))
    setFaqDraggingId(item.id)
    setFaqDragOverId(null)
  }

  function finishFaqDrag() {
    setFaqDraggingId(null)
    setFaqDragOverId(null)
  }

  async function dropFaqAt(event: DragEvent<HTMLDivElement>, target: FaqRow) {
    event.preventDefault()
    if (faqDraggingId == null) return
    const sourceIndex = managedFaqs.findIndex(
      (item) => String(item.id) === String(faqDraggingId),
    )
    const targetIndex = managedFaqs.findIndex(
      (item) => String(item.id) === String(target.id),
    )
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      finishFaqDrag()
      return
    }
    const next = [...managedFaqs]
    const moved = next.splice(sourceIndex, 1)[0]
    if (!moved) return
    next.splice(targetIndex, 0, moved)
    const sorted = next.map((item, index) => ({ ...item, sort: index + 1 }))
    setManagedFaqs(sorted)
    setFaqSorting(true)
    try {
      await Promise.all(
        sorted.map((item) => post("/digital-products/faqs/save", item)),
      )
      setFaqForm((current) => current.id ? current : { ...current, sort: sorted.length + 1 })
      toast.success("问题排序已保存")
    } catch (error) {
      setManagedFaqs(faqDragSnapshot.current)
      toast.error(errorMessage(error))
    } finally {
      setFaqSorting(false)
      finishFaqDrag()
    }
  }

  const bannerBackground = banner.image_url
    ? "linear-gradient(100deg, rgba(7, 21, 45, .92), rgba(2, 123, 254, .42)), url("
      + JSON.stringify(safeMediaUrl(banner.image_url)) + ")"
    : "linear-gradient(125deg, #0b1f42, #027bfe)"

  return (
    <PageShell className="digital-product-workbench">
      <PageHeader
        title="数字商品管理"
        description="管理数字商品、销售规格、交付方式与库存状态。"
        action={(
          <>
            <Button variant="outline" onClick={() => openCategory()}>
              <Tag />
              创建分类
            </Button>
            <Button onClick={() => openProduct()}>
              <Plus />
              新建商品
            </Button>
          </>
        )}
      />

      <MetricGrid className="xl:grid-cols-5">
        <MetricCard label="商品总数" value={rows.length} hint="全部数字商品" />
        <MetricCard label="销售中" value={selling.length} hint="当前可购买" />
        <MetricCard label="已下架" value={rows.length - selling.length} hint="隐藏或停售" />
        <MetricCard label="可售库存" value={totalStock} hint="全部可用库存" />
        <MetricCard label="已交付" value={totalDelivered} hint="累计完成交付" />
      </MetricGrid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(250px,.6fr)_minmax(250px,.58fr)]">
        <Card
          className="relative min-h-64 justify-center overflow-hidden border-0 bg-cover bg-center text-white shadow-lg"
          style={{ backgroundImage: bannerBackground }}
        >
          <CardContent className="relative z-10 max-w-xl space-y-4 p-7">
            <Badge className="bg-white/15 text-white ring-1 ring-white/20">DIGITAL STORE</Badge>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">{banner.title}</h2>
              <p className="mt-2 max-w-lg text-sm text-white/75">
                {banner.subtitle || "配置数字商品商城的品牌横幅、推广文案与跳转入口。"}
              </p>
            </div>
            <Button className="bg-white text-[#027bfe] hover:bg-white/90" onClick={() => setShowBannerForm(true)}>
              <ImageIcon />
              编辑横幅
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快捷操作</CardTitle>
            <CardDescription>常用管理入口</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { label: "新建商品", icon: Plus, action: () => openProduct() },
              { label: "横幅配置", icon: ImageIcon, action: () => setShowBannerForm(true) },
              { label: "库存管理", icon: Database, action: () => navigate("/digital/inventory") },
              { label: "交付记录", icon: ClipboardList, action: () => navigate("/digital/delivery") },
              { label: "常见问题", icon: BookOpen, action: () => openFaq(), wide: true },
            ].map((item) => (
              <Button
                key={item.label}
                variant="outline"
                className={cn("h-auto min-h-14 justify-start whitespace-normal px-3 py-3", item.wide && "col-span-2")}
                onClick={item.action}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </span>
                {item.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div>
              <CardTitle>商品分类</CardTitle>
              <CardDescription>{managedCategories.length} 个独立分类</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowCategoryManager(true)}>
              <Layers3 />
              管理
            </Button>
          </CardHeader>
          <CardContent className="grid max-h-48 gap-1 overflow-y-auto">
            <Button
              variant={categoryFilter === "all" ? "secondary" : "ghost"}
              className="justify-between"
              onClick={() => setCategoryFilter("all")}
            >
              <span className="flex items-center gap-2"><Package />全部分类</span>
              <Badge variant="outline">{rows.length}</Badge>
            </Button>
            {managedCategories.map((item) => (
              <Button
                key={item.id}
                variant={categoryFilter === item.name ? "secondary" : "ghost"}
                className="h-auto justify-between py-2"
                onClick={() => setCategoryFilter(item.name)}
              >
                <span className="min-w-0 text-left">
                  <strong className="block truncate font-medium">{item.name}</strong>
                  <small className="text-muted-foreground">{item.enabled ? "前台显示" : "已停用"}</small>
                </span>
                <Badge variant="outline">{item.plans_count}</Badge>
              </Button>
            ))}
            {!managedCategories.length && <EmptyState>暂无分类</EmptyState>}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <div className="space-y-1">
              <CardTitle>商品列表</CardTitle>
              <CardDescription>
                {sorting ? "正在保存商品顺序…" : "按住商品行空白区域拖动可调整前台顺序。"}
              </CardDescription>
            </div>
            <Badge variant="outline">{filteredRows.length} / {rows.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-wrap gap-1">
                {([
                  ["all", "全部商品"],
                  ["selling", "销售中"],
                  ["off", "已下架"],
                  ["low", "库存不足"],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    variant={statusFilter === value ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_minmax(220px,1fr)]">
                <SelectField
                  label="筛选分类"
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                  options={[
                    { value: "all", label: "全部分类" },
                    ...managedCategories.map((item) => ({ value: item.name, label: item.name })),
                  ]}
                />
                <div className="grid gap-2">
                  <Label htmlFor="digital-product-search">搜索商品</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="digital-product-search"
                      className="pl-8"
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      placeholder="名称、说明或分类"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">销售</TableHead>
                  <TableHead>商品信息</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>库存</TableHead>
                  <TableHead>销量</TableHead>
                  <TableHead>交付</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9}><EmptyState>正在加载数字商品…</EmptyState></TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}><EmptyState>没有符合条件的商品</EmptyState></TableCell>
                  </TableRow>
                ) : filteredRows.map((row) => {
                  const imageUrl = safeMediaUrl(row.product_config.image_url)
                  const isDragging = String(draggingId) === String(row.id)
                  const isDragOver = String(dragOverId) === String(row.id)
                  return (
                    <TableRow
                      key={row.id}
                      draggable={!sorting}
                      className={cn(
                        "cursor-grab active:cursor-grabbing",
                        isDragging && "opacity-35",
                        isDragOver && "shadow-[inset_0_3px_0_#027bfe]",
                      )}
                      onDragStart={(event) => startProductDrag(event, row)}
                      onDragEnd={finishProductDrag}
                      onDragOver={(event) => {
                        event.preventDefault()
                        if (draggingId != null && String(draggingId) !== String(row.id)) {
                          setDragOverId(row.id)
                        }
                      }}
                      onDrop={(event) => void dropProduct(event, row)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GripVertical className="size-4 text-muted-foreground" />
                          <Switch
                            checked={row.show && row.sell}
                            onCheckedChange={(enabled) => void toggleSelling(row, enabled)}
                            aria-label={(row.show && row.sell) ? "下架商品" : "上架商品"}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-60 items-center gap-3">
                          <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
                            {imageUrl
                              ? <img className="size-full object-cover" src={imageUrl} alt="" />
                              : row.name.slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <strong className="block max-w-64 truncate">{row.name}</strong>
                            <small className="block max-w-64 truncate text-muted-foreground">
                              #{row.id} · {row.content || "未填写说明"}
                            </small>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{productCategoryName(row)}</Badge></TableCell>
                      <TableCell className="font-medium">¥ {lowestPrice(row).toFixed(2)}</TableCell>
                      <TableCell className={cn(row.stock_count <= 10 && "font-semibold text-destructive")}>{row.stock_count}</TableCell>
                      <TableCell>{row.sold_count}</TableCell>
                      <TableCell>{row.product_config.delivery_type === "text" ? "人工" : "自动"}</TableCell>
                      <TableCell>
                        <StatusBadge tone={row.show && row.sell ? "default" : "neutral"}>
                          {row.show && row.sell ? "销售中" : "已下架"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openProduct(row)}>
                          <Pencil />
                          编辑
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div>
              <CardTitle>库存预警</CardTitle>
              <CardDescription>库存不高于 10 的商品</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/digital/inventory")}>
              查看全部
            </Button>
          </CardHeader>
          <CardContent className="grid gap-1">
            {lowStock.map((row) => (
              <div key={row.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-semibold text-primary">
                  {row.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{row.name}</strong>
                  <small className="text-muted-foreground">剩余 {row.stock_count} 件</small>
                </div>
                <Badge variant={row.stock_count ? "secondary" : "destructive"}>
                  {row.stock_count ? "库存不足" : "缺货"}
                </Badge>
              </div>
            ))}
            {!lowStock.length && <EmptyState>库存状态良好</EmptyState>}
          </CardContent>
        </Card>
      </div>

      <Card id="digital-faq-panel">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </span>
            <div>
              <CardTitle>常见问题</CardTitle>
              <CardDescription>按住整行拖动，调整前台展示顺序。</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{faqSorting ? "保存中…" : managedFaqs.length + " 个问题"}</Badge>
            <Button size="sm" onClick={() => openFaq()}>
              <Plus />
              添加问题
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {managedFaqs.map((item) => {
            const isDragging = String(faqDraggingId) === String(item.id)
            const isDragOver = String(faqDragOverId) === String(item.id)
            return (
              <div
                key={item.id}
                draggable={!faqSorting}
                className={cn(
                  "grid cursor-grab gap-3 rounded-xl border p-3 transition active:cursor-grabbing md:grid-cols-[72px_minmax(0,1fr)_auto] md:items-center",
                  !item.enabled && "opacity-60",
                  isDragging && "opacity-35",
                  isDragOver && "shadow-[inset_0_3px_0_#027bfe]",
                )}
                onDragStart={(event) => startFaqDrag(event, item)}
                onDragEnd={finishFaqDrag}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (faqDraggingId != null && String(faqDraggingId) !== String(item.id)) {
                    setFaqDragOverId(item.id)
                  }
                }}
                onDrop={(event) => void dropFaqAt(event, item)}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-muted-foreground" />
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={(enabled) => void toggleFaq(item, enabled)}
                    aria-label={item.enabled ? "隐藏问题" : "显示问题"}
                  />
                </div>
                <div className="min-w-0">
                  <strong className="block truncate">{item.title}</strong>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => openFaq(item)}>
                    <Pencil />
                    编辑
                  </Button>
                  <ConfirmAction
                    title="删除常见问题"
                    description={"确定删除「" + item.title + "」？"}
                    confirmText="删除问题"
                    onConfirm={() => dropFaq(item)}
                  >
                    <Trash2 />
                    删除
                  </ConfirmAction>
                </div>
              </div>
            )
          })}
          {!managedFaqs.length && <EmptyState>暂无常见问题，请先添加。</EmptyState>}
        </CardContent>
      </Card>

      <PageDialog
        open={showFaqEditor}
        onOpenChange={setShowFaqEditor}
        title={faqForm.id ? "编辑问题" : "添加问题"}
        description={faqForm.id ? "修改问题内容和显示状态。" : "创建新的常见问题内容。"}
        className="sm:max-w-xl"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowFaqEditor(false)}>取消</Button>
            <Button disabled={faqSaving} onClick={() => void saveFaq()}>
              {faqSaving && <LoaderCircle className="animate-spin" />}
              {faqSaving ? "保存中…" : faqForm.id ? "保存修改" : "添加问题"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="digital-faq-title">问题标题 *</Label>
            <Input
              id="digital-faq-title"
              value={faqForm.title}
              maxLength={150}
              onChange={(event) => setFaqForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="例如：购买后如何交付？"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="digital-faq-content">问题内容 *</Label>
            <Textarea
              id="digital-faq-content"
              value={faqForm.content}
              rows={7}
              maxLength={5000}
              onChange={(event) => setFaqForm((current) => ({ ...current, content: event.target.value }))}
              placeholder="输入清晰、简洁的答案内容"
            />
          </div>
          <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
            <Switch
              checked={faqForm.enabled}
              onCheckedChange={(enabled) => setFaqForm((current) => ({ ...current, enabled }))}
            />
            <span>
              <strong className="block">前台显示</strong>
              <small className="text-muted-foreground">{faqForm.enabled ? "问题会在商城展示" : "问题暂时隐藏"}</small>
            </span>
          </label>
        </div>
      </PageDialog>

      <PageDialog
        open={showBannerForm}
        onOpenChange={setShowBannerForm}
        title="编辑商城横幅"
        description="设置前台数字商品页面顶部展示内容。"
        className="sm:max-w-3xl"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowBannerForm(false)}>取消</Button>
            <Button disabled={savingBanner} onClick={() => void saveBanner()}>
              {savingBanner && <LoaderCircle className="animate-spin" />}
              {savingBanner ? "保存中…" : "保存横幅"}
            </Button>
          </>
        )}
      >
        <div className="space-y-5">
          <div
            className="flex min-h-44 items-end rounded-xl bg-cover bg-center p-5 text-white"
            style={{ backgroundImage: bannerBackground }}
          >
            <div>
              <strong className="block text-xl">{banner.title || "横幅标题"}</strong>
              <span className="text-sm text-white/75">{banner.subtitle || "横幅副标题"}</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="digital-banner-image">横幅图片</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="digital-banner-image"
                  value={banner.image_url}
                  onChange={(event) => setBanner((current) => ({ ...current, image_url: event.target.value }))}
                  placeholder="图片 URL 或上传图片"
                />
                <input
                  ref={bannerInputRef}
                  className="hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void uploadSingle("banner", "/digital-products/banner/upload", event)}
                />
                <Button variant="outline" disabled={uploadingBanner} onClick={() => bannerInputRef.current?.click()}>
                  {uploadingBanner ? <LoaderCircle className="animate-spin" /> : <Upload />}
                  {uploadingBanner ? "上传中…" : "上传图片"}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="digital-banner-title">标题 *</Label>
              <Input
                id="digital-banner-title"
                value={banner.title}
                maxLength={100}
                onChange={(event) => setBanner((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="digital-banner-subtitle">副标题</Label>
              <Input
                id="digital-banner-subtitle"
                value={banner.subtitle}
                maxLength={255}
                onChange={(event) => setBanner((current) => ({ ...current, subtitle: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="digital-banner-button">按钮文字</Label>
              <Input
                id="digital-banner-button"
                value={banner.button_text}
                maxLength={30}
                onChange={(event) => setBanner((current) => ({ ...current, button_text: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="digital-banner-link">跳转链接</Label>
              <Input
                id="digital-banner-link"
                value={banner.link_url}
                maxLength={2048}
                onChange={(event) => setBanner((current) => ({ ...current, link_url: event.target.value }))}
              />
            </div>
          </div>
        </div>
      </PageDialog>

      <PageDialog
        open={showForm}
        onOpenChange={setShowForm}
        title={form.id ? "编辑数字商品" : "新建数字商品"}
        description="配置商品资料、交付方式、详情展示与销售规格。"
        className="sm:max-w-5xl"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button disabled={saving} onClick={() => void saveProduct()}>
              {saving && <LoaderCircle className="animate-spin" />}
              {saving ? "保存中…" : "保存商品"}
            </Button>
          </>
        )}
      >
        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <h3 className="font-medium">基础资料</h3>
              <p className="text-sm text-muted-foreground">商品名称、分类和前台销售状态。</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="digital-product-name">商品名称 *</Label>
                <Input
                  id="digital-product-name"
                  value={form.name}
                  maxLength={100}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="digital-product-content">商品说明</Label>
                <Textarea
                  id="digital-product-content"
                  value={form.content}
                  rows={3}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                />
              </div>
              <SelectField
                label="商品分类 *"
                value={form.digital_category_id}
                onValueChange={selectProductCategory}
                options={[
                  { value: "", label: "请选择分类" },
                  ...managedCategories
                    .filter((item) => item.enabled || String(item.id) === String(form.digital_category_id))
                    .map((item) => ({
                      value: item.id,
                      label: item.name + (item.enabled ? "" : "（已停用）"),
                    })),
                ]}
              />
              <label className="flex items-center gap-3 self-end rounded-lg border p-3 text-sm">
                <Switch
                  checked={form.product_config.delivery_type !== "text"}
                  onCheckedChange={(automatic) => setForm((current) => ({
                    ...current,
                    product_config: {
                      ...current.product_config,
                      delivery_type: automatic ? "code" : "text",
                    },
                  }))}
                />
                <span>
                  <strong className="block">交付方式</strong>
                  <small className="text-muted-foreground">
                    {form.product_config.delivery_type === "text" ? "人工交付" : "自动交付"}
                  </small>
                </span>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "首页推荐",
                  checked: form.product_config.featured,
                  onChange: (featured: boolean) => setForm((current) => ({
                    ...current,
                    product_config: { ...current.product_config, featured },
                  })),
                  on: "已推荐",
                  off: "普通商品",
                },
                {
                  label: "展示状态",
                  checked: form.show,
                  onChange: (show: boolean) => setForm((current) => ({ ...current, show })),
                  on: "已展示",
                  off: "已隐藏",
                },
                {
                  label: "购买状态",
                  checked: form.sell,
                  onChange: (sell: boolean) => setForm((current) => ({ ...current, sell })),
                  on: "销售中",
                  off: "已停售",
                },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <Switch checked={item.checked} onCheckedChange={item.onChange} />
                  <span><strong className="block">{item.label}</strong><small className="text-muted-foreground">{item.checked ? item.on : item.off}</small></span>
                </label>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h3 className="font-medium">商品封面</h3>
              <p className="text-sm text-muted-foreground">支持 URL 或上传 PNG、JPEG、WebP、GIF。</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
              <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border bg-muted">
                {safeMediaUrl(form.product_config.image_url)
                  ? <img className="size-full object-cover" src={safeMediaUrl(form.product_config.image_url)} alt="商品封面预览" />
                  : <ImageIcon className="size-10 text-muted-foreground" />}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="digital-cover-url">封面地址</Label>
                <Input
                  id="digital-cover-url"
                  value={form.product_config.image_url}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    product_config: { ...current.product_config, image_url: event.target.value },
                  }))}
                  placeholder="图片 URL 或上传图片"
                />
                <input
                  ref={coverInputRef}
                  className="hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => void uploadSingle("cover", "/digital-products/cover/upload", event)}
                />
                <Button className="w-fit" variant="outline" disabled={uploadingCover} onClick={() => coverInputRef.current?.click()}>
                  {uploadingCover ? <LoaderCircle className="animate-spin" /> : <Upload />}
                  {uploadingCover ? "上传中…" : "上传封面"}
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-medium">商品详情（Markdown）</h3>
                <p className="text-sm text-muted-foreground">支持标题、图片、链接、列表、粗体和行内代码。</p>
              </div>
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                <Button variant={!detailPreview ? "default" : "ghost"} size="sm" onClick={() => setDetailPreview(false)}>编辑</Button>
                <Button variant={detailPreview ? "default" : "ghost"} size="sm" onClick={() => setDetailPreview(true)}>预览</Button>
              </div>
            </div>
            {detailPreview ? (
              <MarkdownPreview source={form.product_config.detail_markdown} />
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <div className="flex flex-wrap gap-1 border-b bg-muted/40 p-2">
                  <Button variant="outline" size="xs" onClick={() => insertMarkdown("## ", "", "标题")}>H2</Button>
                  <Button variant="outline" size="xs" onClick={() => insertMarkdown("**", "**", "粗体")}>B</Button>
                  <Button variant="outline" size="xs" onClick={() => insertMarkdown("- ", "", "列表项")}>列表</Button>
                  <Button variant="outline" size="xs" onClick={() => insertMarkdown("[", "](https://)", "链接文字")}>链接</Button>
                  <Button variant="outline" size="xs" onClick={() => insertMarkdown("![", "](/storage/图片地址)", "图片说明")}>图片</Button>
                </div>
                <Textarea
                  ref={detailEditorRef}
                  className="min-h-64 resize-y rounded-none border-0 font-mono focus-visible:ring-0"
                  value={form.product_config.detail_markdown}
                  rows={12}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    product_config: {
                      ...current.product_config,
                      detail_markdown: event.target.value,
                    },
                  }))}
                  placeholder={"# 商品详情\n\n支持 Markdown 标题、图片、链接、列表、粗体和代码。"}
                />
              </div>
            )}
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">详情图片</h3>
                <p className="text-sm text-muted-foreground">可多选上传，用户可在详情页浏览。</p>
              </div>
              <input
                ref={galleryInputRef}
                className="hidden"
                multiple
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => void uploadGallery(event)}
              />
              <Button variant="outline" disabled={uploadingGallery} onClick={() => galleryInputRef.current?.click()}>
                {uploadingGallery ? <LoaderCircle className="animate-spin" /> : <ImageIcon />}
                {uploadingGallery ? "上传中…" : "上传图片"}
              </Button>
            </div>
            {form.product_config.gallery.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {form.product_config.gallery.map((url, index) => (
                  <figure key={url + index} className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
                    <img className="size-full object-cover" src={safeMediaUrl(url)} alt="" />
                    <Button
                      className="absolute right-2 top-2 opacity-0 shadow-sm group-hover:opacity-100"
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setForm((current) => ({
                        ...current,
                        product_config: {
                          ...current.product_config,
                          gallery: current.product_config.gallery.filter((_, itemIndex) => itemIndex !== index),
                        },
                      }))}
                    >
                      <X />
                    </Button>
                  </figure>
                ))}
              </div>
            ) : (
              <EmptyState>暂无详情图片</EmptyState>
            )}
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">商品规格 *</h3>
                <p className="text-sm text-muted-foreground">价格单位为元；库存由库存管理页独立维护。</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setForm((current) => ({
                  ...current,
                  product_config: {
                    ...current.product_config,
                    packages: [...current.product_config.packages, emptyPackage()],
                  },
                }))}
              >
                <PackagePlus />
                添加规格
              </Button>
            </div>
            <div className="grid gap-3">
              {form.product_config.packages.map((item, index) => (
                <Card key={index} size="sm">
                  <CardContent className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_120px_minmax(180px,1.4fr)_auto] lg:items-end">
                    <div className="grid gap-2">
                      <Label>规格标识</Label>
                      <Input value={item.id} onChange={(event) => patchProductPackage(index, { id: event.target.value })} placeholder="规格标识" />
                    </div>
                    <div className="grid gap-2">
                      <Label>规格名称</Label>
                      <Input value={item.name} onChange={(event) => patchProductPackage(index, { name: event.target.value })} placeholder="规格名称" />
                    </div>
                    <div className="grid gap-2">
                      <Label>售价</Label>
                      <Input type="number" min={0} step="0.01" value={item.price} onChange={(event) => patchProductPackage(index, { price: Number(event.target.value) })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>划线价</Label>
                      <Input type="number" min={0} step="0.01" value={item.original_price} onChange={(event) => patchProductPackage(index, { original_price: Number(event.target.value) })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>规格说明</Label>
                      <Input value={item.description} onChange={(event) => patchProductPackage(index, { description: event.target.value })} placeholder="规格说明" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">库存 {item.stock_count || 0}</Badge>
                      <Button
                        variant="destructive"
                        size="icon"
                        disabled={form.product_config.packages.length <= 1}
                        onClick={() => setForm((current) => ({
                          ...current,
                          product_config: {
                            ...current.product_config,
                            packages: current.product_config.packages.filter((_, itemIndex) => itemIndex !== index),
                          },
                        }))}
                        aria-label="移除规格"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      </PageDialog>

      <PageDialog
        open={showCategoryEditor}
        onOpenChange={setShowCategoryEditor}
        title={categoryForm.id ? "编辑分类" : "创建分类"}
        description={categoryForm.id ? "修改分类名称和显示状态。" : "新建一个用于归类数字商品的独立分类。"}
        className="sm:max-w-md"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowCategoryEditor(false)}>取消</Button>
            <Button disabled={categorySaving} onClick={() => void saveCategory()}>
              {categorySaving && <LoaderCircle className="animate-spin" />}
              {categorySaving ? "保存中…" : categoryForm.id ? "保存修改" : "创建分类"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="digital-category-name">分类名称 *</Label>
            <Input
              id="digital-category-name"
              value={categoryForm.name}
              maxLength={50}
              onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
              onKeyDown={(event) => event.key === "Enter" && void saveCategory()}
              placeholder="输入分类名称"
            />
          </div>
          <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
            <Switch
              checked={categoryForm.enabled}
              onCheckedChange={(enabled) => setCategoryForm((current) => ({ ...current, enabled }))}
            />
            <span><strong className="block">显示状态</strong><small className="text-muted-foreground">{categoryForm.enabled ? "已启用" : "已停用"}</small></span>
          </label>
        </div>
      </PageDialog>

      <PageDialog
        open={showCategoryManager}
        onOpenChange={setShowCategoryManager}
        title="分类管理"
        description="分类通过独立数据表维护，可调整顺序、显示状态或删除未使用分类。"
        className="sm:max-w-4xl"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowCategoryManager(false)}>关闭</Button>
            <Button onClick={() => openCategory()}><Plus />创建分类</Button>
          </>
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">顺序</TableHead>
              <TableHead>分类名称</TableHead>
              <TableHead>商品数</TableHead>
              <TableHead>显示状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!managedCategories.length ? (
              <TableRow><TableCell colSpan={5}><EmptyState>暂无分类</EmptyState></TableCell></TableRow>
            ) : managedCategories.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell><GripVertical className="size-4 text-muted-foreground" /></TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.plans_count} 个商品</TableCell>
                <TableCell>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={item.enabled} onCheckedChange={(enabled) => void toggleCategory(item, enabled)} />
                    {item.enabled ? "显示" : "停用"}
                  </label>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon-sm" disabled={index === 0} onClick={() => void moveCategory(index, -1)} aria-label="上移分类"><ChevronUp /></Button>
                    <Button variant="outline" size="icon-sm" disabled={index === managedCategories.length - 1} onClick={() => void moveCategory(index, 1)} aria-label="下移分类"><ChevronDown /></Button>
                    <Button variant="outline" size="sm" onClick={() => openCategory(item)}><Pencil />编辑</Button>
                    <ConfirmAction
                      title="删除商品分类"
                      description={"确定删除分类「" + item.name + "」？仅空分类允许删除。"}
                      confirmText="删除分类"
                      disabled={item.plans_count > 0}
                      onConfirm={() => dropCategory(item)}
                    >
                      <Trash2 />
                      删除
                    </ConfirmAction>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PageDialog>
    </PageShell>
  )
}
