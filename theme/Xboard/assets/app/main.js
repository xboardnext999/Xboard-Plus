import { createApp, h, onMounted, reactive, watch } from './vendor/vue.esm-browser.prod.js';
import { api, clearToken, getToken, isAuthenticated, setToken } from './api.js';
import {
  bytes,
  copyText,
  date,
  money,
  normalizeCollection,
  percent,
  queryString,
  statusText,
  time,
} from './helpers.js';

const settings = window.settings || {};
const themeStorageKey = 'xboard-plus-theme';
const languageStorageKey = 'xboard-plus-language';
const appName = () => settings.title || 'Xboard Plus';
const currencySymbol = () => state.comm?.currency_symbol || '¥';

const orderStatus = {
  0: '待支付',
  1: '开通中',
  2: '已取消',
  3: '已完成',
  4: '已折抵',
};

const ticketStatus = {
  0: '处理中',
  1: '已关闭',
};

const ticketLevel = {
  0: '低',
  1: '中',
  2: '高',
};

const periods = [
  ['month_price', '月付'],
  ['quarter_price', '季付'],
  ['half_year_price', '半年付'],
  ['year_price', '年付'],
  ['two_year_price', '两年付'],
  ['three_year_price', '三年付'],
  ['onetime_price', '一次性'],
  ['reset_price', '流量重置'],
];

const navItems = [
  { key: 'dashboard', label: '仪表盘', group: '', icon: 'dashboard.webp' },
  { key: 'plans', label: '购买套餐', group: '', icon: 'plan.webp' },
  { key: 'invite', label: '邀请好友', group: '', icon: 'invite.webp' },
  { key: 'subscribe', label: '我的订阅', group: '订阅', icon: 'subscription.webp' },
  { key: 'recharge', label: '充值余额', group: '订阅', icon: 'wallet.webp' },
  { key: 'knowledge', label: '使用教程', group: '服务', icon: 'knowledge.webp' },
  { key: 'tickets', label: '工单中心', group: '服务', icon: 'ticket.webp' },
  { key: 'nodes', label: '节点状态', group: '记录', icon: 'node.webp' },
  { key: 'orders', label: '订单记录', group: '记录', icon: 'order.webp' },
  { key: 'traffic', label: '流量统计', group: '记录', icon: 'traffic.webp' },
  { key: 'profile', label: '账号设置', group: '账号', icon: 'profile.webp' },
];

const publicRoutes = new Set(['login', 'register', 'forgot']);

const languageOptions = [
  { code: 'zh-CN', short: '简', label: '简体中文', flag: 'CN.png' },
  { code: 'zh-TW', short: '繁', label: '繁體中文', flag: 'TW.png' },
  { code: 'en-US', short: 'EN', label: 'English', flag: 'US.png' },
  { code: 'ja-JP', short: '日', label: '日本語', flag: 'JP.png' },
  { code: 'ko-KR', short: '한', label: '한국어', flag: 'KR.png' },
  { code: 'ru-RU', short: 'RU', label: 'Русский', flag: 'RU.png' },
  { code: 'vi-VN', short: 'VI', label: 'Tiếng Việt', flag: 'VN.png' },
  { code: 'fil-PH', short: 'PH', label: 'Filipino', flag: 'PH.png' },
  { code: 'ms-MY', short: 'MS', label: 'Bahasa Melayu', flag: 'MY.png' },
  { code: 'fa-IR', short: 'فا', label: 'فارسی', flag: 'IR.png', rtl: true },
];

function parseRoute() {
  const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [name = 'dashboard', search = ''] = raw.split('?');
  return {
    fullPath: raw || 'dashboard',
    name: name || 'dashboard',
    query: Object.fromEntries(new URLSearchParams(search)),
  };
}

function go(name, params = {}) {
  const search = queryString(params);
  location.hash = `#/${name}${search ? `?${search}` : ''}`;
}

function storedTheme() {
  try {
    return localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function storedLanguage() {
  try {
    const code = localStorage.getItem(languageStorageKey);
    return languageOptions.some((item) => item.code === code) ? code : 'zh-CN';
  } catch {
    return 'zh-CN';
  }
}

function applyTheme(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = normalized;
  document.documentElement.style.colorScheme = normalized;
  try {
    localStorage.setItem(themeStorageKey, normalized);
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

function appAsset(file) {
  const base = settings.assets_path || '/theme/Xboard/assets';
  return `${base.replace(/\/$/, '')}/app/${file.replace(/^\//, '')}`;
}

function siteLogoUrl() {
  const logo = String(settings.logo || '').trim();
  if (!logo) return appAsset('icons/Logo.webp');
  if (/^(https?:)?\/\//i.test(logo) || logo.startsWith('data:') || logo.startsWith('/')) return logo;
  return `/${logo.replace(/^\//, '')}`;
}

function currentTitle(name) {
  return navItems.find((item) => item.key === name)?.label || '仪表盘';
}

function activeLanguage() {
  return languageOptions.find((item) => item.code === state.language) || languageOptions[0];
}

function selectLanguage(code) {
  const language = languageOptions.find((item) => item.code === code) || languageOptions[0];
  state.language = language.code;
  state.languageMenuOpen = false;
  try {
    localStorage.setItem(languageStorageKey, language.code);
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

function navGroups() {
  const groups = [];
  navItems.forEach((item) => {
    let group = groups.find((entry) => entry.name === item.group);
    if (!group) {
      group = { name: item.group, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  });
  return groups;
}

function usageSummary(subscribe = {}) {
  const used = Number(subscribe.u || 0) + Number(subscribe.d || 0);
  const total = Number(subscribe.transfer_enable || 0);
  const ratio = percent(used, total);
  return { used, total, ratio };
}

function userDisplayName(user = state.user) {
  const name = String(user?.name || '').trim();
  if (name) return name;
  return user?.email ? user.email.split('@')[0] : 'Admin';
}

function defaultAvatarUrl() {
  return appAsset('icons/avatar.webp');
}

function userAvatarUrl(user = state.user) {
  if (user?.avatar) return user.avatar;
  if (user?.avatar_url && !String(user.avatar_url).includes('/gravatar/')) return user.avatar_url;
  return defaultAvatarUrl();
}

function safeBody(html) {
  return String(html || '');
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

const state = reactive({
  guest: {},
  comm: {},
  user: null,
  subscribe: null,
  stat: [0, 0, 0],
  booted: false,
  ready: false,
  route: parseRoute(),
  theme: storedTheme(),
  language: storedLanguage(),
  sidebarOpen: false,
  sidebarCollapsed: false,
  userMenuOpen: false,
  languageMenuOpen: false,
  progress: 'idle',
  toasts: [],
});

let bootPromise = null;
let progressTimer = null;
let languageCloseTimer = null;
let userCloseTimer = null;
let toastId = 0;

function openLanguageMenu() {
  clearTimeout(languageCloseTimer);
  clearTimeout(userCloseTimer);
  state.userMenuOpen = false;
  state.languageMenuOpen = true;
}

function closeLanguageMenu(delay = 260) {
  clearTimeout(languageCloseTimer);
  languageCloseTimer = setTimeout(() => {
    state.languageMenuOpen = false;
  }, delay);
}

function openUserMenu() {
  clearTimeout(userCloseTimer);
  clearTimeout(languageCloseTimer);
  state.languageMenuOpen = false;
  state.userMenuOpen = true;
}

function closeUserMenu(delay = 260) {
  clearTimeout(userCloseTimer);
  userCloseTimer = setTimeout(() => {
    state.userMenuOpen = false;
  }, delay);
}

function startProgress() {
  clearTimeout(progressTimer);
  state.progress = 'active';
}

function finishProgress() {
  clearTimeout(progressTimer);
  state.progress = 'finishing';
  progressTimer = setTimeout(() => {
    state.progress = 'idle';
  }, 220);
}

async function withProgress(task) {
  startProgress();
  try {
    return await task();
  } finally {
    finishProgress();
  }
}

function toast(message, type = 'success') {
  const item = { id: ++toastId, message: message || '操作完成', type, visible: false };
  state.toasts.push(item);
  setTimeout(() => { item.visible = true; }, 20);
  setTimeout(() => {
    item.visible = false;
    setTimeout(() => {
      const index = state.toasts.findIndex((toastItem) => toastItem.id === item.id);
      if (index >= 0) state.toasts.splice(index, 1);
    }, 180);
  }, 2600);
}

async function boot(force = false) {
  if (bootPromise && !force) return bootPromise;

  bootPromise = (async () => {
    state.guest = await api.get('/guest/comm/config', {}, { auth: false }).catch(() => ({}));

    if (!isAuthenticated()) {
      state.user = null;
      state.subscribe = null;
      state.comm = {};
      state.stat = [0, 0, 0];
      state.booted = true;
      return;
    }

    try {
      const [user, subscribe, stat, comm] = await Promise.all([
        api.get('/user/info'),
        api.get('/user/getSubscribe'),
        api.get('/user/getStat'),
        api.get('/user/comm/config'),
      ]);
      state.user = user;
      state.subscribe = subscribe;
      state.stat = Array.isArray(stat) ? stat : [0, 0, 0];
      state.comm = comm || {};
    } catch (error) {
      clearToken();
      state.user = null;
      state.subscribe = null;
      state.comm = {};
      state.stat = [0, 0, 0];
      throw error;
    } finally {
      state.booted = true;
    }
  })();

  return bootPromise;
}

async function refreshUser() {
  const [user, subscribe, stat] = await Promise.all([
    api.get('/user/info'),
    api.get('/user/getSubscribe'),
    api.get('/user/getStat').catch(() => state.stat),
  ]);
  state.user = user;
  state.subscribe = subscribe;
  state.stat = Array.isArray(stat) ? stat : state.stat;
}

function resetBoot() {
  bootPromise = null;
  state.booted = false;
  state.ready = false;
}

function emptyBlock(text = '暂无数据') {
  return h('div', { class: 'empty' }, text);
}

function badge(text, type = 'ok') {
  return h('span', { class: ['badge', type] }, text);
}

function miniButton(text, attrs = {}) {
  return h(attrs.href ? 'a' : 'button', {
    class: ['mini-button', attrs.class],
    href: attrs.href,
    type: attrs.href ? undefined : (attrs.type || 'button'),
    onClick: attrs.onClick,
  }, text);
}

function statCards(cards) {
  return h('div', { class: 'metric-grid' }, cards.map((card) => h('article', { class: 'metric-card' }, [
    h('span', card.label),
    h('strong', String(card.value ?? '')),
    card.hint ? h('small', card.hint) : null,
  ])));
}

const DataTable = {
  name: 'DataTable',
  props: {
    headers: { type: Array, required: true },
    rows: { type: Array, default: () => [] },
    empty: { type: String, default: '暂无数据' },
  },
  setup(props) {
    return () => h('div', { class: 'table-wrap' }, [
      h('table', [
        h('thead', [h('tr', props.headers.map((item) => h('th', item)))]),
        h('tbody', props.rows.length
          ? props.rows.map((row) => h('tr', row.map((cell) => h('td', Array.isArray(cell) ? cell : [cell]))))
          : [h('tr', [h('td', { colspan: props.headers.length }, [emptyBlock(props.empty)])])]),
      ]),
    ]);
  },
};

function pageError(error) {
  return error ? h('div', { class: 'error-box' }, error) : null;
}

function useAsyncPage(loader) {
  const local = reactive({ ready: false, error: '' });
  onMounted(async () => {
    await withProgress(async () => {
      try {
        await loader(local);
      } catch (error) {
        local.error = error.message || '页面加载失败';
      } finally {
        local.ready = true;
      }
    });
  });
  return local;
}

function handlePaymentResult(result, kind, tradeNo, local) {
  local.paymentHtml = '';
  local.paymentMessage = '';

  if (result?.type === 1 && typeof result.data === 'string') {
    window.location.href = result.data;
    return;
  }

  if (result?.type === -1 || result?.data === true) {
    local.paymentMessage = '支付已完成，正在刷新状态...';
    startPaymentPoll(kind, tradeNo);
    return;
  }

  if (typeof result?.data === 'string') {
    local.paymentHtml = result.data;
    startPaymentPoll(kind, tradeNo);
    return;
  }

  local.paymentMessage = JSON.stringify(result, null, 2);
  startPaymentPoll(kind, tradeNo);
}

function startPaymentPoll(kind, tradeNo) {
  let times = 0;
  const endpoint = kind === 'recharge' ? '/user/recharge/check' : '/user/order/check';
  const timer = setInterval(async () => {
    times += 1;
    try {
      const status = await api.get(endpoint, { trade_no: tradeNo });
      if (Number(status) === 3) {
        clearInterval(timer);
        toast('支付成功');
        await refreshUser().catch(() => null);
        state.route = parseRoute();
      }
      if (times >= 60) clearInterval(timer);
    } catch (_) {
      if (times >= 10) clearInterval(timer);
    }
  }, 3000);
}

function periodOptions(plan) {
  return periods
    .filter(([key]) => plan[key] !== null && plan[key] !== undefined)
    .map(([key, label]) => ({ key, label: `${label} ${money(plan[key], currencySymbol())}` }));
}

function paymentMethods(methods = [], selected = '') {
  if (!methods.length) return emptyBlock('暂无可用支付方式');
  const defaultValue = selected || methods[0]?.id;
  return h('div', { class: 'payment-methods' }, methods.map((method, index) => h('label', { class: 'payment-method' }, [
    h('input', {
      type: 'radio',
      name: 'method',
      value: method.id,
      checked: String(defaultValue) === String(method.id) || (!selected && index === 0),
    }),
    method.icon
      ? h('img', { src: method.icon, alt: '' })
      : h('span', { class: 'pay-icon' }, '¥'),
    h('span', method.name || method.payment || `支付方式 ${method.id}`),
  ])));
}

const ToastStack = {
  setup() {
    return () => h('div', { class: 'toast-stack' }, state.toasts.map((item) => h('div', {
      key: item.id,
      class: ['toast', `toast-${item.type}`, item.visible ? 'is-visible' : ''],
    }, item.message)));
  },
};

const RouteProgress = {
  setup() {
    return () => h('div', {
      class: ['route-progress', state.progress === 'active' ? 'is-active' : '', state.progress === 'finishing' ? 'is-finishing' : ''],
      'aria-hidden': 'true',
    }, [h('span')]);
  },
};

const AppShell = {
  setup(_, { slots }) {
    function toggleSidebar() {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    }

    function toggleMobileMenu() {
      state.sidebarOpen = !state.sidebarOpen;
    }

    function logout() {
      clearToken();
      resetBoot();
      state.userMenuOpen = false;
      go('login');
    }

    return () => {
      const active = state.route.name;
      const user = state.user || {};
      const title = currentTitle(active);
      const language = activeLanguage();
      return h('div', { class: 'app-shell' }, [
        h('aside', { class: 'sidebar' }, [
          h('a', { class: 'brand brand-with-logo', href: '#/dashboard', 'aria-label': appName() }, [
            h('img', { class: 'brand-logo', src: siteLogoUrl(), alt: '' }),
            h('span', [h('b', appName())]),
          ]),
          h('nav', { class: 'nav' }, navGroups().map((group) => h('div', { class: 'nav-group', key: group.name || 'main' }, [
            group.name ? h('span', group.name) : null,
            ...group.items.map((item) => h('a', {
              class: ['nav-item', active === item.key ? 'active' : ''],
              href: `#/${item.key}`,
              key: item.key,
            }, [
              h('span', {
                class: 'nav-icon-image',
                style: { '--icon-url': `url("${appAsset(`icons/${item.icon}`)}")` },
                'aria-hidden': 'true',
              }),
              h('span', { class: 'nav-label' }, item.label),
              item.key === 'tickets' && Number(state.stat?.[0] || 0) > 0 ? h('em', String(state.stat[0])) : null,
            ])),
          ]))),
        ]),
        h('main', { class: 'workspace' }, [
          h('header', { class: 'topbar' }, [
            h('button', { class: 'icon-button mobile-menu', type: 'button', onClick: toggleMobileMenu }, '☰'),
            h('div', { class: 'breadcrumb' }, [
              h('button', {
                class: 'sidebar-toggle-button',
                type: 'button',
                'aria-label': '展开或收起菜单',
                onClick: toggleSidebar,
              }, [
                h('span', {
                  class: 'collapse-icon collapse-icon-collapse',
                  style: { '--icon-url': `url("${appAsset('icons/Collapse.webp')}")` },
                  'aria-hidden': 'true',
                }),
                h('span', {
                  class: 'collapse-icon collapse-icon-expand',
                  style: { '--icon-url': `url("${appAsset('icons/Expand.webp')}")` },
                  'aria-hidden': 'true',
                }),
              ]),
              h('strong', title),
            ]),
            h('div', { class: 'top-actions' }, [
              h('button', {
                class: 'theme-toggle',
                type: 'button',
                'aria-label': state.theme === 'light' ? '切换到暗黑模式' : '切换到白天模式',
                title: state.theme === 'light' ? '切换到暗黑模式' : '切换到白天模式',
                onClick: () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; },
              }, h('img', {
                class: 'theme-toggle-icon',
                src: appAsset(state.theme === 'light' ? 'icons/theme-dark.webp' : 'icons/theme-white.webp'),
                alt: '',
                'aria-hidden': 'true',
              })),
              h('div', {
                class: ['language-menu', state.languageMenuOpen ? 'is-open' : ''],
                onMouseenter: openLanguageMenu,
                onMouseleave: () => closeLanguageMenu(),
              }, [
                h('button', {
                  class: 'language-trigger',
                  type: 'button',
                  'aria-haspopup': 'menu',
                  'aria-expanded': state.languageMenuOpen ? 'true' : 'false',
                  title: '选择语言',
                  onClick: (event) => {
                    event.stopPropagation();
                    if (state.languageMenuOpen) {
                      closeLanguageMenu(0);
                    } else {
                      openLanguageMenu();
                    }
                  },
                }, h('img', {
                  class: 'language-trigger-icon',
                  src: appAsset('icons/language.webp'),
                  alt: '',
                  'aria-hidden': 'true',
                })),
                h('div', { class: 'language-dropdown', role: 'menu' }, languageOptions.map((item) => h('button', {
                  key: item.code,
                  class: item.code === language.code ? 'is-active' : '',
                  type: 'button',
                  role: 'menuitem',
                  onClick: (event) => {
                    event.stopPropagation();
                    selectLanguage(item.code);
                  },
                }, [
                  h('img', { src: appAsset(`flags/${item.flag}`), alt: '' }),
                  h('span', { dir: item.rtl ? 'rtl' : null }, item.label),
                  item.code === language.code ? h('b', '✓') : null,
                ]))),
              ]),
              h('div', {
                class: ['user-menu', state.userMenuOpen ? 'is-open' : ''],
                onMouseenter: openUserMenu,
                onMouseleave: () => closeUserMenu(),
              }, [
                h('button', {
                  class: 'avatar-chip',
                  type: 'button',
                  'aria-haspopup': 'menu',
                  'aria-expanded': state.userMenuOpen ? 'true' : 'false',
                  onClick: (event) => {
                    event.stopPropagation();
                    if (state.userMenuOpen) {
                      closeUserMenu(0);
                    } else {
                      openUserMenu();
                    }
                  },
                }, [h('img', { class: 'avatar-thumb', src: userAvatarUrl(user), alt: '' })]),
                h('div', { class: 'user-dropdown', role: 'menu' }, [
                  h('div', { class: 'user-dropdown-head' }, [
                    h('strong', userDisplayName(user)),
                    h('span', user.email || '当前账号'),
                  ]),
                  h('a', { href: '#/profile', role: 'menuitem' }, '账号设置'),
                  h('button', { type: 'button', role: 'menuitem', onClick: logout }, '退出登录'),
                ]),
              ]),
            ]),
          ]),
          h('section', { class: 'content' }, slots.default?.()),
        ]),
      ]);
    };
  },
};

const AuthLayout = {
  setup(_, { slots }) {
    return () => h('main', { class: 'auth-page' }, [
      h('section', { class: 'auth-shell' }, [
        h('div', { class: 'auth-visual' }, [
          h('a', { class: 'brand brand-with-logo', href: '#/login', 'aria-label': appName() }, [
            h('img', { class: 'brand-logo', src: siteLogoUrl(), alt: '' }),
            h('span', [h('b', appName())]),
          ]),
          h('section', { class: 'page-hero' }, [
            h('p', [h('i'), '安全登录']),
            h('h1', ['欢迎', h('br'), '回来']),
            h('small', settings.description || state.guest?.app_description || '继续管理你的订阅、节点与余额。'),
          ]),
          h('article', { class: 'glass-card preview-card accent-orange' }, [
            h('div', { class: 'card-title-row' }, [
              h('span', { class: 'service-icon' }, '∞'),
              h('div', [h('small', '当前套餐'), h('h2', 'Pro Stream')]),
            ]),
            h('p', '本周期已用流量'),
            h('strong', '128.4 GB'),
            h('span', { class: 'trend-pill up' }, '↗ +26%'),
            h('svg', { viewBox: '0 0 420 150', 'aria-hidden': 'true' }, [
              h('path', { d: 'M0 136 L55 62 L105 56 L155 58 L198 24 L238 130 L282 88 L326 96 L365 34 L420 74' }),
            ]),
          ]),
        ]),
        h('div', { class: 'auth-card' }, [
          h('div', { class: 'auth-brand' }, [
            h('h1', '登录账户'),
            h('p', '继续管理你的订阅、节点与余额。'),
          ]),
          slots.default?.(),
        ]),
      ]),
    ]);
  },
};

const LoginPage = {
  setup() {
    onMounted(async () => {
      const current = state.route;
      if (!current.query.verify || window.__xboardVerifyHandled) return;
      window.__xboardVerifyHandled = true;
      try {
        const payload = await api.get('/passport/auth/token2Login', { verify: current.query.verify }, { auth: false });
        const data = payload?.data || payload;
        if (!data?.auth_data) throw new Error('登录凭证无效');
        setToken(data.auth_data);
        resetBoot();
        toast('登录成功');
        go(current.query.redirect || 'dashboard');
      } catch (error) {
        toast(error.message || '登录链接已失效', 'error');
      }
    });

    async function submit(event) {
      event.preventDefault();
      const button = event.submitter;
      if (button) button.disabled = true;
      try {
        const data = await api.post('/passport/auth/login', formData(event.currentTarget), { auth: false });
        setToken(data.auth_data);
        resetBoot();
        toast('登录成功');
        go(state.route.query.redirect || 'dashboard');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        if (button) button.disabled = false;
      }
    }

    return () => h('form', { class: 'stack auth-form', onSubmit: submit }, [
      h('label', ['邮箱', h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true })]),
      h('label', ['密码', h('input', { name: 'password', type: 'password', autocomplete: 'current-password', minlength: '8', required: true })]),
      h('button', { class: 'primary-button', type: 'submit' }, '登录'),
      h('div', { class: 'auth-links' }, [
        h('a', { href: '#/register' }, '注册账号'),
        h('a', { href: '#/forgot' }, '忘记密码'),
      ]),
    ]);
  },
};

const RegisterPage = {
  setup() {
    const inviteCode = state.route.query.invite_code || '';
    const showCode = Number(state.guest.is_email_verify) === 1;
    const forceInvite = Number(state.guest.is_invite_force) === 1 || inviteCode;

    async function submit(event) {
      event.preventDefault();
      const button = event.submitter;
      if (button) button.disabled = true;
      try {
        const data = await api.post('/passport/auth/register', formData(event.currentTarget), { auth: false });
        setToken(data.auth_data);
        resetBoot();
        toast('注册成功');
        go('dashboard');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        if (button) button.disabled = false;
      }
    }

    async function sendCode(event) {
      const form = event.currentTarget.closest('form');
      const email = form?.querySelector('[name=email]')?.value;
      if (!email) {
        toast('请先输入邮箱', 'error');
        return;
      }
      event.currentTarget.disabled = true;
      try {
        await api.post('/passport/comm/sendEmailVerify', { email }, { auth: false });
        toast('验证码已发送');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        setTimeout(() => { event.currentTarget.disabled = false; }, 3000);
      }
    }

    return () => h('form', { class: 'stack auth-form', onSubmit: submit }, [
      h('label', ['邮箱', h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true })]),
      h('label', ['密码', h('input', { name: 'password', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })]),
      showCode ? h('label', ['邮箱验证码', h('span', { class: 'inline-field' }, [
        h('input', { name: 'email_code', inputmode: 'numeric', maxlength: '6', required: true }),
        h('button', { class: 'secondary-button', type: 'button', onClick: sendCode }, '发送'),
      ])]) : null,
      forceInvite ? h('label', ['邀请码', h('input', {
        name: 'invite_code',
        value: inviteCode,
        required: Number(state.guest.is_invite_force) === 1,
      })]) : null,
      h('button', { class: 'primary-button', type: 'submit' }, '创建账号'),
      h('div', { class: 'auth-links' }, [h('a', { href: '#/login' }, '已有账号登录')]),
    ]);
  },
};

const ForgotPage = {
  setup() {
    async function submit(event) {
      event.preventDefault();
      const button = event.submitter;
      if (button) button.disabled = true;
      try {
        await api.post('/passport/auth/forget', formData(event.currentTarget), { auth: false });
        toast('密码已重置，请登录');
        go('login');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        if (button) button.disabled = false;
      }
    }

    async function sendCode(event) {
      const form = event.currentTarget.closest('form');
      const email = form?.querySelector('[name=email]')?.value;
      if (!email) {
        toast('请先输入邮箱', 'error');
        return;
      }
      event.currentTarget.disabled = true;
      try {
        await api.post('/passport/comm/sendEmailVerify', { email }, { auth: false });
        toast('验证码已发送');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        setTimeout(() => { event.currentTarget.disabled = false; }, 3000);
      }
    }

    return () => h('form', { class: 'stack auth-form', onSubmit: submit }, [
      h('label', ['邮箱', h('span', { class: 'inline-field' }, [
        h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true }),
        h('button', { class: 'secondary-button', type: 'button', onClick: sendCode }, '发送'),
      ])]),
      h('label', ['邮箱验证码', h('input', { name: 'email_code', inputmode: 'numeric', maxlength: '6', required: true })]),
      h('label', ['新密码', h('input', { name: 'password', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })]),
      h('button', { class: 'primary-button', type: 'submit' }, '重置密码'),
      h('div', { class: 'auth-links' }, [h('a', { href: '#/login' }, '返回登录')]),
    ]);
  },
};

const DashboardPage = {
  setup() {
    const local = useAsyncPage(async (page) => {
      const [notices, servers] = await Promise.all([
        api.get('/user/notice/fetch', { current: 1 }).catch(() => ({ data: [] })),
        api.get('/user/server/fetch').catch(() => ({ data: [] })),
      ]);
      page.notices = normalizeCollection(notices.data || notices).slice(0, 2);
      page.servers = normalizeCollection(servers.data || servers);
    });

    return () => {
      const user = state.user || {};
      const subscribe = state.subscribe || {};
      const usage = usageSummary(subscribe);
      const servers = local.servers || [];
      const onlineCount = servers.filter((node) => node.is_online).length;
      const maintenanceCount = Math.max(servers.length - onlineCount, 0);
      const planName = subscribe.plan?.name || '未订阅套餐';
      const serverRows = servers.slice(0, 5).map((node, index) => [
        `#${index + 1}`,
        [h('i', { class: `node-dot dot-${index % 3}` }), node.name || '-'],
        node.type || '-',
        node.is_online ? (node.last_check_at ? '良好' : '-') : '-',
        node.is_online ? badge('在线', 'ok') : badge('维护', 'danger'),
      ]);
      const notices = local.notices || [];

      return h('div', [
        pageError(local.error),
        h('section', { class: 'dashboard-metrics' }, [
          h('article', { class: 'dashboard-metric' }, [h('div', [h('small', '账户余额'), h('strong', money(user.balance, currencySymbol()))]), h('span', '¥')]),
          h('article', { class: 'dashboard-metric' }, [h('div', [h('small', '当前套餐'), h('strong', subscribe.plan?.name || '未订阅')]), h('span', '∞')]),
          h('article', { class: 'dashboard-metric' }, [h('div', [h('small', '可用节点'), h('strong', `${servers.length ? onlineCount : 0} 在线`)]), h('span', '◆')]),
          h('article', { class: 'dashboard-metric' }, [h('div', [h('small', '本月用量'), h('strong', `${usage.ratio}%`)]), h('span', '↗')]),
        ]),
        h('section', { class: 'dashboard-overview-grid' }, [
          h('article', { class: 'dashboard-card dashboard-subscription-card' }, [
            h('div', { class: 'dashboard-card-head' }, [
              h('div', [h('small', '订阅概览'), h('h2', planName)]),
              h('div', { class: 'dashboard-actions' }, [
                miniButton('购买套餐', { href: '#/plans', class: 'primary-mini' }),
                miniButton('查看订阅', { href: '#/subscribe' }),
              ]),
            ]),
            h('div', { class: 'dashboard-usage-layout' }, [
              h('div', { class: 'dashboard-usage-number' }, [
                h('small', '本周期已用流量'),
                h('strong', bytes(usage.used)),
                h('span', { class: 'trend-pill up' }, `${usage.ratio}% 已使用`),
              ]),
              h('div', { class: 'dashboard-usage-chart' }, [
                h('div', { class: 'progress-label' }, [
                  h('span', '流量进度'),
                  h('strong', `${bytes(usage.used)} / ${usage.total ? bytes(usage.total) : '不限量'}`),
                ]),
                h('div', { class: 'dashboard-progress' }, [h('i', { style: { width: `${usage.ratio}%` } })]),
                h('svg', { viewBox: '0 0 520 120', 'aria-hidden': 'true' }, [
                  h('path', { d: 'M8 104 L74 58 L132 52 L190 54 L240 24 L286 104 L336 76 L390 84 L442 42 L512 70' }),
                  h('circle', { cx: '390', cy: '84', r: '6' }),
                  h('circle', { cx: '442', cy: '42', r: '6' }),
                ]),
              ]),
            ]),
          ]),
          h('article', { class: 'dashboard-card dashboard-node-card' }, [
            h('div', { class: 'dashboard-card-head' }, [
              h('div', [h('small', '节点状态'), h('h2', '全球节点池')]),
              miniButton('全部', { href: '#/nodes' }),
            ]),
            h('div', { class: 'dashboard-node-grid' }, Array.from({ length: 12 }).map((_, index) => {
              const node = servers[index];
              return h('i', { class: !node ? 'off' : (node.is_online ? 'online' : 'warn') });
            })),
            h('div', { class: 'dashboard-node-stat' }, [h('span', '可连接节点'), h('strong', String(servers.length ? onlineCount : 0))]),
            h('div', { class: 'dashboard-node-stat' }, [h('span', '维护中'), h('strong', { class: 'danger-text' }, String(maintenanceCount))]),
          ]),
        ]),
        h('section', { class: 'dashboard-quick-row' }, [
          h('a', { class: 'dashboard-action-card', href: '#/subscribe' }, ['我的订阅', h('span', '+')]),
          h('a', { class: 'dashboard-action-card', href: '#/recharge' }, ['充值余额', h('span', '¥')]),
          h('a', { class: 'dashboard-action-card', href: '#/tickets' }, ['工单中心', h('span', '?')]),
          h('a', { class: 'dashboard-action-card', href: '#/knowledge' }, ['使用教程', h('span', 'i')]),
        ]),
        h('section', { class: 'dashboard-lower-grid' }, [
          h('article', { class: 'dashboard-card' }, [
            h('div', { class: 'dashboard-card-head' }, [
              h('div', [h('small', '实时更新'), h('h2', '节点概览')]),
              miniButton('全部', { href: '#/nodes' }),
            ]),
            h(DataTable, { headers: ['序号', '节点名称', '协议', '延迟', '状态'], rows: serverRows, empty: '暂无可用节点' }),
          ]),
          h('article', { class: 'dashboard-card dashboard-notice-card' }, [
            h('div', { class: 'dashboard-card-head' }, [
              h('div', [h('small', '站点通知'), h('h2', '公告')]),
              miniButton('知识库', { href: '#/knowledge' }),
            ]),
            h('div', { class: 'dashboard-notices' }, notices.length ? notices.map((notice) => h('article', { class: 'dashboard-notice-item' }, [
              h('h3', notice.title || '公告'),
              h('div', { innerHTML: safeBody(notice.content || notice.body || '') }),
            ])) : [
              h('article', { class: 'dashboard-notice-item' }, [h('h3', '暂无公告'), h('p', '后续公告会以卡片形式展示，减少大面积空白。')]),
              h('article', { class: 'dashboard-notice-item' }, [h('h3', '快速提示'), h('p', '优先引导用户购买套餐、复制订阅、查看节点。')]),
            ]),
          ]),
        ]),
      ]);
    };
  },
};

const SubscribePage = {
  setup() {
    const local = useAsyncPage(async (page) => {
      const [subscribe, servers] = await Promise.all([
        api.get('/user/getSubscribe'),
        api.get('/user/server/fetch').catch(() => ({ data: [] })),
      ]);
      state.subscribe = subscribe;
      page.subscribe = subscribe;
      page.servers = normalizeCollection(servers.data || servers);
    });

    async function resetSecurity() {
      if (!confirm('重置后旧订阅链接会失效，确定继续吗？')) return;
      try {
        const url = await api.get('/user/resetSecurity');
        state.subscribe.subscribe_url = url;
        local.subscribe.subscribe_url = url;
        toast('订阅已重置');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    async function copySubscribe() {
      await copyText(local.subscribe?.subscribe_url || '');
      toast('已复制');
    }

    return () => {
      const subscribe = local.subscribe || state.subscribe || {};
      const servers = local.servers || [];
      const usage = usageSummary(subscribe);
      const rows = servers.map((node, index) => [
        `#${index + 1}`,
        [h('i', { class: `node-dot dot-${index % 3}` }), node.name || '-'],
        node.type || '-',
        node.rate ?? '-',
        node.is_online ? badge('在线', 'ok') : badge('维护', 'danger'),
      ]);

      return h('div', [
        pageError(local.error),
        h('section', { class: 'subscription-grid' }, [
          h('article', { class: 'panel access-card' }, [
            h('div', { class: 'section-title' }, [
              h('p', '订阅地址'),
              h('h2', subscribe.plan?.name || '未订阅套餐'),
              miniButton('复制', { onClick: copySubscribe }),
            ]),
            h('div', { class: 'url-box' }, subscribe.subscribe_url || '暂无订阅链接'),
            h('div', { class: 'quota-block' }, [
              h('strong', usage.total ? bytes(Math.max(usage.total - usage.used, 0)) : '不限量'),
              h('span', `剩余流量 / 总计 ${usage.total ? bytes(usage.total) : '不限量'}`),
              h('div', { class: 'progress' }, [h('span', { style: { width: `${usage.ratio}%` } })]),
            ]),
            h('div', { class: 'split-actions' }, [
              h('button', { class: 'secondary-button', type: 'button', onClick: resetSecurity }, '重置订阅'),
              h('a', { class: 'primary-button', href: '#/plans' }, '续费套餐'),
            ]),
          ]),
          h('article', { class: 'panel side-card' }, [
            h('h3', '一键导入'),
            ...['Shadowrocket', 'Clash Verge', 'Stash', 'V2rayN'].map((name) => h('button', { class: 'secondary-button', type: 'button', onClick: copySubscribe }, name)),
          ]),
          h('article', { class: 'panel side-card' }, [
            h('h3', '节点状态'),
            h('div', { class: 'node-map' }, Array.from({ length: 12 }).map((_, index) => h('i', { class: index >= servers.length ? 'off' : (servers[index]?.is_online ? '' : 'warn') }))),
          ]),
        ]),
        h('section', { class: 'panel wide-panel' }, [
          h('div', { class: 'section-title' }, [h('p', '实时列表'), h('h2', '可用节点'), miniButton('筛选', { href: '#/nodes' })]),
          h(DataTable, { headers: ['序号', '节点名称', '协议', '倍率', '状态'], rows, empty: '暂无可用节点' }),
        ]),
      ]);
    };
  },
};

const PlansPage = {
  setup() {
    const local = useAsyncPage(async (page) => {
      page.plans = normalizeCollection(await api.get('/user/plan/fetch'));
    });

    async function buyPlan(event, planId) {
      event.preventDefault();
      const button = event.submitter;
      if (button) button.disabled = true;
      try {
        const payload = { ...formData(event.currentTarget), plan_id: planId };
        const tradeNo = await api.post('/user/order/save', payload);
        toast('订单已创建');
        go('orders', { trade_no: tradeNo });
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        if (button) button.disabled = false;
      }
    }

    return () => h('div', [
      pageError(local.error),
      h('div', { class: 'plan-grid' }, (local.plans || []).map((plan, index) => h('form', {
        class: ['plan-card', index === 1 ? 'hot' : ''],
        onSubmit: (event) => buyPlan(event, plan.id),
      }, [
        h('small', index === 1 ? 'Popular' : (index === 0 ? 'Starter' : 'Plan')),
        h('div', { class: 'plan-head' }, [
          h('h2', plan.name),
          h('span', plan.transfer_enable ? bytes(Number(plan.transfer_enable) * 1024 * 1024 * 1024) : '不限流量'),
        ]),
        h('div', { class: 'plan-content', innerHTML: safeBody(plan.content) }),
        h('div', { class: 'plan-meta' }, [
          h('span', `速度 ${plan.speed_limit || '不限'}`),
          h('span', `设备 ${plan.device_limit || '不限'}`),
        ]),
        h('label', ['周期', h('select', { name: 'period' }, periodOptions(plan).map((item) => h('option', { value: item.key }, item.label)))]),
        h('label', ['优惠码', h('input', { name: 'coupon_code', placeholder: '可选' })]),
        h('button', { class: 'primary-button', type: 'submit' }, '选择套餐'),
      ]))),
      local.ready && !(local.plans || []).length ? emptyBlock('暂无可购买套餐') : null,
    ]);
  },
};

const OrdersPage = {
  setup() {
    if (state.route.query.trade_no) return () => h(OrderDetailPage, { tradeNo: state.route.query.trade_no });
    const local = useAsyncPage(async (page) => {
      page.orders = normalizeCollection(await api.get('/user/order/fetch'));
    });

    return () => {
      const rows = (local.orders || []).map((order) => [
        h('a', { href: `#/orders?trade_no=${encodeURIComponent(order.trade_no)}` }, order.trade_no),
        order.plan?.name || '-',
        statusText(order.status, orderStatus),
        money(order.total_amount, currencySymbol()),
        time(order.created_at),
      ]);
      return h('section', { class: 'panel' }, [
        pageError(local.error),
        h(DataTable, { headers: ['订单号', '套餐', '状态', '金额', '创建时间'], rows, empty: '暂无订单' }),
      ]);
    };
  },
};

const OrderDetailPage = {
  props: { tradeNo: { type: String, required: true } },
  setup(props) {
    const local = useAsyncPage(async (page) => {
      page.order = await api.get('/user/order/detail', { trade_no: props.tradeNo });
      page.methods = Number(page.order.status) === 0 && Number(page.order.total_amount) > 0
        ? await api.get('/user/order/getPaymentMethod').catch(() => [])
        : [];
      page.paymentHtml = '';
      page.paymentMessage = '';
    });

    async function checkout(event) {
      const box = event.currentTarget.closest('[data-checkout]');
      const method = box.querySelector('[name=method]:checked')?.value;
      event.currentTarget.disabled = true;
      try {
        const result = await api.post('/user/order/checkout', { trade_no: props.tradeNo, method });
        handlePaymentResult(result, 'order', props.tradeNo, local);
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        event.currentTarget.disabled = false;
      }
    }

    async function cancelOrder() {
      if (!confirm('确定取消该订单吗？')) return;
      try {
        await api.post('/user/order/cancel', { trade_no: props.tradeNo });
        toast('订单已取消');
        go('orders');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    return () => {
      const order = local.order || {};
      return h('section', { class: 'panel detail-panel' }, [
        pageError(local.error),
        h('div', { class: 'panel-heading' }, [
          h('div', [h('h2', `订单 ${order.trade_no || props.tradeNo}`), h('p', `${order.plan?.name || '-'} · ${statusText(order.status, orderStatus)}`)]),
          h('a', { class: 'secondary-button', href: '#/orders' }, '返回列表'),
        ]),
        statCards([
          { label: '订单金额', value: money(order.total_amount, currencySymbol()) },
          { label: '手续费', value: money(order.handling_amount, currencySymbol()) },
          { label: '余额抵扣', value: money(order.balance_amount, currencySymbol()) },
          { label: '创建时间', value: time(order.created_at) },
        ]),
        Number(order.status) === 0 ? h('div', { class: 'checkout-box', 'data-checkout': props.tradeNo }, [
          h('h3', '支付订单'),
          paymentMethods(local.methods || [], order.payment_id),
          h('div', { class: 'split-actions' }, [
            h('button', { class: 'primary-button', type: 'button', onClick: checkout }, '立即支付'),
            h('button', { class: 'secondary-button', type: 'button', onClick: cancelOrder }, '取消订单'),
          ]),
          local.paymentMessage ? h('div', { class: 'success-box' }, local.paymentMessage) : null,
          local.paymentHtml ? h('div', { class: 'payment-frame', innerHTML: local.paymentHtml }) : null,
        ]) : null,
      ]);
    };
  },
};

const RechargePage = {
  setup() {
    if (state.route.query.trade_no) return () => h(RechargeDetailPage, { tradeNo: state.route.query.trade_no });
    const local = useAsyncPage(async (page) => {
      page.records = normalizeCollection(await api.get('/user/recharge/fetch').catch(() => []));
    });

    async function submit(event) {
      event.preventDefault();
      const button = event.submitter;
      if (button) button.disabled = true;
      try {
        const tradeNo = await api.post('/user/recharge/save', formData(event.currentTarget));
        toast('充值单已创建');
        go('recharge', { trade_no: tradeNo });
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        if (button) button.disabled = false;
      }
    }

    return () => {
      const rows = (local.records || []).map((item) => [
        h('a', { href: `#/recharge?trade_no=${encodeURIComponent(item.trade_no)}` }, item.trade_no),
        money(item.amount, currencySymbol()),
        item.status_text || statusText(item.status, orderStatus),
        item.payment?.name || '-',
        time(item.created_at),
      ]);
      return h('div', [
        pageError(local.error),
        h('section', { class: 'billing-layout' }, [
          h('article', { class: 'panel wallet-panel' }, [
            h('div', { class: 'section-title' }, [h('p', 'Wallet'), h('h2', '余额充值')]),
            h('div', { class: 'amount-display' }, money(state.user?.balance, currencySymbol())),
            h('form', { class: 'wallet-form', onSubmit: submit }, [
              h('label', ['充值金额', h('input', { name: 'amount', type: 'number', min: '0.01', step: '0.01', placeholder: '100.00', required: true })]),
              h('button', { class: 'primary-button', type: 'submit' }, '立即充值'),
            ]),
          ]),
          h('article', { class: 'panel wallet-note' }, [
            h('h3', '充值说明'),
            h('p', '充值成功后余额会自动入账，可用于购买套餐、续费或抵扣订单。'),
            h('div', { class: 'info-grid' }, [h('span', '自动入账'), h('span', '订单可追踪'), h('span', '余额可抵扣')]),
          ]),
        ]),
        h('section', { class: 'panel wide-panel' }, [
          h('div', { class: 'section-title' }, [h('p', '交易记录'), h('h2', '充值记录'), miniButton('订单', { href: '#/orders' })]),
          h(DataTable, { headers: ['充值单号', '金额', '状态', '支付方式', '创建时间'], rows, empty: '暂无充值记录' }),
        ]),
      ]);
    };
  },
};

const RechargeDetailPage = {
  props: { tradeNo: { type: String, required: true } },
  setup(props) {
    const local = useAsyncPage(async (page) => {
      page.recharge = await api.get('/user/recharge/detail', { trade_no: props.tradeNo });
      page.methods = Number(page.recharge.status) === 0
        ? await api.get('/user/recharge/getPaymentMethod').catch(() => [])
        : [];
      page.paymentHtml = '';
      page.paymentMessage = '';
    });

    async function checkout(event) {
      const box = event.currentTarget.closest('[data-checkout]');
      const method = box.querySelector('[name=method]:checked')?.value;
      event.currentTarget.disabled = true;
      try {
        const result = await api.post('/user/recharge/checkout', { trade_no: props.tradeNo, method });
        handlePaymentResult(result, 'recharge', props.tradeNo, local);
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        event.currentTarget.disabled = false;
      }
    }

    async function cancelRecharge() {
      if (!confirm('确定取消该充值单吗？')) return;
      try {
        await api.post('/user/recharge/cancel', { trade_no: props.tradeNo });
        toast('充值单已取消');
        go('recharge');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    return () => {
      const recharge = local.recharge || {};
      return h('section', { class: 'panel detail-panel' }, [
        pageError(local.error),
        h('div', { class: 'panel-heading' }, [
          h('div', [h('h2', `充值单 ${recharge.trade_no || props.tradeNo}`), h('p', recharge.status_text || statusText(recharge.status, orderStatus))]),
          h('a', { class: 'secondary-button', href: '#/recharge' }, '返回列表'),
        ]),
        statCards([
          { label: '充值金额', value: money(recharge.amount, currencySymbol()) },
          { label: '手续费', value: money(recharge.handling_amount, currencySymbol()) },
          { label: '支付方式', value: recharge.payment?.name || '-' },
          { label: '创建时间', value: time(recharge.created_at) },
        ]),
        Number(recharge.status) === 0 ? h('div', { class: 'checkout-box', 'data-checkout': props.tradeNo }, [
          h('h3', '支付充值单'),
          paymentMethods(local.methods || [], recharge.payment_id),
          h('div', { class: 'split-actions' }, [
            h('button', { class: 'primary-button', type: 'button', onClick: checkout }, '立即支付'),
            h('button', { class: 'secondary-button', type: 'button', onClick: cancelRecharge }, '取消充值'),
          ]),
          local.paymentMessage ? h('div', { class: 'success-box' }, local.paymentMessage) : null,
          local.paymentHtml ? h('div', { class: 'payment-frame', innerHTML: local.paymentHtml }) : null,
        ]) : null,
      ]);
    };
  },
};

const ProfilePage = {
  setup() {
    const local = useAsyncPage(async (page) => {
      const giftHistory = await api.get('/user/gift-card/history', { per_page: 8 }).catch(() => ({ data: [] }));
      page.gifts = normalizeCollection(giftHistory.data || giftHistory);
      page.avatarPreview = userAvatarUrl();
    });

    async function saveIdentity(event) {
      event.preventDefault();
      const button = event.submitter;
      if (button) button.disabled = true;
      try {
        await api.post('/user/update', { name: event.currentTarget.querySelector('[name="name"]')?.value.trim() || '' });
        await refreshUser();
        toast('资料已保存');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        if (button) button.disabled = false;
      }
    }

    async function uploadAvatar(event) {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        event.currentTarget.value = '';
        toast('头像不能超过 2MB', 'error');
        return;
      }
      const data = new FormData();
      data.append('avatar', file);
      try {
        local.avatarPreview = URL.createObjectURL(file);
        await api.post('/user/avatar', data);
        await refreshUser();
        local.avatarPreview = userAvatarUrl();
        toast('头像已更新');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        event.currentTarget.value = '';
      }
    }

    async function saveProfile(event) {
      event.preventDefault();
      try {
        await api.post('/user/update', {
          remind_expire: event.currentTarget.remind_expire.checked ? 1 : 0,
          remind_traffic: event.currentTarget.remind_traffic.checked ? 1 : 0,
        });
        await refreshUser();
        toast('设置已保存');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    async function transfer(event) {
      event.preventDefault();
      const amount = Number(formData(event.currentTarget).amount || 0);
      try {
        await api.post('/user/transfer', { transfer_amount: Math.round(amount * 100) });
        await refreshUser();
        toast('划转成功');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    async function changePassword(event) {
      event.preventDefault();
      try {
        await api.post('/user/changePassword', formData(event.currentTarget));
        toast('密码已更新');
        event.currentTarget.reset();
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    async function redeemGift(event) {
      event.preventDefault();
      try {
        await api.post('/user/gift-card/redeem', formData(event.currentTarget));
        await refreshUser();
        toast('兑换成功');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    return () => {
      const user = state.user || {};
      const rows = (local.gifts || []).map((item) => [item.code || '-', item.template_name || '-', time(item.created_at)]);
      return h('div', [
        pageError(local.error),
        h('section', { class: 'panel' }, [
          h('div', { class: 'panel-heading' }, [h('div', [h('h2', '账户信息'), h('p', user.email || '')])]),
          h('form', { class: 'profile-editor', onSubmit: saveIdentity }, [
            h('div', { class: 'profile-avatar-block' }, [
              h('img', { class: 'profile-avatar', src: local.avatarPreview || userAvatarUrl(user), alt: '' }),
              h('label', { class: 'avatar-upload-button' }, [
                '上传头像',
                h('input', { name: 'avatar', type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', onChange: uploadAvatar }),
              ]),
              h('small', '支持 JPG、PNG、WebP、GIF，最大 2MB。'),
            ]),
            h('div', { class: 'profile-fields' }, [
              h('label', ['昵称', h('input', { name: 'name', maxlength: '64', value: user.name || '', placeholder: userDisplayName(user) })]),
              h('p', '昵称会显示在侧边栏欢迎语和右上角账户菜单中。'),
              h('button', { class: 'primary-button', type: 'submit' }, '保存资料'),
            ]),
          ]),
          statCards([
            { label: '余额', value: money(user.balance, currencySymbol()) },
            { label: '佣金余额', value: money(user.commission_balance, currencySymbol()) },
            { label: '注册时间', value: date(user.created_at) },
            { label: 'UUID', value: user.uuid || '-' },
          ]),
        ]),
        h('section', { class: 'two-column' }, [
          h('form', { class: 'panel stack', onSubmit: saveProfile }, [
            h('h2', '提醒设置'),
            h('label', { class: 'check-line' }, [h('input', { name: 'remind_expire', type: 'checkbox', checked: Number(user.remind_expire) === 1 }), ' 套餐到期提醒']),
            h('label', { class: 'check-line' }, [h('input', { name: 'remind_traffic', type: 'checkbox', checked: Number(user.remind_traffic) === 1 }), ' 流量耗尽提醒']),
            h('button', { class: 'primary-button', type: 'submit' }, '保存设置'),
          ]),
          h('form', { class: 'panel stack', onSubmit: transfer }, [
            h('h2', '佣金划转'),
            h('label', ['划转金额', h('input', { name: 'amount', type: 'number', min: '0.01', step: '0.01', placeholder: '10.00' })]),
            h('button', { class: 'primary-button', type: 'submit' }, '转入余额'),
          ]),
        ]),
        h('section', { class: 'two-column' }, [
          h('form', { class: 'panel stack', onSubmit: changePassword }, [
            h('h2', '修改密码'),
            h('label', ['旧密码', h('input', { name: 'old_password', type: 'password', autocomplete: 'current-password', required: true })]),
            h('label', ['新密码', h('input', { name: 'new_password', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })]),
            h('button', { class: 'primary-button', type: 'submit' }, '更新密码'),
          ]),
          h('form', { class: 'panel stack', onSubmit: redeemGift }, [
            h('h2', '礼品卡兑换'),
            h('label', ['兑换码', h('input', { name: 'code', placeholder: '输入兑换码' })]),
            h('button', { class: 'primary-button', type: 'submit' }, '立即兑换'),
          ]),
        ]),
        h('section', { class: 'panel' }, [
          h('div', { class: 'panel-heading' }, [h('div', [h('h2', '兑换记录'), h('p', '最近兑换的礼品卡。')])]),
          h(DataTable, { headers: ['兑换码', '名称', '兑换时间'], rows, empty: '暂无兑换记录' }),
        ]),
      ]);
    };
  },
};

const NodesPage = {
  setup() {
    const local = useAsyncPage(async (page) => {
      const servers = await api.get('/user/server/fetch').catch(() => ({ data: [] }));
      page.servers = normalizeCollection(servers.data || servers);
    });

    return () => {
      const rows = (local.servers || []).map((node) => [
        node.name || '-',
        node.type || '-',
        node.is_online ? badge('在线', 'ok') : badge('离线', 'muted'),
        node.rate ?? '-',
        Array.isArray(node.tags) ? node.tags.join(', ') : (node.tags || '-'),
        time(node.last_check_at),
      ]);
      return h('section', { class: 'panel' }, [
        pageError(local.error),
        h(DataTable, { headers: ['节点', '协议', '状态', '倍率', '标签', '检测时间'], rows, empty: '暂无可用节点' }),
      ]);
    };
  },
};

const TrafficPage = {
  setup() {
    const local = useAsyncPage(async (page) => {
      page.logs = normalizeCollection(await api.get('/user/stat/getTrafficLog'));
    });

    return () => {
      const rows = (local.logs || []).map((item) => [
        date(item.record_at),
        bytes(item.u),
        bytes(item.d),
        bytes(Number(item.u || 0) + Number(item.d || 0)),
        item.server_rate ?? '-',
      ]);
      return h('section', { class: 'panel' }, [
        pageError(local.error),
        h(DataTable, { headers: ['日期', '上传', '下载', '总计', '倍率'], rows, empty: '暂无流量记录' }),
      ]);
    };
  },
};

const TicketsPage = {
  setup() {
    if (state.route.query.id) return () => h(TicketDetailPage, { id: state.route.query.id });
    const local = useAsyncPage(async (page) => {
      page.tickets = normalizeCollection(await api.get('/user/ticket/fetch'));
    });

    async function submit(event) {
      event.preventDefault();
      try {
        await api.post('/user/ticket/save', formData(event.currentTarget));
        toast('工单已提交');
        event.currentTarget.reset();
        local.tickets = normalizeCollection(await api.get('/user/ticket/fetch'));
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    return () => {
      const rows = (local.tickets || []).map((ticket) => [
        h('a', { href: `#/tickets?id=${ticket.id}` }, ticket.subject),
        ticketLevel[ticket.level] || '-',
        statusText(ticket.status, ticketStatus),
        time(ticket.updated_at || ticket.created_at),
      ]);
      return h('div', [
        pageError(local.error),
        h('section', { class: 'panel' }, [
          h('form', { class: 'stack', onSubmit: submit }, [
            h('h2', '新建工单'),
            h('label', ['标题', h('input', { name: 'subject', required: true })]),
            h('label', ['等级', h('select', { name: 'level' }, [h('option', { value: '0' }, '低'), h('option', { value: '1' }, '中'), h('option', { value: '2' }, '高')])]),
            h('label', ['内容', h('textarea', { name: 'message', rows: '5', required: true })]),
            h('button', { class: 'primary-button', type: 'submit' }, '提交工单'),
          ]),
        ]),
        h('section', { class: 'panel' }, [
          h(DataTable, { headers: ['标题', '等级', '状态', '更新时间'], rows, empty: '暂无工单' }),
        ]),
      ]);
    };
  },
};

const TicketDetailPage = {
  props: { id: { type: [String, Number], required: true } },
  setup(props) {
    const local = useAsyncPage(async (page) => {
      page.ticket = await api.get('/user/ticket/fetch', { id: props.id });
      page.messages = normalizeCollection(page.ticket.message || []);
    });

    async function reply(event) {
      event.preventDefault();
      try {
        await api.post('/user/ticket/reply', { id: props.id, ...formData(event.currentTarget) });
        toast('回复已发送');
        local.ticket = await api.get('/user/ticket/fetch', { id: props.id });
        local.messages = normalizeCollection(local.ticket.message || []);
        event.currentTarget.reset();
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    async function closeTicket() {
      if (!confirm('确定关闭该工单吗？')) return;
      try {
        await api.post('/user/ticket/close', { id: props.id });
        toast('工单已关闭');
        go('tickets');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    return () => {
      const ticket = local.ticket || {};
      const messages = local.messages || [];
      return h('section', { class: 'panel detail-panel' }, [
        pageError(local.error),
        h('div', { class: 'panel-heading' }, [
          h('div', [h('h2', ticket.subject || '工单详情'), h('p', statusText(ticket.status, ticketStatus))]),
          h('a', { class: 'secondary-button', href: '#/tickets' }, '返回列表'),
        ]),
        h('div', { class: 'message-list' }, messages.length ? messages.map((message) => h('article', { class: ['message-item', message.is_me ? 'is-me' : ''] }, [
          h('div', { innerHTML: safeBody(message.message || '') }),
          h('time', time(message.created_at)),
        ])) : [emptyBlock('暂无回复')]),
        Number(ticket.status) === 0 ? h('form', { class: 'stack', onSubmit: reply }, [
          h('label', ['回复内容', h('textarea', { name: 'message', rows: '4', required: true })]),
          h('div', { class: 'split-actions' }, [
            h('button', { class: 'primary-button', type: 'submit' }, '发送回复'),
            h('button', { class: 'secondary-button', type: 'button', onClick: closeTicket }, '关闭工单'),
          ]),
        ]) : null,
      ]);
    };
  },
};

const InvitePage = {
  setup() {
    const local = useAsyncPage(async (page) => {
      page.invite = await api.get('/user/invite/fetch');
      const details = await api.get('/user/invite/details', { current: 1, page_size: 10 }).catch(() => ({ data: [] }));
      page.details = normalizeCollection(details.data || details);
    });

    async function createInvite() {
      try {
        await api.get('/user/invite/save');
        toast('邀请码已生成');
        local.invite = await api.get('/user/invite/fetch');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    async function copyInvite(code) {
      const url = `${location.origin}/#/register?invite_code=${encodeURIComponent(code)}`;
      await copyText(url);
      toast('已复制');
    }

    return () => {
      const invite = local.invite || {};
      const codes = normalizeCollection(invite.codes || []);
      const codeRows = codes.map((item) => [
        item.code,
        item.pv ?? 0,
        time(item.created_at),
        h('button', { class: 'link-button', type: 'button', onClick: () => copyInvite(item.code) }, '复制链接'),
      ]);
      const detailRows = (local.details || []).map((item) => [
        item.trade_no,
        money(item.order_amount, currencySymbol()),
        money(item.get_amount, currencySymbol()),
        time(item.created_at),
      ]);

      return h('div', [
        pageError(local.error),
        statCards([
          { label: '注册用户', value: invite.stat?.[0] ?? 0 },
          { label: '累计佣金', value: money(invite.stat?.[1], currencySymbol()) },
          { label: '确认中', value: money(invite.stat?.[2], currencySymbol()) },
          { label: '佣金比例', value: `${invite.stat?.[3] ?? 0}%` },
        ]),
        h('section', { class: 'panel' }, [
          h('div', { class: 'panel-heading' }, [
            h('div', [h('h2', '邀请码'), h('p', '生成并分享邀请码。')]),
            h('button', { class: 'primary-button', type: 'button', onClick: createInvite }, '生成邀请码'),
          ]),
          h(DataTable, { headers: ['邀请码', '访问量', '创建时间', '操作'], rows: codeRows, empty: '暂无邀请码' }),
        ]),
        h('section', { class: 'panel' }, [
          h('div', { class: 'panel-heading' }, [h('div', [h('h2', '佣金明细'), h('p', '邀请订单产生的佣金。')])]),
          h(DataTable, { headers: ['订单号', '订单金额', '获得佣金', '时间'], rows: detailRows, empty: '暂无佣金明细' }),
        ]),
      ]);
    };
  },
};

const KnowledgePage = {
  setup() {
    const local = useAsyncPage(async (page) => {
      if (state.route.query.id) {
        page.article = await api.get('/user/knowledge/fetch', { id: state.route.query.id, language: 'zh-CN' });
        return;
      }
      page.grouped = await api.get('/user/knowledge/fetch', { language: 'zh-CN' }).catch(() => ({}));
    });

    return () => {
      if (state.route.query.id) {
        const article = local.article || {};
        return h('section', { class: 'panel article-panel' }, [
          pageError(local.error),
          h('div', { class: 'panel-heading' }, [
            h('div', [h('h2', article.title || '知识库'), h('p', time(article.updated_at))]),
            h('a', { class: 'secondary-button', href: '#/knowledge' }, '返回列表'),
          ]),
          h('article', { class: 'article-body', innerHTML: safeBody(article.body || '') }),
        ]);
      }

      const entries = Object.entries(local.grouped || {});
      return h('div', [
        pageError(local.error),
        ...entries.map(([category, articles]) => h('section', { class: 'panel' }, [
          h('div', { class: 'panel-heading' }, [h('div', [h('h2', category || '默认分类')])]),
          h('div', { class: 'article-list' }, normalizeCollection(articles).length ? normalizeCollection(articles).map((article) => h('a', { class: 'article-link', href: `#/knowledge?id=${article.id}` }, [
            h('strong', article.title),
            h('span', time(article.updated_at)),
          ])) : [emptyBlock('暂无文章')]),
        ])),
        local.ready && !entries.length ? emptyBlock('暂无知识库文章') : null,
      ]);
    };
  },
};

const routeComponents = {
  login: LoginPage,
  register: RegisterPage,
  forgot: ForgotPage,
  dashboard: DashboardPage,
  subscribe: SubscribePage,
  plans: PlansPage,
  orders: OrdersPage,
  recharge: RechargePage,
  profile: ProfilePage,
  nodes: NodesPage,
  traffic: TrafficPage,
  tickets: TicketsPage,
  invite: InvitePage,
  knowledge: KnowledgePage,
};

const App = {
  setup() {
    async function ensureRoute() {
      const current = state.route;
      const publicRoute = publicRoutes.has(current.name);
      await withProgress(async () => {
        try {
          await boot();
          if (!publicRoute && !getToken()) {
            go('login', { redirect: current.name });
            return;
          }
          if (publicRoute && getToken() && current.name === 'login') {
            go('dashboard');
            return;
          }
          state.ready = true;
        } catch (error) {
          if (!publicRoute) {
            toast(error.message || '登录已过期，请重新登录', 'error');
            go('login', { redirect: current.name });
          } else {
            state.ready = true;
          }
        }
      });
    }

    onMounted(() => {
      window.addEventListener('hashchange', () => {
        state.userMenuOpen = false;
        state.languageMenuOpen = false;
        state.sidebarOpen = false;
        state.route = parseRoute();
      });
      window.addEventListener('xboard:auth-expired', () => go('login'));
      document.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.user-menu')) {
          state.languageMenuOpen = false;
          return;
        }
        if (target?.closest('.language-menu')) {
          state.userMenuOpen = false;
          return;
        }
        state.userMenuOpen = false;
        state.languageMenuOpen = false;
      });
    });

    watch(() => state.route.fullPath, ensureRoute, { immediate: true });
    watch(() => state.theme, applyTheme, { immediate: true });
    watch(() => state.sidebarCollapsed, (value) => {
      document.body.classList.toggle('sidebar-collapsed', value);
    }, { immediate: true });
    watch(() => state.sidebarOpen, (value) => {
      document.body.classList.toggle('sidebar-open', value);
    }, { immediate: true });

    return () => {
      const current = state.route;
      const publicRoute = publicRoutes.has(current.name);
      const Page = routeComponents[current.name] || DashboardPage;
      const pageNode = h(Page, { key: current.fullPath });
      return h('div', { class: 'app-root' }, [
        h(RouteProgress),
        state.ready
          ? (publicRoute
            ? h(AuthLayout, null, { default: () => pageNode })
            : h(AppShell, null, { default: () => pageNode }))
          : null,
        h(ToastStack),
      ]);
    };
  },
};

createApp(App).mount('#app');
