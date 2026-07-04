(function () {
  var MAX_SIZE = 2 * 1024 * 1024;
  var STYLE_ID = 'xboard-logo-upload-style';

  function apiBase() {
    var base = (window.settings && window.settings.base_url) || '/';
    base = String(base).replace(/\/$/, '');
    return (base || '') + '/api/v2';
  }

  function uploadUrl() {
    var securePath = (window.settings && window.settings.secure_path) || '';
    return apiBase() + '/' + String(securePath).replace(/^\/|\/$/g, '') + '/config/uploadLogo';
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

  function setNativeValue(input, value) {
    var descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.xboard-logo-upload{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}',
      '.xboard-logo-upload-preview{width:42px;height:42px;border:1px solid hsl(var(--border));border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}',
      '.dark .xboard-logo-upload-preview{background:hsl(var(--background))}',
      '.xboard-logo-upload-preview img{max-width:100%;max-height:100%;object-fit:contain}',
      '.xboard-logo-upload-btn{height:32px;border:1px solid hsl(var(--border));border-radius:6px;background:hsl(var(--background));padding:0 12px;font-size:13px;line-height:30px;color:hsl(var(--foreground))}',
      '.xboard-logo-upload-btn:hover{background:hsl(var(--muted))}',
      '.xboard-logo-upload-btn:disabled{cursor:not-allowed;opacity:.65}',
      '.xboard-logo-upload-hint{font-size:12px;color:hsl(var(--muted-foreground))}',
      '.xboard-logo-upload-msg{width:100%;font-size:12px;color:hsl(var(--muted-foreground))}',
      '.xboard-logo-upload-msg.is-error{color:hsl(var(--destructive))}'
    ].join('');
    document.head.appendChild(style);
  }

  function inputLooksLikeLogo(input) {
    if (!input || input.type === 'file' || input.type === 'hidden') return false;
    var text = [
      input.name,
      input.id,
      input.getAttribute('aria-label'),
      input.getAttribute('placeholder')
    ].filter(Boolean).join(' ');
    return /logo/i.test(text);
  }

  function findInputNearLogoLabel() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll('label, span, div, p'));
    for (var i = 0; i < candidates.length; i += 1) {
      var label = candidates[i];
      if (String(label.textContent || '').trim().toLowerCase() !== 'logo') continue;
      var node = label;
      for (var depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
        var input = node.querySelector && node.querySelector('input:not([type="file"]):not([type="hidden"])');
        if (input) return input;
      }
    }
    return null;
  }

  function findLogoInput() {
    return document.querySelector('input[name="logo"]')
      || Array.prototype.slice.call(document.querySelectorAll('input')).find(inputLooksLikeLogo)
      || findInputNearLogoLabel();
  }

  function enhanceLogoInput() {
    var input = findLogoInput();
    if (!input || input.dataset.logoUploadReady === '1') return;

    input.dataset.logoUploadReady = '1';
    ensureStyle();

    var row = document.createElement('div');
    row.className = 'xboard-logo-upload';

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif';
    fileInput.hidden = true;

    var preview = document.createElement('div');
    preview.className = 'xboard-logo-upload-preview';
    var img = document.createElement('img');
    img.alt = '';
    preview.appendChild(img);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'xboard-logo-upload-btn';
    button.textContent = '上传LOGO';

    var hint = document.createElement('span');
    hint.className = 'xboard-logo-upload-hint';
    hint.textContent = '支持 JPG、PNG、WebP、GIF，最大 2MB';

    var msg = document.createElement('span');
    msg.className = 'xboard-logo-upload-msg';

    function updatePreview() {
      var value = String(input.value || '').trim();
      img.style.display = value ? 'block' : 'none';
      if (value) img.src = value;
    }

    function setMessage(text, isError) {
      msg.textContent = text || '';
      msg.classList.toggle('is-error', Boolean(isError));
    }

    button.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', async function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > MAX_SIZE) {
        setMessage('LOGO大小不能超过2MB', true);
        fileInput.value = '';
        return;
      }

      var formData = new FormData();
      formData.append('logo', file);
      button.disabled = true;
      button.textContent = '上传中...';
      setMessage('', false);

      try {
        var response = await fetch(uploadUrl(), {
          method: 'POST',
          headers: {
            Authorization: authToken(),
            'Content-Language': localStorage.getItem('i18nextLng') || 'zh-CN'
          },
          body: formData
        });
        var json = await response.json().catch(function () { return {}; });
        if (!response.ok || json.status === 'fail') {
          throw new Error(json.message || '上传失败');
        }
        var logo = json.data && (json.data.logo || json.data.url);
        if (!logo) throw new Error('上传失败');
        setNativeValue(input, logo);
        updatePreview();
        setMessage('已上传并写入LOGO路径', false);
      } catch (error) {
        setMessage(error.message || '上传失败', true);
      } finally {
        button.disabled = false;
        button.textContent = '上传LOGO';
        fileInput.value = '';
      }
    });

    input.addEventListener('input', updatePreview);
    row.appendChild(fileInput);
    row.appendChild(preview);
    row.appendChild(button);
    row.appendChild(hint);
    row.appendChild(msg);
    input.insertAdjacentElement('afterend', row);
    updatePreview();
  }

  var observer = new MutationObserver(enhanceLogoInput);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  var retryCount = 0;
  var retryTimer = setInterval(function () {
    enhanceLogoInput();
    retryCount += 1;
    if (document.querySelector('.xboard-logo-upload') || retryCount > 40) {
      clearInterval(retryTimer);
    }
  }, 500);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceLogoInput);
  } else {
    enhanceLogoInput();
  }
})();
