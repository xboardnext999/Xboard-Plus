import { createApp, h, onBeforeUnmount, onMounted, reactive, ref, watch } from './vendor/vue.esm-browser.prod.js';
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
  { key: 'digital', label: '数字商品', group: '', icon: 'order.webp' },
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

function siteLogoClass() {
  return String(settings.logo || '').trim() ? 'brand-logo' : 'brand-logo brand-logo-default';
}

function currentTitle(name) {
  if (name === 'digital-checkout') return '订单结算';
  if (name === 'digital-detail') return '商品详情';
  return navItems.find((item) => item.key === name)?.label || '仪表盘';
}

function activeLanguage() {
  return languageOptions.find((item) => item.code === state.language) || languageOptions[0];
}

const countryCoordinates = {
  AD: [42.5462, 1.6016],
  AE: [23.4241, 53.8478],
  AF: [33.9391, 67.7100],
  AG: [17.0608, -61.7964],
  AL: [41.1533, 20.1683],
  AM: [40.0691, 45.0382],
  AO: [-11.2027, 17.8739],
  AR: [-38.4161, -63.6167],
  AT: [47.5162, 14.5501],
  AU: [-25.2744, 133.7751],
  AZ: [40.1431, 47.5769],
  BA: [43.9159, 17.6791],
  BD: [23.6850, 90.3563],
  BE: [50.5039, 4.4699],
  BG: [42.7339, 25.4858],
  BH: [25.9304, 50.6378],
  BR: [-14.2350, -51.9253],
  BY: [53.7098, 27.9534],
  CA: [56.1304, -106.3468],
  CH: [46.8182, 8.2275],
  CL: [-35.6751, -71.5430],
  CN: [35.8617, 104.1954],
  CO: [4.5709, -74.2973],
  CR: [9.7489, -83.7534],
  CY: [35.1264, 33.4299],
  CZ: [49.8175, 15.4730],
  DE: [51.1657, 10.4515],
  DK: [56.2639, 9.5018],
  DO: [18.7357, -70.1627],
  DZ: [28.0339, 1.6596],
  EC: [-1.8312, -78.1834],
  EE: [58.5953, 25.0136],
  EG: [26.8206, 30.8025],
  ES: [40.4637, -3.7492],
  FI: [61.9241, 25.7482],
  FR: [46.2276, 2.2137],
  GB: [55.3781, -3.4360],
  GE: [42.3154, 43.3569],
  GR: [39.0742, 21.8243],
  HK: [22.3193, 114.1694],
  HR: [45.1000, 15.2000],
  HU: [47.1625, 19.5033],
  ID: [-0.7893, 113.9213],
  IE: [53.1424, -7.6921],
  IL: [31.0461, 34.8516],
  IN: [20.5937, 78.9629],
  IQ: [33.2232, 43.6793],
  IR: [32.4279, 53.6880],
  IS: [64.9631, -19.0208],
  IT: [41.8719, 12.5674],
  JO: [30.5852, 36.2384],
  JP: [36.2048, 138.2529],
  KH: [12.5657, 104.9910],
  KR: [35.9078, 127.7669],
  KW: [29.3117, 47.4818],
  KZ: [48.0196, 66.9237],
  LA: [19.8563, 102.4955],
  LK: [7.8731, 80.7718],
  LT: [55.1694, 23.8813],
  LU: [49.8153, 6.1296],
  LV: [56.8796, 24.6032],
  MA: [31.7917, -7.0926],
  MD: [47.4116, 28.3699],
  MM: [21.9162, 95.9560],
  MN: [46.8625, 103.8467],
  MO: [22.1987, 113.5439],
  MX: [23.6345, -102.5528],
  MY: [4.2105, 101.9758],
  NG: [9.0820, 8.6753],
  NL: [52.1326, 5.2913],
  NO: [60.4720, 8.4689],
  NP: [28.3949, 84.1240],
  NZ: [-40.9006, 174.8860],
  OM: [21.4735, 55.9754],
  PA: [8.5380, -80.7821],
  PE: [-9.1900, -75.0152],
  PH: [12.8797, 121.7740],
  PK: [30.3753, 69.3451],
  PL: [51.9194, 19.1451],
  PT: [39.3999, -8.2245],
  QA: [25.3548, 51.1839],
  RO: [45.9432, 24.9668],
  RS: [44.0165, 21.0059],
  RU: [61.5240, 105.3188],
  SA: [23.8859, 45.0792],
  SE: [60.1282, 18.6435],
  SG: [1.3521, 103.8198],
  SI: [46.1512, 14.9955],
  SK: [48.6690, 19.6990],
  TH: [15.8700, 100.9925],
  TR: [38.9637, 35.2433],
  TW: [23.6978, 120.9605],
  UA: [48.3794, 31.1656],
  US: [37.0902, -95.7129],
  UY: [-32.5228, -55.7658],
  UZ: [41.3775, 64.5853],
  VN: [14.0583, 108.2772],
  ZA: [-30.5595, 22.9375],
};

let flagsPromise = null;
let leafletPromise = null;

function flagAssetPath(file) {
  return `/flags/${String(file || '').replace(/^\/+/, '')}`;
}

function loadCountryFlags() {
  if (!flagsPromise) {
    flagsPromise = fetch('/flags/flags.json', { cache: 'force-cache' })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => (Array.isArray(data) ? data : []))
      .catch(() => []);
  }
  return flagsPromise;
}

function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('[data-leaflet-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = appAsset('vendor/leaflet/leaflet.css');
        link.dataset.leafletCss = 'true';
        document.head.appendChild(link);
      }

      const script = document.createElement('script');
      script.src = appAsset('vendor/leaflet/leaflet.js');
      script.async = true;
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('地图资源加载失败'));
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function parseFlagRemark(flag) {
  if (!flag?.remark) return {};
  try {
    return JSON.parse(flag.remark);
  } catch {
    return {};
  }
}

function flagCode(flag) {
  return String(flag?.value || '').replace(/\.[^.]+$/, '').toUpperCase();
}

function flattenText(value) {
  if (Array.isArray(value)) return value.map(flattenText).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(flattenText).join(' ');
  return String(value ?? '');
}

function comparableText(value) {
  return flattenText(value).toLocaleLowerCase().replace(/[\s_\-./|()[\]{}]+/g, '');
}

function tokenText(value) {
  return ` ${flattenText(value).toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
}

function createFlagIndex(flags = []) {
  return flags.map((flag) => {
    const code = flagCode(flag);
    const remark = parseFlagRemark(flag);
    const names = Object.values(flag.names || {});
    const aliases = new Set([
      flag.name,
      code,
      ...names,
      ...(Array.isArray(remark.name) ? remark.name : []),
    ].filter(Boolean).map((item) => String(item).trim()).filter(Boolean));

    return {
      code,
      flag: flag.value,
      name: flag.names?.['zh-CN'] || flag.name || code,
      aliases: [...aliases].sort((a, b) => b.length - a.length),
    };
  }).filter((item) => item.code && countryCoordinates[item.code]);
}

function resolveNodeRegion(node, flagIndex) {
  const sourceText = [
    node.country_code,
    node.country,
    node.region,
    node.area,
    node.location,
    node.tags,
    node.name,
  ].map(flattenText).join(' ');
  const compactSource = comparableText(sourceText);
  const sourceTokens = tokenText(sourceText);

  for (const flag of flagIndex) {
    if (sourceTokens.includes(` ${flag.code.toLocaleLowerCase()} `)) {
      return flag;
    }
    if (flag.aliases.some((alias) => {
      const compactAlias = comparableText(alias);
      if (!compactAlias || compactAlias.length < 2) return false;
      if (/^[a-z]{2}$/i.test(alias)) return sourceTokens.includes(` ${alias.toLocaleLowerCase()} `);
      return compactSource.includes(compactAlias);
    })) {
      return flag;
    }
  }

  return {
    code: '',
    flag: '',
    name: String(node.name || '未知地区').trim() || '未知地区',
    aliases: [],
  };
}

function nodeIsOnline(node) {
  return node?.is_online === true || node?.is_online === 1 || node?.is_online === '1';
}

function buildNodeRegionStats(servers = [], flags = []) {
  const flagIndex = createFlagIndex(flags);
  const regions = new Map();

  servers.forEach((node) => {
    const region = resolveNodeRegion(node, flagIndex);
    const key = region.code || region.name;
    if (!regions.has(key)) {
      regions.set(key, {
        code: region.code,
        flag: region.flag,
        name: region.name,
        coords: countryCoordinates[region.code] || null,
        total: 0,
        online: 0,
        offline: 0,
      });
    }
    const item = regions.get(key);
    item.total += 1;
    if (nodeIsOnline(node)) item.online += 1;
    else item.offline += 1;
  });

  return [...regions.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh-Hans-CN'));
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

function markdownBody(source = '') {
  const escaped = String(source).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[-*] (.*)$/gm, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function planDescriptionBody(source = '') {
  const content = String(source || '').trim();
  if (!content) return '<p>稳定、安全的网络订阅服务。</p>';
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return safeBody(content);
  return markdownBody(content)
    .replace(/<\/h([1-3])><br>/g, '</h$1>')
    .replace(/(?:<li>[\s\S]*?<\/li>(?:<br>)?)+/g, (list) => `<ul>${list.replace(/<br>/g, '')}</ul>`);
}

const digitalCartStorageKey = 'xboard-digital-cart-v1';
function loadDigitalCart() {
  try { return JSON.parse(localStorage.getItem(digitalCartStorageKey) || '[]'); } catch { return []; }
}
const digitalCart = ref(loadDigitalCart());
function storeDigitalCart() {
  localStorage.setItem(digitalCartStorageKey, JSON.stringify(digitalCart.value));
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

function closeLanguageMenu(delay = 520) {
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

function closeUserMenu(delay = 520) {
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
    disabled: attrs.href ? undefined : attrs.disabled,
    title: attrs.title,
    'aria-disabled': attrs.disabled ? 'true' : undefined,
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

function dashboardMetricIcon(icon, tone) {
  return h('span', { class: ['dashboard-metric-icon', tone ? `dashboard-metric-icon-${tone}` : ''] }, h('img', {
    src: appAsset(`icons/${icon}`),
    alt: '',
    'aria-hidden': 'true',
  }));
}

function dashboardMetricBody(label, value, note) {
  return h('div', { class: 'dashboard-metric-copy' }, [
    h('small', label),
    h('strong', value),
    note ? h('p', { class: 'dashboard-metric-note' }, Array.isArray(note) ? note : [note]) : null,
  ]);
}

function dashboardQuickCard({ href, icon, tone, title, description }) {
  return h('a', { class: ['dashboard-action-card', `dashboard-action-card-${tone}`], href }, [
    h('span', { class: 'dashboard-action-icon' }, h('span', {
      class: 'dashboard-action-symbol',
      style: { '--action-icon-url': `url("${appAsset(`icons/${icon}`)}")` },
      'aria-hidden': 'true',
    })),
    h('span', { class: 'dashboard-action-copy' }, [
      h('strong', title),
      h('small', description),
    ]),
    h('span', { class: 'dashboard-action-chevron', 'aria-hidden': 'true' }, '›'),
  ]);
}

function dashboardTrafficChart(usage) {
  const ratio = Math.max(0, Math.min(Number(usage.ratio) || 0, 100));
  const points = ratio > 0
    ? '8,78 64,67 120,56 176,48 232,52 288,38 344,45 400,27 456,16'
    : '8,78 64,72 120,74 176,65 232,68 288,58 344,61 400,50 456,54';
  return h('div', { class: 'dashboard-traffic-visual' }, [
    h('div', { class: 'dashboard-traffic-ring', style: { '--usage-ratio': `${ratio * 3.6}deg` } }, [
      h('div', [h('strong', `${ratio}%`), h('span', '已使用')]),
    ]),
    h('div', { class: 'dashboard-traffic-chart-area' }, [
      h('div', { class: 'dashboard-traffic-total' }, [
        h('strong', bytes(usage.used)),
        h('span', `/ ${usage.total ? bytes(usage.total) : '不限量'}`),
      ]),
      h('div', { class: 'dashboard-traffic-progress' }, [h('i', { style: { width: `${ratio}%` } })]),
      h('svg', { class: 'dashboard-traffic-sparkline', viewBox: '0 0 464 92', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, [
        h('defs', [h('linearGradient', { id: 'dashboardTrafficFill', x1: '0', y1: '0', x2: '0', y2: '1' }, [
          h('stop', { offset: '0%', 'stop-color': '#027bfe', 'stop-opacity': '.20' }),
          h('stop', { offset: '100%', 'stop-color': '#027bfe', 'stop-opacity': '0' }),
        ])]),
        h('path', { class: 'dashboard-traffic-area', d: `M ${points.replaceAll(' ', ' L ')} L 456,92 L 8,92 Z` }),
        h('polyline', { points }),
        h('circle', { cx: '456', cy: ratio > 0 ? '16' : '54', r: '4' }),
      ]),
    ]),
  ]);
}

const DashboardNodeMap = {
  name: 'DashboardNodeMap',
  props: {
    regions: { type: Array, default: () => [] },
  },
  setup(props) {
    const mapEl = ref(null);
    const local = reactive({ error: '' });
    let map = null;
    let markers = [];

    function clearMarkers() {
      markers.forEach((marker) => marker.remove());
      markers = [];
    }

    function markerHtml(region) {
      const status = region.online > 0 ? 'online' : 'offline';
      const flag = region.flag
        ? `<span class="dashboard-map-label-flag"><img src="${escapeHtml(flagAssetPath(region.flag))}" alt=""></span>`
        : '<span class="dashboard-map-label-flag">?</span>';
      const detail = region.offline > 0
        ? `${region.online} 在线 / ${region.offline} 离线`
        : `${region.online} 在线`;
      return `
        <span class="dashboard-map-marker dashboard-map-marker-${status}"><i></i></span>
        <span class="dashboard-map-label">
          <span class="dashboard-map-label-title">${flag}<b>${escapeHtml(region.name)}</b></span>
          <em>${escapeHtml(detail)}</em>
        </span>
      `;
    }

    function renderMarkers() {
      if (!map || !window.L) return;
      clearMarkers();
      const points = props.regions.filter((region) => Array.isArray(region.coords));

      points.forEach((region) => {
        const icon = window.L.divIcon({
          className: 'dashboard-map-marker-wrap',
          html: markerHtml(region),
          iconSize: [132, 46],
          iconAnchor: [16, 38],
        });
        markers.push(window.L.marker(region.coords, { icon }).addTo(map));
      });

      if (points.length > 1) {
        const bounds = window.L.latLngBounds(points.map((region) => region.coords));
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 3 });
      } else if (points.length === 1) {
        map.setView(points[0].coords, 3);
      } else {
        map.setView([22, 12], 1.35);
      }
      setTimeout(() => map?.invalidateSize(), 80);
    }

    onMounted(async () => {
      try {
        const L = await ensureLeaflet();
        if (!mapEl.value) return;
        map = L.map(mapEl.value, {
          attributionControl: false,
          doubleClickZoom: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
          scrollWheelZoom: false,
          preferCanvas: true,
          worldCopyJump: false,
          zoomControl: true,
          minZoom: 1,
          maxZoom: 5,
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
          crossOrigin: true,
          detectRetina: false,
          keepBuffer: 5,
          subdomains: 'abcd',
          updateInterval: 250,
          updateWhenIdle: true,
          updateWhenZooming: false,
          maxZoom: 5,
        }).addTo(map);
        renderMarkers();
      } catch (error) {
        local.error = error.message || '地图加载失败';
      }
    });

    watch(() => props.regions, renderMarkers, { deep: true });

    onBeforeUnmount(() => {
      clearMarkers();
      if (map) map.remove();
    });

    return () => h('div', { class: 'dashboard-leaflet-shell' }, [
      h('div', { ref: mapEl, class: 'dashboard-leaflet-map' }),
      !props.regions.length ? h('div', { class: 'dashboard-map-empty' }, '暂无节点地区数据') : null,
      local.error ? h('div', { class: 'dashboard-map-empty' }, local.error) : null,
    ]);
  },
};

function dashboardNodeStatusCard(totalCount, onlineCount, offlineCount, regions) {
  return h('article', { class: 'dashboard-card dashboard-node-card' }, [
    h('div', { class: 'dashboard-node-card-head' }, [
      h('div', [
        h('h2', '全球节点池'),
        h('p', `共 ${onlineCount} 个可用节点 · ${regions.length} 个地区`),
      ]),
      h('a', { class: 'dashboard-node-arrow', href: '#/nodes', 'aria-label': '查看节点状态' }, '›'),
    ]),
    h(DashboardNodeMap, { regions }),
    h('div', { class: 'dashboard-node-summary-row' }, [
      h('div', { class: 'dashboard-node-summary-card' }, [
        h('div', { class: 'dashboard-node-summary-copy' }, [
          h('small', '可连接节点'),
          h('span', [h('strong', String(onlineCount)), h('em', '在线可用')]),
        ]),
      ]),
      h('div', { class: 'dashboard-node-summary-card danger' }, [
        h('div', { class: 'dashboard-node-summary-copy' }, [
          h('small', '离线节点'),
          h('span', [h('strong', String(offlineCount)), h('em', '暂时不可用')]),
        ]),
      ]),
    ]),
  ]);
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

function quoteLine(label, value, type = '') {
  return h('span', { class: ['quote-line', type] }, [
    h('em', label),
    h('strong', value),
  ]);
}

const ToastStack = {
  setup() {
    return () => h('div', { class: 'toast-stack' }, state.toasts.map((item) => h('div', {
      key: item.id,
      class: ['toast', `toast-${item.type}`, item.visible ? 'is-visible' : ''],
    }, [
      h('span', { class: 'toast-icon', 'aria-hidden': 'true' }, item.type === 'error' ? '!' : '✓'),
      h('span', { class: 'toast-message' }, item.message),
    ])));
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
            h('img', { class: siteLogoClass(), src: siteLogoUrl(), alt: '' }),
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
                class: 'top-action-button notification-button',
                type: 'button',
                'aria-label': '消息通知',
                title: '消息通知',
              }, h('img', {
                class: 'top-action-icon notification-icon',
                src: appAsset('icons/Message_notification.webp'),
                alt: '',
                'aria-hidden': 'true',
              })),
              h('button', {
                class: 'top-action-button theme-toggle',
                type: 'button',
                'aria-label': state.theme === 'light' ? '切换到暗黑模式' : '切换到白天模式',
                title: state.theme === 'light' ? '切换到暗黑模式' : '切换到白天模式',
                onClick: () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; },
              }, h('img', {
                class: 'top-action-icon theme-toggle-icon',
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
            h('img', { class: siteLogoClass(), src: siteLogoUrl(), alt: '' }),
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
      const [notices, servers, flags] = await Promise.all([
        api.get('/user/notice/fetch', { current: 1 }).catch(() => ({ data: [] })),
        api.get('/user/server/fetch').catch(() => ({ data: [] })),
        loadCountryFlags(),
      ]);
      page.notices = normalizeCollection(notices.data || notices).slice(0, 2);
      page.servers = normalizeCollection(servers.data || servers);
      page.flags = flags;
    });

    return () => {
      const user = state.user || {};
      const subscribe = state.subscribe || {};
      const usage = usageSummary(subscribe);
      const servers = local.servers || [];
      const onlineCount = servers.filter(nodeIsOnline).length;
      const offlineCount = Math.max(servers.length - onlineCount, 0);
      const nodeRegions = buildNodeRegionStats(servers, local.flags || []);
      const planName = subscribe.plan?.name || '未订阅套餐';
      const planStatusOk = Boolean(subscribe.plan?.name);
      const planStatusText = planStatusOk ? '正常' : '未订阅';
      const usageLimitText = usage.total ? bytes(usage.total) : '不限量';
      const serverRows = servers.slice(0, 5).map((node, index) => [
        `#${index + 1}`,
        [h('i', { class: `node-dot dot-${index % 3}` }), node.name || '-'],
        node.type || '-',
        nodeIsOnline(node) ? (node.last_check_at ? '良好' : '-') : '-',
        nodeIsOnline(node) ? badge('在线', 'ok') : badge('离线', 'danger'),
      ]);
      const notices = local.notices || [];
      const currentHour = new Date().getHours();
      const greeting = currentHour < 6 ? '夜深了' : currentHour < 12 ? '早上好' : currentHour < 18 ? '下午好' : '晚上好';
      const displayName = user.name || user.email?.split('@')[0] || '欢迎回来';

      return h('div', [
        pageError(local.error),
        h('section', { class: 'dashboard-welcome' }, [
          h('div', [h('h1', `${greeting}，${displayName} 👋`), h('p', '欢迎回来，今天一切运行良好！')]),
          h('div', { class: 'dashboard-welcome-status' }, [h('i'), h('span', '服务运行正常')]),
        ]),
        h('section', { class: 'dashboard-metrics' }, [
          h('article', { class: 'dashboard-metric' }, [dashboardMetricBody('账户余额', money(user.balance, currencySymbol()), '可用余额'), dashboardMetricIcon('Dollar.webp', 'balance')]),
          h('article', { class: 'dashboard-metric' }, [
            dashboardMetricBody('当前套餐', subscribe.plan?.name || '未订阅', ['套餐状态：', h('span', { class: planStatusOk ? 'dashboard-metric-note-ok' : 'dashboard-metric-note-muted' }, planStatusText)]),
            dashboardMetricIcon('member.webp', 'plan'),
          ]),
          h('article', { class: 'dashboard-metric' }, [dashboardMetricBody('可用节点', `${servers.length ? onlineCount : 0} 在线`, '全球节点加速'), dashboardMetricIcon('node1.webp', 'nodes')]),
          h('article', { class: 'dashboard-metric' }, [dashboardMetricBody('本月用量', `${usage.ratio}%`, `已使用 ${bytes(usage.used)} / ${usageLimitText}`), dashboardMetricIcon('flow.webp', 'usage')]),
        ]),
        h('section', { class: 'dashboard-overview-grid' }, [
          h('article', { class: 'dashboard-card dashboard-subscription-card' }, [
            h('div', { class: 'dashboard-card-head' }, [
              h('div', [h('small', '订阅概览'), h('h2', planName), h('p', { class: 'dashboard-card-subtitle' }, '流量使用进度')]),
              h('div', { class: 'dashboard-actions' }, [
                miniButton('购买套餐', { href: '#/plans', class: 'primary-mini' }),
                miniButton('查看订阅', { href: '#/subscribe' }),
              ]),
            ]),
            dashboardTrafficChart(usage),
          ]),
          dashboardNodeStatusCard(servers.length, servers.length ? onlineCount : 0, offlineCount, nodeRegions),
        ]),
        h('section', { class: 'dashboard-quick-row' }, [
          dashboardQuickCard({ href: '#/subscribe', icon: 'subscription1.webp', tone: 'subscribe', title: '我的订阅', description: '查看订阅、冻结与套餐转让' }),
          dashboardQuickCard({ href: '#/recharge', icon: 'wallet1.webp', tone: 'recharge', title: '充值余额', description: '快速充值，便捷支付' }),
          dashboardQuickCard({ href: '#/tickets', icon: 'tickets1.webp', tone: 'ticket', title: '工单中心', description: '提交工单，快速响应' }),
          dashboardQuickCard({ href: '#/knowledge', icon: 'knowledge1.webp', tone: 'knowledge', title: '使用教程', description: '新手指南，快速上手' }),
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
      const [subscribe, servers, subscriptionData] = await Promise.all([
        api.get('/user/getSubscribe'),
        api.get('/user/server/fetch').catch(() => ({ data: [] })),
        api.get('/user/subscription/fetch').catch(() => ({ data: [], summary: {} })),
      ]);
      state.subscribe = subscribe;
      page.subscribe = subscribe;
      page.servers = normalizeCollection(servers.data || servers);
      page.subscriptions = normalizeCollection(subscriptionData.data || subscriptionData);
      page.subscriptionSummary = subscriptionData.summary || {};
      page.subscriptionTransfer = subscriptionData.transfer || { enabled: false, fee: 0, history: [] };
    });
    const transferTarget = ref(null);
    const transferEmail = ref('');
    const transferSubmitting = ref(false);

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

    async function refreshSubscriptions() {
      const [subscribe, subscriptionData] = await Promise.all([
        api.get('/user/getSubscribe'),
        api.get('/user/subscription/fetch').catch(() => ({ data: [], summary: {} })),
      ]);
      state.subscribe = subscribe;
      local.subscribe = subscribe;
      local.subscriptions = normalizeCollection(subscriptionData.data || subscriptionData);
      local.subscriptionSummary = subscriptionData.summary || {};
      local.subscriptionTransfer = subscriptionData.transfer || { enabled: false, fee: 0, history: [] };
    }

    async function freezeSubscription(subscription) {
      const days = Number(prompt('请输入冻结天数', '7') || 0);
      if (!days) return;
      try {
        await api.post('/user/subscription/freeze', { id: subscription.id, days });
        await refreshSubscriptions();
        toast('订阅已冻结');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    async function unfreezeSubscription(subscription) {
      try {
        await api.post('/user/subscription/unfreeze', { id: subscription.id });
        await refreshSubscriptions();
        toast('订阅已解冻');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    async function setPrimarySubscription(subscription) {
      try {
        await api.post('/user/subscription/primary', { id: subscription.id });
        await refreshSubscriptions();
        toast('已设为主订阅');
      } catch (error) {
        toast(error.message, 'error');
      }
    }

    function openTransfer(subscription) {
      transferTarget.value = subscription;
      transferEmail.value = '';
    }

    function closeTransfer() {
      if (transferSubmitting.value) return;
      transferTarget.value = null;
      transferEmail.value = '';
    }

    async function submitTransfer(event) {
      event.preventDefault();
      const subscription = transferTarget.value;
      const email = transferEmail.value.trim();
      if (!subscription || !email || transferSubmitting.value) return;

      transferSubmitting.value = true;
      try {
        await api.post('/user/subscription/transfer', { id: subscription.id, email });
        await refreshSubscriptions();
        transferTarget.value = null;
        transferEmail.value = '';
        toast('套餐已转让');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        transferSubmitting.value = false;
      }
    }

    return () => {
      const subscribe = local.subscribe || state.subscribe || {};
      const servers = local.servers || [];
      const subscriptions = local.subscriptions || [];
      const transfer = local.subscriptionTransfer || { enabled: false, fee: 0, history: [] };
      const defaultTransferFee = Number(transfer.default_fee ?? transfer.fee ?? 0);
      const selectedTransferFee = transferTarget.value
        ? Number(transferTarget.value.transfer_fee ?? defaultTransferFee)
        : defaultTransferFee;
      const transferHistory = normalizeCollection(transfer.history);
      const transferableSubscription = subscriptions.find((item) => item.can_transfer);
      const hasTransferableSubscription = Boolean(transferableSubscription);
      const transferUnavailableReason = !transfer.enabled
        ? '管理员暂未开启套餐转让'
        : (subscriptions[0]?.transfer_reason || '当前没有符合条件的有效套餐');
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
        h('section', { class: 'subscription-list' }, subscriptions.length ? subscriptions.map((item) => h('article', {
          class: ['subscription-item', item.is_primary ? 'primary-subscription' : '', item.status === 2 ? 'frozen-subscription' : ''],
        }, [
          h('div', { class: 'subscription-item-main' }, [
            h('small', item.is_primary ? '主订阅' : (item.status_text || '订阅')),
            h('h2', item.plan_name || '未知套餐'),
            h('p', [
              item.expired_at ? `到期 ${date(item.expired_at)}` : '长期有效',
              ' · ',
              item.traffic_text || bytes(item.transfer_enable || 0),
            ]),
          ]),
          h('div', { class: 'subscription-item-actions' }, [
            item.status === 1 && !item.is_primary ? miniButton('设为主订阅', { onClick: () => setPrimarySubscription(item) }) : null,
            transfer.enabled && item.can_transfer
              ? miniButton('转让套餐', { onClick: () => openTransfer(item) })
              : miniButton('不可转让', {
                disabled: true,
                title: transfer.enabled ? (item.transfer_reason || '当前套餐不符合转让条件') : '管理员暂未开启套餐转让',
              }),
            item.status === 1 ? miniButton('冻结', { onClick: () => freezeSubscription(item) }) : null,
            item.status === 2 ? miniButton('解冻', { onClick: () => unfreezeSubscription(item) }) : null,
          ]),
        ])) : [
          h('article', { class: 'subscription-item empty-subscription' }, [
            h('div', { class: 'subscription-item-main' }, [h('small', '暂无订阅'), h('h2', '购买套餐后会显示在这里')]),
            miniButton('购买套餐', { href: '#/plans' }),
          ]),
        ]),
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
        h('section', { class: 'panel wide-panel subscription-transfer-history' }, [
          h('div', { class: 'section-title' }, [
            h('p', '套餐流转'),
            h('h2', '套餐转让'),
            h('span', { class: 'transfer-fee-note' }, `默认费用 ${money(defaultTransferFee, currencySymbol())}`),
            miniButton(hasTransferableSubscription ? '立即转让' : '不可转让', {
              disabled: !transfer.enabled || !hasTransferableSubscription,
              title: hasTransferableSubscription ? '转让当前套餐' : transferUnavailableReason,
              onClick: hasTransferableSubscription ? () => openTransfer(transferableSubscription) : undefined,
            }),
          ]),
          h('div', { class: ['subscription-transfer-status', transfer.enabled ? 'is-enabled' : 'is-disabled'] }, [
            h('strong', transfer.enabled
              ? (hasTransferableSubscription ? '转让功能已开启' : '暂无可转让套餐')
              : '管理员暂未开启套餐转让'),
            h('span', transfer.enabled
              ? (hasTransferableSubscription ? '点击“立即转让”或套餐卡片上的入口即可操作。' : transferUnavailableReason)
              : '开启后，符合条件的套餐会在上方显示转让入口。'),
          ]),
          transferHistory.length ? h(DataTable, {
            headers: ['方向', '套餐', '对方账号', '费用', '时间'],
            rows: transferHistory.map((record) => [
              badge(record.direction === 'out' ? '转出' : '转入', record.direction === 'out' ? 'warn' : 'ok'),
              record.plan_name || '-',
              record.counterparty_email || '-',
              record.direction === 'out' ? money(record.fee, currencySymbol()) : '-',
              time(record.transferred_at),
            ]),
            empty: '暂无转让记录',
          }) : h('div', { class: 'subscription-transfer-empty' }, '暂无转让记录'),
        ]),
        transferTarget.value ? h('div', {
          class: 'subscription-transfer-overlay',
          onClick: (event) => {
            if (event.target === event.currentTarget) closeTransfer();
          },
        }, [
          h('form', { class: 'subscription-transfer-dialog', onSubmit: submitTransfer }, [
            h('div', { class: 'subscription-transfer-head' }, [
              h('div', [h('small', '套餐转让'), h('h2', transferTarget.value.plan_name || '当前套餐')]),
              h('button', { class: 'transfer-dialog-close', type: 'button', disabled: transferSubmitting.value, onClick: closeTransfer, 'aria-label': '关闭' }, '×'),
            ]),
            h('label', { class: 'subscription-transfer-field' }, [
              h('span', '接收方邮箱'),
              h('input', {
                type: 'email',
                required: true,
                maxlength: '255',
                autocomplete: 'email',
                placeholder: '请输入已注册用户的邮箱',
                value: transferEmail.value,
                onInput: (event) => { transferEmail.value = event.target.value; },
              }),
            ]),
            h('div', { class: 'subscription-transfer-summary' }, [
              h('span', '本次转让费用'),
              h('strong', money(selectedTransferFee, currencySymbol())),
            ]),
            h('p', { class: 'subscription-transfer-warning' }, '转让成功后套餐将立即归接收方所有，费用从你的余额扣除，此操作不可撤销。'),
            h('div', { class: 'subscription-transfer-actions' }, [
              h('button', { class: 'secondary-button', type: 'button', disabled: transferSubmitting.value, onClick: closeTransfer }, '取消'),
              h('button', { class: 'primary-button', type: 'submit', disabled: transferSubmitting.value || !transferEmail.value.trim() }, transferSubmitting.value ? '转让中…' : '确认转让'),
            ]),
          ]),
        ]) : null,
      ]);
    };
  },
};

const PlanPurchaseCard = {
  props: {
    plan: { type: Object, required: true },
    index: { type: Number, default: 0 },
    methods: { type: Array, default: () => [] },
    methodsError: { type: String, default: '' },
    groupBuy: { type: Object, default: () => ({ activities: [], groups: [] }) },
  },
  setup(props) {
    const options = periodOptions(props.plan);
    const selectedPeriod = ref(options[0]?.key || '');
    const couponCode = ref('');
    const selectedMethod = ref(props.methods[0]?.id ? String(props.methods[0].id) : '');
    const selectedGroupActivity = ref('');
    const selectedGroup = ref('');
    const groupState = reactive({
      groups: [],
    });
    const local = reactive({
      quote: null,
      quoteError: '',
      quoteLoading: false,
      submitting: false,
      groupCreating: false,
    });
    let quoteTimer = null;
    let quoteSeq = 0;

    async function refreshQuote() {
      if (!selectedPeriod.value) {
        local.quote = null;
        local.quoteLoading = false;
        return;
      }

      const seq = ++quoteSeq;
      local.quoteLoading = true;
      local.quoteError = '';
      try {
        const quote = await api.post('/user/order/quote', {
          plan_id: props.plan.id,
          period: selectedPeriod.value,
          coupon_code: couponCode.value.trim(),
          method: selectedMethod.value,
          subscription_mode: 'append',
          group_buy_activity_id: selectedGroupActivity.value || null,
        });
        if (seq === quoteSeq) local.quote = quote;
      } catch (error) {
        if (seq === quoteSeq) {
          local.quote = null;
          local.quoteError = error.message || '价格计算失败';
        }
      } finally {
        if (seq === quoteSeq) local.quoteLoading = false;
      }
    }

    function scheduleQuote() {
      clearTimeout(quoteTimer);
      quoteSeq += 1;
      local.quote = null;
      local.quoteError = '';
      local.quoteLoading = Boolean(selectedPeriod.value);
      quoteTimer = setTimeout(refreshQuote, 260);
    }

    watch(() => props.methods?.[0]?.id, (id) => {
      if (!selectedMethod.value && id) selectedMethod.value = String(id);
    }, { immediate: true });

    watch(() => props.groupBuy?.groups, (groups) => {
      groupState.groups = Array.isArray(groups) ? [...groups] : [];
    }, { immediate: true });

    watch(() => [selectedPeriod.value, couponCode.value, selectedMethod.value, selectedGroupActivity.value], scheduleQuote, { immediate: true });

    onBeforeUnmount(() => clearTimeout(quoteTimer));

    function upsertGroup(group) {
      if (!group?.id) return;
      const index = groupState.groups.findIndex((item) => Number(item.id) === Number(group.id));
      if (index >= 0) groupState.groups.splice(index, 1, group);
      else groupState.groups.unshift(group);
    }

    async function createGroup({ silent = false } = {}) {
      if (!selectedGroupActivity.value) return null;
      local.groupCreating = true;
      try {
        const group = await api.post('/user/group-buy/create', { activity_id: selectedGroupActivity.value });
        upsertGroup(group);
        selectedGroup.value = String(group.id);
        if (!silent) toast('拼团已创建');
        return group;
      } catch (error) {
        if (!silent) toast(error.message, 'error');
        throw error;
      } finally {
        local.groupCreating = false;
      }
    }

    async function ensureGroupForOrder() {
      if (!selectedGroupActivity.value) return null;
      if (selectedGroup.value) return selectedGroup.value;
      const group = await createGroup({ silent: true });
      return group?.id ? String(group.id) : null;
    }

    async function buyPlan(event) {
      event.preventDefault();
      if (!selectedPeriod.value) return;
      local.submitting = true;
      try {
        const groupId = await ensureGroupForOrder();
        const tradeNo = await api.post('/user/order/save', {
          plan_id: props.plan.id,
          period: selectedPeriod.value,
          coupon_code: couponCode.value.trim(),
          subscription_mode: 'append',
          group_buy_activity_id: selectedGroupActivity.value || null,
          group_buy_group_id: groupId,
        });
        toast('订单已创建');
        go('orders', { trade_no: tradeNo, method: selectedMethod.value });
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        local.submitting = false;
      }
    }

    return () => {
      const activities = (props.groupBuy.activities || []).filter((item) =>
        Number(item.plan_id) === Number(props.plan.id)
        && (!selectedPeriod.value || item.period === selectedPeriod.value)
      );
      const groups = groupState.groups.filter((item) =>
        Number(item.plan_id) === Number(props.plan.id)
        && (!selectedGroupActivity.value || Number(item.activity_id) === Number(selectedGroupActivity.value))
      );
      const quote = local.quote || {};
      const original = quote.original_amount ?? Number(props.plan[selectedPeriod.value] || 0);
      const totalDiscount = Number(quote.discount_amount || 0);
      const couponDiscount = Number(quote.coupon_discount_amount || 0);
      const groupBuyDiscount = Number(quote.group_buy_discount_amount || 0);
      const vipDiscount = Number(quote.vip_discount_amount || 0);
      const otherDiscount = Math.max(totalDiscount - couponDiscount - groupBuyDiscount - vipDiscount, 0);
      const surplus = Number(quote.surplus_amount || 0);
      const balance = Number(quote.balance_amount || 0);
      const handling = Number(quote.handling_amount || 0);
      const payAmount = quote.pay_amount ?? quote.total_amount ?? original;
      const traffic = props.plan.transfer_enable
        ? bytes(Number(props.plan.transfer_enable) * 1024 * 1024 * 1024)
        : '不限流量';
      const tierLabel = props.index === 1 ? '推荐套餐' : (props.index === 0 ? '基础套餐' : '订阅套餐');
      const paymentCovered = Boolean(local.quote) && Number(payAmount || 0) <= 0;
      const paymentPending = local.quoteLoading && !local.quote;
      const requiresPaymentMethod = Number(payAmount || 0) > 0;
      const paymentEmptyTitle = props.methodsError ? '支付方式加载失败' : '暂无可用支付方式';
      const paymentEmptyHint = props.methodsError || '请联系管理员配置支付渠道';
      const quoteLines = [
        quoteLine('套餐原价', money(original, currencySymbol())),
        couponDiscount > 0 ? quoteLine('优惠券', `-${money(couponDiscount, currencySymbol())}`, 'ok') : null,
        vipDiscount > 0 ? quoteLine('会员优惠', `-${money(vipDiscount, currencySymbol())}`, 'ok') : null,
        groupBuyDiscount > 0 ? quoteLine('拼团优惠', `-${money(groupBuyDiscount, currencySymbol())}`, 'ok') : null,
        otherDiscount > 0 ? quoteLine('活动优惠', `-${money(otherDiscount, currencySymbol())}`, 'ok') : null,
        surplus > 0 ? quoteLine('套餐折抵', `-${money(surplus, currencySymbol())}`, 'ok') : null,
        balance > 0 ? quoteLine('余额抵扣', `-${money(balance, currencySymbol())}`, 'ok') : null,
        handling > 0 ? quoteLine('支付手续费', money(handling, currencySymbol()), 'warn') : null,
      ].filter(Boolean);

      return h('form', {
        class: ['plan-card', props.index === 1 ? 'hot' : ''],
        onSubmit: buyPlan,
      }, [
        h('section', { class: 'plan-product' }, [
          h('div', { class: 'plan-tier' }, [
            h('span', tierLabel),
            props.index === 1 ? h('em', '推荐') : null,
          ]),
          h('div', { class: 'plan-head' }, [
            h('div', [
              h('h2', props.plan.name),
              h('p', '适合日常稳定使用的订阅方案'),
            ]),
            h('div', { class: 'plan-traffic' }, [
              h('small', '套餐流量'),
              h('strong', traffic),
            ]),
          ]),
          h('div', { class: 'plan-content', innerHTML: planDescriptionBody(props.plan.content) }),
          h('div', { class: 'plan-meta' }, [
            h('span', [h('small', '速率限制'), h('strong', props.plan.speed_limit ? `${props.plan.speed_limit} Mbps` : '不限速')]),
            h('span', [h('small', '在线设备'), h('strong', props.plan.device_limit ? `${props.plan.device_limit} 台` : '不限设备')]),
            h('span', [h('small', '流量额度'), h('strong', traffic)]),
          ]),
        ]),
        h('aside', { class: 'plan-checkout' }, [
          h('div', { class: 'plan-checkout-head' }, [
            h('div', [h('small', 'ORDER CONFIGURATION'), h('h3', '购买配置')]),
            h('span', '价格将自动计算'),
          ]),
          h('div', { class: 'plan-checkout-fields' }, [
            h('label', { class: 'plan-control' }, [h('span', '购买周期'), h('select', {
              name: 'period',
              value: selectedPeriod.value,
              onChange: (event) => { selectedPeriod.value = event.target.value; },
            }, options.map((item) => h('option', { value: item.key }, item.label)))]),
            h('label', { class: 'plan-control' }, [h('span', '优惠码'), h('input', {
              name: 'coupon_code',
              value: couponCode.value,
              placeholder: '选填，输入后自动计算',
              onInput: (event) => { couponCode.value = event.target.value; },
            })]),
            h('div', { class: 'plan-field' }, [
              h('span', '支付方式'),
              props.methods?.length ? h('div', { class: 'payment-methods plan-payment-methods' }, props.methods.map((method, index) => h('label', { class: 'payment-method' }, [
                h('input', {
                  type: 'radio',
                  name: `method-${props.plan.id}`,
                  value: method.id,
                  checked: String(selectedMethod.value || props.methods[0]?.id) === String(method.id) || (!selectedMethod.value && index === 0),
                  onChange: (event) => { selectedMethod.value = event.target.value; },
                }),
                method.icon
                  ? h('img', { src: method.icon, alt: '' })
                  : h('span', { class: 'pay-icon' }, '¥'),
                h('span', method.name || method.payment || `支付方式 ${method.id}`),
              ]))) : h('div', { class: ['plan-payment-empty', paymentCovered ? 'is-covered' : '', paymentPending ? 'is-loading' : ''] }, [
                h('i', paymentPending ? '…' : (paymentCovered ? '✓' : '!')),
                h('div', [
                  h('strong', paymentPending ? '正在核算支付金额' : (paymentCovered ? '无需额外支付' : paymentEmptyTitle)),
                  h('span', paymentPending ? '请稍候，正在获取最新结算结果' : (paymentCovered ? '优惠与余额已覆盖本次金额' : paymentEmptyHint)),
                ]),
              ]),
            ]),
            activities.length ? h('div', { class: 'plan-field group-buy-field' }, [
              h('span', '拼团优惠'),
              h('select', {
                value: selectedGroupActivity.value,
                onChange: (event) => {
                  selectedGroupActivity.value = event.target.value;
                  selectedGroup.value = '';
                },
              }, [
                h('option', { value: '' }, '不参与拼团'),
                ...activities.map((activity) => h('option', { value: activity.id }, `${activity.title} · ${activity.group_size}人成团`)),
              ]),
              selectedGroupActivity.value ? h('div', { class: 'group-buy-actions' }, [
                groups.length ? h('select', {
                  value: selectedGroup.value,
                  onChange: (event) => { selectedGroup.value = event.target.value; },
                }, [
                  h('option', { value: '' }, '自己开团'),
                  ...groups.map((group) => h('option', { value: group.id }, `加入团 #${group.id} · ${group.current_count}/${group.required_count}`)),
                ]) : null,
                h('button', { class: 'secondary-button', type: 'button', disabled: local.groupCreating, onClick: createGroup }, local.groupCreating ? '开团中...' : '创建拼团'),
              ]) : null,
            ]) : null,
          ]),
          h('div', { class: 'plan-quote' }, [
            h('div', { class: 'plan-quote-main' }, [
              h('span', '预计实付'),
              h('strong', local.quoteLoading ? '计算中...' : money(payAmount, currencySymbol())),
            ]),
            h('div', { class: 'plan-quote-lines' }, [
              ...quoteLines,
            ]),
            local.quoteError ? h('p', { class: 'quote-error' }, local.quoteError) : null,
          ]),
          h('button', {
            class: 'primary-button plan-submit',
            type: 'submit',
            disabled: local.submitting
              || local.quoteLoading
              || Boolean(local.quoteError)
              || !selectedPeriod.value
              || (requiresPaymentMethod && !selectedMethod.value),
          }, local.submitting ? '正在创建订单…' : '确认购买'),
          h('p', { class: 'plan-submit-note' }, '提交前请确认套餐周期与支付信息'),
        ]),
      ]);
    };
  },
};

const PlansPage = {
  setup() {
    const selectedPlanId = ref('');
    const local = useAsyncPage(async (page) => {
      const [plans, methods, groupBuy] = await Promise.all([
        api.get('/user/plan/fetch'),
        api.get('/user/order/getPaymentMethod').catch((error) => {
          page.methodsError = error.message || '支付渠道请求失败，请稍后重试';
          return [];
        }),
        api.get('/user/group-buy/fetch').catch(() => ({ activities: [], groups: [] })),
      ]);
      page.plans = normalizeCollection(plans);
      page.methods = methods;
      page.groupBuy = groupBuy || { activities: [], groups: [] };
    });

    watch(() => local.plans, (plans) => {
      const list = Array.isArray(plans) ? plans : [];
      if (!list.length) {
        selectedPlanId.value = '';
        return;
      }
      if (!list.some((plan) => String(plan.id) === String(selectedPlanId.value))) {
        selectedPlanId.value = String(list[0].id);
      }
    }, { immediate: true });

    return () => {
      const plans = local.plans || [];
      const selectedIndex = Math.max(0, plans.findIndex((plan) => String(plan.id) === String(selectedPlanId.value)));
      const selectedPlan = plans[selectedIndex] || null;

      return h('div', { class: 'plan-purchase-page' }, [
        pageError(local.error),
        plans.length > 1 ? h('nav', { class: 'plan-selector', 'aria-label': '选择套餐' }, plans.map((plan, index) => {
          const option = periodOptions(plan)[0];
          const isActive = String(plan.id) === String(selectedPlan?.id);
          return h('button', {
            type: 'button',
            class: ['plan-selector-card', isActive ? 'active' : ''],
            onClick: () => { selectedPlanId.value = String(plan.id); },
          }, [
            h('span', index === 1 ? '推荐' : `套餐 ${index + 1}`),
            h('strong', plan.name),
            h('small', option?.label || '查看套餐价格'),
          ]);
        })) : null,
        selectedPlan ? h('div', { class: 'plan-grid' }, [h(PlanPurchaseCard, {
          key: selectedPlan.id,
          plan: selectedPlan,
          index: selectedIndex,
          methods: local.methods || [],
          methodsError: local.methodsError || '',
          groupBuy: local.groupBuy || { activities: [], groups: [] },
        })]) : null,
        local.ready && !plans.length ? emptyBlock('暂无可购买套餐') : null,
      ]);
    };
  },
};

function digitalPackageOptions(plan = {}) {
  return (plan.product_config?.packages || [])
    .filter((item) => item?.id && Number(item.price) > 0)
    .map((item) => ({
      key: String(item.id),
      name: item.name || item.id,
      price: Number(item.price) * 100,
      originalPrice: Number(item.original_price || 0) * 100,
      description: item.description || '',
      stockCount: item.stock_count === undefined ? null : Number(item.stock_count),
    }));
}

const DigitalProductCard = {
  props: {
    plan: { type: Object, required: true },
    onOpen: { type: Function, required: true },
    onAdd: { type: Function, required: true },
    onDetail: { type: Function, required: true },
  },
  setup(props) {
    const packages = digitalPackageOptions(props.plan);
    return () => {
      const price = packages[0]?.price || 0;
      const delivery = { text: '人工交付', code: '自动交付', link: '自动交付', account: '自动交付' }[props.plan.product_config?.delivery_type] || '自动交付';
      const image = props.plan.product_config?.image_url;
      return h('article', { class: 'store-product-card', onClick: () => props.onOpen(props.plan) }, [
        h('div', { class: ['store-product-cover', image ? '' : 'is-placeholder'], style: image ? { backgroundImage: `url("${image}")` } : {} }, [
          image ? null : h('span', String(props.plan.name || 'D').slice(0, 1).toUpperCase()),
          h('em', props.plan.product_config?.category || '数字商品'),
        ]),
        h('div', { class: 'store-product-body' }, [
          h('small', `分类 · ${props.plan.product_config?.category || '数字商品'}`),
          h('h2', props.plan.name),
          h('div', { class: 'store-product-badges' }, [
            h('span', delivery),
            h('span', { class: Number(props.plan.stock_count) > 0 ? 'ok' : 'off' }, Number(props.plan.stock_count) > 0 ? '有库存' : '已售罄'),
          ]),
          h('div', { class: 'store-product-summary', innerHTML: safeBody(props.plan.content || '支付完成后自动交付') }),
          h('div', { class: 'store-product-footer' }, [
            h('span', [h('small', '价格'), h('strong', money(price, currencySymbol()))]),
            h('div', { class: 'store-card-actions' }, [
              h('button', { type: 'button', title: '加入购物车', disabled: Number(props.plan.stock_count) <= 0, onClick: (event) => { event.stopPropagation(); props.onAdd(props.plan); } }, '🛒'),
              h('button', { type: 'button', title: '查看详情', onClick: (event) => { event.stopPropagation(); props.onDetail(props.plan); } }, '→'),
            ]),
          ]),
        ]),
      ]);
    };
  },
};

const DigitalProductsPage = {
  setup() {
    const selected = ref(null);
    const selectedPackage = ref('');
    const cartOpen = ref(false);
    const selectedCategory = ref('all');
    const serviceTab = ref('notice');
    const orderQuery = ref('');
    const faqOpen = ref(0);
    const local = useAsyncPage(async (page) => {
      const [products, banner, categories, notices, faqs] = await Promise.all([
        api.get('/user/plan/fetch', { product_type: 'digital' }),
        api.get('/guest/plan/digital-banner').catch(() => ({})),
        api.get('/guest/plan/digital-categories').catch(() => []),
        api.get('/user/notice/fetch', { current: 1 }).catch(() => ({ data: [] })),
        api.get('/guest/plan/digital-faqs').catch(() => []),
      ]);
      const productRows = normalizeCollection(products);
      const bannerData = banner || {};
      const imageUrl = bannerData.image_url || productRows.find((item) => item.product_config?.featured)?.product_config?.image_url;
      if (imageUrl) {
        await new Promise((resolve) => {
          const image = new Image();
          const timer = setTimeout(resolve, 4000);
          image.onload = image.onerror = () => { clearTimeout(timer); resolve(); };
          image.src = imageUrl;
        });
      }
      page.products = productRows;
      page.banner = bannerData;
      page.categories = normalizeCollection(categories);
      page.notices = normalizeCollection(notices.data || notices).slice(0, 3);
      page.faqs = normalizeCollection(faqs);
    });
    function visibleProducts() {
      if (selectedCategory.value === 'all') return local.products || [];
      return (local.products || []).filter((plan) => String(plan.digital_category_id) === String(selectedCategory.value));
    }
    function open(plan) {
      selected.value = plan;
      const options = digitalPackageOptions(plan);
      selectedPackage.value = (options.find((item) => item.stockCount === null || item.stockCount > 0) || options[0])?.key || '';
    }
    function checkout() {
      if (!selected.value || !selectedPackage.value) return;
      go('digital-checkout', { plan_id: selected.value.id, package: selectedPackage.value });
    }
    function addToCart(plan, packageId = '') {
      const options = digitalPackageOptions(plan);
      const pkg = options.find((item) => item.key === packageId) || options.find((item) => item.stockCount === null || item.stockCount > 0) || options[0];
      if (!pkg || pkg.stockCount === 0) return toast('当前规格已售罄', 'error');
      const key = `${plan.id}:${pkg.key}`;
      const current = digitalCart.value.find((item) => item.key === key);
      if (current) current.quantity = Math.min(Number(pkg.stockCount || 20), current.quantity + 1);
      else digitalCart.value.push({ key, plan_id: plan.id, package_id: pkg.key, quantity: 1, name: plan.name, package_name: pkg.name, unit_price: pkg.price, image_url: plan.product_config?.image_url || '', stock_count: pkg.stockCount });
      digitalCart.value = [...digitalCart.value];
      storeDigitalCart();
      cartOpen.value = true;
      toast('已加入购物车');
    }
    function changeCart(item, amount) {
      item.quantity = Math.max(0, Math.min(Number(item.stock_count || 20), item.quantity + amount));
      if (!item.quantity) digitalCart.value = digitalCart.value.filter((row) => row.key !== item.key);
      else digitalCart.value = [...digitalCart.value];
      storeDigitalCart();
    }
    function openDetail(plan) { go('digital-detail', { id: plan.id }); }
    function checkoutCart() {
      if (!digitalCart.value.length) return;
      cartOpen.value = false;
      go('digital-checkout', { cart: '1' });
    }
    return () => h('div', [
      pageError(local.error),
      h('div', { class: 'store-hero-grid' }, [
        local.ready ? h('section', {
          class: 'store-banner',
          style: (local.banner?.image_url || (local.products || []).find((item) => item.product_config?.featured)?.product_config?.image_url)
            ? { backgroundImage: `linear-gradient(90deg,rgba(4,10,18,.78),rgba(4,10,18,.18)),url("${local.banner?.image_url || (local.products || []).find((item) => item.product_config?.featured).product_config.image_url}")` }
            : {},
        }, [
          h('div', [h('span', '● DIGITAL STORE'), h('h1', local.banner?.title || '数字商品中心'), h('p', local.banner?.subtitle || '精选数字资产，安全购买，支付完成后快速交付。'), local.banner?.button_text !== '' ? h('a', { href: local.banner?.link_url || '#digital-products' }, `${local.banner?.button_text || '了解更多'}  →`) : null]),
        ]) : h('section', { class: 'store-banner store-banner-loading', 'aria-label': 'Banner 加载中' }),
        h('aside', { class: 'store-notice-panel' }, [
          h('header', [h('div', [h('small', 'STORE SERVICE'), h('h2', serviceTab.value === 'notice' ? '最新公告' : '订单查询')])]),
          h('nav', { class: 'store-service-tabs' }, [
            ['notice', '公告'], ['order', '查单'],
          ].map(([key, label]) => h('button', { type: 'button', class: serviceTab.value === key ? 'active' : '', onClick: () => { serviceTab.value = key; } }, label))),
          serviceTab.value === 'notice' ? h('div', { class: 'store-notice-list' }, (local.notices || []).length
            ? local.notices.map((notice) => h('article', { key: notice.id }, [
              h('div', [h('i'), h('h3', notice.title || '站点公告')]),
              h('div', { class: 'store-notice-content', innerHTML: safeBody(notice.content || notice.body || '') }),
            ]))
            : [h('article', { class: 'is-empty' }, [h('div', [h('i'), h('h3', '暂无公告')]), h('p', '新的站点通知会显示在这里。')])]) : null,
          serviceTab.value === 'order' ? h('div', { class: 'store-order-lookup' }, [
            h('div', { class: 'store-service-icon' }, '⌕'),
            h('h3', '查询数字商品订单'),
            h('p', '输入订单号，快速查看支付状态与交付内容。'),
            h('form', { onSubmit: (event) => { event.preventDefault(); const tradeNo = orderQuery.value.trim(); if (!tradeNo) return toast('请输入订单号', 'error'); go('orders', { trade_no: tradeNo }); } }, [
              h('input', { value: orderQuery.value, placeholder: '请输入订单号', autocomplete: 'off', onInput: (event) => { orderQuery.value = event.target.value; } }),
              h('button', { type: 'submit' }, '立即查询'),
            ]),
            h('a', { href: '#/orders' }, '查看我的全部订单 →'),
          ]) : null,
        ]),
      ]),
      h('div', { class: 'store-section-heading', id: 'digital-products' }, [h('div', [h('h1', '精选商品'), h('p', '探索我们精心挑选的优质数字资产系列。')]), h('div', { class: 'store-heading-actions' }, [h('span', `${visibleProducts().length} 件商品`), h('button', { type: 'button', class: 'store-cart-button', onClick: () => { cartOpen.value = true; } }, `🛒 购物车 ${digitalCart.value.reduce((sum, item) => sum + item.quantity, 0)}`)])]),
      h('nav', { class: 'store-category-nav', 'aria-label': '商品分类' }, [
        h('button', { type: 'button', class: selectedCategory.value === 'all' ? 'active' : '', onClick: () => { selectedCategory.value = 'all'; } }, [h('span', '全部商品'), h('small', String((local.products || []).length))]),
        ...(local.categories || []).map((category) => h('button', { key: category.id, type: 'button', class: String(selectedCategory.value) === String(category.id) ? 'active' : '', onClick: () => { selectedCategory.value = category.id; } }, [h('span', category.name), h('small', String(category.product_count || 0))])),
      ]),
      h('div', { class: 'store-product-grid' }, visibleProducts().map((plan) => h(DigitalProductCard, { key: plan.id, plan, onOpen: open, onAdd: addToCart, onDetail: openDetail }))),
      local.ready && !visibleProducts().length ? emptyBlock(selectedCategory.value === 'all' ? '暂无可购买的数字商品' : '该分类暂无商品') : null,
      h('section', { class: 'store-faq-section' }, [
        h('div', { class: 'store-faq-heading' }, [h('small', 'HELP CENTER'), h('h2', '常见问题'), h('p', '购买、支付与商品交付的常见说明')]),
        h('div', { class: 'store-faq-list' }, (local.faqs || []).map((item, index) => h('article', { class: faqOpen.value === index ? 'active' : '' }, [
          h('button', { type: 'button', onClick: () => { faqOpen.value = faqOpen.value === index ? -1 : index; } }, [h('i', String(index + 1).padStart(2, '0')), h('span', item.title), h('b', faqOpen.value === index ? '−' : '+')]),
          faqOpen.value === index ? h('p', item.content) : null,
        ]))),
        h('div', { class: 'store-faq-footer' }, [h('span', '没有找到答案？'), h('a', { href: '#/tickets' }, '提交工单')]),
      ]),
      selected.value ? h('div', { class: 'store-modal-backdrop', onClick: (event) => { if (event.target === event.currentTarget) selected.value = null; } }, [
        h('section', { class: 'store-quick-modal' }, [
          h('div', { class: 'store-modal-head' }, [h('h2', '快速购买'), h('button', { type: 'button', onClick: () => { selected.value = null; } }, '×')]),
          h('div', { class: 'store-modal-product' }, [
            h('div', { class: ['store-modal-image', selected.value.product_config?.image_url ? '' : 'is-placeholder'], style: selected.value.product_config?.image_url ? { backgroundImage: `url("${selected.value.product_config.image_url}")` } : {} }, selected.value.product_config?.image_url ? [] : [h('span', selected.value.name.slice(0, 1))]),
            h('div', [h('h2', selected.value.name), h('div', { class: 'store-product-badges' }, [h('span', selected.value.product_config?.delivery_type === 'text' ? '人工交付' : '自动交付'), h('span', { class: 'ok' }, '有库存')]), h('strong', money(digitalPackageOptions(selected.value).find((item) => item.key === selectedPackage.value)?.price || 0, currencySymbol()))]),
          ]),
          h('div', { class: 'store-modal-content' }, [
            h('div', { class: 'store-modal-description', innerHTML: safeBody(selected.value.content || '支付完成后自动交付') }),
            h('p', [h('span', '当前规格库存：'), h('strong', `● 剩余 ${digitalPackageOptions(selected.value).find((item) => item.key === selectedPackage.value)?.stockCount ?? selected.value.stock_count} 件`)]),
            h('label', ['商品规格', h('select', { value: selectedPackage.value, onChange: (event) => { selectedPackage.value = event.target.value; } }, digitalPackageOptions(selected.value).map((item) => h('option', { value: item.key, disabled: item.stockCount === 0 }, `${item.name} · ${money(item.price, currencySymbol())}${item.stockCount === null ? '' : ` · 库存 ${item.stockCount}`}`)))]),
            digitalPackageOptions(selected.value).find((item) => item.key === selectedPackage.value)?.description ? h('p', { class: 'store-spec-description' }, digitalPackageOptions(selected.value).find((item) => item.key === selectedPackage.value).description) : null,
            h('div', { class: 'store-quantity' }, [h('span', '数量'), h('div', [h('button', { type: 'button', disabled: true }, '−'), h('strong', '1'), h('button', { type: 'button', disabled: true }, '+')])]),
          ]),
          h('div', { class: 'store-modal-actions' }, [h('button', { class: 'secondary-button', type: 'button', onClick: () => { addToCart(selected.value, selectedPackage.value); selected.value = null; } }, '加入购物车'), h('button', { class: 'secondary-button', type: 'button', onClick: () => openDetail(selected.value) }, '查看详情'), h('button', { class: 'primary-button', type: 'button', disabled: digitalPackageOptions(selected.value).find((item) => item.key === selectedPackage.value)?.stockCount === 0, onClick: checkout }, digitalPackageOptions(selected.value).find((item) => item.key === selectedPackage.value)?.stockCount === 0 ? '当前规格已售罄' : '立即购买')]),
        ]),
      ]) : null,
      cartOpen.value ? h('div', { class: 'store-modal-backdrop', onClick: (event) => { if (event.target === event.currentTarget) cartOpen.value = false; } }, [
        h('aside', { class: 'store-cart-drawer' }, [
          h('div', { class: 'store-modal-head' }, [h('div', [h('h2', '购物车'), h('small', `共 ${digitalCart.value.reduce((sum, item) => sum + item.quantity, 0)} 件商品`)]), h('button', { type: 'button', onClick: () => { cartOpen.value = false; } }, '×')]),
          h('div', { class: 'store-cart-list' }, digitalCart.value.length ? digitalCart.value.map((item) => h('div', { class: 'store-cart-item', key: item.key }, [
            h('div', { class: 'store-cart-thumb', style: item.image_url ? { backgroundImage: `url("${item.image_url}")` } : {} }, item.image_url ? [] : [String(item.name).slice(0, 1)]),
            h('div', [h('strong', item.name), h('small', item.package_name), h('b', money(item.unit_price * item.quantity, currencySymbol()))]),
            h('div', { class: 'store-cart-quantity' }, [h('button', { type: 'button', onClick: () => changeCart(item, -1) }, '−'), h('span', item.quantity), h('button', { type: 'button', onClick: () => changeCart(item, 1) }, '+')]),
          ])) : [emptyBlock('购物车还是空的')]),
          h('div', { class: 'store-cart-footer' }, [h('div', [h('span', '合计'), h('strong', money(digitalCart.value.reduce((sum, item) => sum + item.unit_price * item.quantity, 0), currencySymbol()))]), h('button', { class: 'primary-button', type: 'button', disabled: !digitalCart.value.length, onClick: checkoutCart }, '统一结算')]),
        ]),
      ]) : null,
    ]);
  },
};

const DigitalProductDetailPage = {
  setup() {
    const selectedPackage = ref('');
    const activeImage = ref('');
    const local = useAsyncPage(async (page) => {
      page.plan = await api.get('/user/plan/fetch', { id: state.route.query.id });
      const options = digitalPackageOptions(page.plan);
      selectedPackage.value = (options.find((item) => item.stockCount === null || item.stockCount > 0) || options[0])?.key || '';
      activeImage.value = page.plan.product_config?.image_url || page.plan.product_config?.gallery?.[0] || '';
    });
    function add() {
      const plan = local.plan;
      const pkg = digitalPackageOptions(plan).find((item) => item.key === selectedPackage.value);
      if (!plan || !pkg) return;
      const key = `${plan.id}:${pkg.key}`;
      const current = digitalCart.value.find((item) => item.key === key);
      if (current) current.quantity = Math.min(Number(pkg.stockCount || 20), current.quantity + 1);
      else digitalCart.value.push({ key, plan_id: plan.id, package_id: pkg.key, quantity: 1, name: plan.name, package_name: pkg.name, unit_price: pkg.price, image_url: plan.product_config?.image_url || '', stock_count: pkg.stockCount });
      digitalCart.value = [...digitalCart.value]; storeDigitalCart(); toast('已加入购物车');
    }
    return () => {
      const plan = local.plan || {};
      const options = digitalPackageOptions(plan);
      const pkg = options.find((item) => item.key === selectedPackage.value) || {};
      const gallery = [...new Set([plan.product_config?.image_url, ...(plan.product_config?.gallery || [])].filter(Boolean))];
      return h('div', { class: 'store-detail-page' }, [
        pageError(local.error),
        h('button', { class: 'store-back-link', type: 'button', onClick: () => go('digital') }, '← 返回数字商品'),
        local.ready ? h('section', { class: 'store-detail-hero' }, [
          h('div', { class: 'store-detail-gallery' }, [h('div', { class: 'store-detail-main-image', style: activeImage.value ? { backgroundImage: `url("${activeImage.value}")` } : {} }, activeImage.value ? [] : [h('span', String(plan.name || 'D').slice(0, 1))]), gallery.length > 1 ? h('div', { class: 'store-detail-thumbs' }, gallery.map((url) => h('button', { class: activeImage.value === url ? 'active' : '', style: { backgroundImage: `url("${url}")` }, onClick: () => { activeImage.value = url; } }))) : null]),
          h('div', { class: 'store-detail-info' }, [h('span', plan.product_config?.category || '数字商品'), h('h1', plan.name), h('div', { class: 'store-product-summary', innerHTML: safeBody(plan.content || '') }), h('strong', money(pkg.price || 0, currencySymbol())), h('label', ['选择规格', h('select', { value: selectedPackage.value, onChange: (event) => { selectedPackage.value = event.target.value; } }, options.map((item) => h('option', { value: item.key, disabled: item.stockCount === 0 }, `${item.name} · ${money(item.price, currencySymbol())} · 库存 ${item.stockCount ?? '-'}`)))]), h('div', { class: 'store-detail-actions' }, [h('button', { class: 'secondary-button', type: 'button', disabled: pkg.stockCount === 0, onClick: add }, '🛒 加入购物车'), h('button', { class: 'primary-button', type: 'button', disabled: pkg.stockCount === 0, onClick: () => go('digital-checkout', { plan_id: plan.id, package: selectedPackage.value }) }, '立即购买')])]),
        ]) : null,
        local.ready ? h('article', { class: 'store-detail-content' }, [h('h2', '商品详情'), h('div', { innerHTML: markdownBody(plan.product_config?.detail_markdown || plan.content || '暂无商品详情') })]) : null,
      ]);
    };
  },
};

const DigitalCheckoutPage = {
  setup() {
    const balanceMethodId = 'local-balance';
    const couponCode = ref('');
    const selectedMethod = ref(balanceMethodId);
    const cartMode = state.route.query.cart === '1';
    const local = useAsyncPage(async (page) => {
      const [planData, methods] = await Promise.all([
        cartMode ? api.get('/user/plan/fetch', { product_type: 'digital' }) : api.get('/user/plan/fetch', { id: state.route.query.plan_id }),
        api.get('/user/order/getPaymentMethod').catch(() => []),
      ]);
      const products = cartMode ? normalizeCollection(planData) : [planData];
      page.items = cartMode ? digitalCart.value.map((cartItem) => {
        const plan = products.find((item) => Number(item.id) === Number(cartItem.plan_id));
        const pkg = digitalPackageOptions(plan).find((item) => item.key === cartItem.package_id);
        return plan && pkg ? { ...cartItem, plan, package: pkg } : null;
      }).filter(Boolean) : [{ key: `${planData.id}:${state.route.query.package}`, plan_id: planData.id, package_id: state.route.query.package, quantity: 1, plan: planData, package: digitalPackageOptions(planData).find((item) => item.key === state.route.query.package) || digitalPackageOptions(planData)[0] }];
      page.plan = page.items[0]?.plan;
      page.methods = methods || [];
      page.package = page.items[0]?.package;
      selectedMethod.value = balanceMethodId;
      page.quote = null;
      page.quoteLoading = true;
      page.quoteError = '';
      page.submitting = false;
      setTimeout(refreshQuote, 0);
    });
    let quoteTimer = null;
    let quoteRequestId = 0;
    async function refreshQuote() {
      if (!local.items?.length || !selectedMethod.value) return;
      const requestId = ++quoteRequestId;
      local.quoteLoading = true;
      try {
        const method = selectedMethod.value === balanceMethodId ? null : selectedMethod.value;
        const quote = cartMode
          ? await api.post('/user/order/digital-cart/quote', { items: local.items.map((item) => ({ plan_id: item.plan_id, package_id: item.package_id, quantity: item.quantity })), method })
          : await api.post('/user/order/quote', { plan_id: local.plan.id, period: local.package.key, coupon_code: couponCode.value.trim(), method, subscription_mode: 'append' });
        if (requestId !== quoteRequestId) return;
        local.quote = quote;
        local.quoteError = '';
      } catch (error) {
        if (requestId !== quoteRequestId) return;
        local.quoteError = error.message;
      } finally {
        if (requestId === quoteRequestId) local.quoteLoading = false;
      }
    }
    watch(() => [couponCode.value, selectedMethod.value, local.items?.length], () => {
      clearTimeout(quoteTimer);
      local.quoteLoading = true;
      quoteTimer = setTimeout(refreshQuote, 220);
    });
    onBeforeUnmount(() => clearTimeout(quoteTimer));
    async function submit() {
      if (!local.items?.length || !selectedMethod.value) return;
      if (local.quoteLoading || !local.quote) return;
      if (selectedMethod.value === balanceMethodId && Number(local.quote?.pay_amount ?? local.quote?.total_amount ?? 0) > 0) {
        toast('账户余额不足，请选择其他支付方式或先充值', 'error');
        return;
      }
      local.submitting = true;
      try {
        const tradeNo = cartMode
          ? await api.post('/user/order/digital-cart/save', { items: local.items.map((item) => ({ plan_id: item.plan_id, package_id: item.package_id, quantity: item.quantity })) })
          : await api.post('/user/order/save', { plan_id: local.plan.id, period: local.package.key, coupon_code: couponCode.value.trim(), subscription_mode: 'append' });
        if (cartMode) { digitalCart.value = []; storeDigitalCart(); }
        if (selectedMethod.value === balanceMethodId) {
          await api.post('/user/order/checkout', { trade_no: tradeNo });
          await refreshUser().catch(() => null);
          toast('余额支付成功');
          go('orders', { trade_no: tradeNo });
        } else {
          toast('订单已创建，请完成支付');
          go('orders', { trade_no: tradeNo, method: selectedMethod.value });
        }
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        local.submitting = false;
      }
    }
    return () => {
      const plan = local.plan || {};
      const pkg = local.package || {};
      const quote = local.quote || {};
      const original = quote.original_amount ?? (local.items || []).reduce((sum, item) => sum + (item.package?.price || 0) * item.quantity, 0);
      const pay = quote.pay_amount ?? quote.total_amount ?? original;
      const couponDiscount = Number(quote.coupon_discount_amount || 0);
      const vipDiscount = Number(quote.vip_discount_amount || 0);
      const groupDiscount = Number(quote.group_buy_discount_amount || 0);
      const balanceAmount = Number(quote.balance_amount || 0);
      const handlingAmount = Number(quote.handling_amount || 0);
      const balanceSelected = selectedMethod.value === balanceMethodId;
      const balanceInsufficient = balanceSelected && Boolean(local.quote) && !local.quoteLoading && Number(pay) > 0;
      const paymentOptions = [
        { id: balanceMethodId, name: '本地余额支付', balance: Number(state.user?.balance || 0) },
        ...(local.methods || []),
      ];
      return h('div', { class: 'store-checkout-page' }, [
        pageError(local.error),
        h('div', { class: 'store-checkout-title' }, [h('h1', '订单结算'), h('p', '确认订单信息并提交')]),
        h('div', { class: 'store-checkout-steps' }, [h('span', { class: 'active' }, '1  订单结算'), h('i'), h('span', '2  发起支付')]),
        h('div', { class: 'store-checkout-layout' }, [
          h('main', [
            h('section', { class: 'store-checkout-panel' }, [h('h2', '订单商品'), h('div', { class: 'store-checkout-products' }, (local.items || []).map((item) => h('div', { class: 'store-checkout-product', key: item.key }, [h('div', { class: 'store-checkout-thumb', style: item.plan.product_config?.image_url ? { backgroundImage: `url("${item.plan.product_config.image_url}")` } : {} }, item.plan.product_config?.image_url ? [] : [h('span', String(item.plan.name || 'D').slice(0, 1))]), h('div', [h('h3', item.plan.name || '数字商品'), h('p', `数量：${item.quantity}`), h('p', `规格：${item.package?.name || '-'}`), h('strong', money((item.package?.price || 0) * item.quantity, currencySymbol()))])])))]),
            !cartMode ? h('section', { class: 'store-checkout-panel' }, [h('h2', '优惠券'), h('input', { value: couponCode.value, placeholder: '输入优惠券代码（可选）', onInput: (event) => { couponCode.value = event.target.value; } })]) : null,
          ]),
          h('aside', { class: 'store-checkout-panel store-checkout-summary' }, [
            h('h2', '提交订单'),
            h('p', '订单金额以服务端计算为准'),
            h('div', [
              quoteLine('商品数量', String((local.items || []).reduce((sum, item) => sum + item.quantity, 0))),
              quoteLine('原始金额', money(original, currencySymbol())),
              couponDiscount > 0 ? quoteLine('优惠券折扣', `-${money(couponDiscount, currencySymbol())}`, 'ok') : null,
              vipDiscount > 0 ? quoteLine('会员折扣', `-${money(vipDiscount, currencySymbol())}`, 'ok') : null,
              groupDiscount > 0 ? quoteLine('拼团折扣', `-${money(groupDiscount, currencySymbol())}`, 'ok') : null,
              balanceAmount > 0 ? quoteLine('余额抵扣', `-${money(balanceAmount, currencySymbol())}`, 'ok') : null,
              handlingAmount > 0 ? quoteLine('支付手续费', money(handlingAmount, currencySymbol()), 'warn') : null,
            ]),
            h('div', { class: 'store-checkout-total' }, [h('span', '应付金额（预估）'), h('strong', local.quoteLoading ? '计算中…' : money(pay, currencySymbol()))]),
            h('h3', '支付方式'),
            h('div', { class: 'payment-methods digital-payment-methods' }, paymentOptions.map((method) => h('label', { class: ['payment-method', String(method.id) === balanceMethodId ? 'balance-payment-method' : ''] }, [
              h('input', { type: 'radio', name: 'checkout-method', value: method.id, checked: String(selectedMethod.value) === String(method.id), onChange: (event) => { selectedMethod.value = event.target.value; } }),
              method.icon ? h('img', { src: method.icon, alt: '' }) : h('span', { class: 'pay-icon' }, String(method.id) === balanceMethodId ? '¥' : '付'),
              h('span', { class: 'payment-method-copy' }, [h('b', method.name || method.payment), String(method.id) === balanceMethodId ? h('small', `可用余额 ${money(method.balance, currencySymbol())}`) : null]),
            ]))),
            balanceInsufficient ? h('p', { class: 'quote-error balance-payment-warning' }, `余额不足，还差 ${money(pay, currencySymbol())}，请选择其他支付方式或先充值。`) : null,
            local.quoteError ? h('p', { class: 'quote-error' }, local.quoteError) : null,
            h('button', { class: 'primary-button', type: 'button', disabled: local.submitting || local.quoteLoading || !local.quote || !selectedMethod.value || Boolean(local.quoteError) || balanceInsufficient, onClick: submit }, local.submitting ? '提交中…' : (local.quoteLoading ? '正在计算金额…' : (balanceSelected ? '使用余额支付' : '提交订单并支付'))),
          ]),
        ]),
      ]);
    };
  },
};

const OrdersPage = {
  setup() {
    if (state.route.query.trade_no) return () => h(OrderDetailPage, {
      tradeNo: state.route.query.trade_no,
      method: state.route.query.method,
    });
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
        h(DataTable, { headers: ['订单号', '商品 / 套餐', '状态', '金额', '创建时间'], rows, empty: '暂无订单' }),
      ]);
    };
  },
};

function digitalDeliveryFields(content) {
  const raw = String(content ?? '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed).map(([label, value]) => ({ label, value: typeof value === 'object' ? JSON.stringify(value) : String(value) }));
    }
  } catch (_) {}
  const rows = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^([^:：]{1,30})[:：]\s*(.+)$/);
    return match ? { label: match[1], value: match[2] } : null;
  }).filter(Boolean);
  return rows.length ? rows : [{ label: '内容', value: raw }];
}

function digitalDeliveryFile(content) {
  const raw = String(content ?? '').trim();
  const match = raw.match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return null;
  const url = match[0];
  const clean = url.split(/[?#]/)[0];
  const name = decodeURIComponent(clean.split('/').pop() || '交付文件');
  const extension = name.includes('.') ? name.split('.').pop().toUpperCase() : '文件';
  return { url, name, meta: extension };
}

function orderProgressIcon(type) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  if (type === 'submit') return h('svg', common, [h('rect', { x: '6', y: '4', width: '12', height: '16', rx: '2' }), h('path', { d: 'M9 4.5V3h6v1.5M9 9h6M9 13h4' })]);
  if (type === 'payment') return h('svg', common, [h('rect', { x: '3', y: '6', width: '18', height: '13', rx: '2.5' }), h('path', { d: 'M3 10h18M16 15h2' })]);
  if (type === 'process') return h('svg', common, [h('path', { d: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z' }), h('path', { d: 'm4.5 7.8 7.5 4.3 7.5-4.3M12 12v9' })]);
  return h('svg', common, [h('circle', { cx: '12', cy: '12', r: '9' }), h('path', { d: 'm8 12 2.6 2.6L16.5 9' })]);
}

const OrderProgressFlow = {
  setup() {
    const svg = ref(null);
    const geometry = reactive({ width: 0, height: 0, connectors: '', rings: '', path: '' });
    let observer = null;
    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = svg.value;
        const container = element?.parentElement;
        if (!container) return;
        const bounds = container.getBoundingClientRect();
        const marks = [...container.querySelectorAll('.order-progress-mark')];
        if (marks.length < 2 || !bounds.width || !bounds.height) return;
        const points = marks.map((mark) => {
          const rect = mark.getBoundingClientRect();
          return {
            x: rect.left - bounds.left + rect.width / 2,
            y: rect.top - bounds.top + rect.height / 2,
            radius: rect.width / 2 + 1,
          };
        });
        let path = '';
        let connectors = '';
        let rings = '';
        points.forEach((point, index) => {
          const left = point.x - point.radius;
          const right = point.x + point.radius;
          const top = point.y - point.radius;
          const bottom = point.y + point.radius;
          const previous = points[index - 1];
          const lineStart = index === 0 ? 0 : previous.x + previous.radius;
          path += ` M ${lineStart} ${point.y} L ${left} ${point.y}`;
          connectors += ` M ${lineStart} ${point.y} L ${left} ${point.y}`;
          path += ` A ${point.radius} ${point.radius} 0 0 1 ${point.x} ${top}`;
          path += ` A ${point.radius} ${point.radius} 0 0 1 ${right} ${point.y}`;
          path += ` A ${point.radius} ${point.radius} 0 0 1 ${point.x} ${bottom}`;
          path += ` A ${point.radius} ${point.radius} 0 0 1 ${left} ${point.y}`;
          rings += ` M ${left} ${point.y}`;
          rings += ` A ${point.radius} ${point.radius} 0 0 1 ${point.x} ${top}`;
          rings += ` A ${point.radius} ${point.radius} 0 0 1 ${right} ${point.y}`;
          rings += ` A ${point.radius} ${point.radius} 0 0 1 ${point.x} ${bottom}`;
          rings += ` A ${point.radius} ${point.radius} 0 0 1 ${left} ${point.y}`;
          if (index === points.length - 1) {
            path += ` M ${right} ${point.y} L ${bounds.width} ${point.y}`;
            connectors += ` M ${right} ${point.y} L ${bounds.width} ${point.y}`;
          }
        });
        geometry.width = bounds.width;
        geometry.height = bounds.height;
        geometry.connectors = connectors;
        geometry.rings = rings;
        geometry.path = path;
      });
    };

    onMounted(() => {
      measure();
      observer = new ResizeObserver(measure);
      if (svg.value?.parentElement) observer.observe(svg.value.parentElement);
    });
    onBeforeUnmount(() => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    });

    return () => h('svg', {
      ref: svg,
      class: 'order-progress-flow',
      viewBox: `0 0 ${geometry.width || 1} ${geometry.height || 1}`,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
    }, geometry.path ? [
      h('path', { class: 'order-progress-flow-connectors', d: geometry.connectors }),
      h('path', { class: 'order-progress-flow-ring-back', d: geometry.rings }),
      h('path', { class: 'order-progress-flow-rings', d: geometry.rings }),
    ] : null);
  },
};

const OrderDetailPage = {
  props: {
    tradeNo: { type: String, required: true },
    method: { type: String, default: '' },
  },
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
      if (!local.ready) {
        return h('section', { class: 'order-detail-loading', 'aria-label': '正在加载订单详情' }, [
          h('div', { class: 'order-loading-back' }),
          h('div', { class: 'order-loading-grid' }, [h('div'), h('div')]),
        ]);
      }
      if (local.error && !local.order) {
        return h('section', { class: 'order-detail-error' }, [pageError(local.error), h('a', { class: 'secondary-button', href: '#/orders' }, '返回订单列表')]);
      }
      const order = local.order || {};
      const completed = Number(order.status) === 3;
      const isDigital = order.plan?.product_type === 'digital';
      const balanceAmount = Number(order.balance_amount || 0);
      const paidAmount = Math.max(0, Number(order.total_amount || 0) + balanceAmount);
      const discountAmount = Math.max(0, Number(order.discount_amount || 0));
      const paymentName = balanceAmount > 0
        ? (Number(order.total_amount || 0) > 0 && order.payment?.name ? `余额 + ${order.payment.name}` : '本地余额支付')
        : (order.payment?.name || '—');
      const productImage = order.plan?.product_config?.image_url || '';
      const selectedPackage = (order.plan?.product_config?.packages || []).find((item) => String(item.id) === String(order.period));
      const productDescription = selectedPackage?.description || order.plan?.content || '';
      const statusStep = Number(order.status) === 3 ? 4 : (Number(order.status) === 1 ? 3 : 1);
      const progressItems = [
        ['提交订单', order.created_at, 'submit'],
        ['支付成功', completed || Number(order.status) === 1 ? order.updated_at || order.created_at : null, 'payment'],
        ['处理完成', completed ? order.updated_at || order.created_at : null, 'process'],
        ['已完成', completed ? order.updated_at || order.created_at : null, 'complete'],
      ];
      const infoRow = (label, value, tone = '') => h('div', { class: ['order-info-row', tone ? `is-${tone}` : ''] }, [
        h('span', { style: tone === 'accent' ? { color: 'var(--muted)', fontWeight: '500' } : null }, label),
        h('strong', { class: tone ? `is-${tone}` : '' }, value),
      ]);
      return h('section', { class: 'order-detail-page' }, [
        pageError(local.error),
        h('header', { class: 'order-detail-title' }, [
          h('a', { href: '#/orders', 'aria-label': '返回订单列表' }, '←'),
          h('span', '返回列表'),
        ]),
        Number(order.status) === 0 ? h('div', { class: 'checkout-box', 'data-checkout': props.tradeNo }, [
          h('h3', '支付订单'),
          paymentMethods(local.methods || [], props.method || order.payment_id),
          h('div', { class: 'split-actions' }, [
            h('button', { class: 'primary-button', type: 'button', onClick: checkout }, '立即支付'),
            h('button', { class: 'secondary-button', type: 'button', onClick: cancelOrder }, '取消订单'),
          ]),
          local.paymentMessage ? h('div', { class: 'success-box' }, local.paymentMessage) : null,
          local.paymentHtml ? h('div', { class: 'payment-frame', innerHTML: local.paymentHtml }) : null,
        ]) : null,
        h('div', { class: 'order-detail-grid' }, [
          h('main', { class: 'order-detail-main' }, [
            h('section', { class: 'order-detail-card order-progress-card' }, [
              h('h3', '订单状态'),
              h('div', { class: ['order-progress', completed ? 'is-complete' : ''] }, [
                completed ? h(OrderProgressFlow) : null,
                ...progressItems.map((item, index) => h('div', { class: ['order-progress-item', index < statusStep ? 'is-done' : ''] }, [
                  h('div', { class: 'order-progress-mark' }, orderProgressIcon(item[2])),
                  h('strong', item[0]),
                  h('span', item[1] ? time(item[1]) : '等待处理'),
                ])),
              ]),
            ]),
            h('section', { class: 'order-detail-card order-product-section' }, [
              h('h3', '商品信息'),
              h('div', { class: 'order-product-line' }, [
                h('div', { class: ['order-product-thumb', productImage ? '' : 'is-placeholder'], style: productImage ? { backgroundImage: `url(${productImage})` } : null }, productImage ? null : (order.plan?.name || '商').slice(0, 1)),
                h('div', [h('strong', order.plan?.name || '订单商品'), h('span', selectedPackage?.name || '数量 1')]),
              ]),
              h('div', { class: 'order-product-description' }, [
                h('div', { class: 'order-product-specs' }, [
                  h('div', [h('span', '商品描述'), h('div', { class: 'order-product-spec-value', innerHTML: safeBody(productDescription || '—') })]),
                  h('div', [h('span', '商品规格'), h('strong', selectedPackage?.name || order.period || '默认规格')]),
                  h('div', [h('span', '数量'), h('strong', '1')]),
                  h('div', [h('span', '单价'), h('strong', money(completed ? paidAmount : order.total_amount, currencySymbol()))]),
                ]),
              ]),
            ]),
            (order.digital_delivery || []).length ? h('section', { class: 'order-detail-card order-delivery-card' }, [
              h('div', { class: 'order-delivery-heading' }, [
                h('div', [h('h3', '交付信息')]),
              ]),
              h('div', { class: 'order-delivery-list' }, (order.digital_delivery || []).map((item, index) => {
                const file = digitalDeliveryFile(item.content);
                const fields = digitalDeliveryFields(item.content);
                const simpleText = !file && fields.length === 1 && fields[0]?.label === '内容';
                return h('article', { class: ['order-delivery-content', simpleText ? 'is-simple' : ''] }, [
                  h('div', { class: 'order-delivery-copy' }, [
                    h('strong', file ? (file.name || `交付文件 ${index + 1}`) : (simpleText ? fields[0].value : ((order.digital_delivery || []).length > 1 ? `内容 ${index + 1}` : '交付内容'))),
                    file ? h('span', file.meta) : null,
                  ]),
                  file
                    ? h('a', { class: 'secondary-button order-delivery-action', href: file.url, target: '_blank', rel: 'noopener noreferrer', download: '' }, '↓ 下载')
                    : h('button', { class: 'order-delivery-action', type: 'button', onClick: () => copyText(item.content).then(() => toast('复制成功')) }, '⧉ 复制'),
                  file || simpleText ? null : h('div', { class: 'order-delivery-fields' }, fields.map((field) => h('div', [
                    h('span', field.label),
                    h('strong', field.value),
                    h('button', { type: 'button', title: `复制${field.label}`, onClick: () => copyText(field.value).then(() => toast(`${field.label}已复制`)) }, '⧉'),
                  ]))),
                ]);
              })),
            ]) : (completed && isDigital ? h('div', { class: 'success-box' }, '交付内容正在生成，请稍后刷新。') : null),
          ]),
          h('aside', { class: 'order-detail-aside' }, [
            h('section', { class: 'order-detail-card' }, [
              h('h3', '订单信息'),
              infoRow('商品名称', order.plan?.name || '订单商品'),
              infoRow('订单类型', isDigital ? '数字商品' : '订阅套餐'),
              infoRow('订单号', order.trade_no || props.tradeNo, 'mono'),
              infoRow('创建时间', time(order.created_at)),
              infoRow('商品金额', money(paidAmount + discountAmount, currencySymbol())),
              infoRow('优惠金额', discountAmount ? `-${money(discountAmount, currencySymbol())}` : money(0, currencySymbol()), discountAmount > 0 ? 'discount' : ''),
              infoRow('余额抵扣', balanceAmount > 0 ? `-${money(balanceAmount, currencySymbol())}` : money(0, currencySymbol())),
              infoRow('支付方式', paymentName),
              infoRow('实付金额', money(completed ? paidAmount : order.total_amount, currencySymbol()), 'accent'),
            ].filter(Boolean)),
          ]),
        ]),
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
  digital: DigitalProductsPage,
  'digital-detail': DigitalProductDetailPage,
  'digital-checkout': DigitalCheckoutPage,
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
