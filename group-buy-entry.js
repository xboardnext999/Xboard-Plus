(function () {
  var ENTRY_ID = 'xboard-group-buy-entry-style';
  var ENTRY_ATTR = 'data-xboard-group-buy-entry';
  var ANCHOR_LABELS = [
    '套餐管理',
    'Plan Management',
    '套餐',
    'Plan'
  ];

  function ensureStyle() {
    if (document.getElementById(ENTRY_ID)) return;
    var style = document.createElement('style');
    style.id = ENTRY_ID;
    style.textContent = [
      '[' + ENTRY_ATTR + '="menu"]{cursor:pointer}',
      '[' + ENTRY_ATTR + '="menu"] svg{flex-shrink:0}'
    ].join('');
    document.head.appendChild(style);
  }

  function pageUrl() {
    return '/assets/admin/group-buy.html';
  }

  function textOf(node) {
    return String(node && node.textContent ? node.textContent : '').replace(/\s+/g, '').trim();
  }

  function isSidebarCandidate(node) {
    if (!node || !node.getBoundingClientRect) return false;
    var rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left < Math.min(520, window.innerWidth * 0.42);
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

  function cloneFrom(reference) {
    var clone = reference.cloneNode(true);
    clone.setAttribute(ENTRY_ATTR, 'menu');
    clone.setAttribute('href', pageUrl());
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
    clone.addEventListener('click', function (event) {
      event.preventDefault();
      window.location.href = pageUrl();
    });
    return clone;
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
        if (existing.previousElementSibling !== anchor) {
          existing.remove();
          anchor.insertAdjacentElement('afterend', cloneFrom(anchor));
        }
        return;
      }
      anchor.insertAdjacentElement('afterend', cloneFrom(anchor));
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
