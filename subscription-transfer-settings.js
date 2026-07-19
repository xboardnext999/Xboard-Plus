(function () {
  if (window.__xboardSubscriptionTransferSettingsLoaded) return;
  window.__xboardSubscriptionTransferSettingsLoaded = true;

  var OLD_SUBSCRIPTION_PANEL_ID = 'xboard-subscription-transfer-settings';
  var OLD_PLAN_PANEL_ID = 'xboard-plan-transfer-prices';
  var TAB_ID = 'xboard-plan-settings-tab';
  var PAGE_ID = 'xboard-plan-settings-page';
  var STYLE_ID = 'xboard-plan-settings-style';
  var TOAST_STACK_ID = 'xst-toast-stack';
  var CACHE_KEY = 'xboard-plan-settings-cache-v1';
  var CACHE_TTL = 5 * 60 * 1000;
  var state = {
    active: false,
    explicitActivation: false,
    activating: false,
    loading: false,
    cache: null,
    request: null,
    navContainer: null,
    nativeSubscriptionItem: null,
    contentBranch: null,
    hiddenNodes: []
  };

  function apiBase() {
    var base = (window.settings && window.settings.base_url) || '/';
    return String(base).replace(/\/$/, '') + '/api/v2';
  }

  function securePath() {
    return String((window.settings && window.settings.secure_path) || '').replace(/^\/+|\/+$/g, '');
  }

  function configUrl(action) {
    return apiBase() + '/' + securePath() + '/config/' + action;
  }

  function adminUrl(section, action) {
    return apiBase() + '/' + securePath() + '/' + section + '/' + action;
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

  function headers() {
    return {
      Authorization: authToken(),
      'Content-Type': 'application/json',
      'Content-Language': localStorage.getItem('i18nextLng') || 'zh-CN'
    };
  }

  function requestJson(url, options) {
    var requestOptions = options || {};
    requestOptions.headers = requestOptions.headers || headers();
    return fetch(url, requestOptions).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (json) {
        if (!response.ok || json.status === 'fail') {
          throw new Error(json.message || '\u8bf7\u6c42\u5931\u8d25');
        }
        return json.data;
      });
    });
  }

  function readCache() {
    if (state.cache) return state.cache;
    try {
      var cached = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && cached.subscribe && Array.isArray(cached.plans)) state.cache = cached;
    } catch (error) {
      state.cache = null;
    }
    return state.cache;
  }

  function writeCache(cache) {
    state.cache = cache;
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      // Keep the in-memory cache when sessionStorage is unavailable.
    }
  }

  function cacheIsFresh(cache) {
    return cache && Number(cache.updatedAt) > Date.now() - CACHE_TTL;
  }

  function normalizePageData(results) {
    var configData = results[0] || {};
    var planPayload = results[1] || [];
    return {
      updatedAt: Date.now(),
      subscribe: configData.subscribe || {},
      plans: Array.isArray(planPayload) ? planPayload : (planPayload.data || planPayload.items || [])
    };
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + TAB_ID + '{cursor:pointer}',
      '#' + TAB_ID + '.xst-active{background:hsl(var(--muted))!important;color:hsl(var(--foreground))!important;font-weight:500}',
      '.xst-native-suppressed{background:transparent!important;color:hsl(var(--foreground))!important;font-weight:400!important}',
      '#' + PAGE_ID + '{width:100%;min-width:0;padding:2px 0 24px;color:hsl(var(--foreground))}',
      '#' + PAGE_ID + ' *{box-sizing:border-box}',
      '.xst-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:20px;border-bottom:1px solid hsl(var(--border))}',
      '.xst-page-title{font-size:20px;font-weight:600;line-height:1.4}',
      '.xst-page-description{max-width:720px;margin-top:5px;font-size:13px;line-height:1.65;color:hsl(var(--muted-foreground))}',
      '.xst-primary-save{height:38px;flex:0 0 auto;border:0;border-radius:6px;background:hsl(var(--primary));padding:0 18px;color:hsl(var(--primary-foreground));font-size:13px;font-weight:500;cursor:pointer}',
      '.xst-primary-save:hover{opacity:.9}',
      '.xst-primary-save:disabled{cursor:not-allowed;opacity:.6}',
      '.xst-section{padding:22px 0;border-bottom:1px solid hsl(var(--border))}',
      '.xst-section:last-child{border-bottom:0}',
      '.xst-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}',
      '.xst-section-title{font-size:15px;font-weight:600;line-height:1.5}',
      '.xst-section-description{margin-top:4px;font-size:13px;line-height:1.6;color:hsl(var(--muted-foreground))}',
      '.xst-toggle{position:relative;display:inline-flex;width:42px;height:24px;flex:0 0 auto;border:0;border-radius:999px;padding:2px;background:hsl(var(--input));cursor:pointer;transition:background-color .18s ease}',
      '.xst-toggle[aria-checked="true"]{background:hsl(var(--primary))}',
      '.xst-toggle:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px}',
      '.xst-toggle-dot{width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.24);transform:translateX(0);transition:transform .18s ease}',
      '.xst-toggle[aria-checked="true"] .xst-toggle-dot{transform:translateX(18px)}',
      '.xst-field{max-width:520px;margin-top:18px}',
      '.xst-label{display:block;margin-bottom:8px;font-size:13px;font-weight:500}',
      '.xst-money{display:flex;align-items:center;height:40px;border:1px solid hsl(var(--input));border-radius:6px;background:hsl(var(--background));overflow:hidden;transition:border-color .15s ease,box-shadow .15s ease}',
      '.xst-money:focus-within{border-color:hsl(var(--ring));box-shadow:0 0 0 1px hsl(var(--ring))}',
      '.xst-money input{min-width:0;flex:1;height:100%;border:0;outline:0;background:transparent;padding:0 12px;font-size:14px;color:hsl(var(--foreground))}',
      '.xst-money span{padding:0 12px;border-left:1px solid hsl(var(--input));font-size:12px;color:hsl(var(--muted-foreground))}',
      '.xst-message{min-height:20px;margin-top:8px;font-size:12px;color:hsl(var(--muted-foreground))}',
      '.xst-message.is-error{color:hsl(var(--destructive))}',
      '.xst-plan-list{margin-top:15px;border:1px solid hsl(var(--border));border-radius:6px;overflow:hidden}',
      '.xst-plan-row{display:grid;grid-template-columns:minmax(180px,1fr) minmax(260px,420px) 72px;align-items:center;gap:14px;min-height:66px;padding:11px 14px;background:hsl(var(--background))}',
      '.xst-plan-row+.xst-plan-row{border-top:1px solid hsl(var(--border))}',
      '.xst-plan-name{min-width:0;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.xst-plan-meta{margin-top:3px;font-size:12px;font-weight:400;color:hsl(var(--muted-foreground))}',
      '.xst-plan-price{display:grid;grid-template-columns:minmax(150px,1fr) auto;align-items:center;gap:10px}',
      '.xst-plan-price .xst-money{height:36px}',
      '.xst-plan-clear{border:0;background:transparent;padding:5px 0;font-size:12px;color:hsl(var(--muted-foreground));cursor:pointer}',
      '.xst-plan-clear:hover{color:hsl(var(--foreground))}',
      '.xst-plan-save{height:36px;min-width:68px;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--background));padding:0 12px;font-size:13px;font-weight:500;color:hsl(var(--foreground));cursor:pointer}',
      '.xst-plan-save:hover{background:hsl(var(--muted))}',
      '.xst-plan-save:disabled{cursor:not-allowed;opacity:.6}',
      '.xst-plan-empty{padding:22px 14px;text-align:center;font-size:13px;color:hsl(var(--muted-foreground))}',
      '.xst-toast-stack{position:fixed;top:20px;right:20px;z-index:2147483000;display:grid;gap:8px;pointer-events:none}',
      '.xst-toast{min-width:260px;max-width:360px;border:1px solid #dbe2ea;border-radius:6px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.16);padding:12px 14px;font-size:13px;line-height:1.5;color:#0f172a;opacity:0;transform:translateY(-8px);transition:opacity .18s ease,transform .18s ease}',
      '.dark .xst-toast,[data-theme="dark"] .xst-toast{border-color:#334155;background:#111827;color:#f8fafc}',
      '.xst-toast.is-visible{opacity:1;transform:translateY(0)}',
      '.xst-toast.is-success{border-left:3px solid #16a34a}',
      '.xst-toast.is-error{border-left:3px solid hsl(var(--destructive))}',
      '@media(max-width:760px){.xst-page-head{display:grid}.xst-primary-save{width:100%}.xst-plan-row{grid-template-columns:1fr}.xst-plan-save{width:100%}}'
    ].join('');
    document.head.appendChild(style);
  }

  function showToast(message, type) {
    ensureStyle();
    var stack = document.getElementById(TOAST_STACK_ID);
    if (!stack) {
      stack = document.createElement('div');
      stack.id = TOAST_STACK_ID;
      stack.className = 'xst-toast-stack';
      stack.setAttribute('aria-live', 'polite');
      document.documentElement.appendChild(stack);
    }
    var toast = document.createElement('div');
    var toastType = type === 'error' ? 'error' : 'success';
    toast.className = 'xst-toast is-' + toastType + ' is-visible';
    toast.setAttribute('role', toastType === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    stack.appendChild(toast);
    window.setTimeout(function () {
      toast.classList.remove('is-visible');
      window.setTimeout(function () {
        if (toast.isConnected) toast.remove();
        if (stack.isConnected && !stack.childElementCount) stack.remove();
      }, 220);
    }, 3200);
  }

  function setToggle(button, enabled) {
    if (button) button.setAttribute('aria-checked', enabled ? 'true' : 'false');
  }

  function setMessage(page, text, isError) {
    var message = page && page.querySelector('.xst-message');
    if (!message) return;
    message.textContent = text || '';
    message.classList.toggle('is-error', Boolean(isError));
  }

  function isSystemPage() {
    return /^#\/config\/system(?:\/|\?|$)/.test(window.location.hash || '');
  }

  function isSubscriptionPage() {
    return /^#\/config\/system\/subscribe(?:\/|\?|$)/.test(window.location.hash || '');
  }

  function findSystemNavigation() {
    var item = document.querySelector('a[href="#/config/system/subscribe"]');
    if (!item || !item.parentElement || item.parentElement.tagName !== 'NAV') return null;
    return { container: item.parentElement, item: item };
  }

  function stripCloneState(node) {
    if (!node || node.nodeType !== 1) return;
    node.removeAttribute('id');
    node.removeAttribute('aria-current');
    node.removeAttribute('aria-selected');
    node.removeAttribute('data-state');
    Array.prototype.forEach.call(node.children, stripCloneState);
  }

  function findInactiveNavigationItem(navigation) {
    return Array.prototype.slice.call(navigation.container.children).find(function (candidate) {
      return candidate !== navigation.item &&
        candidate.nodeType === 1 &&
        candidate.tagName === navigation.item.tagName &&
        candidate.id !== TAB_ID &&
        candidate.getAttribute('aria-current') !== 'page' &&
        candidate.getAttribute('aria-selected') !== 'true';
    }) || null;
  }

  function setTabLabel(tab, sourceText) {
    var labels = [sourceText, '\u8ba2\u9605\u8bbe\u7f6e'].filter(Boolean);
    var walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
    var fallback = null;
    while (walker.nextNode()) {
      var textNode = walker.currentNode;
      var text = String(textNode.nodeValue || '').trim();
      if (!text) continue;
      if (!fallback) fallback = textNode;
      if (labels.indexOf(text) !== -1) {
        textNode.nodeValue = textNode.nodeValue.replace(text, '\u5957\u9910\u8bbe\u7f6e');
        return;
      }
    }
    if (fallback) {
      var fallbackText = String(fallback.nodeValue || '').trim();
      fallback.nodeValue = fallback.nodeValue.replace(fallbackText, '\u5957\u9910\u8bbe\u7f6e');
    }
  }

  function setPackageIcon(tab) {
    var icon = tab.querySelector('svg');
    if (!icon) {
      icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      tab.insertBefore(icon, tab.firstChild);
    }
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.innerHTML = [
      '<path d="m7.5 4.27 9 5.15"></path>',
      '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>',
      '<path d="m3.3 7 8.7 5 8.7-5"></path>',
      '<path d="M12 22V12"></path>'
    ].join('');
  }

  function bindNavigationReset(container) {
    if (container.__xstNavigationBound) return;
    container.__xstNavigationBound = true;
    container.addEventListener('click', function (event) {
      var customTab = document.getElementById(TAB_ID);
      if (state.activating || (customTab && customTab.contains(event.target))) return;
      deactivateCustomView();
    }, true);
  }

  function ensureTab() {
    var navigation = findSystemNavigation();
    if (!navigation) return null;
    state.navContainer = navigation.container;
    state.nativeSubscriptionItem = navigation.item;
    bindNavigationReset(navigation.container);
    var existing = document.getElementById(TAB_ID);
    if (existing && existing.isConnected) {
      existing.classList.toggle('xst-active', state.active && state.explicitActivation);
      return existing;
    }

    var template = findInactiveNavigationItem(navigation) || navigation.item;
    var sourceText = String(template.textContent || '').trim();
    var tab = template.cloneNode(true);
    stripCloneState(tab);
    tab.id = TAB_ID;
    tab.removeAttribute('href');
    tab.setAttribute('role', 'button');
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('aria-label', '\u5957\u9910\u8bbe\u7f6e');
    setTabLabel(tab, sourceText);
    setPackageIcon(tab);

    function openFromEvent(event) {
      event.preventDefault();
      event.stopPropagation();
      requestOpen();
    }
    tab.addEventListener('click', openFromEvent);
    tab.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') openFromEvent(event);
    });
    navigation.item.insertAdjacentElement('afterend', tab);

    if (state.active && state.explicitActivation) tab.classList.add('xst-active');
    return tab;
  }

  function findSubscribeInput() {
    var direct = document.querySelector('input[name="subscribe_path"]');
    if (direct) return direct;
    return Array.prototype.slice.call(document.querySelectorAll('input')).find(function (input) {
      var text = [input.name, input.id, input.placeholder, input.getAttribute('aria-label')].filter(Boolean).join(' ');
      return /subscribe[_ -]?path|\u8ba2\u9605\u8def\u5f84/i.test(text);
    }) || null;
  }

  function locateContentBranch() {
    var input = findSubscribeInput();
    if (!input) return null;
    var routePage = input.closest('.space-y-6');
    var nativePage = routePage && routePage.parentElement;
    var contentBranch = nativePage && nativePage.parentElement;
    if (!nativePage || !contentBranch || contentBranch.classList.contains('lg:flex-row')) return null;
    return contentBranch;
  }

  function hideNativeContent(contentBranch) {
    state.hiddenNodes = [];
    Array.prototype.slice.call(contentBranch.children).forEach(function (child) {
      if (child.id === PAGE_ID) return;
      state.hiddenNodes.push({ node: child, display: child.style.display });
      child.style.display = 'none';
    });
  }

  function restoreNativeContent() {
    state.hiddenNodes.forEach(function (entry) {
      if (entry.node && entry.node.isConnected) entry.node.style.display = entry.display;
    });
    state.hiddenNodes = [];
    var page = document.getElementById(PAGE_ID);
    if (page) page.remove();
    state.contentBranch = null;
  }

  function requestOpen() {
    if (!isSystemPage()) return;
    state.active = true;
    state.explicitActivation = true;
    state.activating = true;
    var navigation = findSystemNavigation();
    if (navigation && navigation.item) navigation.item.click();
    window.setTimeout(function () {
      state.activating = false;
      mountCustomView(0);
    }, 80);
  }

  function mountCustomView(attempt) {
    if (!state.active || !state.explicitActivation || !isSystemPage()) return;
    ensureTab();
    var contentBranch = locateContentBranch();
    if (!contentBranch) {
      if (attempt < 8) window.setTimeout(function () { mountCustomView(attempt + 1); }, 120);
      return;
    }
    restoreNativeContent();
    state.contentBranch = contentBranch;
    hideNativeContent(contentBranch);
    var page = buildPage();
    contentBranch.appendChild(page);
    var tab = document.getElementById(TAB_ID);
    if (tab) tab.classList.add('xst-active');
    if (state.nativeSubscriptionItem) state.nativeSubscriptionItem.classList.add('xst-native-suppressed');
    loadPage(page);
  }

  function deactivateCustomView() {
    state.active = false;
    state.explicitActivation = false;
    restoreNativeContent();
    var tab = document.getElementById(TAB_ID);
    if (tab) tab.classList.remove('xst-active');
    if (state.nativeSubscriptionItem) state.nativeSubscriptionItem.classList.remove('xst-native-suppressed');
  }

  function planPriceText(plan, defaultFee) {
    if (plan.transfer_price === null || typeof plan.transfer_price === 'undefined') {
      return '\u7ee7\u627f\u9ed8\u8ba4 \u00a5' + (defaultFee / 100).toFixed(2);
    }
    if (Number(plan.transfer_price) === 0) return '\u514d\u8d39\u8f6c\u8ba9';
    return '\u72ec\u7acb\u8d39\u7528 \u00a5' + (Number(plan.transfer_price) / 100).toFixed(2);
  }

  function buildPlanRow(plan, defaultFee) {
    var row = document.createElement('div');
    row.className = 'xst-plan-row';
    row.dataset.planId = String(plan.id);
    var inherited = plan.transfer_price === null || typeof plan.transfer_price === 'undefined';
    var value = inherited ? '' : (Number(plan.transfer_price) / 100).toFixed(2);
    row.innerHTML = [
      '<div><div class="xst-plan-name"></div><div class="xst-plan-meta"></div></div>',
      '<div class="xst-plan-price"><div class="xst-money"><input class="xst-plan-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="\u7559\u7a7a\u7ee7\u627f\u9ed8\u8ba4" value="' + value + '"><span>\u4f59\u989d\u91d1\u989d</span></div><button class="xst-plan-clear" type="button">\u6062\u590d\u9ed8\u8ba4</button></div>',
      '<button class="xst-plan-save" type="button">\u4fdd\u5b58</button>'
    ].join('');
    row.querySelector('.xst-plan-name').textContent = plan.name || ('\u5957\u9910 #' + plan.id);
    row.querySelector('.xst-plan-meta').textContent = planPriceText(plan, defaultFee);
    row.querySelector('.xst-plan-clear').addEventListener('click', function () {
      row.querySelector('.xst-plan-input').value = '';
      row.querySelector('.xst-plan-input').focus();
    });
    row.querySelector('.xst-plan-save').addEventListener('click', function () {
      savePlanPrice(row, plan, defaultFee);
    });
    return row;
  }

  function savePlanPrice(row, plan, defaultFee) {
    var input = row.querySelector('.xst-plan-input');
    var button = row.querySelector('.xst-plan-save');
    var raw = String(input.value || '').trim();
    var price = null;
    if (raw !== '') {
      var amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        showToast('\u8bf7\u8f93\u5165\u6709\u6548\u7684\u5957\u9910\u8f6c\u8ba9\u8d39\u7528', 'error');
        input.focus();
        return;
      }
      price = Math.round(amount * 100);
    }
    button.disabled = true;
    button.textContent = '\u4fdd\u5b58\u4e2d...';
    requestJson(adminUrl('plan', 'transfer-price'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ id: plan.id, transfer_price: price })
    }).then(function () {
      plan.transfer_price = price;
      input.value = price === null ? '' : (price / 100).toFixed(2);
      row.querySelector('.xst-plan-meta').textContent = planPriceText(plan, defaultFee);
      var cache = readCache();
      if (cache && Array.isArray(cache.plans)) {
        cache.plans.forEach(function (cachedPlan) {
          if (String(cachedPlan.id) === String(plan.id)) cachedPlan.transfer_price = price;
        });
        cache.updatedAt = Date.now();
        writeCache(cache);
      }
      showToast('\u5957\u9910\u300c' + (plan.name || plan.id) + '\u300d\u7684\u8f6c\u8ba9\u4ef7\u683c\u5df2\u4fdd\u5b58', 'success');
    }).catch(function (error) {
      showToast(error.message || '\u4fdd\u5b58\u5931\u8d25', 'error');
    }).finally(function () {
      button.disabled = false;
      button.textContent = '\u4fdd\u5b58';
    });
  }

  function buildPage() {
    var page = document.createElement('section');
    page.id = PAGE_ID;
    page.innerHTML = [
      '<div class="xst-page-head">',
      '  <div><div class="xst-page-title">\u5957\u9910\u8bbe\u7f6e</div><div class="xst-page-description">\u7ba1\u7406\u5957\u9910\u8f6c\u8ba9\u529f\u80fd\u3001\u9ed8\u8ba4\u8f6c\u8ba9\u8d39\u7528\u548c\u6bcf\u4e2a\u5957\u9910\u7684\u72ec\u7acb\u8f6c\u8ba9\u4ef7\u683c\u3002</div></div>',
      '  <button class="xst-primary-save" type="button">\u4fdd\u5b58\u8bbe\u7f6e</button>',
      '</div>',
      '<div class="xst-section">',
      '  <div class="xst-section-head"><div><div class="xst-section-title">\u5957\u9910\u8f6c\u8ba9</div><div class="xst-section-description">\u5141\u8bb8\u7528\u6237\u5c06\u542f\u7528\u4e2d\u7684\u5957\u9910\u8f6c\u8ba9\u7ed9\u5176\u4ed6\u5df2\u6ce8\u518c\u8d26\u53f7\uff0c\u8d39\u7528\u4ece\u53d1\u8d77\u4eba\u4f59\u989d\u6263\u9664\u3002</div></div><button class="xst-toggle" type="button" role="switch" aria-checked="false" aria-label="\u5141\u8bb8\u7528\u6237\u8f6c\u8ba9\u5957\u9910"><span class="xst-toggle-dot"></span></button></div>',
      '  <div class="xst-field"><label class="xst-label" for="xst-default-fee">\u9ed8\u8ba4\u8f6c\u8ba9\u8d39\u7528</label><div class="xst-money"><input id="xst-default-fee" class="xst-fee" type="number" min="0" step="0.01" inputmode="decimal" value="0.00"><span>\u4f59\u989d\u91d1\u989d</span></div></div>',
      '  <div class="xst-message" role="status" aria-live="polite"></div>',
      '</div>',
      '<div class="xst-section">',
      '  <div class="xst-section-title">\u5957\u9910\u72ec\u7acb\u5b9a\u4ef7</div>',
      '  <div class="xst-section-description">\u7559\u7a7a\u65f6\u7ee7\u627f\u9ed8\u8ba4\u8d39\u7528\uff0c\u586b 0 \u8868\u793a\u8be5\u5957\u9910\u514d\u8d39\u8f6c\u8ba9\u3002</div>',
      '  <div class="xst-plan-list"><div class="xst-plan-empty">\u6b63\u5728\u8bfb\u53d6\u5957\u9910...</div></div>',
      '</div>'
    ].join('');
    page.querySelector('.xst-toggle').addEventListener('click', function (event) {
      setToggle(event.currentTarget, event.currentTarget.getAttribute('aria-checked') !== 'true');
    });
    page.querySelector('.xst-primary-save').addEventListener('click', function () {
      saveGlobalSettings(page);
    });
    return page;
  }

  function renderPageData(page, data) {
    if (!page || !page.isConnected || !data) return;
    var subscribe = data.subscribe || {};
    var defaultFee = Number(subscribe.subscription_transfer_fee) || 0;
    var enabled = subscribe.subscription_transfer_enable === true ||
      Number(subscribe.subscription_transfer_enable) === 1;
    setToggle(page.querySelector('.xst-toggle'), enabled);
    page.querySelector('.xst-fee').value = (defaultFee / 100).toFixed(2);
    var plans = Array.isArray(data.plans) ? data.plans : [];
    var list = page.querySelector('.xst-plan-list');
    list.innerHTML = '';
    if (!plans.length) {
      list.innerHTML = '<div class="xst-plan-empty">\u6682\u65e0\u5957\u9910</div>';
    } else {
      plans.forEach(function (plan) { list.appendChild(buildPlanRow(plan, defaultFee)); });
    }
    setMessage(page, '', false);
  }

  function loadPage(page) {
    var cached = readCache();
    if (cached) renderPageData(page, cached);
    if (cacheIsFresh(cached)) return;
    if (!cached) setMessage(page, '\u6b63\u5728\u8bfb\u53d6\u8bbe\u7f6e...', false);

    if (!state.request) {
      state.loading = true;
      state.request = Promise.all([
        requestJson(configUrl('fetch') + '?key=subscribe', { headers: headers() }),
        requestJson(adminUrl('plan', 'fetch'), { headers: headers() })
      ]).then(function (results) {
        var data = normalizePageData(results);
        writeCache(data);
        return data;
      }).finally(function () {
        state.loading = false;
        state.request = null;
      });
    }

    state.request.then(function (data) {
      if (page.isConnected) renderPageData(page, data);
    }).catch(function (error) {
      if (!page.isConnected || cached) return;
      setMessage(page, error.message || '\u8bfb\u53d6\u5931\u8d25', true);
      var list = page.querySelector('.xst-plan-list');
      if (list) list.innerHTML = '<div class="xst-plan-empty">\u5957\u9910\u8bfb\u53d6\u5931\u8d25</div>';
    });
  }

  function saveGlobalSettings(page) {
    var button = page.querySelector('.xst-primary-save');
    var input = page.querySelector('.xst-fee');
    var fee = Number(input.value);
    var enabled = page.querySelector('.xst-toggle').getAttribute('aria-checked') === 'true';
    if (!Number.isFinite(fee) || fee < 0) {
      var invalidMessage = '\u8bf7\u8f93\u5165\u6709\u6548\u7684\u9ed8\u8ba4\u8f6c\u8ba9\u8d39\u7528';
      setMessage(page, invalidMessage, true);
      showToast(invalidMessage, 'error');
      input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = '\u4fdd\u5b58\u4e2d...';
    setMessage(page, '', false);
    requestJson(configUrl('save'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        subscription_transfer_enable: enabled ? 1 : 0,
        subscription_transfer_fee: Math.round(fee * 100)
      })
    }).then(function () {
      input.value = fee.toFixed(2);
      var cache = readCache();
      if (cache) {
        cache.subscribe = cache.subscribe || {};
        cache.subscribe.subscription_transfer_enable = enabled ? 1 : 0;
        cache.subscribe.subscription_transfer_fee = Math.round(fee * 100);
        cache.updatedAt = Date.now();
        writeCache(cache);
      }
      setMessage(page, '\u5957\u9910\u8bbe\u7f6e\u5df2\u4fdd\u5b58', false);
      showToast('\u5957\u9910\u8bbe\u7f6e\u5df2\u4fdd\u5b58', 'success');
    }).catch(function (error) {
      var message = error.message || '\u4fdd\u5b58\u5931\u8d25';
      setMessage(page, message, true);
      showToast(message, 'error');
    }).finally(function () {
      button.disabled = false;
      button.textContent = '\u4fdd\u5b58\u8bbe\u7f6e';
    });
  }

  function removeOldPanels() {
    var oldSubscriptionPanel = document.getElementById(OLD_SUBSCRIPTION_PANEL_ID);
    var oldPlanPanel = document.getElementById(OLD_PLAN_PANEL_ID);
    if (oldSubscriptionPanel) oldSubscriptionPanel.remove();
    if (oldPlanPanel) oldPlanPanel.remove();
  }

  function enhance() {
    removeOldPanels();
    if (!isSystemPage()) {
      if (state.active) deactivateCustomView();
      var staleTab = document.getElementById(TAB_ID);
      if (staleTab) staleTab.remove();
      return;
    }
    ensureStyle();
    ensureTab();
    if (state.active && state.explicitActivation && !document.getElementById(PAGE_ID)) mountCustomView(0);
  }

  var scheduled = false;
  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      enhance();
    });
  }

  window.addEventListener('hashchange', function () {
    if (!state.activating) deactivateCustomView();
    window.setTimeout(scheduleEnhance, 40);
  });
  new MutationObserver(scheduleEnhance).observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(scheduleEnhance, 1200);
  scheduleEnhance();
})();
