<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import AppIcon from "../components/AppIcon.vue";
import { get, post, request } from "../services/http";
const users = ref([]),
    plans = ref([]),
    groups = ref([]),
    loading = ref(false),
    saving = ref(false),
    busy = ref(null),
    selected = ref(null),
    showEdit = ref(false),
    showDetail = ref(false),
    showCreate = ref(false),
    createdUsers = ref([]);
const filters = reactive({ keyword: "", plan_id: "", state: "all" }),
    page = reactive({ current: 1, size: 20, total: 0, last: 1 }),
    toast = reactive({ text: "", type: "success" }),
    form = reactive(defaultForm()),
    createForm = reactive(defaultCreate());
function defaultCreate() {
    return {
        batch: false,
        email: "",
        email_prefix: "user",
        email_suffix: "example.com",
        generate_count: 10,
        password: "",
        plan_id: null,
        expired_at: "",
        download_csv: true,
    };
}
function defaultForm() {
    return {
        id: null,
        email: "",
        password: "",
        plan_id: null,
        transfer_gb: 0,
        expired_at: "",
        balance: 0,
        commission_balance: 0,
        commission_rate: null,
        discount: null,
        speed_limit: 0,
        device_limit: 0,
        banned: false,
        is_staff: false,
        is_admin: false,
        invite_user_email: "",
        remarks: "",
    };
}
function notify(text, type = "success") {
    toast.text = text;
    toast.type = type;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => (toast.text = ""), 2800);
}
function addFilter(q, i, id, value, logic) {
    q.set(`filter[${i}][id]`, id);
    q.set(`filter[${i}][value]`, String(value));
    if (logic) q.set(`filter[${i}][logic]`, logic);
}
function query() {
    const q = new URLSearchParams({
        current: String(page.current),
        pageSize: String(page.size),
    });
    let i = 0;
    if (filters.keyword) {
        const v = filters.keyword.trim();
        if (/^\d+$/.test(v)) addFilter(q, i++, "id", `eq:${v}`);
        else addFilter(q, i++, "email", `like:${v}`);
    }
    if (filters.plan_id) addFilter(q, i++, "plan_id", `eq:${filters.plan_id}`);
    if (filters.state === "banned") addFilter(q, i++, "banned", "eq:1");
    if (filters.state === "active") {
        addFilter(q, i++, "banned", "eq:0");
        addFilter(q, i++, "expired_at", `gt:${Math.floor(Date.now() / 1000)}`);
    }
    if (filters.state === "expired")
        addFilter(q, i++, "expired_at", `lte:${Math.floor(Date.now() / 1000)}`);
    if (filters.state === "no_plan") addFilter(q, i++, "plan_id", "null:");
    return q.toString();
}
function normalize(data) {
    const s = data?.data ?? data;
    users.value = s?.items || s?.data || (Array.isArray(s) ? s : []);
    page.total = Number(s?.total || users.value.length);
    page.current = Number(s?.current_page || page.current);
    page.last = Number(
        s?.last_page || Math.max(1, Math.ceil(page.total / page.size)),
    );
}
async function load(reset = false) {
    if (reset) page.current = 1;
    loading.value = true;
    try {
        normalize(await request(`/user/fetch?${query()}`));
    } catch (e) {
        notify(e.message, "error");
    } finally {
        loading.value = false;
    }
}
async function loadOptions() {
    try {
        const [p, g] = await Promise.all([
            get("/plan/fetch"),
            get("/server/group/fetch"),
        ]);
        plans.value = Array.isArray(p) ? p : [];
        groups.value = Array.isArray(g) ? g : [];
    } catch (e) {
        notify(e.message, "error");
    }
}
function bytesGB(v) {
    return Number(v || 0) / 1073741824;
}
function traffic(v) {
    const n = Number(v || 0);
    if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
    if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
    return `${(n / 1024).toFixed(1)} KB`;
}
function usage(u) {
    return u.transfer_enable
        ? Math.min(
              100,
              Math.round(
                  (Number(u.total_used || Number(u.u || 0) + Number(u.d || 0)) /
                      Number(u.transfer_enable)) *
                      100,
              ),
          )
        : 0;
}
function time(v) {
    return v
        ? new Date(Number(v) * 1000).toLocaleString("zh-CN", { hour12: false })
        : "长期有效";
}
function localInput(ts) {
    if (!ts) return "";
    const d = new Date(Number(ts) * 1000),
        x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return x.toISOString().slice(0, 16);
}
function state(u) {
    if (u.banned) return ["已封禁", "off"];
    if (u.expired_at && Number(u.expired_at) < Date.now() / 1000)
        return ["已过期", "off"];
    if (!u.plan_id) return ["无订阅", "waiting"];
    return ["正常", ""];
}
function edit(u) {
    selected.value = u;
    Object.assign(form, defaultForm(), {
        id: u.id,
        email: u.email,
        password: "",
        plan_id: u.plan_id,
        transfer_gb: Number(bytesGB(u.transfer_enable).toFixed(3)),
        expired_at: localInput(u.expired_at),
        balance: Number(u.balance || 0),
        commission_balance: Number(u.commission_balance || 0),
        commission_rate: u.commission_rate,
        discount: u.discount,
        speed_limit: Number(u.speed_limit || 0),
        device_limit: Number(u.device_limit || 0),
        banned: Boolean(u.banned),
        is_staff: Boolean(u.is_staff),
        is_admin: Boolean(u.is_admin),
        invite_user_email: u.invite_user?.email || "",
        remarks: u.remarks || "",
    });
    showEdit.value = true;
}
async function save() {
    if (!form.email.includes("@")) return notify("请输入正确的邮箱", "error");
    if (form.password && form.password.length < 8)
        return notify("新密码至少 8 位", "error");
    if (
        selected.value &&
        ((!selected.value.is_admin && form.is_admin) ||
            (!selected.value.is_staff && form.is_staff)) &&
        !confirm("你正在提升该用户的后台权限，确定继续？")
    )
        return;
    saving.value = true;
    try {
        const body = {
            id: form.id,
            email: form.email,
            plan_id: form.plan_id || null,
            transfer_enable: Math.round(
                Number(form.transfer_gb || 0) * 1073741824,
            ),
            expired_at: form.expired_at
                ? Math.floor(new Date(form.expired_at).getTime() / 1000)
                : null,
            balance: Number(form.balance || 0),
            commission_balance: Number(form.commission_balance || 0),
            commission_rate:
                form.commission_rate === "" ? null : form.commission_rate,
            discount: form.discount === "" ? null : form.discount,
            speed_limit: Number(form.speed_limit || 0),
            device_limit: Number(form.device_limit || 0),
            banned: Boolean(form.banned),
            is_staff: Boolean(form.is_staff),
            is_admin: Boolean(form.is_admin),
            invite_user_email: form.invite_user_email || null,
            remarks: form.remarks || null,
        };
        if (form.password) body.password = form.password;
        await post("/user/update", body);
        notify("用户资料已更新");
        showEdit.value = false;
        await load();
    } catch (e) {
        notify(e.message, "error");
    } finally {
        saving.value = false;
    }
}
async function detail(u) {
    busy.value = u.id;
    try {
        selected.value = await get("/user/getUserInfoById", { id: u.id });
        showDetail.value = true;
    } catch (e) {
        notify(e.message, "error");
    } finally {
        busy.value = null;
    }
}
async function toggleBan(u) {
    const ban = !u.banned;
    if (
        !confirm(
            `确定${ban ? "封禁" : "解封"}用户 ${u.email}？${ban ? "封禁会立即清除该用户所有登录会话。" : ""}`,
        )
    )
        return;
    busy.value = u.id;
    try {
        await post("/user/update", { id: u.id, banned: ban });
        notify(ban ? "用户已封禁" : "用户已解封");
        await load();
    } catch (e) {
        notify(e.message, "error");
    } finally {
        busy.value = null;
    }
}
async function resetSecret(u) {
    if (!confirm(`确定重置 ${u.email} 的订阅密钥？旧订阅链接将立即失效。`))
        return;
    busy.value = u.id;
    try {
        await post("/user/resetSecret", { id: u.id });
        notify("订阅密钥已重置");
        await load();
    } catch (e) {
        notify(e.message, "error");
    } finally {
        busy.value = null;
    }
}
async function remove(u) {
    if (
        !confirm(
            `永久删除用户 ${u.email}？\n\n该操作会连带删除用户订单、邀请码、流量统计和工单，且无法恢复。`,
        )
    )
        return;
    const typed = prompt(`请输入用户邮箱 ${u.email} 确认永久删除`);
    if (typed !== u.email) return notify("邮箱不匹配，已取消删除", "error");
    busy.value = u.id;
    try {
        await post("/user/destroy", { id: u.id });
        notify("用户及关联数据已永久删除");
        await load();
    } catch (e) {
        notify(e.message, "error");
    } finally {
        busy.value = null;
    }
}
async function copy(v, label = "内容") {
    await navigator.clipboard.writeText(v || "");
    notify(`${label}已复制`);
}
const stats = computed(() => ({
    page: users.value.length,
    active: users.value.filter((u) => state(u)[0] === "正常").length,
    banned: users.value.filter((u) => u.banned).length,
    traffic: users.value.reduce((s, u) => s + Number(u.total_used || 0), 0),
}));
onMounted(() => Promise.all([load(true), loadOptions()]));
function startCreate() {
    Object.assign(createForm, defaultCreate());
    createdUsers.value = [];
    showCreate.value = true;
}
async function createUsers() {
    let prefix = createForm.email_prefix.trim(),
        suffix = createForm.email_suffix.trim().replace(/^@/, "");
    if (!createForm.batch) {
        const parts = createForm.email.trim().toLowerCase().split("@");
        if (parts.length !== 2 || !parts[0] || !parts[1])
            return notify("请输入正确的用户邮箱", "error");
        [prefix, suffix] = parts;
    }
    if (!suffix || !prefix) return notify("邮箱前缀和域名不能为空", "error");
    if (createForm.password && createForm.password.length < 8)
        return notify("密码至少 8 位；留空则使用邮箱作为初始密码", "error");
    if (
        createForm.batch &&
        (Number(createForm.generate_count) < 1 ||
            Number(createForm.generate_count) > 500)
    )
        return notify("批量创建数量必须在 1–500 之间", "error");
    const body = {
        email_prefix: prefix,
        email_suffix: suffix,
        password: createForm.password || undefined,
        plan_id: createForm.plan_id || null,
        expired_at: createForm.expired_at
            ? Math.floor(new Date(createForm.expired_at).getTime() / 1000)
            : null,
        generate_count: createForm.batch
            ? Number(createForm.generate_count)
            : undefined,
    };
    if (
        !confirm(
            `确定创建${createForm.batch ? ` ${body.generate_count} 个` : `用户 ${prefix}@${suffix}`}账号？`,
        )
    )
        return;
    saving.value = true;
    try {
        const data = await post("/user/generate", body);
        createdUsers.value = Array.isArray(data) ? data : [];
        notify(
            createForm.batch
                ? `已创建 ${createdUsers.value.length || body.generate_count} 个用户`
                : "用户已创建",
        );
        if (!createForm.batch) {
            showCreate.value = false;
            await load(true);
        }
    } catch (e) {
        notify(e.message, "error");
    } finally {
        saving.value = false;
    }
}
function downloadCreated() {
    if (!createdUsers.value.length) return;
    const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`,
        rows = [
            ["账号", "密码", "过期时间", "UUID", "订阅地址"],
            ...createdUsers.value.map((u) => [
                u.email,
                u.password,
                u.expired_at,
                u.uuid,
                u.subscribe_url,
            ]),
        ],
        blob = new Blob(
            ["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n")],
            { type: "text/csv;charset=utf-8" },
        ),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
    a.href = url;
    a.download = `users-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
</script>
<template>
    <section class="page-stack">
        <div class="page-heading page-heading-row">
            <div>
                <h1>用户管理</h1>
                <p>管理用户订阅、流量、余额、推广关系、权限和账号安全状态。</p>
            </div>
            <button class="btn btn-primary" @click="startCreate">
                <AppIcon name="UserPlus" :size="16" />创建用户
            </button>
        </div>
        <div class="stat-grid user-stats">
            <article class="stat-card">
                <span>当前页用户</span><strong>{{ stats.page }}</strong>
            </article>
            <article class="stat-card">
                <span>当前页正常</span><strong>{{ stats.active }}</strong>
            </article>
            <article class="stat-card">
                <span>当前页封禁</span><strong>{{ stats.banned }}</strong>
            </article>
            <article class="stat-card">
                <span>当前页已用流量</span
                ><strong>{{ traffic(stats.traffic) }}</strong>
            </article>
        </div>
        <div class="user-toolbar">
            <label class="filter-input"
                ><span>搜索</span
                ><input
                    v-model.trim="filters.keyword"
                    placeholder="邮箱或用户 ID"
                    @keyup.enter="load(true)" /></label
            ><label class="field compact-field"
                ><span>套餐</span
                ><select v-model="filters.plan_id" @change="load(true)">
                    <option value="">全部套餐</option>
                    <option v-for="p in plans" :key="p.id" :value="p.id">
                        {{ p.name }}
                    </option>
                </select></label
            ><label class="field compact-field"
                ><span>用户状态</span
                ><select v-model="filters.state" @change="load(true)">
                    <option value="all">全部状态</option>
                    <option value="active">正常用户</option>
                    <option value="expired">已过期</option>
                    <option value="banned">已封禁</option>
                    <option value="no_plan">无订阅</option>
                </select></label
            ><button class="btn btn-ghost" @click="load(true)">查询</button
            ><button class="btn btn-ghost" :disabled="loading" @click="load()">
                刷新
            </button>
        </div>
        <section class="panel table-wrap user-table">
            <table>
                <thead>
                    <tr>
                        <th>用户</th>
                        <th>订阅</th>
                        <th>流量</th>
                        <th>余额 / 佣金</th>
                        <th>限制</th>
                        <th>状态</th>
                        <th>登录 / 创建</th>
                        <th class="right">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="8" class="empty">正在加载用户…</td>
                    </tr>
                    <tr v-else-if="!users.length">
                        <td colspan="8" class="empty">暂无符合条件的用户</td>
                    </tr>
                    <tr v-for="u in users" :key="u.id">
                        <td>
                            <button class="link-btn" @click="detail(u)">
                                {{ u.email }}</button
                            ><small
                                >#{{ u.id
                                }}<template v-if="u.is_admin">
                                    · 管理员</template
                                ><template v-else-if="u.is_staff">
                                    · 员工</template
                                ></small
                            >
                        </td>
                        <td>
                            <strong>{{ u.plan?.name || "无订阅" }}</strong
                            ><small>{{ time(u.expired_at) }}</small
                            ><small>{{ u.group?.name || "无权限组" }}</small>
                        </td>
                        <td>
                            <div class="user-traffic">
                                <span
                                    >{{ traffic(u.total_used) }} /
                                    {{ traffic(u.transfer_enable) }}</span
                                ><i
                                    ><em
                                        :class="{ danger: usage(u) >= 90 }"
                                        :style="{ width: `${usage(u)}%` }" /></i
                                ><small>已使用 {{ usage(u) }}%</small>
                            </div>
                        </td>
                        <td>
                            <strong
                                >¥{{
                                    Number(u.balance || 0).toFixed(2)
                                }}</strong
                            ><small
                                >佣金 ¥{{
                                    Number(u.commission_balance || 0).toFixed(2)
                                }}</small
                            >
                        </td>
                        <td>
                            <span>{{
                                u.speed_limit
                                    ? `${u.speed_limit} Mbps`
                                    : "不限速"
                            }}</span
                            ><small>{{
                                u.device_limit
                                    ? `${u.device_limit} 台设备`
                                    : "设备不限"
                            }}</small>
                        </td>
                        <td>
                            <span class="status-pill" :class="state(u)[1]">{{
                                state(u)[0]
                            }}</span>
                        </td>
                        <td>
                            <span>{{ time(u.last_login_at) }}</span
                            ><small>创建 {{ time(u.created_at) }}</small>
                        </td>
                        <td class="actions user-actions">
                            <button
                                class="btn btn-ghost btn-sm"
                                :disabled="busy === u.id"
                                @click="detail(u)"
                            >
                                详情</button
                            ><button
                                class="btn btn-ghost btn-sm"
                                @click="edit(u)"
                            >
                                编辑
                            </button>
                            <details>
                                <summary>更多</summary>
                                <div>
                                    <button
                                        @click="
                                            copy(u.subscribe_url, '订阅链接')
                                        "
                                    >
                                        复制订阅链接</button
                                    ><button @click="resetSecret(u)">
                                        重置订阅密钥</button
                                    ><button @click="toggleBan(u)">
                                        {{
                                            u.banned ? "解除封禁" : "封禁用户"
                                        }}</button
                                    ><button class="danger" @click="remove(u)">
                                        永久删除
                                    </button>
                                </div>
                            </details>
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
        <div class="pagination">
            <span>共 {{ page.total }} 人</span
            ><button
                class="btn btn-ghost btn-sm"
                :disabled="page.current <= 1 || loading"
                @click="
                    page.current--;
                    load();
                "
            >
                上一页</button
            ><span>{{ page.current }} / {{ page.last }}</span
            ><button
                class="btn btn-ghost btn-sm"
                :disabled="page.current >= page.last || loading"
                @click="
                    page.current++;
                    load();
                "
            >
                下一页
            </button>
        </div>
        <div
            v-if="showEdit"
            class="modal-backdrop"
            @click.self="showEdit = false"
        >
            <section class="modal-card user-modal">
                <div class="panel-head">
                    <div>
                        <h2>编辑用户</h2>
                        <p>#{{ form.id }} · 金额单位为元，流量单位为 GB。</p>
                    </div>
                    <button class="btn btn-ghost" @click="showEdit = false">
                        关闭
                    </button>
                </div>
                <div class="smart-form">
                    <label class="field field-wide"
                        ><span>邮箱 *</span
                        ><input v-model.trim="form.email" type="email" /></label
                    ><label class="field"
                        ><span>新密码</span
                        ><input
                            v-model="form.password"
                            type="password"
                            placeholder="留空不修改，至少 8 位" /></label
                    ><label class="field"
                        ><span>订阅套餐</span
                        ><select v-model="form.plan_id">
                            <option :value="null">无订阅</option>
                            <option
                                v-for="p in plans"
                                :key="p.id"
                                :value="p.id"
                            >
                                {{ p.name }}
                            </option>
                        </select></label
                    ><label class="field"
                        ><span>到期时间</span
                        ><input
                            v-model="form.expired_at"
                            type="datetime-local"
                        /><small>留空表示长期有效</small></label
                    ><label class="field"
                        ><span>总流量（GB）</span
                        ><input
                            v-model.number="form.transfer_gb"
                            type="number"
                            min="0"
                            step="0.01" /></label
                    ><label class="field"
                        ><span>余额（元）</span
                        ><input
                            v-model.number="form.balance"
                            type="number"
                            step="0.01" /></label
                    ><label class="field"
                        ><span>佣金余额（元）</span
                        ><input
                            v-model.number="form.commission_balance"
                            type="number"
                            step="0.01" /></label
                    ><label class="field"
                        ><span>返佣比例（%）</span
                        ><input
                            v-model.number="form.commission_rate"
                            type="number"
                            min="0"
                            max="100" /></label
                    ><label class="field"
                        ><span>专属折扣（%）</span
                        ><input
                            v-model.number="form.discount"
                            type="number"
                            min="0"
                            max="100" /></label
                    ><label class="field"
                        ><span>限速（Mbps）</span
                        ><input
                            v-model.number="form.speed_limit"
                            type="number"
                            min="0"
                        /><small>0 表示不限速</small></label
                    ><label class="field"
                        ><span>设备数量限制</span
                        ><input
                            v-model.number="form.device_limit"
                            type="number"
                            min="0"
                        /><small>0 表示不限设备</small></label
                    ><label class="field"
                        ><span>邀请人邮箱</span
                        ><input
                            v-model.trim="form.invite_user_email"
                            type="email"
                            placeholder="留空解除邀请关系" /></label
                    ><label class="field"
                        ><span>账号状态</span
                        ><select v-model="form.banned">
                            <option :value="false">正常</option>
                            <option :value="true">封禁</option>
                        </select></label
                    ><label class="field"
                        ><span>后台角色</span
                        ><select v-model="form.is_staff">
                            <option :value="false">普通用户</option>
                            <option :value="true">后台员工</option>
                        </select></label
                    ><label class="field"
                        ><span>管理员权限</span
                        ><select v-model="form.is_admin">
                            <option :value="false">非管理员</option>
                            <option :value="true">管理员</option>
                        </select></label
                    ><label class="field field-wide"
                        ><span>管理员备注</span
                        ><textarea v-model="form.remarks" rows="3" />
                    </label>
                </div>
                <div class="force-update" v-if="form.is_admin || form.is_staff">
                    <AppIcon name="ShieldAlert" :size="18" /><span
                        ><strong>后台权限提醒</strong
                        ><small
                            >员工或管理员可登录管理后台，请只授予可信账号。</small
                        ></span
                    >
                </div>
                <div class="modal-actions">
                    <button class="btn btn-ghost" @click="showEdit = false">
                        取消</button
                    ><button
                        class="btn btn-primary"
                        :disabled="saving"
                        @click="save"
                    >
                        {{ saving ? "保存中…" : "保存用户" }}
                    </button>
                </div>
            </section>
        </div>
        <div
            v-if="showDetail && selected"
            class="modal-backdrop"
            @click.self="showDetail = false"
        >
            <section class="modal-card user-detail">
                <div class="panel-head">
                    <div>
                        <h2>用户详情</h2>
                        <p>{{ selected.email }} · #{{ selected.id }}</p>
                    </div>
                    <button class="btn btn-ghost" @click="showDetail = false">
                        关闭
                    </button>
                </div>
                <div class="detail-summary">
                    <span
                        >账号状态<strong>{{ state(selected)[0] }}</strong></span
                    ><span
                        >订阅套餐<strong>{{
                            selected.plan?.name || `#${selected.plan_id || "-"}`
                        }}</strong></span
                    ><span
                        >余额<strong
                            >¥{{
                                (Number(selected.balance || 0) / 100).toFixed(2)
                            }}</strong
                        ></span
                    ><span
                        >到期时间<strong>{{
                            time(selected.expired_at)
                        }}</strong></span
                    >
                </div>
                <div class="order-detail-grid">
                    <span
                        >UUID<strong>{{ selected.uuid }}</strong></span
                    ><span
                        >邀请人<strong>{{
                            selected.invite_user?.email || "-"
                        }}</strong></span
                    ><span
                        >总流量<strong>{{
                            traffic(selected.transfer_enable)
                        }}</strong></span
                    ><span
                        >上行 / 下行<strong
                            >{{ traffic(selected.u) }} /
                            {{ traffic(selected.d) }}</strong
                        ></span
                    ><span
                        >限速<strong
                            >{{ selected.speed_limit || "不限"
                            }}{{ selected.speed_limit ? " Mbps" : "" }}</strong
                        ></span
                    ><span
                        >设备限制<strong>{{
                            selected.device_limit || "不限"
                        }}</strong></span
                    ><span
                        >最后登录<strong>{{
                            time(selected.last_login_at)
                        }}</strong></span
                    ><span
                        >创建时间<strong>{{
                            time(selected.created_at)
                        }}</strong></span
                    ><span
                        >Telegram ID<strong>{{
                            selected.telegram_id || "-"
                        }}</strong></span
                    ><span
                        >管理员备注<strong>{{
                            selected.remarks || "-"
                        }}</strong></span
                    >
                </div>
                <div class="modal-actions">
                    <button
                        class="btn btn-ghost"
                        @click="copy(selected.uuid, 'UUID')"
                    >
                        复制 UUID</button
                    ><button
                        class="btn btn-primary"
                        @click="
                            showDetail = false;
                            edit(
                                users.find((u) => u.id === selected.id) ||
                                    selected,
                            );
                        "
                    >
                        编辑用户
                    </button>
                </div>
            </section>
        </div>
        <div
            v-if="showCreate"
            class="modal-backdrop"
            @click.self="showCreate = false"
        >
            <section class="modal-card user-create-modal">
                <div class="panel-head">
                    <div>
                        <h2>创建用户</h2>
                        <p>支持单个账号或最多 500 个批量账号。</p>
                    </div>
                    <button class="btn btn-ghost" @click="showCreate = false">关闭</button>
                </div>
                <label class="user-create-mode">
                    <input v-model="createForm.batch" type="checkbox" />
                    <span><strong>批量创建账号</strong><small>批量账号格式为“前缀_序号@域名”。</small></span>
                </label>
                <div class="smart-form">
                    <label v-if="!createForm.batch" class="field field-wide">
                        <span>用户邮箱 *</span>
                        <input v-model.trim="createForm.email" type="email" placeholder="user@example.com" />
                    </label>
                    <template v-else>
                        <label class="field"><span>邮箱前缀 *</span><input v-model.trim="createForm.email_prefix" placeholder="user" /></label>
                        <label class="field"><span>邮箱域名 *</span><input v-model.trim="createForm.email_suffix" placeholder="example.com" /></label>
                        <label class="field"><span>创建数量 *</span><input v-model.number="createForm.generate_count" type="number" min="1" max="500" /></label>
                    </template>
                    <label class="field"><span>初始密码</span><input v-model="createForm.password" type="password" placeholder="留空则使用完整邮箱" /><small>自定义密码至少 8 位</small></label>
                    <label class="field"><span>初始套餐</span><select v-model="createForm.plan_id"><option :value="null">无订阅</option><option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
                    <label class="field"><span>套餐到期时间</span><input v-model="createForm.expired_at" type="datetime-local" /><small>留空表示长期有效</small></label>
                </div>
                <div v-if="createdUsers.length" class="created-users-result">
                    <div><strong>成功创建 {{ createdUsers.length }} 个账号</strong><button class="btn btn-ghost btn-sm" @click="downloadCreated">导出 CSV</button></div>
                    <p>请及时保存初始密码；关闭弹窗后将不再显示。</p>
                    <div><code v-for="u in createdUsers.slice(0, 8)" :key="u.email">{{ u.email }} · {{ u.password }}</code><small v-if="createdUsers.length > 8">另有 {{ createdUsers.length - 8 }} 个账号，请导出 CSV 查看</small></div>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-ghost" @click="showCreate = false">取消</button>
                    <button class="btn btn-primary" :disabled="saving" @click="createUsers">{{ saving ? "创建中…" : createForm.batch ? "批量创建" : "创建用户" }}</button>
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
