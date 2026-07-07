(function () {
  var ENTRY_ID = 'xboard-group-buy-entry-style';
  var ENTRY_ATTR = 'data-xboard-group-buy-entry';

  function ensureStyle() {
    if (document.getElementById(ENTRY_ID)) return;
    var style = document.createElement('style');
    style.id = ENTRY_ID;
    style.textContent = [
      '.xboard-group-buy-entry{display:flex;align-items:center;gap:10px;min-height:36px;border-radius:8px;padding:8px 12px;margin:4px 0;color:hsl(var(--foreground));text-decoration:none;font-size:14px;font-weight:500}',
      '.xboard-group-buy-entry:hover{background:hsl(var(--muted));color:hsl(var(--foreground))}',
      '.xboard-group-buy-entry svg{width:16px;height:16px;color:hsl(var(--muted-foreground))}',
      '.xboard-group-buy-entry-fallback{position:fixed;right:18px;bottom:18px;z-index:40;background:hsl(var(--foreground));color:hsl(var(--background));box-shadow:0 12px 28px rgba(15,23,42,.18)}'
    ].join('');
    document.head.appendChild(style);
  }

  function pageUrl() {
    return '/assets/admin/group-buy.html';
  }

  function textOf(node) {
    return String(node && node.textContent ? node.textContent : '').trim();
  }

  function findLabel(label) {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('a, button, [role="menuitem"], div, span'));
    return nodes.find(function (node) {
      return textOf(node) === label;
    });
  }

  function closestItem(node) {
    if (!node) return null;
    if (!node.closest) return null;
    return node.closest('a')
      || node.closest('button')
      || node.closest('[role="menuitem"]')
      || node.closest('li')
      || node.parentElement;
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

  function cloneFrom(reference) {
    var clone = reference.cloneNode(true);
    clone.setAttribute(ENTRY_ATTR, '1');
    clone.setAttribute('href', pageUrl());
    clone.onclick = null;
    clone.classList.remove('active');
    replaceText(clone, '拼团管理');
    clone.addEventListener('click', function (event) {
      event.preventDefault();
      window.location.href = pageUrl();
    });
    return clone;
  }

  function createFallback() {
    var link = document.createElement('a');
    link.href = pageUrl();
    link.className = 'xboard-group-buy-entry xboard-group-buy-entry-fallback';
    link.setAttribute(ENTRY_ATTR, '1');
    link.innerHTML = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>',
      '<circle cx="9" cy="7" r="4"></circle>',
      '<path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>',
      '<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
      '</svg><span>拼团管理</span>'
    ].join('');
    document.body.appendChild(link);
  }

  function inject() {
    if (document.querySelector('[' + ENTRY_ATTR + ']')) return;
    ensureStyle();

    var anchor = closestItem(findLabel('套餐管理')) || closestItem(findLabel('订单管理'));
    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement('afterend', cloneFrom(anchor));
      return;
    }

    if (document.querySelector('#root')) {
      createFallback();
    }
  }

  var observer = new MutationObserver(inject);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  setTimeout(inject, 700);
  setTimeout(inject, 1600);
  setTimeout(inject, 3000);
})();
