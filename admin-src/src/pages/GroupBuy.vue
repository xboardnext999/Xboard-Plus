<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import {
  dropGroupBuyActivity,
  fetchGroupBuyActivities,
  fetchGroupBuyGroups,
  saveGroupBuyActivity,
  updateGroupBuyActivity,
} from '../services/groupBuy';

const PERIOD_LABELS = {
  monthly: '月付',
  quarterly: '季付',
  half_yearly: '半年付',
  yearly: '年付',
  two_yearly: '两年付',
  three_yearly: '三年付',
  onetime: '一次性',
  reset_traffic: '重置流量',
};

const loading = ref(false);
const saving = ref(false);
const groupLoading = ref(false);
const showForm = ref(false);
const plans = ref([]);
const periods = ref({});
const activities = ref([]);
const groups = ref([]);
const selectedActivity = ref(null);
const busyId = ref(null);
const groupStatus = ref('all');
const groupPagination = reactive({ current_page: 1, total: 0, last_page: 1 });

const filters = reactive({
  keyword: '',
  status: 'all',
  plan_id: '',
});

const pagination = reactive({
  current_page: 1,
  per_page: 10,
  total: 0,
  last_page: 1,
});

const toast = reactive({
  text: '',
  type: 'success',
  timer: null,
});

function defaultForm() {
  return {
    id: null,
    title: '',
    plan_id: '',
    period: '',
    group_size: 2,
    discount_type: 1,
    discount_value_yuan: 0,
    discount_value_percent: 10,
    started_at: '',
    ended_at: '',
    expire_minutes: 1440,
    status: 1,
  };
}

const form = reactive(defaultForm());

const selectedPlan = computed(() => plans.value.find((plan) => Number(plan.id) === Number(form.plan_id)));
const periodOptions = computed(() => {
  const plan = selectedPlan.value;
  if (!plan) return [];
  return (plan.active_periods || [])
    .filter((period) => plan.prices && Number(plan.prices[period]) > 0)
    .map((period) => ({
      value: period,
      label: periods.value?.[period]?.name || PERIOD_LABELS[period] || period,
      price: Math.round(Number(plan.prices[period] || 0) * 100),
    }));
});
const selectedPeriod = computed(() => periodOptions.value.find((item) => item.value === form.period));
const previewPrice = computed(() => {
  const original = Number(selectedPeriod.value?.price || 0);
  if (!original) return { original: 0, discount: 0, final: 0 };
  const discount = Number(form.discount_type) === 1
    ? Math.round(Number(form.discount_value_yuan || 0) * 100)
    : Math.round(original * Number(form.discount_value_percent || 0) / 100);
  return { original, discount: Math.min(original, Math.max(0, discount)), final: Math.max(0, original - discount) };
});

const summary = computed(() => ({
  total: pagination.total,
  enabled: activities.value.filter((item) => Number(item.status) === 1).length,
  openGroups: activities.value.reduce((sum, item) => sum + Number(item.open_groups_count || 0), 0),
  completedGroups: activities.value.reduce((sum, item) => sum + Number(item.completed_groups_count || 0), 0),
}));

function notify(text, type = 'success') {
  if (toast.timer) clearTimeout(toast.timer);
  toast.text = text;
  toast.type = type;
  toast.timer = setTimeout(() => {
    toast.text = '';
  }, 2600);
}

function resetReactive(target, source) {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  Object.assign(target, source);
}

function syncPeriod() {
  const options = periodOptions.value;
  if (!options.length) {
    form.period = '';
    return;
  }
  if (!options.some((item) => item.value === form.period)) {
    form.period = options[0].value;
  }
}

async function fetchActivities(page = pagination.current_page) {
  loading.value = true;
  try {
    const data = await fetchGroupBuyActivities({
      current: page,
      pageSize: pagination.per_page,
      keyword: filters.keyword,
      status: filters.status,
      plan_id: filters.plan_id,
    });
    activities.value = data.items || [];
    plans.value = data.plans || plans.value;
    periods.value = data.periods || periods.value;
    pagination.current_page = data.current_page || page;
    pagination.per_page = data.per_page || pagination.per_page;
    pagination.total = data.total || 0;
    pagination.last_page = data.last_page || 1;
    syncPeriod();
  } catch (error) {
    notify(error.message || '加载失败', 'error');
  } finally {
    loading.value = false;
  }
}

function startCreate() {
  resetReactive(form, defaultForm());
  if (plans.value[0]) {
    form.plan_id = plans.value[0].id;
  }
  syncPeriod();
  showForm.value = true;
}

function cancelForm() {
  showForm.value = false;
  resetReactive(form, defaultForm());
}

function toDatetimeInput(timestamp) {
  if (!timestamp) return '';
  const date = new Date(Number(timestamp) * 1000);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function editActivity(activity) {
  resetReactive(form, {
    ...defaultForm(),
    id: activity.id,
    title: activity.title,
    plan_id: activity.plan_id,
    period: activity.period,
    group_size: activity.group_size,
    discount_type: activity.discount_type,
    discount_value_yuan: activity.discount_type === 1 ? Number(activity.discount_value || 0) / 100 : 0,
    discount_value_percent: activity.discount_type === 2 ? Number(activity.discount_value || 0) : 10,
    started_at: toDatetimeInput(activity.started_at),
    ended_at: toDatetimeInput(activity.ended_at),
    expire_minutes: activity.expire_minutes,
    status: activity.status,
  });
  showForm.value = true;
}

function copyActivity(activity) {
  editActivity(activity);
  form.id = null;
  form.title = `${activity.title} - 副本`;
  form.status = 0;
}

async function saveActivity() {
  if (!form.plan_id || !form.period) {
    notify('请选择套餐和周期', 'error');
    return;
  }
  if (Number(form.group_size) < 2 || Number(form.group_size) > 100) {
    notify('成团人数必须在 2–100 人之间', 'error');
    return;
  }
  if (Number(form.discount_type) === 1 && previewPrice.value.discount >= previewPrice.value.original) {
    notify('固定优惠必须小于套餐原价', 'error');
    return;
  }
  if (Number(form.discount_type) === 2 && (Number(form.discount_value_percent) <= 0 || Number(form.discount_value_percent) >= 100)) {
    notify('折扣比例必须大于 0 且小于 100%', 'error');
    return;
  }
  if (form.started_at && form.ended_at && new Date(form.ended_at) <= new Date(form.started_at)) {
    notify('结束时间必须晚于开始时间', 'error');
    return;
  }
  saving.value = true;
  try {
    await saveGroupBuyActivity({
      id: form.id,
      title: form.title,
      plan_id: form.plan_id,
      period: form.period,
      group_size: form.group_size,
      discount_type: form.discount_type,
      discount_value: form.discount_type === 1
        ? Math.round(Number(form.discount_value_yuan || 0) * 100)
        : Math.round(Number(form.discount_value_percent || 0)),
      started_at: form.started_at,
      ended_at: form.ended_at,
      expire_minutes: form.expire_minutes,
      status: form.status,
    });
    notify('已保存拼团活动');
    showForm.value = false;
    await fetchActivities(form.id ? pagination.current_page : 1);
  } catch (error) {
    notify(error.message || '保存失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function toggleActivity(activity) {
  busyId.value = activity.id;
  try {
    await updateGroupBuyActivity({
      id: activity.id,
      status: activity.status === 1 ? 0 : 1,
    });
    notify('状态已更新');
    await fetchActivities(pagination.current_page);
  } catch (error) {
    notify(error.message || '更新失败', 'error');
  } finally {
    busyId.value = null;
  }
}

async function deleteActivity(activity) {
  if (Number(activity.groups_count || 0) > 0) {
    notify('该活动已有拼团队伍，不能删除，请停用活动', 'error');
    return;
  }
  if (!window.confirm(`确定删除「${activity.title}」？`)) return;
  busyId.value = activity.id;
  try {
    await dropGroupBuyActivity(activity.id);
    notify('已删除活动');
    await fetchActivities(pagination.current_page);
  } catch (error) {
    notify(error.message || '删除失败', 'error');
  } finally {
    busyId.value = null;
  }
}

async function openGroups(activity, page = 1) {
  selectedActivity.value = activity;
  if (page === 1) groups.value = [];
  groupLoading.value = true;
  try {
    const data = await fetchGroupBuyGroups({
      activity_id: activity.id,
      status: groupStatus.value,
      current: page,
      pageSize: 20,
    });
    groups.value = data.items || [];
    groupPagination.current_page = data.current_page || page;
    groupPagination.total = data.total || 0;
    groupPagination.last_page = data.last_page || 1;
  } catch (error) {
    notify(error.message || '加载队伍失败', 'error');
  } finally {
    groupLoading.value = false;
  }
}

function formatMoney(cents) {
  return `¥${(Number(cents || 0) / 100).toFixed(2)}`;
}

function formatTime(timestamp) {
  if (!timestamp) return '不限';
  return new Date(Number(timestamp) * 1000).toLocaleString('zh-CN', { hour12: false });
}

function activityPhase(activity) {
  if (Number(activity.status) !== 1) return { text: '已停用', class: 'off' };
  const now = Math.floor(Date.now() / 1000);
  if (activity.started_at && Number(activity.started_at) > now) return { text: '未开始', class: 'waiting' };
  if (activity.ended_at && Number(activity.ended_at) < now) return { text: '已结束', class: 'off' };
  return { text: '进行中', class: '' };
}

function groupProgress(group) {
  return Math.min(100, Math.round(Number(group.current_count || 0) / Math.max(1, Number(group.required_count || 1)) * 100));
}

function durationLabel(minutes) {
  const value = Number(minutes || 0);
  if (value % 1440 === 0) return `${value / 1440} 天`;
  if (value % 60 === 0) return `${value / 60} 小时`;
  return `${value} 分钟`;
}

onMounted(() => {
  fetchActivities(1);
});
</script>

<template>
  <section class="page-stack">
    <div class="page-heading page-heading-row">
      <div>
        <h1>拼团管理</h1>
        <p>管理套餐拼团活动、查看队伍进度，并控制活动启停。</p>
      </div>
      <button class="btn btn-primary" type="button" @click="startCreate">新建活动</button>
    </div>

    <div class="stat-grid">
      <article class="stat-card">
        <span>活动总数</span>
        <strong>{{ summary.total }}</strong>
      </article>
      <article class="stat-card">
        <span>启用中</span>
        <strong>{{ summary.enabled }}</strong>
      </article>
      <article class="stat-card">
        <span>进行中队伍</span>
        <strong>{{ summary.openGroups }}</strong>
      </article>
      <article class="stat-card">
        <span>已成团队伍</span>
        <strong>{{ summary.completedGroups }}</strong>
      </article>
    </div>

    <div v-if="showForm" class="modal-backdrop" @click.self="cancelForm">
    <section class="modal-card group-buy-modal">
      <div class="panel-head">
        <div>
          <h2>{{ form.id ? '编辑拼团活动' : '新建拼团活动' }}</h2>
          <p>固定优惠按元填写，保存后自动转换为订单金额单位。</p>
        </div>
        <button class="btn btn-ghost" type="button" @click="cancelForm">关闭</button>
      </div>

      <div class="form-grid">
        <label class="field">
          <span>活动标题</span>
          <input v-model.trim="form.title" placeholder="例如：标准会员拼团" />
        </label>
        <label class="field">
          <span>绑定套餐</span>
          <select v-model.number="form.plan_id" @change="syncPeriod">
            <option value="">请选择套餐</option>
            <option v-for="plan in plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
          </select>
        </label>
        <label class="field">
          <span>套餐周期</span>
          <select v-model="form.period">
            <option value="">请选择周期</option>
            <option v-for="period in periodOptions" :key="period.value" :value="period.value">
              {{ period.label }} · {{ formatMoney(period.price) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>成团人数</span>
          <input v-model.number="form.group_size" type="number" min="2" max="100" />
        </label>
        <label class="field">
          <span>优惠类型</span>
          <select v-model.number="form.discount_type">
            <option :value="1">固定金额</option>
            <option :value="2">百分比折扣</option>
          </select>
        </label>
        <label v-if="form.discount_type === 1" class="field">
          <span>固定优惠（元）</span>
          <input v-model.number="form.discount_value_yuan" type="number" min="0" step="0.01" />
        </label>
        <label v-else class="field">
          <span>折扣比例（%）</span>
          <input v-model.number="form.discount_value_percent" type="number" min="0" max="100" step="1" />
        </label>
        <label class="field">
          <span>开始时间</span>
          <input v-model="form.started_at" type="datetime-local" />
        </label>
        <label class="field">
          <span>结束时间</span>
          <input v-model="form.ended_at" type="datetime-local" />
        </label>
        <label class="field">
          <span>队伍有效期（分钟）</span>
          <input v-model.number="form.expire_minutes" type="number" min="1" max="10080" />
        </label>
        <label class="field">
          <span>活动状态</span>
          <ToggleSwitch v-model="form.status" :true-value="1" :false-value="0" on-label="已启用" off-label="已停用" />
        </label>
      </div>

      <div v-if="selectedPeriod" class="group-buy-preview">
        <div><span>套餐原价</span><strong>{{ formatMoney(previewPrice.original) }}</strong></div>
        <div><span>拼团优惠</span><strong>- {{ formatMoney(previewPrice.discount) }}</strong></div>
        <div class="highlight"><span>预计实付</span><strong>{{ formatMoney(previewPrice.final) }}</strong></div>
        <div><span>队伍有效期</span><strong>{{ durationLabel(form.expire_minutes) }}</strong></div>
      </div>

      <div class="form-actions">
        <button class="btn btn-ghost" type="button" @click="cancelForm">取消</button>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="saveActivity">
          {{ saving ? '保存中...' : '保存活动' }}
        </button>
      </div>
    </section>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>活动列表</h2>
          <p>可以按套餐、状态和关键字筛选。</p>
        </div>
      </div>

      <div class="filters">
        <input v-model.trim="filters.keyword" placeholder="搜索活动 / 套餐名称" @keyup.enter="fetchActivities(1)" />
        <select v-model="filters.status" @change="fetchActivities(1)">
          <option value="all">全部状态</option>
          <option value="1">启用</option>
          <option value="0">停用</option>
        </select>
        <select v-model="filters.plan_id" @change="fetchActivities(1)">
          <option value="">全部套餐</option>
          <option v-for="plan in plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option>
        </select>
        <button class="btn btn-ghost" type="button" @click="fetchActivities(1)">筛选</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>活动</th>
              <th>套餐周期</th>
              <th>成团人数</th>
              <th>优惠</th>
              <th>时间</th>
              <th>队伍</th>
              <th>状态</th>
              <th class="right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="9" class="empty">加载中...</td>
            </tr>
            <tr v-else-if="activities.length === 0">
              <td colspan="9" class="empty">暂无拼团活动</td>
            </tr>
            <tr v-for="activity in activities" :key="activity.id">
              <td>#{{ activity.id }}</td>
              <td>
                <strong>{{ activity.title }}</strong>
                <small>{{ activity.plan_name }}</small>
              </td>
              <td>
                {{ activity.period_label }}
                <small>原价 {{ formatMoney(activity.period_price) }}</small>
                <small>实付 {{ formatMoney(activity.discount_type === 1 ? Math.max(0, activity.period_price - activity.discount_value) : Math.round(activity.period_price * (100 - activity.discount_value) / 100)) }}</small>
              </td>
              <td>{{ activity.group_size }} 人</td>
              <td>{{ activity.discount_label }}</td>
              <td>
                <small>开始：{{ formatTime(activity.started_at) }}</small>
                <small>结束：{{ formatTime(activity.ended_at) }}</small>
                <small>队伍有效：{{ durationLabel(activity.expire_minutes) }}</small>
              </td>
              <td>
                <button class="link-btn" type="button" @click="openGroups(activity)">
                  {{ activity.open_groups_count }} 进行中 / {{ activity.completed_groups_count }} 已成团 / {{ activity.expired_groups_count }} 过期
                </button>
              </td>
              <td>
                <span class="status-pill" :class="activityPhase(activity).class">{{ activityPhase(activity).text }}</span>
              </td>
              <td class="actions">
                <button class="btn btn-ghost btn-sm" type="button" @click="editActivity(activity)">编辑</button>
                <button class="btn btn-ghost btn-sm" type="button" @click="copyActivity(activity)">复制</button>
                <button class="btn btn-ghost btn-sm" type="button" :disabled="busyId === activity.id" @click="toggleActivity(activity)">
                  {{ activity.status === 1 ? '停用' : '启用' }}
                </button>
                <button class="btn btn-danger btn-sm" type="button" :disabled="activity.groups_count > 0 || busyId === activity.id" :title="activity.groups_count > 0 ? '已有队伍的活动不能删除' : ''" @click="deleteActivity(activity)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <span>共 {{ pagination.total }} 条</span>
        <button class="btn btn-ghost btn-sm" type="button" :disabled="pagination.current_page <= 1" @click="fetchActivities(pagination.current_page - 1)">上一页</button>
        <span>{{ pagination.current_page }} / {{ pagination.last_page || 1 }}</span>
        <button class="btn btn-ghost btn-sm" type="button" :disabled="pagination.current_page >= pagination.last_page" @click="fetchActivities(pagination.current_page + 1)">下一页</button>
      </div>
    </section>

    <section v-if="selectedActivity" class="panel">
      <div class="panel-head">
        <div>
          <h2>队伍列表</h2>
          <p>{{ selectedActivity.title }} 的拼团队伍状态。</p>
        </div>
        <button class="btn btn-ghost" type="button" @click="selectedActivity = null">关闭</button>
      </div>
      <div class="group-buy-group-toolbar">
        <select v-model="groupStatus" @change="openGroups(selectedActivity, 1)">
          <option value="all">全部队伍</option>
          <option value="1">进行中</option>
          <option value="2">已成团</option>
          <option value="3">已过期</option>
        </select>
        <span>共 {{ groupPagination.total }} 支队伍</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>队伍ID</th>
              <th>团长</th>
              <th>人数</th>
              <th>状态</th>
              <th>过期时间</th>
              <th>成员</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="groupLoading">
              <td colspan="6" class="empty">加载中...</td>
            </tr>
            <tr v-else-if="groups.length === 0">
              <td colspan="6" class="empty">暂无队伍</td>
            </tr>
            <tr v-for="group in groups" :key="group.id">
              <td>#{{ group.id }}</td>
              <td>{{ group.leader_email }}</td>
              <td><div class="group-buy-progress"><span>{{ group.current_count }} / {{ group.required_count }}</span><i><em :style="{ width: `${groupProgress(group)}%` }" /></i></div></td>
              <td><span class="status-pill" :class="{ off: group.status === 3, waiting: group.status === 1 }">{{ group.status_label }}</span></td>
              <td>{{ formatTime(group.expired_at) }}</td>
              <td>
                <div class="member-list">
                  <span v-for="member in group.members" :key="member.id">
                    {{ member.email }} · {{ member.status_label }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span>第 {{ groupPagination.current_page }} / {{ groupPagination.last_page || 1 }} 页</span>
        <button class="btn btn-ghost btn-sm" :disabled="groupPagination.current_page <= 1 || groupLoading" @click="openGroups(selectedActivity, groupPagination.current_page - 1)">上一页</button>
        <button class="btn btn-ghost btn-sm" :disabled="groupPagination.current_page >= groupPagination.last_page || groupLoading" @click="openGroups(selectedActivity, groupPagination.current_page + 1)">下一页</button>
      </div>
    </section>

    <div v-if="toast.text" class="toast" :class="{ error: toast.type === 'error' }">
      {{ toast.text }}
    </div>
  </section>
</template>
