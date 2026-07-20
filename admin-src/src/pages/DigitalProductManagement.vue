<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import AppIcon from "../components/AppIcon.vue";
import ToggleSwitch from "../components/ToggleSwitch.vue";
import { get, post } from "../services/http";

const rows = ref([]),
    loading = ref(true),
    saving = ref(false),
    showForm = ref(false);
const toast = reactive({ text: "", type: "" });
const form = reactive({
    id: null,
    name: "",
    content: "",
    show: true,
    sell: true,
    prices: { onetime: 0 },
    product_config: {
        delivery_type: "code",
        category: "数字商品",
        image_url: "",
        featured: false,
        packages: [
            {
                id: "default",
                name: "标准版",
                price: 0,
                original_price: 0,
                description: "",
            },
        ],
    },
});
const uploadingCover = ref(false);
const savingBanner = ref(false),
    uploadingBanner = ref(false);
const banner = reactive({
    image_url: "",
    title: "数字商品中心",
    subtitle: "",
    button_text: "了解更多",
    link_url: "#digital-products",
});
const selling = computed(() =>
    rows.value.filter((row) => row.show && row.sell),
);
function notify(text, type = "") {
    toast.text = text;
    toast.type = type;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
        toast.text = "";
    }, 2600);
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
        prices: { ...(row?.prices || {}), onetime: row?.prices?.onetime || 0 },
        product_config: {
            delivery_type: row ? row.product_config?.delivery_type || "text" : "code",
            category: row?.product_config?.category || "数字商品",
            image_url: row?.product_config?.image_url || "",
            featured: Boolean(row?.product_config?.featured),
            packages: row?.product_config?.packages?.length
                ? row.product_config.packages.map((item) => ({
                      original_price: 0,
                      description: "",
                      ...item,
                  }))
                : [
                      {
                          id: "default",
                          name: "标准版",
                          price: 0,
                          original_price: 0,
                          description: "",
                      },
                  ],
        },
    });
    showForm.value = true;
}
async function save() {
    const prices = Object.fromEntries(
        Object.entries(form.prices).filter(([, value]) => Number(value) > 0),
    );
    const packages = form.product_config.packages.filter(
        (item) =>
            item.id?.trim() && item.name?.trim() && Number(item.price) > 0,
    );
    if (!form.name.trim()) return notify("请输入商品名称", "error");
    if (!packages.length && !Object.keys(prices).length)
        return notify("请至少设置一个有效销售套餐", "error");
    saving.value = true;
    try {
        await post("/digital-products/save", {
            ...form,
            prices,
            product_config: { ...form.product_config, packages },
        });
        notify(form.id ? "商品已更新" : "商品已创建");
        showForm.value = false;
        await load();
    } catch (e) {
        notify(e.message, "error");
    } finally {
        saving.value = false;
    }
}
function addPackage() {
    form.product_config.packages.push({
        id: `spec-${Date.now()}`,
        name: "新规格",
        price: 0,
        original_price: 0,
        description: "",
    });
}
function removePackage(index) {
    if (form.product_config.packages.length > 1)
        form.product_config.packages.splice(index, 1);
}
async function uploadCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    uploadingCover.value = true;
    try {
        const result = await post("/digital-products/cover/upload", body);
        form.product_config.image_url = result.url;
        notify("封面上传成功");
    } catch (e) {
        notify(e.message, "error");
    } finally {
        uploadingCover.value = false;
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
        notify("商城 Banner 已保存");
    } catch (e) {
        notify(e.message, "error");
    } finally {
        savingBanner.value = false;
    }
}
async function uploadBanner(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    uploadingBanner.value = true;
    try {
        const result = await post("/digital-products/banner/upload", body);
        banner.image_url = result.url;
        notify("Banner 图片上传成功，请保存配置");
    } catch (e) {
        notify(e.message, "error");
    } finally {
        uploadingBanner.value = false;
        event.target.value = "";
    }
}
onMounted(load);
</script>
<template>
    <section class="page-stack forwarding-plans-page">
        <div class="page-heading page-heading-row">
            <div>
                <h1>数字商品</h1>
                <p>
                    销售卡密、授权码、账号或下载链接，支付完成后自动从库存发货。
                </p>
            </div>
            <button class="btn btn-primary" @click="open()">
                <AppIcon name="Plus" :size="16" />新建商品
            </button>
        </div>
        <section class="panel digital-banner-settings">
            <div class="panel-head">
                <div>
                    <h2>商城 Banner</h2>
                    <p>配置数字商品页面顶部的宣传图片与跳转内容。</p>
                </div>
                <button
                    class="btn btn-primary"
                    :disabled="savingBanner"
                    @click="saveBanner"
                >
                    {{ savingBanner ? "保存中…" : "保存 Banner" }}
                </button>
            </div>
            <div class="digital-banner-config">
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
                        <strong>{{ banner.title || "Banner 标题" }}</strong
                        ><span>{{ banner.subtitle || "Banner 副标题" }}</span>
                    </div>
                </div>
                <div class="smart-form">
                    <div class="field field-wide">
                        <span>Banner 图片</span>
                        <div class="digital-cover-inputs">
                            <input
                                v-model.trim="banner.image_url"
                                placeholder="可填写图片 URL，或直接上传图片"
                            /><label class="btn btn-ghost btn-sm"
                                ><input
                                    hidden
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/gif"
                                    @change="uploadBanner"
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
                            maxlength="100"
                            placeholder="数字商品中心" /></label
                    ><label class="field"
                        ><span>副标题</span
                        ><input
                            v-model.trim="banner.subtitle"
                            maxlength="255"
                            placeholder="精选数字资产，安全购买" /></label
                    ><label class="field"
                        ><span>按钮文字</span
                        ><input
                            v-model.trim="banner.button_text"
                            maxlength="30"
                            placeholder="了解更多" /></label
                    ><label class="field"
                        ><span>跳转链接</span
                        ><input
                            v-model.trim="banner.link_url"
                            maxlength="2048"
                            placeholder="https://... 或 #digital-products"
                    /></label>
                </div>
            </div>
        </section>
        <div class="stat-grid">
            <article class="stat-card">
                <span>商品数量</span><strong>{{ rows.length }}</strong>
            </article>
            <article class="stat-card">
                <span>销售中</span><strong>{{ selling.length }}</strong>
            </article>
            <article class="stat-card">
                <span>可售库存</span
                ><strong>{{
                    rows.reduce((n, r) => n + Number(r.stock_count || 0), 0)
                }}</strong>
            </article>
            <article class="stat-card">
                <span>已交付</span
                ><strong>{{
                    rows.reduce((n, r) => n + Number(r.sold_count || 0), 0)
                }}</strong>
            </article>
        </div>
        <div v-if="loading" class="panel settings-loading">
            正在加载数字商品…
        </div>
        <div v-else-if="!rows.length" class="panel settings-loading">
            暂无数字商品，点击右上角新建
        </div>
        <div v-else class="forwarding-plan-grid">
            <article
                v-for="row in rows"
                :key="row.id"
                class="panel forwarding-plan-card"
            >
                <div class="forwarding-plan-head">
                    <div>
                        <span class="plan-group">{{
                            {
                                text: "文本",
                                code: "卡密",
                                link: "下载链接",
                                account: "账号信息",
                            }[row.product_config?.delivery_type] || "文本"
                        }}</span>
                        <h2>{{ row.name }}</h2>
                        <small
                            >#{{ row.id }} ·
                            {{ row.content || "未填写商品说明" }}</small
                        >
                    </div>
                    <span class="status-pill" :class="{ off: !row.sell }">{{
                        row.sell ? "销售中" : "已停售"
                    }}</span>
                </div>
                <div class="digital-package-summary">
                    <span
                        v-for="item in row.product_config?.packages || []"
                        :key="item.id"
                        >{{ item.name }} · ¥{{
                            Number(item.price).toFixed(2)
                        }}</span
                    >
                </div>
                <div class="forwarding-plan-rights">
                    <span
                        ><small>可售库存</small
                        ><strong>{{ row.stock_count || 0 }}</strong></span
                    ><span
                        ><small>已交付</small
                        ><strong>{{ row.sold_count || 0 }}</strong></span
                    ><span
                        ><small>套餐数量</small
                        ><strong>{{
                            row.product_config?.packages?.length || 0
                        }}</strong></span
                    >
                </div>
                <div class="plan-actions">
                    <button class="btn btn-ghost btn-sm" @click="open(row)">
                        编辑商品
                    </button>
                </div>
            </article>
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
                        <p>支持多规格独立定价；创建商品后可按规格导入库存。</p>
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
                            maxlength="100"
                            placeholder="例如：高级账号授权码" /></label
                    ><label class="field field-wide"
                        ><span>商品说明</span
                        ><textarea
                            v-model="form.content"
                            rows="3"
                            placeholder="展示给购买用户的说明"
                        /></label
                    ><label class="field"
                        ><span>商品分类</span
                        ><input
                            v-model.trim="form.product_config.category"
                            maxlength="50"
                            placeholder="例如：账号类" /></label
                    ><label class="field"
                        ><span>交付方式</span
                        ><ToggleSwitch
                            :model-value="form.product_config.delivery_type !== 'text'"
                            on-label="自动交付"
                            off-label="人工交付"
                            @update:model-value="form.product_config.delivery_type = $event ? 'code' : 'text'" /></label
                    >
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
                                    maxlength="2048"
                                    placeholder="可填写图片 URL，或直接上传图片"
                                /><label class="btn btn-ghost btn-sm"
                                    ><input
                                        hidden
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        @change="uploadCover"
                                    />{{
                                        uploadingCover ? "上传中…" : "上传图片"
                                    }}</label
                                >
                            </div>
                        </div>
                        <small
                            >支持 JPG、PNG、WebP、GIF，最大
                            5MB；建议使用横版图片。</small
                        >
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
                            placeholder="规格标识，如 monthly"
                        /><input
                            v-model.trim="item.name"
                            placeholder="规格名称，如 1个月"
                        /><input
                            v-model.number="item.price"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="售价（元）"
                        /><input
                            v-model.number="item.original_price"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="划线价（可选）"
                        /><input
                            v-model.trim="item.description"
                            placeholder="规格说明（可选）"
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
