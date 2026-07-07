import { createApp, computed, onMounted, reactive, ref } from './vendor/vue.esm-browser.prod.js';

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

function baseUrl() {
  const base = (window.settings && window.settings.base_url) || '/';
  return String(base).replace(/\/$/, '');
}

function securePath() {
  return String((window.settings && window.settings.secure_path) || '').replace(/^\/|\/$/g, '');
}

function apiPrefix() {
  return `${baseUrl()}/api/v2/${securePath()}/group-buy`;
}

function authToken() {
  const raw = localStorage.getItem('XBOARD_ACCESS_TOKEN');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.value ? parsed.value : '';
  } catch (error) {
    return raw;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${apiPrefix()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authToken(),
      'Content-Language': localStorage.getItem('i18nextLng') || 'zh-CN',
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.status === 'fail') {
    throw new Error(json.message || '请求失败');
  }
  return json.data ?? json;
}

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

function toDatetimeInput(timestamp) {
  if (!timestamp) return '';
  const date = new Date(Number(timestamp) * 1000);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

createApp({
  setup() {
    const loading = ref(false);
    const saving = ref(false);
    const groupLoading = ref(false);
    const showForm = ref(false);
    const plans = ref([]);
    const periods = ref({});
    const activities = ref([]);
    const groups = ref([]);
    const selectedActivity = ref(null);
    const form = reactive(defaultForm());
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
    const message = reactive({
      text: '',
      type: 'success',
      timer: null,
    });

    const adminHome = computed(() => `${baseUrl()}/${securePath()}`);
    const selectedPlan = computed(() => plans.value.find((plan) => Number(plan.id) === Number(form.plan_id)));
    const periodOptions = computed(() => {
      const plan = selectedPlan.value;
      if (!plan) return [];
      return (plan.active_periods || [])
        .filter((period) => plan.prices && Number(plan.prices[period]) > 0)
        .map((period) => ({
          value: period,
          label: (periods.value[period] && periods.value[period].name) || PERIOD_LABELS[period] || period,
          price: Math.round(Number(plan.prices[period] || 0) * 100),
        }));
    });
    const summary = computed(() => ({
      total: pagination.total,
      enabled: activities.value.filter((item) => Number(item.status) === 1).length,
      openGroups: activities.value.reduce((sum, item) => sum + Number(item.open_groups_count || 0), 0),
      completedGroups: activities.value.reduce((sum, item) => sum + Number(item.completed_groups_count || 0), 0),
    }));

    function notify(text, type = 'success') {
      if (message.timer) clearTimeout(message.timer);
      message.text = text;
      message.type = type;
      message.timer = setTimeout(() => {
        message.text = '';
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
        const query = new URLSearchParams({
          current: String(page),
          pageSize: String(pagination.per_page),
          status: filters.status,
        });
        if (filters.keyword) query.set('keyword', filters.keyword);
        if (filters.plan_id) query.set('plan_id', filters.plan_id);
        const data = await request(`/fetch?${query.toString()}`);
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
      if (plans.value[0]) form.plan_id = plans.value[0].id;
      syncPeriod();
      showForm.value = true;
    }

    function cancelForm() {
      showForm.value = false;
      resetReactive(form, defaultForm());
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

    async function saveActivity() {
      if (!form.plan_id || !form.period) {
        notify('请选择套餐和周期', 'error');
        return;
      }
      saving.value = true;
      try {
        await request('/save', {
          method: 'POST',
          body: JSON.stringify({
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
          }),
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
      try {
        await request('/update', {
          method: 'POST',
          body: JSON.stringify({
            id: activity.id,
            status: activity.status === 1 ? 0 : 1,
          }),
        });
        notify('状态已更新');
        await fetchActivities(pagination.current_page);
      } catch (error) {
        notify(error.message || '更新失败', 'error');
      }
    }

    async function deleteActivity(activity) {
      if (!window.confirm(`确定删除「${activity.title}」？`)) return;
      try {
        await request('/drop', {
          method: 'POST',
          body: JSON.stringify({ id: activity.id }),
        });
        notify('已删除活动');
        await fetchActivities(pagination.current_page);
      } catch (error) {
        notify(error.message || '删除失败', 'error');
      }
    }

    async function openGroups(activity) {
      selectedActivity.value = activity;
      groups.value = [];
      groupLoading.value = true;
      try {
        const query = new URLSearchParams({
          activity_id: String(activity.id),
          current: '1',
          pageSize: '50',
        });
        const data = await request(`/groups?${query.toString()}`);
        groups.value = data.items || [];
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

    onMounted(() => {
      if (!authToken()) {
        notify('请先登录后台', 'error');
        return;
      }
      if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark');
      }
      fetchActivities(1);
    });

    return {
      adminHome,
      activities,
      cancelForm,
      deleteActivity,
      editActivity,
      fetchActivities,
      filters,
      form,
      formatMoney,
      formatTime,
      groupLoading,
      groups,
      loading,
      message,
      openGroups,
      pagination,
      periodOptions,
      plans,
      saveActivity,
      saving,
      selectedActivity,
      showForm,
      startCreate,
      summary,
      syncPeriod,
      toggleActivity,
    };
  },
}).mount('#app');
