import { api, clearToken, getToken, isAuthenticated, setToken } from './api.js';
import {
  bytes,
  copyText,
  date,
  escapeHtml,
  money,
  normalizeCollection,
  percent,
  queryString,
  statusText,
  time,
} from './helpers.js';

const settings = window.settings || {};
const app = document.querySelector('#app');
const currencySymbol = () => state.comm?.currency_symbol || '¥';
const themeStorageKey = 'xboard-plus-theme';

const state = {
  guest: {},
  comm: {},
  user: null,
  subscribe: null,
  stat: [0, 0, 0],
  booted: false,
  bootPromise: null,
};

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

function storedTheme() {
  try {
    return localStorage.getItem(themeStorageKey) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = normalized;
  document.documentElement.style.colorScheme = normalized;
  try {
    localStorage.setItem(themeStorageKey, normalized);
  } catch {
    // Ignore storage errors in private browsing or locked-down webviews.
  }
}

applyTheme(storedTheme());

function route() {
  const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [name = 'dashboard', search = ''] = raw.split('?');
  return {
    name: name || 'dashboard',
    query: Object.fromEntries(new URLSearchParams(search)),
  };
}

function go(name, params = {}) {
  const search = queryString(params);
  location.hash = `#/${name}${search ? `?${search}` : ''}`;
}

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.textContent = message;
  $('.toast-stack')?.appendChild(item);
  setTimeout(() => item.classList.add('is-visible'), 20);
  setTimeout(() => {
    item.classList.remove('is-visible');
    setTimeout(() => item.remove(), 180);
  }, 2600);
}

function routeProgressElement() {
  let progress = document.querySelector('.route-progress');
  if (progress) return progress;

  progress = document.createElement('div');
  progress.className = 'route-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span></span>';
  document.body.appendChild(progress);
  return progress;
}

let routeProgressTimer = null;

function startRouteProgress() {
  const progress = routeProgressElement();
  clearTimeout(routeProgressTimer);
  progress.classList.remove('is-finishing');
  requestAnimationFrame(() => progress.classList.add('is-active'));
}

function finishRouteProgress() {
  const progress = routeProgressElement();
  progress.classList.add('is-finishing');
  routeProgressTimer = setTimeout(() => {
    progress.classList.remove('is-active', 'is-finishing');
  }, 220);
}

function emptyView(text = '暂无数据') {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

function formatTitle(title) {
  return escapeHtml(title).replaceAll('\n', '<br>');
}

function userInitial() {
  return escapeHtml(userDisplayName().slice(0, 1).toUpperCase());
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

function userAvatarMarkup(className = 'avatar-thumb') {
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(userAvatarUrl())}" alt="">`;
}

function appDescription() {
  return settings.description || state.guest?.app_description || state.comm?.app_description || '继续管理你的订阅、节点与余额。';
}

function themeLabel() {
  return currentTheme() === 'light' ? '暗黑' : '白天';
}

function navGroups() {
  return navItems.reduce((groups, item) => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
    return groups;
  }, {});
}

function routeMeta(name) {
  const item = navItems.find((nav) => nav.key === name);
  return {
    group: item?.group ?? '',
    label: item?.label || '仪表盘',
  };
}

async function boot(force = false) {
  if (state.bootPromise && !force) return state.bootPromise;

  state.bootPromise = (async () => {
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

  return state.bootPromise;
}

async function refreshUser() {
  state.user = await api.get('/user/info');
  state.subscribe = await api.get('/user/getSubscribe');
  state.stat = await api.get('/user/getStat').catch(() => state.stat);
}

function currentTitle(name) {
  return navItems.find((item) => item.key === name)?.label || '仪表盘';
}

function appAsset(file) {
  const base = settings.assets_path || '/theme/Xboard/assets';
  return `${base.replace(/\/$/, '')}/app/${file.replace(/^\//, '')}`;
}

function logoMarkup() {
  return `<img class="brand-logo" src="${escapeHtml(appAsset('icons/XboardPlus_logo.png'))}" alt="">`;
}

function navIconMarkup(item) {
  if (/\.(webp|png|jpe?g|svg)$/i.test(item.icon)) {
    return `<span class="nav-icon-image" style="--icon-url: url('${escapeHtml(appAsset(`icons/${item.icon}`))}')" aria-hidden="true"></span>`;
  }
  return `<i class="nav-icon ${escapeHtml(item.icon)}"></i>`;
}

function shell(content, title, subtitle, meta = {}) {
  const active = route().name;
  const appName = settings.title || 'Xboard Plus';
  const user = state.user;
  const currentMeta = routeMeta(active);
  const status = meta.status || '账户状态：已连接';
  const crumbGroup = meta.crumbGroup ?? currentMeta.group;
  const userEmail = user?.email || '当前账号';
  const userName = userDisplayName(user);
  const stats = meta.stats || [
    { label: '余额', value: money(user?.balance, currencySymbol()) },
    { label: '套餐', value: state.subscribe?.plan?.name || '未订阅' },
    { label: '工单', value: String(state.stat?.[0] ?? 0) },
  ];
  const groups = navGroups();
  const showSummary = !meta.hideSummary;
  const showHero = !meta.hideHero;

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="#/dashboard" aria-label="${escapeHtml(appName)}">
          ${logoMarkup()}
          <span><b>${escapeHtml(appName)}</b></span>
        </a>
        <nav class="nav">
          ${Object.entries(groups).map(([group, items]) => `
            <div class="nav-group">
              ${group ? `<span>${escapeHtml(group)}</span>` : ''}
              ${items.map((item) => `
                <a class="nav-item ${active === item.key ? 'active' : ''}" href="#/${item.key}">
                  ${navIconMarkup(item)}
                  <span class="nav-label">${escapeHtml(item.label)}</span>
                  ${item.key === 'tickets' && Number(state.stat?.[0] || 0) > 0 ? `<em>${escapeHtml(state.stat[0])}</em>` : ''}
                </a>
              `).join('')}
            </div>
          `).join('')}
        </nav>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <button class="icon-button mobile-menu" data-toggle-menu type="button">☰</button>
          <div class="breadcrumb">
            <button class="sidebar-toggle-button" data-toggle-sidebar type="button" aria-label="展开或收起菜单">
              <span class="collapse-icon collapse-icon-collapse" style="--icon-url: url('${escapeHtml(appAsset('icons/Collapse.webp'))}')" aria-hidden="true"></span>
              <span class="collapse-icon collapse-icon-expand" style="--icon-url: url('${escapeHtml(appAsset('icons/Expand.webp'))}')" aria-hidden="true"></span>
            </button>
            ${crumbGroup ? `<span>${escapeHtml(crumbGroup)}</span><b>/</b>` : ''}
            <strong>${escapeHtml(meta.crumbTitle || currentMeta.label)}</strong>
          </div>
          <div class="top-actions">
            <button class="theme-toggle" data-toggle-theme type="button" aria-label="切换白天和暗黑模式" title="切换白天和暗黑模式">
              <span class="theme-icon" aria-hidden="true"></span>
              <span class="theme-label">${escapeHtml(themeLabel())}</span>
            </button>
            <span class="round-chip">CN</span>
            <div class="user-menu">
              <button class="avatar-chip" data-toggle-user-menu type="button" aria-haspopup="menu" aria-expanded="false">${userAvatarMarkup()}</button>
              <div class="user-dropdown" role="menu">
                <div class="user-dropdown-head">
                  <strong>${escapeHtml(userName)}</strong>
                  <span>${escapeHtml(userEmail)}</span>
                </div>
                <a href="#/profile" role="menuitem">账号设置</a>
                <button data-logout type="button" role="menuitem">退出登录</button>
              </div>
            </div>
          </div>
        </header>
        <section class="content">
          ${showSummary ? `<div class="status-strip">
            ${stats.map((item) => `<span>${escapeHtml(item.label)} <b>${escapeHtml(item.value)}</b></span>`).join('')}
          </div>` : ''}
          ${showHero ? `<section class="page-hero">
            <p><i></i>${escapeHtml(status)}</p>
            <h1>${formatTitle(title)}</h1>
            ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}
          </section>` : ''}
          ${content}
        </section>
      </main>
    </div>
    <div class="toast-stack"></div>
  `;
}

function authShell(content) {
  const appName = settings.title || 'Xboard Plus';
  return `
    <main class="auth-page">
      <section class="auth-shell">
        <div class="auth-visual">
          <a class="brand" href="#/login" aria-label="${escapeHtml(appName)}">
            ${logoMarkup()}
            <span><b>${escapeHtml(appName)}</b><small>${escapeHtml(appDescription())}</small></span>
          </a>
          <section class="page-hero">
            <p><i></i>安全登录</p>
            <h1>欢迎<br>回来</h1>
            <small>${escapeHtml(appDescription())}</small>
          </section>
          <article class="glass-card preview-card accent-orange">
            <div class="card-title-row">
              <span class="service-icon">∞</span>
              <div><small>当前套餐</small><h2>Pro Stream</h2></div>
            </div>
            <p>本周期已用流量</p>
            <strong>128.4 GB</strong>
            <span class="trend-pill up">↗ +26%</span>
            <svg viewBox="0 0 420 150" aria-hidden="true"><path d="M0 136 L55 62 L105 56 L155 58 L198 24 L238 130 L282 88 L326 96 L365 34 L420 74" /></svg>
          </article>
        </div>
        <div class="auth-card">
          <div class="auth-brand">
            <h1>登录账户</h1>
            <p>继续管理你的订阅、节点与余额。</p>
          </div>
          ${content}
        </div>
      </section>
    </main>
    <div class="toast-stack"></div>
  `;
}

function usageSummary(subscribe = {}) {
  const used = Number(subscribe.u || 0) + Number(subscribe.d || 0);
  const total = Number(subscribe.transfer_enable || 0);
  const ratio = percent(used, total);
  return { used, total, ratio };
}

function statCards(cards) {
  return `<div class="metric-grid">${cards.map((card) => `
    <article class="metric-card">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      ${card.hint ? `<small>${escapeHtml(card.hint)}</small>` : ''}
    </article>
  `).join('')}</div>`;
}

function table(headers, rows, empty = '暂无数据') {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead>
        <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}">${emptyView(empty)}</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function safeBody(html) {
  return String(html || '');
}

function paymentMethods(methods = [], selected = '') {
  if (!methods.length) return emptyView('暂无可用支付方式');
  return `
    <div class="payment-methods">
      ${methods.map((method, index) => `
        <label class="payment-method">
          <input type="radio" name="method" value="${method.id}" ${String(selected || methods[0]?.id) === String(method.id) || (!selected && index === 0) ? 'checked' : ''}>
          ${method.icon ? `<img src="${escapeHtml(method.icon)}" alt="">` : '<span class="pay-icon">¥</span>'}
          <span>${escapeHtml(method.name || method.payment || `支付方式 ${method.id}`)}</span>
        </label>
      `).join('')}
    </div>
  `;
}

function handlePaymentResult(result, kind, tradeNo) {
  const box = $('#payment-result');
  if (!box) return;

  if (result?.type === 1 && typeof result.data === 'string') {
    window.location.href = result.data;
    return;
  }

  if (result?.type === -1 || result?.data === true) {
    box.innerHTML = `<div class="success-box">支付已完成，正在刷新状态...</div>`;
    startPaymentPoll(kind, tradeNo);
    return;
  }

  if (typeof result?.data === 'string') {
    box.innerHTML = `<div class="payment-frame">${result.data}</div>`;
    startPaymentPoll(kind, tradeNo);
    return;
  }

  box.innerHTML = `<pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
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
        render();
      }
      if (times >= 60) clearInterval(timer);
    } catch (_) {
      if (times >= 10) clearInterval(timer);
    }
  }, 3000);
}

async function loginView(params) {
  return authShell(`
    <form class="stack auth-form" data-login-form>
      <label>邮箱<input name="email" type="email" autocomplete="email" required></label>
      <label>密码<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
      <button class="primary-button" type="submit">登录</button>
      <div class="auth-links">
        <a href="#/register">注册账号</a>
        <a href="#/forgot">忘记密码</a>
      </div>
    </form>
  `);
}

async function registerView() {
  const inviteCode = route().query.invite_code || '';
  const showCode = Number(state.guest.is_email_verify) === 1;
  const forceInvite = Number(state.guest.is_invite_force) === 1 || inviteCode;
  return authShell(`
    <form class="stack auth-form" data-register-form>
      <label>邮箱<input name="email" type="email" autocomplete="email" required></label>
      <label>密码<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
      ${showCode ? `
        <label>邮箱验证码
          <span class="inline-field">
            <input name="email_code" inputmode="numeric" maxlength="6" required>
            <button class="secondary-button" data-send-code type="button">发送</button>
          </span>
        </label>
      ` : ''}
      ${forceInvite ? `<label>邀请码<input name="invite_code" value="${escapeHtml(inviteCode)}" ${Number(state.guest.is_invite_force) === 1 ? 'required' : ''}></label>` : ''}
      <button class="primary-button" type="submit">创建账号</button>
      <div class="auth-links">
        <a href="#/login">已有账号登录</a>
      </div>
    </form>
  `);
}

async function forgotView() {
  return authShell(`
    <form class="stack auth-form" data-forgot-form>
      <label>邮箱
        <span class="inline-field">
          <input name="email" type="email" autocomplete="email" required>
          <button class="secondary-button" data-send-code type="button">发送</button>
        </span>
      </label>
      <label>邮箱验证码<input name="email_code" inputmode="numeric" maxlength="6" required></label>
      <label>新密码<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
      <button class="primary-button" type="submit">重置密码</button>
      <div class="auth-links">
        <a href="#/login">返回登录</a>
      </div>
    </form>
  `);
}

async function dashboardView() {
  const user = state.user || {};
  const subscribe = state.subscribe || {};
  const usage = usageSummary(subscribe);
  const notices = await api.get('/user/notice/fetch', { current: 1 }).catch(() => ({ data: [] }));
  const servers = await api.get('/user/server/fetch').catch(() => ({ data: [] }));
  const serverList = normalizeCollection(servers.data || servers);
  const onlineCount = serverList.filter((node) => node.is_online).length;
  const planName = subscribe.plan?.name || '未订阅套餐';
  const serverRows = serverList.slice(0, 5).map((node, index) => `
    <tr>
      <td>#${index + 1}</td>
      <td><i class="node-dot dot-${index % 3}"></i>${escapeHtml(node.name || '-')}</td>
      <td>${escapeHtml(node.type || '-')}</td>
      <td>${node.is_online ? escapeHtml(node.last_check_at ? '良好' : '-') : '-'}</td>
      <td>${node.is_online ? '<span class="badge ok">在线</span>' : '<span class="badge danger">维护</span>'}</td>
    </tr>
  `);

  return shell(`
    <section class="cards-row">
      <article class="glass-card chart-card accent-orange">
        <div class="card-title-row">
          <span class="service-icon">∞</span>
          <div><small>当前套餐</small><h2>${escapeHtml(planName)}</h2></div>
          <a class="mini-button" href="#/subscribe">查看</a>
        </div>
        <p>本周期已用流量</p>
        <strong>${bytes(usage.used)}</strong>
        <span class="trend-pill up">↗ ${usage.ratio}%</span>
        <svg viewBox="0 0 420 150" aria-hidden="true"><path d="M0 136 L55 62 L105 56 L155 58 L198 24 L238 130 L282 88 L326 96 L365 34 L420 74" /><circle cx="326" cy="96" r="7"/><circle cx="365" cy="34" r="7"/></svg>
      </article>
      <article class="glass-card chart-card accent-purple">
        <div class="card-title-row">
          <span class="service-icon diamond">◆</span>
          <div><small>可用节点</small><h2>全球节点池</h2></div>
          <a class="mini-button" href="#/nodes">全部</a>
        </div>
        <p>当前可连接节点</p>
        <strong>${serverList.length ? onlineCount : 0}</strong>
        <span class="trend-pill warn">↘ ${Math.max(serverList.length - onlineCount, 0)} 个维护中</span>
        <svg viewBox="0 0 420 150" aria-hidden="true"><path d="M0 110 L50 88 L95 116 L136 52 L180 92 L224 64 L272 120 L326 72 L372 82 L420 34" /><circle cx="136" cy="52" r="7"/><circle cx="326" cy="72" r="7"/></svg>
      </article>
    </section>

    <section class="panel wide-panel">
      <div class="section-title">
        <p>实时更新</p>
        <h2>节点概览</h2>
        <a class="mini-button" href="#/nodes">全部</a>
      </div>
      ${table(['序号', '节点名称', '协议', '延迟', '状态'], serverRows, '暂无可用节点')}
    </section>

    <section class="panel">
      <div class="section-title">
        <p>站点通知</p>
        <h2>公告</h2>
        <a class="mini-button" href="#/knowledge">知识库</a>
      </div>
      <div class="notice-list">
        ${normalizeCollection(notices.data || notices).slice(0, 4).map((notice) => `
          <article class="notice-item">
            <h3>${escapeHtml(notice.title || '公告')}</h3>
            <div>${safeBody(notice.content || notice.body || '')}</div>
          </article>
        `).join('') || emptyView('暂无公告')}
      </div>
    </section>
  `, '节点与订阅\n实时概览', '查看订阅状态、账户余额、节点可用性与近期通知。', {
    status: '已同步：2 分钟前',
    stats: [
      { label: '余额', value: money(user.balance, currencySymbol()) },
      { label: '套餐', value: planName },
      { label: '节点', value: `${serverList.length ? onlineCount : 0} 在线` },
      { label: '用量', value: `${usage.ratio}%` },
    ],
    crumbGroup: '',
    crumbTitle: '仪表盘',
    hideSummary: true,
    hideHero: true,
  });
}

async function subscribeView() {
  const subscribe = await api.get('/user/getSubscribe');
  state.subscribe = subscribe;
  const servers = await api.get('/user/server/fetch').catch(() => ({ data: [] }));
  const serverList = normalizeCollection(servers.data || servers);
  const usage = usageSummary(subscribe);
  const serverRows = serverList.map((node, index) => `
    <tr>
      <td>#${index + 1}</td>
      <td><i class="node-dot dot-${index % 3}"></i>${escapeHtml(node.name)}</td>
      <td>${escapeHtml(node.type)}</td>
      <td>${escapeHtml(node.rate ?? '-')}</td>
      <td>${node.is_online ? '<span class="badge ok">在线</span>' : '<span class="badge danger">维护</span>'}</td>
    </tr>
  `);

  return shell(`
    <section class="subscription-grid">
      <article class="panel access-card">
        <div class="section-title">
          <p>订阅地址</p>
          <h2>${escapeHtml(subscribe.plan?.name || '未订阅套餐')}</h2>
          <button class="mini-button" data-copy="${escapeHtml(subscribe.subscribe_url || '')}" type="button">复制</button>
        </div>
        <div class="url-box">${escapeHtml(subscribe.subscribe_url || '暂无订阅链接')}</div>
        <div class="quota-block">
          <strong>${usage.total ? bytes(Math.max(usage.total - usage.used, 0)) : '不限量'}</strong>
          <span>剩余流量 / 总计 ${usage.total ? bytes(usage.total) : '不限量'}</span>
          <div class="progress"><span style="width:${usage.ratio}%"></span></div>
        </div>
        <div class="split-actions">
          <button class="secondary-button" data-reset-security type="button">重置订阅</button>
          <a class="primary-button" href="#/plans">续费套餐</a>
        </div>
      </article>
      <article class="panel side-card">
        <h3>一键导入</h3>
        <button class="secondary-button" data-copy="${escapeHtml(subscribe.subscribe_url || '')}" type="button">Shadowrocket</button>
        <button class="secondary-button" data-copy="${escapeHtml(subscribe.subscribe_url || '')}" type="button">Clash Verge</button>
        <button class="secondary-button" data-copy="${escapeHtml(subscribe.subscribe_url || '')}" type="button">Stash</button>
        <button class="secondary-button" data-copy="${escapeHtml(subscribe.subscribe_url || '')}" type="button">V2rayN</button>
      </article>
      <article class="panel side-card">
        <h3>节点状态</h3>
        <div class="node-map">
          ${Array.from({ length: 12 }).map((_, index) => `<i class="${index >= serverList.length ? 'off' : (serverList[index]?.is_online ? '' : 'warn')}"></i>`).join('')}
        </div>
      </article>
    </section>

    <section class="panel wide-panel">
      <div class="section-title">
        <p>实时列表</p>
        <h2>可用节点</h2>
        <a class="mini-button" href="#/nodes">筛选</a>
      </div>
      ${table(['序号', '节点名称', '协议', '倍率', '状态'], serverRows, '暂无可用节点')}
    </section>
  `, '订阅链接\n与节点访问', '复制订阅链接，并查看当前套餐可用节点。', {
    status: '安全状态：已保护',
    stats: [
      { label: 'UUID', value: subscribe.uuid ? '已同步' : '已同步' },
      { label: '设备', value: `${subscribe.device_limit ?? '不限'}` },
      { label: '重置', value: subscribe.reset_day ?? '-' },
      { label: '倍率', value: '自动' },
    ],
    crumbGroup: '订阅',
    crumbTitle: '访问',
  });
}

function periodOptions(plan) {
  return periods
    .filter(([key]) => plan[key] !== null && plan[key] !== undefined)
    .map(([key, label]) => `<option value="${key}">${label} ${money(plan[key], currencySymbol())}</option>`)
    .join('');
}

async function plansView() {
  const plans = normalizeCollection(await api.get('/user/plan/fetch'));
  return shell(`
    <div class="plan-grid">
      ${plans.map((plan, index) => `
        <article class="plan-card ${index === 1 ? 'hot' : ''}" data-plan-card="${plan.id}">
          <small>${index === 1 ? 'Popular' : (index === 0 ? 'Starter' : 'Plan')}</small>
          <div class="plan-head">
            <h2>${escapeHtml(plan.name)}</h2>
            <span>${plan.transfer_enable ? bytes(Number(plan.transfer_enable) * 1024 * 1024 * 1024) : '不限流量'}</span>
          </div>
          <div class="plan-content">${safeBody(plan.content)}</div>
          <div class="plan-meta">
            <span>速度 ${plan.speed_limit || '不限'}</span>
            <span>设备 ${plan.device_limit || '不限'}</span>
          </div>
          <label>周期<select name="period">${periodOptions(plan)}</select></label>
          <label>优惠码<input name="coupon_code" placeholder="可选"></label>
          <button class="primary-button" data-buy-plan="${plan.id}" type="button">选择套餐</button>
        </article>
      `).join('') || emptyView('暂无可购买套餐')}
    </div>
  `, '套餐购买\n与续费', '选择套餐周期，创建订单后完成支付。', {
    status: '支付网关：可用',
    stats: [
      { label: '余额', value: money(state.user?.balance, currencySymbol()) },
      { label: '套餐数', value: String(plans.length) },
      { label: '优惠券', value: '可用' },
    ],
    crumbGroup: '财务',
    crumbTitle: '套餐',
  });
}

async function ordersView(params) {
  const tradeNo = params.query.trade_no;
  if (tradeNo) return orderDetailView(tradeNo);

  const orders = normalizeCollection(await api.get('/user/order/fetch'));
  const rows = orders.map((order) => `
    <tr>
      <td><a href="#/orders?trade_no=${encodeURIComponent(order.trade_no)}">${escapeHtml(order.trade_no)}</a></td>
      <td>${escapeHtml(order.plan?.name || '-')}</td>
      <td>${escapeHtml(statusText(order.status, orderStatus))}</td>
      <td>${money(order.total_amount, currencySymbol())}</td>
      <td>${time(order.created_at)}</td>
    </tr>
  `);

  return shell(`
    <section class="panel">
      ${table(['订单号', '套餐', '状态', '金额', '创建时间'], rows, '暂无订单')}
    </section>
  `, '订单', '查看套餐订单、继续支付或取消待支付订单。');
}

async function orderDetailView(tradeNo) {
  const order = await api.get('/user/order/detail', { trade_no: tradeNo });
  const methods = Number(order.status) === 0 && Number(order.total_amount) > 0
    ? await api.get('/user/order/getPaymentMethod').catch(() => [])
    : [];

  return shell(`
    <section class="panel detail-panel">
      <div class="panel-heading">
        <div>
          <h2>订单 ${escapeHtml(order.trade_no)}</h2>
          <p>${escapeHtml(order.plan?.name || '-')} · ${escapeHtml(statusText(order.status, orderStatus))}</p>
        </div>
        <a class="secondary-button" href="#/orders">返回列表</a>
      </div>
      ${statCards([
        { label: '订单金额', value: money(order.total_amount, currencySymbol()) },
        { label: '手续费', value: money(order.handling_amount, currencySymbol()) },
        { label: '余额抵扣', value: money(order.balance_amount, currencySymbol()) },
        { label: '创建时间', value: time(order.created_at) },
      ])}
      ${Number(order.status) === 0 ? `
        <div class="checkout-box" data-order-checkout="${escapeHtml(order.trade_no)}">
          <h3>支付订单</h3>
          ${paymentMethods(methods, order.payment_id)}
          <div class="split-actions">
            <button class="primary-button" data-checkout-order type="button">立即支付</button>
            <button class="secondary-button" data-cancel-order="${escapeHtml(order.trade_no)}" type="button">取消订单</button>
          </div>
          <div id="payment-result"></div>
        </div>
      ` : ''}
    </section>
  `, '订单详情', '查看订单明细并完成支付。');
}

async function rechargeView(params) {
  const tradeNo = params.query.trade_no;
  if (tradeNo) return rechargeDetailView(tradeNo);

  const records = normalizeCollection(await api.get('/user/recharge/fetch').catch(() => []));
  const rows = records.map((item) => `
    <tr>
      <td><a href="#/recharge?trade_no=${encodeURIComponent(item.trade_no)}">${escapeHtml(item.trade_no)}</a></td>
      <td>${money(item.amount, currencySymbol())}</td>
      <td>${escapeHtml(item.status_text || statusText(item.status, orderStatus))}</td>
      <td>${escapeHtml(item.payment?.name || '-')}</td>
      <td>${time(item.created_at)}</td>
    </tr>
  `);

  return shell(`
    <section class="billing-layout">
      <article class="panel wallet-panel">
        <div class="section-title">
          <p>Wallet</p>
          <h2>余额充值</h2>
        </div>
        <div class="amount-display">${money(state.user?.balance, currencySymbol())}</div>
        <form class="wallet-form" data-recharge-form>
          <label>充值金额<input name="amount" type="number" min="0.01" step="0.01" placeholder="100.00" required></label>
          <button class="primary-button" type="submit">立即充值</button>
        </form>
      </article>

      <article class="panel wallet-note">
        <h3>充值说明</h3>
        <p>充值成功后余额会自动入账，可用于购买套餐、续费或抵扣订单。</p>
        <div class="info-grid">
          <span>自动入账</span>
          <span>订单可追踪</span>
          <span>余额可抵扣</span>
        </div>
      </article>
    </section>

    <section class="panel wide-panel">
      <div class="section-title">
        <p>交易记录</p>
        <h2>充值记录</h2>
        <a class="mini-button" href="#/orders">订单</a>
      </div>
      ${table(['充值单号', '金额', '状态', '支付方式', '创建时间'], rows, '暂无充值记录')}
    </section>
  `, '余额充值\n与记录', '为账户余额充值，用于购买套餐或续费。', {
    status: '支付网关：可用',
    stats: [
      { label: '余额', value: money(state.user?.balance, currencySymbol()) },
      { label: '充值单', value: String(records.length) },
      { label: '优惠券', value: '可用' },
    ],
    crumbGroup: '财务',
    crumbTitle: '充值',
  });
}

async function rechargeDetailView(tradeNo) {
  const recharge = await api.get('/user/recharge/detail', { trade_no: tradeNo });
  const methods = Number(recharge.status) === 0
    ? await api.get('/user/recharge/getPaymentMethod').catch(() => [])
    : [];

  return shell(`
    <section class="panel detail-panel">
      <div class="panel-heading">
        <div>
          <h2>充值单 ${escapeHtml(recharge.trade_no)}</h2>
          <p>${escapeHtml(recharge.status_text || statusText(recharge.status, orderStatus))}</p>
        </div>
        <a class="secondary-button" href="#/recharge">返回列表</a>
      </div>
      ${statCards([
        { label: '充值金额', value: money(recharge.amount, currencySymbol()) },
        { label: '手续费', value: money(recharge.handling_amount, currencySymbol()) },
        { label: '支付方式', value: recharge.payment?.name || '-' },
        { label: '创建时间', value: time(recharge.created_at) },
      ])}
      ${Number(recharge.status) === 0 ? `
        <div class="checkout-box" data-recharge-checkout="${escapeHtml(recharge.trade_no)}">
          <h3>支付充值单</h3>
          ${paymentMethods(methods, recharge.payment_id)}
          <div class="split-actions">
            <button class="primary-button" data-checkout-recharge type="button">立即支付</button>
            <button class="secondary-button" data-cancel-recharge="${escapeHtml(recharge.trade_no)}" type="button">取消充值</button>
          </div>
          <div id="payment-result"></div>
        </div>
      ` : ''}
    </section>
  `, '充值详情', '查看充值记录并完成支付。');
}

async function profileView() {
  const user = state.user || {};
  const giftHistory = await api.get('/user/gift-card/history', { per_page: 8 }).catch(() => ({ data: [] }));
  const rows = normalizeCollection(giftHistory.data || giftHistory).map((item) => `
    <tr>
      <td>${escapeHtml(item.code || '-')}</td>
      <td>${escapeHtml(item.template_name || '-')}</td>
      <td>${time(item.created_at)}</td>
    </tr>
  `);

  return shell(`
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>账户信息</h2>
          <p>${escapeHtml(user.email)}</p>
        </div>
      </div>
      <form class="profile-editor" data-identity-form>
        <div class="profile-avatar-block">
          <img class="profile-avatar" data-avatar-preview src="${escapeHtml(userAvatarUrl(user))}" alt="">
          <label class="avatar-upload-button">
            上传头像
            <input data-avatar-input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
          </label>
          <small>支持 JPG、PNG、WebP、GIF，最大 2MB。</small>
        </div>
        <div class="profile-fields">
          <label>昵称<input name="name" maxlength="64" value="${escapeHtml(user.name || '')}" placeholder="${escapeHtml(userDisplayName(user))}"></label>
          <p>昵称会显示在侧边栏欢迎语和右上角账户菜单中。</p>
          <button class="primary-button" type="submit">保存资料</button>
        </div>
      </form>
      ${statCards([
        { label: '余额', value: money(user.balance, currencySymbol()) },
        { label: '佣金余额', value: money(user.commission_balance, currencySymbol()) },
        { label: '注册时间', value: date(user.created_at) },
        { label: 'UUID', value: user.uuid || '-' },
      ])}
    </section>

    <section class="two-column">
      <form class="panel stack" data-profile-form>
        <h2>提醒设置</h2>
        <label class="check-line"><input name="remind_expire" type="checkbox" ${Number(user.remind_expire) ? 'checked' : ''}> 套餐到期提醒</label>
        <label class="check-line"><input name="remind_traffic" type="checkbox" ${Number(user.remind_traffic) ? 'checked' : ''}> 流量耗尽提醒</label>
        <button class="primary-button" type="submit">保存设置</button>
      </form>

      <form class="panel stack" data-transfer-form>
        <h2>佣金划转</h2>
        <label>划转金额<input name="amount" type="number" min="0.01" step="0.01" placeholder="10.00"></label>
        <button class="primary-button" type="submit">转入余额</button>
      </form>
    </section>

    <section class="two-column">
      <form class="panel stack" data-password-form>
        <h2>修改密码</h2>
        <label>旧密码<input name="old_password" type="password" autocomplete="current-password" required></label>
        <label>新密码<input name="new_password" type="password" autocomplete="new-password" minlength="8" required></label>
        <button class="primary-button" type="submit">更新密码</button>
      </form>

      <form class="panel stack" data-gift-card-form>
        <h2>礼品卡兑换</h2>
        <label>兑换码<input name="code" placeholder="输入兑换码"></label>
        <button class="primary-button" type="submit">立即兑换</button>
      </form>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><h2>兑换记录</h2><p>最近兑换的礼品卡。</p></div></div>
      ${table(['兑换码', '名称', '兑换时间'], rows, '暂无兑换记录')}
    </section>
  `, '账户', '管理个人资料、安全设置与余额。');
}

async function nodesView() {
  const servers = await api.get('/user/server/fetch').catch(() => ({ data: [] }));
  const rows = normalizeCollection(servers.data || servers).map((node) => `
    <tr>
      <td>${escapeHtml(node.name)}</td>
      <td>${escapeHtml(node.type)}</td>
      <td>${node.is_online ? '<span class="badge ok">在线</span>' : '<span class="badge muted">离线</span>'}</td>
      <td>${escapeHtml(node.rate ?? '-')}</td>
      <td>${escapeHtml(Array.isArray(node.tags) ? node.tags.join(', ') : (node.tags || '-'))}</td>
      <td>${time(node.last_check_at)}</td>
    </tr>
  `);

  return shell(`
    <section class="panel">
      ${table(['节点', '协议', '状态', '倍率', '标签', '检测时间'], rows, '暂无可用节点')}
    </section>
  `, '节点', '查看当前套餐可访问节点及在线状态。');
}

async function trafficView() {
  const logs = normalizeCollection(await api.get('/user/stat/getTrafficLog'));
  const rows = logs.map((item) => `
    <tr>
      <td>${date(item.record_at)}</td>
      <td>${bytes(item.u)}</td>
      <td>${bytes(item.d)}</td>
      <td>${bytes(Number(item.u || 0) + Number(item.d || 0))}</td>
      <td>${escapeHtml(item.server_rate ?? '-')}</td>
    </tr>
  `);

  return shell(`
    <section class="panel">
      ${table(['日期', '上传', '下载', '总计', '倍率'], rows, '暂无流量记录')}
    </section>
  `, '流量', '查看本月订阅流量使用记录。');
}

async function ticketsView(params) {
  const id = params.query.id;
  if (id) return ticketDetailView(id);

  const tickets = normalizeCollection(await api.get('/user/ticket/fetch'));
  const rows = tickets.map((ticket) => `
    <tr>
      <td><a href="#/tickets?id=${ticket.id}">${escapeHtml(ticket.subject)}</a></td>
      <td>${escapeHtml(ticketLevel[ticket.level] || '-')}</td>
      <td>${escapeHtml(statusText(ticket.status, ticketStatus))}</td>
      <td>${time(ticket.updated_at || ticket.created_at)}</td>
    </tr>
  `);

  return shell(`
    <section class="panel">
      <form class="stack" data-ticket-form>
        <h2>新建工单</h2>
        <label>标题<input name="subject" required></label>
        <label>等级<select name="level"><option value="0">低</option><option value="1">中</option><option value="2">高</option></select></label>
        <label>内容<textarea name="message" rows="5" required></textarea></label>
        <button class="primary-button" type="submit">提交工单</button>
      </form>
    </section>
    <section class="panel">
      ${table(['标题', '等级', '状态', '更新时间'], rows, '暂无工单')}
    </section>
  `, '工单', '提交问题并查看处理进度。');
}

async function ticketDetailView(id) {
  const ticket = await api.get('/user/ticket/fetch', { id });
  const messages = normalizeCollection(ticket.message || []);
  return shell(`
    <section class="panel detail-panel">
      <div class="panel-heading">
        <div>
          <h2>${escapeHtml(ticket.subject)}</h2>
          <p>${escapeHtml(statusText(ticket.status, ticketStatus))}</p>
        </div>
        <a class="secondary-button" href="#/tickets">返回列表</a>
      </div>
      <div class="message-list">
        ${messages.map((message) => `
          <article class="message-item ${message.is_me ? 'is-me' : ''}">
            <div>${safeBody(message.message || '')}</div>
            <time>${time(message.created_at)}</time>
          </article>
        `).join('') || emptyView('暂无回复')}
      </div>
      ${Number(ticket.status) === 0 ? `
        <form class="stack" data-ticket-reply="${ticket.id}">
          <label>回复内容<textarea name="message" rows="4" required></textarea></label>
          <div class="split-actions">
            <button class="primary-button" type="submit">发送回复</button>
            <button class="secondary-button" data-close-ticket="${ticket.id}" type="button">关闭工单</button>
          </div>
        </form>
      ` : ''}
    </section>
  `, '工单详情', '查看沟通记录并继续回复。');
}

async function inviteView() {
  const invite = await api.get('/user/invite/fetch');
  const details = await api.get('/user/invite/details', { current: 1, page_size: 10 }).catch(() => ({ data: [] }));
  const codes = normalizeCollection(invite.codes || []);
  const codeRows = codes.map((item) => {
    const url = `${location.origin}/#/register?invite_code=${encodeURIComponent(item.code)}`;
    return `
      <tr>
        <td>${escapeHtml(item.code)}</td>
        <td>${escapeHtml(item.pv ?? 0)}</td>
        <td>${time(item.created_at)}</td>
        <td><button class="link-button" data-copy="${escapeHtml(url)}" type="button">复制链接</button></td>
      </tr>
    `;
  });
  const detailRows = normalizeCollection(details.data || details).map((item) => `
    <tr>
      <td>${escapeHtml(item.trade_no)}</td>
      <td>${money(item.order_amount, currencySymbol())}</td>
      <td>${money(item.get_amount, currencySymbol())}</td>
      <td>${time(item.created_at)}</td>
    </tr>
  `);

  return shell(`
    ${statCards([
      { label: '注册用户', value: invite.stat?.[0] ?? 0 },
      { label: '累计佣金', value: money(invite.stat?.[1], currencySymbol()) },
      { label: '确认中', value: money(invite.stat?.[2], currencySymbol()) },
      { label: '佣金比例', value: `${invite.stat?.[3] ?? 0}%` },
    ])}
    <section class="panel">
      <div class="panel-heading">
        <div><h2>邀请码</h2><p>生成并分享邀请码。</p></div>
        <button class="primary-button" data-create-invite type="button">生成邀请码</button>
      </div>
      ${table(['邀请码', '访问量', '创建时间', '操作'], codeRows, '暂无邀请码')}
    </section>
    <section class="panel">
      <div class="panel-heading"><div><h2>佣金明细</h2><p>邀请订单产生的佣金。</p></div></div>
      ${table(['订单号', '订单金额', '获得佣金', '时间'], detailRows, '暂无佣金明细')}
    </section>
  `, '邀请', '管理邀请码和返佣记录。');
}

async function knowledgeView(params) {
  if (params.query.id) {
    const article = await api.get('/user/knowledge/fetch', { id: params.query.id, language: 'zh-CN' });
    return shell(`
      <section class="panel article-panel">
        <div class="panel-heading">
          <div>
            <h2>${escapeHtml(article.title)}</h2>
            <p>${time(article.updated_at)}</p>
          </div>
          <a class="secondary-button" href="#/knowledge">返回列表</a>
        </div>
        <article class="article-body">${safeBody(article.body || '')}</article>
      </section>
    `, '知识库', '阅读使用教程与常见问题。');
  }

  const grouped = await api.get('/user/knowledge/fetch', { language: 'zh-CN' }).catch(() => ({}));
  const sections = Object.entries(grouped || {}).map(([category, articles]) => `
    <section class="panel">
      <div class="panel-heading"><div><h2>${escapeHtml(category || '默认分类')}</h2></div></div>
      <div class="article-list">
        ${normalizeCollection(articles).map((article) => `
          <a class="article-link" href="#/knowledge?id=${article.id}">
            <strong>${escapeHtml(article.title)}</strong>
            <span>${time(article.updated_at)}</span>
          </a>
        `).join('') || emptyView('暂无文章')}
      </div>
    </section>
  `);

  return shell(sections.join('') || emptyView('暂无知识库文章'), '知识库', '查看订阅使用教程和常见问题。');
}

const views = {
  login: loginView,
  register: registerView,
  forgot: forgotView,
  dashboard: dashboardView,
  subscribe: subscribeView,
  plans: plansView,
  orders: ordersView,
  recharge: rechargeView,
  profile: profileView,
  nodes: nodesView,
  traffic: trafficView,
  tickets: ticketsView,
  invite: inviteView,
  knowledge: knowledgeView,
};

async function render() {
  const current = route();
  const publicRoute = publicRoutes.has(current.name);

  startRouteProgress();

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

    const view = views[current.name] || views.dashboard;
    app.innerHTML = await view(current);
    bindPageEvents();
  } catch (error) {
    app.innerHTML = publicRoute
      ? authShell(`<div class="error-box">${escapeHtml(error.message || '页面加载失败')}</div>`)
      : shell(`<div class="error-box">${escapeHtml(error.message || '页面加载失败')}</div>`, currentTitle(current.name), '请稍后重试或重新登录。');
    bindPageEvents();
  } finally {
    finishRouteProgress();
  }
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function bindPageEvents() {
  const current = route();
  if (current.name === 'login' && current.query.verify && !window.__xboardVerifyHandled) {
    window.__xboardVerifyHandled = true;
    api.get('/passport/auth/token2Login', { verify: current.query.verify }, { auth: false })
      .then((payload) => {
        const data = payload?.data || payload;
        if (!data?.auth_data) throw new Error('登录凭证无效');
        setToken(data.auth_data);
        state.bootPromise = null;
        toast('登录成功');
        go(current.query.redirect || 'dashboard');
      })
      .catch((error) => {
        toast(error.message || '登录链接已失效', 'error');
      });
  }

  $all('[data-toggle-menu]').forEach((button) => {
    button.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });
  });

  $all('[data-toggle-sidebar]').forEach((button) => {
    button.addEventListener('click', () => {
      const collapsed = document.body.classList.toggle('sidebar-collapsed');
      button.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    });
  });

  $all('[data-toggle-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
      $all('.theme-label').forEach((label) => {
        label.textContent = themeLabel();
      });
    });
  });

  $all('[data-toggle-user-menu]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const menu = button.closest('.user-menu');
      const isOpen = menu?.classList.toggle('is-open');
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  });

  if (!window.__xboardUserMenuBound) {
    window.__xboardUserMenuBound = true;
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.user-menu')) return;
      $all('.user-menu.is-open').forEach((menu) => {
        menu.classList.remove('is-open');
        menu.querySelector('[data-toggle-user-menu]')?.setAttribute('aria-expanded', 'false');
      });
    });
  }

  $all('[data-logout]').forEach((button) => {
    button.addEventListener('click', () => {
      clearToken();
      state.bootPromise = null;
      state.booted = false;
      go('login');
    });
  });

  $all('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      await copyText(button.dataset.copy || '');
      toast('已复制');
    });
  });

  $('[data-login-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const data = await api.post('/passport/auth/login', formData(event.currentTarget), { auth: false });
      setToken(data.auth_data);
      state.bootPromise = null;
      toast('登录成功');
      go(route().query.redirect || 'dashboard');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('[data-register-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const data = await api.post('/passport/auth/register', formData(event.currentTarget), { auth: false });
      setToken(data.auth_data);
      state.bootPromise = null;
      toast('注册成功');
      go('dashboard');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('[data-forgot-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      await api.post('/passport/auth/forget', formData(event.currentTarget), { auth: false });
      toast('密码已重置，请登录');
      go('login');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  $all('[data-send-code]').forEach((button) => {
    button.addEventListener('click', async () => {
      const form = button.closest('form');
      const email = form?.querySelector('[name=email]')?.value;
      if (!email) {
        toast('请先输入邮箱', 'error');
        return;
      }
      button.disabled = true;
      try {
        await api.post('/passport/comm/sendEmailVerify', { email }, { auth: false });
        toast('验证码已发送');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        setTimeout(() => { button.disabled = false; }, 3000);
      }
    });
  });

  $('[data-reset-security]')?.addEventListener('click', async () => {
    if (!confirm('重置后旧订阅链接会失效，确定继续吗？')) return;
    try {
      const url = await api.get('/user/resetSecurity');
      state.subscribe.subscribe_url = url;
      toast('订阅已重置');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $all('[data-buy-plan]').forEach((button) => {
    button.addEventListener('click', async () => {
      const card = button.closest('[data-plan-card]');
      const payload = {
        plan_id: button.dataset.buyPlan,
        period: card.querySelector('[name=period]')?.value,
        coupon_code: card.querySelector('[name=coupon_code]')?.value || '',
      };
      button.disabled = true;
      try {
        const tradeNo = await api.post('/user/order/save', payload);
        toast('订单已创建');
        go('orders', { trade_no: tradeNo });
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
  });

  $('[data-checkout-order]')?.addEventListener('click', async (event) => {
    const box = event.currentTarget.closest('[data-order-checkout]');
    const tradeNo = box.dataset.orderCheckout;
    const method = box.querySelector('[name=method]:checked')?.value;
    event.currentTarget.disabled = true;
    try {
      const result = await api.post('/user/order/checkout', { trade_no: tradeNo, method });
      handlePaymentResult(result, 'order', tradeNo);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  $('[data-cancel-order]')?.addEventListener('click', async (event) => {
    if (!confirm('确定取消该订单吗？')) return;
    try {
      await api.post('/user/order/cancel', { trade_no: event.currentTarget.dataset.cancelOrder });
      toast('订单已取消');
      go('orders');
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('[data-recharge-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const tradeNo = await api.post('/user/recharge/save', formData(event.currentTarget));
      toast('充值单已创建');
      go('recharge', { trade_no: tradeNo });
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  $('[data-checkout-recharge]')?.addEventListener('click', async (event) => {
    const box = event.currentTarget.closest('[data-recharge-checkout]');
    const tradeNo = box.dataset.rechargeCheckout;
    const method = box.querySelector('[name=method]:checked')?.value;
    event.currentTarget.disabled = true;
    try {
      const result = await api.post('/user/recharge/checkout', { trade_no: tradeNo, method });
      handlePaymentResult(result, 'recharge', tradeNo);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      event.currentTarget.disabled = false;
    }
  });

  $('[data-cancel-recharge]')?.addEventListener('click', async (event) => {
    if (!confirm('确定取消该充值单吗？')) return;
    try {
      await api.post('/user/recharge/cancel', { trade_no: event.currentTarget.dataset.cancelRecharge });
      toast('充值单已取消');
      go('recharge');
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('[data-identity-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      await api.post('/user/update', {
        name: form.querySelector('[name="name"]')?.value.trim() || '',
      });
      await refreshUser();
      toast('资料已保存');
      render();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      if (button) button.disabled = false;
    }
  });

  $('[data-avatar-input]')?.addEventListener('change', async (event) => {
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
      const preview = $('[data-avatar-preview]');
      if (preview) preview.src = URL.createObjectURL(file);
      await api.post('/user/avatar', data);
      await refreshUser();
      toast('头像已更新');
      render();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      event.currentTarget.value = '';
    }
  });

  $('[data-profile-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api.post('/user/update', {
        remind_expire: form.remind_expire.checked ? 1 : 0,
        remind_traffic: form.remind_traffic.checked ? 1 : 0,
      });
      await refreshUser();
      toast('设置已保存');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('[data-transfer-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const amount = Number(formData(event.currentTarget).amount || 0);
    try {
      await api.post('/user/transfer', { transfer_amount: Math.round(amount * 100) });
      await refreshUser();
      toast('划转成功');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('[data-password-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api.post('/user/changePassword', formData(event.currentTarget));
      toast('密码已更新');
      event.currentTarget.reset();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('[data-gift-card-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api.post('/user/gift-card/redeem', formData(event.currentTarget));
      await refreshUser();
      toast('兑换成功');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('[data-ticket-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api.post('/user/ticket/save', formData(event.currentTarget));
      toast('工单已提交');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('[data-ticket-reply]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api.post('/user/ticket/reply', {
        id: event.currentTarget.dataset.ticketReply,
        ...formData(event.currentTarget),
      });
      toast('回复已发送');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('[data-close-ticket]')?.addEventListener('click', async (event) => {
    if (!confirm('确定关闭该工单吗？')) return;
    try {
      await api.post('/user/ticket/close', { id: event.currentTarget.dataset.closeTicket });
      toast('工单已关闭');
      go('tickets');
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('[data-create-invite]')?.addEventListener('click', async () => {
    try {
      await api.get('/user/invite/save');
      toast('邀请码已生成');
      render();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

window.addEventListener('hashchange', render);
window.addEventListener('xboard:auth-expired', () => go('login'));

render();
