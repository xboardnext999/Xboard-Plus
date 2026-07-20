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
    showBannerForm = ref(false);
const savingBanner = ref(false),
    uploadingBanner = ref(false),
    uploadingCover = ref(false);
const keyword = ref(""),
    statusFilter = ref("all"),
    categoryFilter = ref("all");
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
    name: "",
    content: "",
    show: true,
    sell: true,
    product_config: {
        delivery_type: "code",
        category: "数字商品",
        image_url: "",
        featured: false,
        packages: [emptyPackage()],
    },
});

const selling = computed(() =>
    rows.value.filter((row) => row.show && row.sell),
);
const categories = computed(() => [
    ...new Set(
        rows.value.map((row) => row.product_config?.category || "数字商品"),
    ),
]);
const categoryStats = computed(() =>
    categories.value.map((name) => ({
        name,
        count: rows.value.filter(
            (row) => (row.product_config?.category || "数字商品") === name,
        ).length,
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
async function load() {
    loading.value = true;
    try {
        const [data, bannerData] = await Promise.all([
            get("/digital-products/fetch"),
            get("/digital-products/banner"),
        ]);
        rows.value = Array.isArray(data) ? data : [];
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
            <button class="btn btn-primary" @click="open()">
                <AppIcon name="Plus" :size="16" />新建商品
            </button>
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
                        <AppIcon name="Plus" :size="18" /><span
                            >新建商品</span
                        ></button
                    ><button @click="showBannerForm = true">
                        <AppIcon name="Image" :size="18" /><span
                            >横幅配置</span
                        ></button
                    ><button
                        @click="
                            router.push({ name: 'DigitalInventoryManagement' })
                        "
                    >
                        <AppIcon name="Database" :size="18" /><span
                            >库存管理</span
                        ></button
                    ><button
                        @click="
                            router.push({ name: 'DigitalDeliveryManagement' })
                        "
                    >
                        <AppIcon name="ClipboardList" :size="18" /><span
                            >交付记录</span
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
                </div>
                <div class="digital-category-list">
                    <button
                        v-for="item in categoryStats"
                        :key="item.name"
                        @click="categoryFilter = item.name"
                    >
                        <span>{{ item.name }}</span
                        ><strong>{{ item.count }}</strong></button
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
                            <tr v-for="row in filteredRows" :key="row.id">
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
                                <td colspan="8" class="settings-loading">
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
                        ><input
                            v-model.trim="form.product_config.category"
                            maxlength="50" /></label
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
            v-if="toast.text"
            class="toast"
            :class="{ error: toast.type === 'error' }"
        >
            {{ toast.text }}
        </div>
    </section>
</template>
