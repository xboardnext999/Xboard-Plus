(function () {
  if (window.__xboardSubscriptionTransferSettingsLoaded) return;
  window.__xboardSubscriptionTransferSettingsLoaded = true;

  var PANEL_ID = 'xboard-subscription-transfer-settings';
  var PLAN_PANEL_ID = 'xboard-plan-transfer-prices';
  var STYLE_ID = PANEL_ID + '-style';
  var TOAST_STACK_ID = 'xst-toast-stack';
  var state = { loading: false, loaded: false };
  var planState = { loading: false, signature: '' };

  function apiBase() {
    var base = (window.settings && window.settings.base_url) || '/';
    return String(base).replace(/\/$/, '') + '/api/v2';
  }

  function configUrl(action) {
    var securePath = (window.settings && window.settings.secure_path) || '';
    return apiBase() + '/' + String(securePath).replace(/^\/|\/$/g, '') + '/config/' + action;
  }

  function adminUrl(section, action) {
    var securePath = (window.settings && window.settings.secure_path) || '';
    return apiBase() + '/' + String(securePath).replace(/^\/+|\/+$/g, '') + '/' + section + '/' + action;
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

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + PANEL_ID + '{padding:20px 0 4px;border-top:1px solid hsl(var(--border));margin-top:4px}',
      '#' + PANEL_ID + ' *{box-sizing:border-box}',
      '.xst-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}',
      '.xst-title{font-size:16px;font-weight:600;line-height:1.5;color:hsl(var(--foreground))}',
      '.xst-description{margin-top:4px;font-size:13px;line-height:1.6;color:hsl(var(--muted-foreground))}',
      '.xst-toggle{position:relative;display:inline-flex;width:42px;height:24px;flex:0 0 auto;border:0;border-radius:999px;padding:2px;background:hsl(var(--input));cursor:pointer;transition:background-color .18s ease}',
      '.xst-toggle[aria-checked="true"]{background:hsl(var(--primary))}',
      '.xst-toggle:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px}',
      '.xst-toggle-dot{width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.24);transform:translateX(0);transition:transform .18s ease}',
      '.xst-toggle[aria-checked="true"] .xst-toggle-dot{transform:translateX(18px)}',
      '.xst-fields{display:grid;grid-template-columns:minmax(220px,420px) auto;align-items:end;gap:12px;margin-top:18px}',
      '.xst-label{display:block;margin-bottom:8px;font-size:14px;font-weight:500;color:hsl(var(--foreground))}',
      '.xst-money{display:flex;align-items:center;height:40px;border:1px solid hsl(var(--input));border-radius:6px;background:hsl(var(--background));overflow:hidden;transition:border-color .15s ease,box-shadow .15s ease}',
      '.xst-money:focus-within{border-color:hsl(var(--ring));box-shadow:0 0 0 1px hsl(var(--ring))}',
      '.xst-money input{min-width:0;flex:1;height:100%;border:0;outline:0;background:transparent;padding:0 12px;font-size:14px;color:hsl(var(--foreground))}',
      '.xst-money span{padding:0 12px;border-left:1px solid hsl(var(--input));font-size:12px;color:hsl(var(--muted-foreground))}',
      '.xst-save{height:40px;border:0;border-radius:6px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));padding:0 18px;font-size:14px;font-weight:500;cursor:pointer}',
      '.xst-save:hover{opacity:.9}',
      '.xst-save:disabled{cursor:not-allowed;opacity:.6}',
      '.xst-message{min-height:20px;margin-top:8px;font-size:12px;color:hsl(var(--muted-foreground))}',
      '.xst-message.is-error{color:hsl(var(--destructive))}',
      '.xst-toast-stack{position:fixed;top:20px;right:20px;z-index:2147483000;display:grid;gap:8px;pointer-events:none}',
      '.xst-toast{min-width:260px;max-width:360px;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--background));box-shadow:0 12px 32px rgba(15,23,42,.16);padding:12px 14px;font-size:13px;line-height:1.5;color:hsl(var(--foreground));opacity:0;transform:translateY(-8px);transition:opacity .18s ease,transform .18s ease}',
      '.xst-toast.is-visible{opacity:1;transform:translateY(0)}',
      '.xst-toast.is-success{border-left:3px solid #16a34a}',
      '.xst-toast.is-error{border-left:3px solid hsl(var(--destructive))}',
      '#' + PLAN_PANEL_ID + '{margin:16px 0;padding:16px;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--background))}',
      '#' + PLAN_PANEL_ID + ' *{box-sizing:border-box}',
      '.xst-plan-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}',
      '.xst-plan-title-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px}',
      '.xst-plan-state{display:inline-flex;align-items:center;min-height:24px;border-radius:999px;padding:3px 8px;font-size:12px;font-weight:500}',
      '.xst-plan-state.is-on{background:rgba(22,163,74,.1);color:#15803d}',
      '.xst-plan-state.is-off{background:rgba(220,38,38,.08);color:#b91c1c}',
      '.xst-plan-default{white-space:nowrap;border-radius:4px;background:hsl(var(--muted));padding:5px 8px;font-size:12px;color:hsl(var(--muted-foreground))}',
      '.xst-plan-list{display:grid;gap:0;border-top:1px solid hsl(var(--border))}',
      '.xst-plan-row{display:grid;grid-template-columns:minmax(160px,1fr) minmax(220px,360px) auto;align-items:center;gap:16px;min-height:64px;border-bottom:1px solid hsl(var(--border));padding:10px 0}',
      '.xst-plan-name{min-width:0;font-size:14px;font-weight:500;color:hsl(var(--foreground));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.xst-plan-meta{margin-top:3px;font-size:12px;font-weight:400;color:hsl(var(--muted-foreground))}',
      '.xst-plan-price{display:grid;grid-template-columns:minmax(120px,1fr) auto;align-items:center;gap:8px}',
      '.xst-plan-price .xst-money{height:36px}',
      '.xst-plan-price .xst-money input{font-size:13px}',
      '.xst-plan-clear{border:0;background:transparent;padding:5px 2px;font-size:12px;color:hsl(var(--muted-foreground));cursor:pointer}',
      '.xst-plan-clear:hover{color:hsl(var(--foreground))}',
      '.xst-plan-save{height:36px;min-width:72px;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--background));padding:0 14px;font-size:13px;font-weight:500;color:hsl(var(--foreground));cursor:pointer}',
      '.xst-plan-save:hover{background:hsl(var(--muted))}',
      '.xst-plan-save:disabled{cursor:not-allowed;opacity:.6}',
      '.xst-plan-empty{padding:20px 0;text-align:center;font-size:13px;color:hsl(var(--muted-foreground))}',
      '@media(max-width:640px){.xst-fields{grid-template-columns:1fr}.xst-save{width:100%}}',
      '@media(max-width:760px){.xst-plan-row{grid-template-columns:1fr}.xst-plan-save{width:100%}.xst-plan-default{white-space:normal}}'
    ].join('');
    document.head.appendChild(style);
  }

  function findSubscribeInput() {
    var direct = document.querySelector('input[name="subscribe_path"]');
    if (direct) return direct;
    var inputs = Array.prototype.slice.call(document.querySelectorAll('input'));
    return inputs.find(function (input) {
      var text = [input.name, input.id, input.placeholder, input.getAttribute('aria-label')]
        .filter(Boolean)
        .join(' ');
      return /subscribe[_ -]?path|\u8ba2\u9605\u8def\u5f84/i.test(text);
    }) || null;
  }

  function findMount(input) {
    var node = input;
    for (var i = 0; node && i < 7; i += 1, node = node.parentElement) {
      if (node.parentElement && node.querySelectorAll('input').length === 1 && node.textContent.length > 20) {
        return node;
      }
    }
    return input.parentElement;
  }

  function setMessage(panel, text, isError) {
    var message = panel.querySelector('.xst-message');
    message.textContent = text || '';
    message.classList.toggle('is-error', Boolean(isError));
  }

  function showToast(message, type) {
    ensureStyle();
    var stack = document.getElementById(TOAST_STACK_ID);
    if (!stack) {
      stack = document.createElement('div');
      stack.id = TOAST_STACK_ID;
      stack.className = 'xst-toast-stack';
      document.body.appendChild(stack);
    }
    var toast = document.createElement('div');
    var toastType = type === 'error' ? 'error' : 'success';
    toast.className = 'xst-toast is-' + toastType;
    toast.setAttribute('role', toastType === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    stack.appendChild(toast);
    window.requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    window.setTimeout(function () {
      toast.classList.remove('is-visible');
      window.setTimeout(function () {
        toast.remove();
        if (!stack.childElementCount) stack.remove();
      }, 220);
    }, 3200);
  }

  function setToggle(button, enabled) {
    button.setAttribute('aria-checked', enabled ? 'true' : 'false');
  }

  async function loadConfig(panel) {
    if (state.loading) return;
    state.loading = true;
    setMessage(panel, '\u6b63\u5728\u8bfb\u53d6\u8bbe\u7f6e...', false);
    try {
      var response = await fetch(configUrl('fetch') + '?key=subscribe', { headers: headers() });
      var json = await response.json().catch(function () { return {}; });
      if (!response.ok || json.status === 'fail') throw new Error(json.message || '\u8bfb\u53d6\u5931\u8d25');
      var subscribe = json.data && json.data.subscribe ? json.data.subscribe : {};
      setToggle(panel.querySelector('.xst-toggle'), Boolean(subscribe.subscription_transfer_enable));
      panel.querySelector('.xst-fee').value = ((Number(subscribe.subscription_transfer_fee) || 0) / 100).toFixed(2);
      state.loaded = true;
      setMessage(panel, '', false);
    } catch (error) {
      setMessage(panel, error.message || '\u8bfb\u53d6\u5931\u8d25', true);
    } finally {
      state.loading = false;
    }
  }

  async function saveConfig(panel) {
    var button = panel.querySelector('.xst-save');
    var feeInput = panel.querySelector('.xst-fee');
    var fee = Number(feeInput.value);
    if (!Number.isFinite(fee) || fee < 0) {
      var invalidMessage = '\u8bf7\u8f93\u5165\u6709\u6548\u7684\u8f6c\u8ba9\u8d39\u7528';
      setMessage(panel, invalidMessage, true);
      showToast(invalidMessage, 'error');
      feeInput.focus();
      return;
    }

    button.disabled = true;
    button.textContent = '\u4fdd\u5b58\u4e2d...';
    setMessage(panel, '', false);
    try {
      var response = await fetch(configUrl('save'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          subscription_transfer_enable: panel.querySelector('.xst-toggle').getAttribute('aria-checked') === 'true' ? 1 : 0,
          subscription_transfer_fee: Math.round(fee * 100)
        })
      });
      var json = await response.json().catch(function () { return {}; });
      if (!response.ok || json.status === 'fail') throw new Error(json.message || '\u4fdd\u5b58\u5931\u8d25');
      feeInput.value = fee.toFixed(2);
      setMessage(panel, '\u5957\u9910\u8f6c\u8ba9\u8bbe\u7f6e\u5df2\u4fdd\u5b58', false);
      showToast('\u5957\u9910\u8f6c\u8ba9\u8bbe\u7f6e\u5df2\u4fdd\u5b58', 'success');
    } catch (error) {
      var errorMessage = error.message || '\u4fdd\u5b58\u5931\u8d25';
      setMessage(panel, errorMessage, true);
      showToast(errorMessage, 'error');
    } finally {
      button.disabled = false;
      button.textContent = '\u4fdd\u5b58\u8bbe\u7f6e';
    }
  }

  function buildPanel() {
    var panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = [
      '<div class="xst-head">',
      '  <div><div class="xst-title">\u5957\u9910\u8f6c\u8ba9</div><div class="xst-description">\u5141\u8bb8\u7528\u6237\u5c06\u542f\u7528\u4e2d\u7684\u5957\u9910\u8f6c\u8ba9\u7ed9\u5176\u4ed6\u5df2\u6ce8\u518c\u8d26\u53f7\uff0c\u8f6c\u8ba9\u8d39\u4ece\u53d1\u8d77\u4eba\u4f59\u989d\u6263\u9664\u3002\u53ef\u5728\u5957\u9910\u7ba1\u7406\u4e2d\u4e3a\u6bcf\u4e2a\u5957\u9910\u5355\u72ec\u5b9a\u4ef7\u3002</div></div>',
      '  <button class="xst-toggle" type="button" role="switch" aria-checked="false" aria-label="\u5141\u8bb8\u7528\u6237\u8f6c\u8ba9\u5957\u9910"><span class="xst-toggle-dot"></span></button>',
      '</div>',
      '<div class="xst-fields">',
      '  <div><label class="xst-label" for="xst-fee">\u9ed8\u8ba4\u8f6c\u8ba9\u8d39\u7528</label><div class="xst-money"><input id="xst-fee" class="xst-fee" type="number" min="0" step="0.01" inputmode="decimal" value="0.00"><span>\u4f59\u989d\u91d1\u989d</span></div></div>',
      '  <button class="xst-save" type="button">\u4fdd\u5b58\u8bbe\u7f6e</button>',
      '</div>',
      '<div class="xst-message" role="status" aria-live="polite"></div>'
    ].join('');

    panel.querySelector('.xst-toggle').addEventListener('click', function (event) {
      setToggle(event.currentTarget, event.currentTarget.getAttribute('aria-checked') !== 'true');
    });
    panel.querySelector('.xst-save').addEventListener('click', function () { saveConfig(panel); });
    return panel;
  }

  function isPlanPage() {
    return /^#\/finance\/plan(?:\?|$)/.test(window.location.hash || '') && !/[?&]xgb=group-buy(?:&|$)/.test(window.location.hash || '');
  }

  function findPlanSearchInput() {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('input'));
    return inputs.find(function (input) {
      var text = [input.placeholder, input.getAttribute('aria-label')].filter(Boolean).join(' ');
      return /\u641c\u7d22\u5957\u9910/.test(text);
    }) || null;
  }

  function findPlanMount(input) {
    var node = input;
    for (var i = 0; node && i < 5; i += 1, node = node.parentElement) {
      if (!node.parentElement) break;
      var buttons = node.querySelectorAll('button').length;
      var inputs = node.querySelectorAll('input').length;
      if (buttons >= 1 && inputs === 1 && node.getBoundingClientRect().width > 420) return node;
    }
    return input.parentElement;
  }

  async function requestJson(url, options) {
    var response = await fetch(url, options || { headers: headers() });
    var json = await response.json().catch(function () { return {}; });
    if (!response.ok || json.status === 'fail') throw new Error(json.message || '\u8bf7\u6c42\u5931\u8d25');
    return json;
  }

  function planPriceText(rawPrice, defaultFee) {
    if (rawPrice === null || typeof rawPrice === 'undefined' || rawPrice === '') {
      return '\u7ee7\u627f\u9ed8\u8ba4\u8d39\u7528 \u00a5' + (defaultFee / 100).toFixed(2);
    }
    if (Number(rawPrice) === 0) return '\u514d\u8d39\u8f6c\u8ba9';
    return '\u72ec\u7acb\u8d39\u7528 \u00a5' + (Number(rawPrice) / 100).toFixed(2);
  }

  async function savePlanPrice(row, planId, defaultFee, transferEnabled) {
    var input = row.querySelector('.xst-plan-fee');
    var button = row.querySelector('.xst-plan-save');
    var raw = input.value.trim();
    var cents = null;
    if (raw !== '') {
      var amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        input.focus();
        row.querySelector('.xst-plan-meta').textContent = '\u8bf7\u8f93\u5165\u6709\u6548\u7684\u8f6c\u8ba9\u8d39\u7528';
        showToast('\u8bf7\u8f93\u5165\u6709\u6548\u7684\u8f6c\u8ba9\u8d39\u7528', 'error');
        return;
      }
      cents = Math.round(amount * 100);
    }

    button.disabled = true;
    button.textContent = '\u4fdd\u5b58\u4e2d...';
    try {
      var json = await requestJson(adminUrl('plan', 'transfer-price'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ id: planId, transfer_price: cents })
      });
      var saved = json.data && Object.prototype.hasOwnProperty.call(json.data, 'transfer_price')
        ? json.data.transfer_price
        : cents;
      input.value = saved === null ? '' : (Number(saved) / 100).toFixed(2);
      row.querySelector('.xst-plan-meta').textContent = planPriceText(saved, defaultFee) + ' \u00b7 \u5df2\u4fdd\u5b58';
      showToast(transferEnabled
        ? '\u5957\u9910\u8f6c\u8ba9\u4ef7\u683c\u5df2\u4fdd\u5b58'
        : '\u4ef7\u683c\u5df2\u4fdd\u5b58\uff1b\u5957\u9910\u8f6c\u8ba9\u603b\u5f00\u5173\u4ecd\u672a\u5f00\u542f', 'success');
    } catch (error) {
      var errorMessage = error.message || '\u4fdd\u5b58\u5931\u8d25';
      row.querySelector('.xst-plan-meta').textContent = errorMessage;
      showToast(errorMessage, 'error');
    } finally {
      button.disabled = false;
      button.textContent = '\u4fdd\u5b58';
    }
  }

  function buildPlanRow(plan, defaultFee, transferEnabled) {
    var row = document.createElement('div');
    row.className = 'xst-plan-row';

    var info = document.createElement('div');
    var name = document.createElement('div');
    name.className = 'xst-plan-name';
    name.textContent = plan.name || ('\u5957\u9910 #' + plan.id);
    var meta = document.createElement('div');
    meta.className = 'xst-plan-meta';
    meta.textContent = planPriceText(plan.transfer_price, defaultFee);
    info.appendChild(name);
    info.appendChild(meta);

    var price = document.createElement('div');
    price.className = 'xst-plan-price';
    var money = document.createElement('div');
    money.className = 'xst-money';
    var input = document.createElement('input');
    input.className = 'xst-plan-fee';
    input.type = 'number';
    input.min = '0';
    input.step = '0.01';
    input.inputMode = 'decimal';
    input.placeholder = '\u7559\u7a7a\u7ee7\u627f\u9ed8\u8ba4';
    input.value = plan.transfer_price === null || typeof plan.transfer_price === 'undefined'
      ? ''
      : (Number(plan.transfer_price) / 100).toFixed(2);
    var unit = document.createElement('span');
    unit.textContent = '\u4f59\u989d\u91d1\u989d';
    money.appendChild(input);
    money.appendChild(unit);
    var clear = document.createElement('button');
    clear.className = 'xst-plan-clear';
    clear.type = 'button';
    clear.textContent = '\u6062\u590d\u9ed8\u8ba4';
    clear.addEventListener('click', function () {
      input.value = '';
      input.focus();
    });
    price.appendChild(money);
    price.appendChild(clear);

    var save = document.createElement('button');
    save.className = 'xst-plan-save';
    save.type = 'button';
    save.textContent = '\u4fdd\u5b58';
    save.addEventListener('click', function () { savePlanPrice(row, plan.id, defaultFee, transferEnabled); });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        save.click();
      }
    });

    row.appendChild(info);
    row.appendChild(price);
    row.appendChild(save);
    return row;
  }

  function buildPlanPanel(plans, defaultFee, transferEnabled) {
    var panel = document.createElement('section');
    panel.id = PLAN_PANEL_ID;
    panel.innerHTML = [
      '<div class="xst-plan-head">',
      '  <div><div class="xst-plan-title-line"><div class="xst-title">\u5957\u9910\u8f6c\u8ba9\u4ef7\u683c</div><span class="xst-plan-state ' + (transferEnabled ? 'is-on' : 'is-off') + '">' + (transferEnabled ? '\u5957\u9910\u8f6c\u8ba9\u5df2\u5f00\u542f' : '\u5957\u9910\u8f6c\u8ba9\u672a\u5f00\u542f') + '</span></div><div class="xst-description">' + (transferEnabled ? '\u4e3a\u6bcf\u4e2a\u5957\u9910\u8bbe\u7f6e\u5355\u6b21\u8f6c\u8ba9\u8d39\u7528\u3002\u7559\u7a7a\u7ee7\u627f\u7cfb\u7edf\u9ed8\u8ba4\uff0c\u586b 0 \u8868\u793a\u514d\u8d39\u8f6c\u8ba9\u3002' : '\u5df2\u4fdd\u5b58\u7684\u5957\u9910\u4ef7\u683c\u4f1a\u4fdd\u7559\uff0c\u5f00\u542f\u201c\u7cfb\u7edf\u914d\u7f6e > \u8ba2\u9605\u8bbe\u7f6e > \u5957\u9910\u8f6c\u8ba9\u201d\u540e\u624d\u4f1a\u5728\u524d\u7aef\u751f\u6548\u3002') + '</div></div>',
      '  <div class="xst-plan-default">\u7cfb\u7edf\u9ed8\u8ba4 \u00a5' + (defaultFee / 100).toFixed(2) + '</div>',
      '</div>',
      '<div class="xst-plan-list"></div>'
    ].join('');
    var list = panel.querySelector('.xst-plan-list');
    if (!plans.length) {
      var empty = document.createElement('div');
      empty.className = 'xst-plan-empty';
      empty.textContent = '\u6682\u65e0\u5957\u9910';
      list.appendChild(empty);
    } else {
      plans.forEach(function (plan) { list.appendChild(buildPlanRow(plan, defaultFee, transferEnabled)); });
    }
    return panel;
  }

  async function enhancePlanPrices() {
    var existing = document.getElementById(PLAN_PANEL_ID);
    if (!isPlanPage()) {
      if (existing) existing.remove();
      planState.signature = '';
      return;
    }
    var input = findPlanSearchInput();
    if (!input || existing || planState.loading) return;

    planState.loading = true;
    ensureStyle();
    try {
      var results = await Promise.all([
        requestJson(adminUrl('plan', 'fetch'), { headers: headers() }),
        requestJson(configUrl('fetch') + '?key=subscribe', { headers: headers() })
      ]);
      if (!isPlanPage() || document.getElementById(PLAN_PANEL_ID)) return;
      var plans = Array.isArray(results[0].data) ? results[0].data : [];
      var subscribe = results[1].data && results[1].data.subscribe ? results[1].data.subscribe : {};
      var defaultFee = Math.max(0, Number(subscribe.subscription_transfer_fee) || 0);
      var transferEnabled = Boolean(subscribe.subscription_transfer_enable);
      var panel = buildPlanPanel(plans, defaultFee, transferEnabled);
      findPlanMount(input).insertAdjacentElement('beforebegin', panel);
    } catch (error) {
      if (!document.getElementById(PLAN_PANEL_ID) && isPlanPage()) {
        var errorPanel = document.createElement('section');
        errorPanel.id = PLAN_PANEL_ID;
        errorPanel.innerHTML = '<div class="xst-title">\u5957\u9910\u8f6c\u8ba9\u4ef7\u683c</div><div class="xst-description">' + String(error.message || '\u8bfb\u53d6\u5931\u8d25') + '</div>';
        findPlanMount(input).insertAdjacentElement('beforebegin', errorPanel);
      }
    } finally {
      planState.loading = false;
    }
  }

  function enhance() {
    enhancePlanPrices();
    var input = findSubscribeInput();
    var existing = document.getElementById(PANEL_ID);
    if (!input) {
      if (existing && !document.body.contains(existing.closest('form'))) existing.remove();
      return;
    }
    if (existing) return;

    ensureStyle();
    state.loaded = false;
    var panel = buildPanel();
    var mount = findMount(input);
    mount.insertAdjacentElement('afterend', panel);
    loadConfig(panel);
  }

  var observer = new MutationObserver(function () { window.requestAnimationFrame(enhance); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', function () { setTimeout(enhance, 50); });
  setInterval(enhance, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
})();
