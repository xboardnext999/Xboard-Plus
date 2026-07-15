(function () {
  var PANEL_ID = 'xboard-subscription-transfer-settings';
  var STYLE_ID = PANEL_ID + '-style';
  var state = { loading: false, loaded: false };

  function apiBase() {
    var base = (window.settings && window.settings.base_url) || '/';
    return String(base).replace(/\/$/, '') + '/api/v2';
  }

  function configUrl(action) {
    var securePath = (window.settings && window.settings.secure_path) || '';
    return apiBase() + '/' + String(securePath).replace(/^\/|\/$/g, '') + '/config/' + action;
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
      '@media(max-width:640px){.xst-fields{grid-template-columns:1fr}.xst-save{width:100%}}'
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
      setMessage(panel, '\u8bf7\u8f93\u5165\u6709\u6548\u7684\u8f6c\u8ba9\u8d39\u7528', true);
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
    } catch (error) {
      setMessage(panel, error.message || '\u4fdd\u5b58\u5931\u8d25', true);
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
      '  <div><div class="xst-title">\u5957\u9910\u8f6c\u8ba9</div><div class="xst-description">\u5141\u8bb8\u7528\u6237\u5c06\u542f\u7528\u4e2d\u7684\u5957\u9910\u8f6c\u8ba9\u7ed9\u5176\u4ed6\u5df2\u6ce8\u518c\u8d26\u53f7\uff0c\u6bcf\u6b21\u8f6c\u8ba9\u4ece\u53d1\u8d77\u4eba\u4f59\u989d\u6263\u8d39\u3002</div></div>',
      '  <button class="xst-toggle" type="button" role="switch" aria-checked="false" aria-label="\u5141\u8bb8\u7528\u6237\u8f6c\u8ba9\u5957\u9910"><span class="xst-toggle-dot"></span></button>',
      '</div>',
      '<div class="xst-fields">',
      '  <div><label class="xst-label" for="xst-fee">\u5355\u6b21\u8f6c\u8ba9\u8d39\u7528</label><div class="xst-money"><input id="xst-fee" class="xst-fee" type="number" min="0" step="0.01" inputmode="decimal" value="0.00"><span>\u4f59\u989d\u91d1\u989d</span></div></div>',
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

  function enhance() {
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
