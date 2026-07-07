(function () {
  var STYLE_ID = 'xboard-group-buy-entry-style';
  var PAGE_ID = 'xboard-group-buy-page';
  var ENTRY_ATTR = 'data-xboard-group-buy-entry';
  var ROUTE_HASH = '#/finance/plan?xgb=group-buy';
  var LEGACY_ROUTE_HASH = '#/finance/group-buy';
  var ANCHOR_LABELS = [
    '套餐管理',
    'Plan Management',
    '套餐',
    'Plan'
  ];
  var PERIOD_LABELS = {
    monthly: '月付',
    quarterly: '季付',
    half_yearly: '半年付',
    yearly: '年付',
    two_yearly: '两年付',
    three_yearly: '三年付',
    onetime: '一次性',
    reset_traffic: '重置流量'
  };
  var state = {
    loaded: false,
    loading: false,
    saving: false,
    groupLoading: false,
    showForm: false,
    message: null,
    messageTimer: null,
    plans: [],
    periods: {},
    activities: [],
    groups: [],
    selectedActivity: null,
    filters: {
      keyword: '',
      status: 'all',
      plan_id: ''
    },
    pagination: {
      current_page: 1,
      per_page: 10,
      total: 0,
      last_page: 1
    },
    form: defaultForm()
  };

  function defaultForm() {
    return {
      id: '',
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
      status: 1
    };
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '[' + ENTRY_ATTR + '="menu"]{cursor:pointer}',
      '[' + ENTRY_ATTR + '="menu"] svg{flex-shrink:0}',
      '[' + ENTRY_ATTR + '="menu"].xgb-active,',
      '[' + ENTRY_ATTR + '="menu"].xgb-active a{background:#eef2ff!important;color:#4f46e5!important;font-weight:700!important}',
      '[' + ENTRY_ATTR + '="menu"].xgb-active svg{color:#4f46e5!important}',
      '#xboard-group-buy-page{position:fixed;top:0;right:0;bottom:0;left:var(--xgb-sidebar-left,280px);z-index:40;overflow:auto;background:#f8fafc;color:#0f172a;padding:28px 34px 42px;font-family:inherit}',
      '#xboard-group-buy-page *{box-sizing:border-box}',
      '#xboard-group-buy-page .xgb-shell{max-width:1440px;margin:0 auto}',
      '#xboard-group-buy-page .xgb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:22px}',
      '#xboard-group-buy-page .xgb-eyebrow{font-size:13px;font-weight:700;color:#64748b;margin-bottom:6px}',
      '#xboard-group-buy-page h1{margin:0;color:#0f172a;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:0}',
      '#xboard-group-buy-page .xgb-desc{margin:8px 0 0;color:#64748b;font-size:14px;line-height:1.65}',
      '#xboard-group-buy-page .xgb-primary,#xboard-group-buy-page .xgb-button{height:38px;border:0;border-radius:10px;padding:0 14px;font-size:14px;font-weight:700;cursor:pointer;transition:.18s ease}',
      '#xboard-group-buy-page .xgb-primary{background:#0f172a;color:#fff;box-shadow:0 12px 22px rgba(15,23,42,.12)}',
      '#xboard-group-buy-page .xgb-primary:hover{transform:translateY(-1px);box-shadow:0 16px 26px rgba(15,23,42,.16)}',
      '#xboard-group-buy-page .xgb-button{background:#fff;color:#0f172a;border:1px solid #e2e8f0}',
      '#xboard-group-buy-page .xgb-button:hover{background:#f1f5f9}',
      '#xboard-group-buy-page .xgb-danger{color:#dc2626}',
      '#xboard-group-buy-page .xgb-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}',
      '#xboard-group-buy-page .xgb-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 16px 38px rgba(15,23,42,.06)}',
      '#xboard-group-buy-page .xgb-stat{padding:18px}',
      '#xboard-group-buy-page .xgb-stat-label{font-size:13px;font-weight:700;color:#64748b}',
      '#xboard-group-buy-page .xgb-stat-value{margin-top:8px;font-size:28px;font-weight:800;color:#0f172a}',
      '#xboard-group-buy-page .xgb-stat-sub{margin-top:5px;color:#94a3b8;font-size:13px}',
      '#xboard-group-buy-page .xgb-toolbar{display:flex;align-items:center;gap:10px;padding:14px;margin-bottom:16px}',
      '#xboard-group-buy-page .xgb-toolbar input,#xboard-group-buy-page .xgb-toolbar select,#xboard-group-buy-page .xgb-form input,#xboard-group-buy-page .xgb-form select{height:38px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:0 12px;color:#0f172a;font-size:14px;outline:none}',
      '#xboard-group-buy-page .xgb-toolbar input{min-width:280px}',
      '#xboard-group-buy-page .xgb-toolbar input:focus,#xboard-group-buy-page .xgb-toolbar select:focus,#xboard-group-buy-page .xgb-form input:focus,#xboard-group-buy-page .xgb-form select:focus{border-color:#8b7cf6;box-shadow:0 0 0 3px rgba(139,124,246,.12)}',
      '#xboard-group-buy-page .xgb-message{margin-bottom:14px;border-radius:12px;padding:11px 14px;font-size:14px;font-weight:700;background:#ecfdf5;color:#047857}',
      '#xboard-group-buy-page .xgb-message.error{background:#fef2f2;color:#dc2626}',
      '#xboard-group-buy-page .xgb-form{padding:18px;margin-bottom:16px}',
      '#xboard-group-buy-page .xgb-form-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}',
      '#xboard-group-buy-page .xgb-form-head h2{margin:0;font-size:18px;font-weight:800;color:#0f172a}',
      '#xboard-group-buy-page .xgb-form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}',
      '#xboard-group-buy-page .xgb-field{display:flex;flex-direction:column;gap:7px}',
      '#xboard-group-buy-page .xgb-field label{font-size:13px;font-weight:700;color:#64748b}',
      '#xboard-group-buy-page .xgb-field-wide{grid-column:span 2}',
      '#xboard-group-buy-page .xgb-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}',
      '#xboard-group-buy-page .xgb-table-card{overflow:hidden}',
      '#xboard-group-buy-page .xgb-table-head{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 8px}',
      '#xboard-group-buy-page .xgb-table-head h2{margin:0;font-size:18px;font-weight:800;color:#0f172a}',
      '#xboard-group-buy-page .xgb-table{width:100%;border-collapse:collapse}',
      '#xboard-group-buy-page .xgb-table th,#xboard-group-buy-page .xgb-table td{padding:14px 18px;border-top:1px solid #eef2f7;text-align:left;vertical-align:middle;font-size:14px}',
      '#xboard-group-buy-page .xgb-table th{color:#64748b;font-weight:800;background:#fbfdff}',
      '#xboard-group-buy-page .xgb-table td{color:#334155}',
      '#xboard-group-buy-page .xgb-title{font-weight:800;color:#0f172a}',
      '#xboard-group-buy-page .xgb-muted{font-size:12px;color:#94a3b8;margin-top:4px}',
      '#xboard-group-buy-page .xgb-pill{display:inline-flex;align-items:center;justify-content:center;height:24px;border-radius:999px;padding:0 9px;font-size:12px;font-weight:800;background:#f1f5f9;color:#64748b}',
      '#xboard-group-buy-page .xgb-pill.ok{background:#dcfce7;color:#16a34a}',
      '#xboard-group-buy-page .xgb-pill.off{background:#fee2e2;color:#dc2626}',
      '#xboard-group-buy-page .xgb-row-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '#xboard-group-buy-page .xgb-link{border:0;background:transparent;color:#4f46e5;font-size:13px;font-weight:800;cursor:pointer;padding:0}',
      '#xboard-group-buy-page .xgb-empty{padding:46px 18px;text-align:center;color:#94a3b8;font-weight:700}',
      '#xboard-group-buy-page .xgb-pagination{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 18px;border-top:1px solid #eef2f7;color:#64748b;font-size:13px;font-weight:700}',
      '#xboard-group-buy-page .xgb-groups{margin-top:16px;padding:18px}',
      '#xboard-group-buy-page .xgb-group-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}',
      '#xboard-group-buy-page .xgb-group-item{border:1px solid #e5e7eb;border-radius:14px;padding:14px;background:#fbfdff}',
      '#xboard-group-buy-page .xgb-members{margin-top:10px;color:#64748b;font-size:13px;line-height:1.7}',
      '#xboard-group-buy-page .xgb-loading{opacity:.62;pointer-events:none}',
      '.dark #xboard-group-buy-page{background:#020617;color:#e5e7eb}',
      '.dark #xboard-group-buy-page h1,.dark #xboard-group-buy-page .xgb-stat-value,.dark #xboard-group-buy-page .xgb-form-head h2,.dark #xboard-group-buy-page .xgb-table-head h2,.dark #xboard-group-buy-page .xgb-title{color:#f8fafc}',
      '.dark #xboard-group-buy-page .xgb-card{background:#0f172a;border-color:#243042;box-shadow:none}',
      '.dark #xboard-group-buy-page .xgb-toolbar input,.dark #xboard-group-buy-page .xgb-toolbar select,.dark #xboard-group-buy-page .xgb-form input,.dark #xboard-group-buy-page .xgb-form select,.dark #xboard-group-buy-page .xgb-button{background:#111827;border-color:#334155;color:#e5e7eb}',
      '.dark #xboard-group-buy-page .xgb-table th{background:#111827;color:#94a3b8}',
      '.dark #xboard-group-buy-page .xgb-table th,.dark #xboard-group-buy-page .xgb-table td,.dark #xboard-group-buy-page .xgb-pagination{border-color:#243042}',
      '.dark #xboard-group-buy-page .xgb-group-item{background:#111827;border-color:#243042}',
      '@media (max-width:1100px){#xboard-group-buy-page{left:var(--xgb-sidebar-left,280px);padding:20px}#xboard-group-buy-page .xgb-grid,#xboard-group-buy-page .xgb-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#xboard-group-buy-page .xgb-group-list{grid-template-columns:1fr}}',
      '@media (max-width:720px){#xboard-group-buy-page .xgb-grid,#xboard-group-buy-page .xgb-form-grid{grid-template-columns:1fr}#xboard-group-buy-page .xgb-field-wide{grid-column:span 1}#xboard-group-buy-page .xgb-toolbar{align-items:stretch;flex-direction:column}#xboard-group-buy-page .xgb-toolbar input{min-width:0;width:100%}}'
    ].join('');
    document.head.appendChild(style);
  }

  function pageUrl() {
    return ROUTE_HASH;
  }

  function currentHash() {
    return String(window.location.hash || '').replace(/\/$/, '');
  }

  function normalizeLegacyRoute() {
    if (currentHash() !== LEGACY_ROUTE_HASH) return false;
    window.location.hash = ROUTE_HASH;
    return true;
  }

  function isGroupBuyRoute() {
    return currentHash() === ROUTE_HASH;
  }

  function textOf(node) {
    return String(node && node.textContent ? node.textContent : '').replace(/\s+/g, '').trim();
  }

  function isSidebarCandidate(node) {
    if (!node || !node.getBoundingClientRect) return false;
    var rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left < Math.min(560, window.innerWidth * 0.45);
  }

  function closestItem(node) {
    if (!node || !node.closest) return null;
    return node.closest('a')
      || node.closest('button')
      || node.closest('[role="menuitem"]')
      || node.closest('li')
      || node.parentElement;
  }

  function findMenuAnchor() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('a, button, [role="menuitem"], li, div, span'));
    var match = null;
    ANCHOR_LABELS.some(function (label) {
      match = nodes.find(function (node) {
        var text = textOf(node);
        if (!text || text.length > 30 || text === '拼团管理') return false;
        if (!isSidebarCandidate(node)) return false;
        return text === label;
      });
      return Boolean(match);
    });
    return closestItem(match);
  }

  function replaceText(node, label) {
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    var current;
    while ((current = walker.nextNode())) {
      if (String(current.nodeValue || '').trim()) {
        current.nodeValue = current.nodeValue.replace(String(current.nodeValue).trim(), label);
        return true;
      }
    }
    return false;
  }

  function replaceIcon(node) {
    var oldIcon = node.querySelector('svg');
    if (!oldIcon) return;
    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.innerHTML = [
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>',
      '<circle cx="9" cy="7" r="4"></circle>',
      '<path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>',
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'
    ].join('');
    oldIcon.replaceWith(icon);
  }

  function setEntryHref(node) {
    var nodes = [];
    if (node && node.tagName === 'A') nodes.push(node);
    nodes = nodes.concat(Array.prototype.slice.call(node.querySelectorAll('a')));
    nodes.forEach(function (link) {
      link.setAttribute('href', pageUrl());
    });
  }

  function goGroupBuy(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (currentHash() !== ROUTE_HASH) {
      window.location.hash = ROUTE_HASH;
    }
    syncRoute();
  }

  function cloneFrom(reference) {
    var clone = reference.cloneNode(true);
    clone.setAttribute(ENTRY_ATTR, 'menu');
    clone.onclick = null;
    clone.removeAttribute('aria-current');
    clone.removeAttribute('data-state');
    clone.classList.remove('active');
    clone.classList.remove('router-link-active');
    clone.classList.remove('router-link-exact-active');
    clone.querySelectorAll('[aria-current], [data-state]').forEach(function (node) {
      node.removeAttribute('aria-current');
      node.removeAttribute('data-state');
    });
    replaceIcon(clone);
    replaceText(clone, '拼团管理');
    setEntryHref(clone);
    clone.addEventListener('click', goGroupBuy, true);
    return clone;
  }

  function sidebarRight() {
    var menu = document.querySelector('[' + ENTRY_ATTR + '="menu"]');
    if (menu && menu.getBoundingClientRect) {
      var menuRect = menu.getBoundingClientRect();
      if (menuRect.width > 0 && menuRect.right > 120) return Math.ceil(menuRect.right);
    }
    var best = 0;
    Array.prototype.slice.call(document.querySelectorAll('aside, nav, [class*="sidebar"], #root > div > div')).forEach(function (node) {
      if (!node.getBoundingClientRect) return;
      var rect = node.getBoundingClientRect();
      if (rect.left <= 12 && rect.width >= 120 && rect.width <= 620 && rect.height > 360) {
        best = Math.max(best, rect.right);
      }
    });
    return Math.ceil(best || 280);
  }

  function updatePageOffset() {
    document.documentElement.style.setProperty('--xgb-sidebar-left', sidebarRight() + 'px');
  }

  function inject() {
    ensureStyle();
    document.querySelectorAll('a.xboard-group-buy-entry-fallback, [data-xboard-group-buy-fallback]').forEach(function (node) {
      node.remove();
    });

    var anchor = findMenuAnchor();
    if (anchor && anchor.parentElement) {
      var existing = document.querySelector('[' + ENTRY_ATTR + '="menu"]');
      if (existing) {
        setEntryHref(existing);
        existing.removeEventListener('click', goGroupBuy, true);
        existing.addEventListener('click', goGroupBuy, true);
        if (existing.previousElementSibling !== anchor) {
          existing.remove();
          anchor.insertAdjacentElement('afterend', cloneFrom(anchor));
        }
      } else {
        anchor.insertAdjacentElement('afterend', cloneFrom(anchor));
      }
    }
    updateEntryActive();
    updatePageOffset();
  }

  function updateEntryActive() {
    document.querySelectorAll('[' + ENTRY_ATTR + '="menu"]').forEach(function (node) {
      node.classList.toggle('xgb-active', isGroupBuyRoute());
    });
  }

  function baseUrl() {
    var base = (window.settings && window.settings.base_url) || '/';
    return String(base).replace(/\/$/, '');
  }

  function securePath() {
    return String((window.settings && window.settings.secure_path) || '').replace(/^\/|\/$/g, '');
  }

  function apiPrefix() {
    return baseUrl() + '/api/v2/' + securePath() + '/group-buy';
  }

  function authToken() {
    var raw = localStorage.getItem('XBOARD_ACCESS_TOKEN');
    if (!raw) return '';
    try {
      var parsed = JSON.parse(raw);
      return parsed && parsed.value ? parsed.value : '';
    } catch (error) {
      return raw;
    }
  }

  function request(path, options) {
    options = options || {};
    return fetch(apiPrefix() + path, {
      method: options.method || 'GET',
      body: options.body,
      headers: Object.assign({
        'Content-Type': 'application/json',
        Authorization: authToken(),
        'Content-Language': localStorage.getItem('i18nextLng') || 'zh-CN'
      }, options.headers || {})
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (json) {
        if (!response.ok || json.status === 'fail') {
          throw new Error(json.message || '请求失败');
        }
        return json.data === undefined ? json : json.data;
      });
    });
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(cents) {
    return '¥' + (Number(cents || 0) / 100).toFixed(2);
  }

  function formatTime(timestamp) {
    if (!timestamp) return '不限';
    return new Date(Number(timestamp) * 1000).toLocaleString('zh-CN', { hour12: false });
  }

  function toDatetimeInput(timestamp) {
    if (!timestamp) return '';
    var date = new Date(Number(timestamp) * 1000);
    var local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function periodOptions(planId) {
    var plan = state.plans.find(function (item) {
      return Number(item.id) === Number(planId);
    });
    if (!plan) return [];
    return (plan.active_periods || [])
      .filter(function (period) {
        return plan.prices && Number(plan.prices[period]) > 0;
      })
      .map(function (period) {
        return {
          value: period,
          label: (state.periods[period] && state.periods[period].name) || PERIOD_LABELS[period] || period,
          price: Math.round(Number(plan.prices[period] || 0) * 100)
        };
      });
  }

  function syncPeriod() {
    var options = periodOptions(state.form.plan_id);
    if (!options.length) {
      state.form.period = '';
      return;
    }
    if (!options.some(function (item) { return item.value === state.form.period; })) {
      state.form.period = options[0].value;
    }
  }

  function notify(text, type) {
    if (state.messageTimer) clearTimeout(state.messageTimer);
    state.message = { text: text, type: type || 'success' };
    renderGroupBuyPage();
    state.messageTimer = setTimeout(function () {
      state.message = null;
      renderGroupBuyPage();
    }, 2600);
  }

  function fetchActivities(page) {
    if (!authToken()) {
      notify('请先登录后台', 'error');
      return Promise.resolve();
    }
    state.loading = true;
    state.loaded = true;
    renderGroupBuyPage();
    var query = new URLSearchParams({
      current: String(page || state.pagination.current_page || 1),
      pageSize: String(state.pagination.per_page || 10),
      status: state.filters.status || 'all'
    });
    if (state.filters.keyword) query.set('keyword', state.filters.keyword);
    if (state.filters.plan_id) query.set('plan_id', state.filters.plan_id);
    return request('/fetch?' + query.toString()).then(function (data) {
      state.activities = data.items || [];
      state.plans = data.plans || state.plans;
      state.periods = data.periods || state.periods;
      state.pagination.current_page = data.current_page || page || 1;
      state.pagination.per_page = data.per_page || state.pagination.per_page;
      state.pagination.total = data.total || 0;
      state.pagination.last_page = data.last_page || 1;
      if (!state.form.plan_id && state.plans[0]) state.form.plan_id = state.plans[0].id;
      syncPeriod();
    }).catch(function (error) {
      notify(error.message || '加载失败', 'error');
    }).finally(function () {
      state.loading = false;
      renderGroupBuyPage();
    });
  }

  function saveActivity() {
    if (!state.form.plan_id || !state.form.period) {
      notify('请选择套餐和周期', 'error');
      return;
    }
    state.saving = true;
    renderGroupBuyPage();
    var discountValue = Number(state.form.discount_type) === 1
      ? Math.round(Number(state.form.discount_value_yuan || 0) * 100)
      : Math.round(Number(state.form.discount_value_percent || 0));
    request('/save', {
      method: 'POST',
      body: JSON.stringify({
        id: state.form.id || null,
        title: state.form.title,
        plan_id: state.form.plan_id,
        period: state.form.period,
        group_size: Number(state.form.group_size || 2),
        discount_type: Number(state.form.discount_type || 1),
        discount_value: discountValue,
        started_at: state.form.started_at,
        ended_at: state.form.ended_at,
        expire_minutes: Number(state.form.expire_minutes || 1440),
        status: Number(state.form.status || 1)
      })
    }).then(function () {
      notify('已保存拼团活动');
      state.showForm = false;
      state.form = defaultForm();
      return fetchActivities(state.pagination.current_page || 1);
    }).catch(function (error) {
      notify(error.message || '保存失败', 'error');
    }).finally(function () {
      state.saving = false;
      renderGroupBuyPage();
    });
  }

  function toggleActivity(id) {
    var activity = state.activities.find(function (item) {
      return Number(item.id) === Number(id);
    });
    if (!activity) return;
    request('/update', {
      method: 'POST',
      body: JSON.stringify({
        id: activity.id,
        status: Number(activity.status) === 1 ? 0 : 1
      })
    }).then(function () {
      notify('状态已更新');
      return fetchActivities(state.pagination.current_page);
    }).catch(function (error) {
      notify(error.message || '更新失败', 'error');
    });
  }

  function deleteActivity(id) {
    var activity = state.activities.find(function (item) {
      return Number(item.id) === Number(id);
    });
    if (!activity || !window.confirm('确定删除「' + activity.title + '」？')) return;
    request('/drop', {
      method: 'POST',
      body: JSON.stringify({ id: activity.id })
    }).then(function () {
      notify('已删除活动');
      return fetchActivities(state.pagination.current_page);
    }).catch(function (error) {
      notify(error.message || '删除失败', 'error');
    });
  }

  function openGroups(id) {
    var activity = state.activities.find(function (item) {
      return Number(item.id) === Number(id);
    });
    if (!activity) return;
    state.selectedActivity = activity;
    state.groups = [];
    state.groupLoading = true;
    renderGroupBuyPage();
    var query = new URLSearchParams({
      activity_id: String(activity.id),
      current: '1',
      pageSize: '50'
    });
    request('/groups?' + query.toString()).then(function (data) {
      state.groups = data.items || [];
    }).catch(function (error) {
      notify(error.message || '加载队伍失败', 'error');
    }).finally(function () {
      state.groupLoading = false;
      renderGroupBuyPage();
    });
  }

  function startCreate() {
    state.form = defaultForm();
    if (state.plans[0]) state.form.plan_id = state.plans[0].id;
    syncPeriod();
    state.showForm = true;
    renderGroupBuyPage();
  }

  function startEdit(id) {
    var activity = state.activities.find(function (item) {
      return Number(item.id) === Number(id);
    });
    if (!activity) return;
    state.form = {
      id: activity.id,
      title: activity.title || '',
      plan_id: activity.plan_id || '',
      period: activity.period || '',
      group_size: activity.group_size || 2,
      discount_type: activity.discount_type || 1,
      discount_value_yuan: Number(activity.discount_type) === 1 ? Number(activity.discount_value || 0) / 100 : 0,
      discount_value_percent: Number(activity.discount_type) === 2 ? Number(activity.discount_value || 0) : 10,
      started_at: toDatetimeInput(activity.started_at),
      ended_at: toDatetimeInput(activity.ended_at),
      expire_minutes: activity.expire_minutes || 1440,
      status: activity.status === 0 ? 0 : 1
    };
    syncPeriod();
    state.showForm = true;
    renderGroupBuyPage();
  }

  function renderSummary() {
    var enabled = state.activities.filter(function (item) { return Number(item.status) === 1; }).length;
    var openGroups = state.activities.reduce(function (sum, item) { return sum + Number(item.open_groups_count || 0); }, 0);
    var completedGroups = state.activities.reduce(function (sum, item) { return sum + Number(item.completed_groups_count || 0); }, 0);
    var stats = [
      ['活动总数', state.pagination.total || 0, '当前筛选结果'],
      ['启用中', enabled, '可在前台展示'],
      ['进行中队伍', openGroups, '等待成团'],
      ['已成团队伍', completedGroups, '已完成拼团']
    ];
    return '<div class="xgb-grid">' + stats.map(function (item) {
      return '<div class="xgb-card xgb-stat"><div class="xgb-stat-label">' + item[0] + '</div><div class="xgb-stat-value">' + item[1] + '</div><div class="xgb-stat-sub">' + item[2] + '</div></div>';
    }).join('') + '</div>';
  }

  function renderPlanOptions(selected, includeAll) {
    var html = includeAll ? '<option value="">全部套餐</option>' : '<option value="">请选择套餐</option>';
    html += state.plans.map(function (plan) {
      return '<option value="' + escapeHtml(plan.id) + '"' + (String(selected) === String(plan.id) ? ' selected' : '') + '>' + escapeHtml(plan.name) + '</option>';
    }).join('');
    return html;
  }

  function renderPeriodOptions() {
    var options = periodOptions(state.form.plan_id);
    if (!options.length) return '<option value="">请先选择套餐</option>';
    return options.map(function (item) {
      return '<option value="' + escapeHtml(item.value) + '"' + (state.form.period === item.value ? ' selected' : '') + '>' + escapeHtml(item.label) + ' / ' + formatMoney(item.price) + '</option>';
    }).join('');
  }

  function renderForm() {
    if (!state.showForm) return '';
    var discountFixed = Number(state.form.discount_type) === 1;
    return [
      '<form class="xgb-card xgb-form" data-xgb-form>',
      '<div class="xgb-form-head"><h2>' + (state.form.id ? '编辑拼团活动' : '新建拼团活动') + '</h2><button type="button" class="xgb-button" data-xgb-action="cancel-form">取消</button></div>',
      '<div class="xgb-form-grid">',
      '<div class="xgb-field xgb-field-wide"><label>活动标题</label><input data-xgb-form-field name="title" value="' + escapeHtml(state.form.title) + '" placeholder="例如：标准会员拼团"></div>',
      '<div class="xgb-field"><label>套餐</label><select data-xgb-form-field name="plan_id">' + renderPlanOptions(state.form.plan_id, false) + '</select></div>',
      '<div class="xgb-field"><label>周期</label><select data-xgb-form-field name="period">' + renderPeriodOptions() + '</select></div>',
      '<div class="xgb-field"><label>成团人数</label><input data-xgb-form-field name="group_size" type="number" min="2" max="100" value="' + escapeHtml(state.form.group_size) + '"></div>',
      '<div class="xgb-field"><label>优惠类型</label><select data-xgb-form-field name="discount_type"><option value="1"' + (discountFixed ? ' selected' : '') + '>固定减免</option><option value="2"' + (!discountFixed ? ' selected' : '') + '>百分比折扣</option></select></div>',
      '<div class="xgb-field"><label>' + (discountFixed ? '减免金额' : '折扣比例') + '</label><input data-xgb-form-field name="' + (discountFixed ? 'discount_value_yuan' : 'discount_value_percent') + '" type="number" min="0" step="' + (discountFixed ? '0.01' : '1') + '" value="' + escapeHtml(discountFixed ? state.form.discount_value_yuan : state.form.discount_value_percent) + '"></div>',
      '<div class="xgb-field"><label>开始时间</label><input data-xgb-form-field name="started_at" type="datetime-local" value="' + escapeHtml(state.form.started_at) + '"></div>',
      '<div class="xgb-field"><label>结束时间</label><input data-xgb-form-field name="ended_at" type="datetime-local" value="' + escapeHtml(state.form.ended_at) + '"></div>',
      '<div class="xgb-field"><label>队伍有效分钟</label><input data-xgb-form-field name="expire_minutes" type="number" min="1" max="10080" value="' + escapeHtml(state.form.expire_minutes) + '"></div>',
      '<div class="xgb-field"><label>状态</label><select data-xgb-form-field name="status"><option value="1"' + (Number(state.form.status) === 1 ? ' selected' : '') + '>启用</option><option value="0"' + (Number(state.form.status) === 0 ? ' selected' : '') + '>停用</option></select></div>',
      '</div>',
      '<div class="xgb-actions"><button type="button" class="xgb-button" data-xgb-action="cancel-form">取消</button><button type="submit" class="xgb-primary">' + (state.saving ? '保存中...' : '保存活动') + '</button></div>',
      '</form>'
    ].join('');
  }

  function renderTable() {
    var rows = state.activities.map(function (item) {
      return [
        '<tr>',
        '<td>#' + escapeHtml(item.id) + '</td>',
        '<td><div class="xgb-title">' + escapeHtml(item.title) + '</div><div class="xgb-muted">' + escapeHtml(item.plan_name) + ' / ' + escapeHtml(item.period_label) + '</div></td>',
        '<td>' + formatMoney(item.period_price) + '</td>',
        '<td>' + escapeHtml(item.group_size) + ' 人</td>',
        '<td>' + escapeHtml(item.discount_label) + '</td>',
        '<td><button type="button" class="xgb-link" data-xgb-action="groups" data-xgb-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.open_groups_count || 0) + ' 进行中</button><div class="xgb-muted">' + escapeHtml(item.completed_groups_count || 0) + ' 已成团</div></td>',
        '<td><div>' + formatTime(item.started_at) + '</div><div class="xgb-muted">至 ' + formatTime(item.ended_at) + '</div></td>',
        '<td><span class="xgb-pill ' + (Number(item.status) === 1 ? 'ok' : 'off') + '">' + escapeHtml(item.status_label) + '</span></td>',
        '<td><div class="xgb-row-actions"><button type="button" class="xgb-link" data-xgb-action="edit" data-xgb-id="' + escapeHtml(item.id) + '">编辑</button><button type="button" class="xgb-link" data-xgb-action="toggle" data-xgb-id="' + escapeHtml(item.id) + '">' + (Number(item.status) === 1 ? '停用' : '启用') + '</button><button type="button" class="xgb-link xgb-danger" data-xgb-action="delete" data-xgb-id="' + escapeHtml(item.id) + '">删除</button></div></td>',
        '</tr>'
      ].join('');
    }).join('');
    return [
      '<div class="xgb-card xgb-table-card ' + (state.loading ? 'xgb-loading' : '') + '">',
      '<div class="xgb-table-head"><h2>拼团活动</h2><button type="button" class="xgb-button" data-xgb-action="reload">' + (state.loading ? '加载中' : '刷新') + '</button></div>',
      '<table class="xgb-table"><thead><tr><th>ID</th><th>活动</th><th>原价</th><th>成团</th><th>优惠</th><th>队伍</th><th>时间</th><th>状态</th><th>操作</th></tr></thead><tbody>',
      rows || '<tr><td colspan="9"><div class="xgb-empty">暂无拼团活动</div></td></tr>',
      '</tbody></table>',
      '<div class="xgb-pagination"><button type="button" class="xgb-button" data-xgb-action="prev-page" ' + (state.pagination.current_page <= 1 ? 'disabled' : '') + '>上一页</button><span>第 ' + escapeHtml(state.pagination.current_page || 1) + ' / ' + escapeHtml(state.pagination.last_page || 1) + ' 页，共 ' + escapeHtml(state.pagination.total || 0) + ' 项</span><button type="button" class="xgb-button" data-xgb-action="next-page" ' + (state.pagination.current_page >= state.pagination.last_page ? 'disabled' : '') + '>下一页</button></div>',
      '</div>'
    ].join('');
  }

  function renderGroups() {
    if (!state.selectedActivity) return '';
    var list = state.groups.map(function (group) {
      var members = (group.members || []).map(function (member) {
        return '<div>' + escapeHtml(member.email) + ' · ' + escapeHtml(member.status_label) + (member.order_trade_no ? ' · ' + escapeHtml(member.order_trade_no) : '') + '</div>';
      }).join('');
      return [
        '<div class="xgb-group-item">',
        '<div class="xgb-title">队伍 #' + escapeHtml(group.id) + ' · ' + escapeHtml(group.status_label) + '</div>',
        '<div class="xgb-muted">团长：' + escapeHtml(group.leader_email) + '</div>',
        '<div class="xgb-muted">进度：' + escapeHtml(group.current_count) + ' / ' + escapeHtml(group.required_count) + '，过期：' + formatTime(group.expired_at) + '</div>',
        '<div class="xgb-members">' + (members || '暂无成员') + '</div>',
        '</div>'
      ].join('');
    }).join('');
    return [
      '<section class="xgb-card xgb-groups">',
      '<div class="xgb-table-head" style="padding:0 0 10px"><h2>' + escapeHtml(state.selectedActivity.title) + ' 的拼团队伍</h2><button type="button" class="xgb-button" data-xgb-action="close-groups">收起</button></div>',
      state.groupLoading ? '<div class="xgb-empty">队伍加载中...</div>' : '<div class="xgb-group-list">' + (list || '<div class="xgb-empty">暂无队伍</div>') + '</div>',
      '</section>'
    ].join('');
  }

  function renderGroupBuyPage() {
    if (!isGroupBuyRoute()) return;
    ensureStyle();
    updatePageOffset();
    var page = document.getElementById(PAGE_ID);
    if (!page) {
      page = document.createElement('div');
      page.id = PAGE_ID;
      document.body.appendChild(page);
      page.addEventListener('click', handlePageClick);
      page.addEventListener('input', handlePageInput);
      page.addEventListener('change', handlePageInput);
      page.addEventListener('submit', handlePageSubmit);
    }
    var message = state.message
      ? '<div class="xgb-message ' + escapeHtml(state.message.type) + '">' + escapeHtml(state.message.text) + '</div>'
      : '';
    page.innerHTML = [
      '<div class="xgb-shell">',
      '<div class="xgb-head">',
      '<div><div class="xgb-eyebrow">订阅管理</div><h1>拼团管理</h1><p class="xgb-desc">管理套餐拼团活动、查看队伍进度，并控制活动启停。</p></div>',
      '<button type="button" class="xgb-primary" data-xgb-action="create">+ 新建拼团</button>',
      '</div>',
      message,
      renderSummary(),
      '<div class="xgb-card xgb-toolbar">',
      '<input data-xgb-filter name="keyword" value="' + escapeHtml(state.filters.keyword) + '" placeholder="搜索活动 / 套餐">',
      '<select data-xgb-filter name="plan_id">' + renderPlanOptions(state.filters.plan_id, true) + '</select>',
      '<select data-xgb-filter name="status"><option value="all"' + (state.filters.status === 'all' ? ' selected' : '') + '>全部状态</option><option value="1"' + (state.filters.status === '1' ? ' selected' : '') + '>启用</option><option value="0"' + (state.filters.status === '0' ? ' selected' : '') + '>停用</option></select>',
      '<button type="button" class="xgb-button" data-xgb-action="filter">筛选</button><button type="button" class="xgb-button" data-xgb-action="clear-filter">重置</button>',
      '</div>',
      renderForm(),
      renderTable(),
      renderGroups(),
      '</div>'
    ].join('');
    if (!state.loaded && !state.loading) fetchActivities(1);
  }

  function handlePageInput(event) {
    var target = event.target;
    if (!target || !target.name) return;
    if (target.matches('[data-xgb-filter]')) {
      state.filters[target.name] = target.value;
      return;
    }
    if (target.matches('[data-xgb-form-field]')) {
      state.form[target.name] = target.value;
      if (target.name === 'plan_id') syncPeriod();
      if (target.name === 'discount_type') renderGroupBuyPage();
    }
  }

  function handlePageSubmit(event) {
    if (!event.target || !event.target.matches('[data-xgb-form]')) return;
    event.preventDefault();
    saveActivity();
  }

  function handlePageClick(event) {
    var actionNode = event.target.closest('[data-xgb-action]');
    if (!actionNode) return;
    event.preventDefault();
    var action = actionNode.getAttribute('data-xgb-action');
    var id = actionNode.getAttribute('data-xgb-id');
    if (action === 'create') startCreate();
    if (action === 'cancel-form') {
      state.showForm = false;
      state.form = defaultForm();
      renderGroupBuyPage();
    }
    if (action === 'filter') fetchActivities(1);
    if (action === 'clear-filter') {
      state.filters = { keyword: '', status: 'all', plan_id: '' };
      fetchActivities(1);
    }
    if (action === 'reload') fetchActivities(state.pagination.current_page);
    if (action === 'prev-page' && state.pagination.current_page > 1) fetchActivities(state.pagination.current_page - 1);
    if (action === 'next-page' && state.pagination.current_page < state.pagination.last_page) fetchActivities(state.pagination.current_page + 1);
    if (action === 'edit') startEdit(id);
    if (action === 'toggle') toggleActivity(id);
    if (action === 'delete') deleteActivity(id);
    if (action === 'groups') openGroups(id);
    if (action === 'close-groups') {
      state.selectedActivity = null;
      state.groups = [];
      renderGroupBuyPage();
    }
  }

  function removeGroupBuyPage() {
    var page = document.getElementById(PAGE_ID);
    if (page) page.remove();
  }

  function syncRoute() {
    if (normalizeLegacyRoute()) return;
    inject();
    updateEntryActive();
    if (isGroupBuyRoute()) {
      renderGroupBuyPage();
    } else {
      removeGroupBuyPage();
    }
  }

  var observer = new MutationObserver(function () {
    inject();
    if (isGroupBuyRoute()) updatePageOffset();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('resize', function () {
    if (isGroupBuyRoute()) updatePageOffset();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncRoute);
  } else {
    syncRoute();
  }

  setTimeout(syncRoute, 700);
  setTimeout(syncRoute, 1600);
  setTimeout(syncRoute, 3000);
})();
