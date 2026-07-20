<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import AppIcon from "../components/AppIcon.vue";
import ToggleSwitch from "../components/ToggleSwitch.vue";
import { get, post } from "../services/http";

const router = useRouter();
const rows = ref([]),
    loading = ref(true),
    saving = ref(false),
    showForm = ref(false),
    showBannerForm = ref(false),
    showCategoryEditor = ref(false),
    showCategoryManager = ref(false),
    showFaqEditor = ref(false);
const managedCategories = ref([]),
    categorySaving = ref(false);
const categoryForm = reactive({ id: null, name: "", enabled: true });
const managedFaqs = ref([]),
    faqSaving = ref(false);
const faqForm = reactive({ id: null, title: "", content: "", enabled: true, sort: 0 });
const savingBanner = ref(false),
    uploadingBanner = ref(false),
    uploadingCover = ref(false);
const uploadingGallery = ref(false),
    detailPreview = ref(false);
const keyword = ref(""),
    statusFilter = ref("all"),
    categoryFilter = ref("all");
const draggingId = ref(null),
    dragOverId = ref(null),
    sorting = ref(false);
const faqDraggingId = ref(null),
    faqDragOverId = ref(null),
    faqSorting = ref(false);
let dragSnapshot = [];
let dragGhost = null;
let faqDragGhost = null;
const toast = reactive({ text: "", type: "" });
const banner = reactive({
    image_url: "",
    title: "数字商品中心",
    subtitle: "",
    button_text: "了解更多",
    link_url: "#digital-products",
});
const emptyPackage = () => ({
    id: `spec-${Date.now()}`,
    name: "标准版",
    price: 0,
    original_price: 0,
    description: "",
});
const form = reactive({
    id: null,
    digital_category_id: null,
    name: "",
    content: "",
    show: true,
    sell: true,
    product_config: {
        delivery_type: "code",
        category: "数字商品",
        image_url: "",
        detail_markdown: "",
        gallery: [],
        featured: false,
        packages: [emptyPackage()],
    },
});

const selling = computed(() =>
    rows.value.filter((row) => row.show && row.sell),
);
const categories = computed(() => managedCategories.value.map((item) => item.name));
const categoryStats = computed(() =>
    managedCategories.value.map((item) => ({
        ...item,
        count: Number(item.plans_count || 0),
    })),
);
const lowStock = computed(() =>
    rows.value
        .filter((row) => Number(row.stock_count || 0) <= 10)
        .sort((a, b) => Number(a.stock_count || 0) - Number(b.stock_count || 0))
        .slice(0, 4),
);
const filteredRows = computed(() =>
    rows.value.filter((row) => {
        const text =
            `${row.name} ${row.content || ""} ${row.product_config?.category || ""}`.toLowerCase();
        const statusOk =
            statusFilter.value === "all" ||
            (statusFilter.value === "selling"
                ? row.show && row.sell
                : statusFilter.value === "off"
                  ? !row.show || !row.sell
                  : Number(row.stock_count || 0) <= 10);
        return (
            text.includes(keyword.value.trim().toLowerCase()) &&
            statusOk &&
            (categoryFilter.value === "all" ||
                (row.product_config?.category || "数字商品") ===
                    categoryFilter.value)
        );
    }),
);

function notify(text, type = "") {
    toast.text = text;
    toast.type = type;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
        toast.text = "";
    }, 2600);
}
function lowestPrice(row) {
    const prices = (row.product_config?.packages || [])
        .map((item) => Number(item.price || 0))
        .filter(Boolean);
    return prices.length ? Math.min(...prices) : 0;
}
function startDrag(event, row) {
    dragOverId.value = null;
    dragSnapshot = rows.value.map((item) => item.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(row.id));

    const source = event.currentTarget;
    const rect = source.getBoundingClientRect();
    const table = document.createElement("table");
    const body = document.createElement("tbody");
    const clone = source.cloneNode(true);
    table.className = "digital-row-drag-preview";
    table.style.width = `${rect.width}px`;
    Array.from(source.children).forEach((cell, index) => {
        clone.children[index].style.width =
            `${cell.getBoundingClientRect().width}px`;
    });
    clone.classList.remove("is-dragging", "is-drag-over");
    body.appendChild(clone);
    table.appendChild(body);
    document.body.appendChild(table);
    dragGhost = table;
    event.dataTransfer.setDragImage(table, 32, rect.height / 2);

    requestAnimationFrame(() => {
        draggingId.value = row.id;
    });
}
function dragOverRow(row) {
    if (draggingId.value && draggingId.value !== row.id) {
        dragOverId.value = row.id;
    }
}
function finishDrag() {
    draggingId.value = null;
    dragOverId.value = null;
    dragGhost?.remove();
    dragGhost = null;
}
async function dropRow(target) {
    const sourceIndex = rows.value.findIndex(
        (item) => item.id === draggingId.value,
    );
    const targetIndex = rows.value.findIndex((item) => item.id === target.id);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
        return;
    const next = [...rows.value];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    rows.value = next;
    sorting.value = true;
    try {
        await post("/digital-products/sort", {
            ids: next.map((item) => item.id),
        });
        notify("商品排序已保存");
    } catch (e) {
        rows.value = dragSnapshot
            .map((id) => next.find((item) => item.id === id))
            .filter(Boolean);
        notify(e.message, "error");
    } finally {
        sorting.value = false;
        finishDrag();
    }
}
async function toggleSelling(row, enabled) {
    const previous = { show: row.show, sell: row.sell };
    row.show = enabled;
    row.sell = enabled;
    try {
        await post("/digital-products/status", { id: row.id, enabled });
        notify(enabled ? "商品已上架销售" : "商品已下架");
    } catch (e) {
        Object.assign(row, previous);
        notify(e.message, "error");
    }
}
async function load() {
    loading.value = true;
    try {
        const [data, bannerData, categoryData, faqData] = await Promise.all([
            get("/digital-products/fetch"),
            get("/digital-products/banner"),
            get("/digital-products/categories"),
            get("/digital-products/faqs"),
        ]);
        rows.value = Array.isArray(data) ? data : [];
        managedCategories.value = Array.isArray(categoryData) ? categoryData : [];
        managedFaqs.value = Array.isArray(faqData) ? faqData : [];
        if (!faqForm.id) faqForm.sort = managedFaqs.value.length + 1;
        Object.assign(banner, bannerData || {});
    } catch (e) {
        notify(e.message, "error");
    } finally {
        loading.value = false;
    }
}
function open(row = null) {
    Object.assign(form, {
        id: row?.id || null,
        digital_category_id:
            row?.digital_category_id ||
            managedCategories.value.find((item) => item.enabled)?.id ||
            null,
        name: row?.name || "",
        content: row?.content || "",
        show: row?.show ?? true,
        sell: row?.sell ?? true,
        product_config: {
            delivery_type: row
                ? row.product_config?.delivery_type || "text"
                : "code",
            category: row?.product_config?.category || "数字商品",
            image_url: row?.product_config?.image_url || "",
            detail_markdown: row?.product_config?.detail_markdown || "",
            gallery: [...(row?.product_config?.gallery || [])],
            featured: Boolean(row?.product_config?.featured),
            packages: row?.product_config?.packages?.length
                ? row.product_config.packages.map((item) => ({
                      original_price: 0,
                      description: "",
                      ...item,
                  }))
                : [emptyPackage()],
        },
    });
    showForm.value = true;
}
function openCategory(item = null) {
    Object.assign(categoryForm, {
        id: item?.id || null,
        name: item?.name || "",
        enabled: item?.enabled ?? true,
    });
    showCategoryEditor.value = true;
}
function openCategoryManager() {
    showCategoryManager.value = true;
}
function openFaq(item = null) {
    Object.assign(faqForm, {
        id: item?.id || null,
        title: item?.title || "",
        content: item?.content || "",
        enabled: item?.enabled ?? true,
        sort: item?.sort ?? managedFaqs.value.length + 1,
    });
    showFaqEditor.value = true;
}
async function saveFaq() {
    if (!faqForm.title.trim()) return notify("请输入问题标题", "error");
    if (!faqForm.content.trim()) return notify("请输入问题内容", "error");
    faqSaving.value = true;
    try {
        await post("/digital-products/faqs/save", faqForm);
        managedFaqs.value = await get("/digital-products/faqs");
        Object.assign(faqForm, { id: null, title: "", content: "", enabled: true, sort: managedFaqs.value.length + 1 });
        showFaqEditor.value = false;
        notify("常见问题已保存");
    } catch (e) {
        notify(e.message, "error");
    } finally {
        faqSaving.value = false;
    }
}
async function editFaq(item) {
    openFaq(item);
}
async function toggleFaq(item, enabled) {
    try {
        await post("/digital-products/faqs/save", { ...item, enabled });
        item.enabled = enabled;
        notify(enabled ? "问题已显示" : "问题已隐藏");
    } catch (e) {
        notify(e.message, "error");
    }
}
async function dropFaq(item) {
    if (!window.confirm(`确认删除“${item.title}”？`)) return;
    try {
        await post("/digital-products/faqs/drop", { id: item.id });
        managedFaqs.value = managedFaqs.value.filter((entry) => entry.id !== item.id);
        if (faqForm.id === item.id) Object.assign(faqForm, { id: null, title: "", content: "", enabled: true, sort: managedFaqs.value.length + 1 });
        notify("常见问题已删除");
    } catch (e) {
        notify(e.message, "error");
    }
}
function startFaqDrag(event, item) {
    faqDraggingId.value = item.id;
    faqDragOverId.value = null;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(item.id));
    const source = event.currentTarget;
    const rect = source.getBoundingClientRect();
    const clone = source.cloneNode(true);
    clone.classList.remove("is-dragging", "is-drag-over", "muted");
    clone.classList.add("digital-faq-drag-preview");
    clone.style.width = `${rect.width}px`;
    document.body.appendChild(clone);
    faqDragGhost = clone;
    event.dataTransfer.setDragImage(clone, 34, rect.height / 2);
}
function finishFaqDrag() {
    faqDraggingId.value = null;
    faqDragOverId.value = null;
    faqDragGhost?.remove();
    faqDragGhost = null;
}
async function dropFaqAt(target) {
    const sourceIndex = managedFaqs.value.findIndex((item) => item.id === faqDraggingId.value);
    const targetIndex = managedFaqs.value.findIndex((item) => item.id === target.id);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return finishFaqDrag();
    const previous = managedFaqs.value.map((item) => ({ ...item }));
    const next = [...managedFaqs.value];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    next.forEach((item, index) => { item.sort = index + 1; });
    managedFaqs.value = next;
    faqSorting.value = true;
    try {
        await Promise.all(next.map((item) => post("/digital-products/faqs/save", item)));
        if (!faqForm.id) faqForm.sort = next.length + 1;
        notify("问题排序已保存");
    } catch (e) {
        managedFaqs.value = previous;
        notify(e.message, "error");
    } finally {
        faqSorting.value = false;
        finishFaqDrag();
    }
}
async function saveCategory() {
    if (!categoryForm.name.trim()) return notify("请输入分类名称", "error");
    categorySaving.value = true;
    try {
        await post("/digital-products/categories/save", categoryForm);
        notify(categoryForm.id ? "分类已更新" : "分类已创建");
        showCategoryEditor.value = false;
        Object.assign(categoryForm, { id: null, name: "", enabled: true });
        const data = await get("/digital-products/categories");
        managedCategories.value = Array.isArray(data) ? data : [];
    } catch (e) {
        notify(e.message, "error");
    } finally {
        categorySaving.value = false;
    }
}
async function toggleCategory(item, enabled) {
    try {
        await post("/digital-products/categories/save", { ...item, enabled });
        item.enabled = enabled;
        notify(enabled ? "分类已启用" : "分类已停用");
    } catch (e) {
        notify(e.message, "error");
    }
}
async function moveCategory(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= managedCategories.value.length) return;
    const next = [...managedCategories.value];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    try {
        managedCategories.value = next;
        await post("/digital-products/categories/sort", { ids: next.map((item) => item.id) });
        notify("分类排序已保存");
    } catch (e) {
        notify(e.message, "error");
        await load();
    }
}
async function dropCategory(item) {
    if (!window.confirm(`确认删除分类“${item.name}”？`)) return;
    try {
        await post("/digital-products/categories/drop", { id: item.id });
        managedCategories.value = managedCategories.value.filter((entry) => entry.id !== item.id);
        notify("分类已删除");
    } catch (e) {
        notify(e.message, "error");
    }
}
function addPackage() {
    form.product_config.packages.push(emptyPackage());
}
function removePackage(index) {
    if (form.product_config.packages.length > 1)
        form.product_config.packages.splice(index, 1);
}
async function save() {
    const packages = form.product_config.packages.filter(
        (item) =>
            item.id?.trim() && item.name?.trim() && Number(item.price) > 0,
    );
    if (!form.name.trim()) return notify("请输入商品名称", "error");
    if (!form.digital_category_id) return notify("请选择商品分类", "error");
    if (!packages.length) return notify("请至少设置一个有效规格", "error");
    saving.value = true;
    try {
        await post("/digital-products/save", {
            ...form,
            prices: {},
            product_config: { ...form.product_config, packages },
        });
        showForm.value = false;
        notify(form.id ? "商品已更新" : "商品已创建");
        await load();
    } catch (e) {
        notify(e.message, "error");
    } finally {
        saving.value = false;
    }
}
async function upload(path, event, target) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    target.value = true;
    try {
        const result = await post(path, body);
        if (path.includes("banner")) banner.image_url = result.url;
        else form.product_config.image_url = result.url;
        notify("图片上传成功");
    } catch (e) {
        notify(e.message, "error");
    } finally {
        target.value = false;
        event.target.value = "";
    }
}
async function uploadGallery(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    uploadingGallery.value = true;
    try {
        for (const file of files) {
            const body = new FormData();
            body.append("file", file);
            const result = await post("/digital-products/cover/upload", body);
            form.product_config.gallery.push(result.url);
        }
        notify("详情图片上传成功");
    } catch (e) {
        notify(e.message, "error");
    } finally {
        uploadingGallery.value = false;
        event.target.value = "";
    }
}
function insertMarkdown(prefix, suffix = "", placeholder = "内容") {
    const textarea = document.querySelector("#digital-detail-editor");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const source = form.product_config.detail_markdown || "";
    const selected = source.slice(start, end) || placeholder;
    form.product_config.detail_markdown = `${source.slice(0, start)}${prefix}${selected}${suffix}${source.slice(end)}`;
    requestAnimationFrame(() => textarea.focus());
}
function markdownPreview(source = "") {
    const escaped = String(source)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return escaped
        .replace(/^### (.*)$/gm, "<h3>$1</h3>")
        .replace(/^## (.*)$/gm, "<h2>$1</h2>")
        .replace(/^# (.*)$/gm, "<h1>$1</h1>")
        .replace(
            /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g,
            '<img src="$2" alt="$1">',
        )
        .replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g,
            '<a href="$2">$1</a>',
        )
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/^[-*] (.*)$/gm, "<li>$1</li>")
        .replace(/\n{2,}/g, "</p><p>")
        .replace(/\n/g, "<br>");
}
async function saveBanner() {
    if (!banner.title.trim()) return notify("请输入 Banner 标题", "error");
    savingBanner.value = true;
    try {
        Object.assign(
            banner,
            await post("/digital-products/banner/save", banner),
        );
        showBannerForm.value = false;
        notify("商城 Banner 已保存");
    } catch (e) {
        notify(e.message, "error");
    } finally {
        savingBanner.value = false;
    }
}
onMounted(load);
</script>

<template>
    <section class="page-stack digital-product-workbench">
        <div class="page-heading page-heading-row">
            <div>
                <h1>数字商品管理</h1>
                <p>管理数字商品、销售规格、交付方式与库存状态。</p>
            </div>
            <div class="digital-heading-actions">
                <button class="btn btn-ghost" @click="openCategory()">
                    <AppIcon name="FolderPlus" :size="16" />创建分类
                </button>
                <button class="btn btn-primary" @click="open()">
                    <AppIcon name="Plus" :size="16" />新建商品
                </button>
            </div>
        </div>

        <div class="digital-kpi-grid">
            <article class="panel digital-kpi">
                <i class="violet"><AppIcon name="Package" :size="22" /></i>
                <div>
                    <span>商品总数</span><strong>{{ rows.length }}</strong
                    ><small>全部数字商品</small>
                </div>
            </article>
            <article class="panel digital-kpi">
                <i class="green"><AppIcon name="ShoppingBag" :size="22" /></i>
                <div>
                    <span>销售中</span><strong>{{ selling.length }}</strong
                    ><small>当前可购买</small>
                </div>
            </article>
            <article class="panel digital-kpi">
                <i class="orange"><AppIcon name="Tag" :size="22" /></i>
                <div>
                    <span>已下架</span
                    ><strong>{{ rows.length - selling.length }}</strong
                    ><small>隐藏或停售</small>
                </div>
            </article>
            <article class="panel digital-kpi">
                <i class="blue"><AppIcon name="Layers" :size="22" /></i>
                <div>
                    <span>可售库存</span
                    ><strong>{{
                        rows.reduce((n, r) => n + Number(r.stock_count || 0), 0)
                    }}</strong
                    ><small>全部可用库存</small>
                </div>
            </article>
            <article class="panel digital-kpi">
                <i class="violet">¥</i>
                <div>
                    <span>已交付</span
                    ><strong>{{
                        rows.reduce((n, r) => n + Number(r.sold_count || 0), 0)
                    }}</strong
                    ><small>累计完成交付</small>
                </div>
            </article>
        </div>

        <div class="digital-overview-grid">
            <section
                class="panel digital-banner-summary"
                :style="
                    banner.image_url
                        ? {
                              backgroundImage: `linear-gradient(90deg,rgba(20,16,48,.82),rgba(72,52,180,.16)),url(${banner.image_url})`,
                          }
                        : {}
                "
            >
                <div>
                    <span class="eyebrow">DIGITAL STORE</span>
                    <h2>{{ banner.title }}</h2>
                    <p>{{ banner.subtitle }}</p>
                    <button
                        class="btn btn-primary"
                        @click="showBannerForm = true"
                    >
                        编辑横幅
                    </button>
                </div>
            </section>
            <section class="panel digital-quick-panel">
                <div class="panel-head">
                    <div>
                        <h2>快捷操作</h2>
                        <p>常用管理入口</p>
                    </div>
                </div>
                <div class="digital-quick-grid">
                    <button @click="open()">
                        <i><AppIcon name="Plus" :size="17" /></i><span
                            >新建商品</span
                        ></button
                    ><button @click="showBannerForm = true">
                        <i><AppIcon name="Image" :size="17" /></i><span
                            >横幅配置</span
                        ></button
                    ><button
                        @click="
                            router.push({ name: 'DigitalInventoryManagement' })
                        "
                    >
                        <i><AppIcon name="Database" :size="17" /></i><span
                            >库存管理</span
                        ></button
                    ><button
                        @click="
                            router.push({ name: 'DigitalDeliveryManagement' })
                        "
                    >
                        <i><AppIcon name="ClipboardList" :size="17" /></i><span
                            >交付记录</span
                        >
                    </button><button @click="openFaq()">
                        <i><AppIcon name="BookOpen" :size="17" /></i><span
                            >常见问题</span
                        >
                    </button>
                </div>
            </section>
            <aside class="panel digital-side-card">
                <div class="panel-head">
                    <div>
                        <h2>商品分类</h2>
                        <p>{{ categories.length }} 个分类</p>
                    </div>
                    <button class="btn btn-ghost btn-sm digital-category-manage-button" @click="openCategoryManager()">
                        <AppIcon name="SlidersHorizontal" :size="14" />管理
                    </button>
                </div>
                <div class="digital-category-list">
                    <button
                        v-for="item in categoryStats"
                        :key="item.name"
                        :class="{ active: categoryFilter === item.name }"
                        @click="categoryFilter = item.name"
                    >
                        <i><AppIcon name="Tag" :size="15" /></i>
                        <span><b>{{ item.name }}</b><small>{{ item.enabled ? "前台显示" : "已停用" }}</small></span>
                        <strong>{{ item.count }}</strong></button
                    ><span v-if="!categoryStats.length">暂无分类</span>
                </div>
            </aside>
        </div>

        <div class="digital-content-grid">
            <section class="panel digital-product-table-panel">
                <div class="digital-table-toolbar">
                    <div class="digital-status-tabs">
                        <button
                            :class="{ active: statusFilter === 'all' }"
                            @click="statusFilter = 'all'"
                        >
                            全部商品</button
                        ><button
                            :class="{ active: statusFilter === 'selling' }"
                            @click="statusFilter = 'selling'"
                        >
                            销售中</button
                        ><button
                            :class="{ active: statusFilter === 'off' }"
                            @click="statusFilter = 'off'"
                        >
                            已下架</button
                        ><button
                            :class="{ active: statusFilter === 'low' }"
                            @click="statusFilter = 'low'"
                        >
                            库存不足
                        </button>
                    </div>
                    <div class="digital-table-filters">
                        <select v-model="categoryFilter">
                            <option value="all">全部分类</option>
                            <option
                                v-for="name in categories"
                                :key="name"
                                :value="name"
                            >
                                {{ name }}
                            </option></select
                        ><input
                            v-model="keyword"
                            placeholder="搜索商品名称、分类…"
                        />
                    </div>
                </div>
                <div v-if="loading" class="settings-loading">
                    正在加载数字商品…
                </div>
                <div v-else class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th class="digital-sale-column">销售</th>
                                <th>商品信息</th>
                                <th>分类</th>
                                <th>价格</th>
                                <th>库存</th>
                                <th>销量</th>
                                <th>交付</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="row in filteredRows"
                                :key="row.id"
                                draggable="true"
                                :class="{
                                    'is-dragging': draggingId === row.id,
                                    'is-drag-over': dragOverId === row.id,
                                }"
                                @dragstart="startDrag($event, row)"
                                @dragend="finishDrag"
                                @dragover.prevent="dragOverRow(row)"
                                @drop.prevent="dropRow(row)"
                            >
                                <td class="digital-sale-column">
                                    <div class="digital-row-controls">
                                        <span
                                            class="digital-row-grip"
                                            title="按住整行拖动排序"
                                            aria-hidden="true"
                                        ></span>
                                        <ToggleSwitch
                                            :model-value="
                                                Boolean(row.show && row.sell)
                                            "
                                            on-label=""
                                            off-label=""
                                            @update:model-value="
                                                toggleSelling(row, $event)
                                            "
                                        />
                                    </div>
                                </td>
                                <td>
                                    <div class="digital-product-cell">
                                        <span
                                            class="digital-product-thumb"
                                            :style="
                                                row.product_config?.image_url
                                                    ? {
                                                          backgroundImage: `url(${row.product_config.image_url})`,
                                                      }
                                                    : {}
                                            "
                                            >{{
                                                row.product_config?.image_url
                                                    ? ""
                                                    : row.name.slice(0, 1)
                                            }}</span
                                        >
                                        <div>
                                            <strong>{{ row.name }}</strong
                                            ><small
                                                >#{{ row.id }} ·
                                                {{
                                                    row.content || "未填写说明"
                                                }}</small
                                            >
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span class="plan-group">{{
                                        row.product_config?.category ||
                                        "数字商品"
                                    }}</span>
                                </td>
                                <td>
                                    <strong
                                        >¥{{
                                            lowestPrice(row).toFixed(2)
                                        }}</strong
                                    >
                                </td>
                                <td
                                    :class="{
                                        'digital-low-stock':
                                            Number(row.stock_count || 0) <= 10,
                                    }"
                                >
                                    {{ row.stock_count || 0 }}
                                </td>
                                <td>{{ row.sold_count || 0 }}</td>
                                <td>
                                    {{
                                        row.product_config?.delivery_type ===
                                        "text"
                                            ? "人工"
                                            : "自动"
                                    }}
                                </td>
                                <td>
                                    <span
                                        class="status-pill"
                                        :class="{ off: !row.show || !row.sell }"
                                        >{{
                                            row.show && row.sell
                                                ? "销售中"
                                                : "已下架"
                                        }}</span
                                    >
                                </td>
                                <td>
                                    <button
                                        class="btn btn-ghost btn-sm"
                                        @click="open(row)"
                                    >
                                        编辑
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="!filteredRows.length">
                                <td colspan="9" class="settings-loading">
                                    没有符合条件的商品
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
            <aside class="panel digital-low-stock-card">
                <div class="panel-head">
                    <div>
                        <h2>库存预警</h2>
                        <p>库存不高于 10 的商品</p>
                    </div>
                    <button
                        class="btn btn-ghost btn-sm"
                        @click="
                            router.push({ name: 'DigitalInventoryManagement' })
                        "
                    >
                        查看全部
                    </button>
                </div>
                <div class="digital-alert-list">
                    <div v-for="row in lowStock" :key="row.id">
                        <span class="digital-alert-icon">{{
                            row.name.slice(0, 1)
                        }}</span>
                        <div>
                            <strong>{{ row.name }}</strong
                            ><small>剩余 {{ row.stock_count || 0 }} 件</small>
                        </div>
                        <em :class="{ empty: !Number(row.stock_count) }">{{
                            Number(row.stock_count) ? "库存不足" : "缺货"
                        }}</em>
                    </div>
                    <span v-if="!lowStock.length">库存状态良好</span>
                </div>
            </aside>
        </div>

        <section id="digital-faq-panel" class="digital-faq-section-grid">
            <article class="panel digital-faq-panel digital-faq-sort-card">
                <div class="digital-faq-panel-head">
                    <div>
                        <span class="digital-faq-panel-icon"><AppIcon name="GripVertical" :size="18" /></span>
                        <div><h2>常见问题</h2><p>拖动整行调整前台展示顺序。</p></div>
                    </div>
                    <div class="digital-faq-head-actions">
                        <span class="digital-faq-count">{{ faqSorting ? "保存中…" : `${managedFaqs.length} 个问题` }}</span>
                        <button class="btn btn-primary btn-sm" @click="openFaq()"><AppIcon name="Plus" :size="14" />添加问题</button>
                    </div>
                </div>
                <div class="digital-faq-manage-list">
                    <article
                        v-for="item in managedFaqs"
                        :key="item.id"
                        draggable="true"
                        :class="{ muted: !item.enabled, 'is-dragging': faqDraggingId === item.id, 'is-drag-over': faqDragOverId === item.id }"
                        @dragstart="startFaqDrag($event, item)"
                        @dragend="finishFaqDrag"
                        @dragover.prevent="faqDragOverId = item.id"
                        @drop.prevent="dropFaqAt(item)"
                    >
                        <div class="digital-faq-row-controls">
                            <span class="digital-faq-sort" title="按住整行拖动"><AppIcon name="GripVertical" :size="15" /></span>
                            <ToggleSwitch :model-value="item.enabled" on-label="" off-label="" @update:model-value="toggleFaq(item, $event)" />
                        </div>
                        <div><strong>{{ item.title }}</strong><p>{{ item.content }}</p></div>
                        <div class="digital-faq-actions"><button class="btn btn-ghost btn-sm" @click="editFaq(item)">编辑</button><button class="btn btn-danger btn-sm" @click="dropFaq(item)">删除</button></div>
                    </article>
                    <div v-if="!managedFaqs.length" class="settings-loading">暂无常见问题，请先在左侧添加。</div>
                </div>
            </article>
        </section>

        <div v-if="showFaqEditor" class="modal-backdrop" @click.self="showFaqEditor = false">
            <section class="modal-card digital-faq-editor-modal">
                <div class="panel-head">
                    <div><h2>{{ faqForm.id ? "编辑问题" : "添加问题" }}</h2><p>{{ faqForm.id ? "修改问题内容和显示状态。" : "创建新的常见问题内容。" }}</p></div>
                    <button class="btn btn-ghost" @click="showFaqEditor = false">关闭</button>
                </div>
                <div class="digital-faq-form">
                    <label class="field"><span>问题标题 *</span><input v-model.trim="faqForm.title" maxlength="150" placeholder="例如：购买后如何交付？" /></label>
                    <label class="field"><span>问题内容 *</span><textarea v-model.trim="faqForm.content" rows="6" maxlength="5000" placeholder="输入清晰、简洁的答案内容"></textarea></label>
                    <div class="digital-faq-form-row">
                        <label class="field"><span>前台显示</span><ToggleSwitch v-model="faqForm.enabled" on-label="显示" off-label="隐藏" /></label>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-ghost" @click="showFaqEditor = false">取消</button>
                    <button class="btn btn-primary" :disabled="faqSaving" @click="saveFaq">{{ faqSaving ? "保存中…" : faqForm.id ? "保存修改" : "添加问题" }}</button>
                </div>
            </section>
        </div>

        <div
            v-if="showBannerForm"
            class="modal-backdrop"
            @click.self="showBannerForm = false"
        >
            <section
                class="modal-card forwarding-plan-modal digital-banner-modal"
            >
                <div class="panel-head">
                    <div>
                        <h2>编辑商城横幅</h2>
                        <p>设置前台数字商品页面顶部展示内容。</p>
                    </div>
                    <button
                        class="btn btn-ghost"
                        @click="showBannerForm = false"
                    >
                        关闭
                    </button>
                </div>
                <div
                    class="digital-banner-preview"
                    :style="
                        banner.image_url
                            ? {
                                  backgroundImage: `linear-gradient(90deg,rgba(4,10,18,.72),rgba(4,10,18,.12)),url(${banner.image_url})`,
                              }
                            : {}
                    "
                >
                    <div>
                        <strong>{{ banner.title || "横幅标题" }}</strong
                        ><span>{{ banner.subtitle || "横幅副标题" }}</span>
                    </div>
                </div>
                <div class="smart-form">
                    <div class="field field-wide">
                        <span>横幅图片</span>
                        <div class="digital-cover-inputs">
                            <input
                                v-model.trim="banner.image_url"
                                placeholder="图片 URL 或上传图片"
                            /><label class="btn btn-ghost btn-sm"
                                ><input
                                    hidden
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    @change="
                                        upload(
                                            '/digital-products/banner/upload',
                                            $event,
                                            uploadingBanner,
                                        )
                                    "
                                />{{
                                    uploadingBanner ? "上传中…" : "上传图片"
                                }}</label
                            >
                        </div>
                    </div>
                    <label class="field"
                        ><span>标题 *</span
                        ><input
                            v-model.trim="banner.title"
                            maxlength="100" /></label
                    ><label class="field"
                        ><span>副标题</span
                        ><input
                            v-model.trim="banner.subtitle"
                            maxlength="255" /></label
                    ><label class="field"
                        ><span>按钮文字</span
                        ><input
                            v-model.trim="banner.button_text"
                            maxlength="30" /></label
                    ><label class="field"
                        ><span>跳转链接</span
                        ><input v-model.trim="banner.link_url" maxlength="2048"
                    /></label>
                </div>
                <div class="modal-actions">
                    <button
                        class="btn btn-ghost"
                        @click="showBannerForm = false"
                    >
                        取消</button
                    ><button
                        class="btn btn-primary"
                        :disabled="savingBanner"
                        @click="saveBanner"
                    >
                        {{ savingBanner ? "保存中…" : "保存横幅" }}
                    </button>
                </div>
            </section>
        </div>

        <div
            v-if="showForm"
            class="modal-backdrop"
            @click.self="showForm = false"
        >
            <section class="modal-card forwarding-plan-modal">
                <div class="panel-head">
                    <div>
                        <h2>{{ form.id ? "编辑数字商品" : "新建数字商品" }}</h2>
                        <p>配置商品资料、交付方式与销售规格。</p>
                    </div>
                    <button class="btn btn-ghost" @click="showForm = false">
                        关闭
                    </button>
                </div>
                <div class="smart-form">
                    <label class="field field-wide"
                        ><span>商品名称 *</span
                        ><input
                            v-model.trim="form.name"
                            maxlength="100" /></label
                    ><label class="field field-wide"
                        ><span>商品说明</span
                        ><textarea v-model="form.content" rows="3" /></label
                    ><label class="field"
                        ><span>商品分类</span
                        ><select v-model="form.digital_category_id">
                            <option :value="null" disabled>请选择分类</option>
                            <option
                                v-for="item in managedCategories.filter(
                                    (entry) => entry.enabled || entry.id === form.digital_category_id,
                                )"
                                :key="item.id"
                                :value="item.id"
                            >
                                {{ item.name }}{{ item.enabled ? "" : "（已停用）" }}
                            </option>
                        </select></label
                    ><label class="field"
                        ><span>交付方式</span
                        ><ToggleSwitch
                            :model-value="
                                form.product_config.delivery_type !== 'text'
                            "
                            on-label="自动交付"
                            off-label="人工交付"
                            @update:model-value="
                                form.product_config.delivery_type = $event
                                    ? 'code'
                                    : 'text'
                            "
                    /></label>
                    <div class="field field-wide digital-cover-field">
                        <span>商品封面</span>
                        <div class="digital-cover-control">
                            <div
                                v-if="form.product_config.image_url"
                                class="digital-cover-preview"
                                :style="{
                                    backgroundImage: `url(${form.product_config.image_url})`,
                                }"
                            ></div>
                            <div class="digital-cover-inputs">
                                <input
                                    v-model.trim="form.product_config.image_url"
                                    placeholder="图片 URL 或上传图片"
                                /><label class="btn btn-ghost btn-sm"
                                    ><input
                                        hidden
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        @change="
                                            upload(
                                                '/digital-products/cover/upload',
                                                $event,
                                                uploadingCover,
                                            )
                                        "
                                    />{{
                                        uploadingCover ? "上传中…" : "上传图片"
                                    }}</label
                                >
                            </div>
                        </div>
                    </div>
                    <div class="field field-wide digital-detail-field">
                        <div class="digital-editor-heading">
                            <span>商品详情（Markdown）</span>
                            <div>
                                <button
                                    class="btn btn-ghost btn-sm"
                                    :class="{ active: !detailPreview }"
                                    @click="detailPreview = false"
                                >
                                    编辑
                                </button>
                                <button
                                    class="btn btn-ghost btn-sm"
                                    :class="{ active: detailPreview }"
                                    @click="detailPreview = true"
                                >
                                    预览
                                </button>
                            </div>
                        </div>
                        <div
                            v-if="!detailPreview"
                            class="digital-markdown-editor"
                        >
                            <div class="digital-editor-toolbar">
                                <button
                                    type="button"
                                    @click="insertMarkdown('## ', '', '标题')"
                                >
                                    H2
                                </button>
                                <button
                                    type="button"
                                    @click="insertMarkdown('**', '**', '粗体')"
                                >
                                    B
                                </button>
                                <button
                                    type="button"
                                    @click="insertMarkdown('- ', '', '列表项')"
                                >
                                    列表
                                </button>
                                <button
                                    type="button"
                                    @click="
                                        insertMarkdown(
                                            '[',
                                            '](https://)',
                                            '链接文字',
                                        )
                                    "
                                >
                                    链接
                                </button>
                                <button
                                    type="button"
                                    @click="
                                        insertMarkdown(
                                            '![',
                                            '](/storage/图片地址)',
                                            '图片说明',
                                        )
                                    "
                                >
                                    图片
                                </button>
                            </div>
                            <textarea
                                id="digital-detail-editor"
                                v-model="form.product_config.detail_markdown"
                                rows="12"
                                placeholder="# 商品详情&#10;&#10;支持 Markdown 标题、图片、链接、列表、粗体和代码。"
                            ></textarea>
                        </div>
                        <article
                            v-else
                            class="digital-markdown-preview"
                            v-html="
                                markdownPreview(
                                    form.product_config.detail_markdown ||
                                        '暂无详情内容',
                                )
                            "
                        ></article>
                    </div>
                    <div class="field field-wide digital-gallery-field">
                        <div class="digital-editor-heading">
                            <span>详情图片</span>
                            <label class="btn btn-ghost btn-sm"
                                ><input
                                    hidden
                                    multiple
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    @change="uploadGallery"
                                />{{
                                    uploadingGallery ? "上传中…" : "上传图片"
                                }}</label
                            >
                        </div>
                        <div
                            v-if="form.product_config.gallery.length"
                            class="digital-gallery-grid"
                        >
                            <figure
                                v-for="(url, index) in form.product_config
                                    .gallery"
                                :key="url + index"
                            >
                                <img :src="url" alt="" /><button
                                    type="button"
                                    @click="
                                        form.product_config.gallery.splice(
                                            index,
                                            1,
                                        )
                                    "
                                >
                                    ×
                                </button>
                            </figure>
                        </div>
                        <p v-else class="field-help">
                            可上传多张商品展示图，用户可在详情页浏览。
                        </p>
                    </div>
                    <label class="field"
                        ><span>首页推荐</span
                        ><ToggleSwitch
                            v-model="form.product_config.featured"
                            on-label="已推荐"
                            off-label="普通商品" /></label
                    ><label class="field"
                        ><span>展示状态</span
                        ><ToggleSwitch
                            v-model="form.show"
                            on-label="已展示"
                            off-label="已隐藏" /></label
                    ><label class="field"
                        ><span>购买状态</span
                        ><ToggleSwitch
                            v-model="form.sell"
                            on-label="销售中"
                            off-label="已停售"
                    /></label>
                </div>
                <h3 class="plan-form-title">商品规格 *</h3>
                <div class="digital-package-editor">
                    <div
                        v-for="(item, index) in form.product_config.packages"
                        :key="item.id"
                        class="digital-package-row digital-spec-row"
                    >
                        <input
                            v-model.trim="item.id"
                            placeholder="规格标识"
                        /><input
                            v-model.trim="item.name"
                            placeholder="规格名称"
                        /><input
                            v-model.number="item.price"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="售价"
                        /><input
                            v-model.number="item.original_price"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="划线价"
                        /><input
                            v-model.trim="item.description"
                            placeholder="规格说明"
                        /><span class="digital-spec-stock"
                            >库存 {{ item.stock_count || 0 }}</span
                        ><button
                            class="btn btn-ghost btn-sm"
                            @click="removePackage(index)"
                        >
                            移除
                        </button>
                    </div>
                    <button class="btn btn-ghost btn-sm" @click="addPackage">
                        ＋添加规格
                    </button>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-ghost" @click="showForm = false">
                        取消</button
                    ><button
                        class="btn btn-primary"
                        :disabled="saving"
                        @click="save"
                    >
                        {{ saving ? "保存中…" : "保存商品" }}
                    </button>
                </div>
            </section>
        </div>
        <div
            v-if="showCategoryEditor"
            class="modal-backdrop"
            @click.self="showCategoryEditor = false"
        >
            <section class="modal-card digital-category-editor-modal">
                <div class="panel-head">
                    <div>
                        <h2>{{ categoryForm.id ? "编辑分类" : "创建分类" }}</h2>
                        <p>{{ categoryForm.id ? "修改分类名称和显示状态。" : "新建一个用于归类数字商品的分类。" }}</p>
                    </div>
                    <button class="btn btn-ghost" @click="showCategoryEditor = false">关闭</button>
                </div>
                <div class="digital-category-editor-form">
                    <label class="field">
                        <span>分类名称 *</span>
                        <input v-model.trim="categoryForm.name" maxlength="50" placeholder="输入分类名称" @keyup.enter="saveCategory" />
                    </label>
                    <label class="field"><span>显示状态</span><ToggleSwitch v-model="categoryForm.enabled" on-label="已启用" off-label="已停用" /></label>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-ghost" @click="showCategoryEditor = false">取消</button>
                    <button class="btn btn-primary" :disabled="categorySaving" @click="saveCategory">
                        {{ categorySaving ? "保存中…" : categoryForm.id ? "保存修改" : "创建分类" }}
                    </button>
                </div>
            </section>
        </div>
        <div
            v-if="showCategoryManager"
            class="modal-backdrop"
            @click.self="showCategoryManager = false"
        >
            <section class="modal-card digital-category-modal">
                <div class="panel-head">
                    <div>
                        <h2>分类管理</h2>
                        <p>调整分类顺序、显示状态，或维护已有分类。</p>
                    </div>
                    <button class="btn btn-ghost" @click="showCategoryManager = false">关闭</button>
                </div>
                <div class="digital-category-manage-list">
                    <div v-for="(item, index) in managedCategories" :key="item.id">
                        <span class="digital-category-order"><AppIcon name="GripVertical" :size="16" /></span>
                        <div><strong>{{ item.name }}</strong><small>{{ item.plans_count || 0 }} 个商品</small></div>
                        <ToggleSwitch :model-value="item.enabled" on-label="显示" off-label="停用" @update:model-value="toggleCategory(item, $event)" />
                        <div class="digital-category-row-actions">
                            <button class="btn btn-ghost btn-sm" :disabled="index === 0" @click="moveCategory(index, -1)">上移</button>
                            <button class="btn btn-ghost btn-sm" :disabled="index === managedCategories.length - 1" @click="moveCategory(index, 1)">下移</button>
                            <button class="btn btn-ghost btn-sm" @click="openCategory(item)">编辑</button>
                            <button class="btn btn-danger btn-sm" :disabled="Number(item.plans_count || 0) > 0" @click="dropCategory(item)">删除</button>
                        </div>
                    </div>
                    <div v-if="!managedCategories.length" class="settings-loading">暂无分类</div>
                </div>
            </section>
        </div>
        <div
            v-if="toast.text"
            class="toast"
            :class="{ error: toast.type === 'error' }"
        >
            {{ toast.text }}
        </div>
    </section>
</template>
