/**
 * Content Script - AI History Cleaner
 * 
 * @author yxstars@outlook.com
 * @copyright Copyright (c) 2026 yxstars@outlook.com. All rights reserved.
 * @license MIT License
 * 
 * 支持: ChatGPT, Claude, Gemini, DeepSeek, Grok, 豆包, 通义千问, Kimi, 智谱清言, 腾讯元宝, Perplexity, Copilot, Poe
 */
(function () {
  'use strict';

  if (window.aiHistoryCleanerInjected) return;
  window.aiHistoryCleanerInjected = true;

  const SOURCE = 'AI_HISTORY_CLEANER';
  const DELETE_WORDS = ['删除', 'delete', 'remove', 'trash', '移除', '清除', 'archive', '归档', 'discard', '丢弃', '清空', 'clear'];
  const CONFIRM_WORDS = ['确认', '确定', '删除', 'delete', 'yes', 'ok', 'continue', 'confirm', '是', '同意', 'approve', ' permanently'];
  const ARCHIVE_WORDS = ['archive', '归档', '存档', 'archived'];
  const SKIP_WORDS = ['账号', 'account', 'workspace', 'project', '团队', 'team', 'profile', '个人'];
  const BULK_DELETE_PATTERNS = [
    'delete all chats', 'clear all chats', 'clear chat history',
    'delete all conversations', '删除所有聊天', '清除所有聊天',
    '删除全部对话', '清空历史记录', 'clear all', 'delete all', 'clear chat'
  ];

  // ============ 站点选择器配置 ============
  const SITE_ITEM_SELECTORS = {
    'chatgpt.com': [
      'nav a[href^="/c/"]',
      'aside a[href^="/c/"]',
      '#history a[draggable="true"][href^="/c/"]',
      '[data-testid^="history-item-"]',
      '[data-testid*="conversation-item"]',
      '[data-testid*="history"] a[href^="/c/"]',
      'li[data-testid*="conversation"] a',
      '[role="listitem"] a[href*="/c/"]',
      'div[data-qa*="conversation"] a',
      // 2024-2025年ChatGPT新UI选择器
      '[data-testid="history-list"] a[href^="/c/"]',
      '[class*="chat-list"] a[href^="/c/"]',
      '[class*="conversations"] a[href^="/c/"]',
      'div[class*="group"] a[href^="/c/"]'
    ],
    'chat.openai.com': [
      'nav a[href^="/c/"]',
      'aside a[href^="/c/"]',
      '#history a[draggable="true"][href^="/c/"]',
      '[data-testid^="history-item-"]',
      '[data-testid*="conversation-item"]',
      '[data-testid="history-list"] a[href^="/c/"]'
    ],
    'claude.ai': [
      'a[href^="/chat/"]',
      '[data-testid*="conversation"]',
      '[data-testid*="chat-row"]',
      '[class*="conversation"] a',
      '[class*="ConversationListItem"]',
      'li[role="option"]',
      'div[class*="chat-list"] a',
      // 2024-2025年Claude新UI选择器
      '[data-testid="chat-item"]',
      '[class*="ChatListItem"]',
      'a[href*="/claude/"]',
      'div[class*="group"] a[href^="/chat"]'
    ],
    'gemini.google.com': [
      'div[data-test-id="conversation"]',
      'a[href*="/app/"]',
      '.chat-history div[role="listitem"]',
      '[class*="conversation"]',
      'mat-list-item',
      '[role="listitem"] a',
      'div[jsname][class*="chat"]'
    ],
    'www.doubao.com': [
      'a[class*="chat-item"][href*="/chat/"]',
      '[class*="session-item"]',
      '[class*="conversation-item"]'
    ],
    'chat.deepseek.com': [
      'a[href*="/chat/"]',
      '[class*="conversation"]',
      '[class*="chat-item"]',
      '[class*="session-item"]',
      '[role="option"]',
      'div[class*="sidebar"] a[href*="/chat"]'
    ],
    'kimi.moonshot.cn': [
      '[class*="conversation"]',
      '[class*="chat-list"] > div',
      '[class*="chat-item"]',
      'a[href*="/chat/"]',
      'div[role="listitem"]'
    ],
    'grok.com': [
      'a[href*="/conversations/"]',
      'a[href*="/chat/"]',
      '[class*="conversation"]',
      '[class*="chat-item"]',
      '[role="option"]'
    ],
    'tongyi.aliyun.com': [
      '[class*="conversation"]',
      '[class*="chat-item"]',
      '[class*="session-item"]',
      'a[href*="/chat/"]',
      'div[role="listitem"]'
    ],
    'chatglm.cn': [
      '[class*="conversation"]',
      '[class*="chat-item"]',
      '[class*="session-item"]',
      'a[href*="/chat/"]',
      'div[role="option"]'
    ],
    'yuanbao.tencent.com': [
      '[class*="conversation"]',
      '[class*="chat-item"]',
      '[class*="session-item"]',
      'a[href*="/chat/"]',
      'div[role="listitem"]'
    ],
    'www.perplexity.ai': [
      'a[href*="/search/"]',
      '[class*="thread"]',
      '[class*="conversation"]',
      '[class*="history-item"]',
      'div[role="listitem"] a',
      'a[href*="/t/"]'
    ],
    'copilot.microsoft.com': [
      '[class*="conversation"]',
      '[class*="chat-item"]',
      '[class*="thread"]',
      'a[href*="/chats/"]',
      'a[href*="/c/"]',
      '[role="listitem"]'
    ],
    'poe.com': [
      'a[class*="ChatHistory"]',
      'a[href*="/chat/"]',
      '[class*="conversation"]',
      '[class*="ChatListItem"]',
      '[class*="chat-item"]'
    ],
    default: [
      'a[href*="chat"]',
      '[class*="conversation-item"]',
      '[class*="conversation"]',
      '[class*="chat-item"]',
      '[class*="history-item"]',
      '[class*="session-item"]',
      '[role="listitem"]',
      '[role="option"]'
    ]
  };

  // ============ 基础工具函数 ============
  function send(type, data = {}) {
    try {
      const result = chrome.runtime.sendMessage({ source: SOURCE, type, data });
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    } catch (e) {}
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function log(message, type = 'info') {
    console.log(`[AI Cleaner v3] ${message}`);
    send('LOG', { message, type });
  }

  function getHostKey() {
    const host = window.location.hostname;
    return Object.keys(SITE_ITEM_SELECTORS).find((k) => k !== 'default' && host.includes(k)) || 'default';
  }

  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function normalizeText(el) {
    const text =
      el?.textContent?.trim() ||
      el?.getAttribute?.('aria-label')?.trim() ||
      el?.getAttribute?.('title')?.trim() ||
      el?.getAttribute?.('data-testid')?.trim() ||
      '';
    return text.toLowerCase();
  }

  function isLikelyConversationItem(el) {
    const text = normalizeText(el);
    if (!text) return false;
    if (text.length > 300) return false;
    if (text.includes('new chat') || text.includes('新建聊天') || text.includes('开始新对话') || text.includes('new thread')) return false;
    return true;
  }

  function uniqueElements(list) {
    return Array.from(new Set(list)).filter(Boolean);
  }

  // ============ 豆包样式注入 ============
  function injectDoubaoStyles() {
    if (!window.location.hostname.includes('doubao.com')) return;
    const style = document.createElement('style');
    style.textContent = `
      a[class*="chat-item"] [class*="extra"] {
        opacity: 1 !important; visibility: visible !important; display: flex !important;
        min-width: 22px !important; width: 22px !important; pointer-events: auto !important;
      }
      a[class*="chat-item"] [class*="extra"] button {
        visibility: visible !important; opacity: 1 !important; display: flex !important;
        min-width: 22px !important; width: 22px !important; height: 22px !important;
        pointer-events: auto !important; position: relative !important;
      }
    `;
    document.head.appendChild(style);
  }
  injectDoubaoStyles();

  // ============ 豆包 Radix UI 菜单等待 ============
  async function waitForRadixMenuOpen(menuBtn) {
    if (!menuBtn) return false;
    if (menuBtn.getAttribute('data-state') === 'open') return true;
    for (let i = 0; i < 15; i++) {
      await sleep(200);
      if (menuBtn.getAttribute('data-state') === 'open') {
        await sleep(500);
        return true;
      }
      const portals = document.querySelectorAll('[data-radix-popper-content-wrapper]');
      if (portals.length > 0) { await sleep(300); return true; }
    }
    return false;
  }

  function findRadixMenuDeleteButton() {
    const containers = document.querySelectorAll('[data-radix-popper-content-wrapper], [role="menu"]');
    for (const container of containers) {
      if (!isVisible(container)) continue;
      const items = container.querySelectorAll('[role="menuitem"], button');
      for (const el of items) {
        if (!isVisible(el)) continue;
        const text = normalizeText(el);
        if (!text || text.length > 50) continue;
        if (hasDeleteWord(text) && !hasSkipWord(text)) {
          log('找到删除按钮(Radix): "' + text.substring(0, 50) + '"', 'success');
          return el;
        }
      }
    }
    return null;
  }

  // ============ 点击 & 事件模拟 ============
  function dispatchHover(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.right - 5;
    const y = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    el.dispatchEvent(new MouseEvent('mouseenter', opts));
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new MouseEvent('mousemove', opts));
  }

  function clickElement(el) {
    if (!el) return false;
    try {
      el.scrollIntoView({ block: 'center' });
      el.focus();
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, buttons: 1 }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, buttons: 0 }));
      el.click();
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    } catch (e) {
      log(`clickElement异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ 文本匹配 ============
  function hasDeleteWord(text) { return DELETE_WORDS.some((w) => text.includes(w)); }
  function hasConfirmWord(text) { return CONFIRM_WORDS.some((w) => text.includes(w)); }
  function hasSkipWord(text) { return SKIP_WORDS.some((w) => text.includes(w)); }
  function hasBulkDeleteText(text) { return BULK_DELETE_PATTERNS.some((w) => text.includes(w)); }
  function hasArchiveWord(text) { return ARCHIVE_WORDS.some((w) => text.includes(w)); }

  // ============ 对话项检测 ============
  function getConversationItems() {
    if (isChatGPTHost()) {
      const chatgptRows = getChatGPTRowElements();
      if (chatgptRows.length) {
        log(`ChatGPT: 检测到 ${chatgptRows.length} 条记录`, 'info');
        return chatgptRows;
      }
    }

    const hostKey = getHostKey();
    const selectors = SITE_ITEM_SELECTORS[hostKey] || SITE_ITEM_SELECTORS.default;
    const all = [];

    log(`使用主机密钥: ${hostKey}, 选择器数: ${selectors.length}`, 'debug');

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          log(`选择器 "${selector.substring(0, 40)}" 匹配 ${elements.length} 个元素`, 'debug');
        }
        elements.forEach((el) => all.push(el));
      } catch (e) {}
    }

    const unique = uniqueElements(all);
    const filtered = unique.filter((el) => isVisible(el) && isLikelyConversationItem(el));
    log(`筛选后获得 ${filtered.length} 条可见历史项`, 'info');
    return filtered;
  }

  // ============ 通用菜单 & 删除查找 ============
  function findMenuButton(item) {
    const candidates = [
      ...item.querySelectorAll('button,[role="button"]'),
      ...(item.parentElement ? [...item.parentElement.querySelectorAll('button,[role="button"]')] : [])
    ];

    // 优先级0：明确的data-test-id (Gemini)
    let result = candidates.find(el => el.getAttribute('data-test-id') === 'actions-menu-button');
    if (result) return result;

    // 优先级1：匹配文本关键词或 aria-haspopup
    result = candidates.find((el) => {
      const t = normalizeText(el);
      return (
        isVisible(el) &&
        (t.includes('more') || t.includes('更多') || t.includes('选项') || t.includes('menu') || el.getAttribute('aria-haspopup') === 'menu')
      );
    });
    if (result) return result;

    // 优先级2：匹配纯图标按钮
    result = candidates.find((el) => {
      if (!isVisible(el)) return false;
      const t = normalizeText(el);
      if (t.length > 3) return false;
      const hasIcon = !!el.querySelector('img, svg');
      if (!hasIcon) return false;
      const parentLink = el.closest('a[href]');
      if (parentLink && parentLink !== item) return false;
      return true;
    });

    return result || null;
  }

  function findDeleteActionElement() {
    // 优先检查 Radix UI 菜单
    const radixBtn = findRadixMenuDeleteButton();
    if (radixBtn) return radixBtn;

    const candidates = [
      ...document.querySelectorAll('[role="menuitem"]'),
      ...document.querySelectorAll('button'),
      ...document.querySelectorAll('[role="button"]'),
      ...document.querySelectorAll('div[tabindex],li[tabindex]')
    ];

    // 第一遍：精确匹配删除关键词
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = normalizeText(el);
      if (!text) continue;
      if (!hasDeleteWord(text)) continue;
      if (hasSkipWord(text)) continue;
      log(`找到删除按钮（精确）: "${text.substring(0, 50)}"`, 'success');
      return el;
    }

    // 第二遍：匹配归档关键词（Claude等平台使用归档而非删除）
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = normalizeText(el);
      if (!text) continue;
      if (!hasArchiveWord(text)) continue;
      if (hasSkipWord(text)) continue;
      log(`找到归档按钮: "${text.substring(0, 50)}"`, 'success');
      return el;
    }

    // 第三遍：宽松匹配
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = normalizeText(el);
      if (!text || text.length > 50) continue;
      if (text.match(/^(del|remove|archive|trash|discard|清除|删除|移除).*/)) {
        if (!hasSkipWord(text)) {
          log(`找到删除按钮（宽松）: "${text.substring(0, 50)}"`, 'success');
          return el;
        }
      }
    }

    // 第四遍：调试输出
    const visibleMenuItems = Array.from(document.querySelectorAll('[role="menuitem"]')).filter(isVisible);
    if (visibleMenuItems.length > 0) {
      log(`菜单中有 ${visibleMenuItems.length} 个可见项目:`, 'debug');
      visibleMenuItems.forEach((item, idx) => {
        log(`  [${idx}] "${normalizeText(item).substring(0, 60)}"`, 'debug');
      });
    }

    log('未找到删除操作按钮', 'warning');
    return null;
  }

  function findConfirmButton() {
    const confirmWords = ['确认', '确定', '删除', 'delete', 'yes', 'ok', 'continue', 'confirm', '是', '同意', 'approve', ' permanently', 'archive'];
    const rejectWords = ['cancel', '取消', 'no', 'abort', '拒绝', 'keep', '保留', '关闭', 'close'];

    const dialogRoots = [
      ...document.querySelectorAll('[role="dialog"]'),
      ...document.querySelectorAll('[role="alertdialog"]'),
      ...document.querySelectorAll('[class*="modal"]'),
      ...document.querySelectorAll('[class*="dialog"]'),
      ...document.querySelectorAll('[class*="Modal"]'),
      ...document.querySelectorAll('[class*="Alert"]'),
      ...document.querySelectorAll('[data-testid*="modal"]'),
      ...document.querySelectorAll('[data-testid*="dialog"]'),
      ...document.querySelectorAll('[class*="overlay"]'),
      ...document.querySelectorAll('[class*="Overlay"]'),
      ...document.querySelectorAll('[data-state="open"]')
    ];

    const roots = dialogRoots.length ? dialogRoots : [document];

    for (const root of roots) {
      // 优先级0: 明确的data-test-id
      const specialBtn =
        root.querySelector('button[data-testid="delete-modal-confirm"]') ||
        root.querySelector('button[data-test-id="confirm-button"]') ||
        root.querySelector('button[data-testid*="confirm"]') ||
        root.querySelector('button[data-testid*="delete-confirm"]') ||
        root.querySelector('button[data-testid="confirm-delete-button"]') ||
        root.querySelector('[data-testid="destructive-button"]');
      if (specialBtn && isVisible(specialBtn)) {
        log(`通过 data-test-id 找到确认按钮`, 'success');
        return specialBtn;
      }

      // 优先级1: danger类的按钮
      const dangerBtn = root.querySelector('button[class*="danger"], button[class*="destructive"], button[class*="delete"], button[class*="btn-red"], button[class*="text-red"]');
      if (dangerBtn && isVisible(dangerBtn)) {
        const t = normalizeText(dangerBtn);
        if (hasDeleteWord(t) || hasConfirmWord(t) || hasArchiveWord(t)) return dangerBtn;
      }

      // 优先级2: 查找所有按钮
      const buttons = root.querySelectorAll('button,[role="button"],a[role="button"],div[role="button"]');
      let confirmBtn = null;

      for (const btn of buttons) {
        if (!isVisible(btn)) continue;
        const text = normalizeText(btn);
        if (!text) continue;
        if (rejectWords.some(w => text.includes(w))) continue;
        if (!confirmBtn && confirmWords.some(w => text.includes(w))) {
          confirmBtn = btn;
        }
      }
      if (confirmBtn) return confirmBtn;

      // 优先级3: 唯一按钮
      const visibleButtons = Array.from(root.querySelectorAll('button,[role="button"]')).filter(isVisible);
      if (visibleButtons.length === 1) return visibleButtons[0];
      if (visibleButtons.length > 1) {
        // 找danger/destructive类的按钮
        for (const btn of visibleButtons) {
          const className = btn.getAttribute('class') || '';
          if (className.includes('danger') || className.includes('destructive') || className.includes('red')) {
            return btn;
          }
        }
        // 否则返回最后一个非取消按钮
        const lastBtn = visibleButtons[visibleButtons.length - 1];
        const t = normalizeText(lastBtn);
        if (!rejectWords.some(w => t.includes(w))) return lastBtn;
      }
    }

    return null;
  }

  function findBulkDeleteEntry() {
    const candidates = [
      ...document.querySelectorAll('button,[role="button"],[role="menuitem"],a,div[tabindex],li[tabindex]')
    ];
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const text = normalizeText(el);
      if (!text) continue;
      if (!hasBulkDeleteText(text)) continue;
      if (hasSkipWord(text)) continue;
      return el;
    }
    return null;
  }

  // ============ ChatGPT 专用 ============
  function isChatGPTHost() {
    const h = window.location.hostname;
    return h.includes('chatgpt.com') || h.includes('chat.openai.com');
  }

  function findClickableByKeywords(keywords, root = document) {
    const lower = keywords.map((k) => k.toLowerCase());
    const candidates = root.querySelectorAll(
      'button,a,[role="button"],[role="tab"],[role="menuitem"],[role="link"],div[tabindex="0"]'
    );
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const t = normalizeText(el);
      if (!t) continue;
      for (const k of lower) {
        if (t.includes(k)) return el;
      }
    }
    return null;
  }

  function getChatGPTRowElements() {
    const rows = [];
    const anchors = document.querySelectorAll(
      'nav a[href^="/c/"], aside a[href^="/c/"], [data-testid*="sidebar"] a[href^="/c/"]'
    );
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('/c/')) continue;
      if (href.includes('/c/new') || href.includes('/project') || href.includes('/g/')) continue;

      let row = a.closest('li');
      if (!row) row = a.closest('[group]');
      if (!row) row = a.closest('[data-testid*="history"]');
      if (!row) row = a.closest('[data-testid*="conversation"]');
      if (!row) row = a.parentElement;

      if (row && isVisible(row)) {
        rows.push(row);
      }
    }
    return uniqueElements(rows);
  }

  function findChatGPTMenuButton(row) {
    const buttons = row.querySelectorAll('button');

    // 优先级0: 明确的options/menu按钮
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      const testId = (b.getAttribute('data-testid') || '').toLowerCase();
      if (label.includes('options') || testId.includes('options') || testId.includes('menu')) {
        return b;
      }
    }

    // 优先级1
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      if (
        (label.includes('menu') || label.includes('more') || label.includes('option') || label.includes('action')) &&
        !label.includes('delete') && !label.includes('rename')
      ) {
        return b;
      }
    }

    // 优先级2
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('conversation') && !label.includes('delete') && !label.includes('rename')) {
        return b;
      }
    }

    // 优先级3
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const title = (b.getAttribute('title') || '').toLowerCase();
      const classes = b.getAttribute('class') || '';
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      if ((title.includes('menu') || title.includes('more') ||
          classes.includes('menu') || classes.includes('more')) &&
          !label.includes('delete') && !label.includes('rename')) {
        return b;
      }
    }

    // 优先级4：svg纯图标按钮
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const t = normalizeText(b);
      const hasSvg = b.querySelector('svg');
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      if ((t.length <= 3 || t === '') && hasSvg &&
          !label.includes('delete') && !label.includes('rename')) {
        return b;
      }
    }

    // 优先级5: 任何可见的按钮（兜底）
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const label = (b.getAttribute('aria-label') || '').toLowerCase();
      if (!label.includes('delete') && !label.includes('rename')) {
        return b;
      }
    }

    return null;
  }

  function isValidDeleteMenu(menu) {
    if (!menu) return false;
    const items = menu.querySelectorAll('[role="menuitem"], button, a, div[role="button"], li[role="menuitem"]');
    for (const item of items) {
      if (!isVisible(item)) continue;
      if (hasDeleteWord(normalizeText(item))) return true;
    }
    return false;
  }

  function findOpenMenu() {
    const menuSelectors = [
      '[role="menu"]', '[role="listbox"]', '[role="dialog"]',
      '[data-radix-popper-content-wrapper]',
      '[class*="dropdown"]', '[class*="popover"]',
      '[class*="tooltip"]', '[class*="Modal"]'
    ];

    for (const selector of menuSelectors) {
      const menus = document.querySelectorAll(selector);
      for (const m of menus) {
        if (isVisible(m)) {
          const items = m.querySelectorAll('[role="menuitem"], button, a, [role="option"]');
          if (items.length > 0) return m;
        }
      }
    }

    const radix = document.querySelector('[data-radix-popper-content-wrapper] [role="menu"], [data-radix-popper-content-wrapper] [role="listbox"]');
    if (radix && isVisible(radix)) return radix;

    return null;
  }

  function findDeleteInMenu(menu) {
    if (!menu) return null;
    const items = menu.querySelectorAll(
      '[role="menuitem"], [role="option"], button, a, div[role="button"], li[role="menuitem"], div[tabindex="0"]'
    );

    // 第一遍：精确匹配删除关键词
    for (const el of items) {
      if (!isVisible(el)) continue;
      const t = normalizeText(el);
      if (t && hasDeleteWord(t) && !hasSkipWord(t)) {
        log(`菜单内找到删除项: "${t.substring(0, 50)}"`, 'success');
        return el;
      }
    }

    // 第二遍：匹配归档关键词（Claude等平台使用归档而非删除）
    for (const el of items) {
      if (!isVisible(el)) continue;
      const t = normalizeText(el);
      if (t && hasArchiveWord(t) && !hasSkipWord(t)) {
        log(`菜单内找到归档项: "${t.substring(0, 50)}"`, 'success');
        return el;
      }
    }

    // 第三遍：宽松匹配
    for (const el of items) {
      if (!isVisible(el)) continue;
      const t = normalizeText(el);
      if (!t || t.length > 50) continue;
      if (t.match(/^(del|remove|archive|trash|discard|清除|删除|移除).*/) && !hasSkipWord(t)) {
        return el;
      }
    }

    return null;
  }

  // ============ ChatGPT Settings 全量删除 ============
  async function tryChatGPTDeleteAllViaSettings() {
    if (!isChatGPTHost()) return false;

    const directSettings =
      document.querySelector('button[aria-label*="Settings"]') ||
      document.querySelector('button[aria-label*="settings"]') ||
      document.querySelector('a[href="/settings"]') ||
      document.querySelector('a[href^="/settings"]') ||
      findClickableByKeywords(['open settings', 'settings', '设置']);

    if (directSettings && isVisible(directSettings)) {
      log('ChatGPT：打开设置…', 'info');
      clickElement(directSettings);
      await sleep(900);
    } else {
      const profileBtn =
        document.querySelector('button[aria-label*="Profile"]') ||
        document.querySelector('button[aria-label*="profile"]') ||
        document.querySelector('button[aria-label*="Account"]') ||
        document.querySelector('button[aria-label*="Open"][aria-label*="menu"]') ||
        document.querySelector('[data-testid*="profile"]');

      if (profileBtn && isVisible(profileBtn)) {
        log('ChatGPT：打开个人菜单…', 'info');
        clickElement(profileBtn);
        await sleep(650);
        const settingsItem = findClickableByKeywords(['settings', '设置', 'open settings']);
        if (settingsItem) {
          clickElement(settingsItem);
          await sleep(900);
        }
      } else {
        return false;
      }
    }

    const dataTab = findClickableByKeywords(['data controls', 'data control', '数据控制', '数据管控', '隐私', 'privacy']);
    if (dataTab) {
      log('ChatGPT：进入 Data controls…', 'info');
      clickElement(dataTab);
      await sleep(700);
    }

    let bulk =
      findBulkDeleteEntry() ||
      findClickableByKeywords(['delete all chats', 'clear all chats', 'delete all', 'clear all', 'clear chat history', '删除所有聊天', '删除全部对话', '清空']);

    if (!bulk) {
      const danger = document.querySelector('button[class*="danger"], button[class*="red"], .text-red-500');
      if (danger && isVisible(danger)) {
        const t = normalizeText(danger);
        if (hasBulkDeleteText(t) || hasDeleteWord(t)) bulk = danger;
      }
    }

    if (!bulk) return false;

    log('ChatGPT：点击「删除全部对话」…', 'info');
    clickElement(bulk);
    await sleep(800);

    const confirmBtn = findConfirmButton();
    if (confirmBtn) {
      clickElement(confirmBtn);
      await sleep(1200);
    }
    return true;
  }

  // ============ ChatGPT 逐条删除 ============
  async function deleteChatGPTOne(row) {
    row.scrollIntoView({ block: 'center' });
    await sleep(220);
    dispatchHover(row);
    await sleep(220);

    const menuBtn = findChatGPTMenuButton(row) || findMenuButton(row);
    if (!menuBtn) {
      const directDelete = findDeleteActionElement();
      if (directDelete) {
        clickElement(directDelete);
        await sleep(550);
        const confirmBtn = findConfirmButton();
        if (confirmBtn) { clickElement(confirmBtn); await sleep(650); }
        return true;
      }
      return false;
    }

    clickElement(menuBtn);
    await sleep(1000);

    // 查找删除按钮（多策略）
    const allButtons = document.querySelectorAll('button, [role="menuitem"], div[role="button"], [role="option"]');
    let directDeleteBtn = null;

    for (const btn of allButtons) {
      if (!isVisible(btn)) continue;
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const text = normalizeText(btn);

      if ((ariaLabel.includes('delete') || ariaLabel.includes('remove') || ariaLabel.includes('archive')) && isVisible(btn)) {
        directDeleteBtn = btn;
        break;
      }
      if (hasDeleteWord(text) && !hasSkipWord(text) && isVisible(btn)) {
        directDeleteBtn = btn;
        break;
      }
    }

    if (directDeleteBtn) {
      clickElement(directDeleteBtn);
      await sleep(700);
      const confirmBtn = findConfirmButton();
      if (confirmBtn) { clickElement(confirmBtn); await sleep(800); }
      return true;
    }

    // 备选：菜单方式
    let menu = findOpenMenu();
    if (!menu) { await sleep(300); menu = findOpenMenu(); }

    if (!menu) {
      await sleep(200);
      clickElement(menuBtn);
      await sleep(800);
      menu = findOpenMenu();
      if (!menu) return false;
    }

    if (!isValidDeleteMenu(menu)) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
      await sleep(300);
      clickElement(menuBtn);
      await sleep(1000);
      menu = findOpenMenu();
      if (!menu || !isValidDeleteMenu(menu)) return false;
    }

    let del = findDeleteInMenu(menu) || findDeleteActionElement();
    if (!del) return false;

    clickElement(del);
    await sleep(700);
    const confirmBtn = findConfirmButton();
    if (confirmBtn) { clickElement(confirmBtn); await sleep(800); }
    else { await sleep(600); }

    return true;
  }

  // ============ Claude API 批量删除 ============
  async function tryClaudeAPIBulkDelete() {
    if (!window.location.hostname.includes('claude.ai')) return false;

    log('Claude：尝试API批量删除模式…', 'info');

    try {
      // 获取组织ID - 尝试多个API端点
      let orgResp = await fetch('https://claude.ai/api/organizations', { credentials: 'include' });
      // 如果失败，尝试新端点
      if (!orgResp.ok) {
        orgResp = await fetch('https://claude.ai/api/me', { credentials: 'include' });
      }
      if (!orgResp.ok) {
        log('Claude：获取组织信息失败', 'warning');
        return false;
      }
      const raw_orgs = await orgResp.json();
      const orgs = Array.isArray(raw_orgs) ? raw_orgs : (raw_orgs.organizations || raw_orgs.data || raw_orgs.memberships || []);
      if (!orgs || orgs.length === 0) {
        log('Claude：无组织信息', 'warning');
        return false;
      }
      const orgId = orgs[0].uuid || orgs[0].id || orgs[0].organization_uuid;
      if (!orgId) {
        log('Claude：无法获取组织ID', 'warning');
        return false;
      }
      log(`Claude：组织ID: ${orgId.substring(0, 8)}...`, 'info');

      // 获取所有对话（支持分页）
      let allChats = [];
      let cursor = null;
      for (let page = 0; page < 50; page++) {
        const url = cursor
          ? `https://claude.ai/api/organizations/${orgId}/chat_conversations?cursor=${encodeURIComponent(cursor)}`
          : `https://claude.ai/api/organizations/${orgId}/chat_conversations`;
        const chatsResp = await fetch(url, { credentials: 'include' });
        if (!chatsResp.ok) {
          log(`Claude：获取对话列表失败 (HTTP ${chatsResp.status})`, 'warning');
          return false;
        }
        const raw = await chatsResp.json();
        // 兼容数组和 {conversations:[...], next_cursor:...} 两种格式
        const page_chats = Array.isArray(raw) ? raw : (raw.conversations || raw.data || raw.chat_conversations || []);
        if (page_chats.length === 0) break;
        allChats = allChats.concat(page_chats);
        cursor = raw.next_cursor || raw.cursor || null;
        if (!cursor || !(raw.has_more || raw.has_next)) break;
      }
      const chats = allChats;
      if (!chats || chats.length === 0) {
        log('Claude：没有对话可删除', 'info');
        return true;
      }

      log(`Claude：找到 ${chats.length} 个对话，开始批量归档…`, 'info');

      // 分批归档（每批500）- Claude使用归档而非删除
      const batchSize = 500;
      let totalDeleted = 0;

      for (let i = 0; i < chats.length; i += batchSize) {
        const batch = chats.slice(i, i + batchSize);
        const uuids = batch.map(c => c.uuid || c.id || c.conversation_id).filter(Boolean);

        // 尝试批量归档端点
        let archiveResp = await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations/archive_many`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_uuids: uuids })
        });

        // 如果批量归档失败，尝试旧端点
        if (!archiveResp.ok) {
          archiveResp = await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations/delete_many`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation_uuids: uuids })
          });
        }

        if (archiveResp.ok) {
          totalDeleted += uuids.length;
          log(`Claude：已归档 ${totalDeleted}/${chats.length} 个对话`, 'success');
          send('PROGRESS', { deleted: totalDeleted, failed: 0 });
        } else {
          log(`Claude：批次归档失败 (HTTP ${archiveResp.status})，尝试单条归档…`, 'warning');
          // 回退到单条归档
          for (const uuid of uuids) {
            try {
              let singleResp = await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations/${uuid}/archive`, {
                method: 'POST',
                credentials: 'include'
              });
              // 如果归档端点失败，尝试删除端点
              if (!singleResp.ok) {
                singleResp = await fetch(`https://claude.ai/api/organizations/${orgId}/chat_conversations/${uuid}`, {
                  method: 'DELETE',
                  credentials: 'include'
                });
              }
              if (singleResp.ok) {
                totalDeleted++;
                send('PROGRESS', { deleted: totalDeleted, failed: 0 });
              }
            } catch (e) {}
            await sleep(200);
          }
        }

        await sleep(300);
      }

      log(`Claude：API批量归档完成，共归档 ${totalDeleted} 个对话`, 'success');
      return true;
    } catch (e) {
      log(`Claude：API批量删除异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ Claude DOM 批量删除 ============
  async function tryClaudeBulkDelete() {
    if (!window.location.hostname.includes('claude.ai')) return false;

    // 先尝试API方式
    const apiResult = await tryClaudeAPIBulkDelete();
    if (apiResult) return true;

    log('Claude：API方式不可用，回退到DOM操作模式…', 'info');

    // DOM方式：前往recents页面
    if (!window.location.pathname.includes('/recents')) {
      const recentsLink = document.querySelector('a[href="/recents"]');
      if (recentsLink) {
        log('Claude：前往 Recents 页面…', 'info');
        recentsLink.click();
        await sleep(1500);
      } else {
        log('Claude：尝试跳转到 /recents…', 'info');
        window.location.href = 'https://claude.ai/recents';
        await sleep(2000);
        return true;
      }
    }

    if (!window.location.pathname.includes('/recents')) return false;

    log('Claude：检测到 Recents 页面，尝试批量删除…', 'info');

    const selectBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Select');
    if (selectBtn) { selectBtn.click(); await sleep(800); }

    const selectAllBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Select all');
    if (selectAllBtn) { selectAllBtn.click(); await sleep(800); }

    const deleteSelectedBtn = Array.from(document.querySelectorAll('button')).find(b => /Delete\s+Selected/i.test(b.textContent));
    if (deleteSelectedBtn) {
      deleteSelectedBtn.click();
      await sleep(1000);
      const confirmBtn = document.querySelector('button[data-testid="delete-modal-confirm"]') || findConfirmButton();
      if (confirmBtn) { confirmBtn.click(); await sleep(1500); return true; }
    }

    return false;
  }

  // ============ DeepSeek 专用删除 ============
  async function tryDeepSeekBulkDelete() {
    if (!window.location.hostname.includes('deepseek.com')) return false;

    log('DeepSeek：尝试清除所有对话…', 'info');

    // 首先尝试找到"清空会话"按钮 - DeepSeek新版UI
    const sidebarButtons = document.querySelectorAll('button');
    for (const btn of sidebarButtons) {
      const text = normalizeText(btn);
      if (text.includes('清空') || text.includes('clear') || text.includes('清空会话') || text.includes('clear all')) {
        if (isVisible(btn)) {
          log('DeepSeek：找到清空按钮', 'info');
          clickElement(btn);
          await sleep(1000);
          const confirmBtn = findConfirmButton();
          if (confirmBtn) {
            clickElement(confirmBtn);
            await sleep(1200);
            return true;
          }
        }
      }
    }

    // 尝试找到设置/菜单中的清除选项
    const menuBtn = findClickableByKeywords(['menu', '更多', '设置', 'settings']);
    if (menuBtn) {
      clickElement(menuBtn);
      await sleep(800);
      const clearBtn = findClickableByKeywords(['clear all', 'clear conversations', '清空', '清除所有', '删除所有', '清空会话']);
      if (clearBtn) {
        clickElement(clearBtn);
        await sleep(800);
        const confirmBtn = findConfirmButton();
        if (confirmBtn) { clickElement(confirmBtn); await sleep(1200); }
        return true;
      }
    }

    return false;
  }

  // ============ Perplexity 专用删除 ============
  async function tryPerplexityDelete() {
    if (!window.location.hostname.includes('perplexity.ai')) return false;

    log('Perplexity：尝试删除搜索历史…', 'info');

    // 尝试通过设置清除
    const settingsBtn = findClickableByKeywords(['settings', '设置']);
    if (settingsBtn) {
      clickElement(settingsBtn);
      await sleep(800);
      const clearBtn = findClickableByKeywords(['clear', 'delete all', 'clear history', '清除']);
      if (clearBtn) {
        clickElement(clearBtn);
        await sleep(800);
        const confirmBtn = findConfirmButton();
        if (confirmBtn) { clickElement(confirmBtn); await sleep(1200); }
        return true;
      }
    }

    return false;
  }

  // ============ 豆包专用删除 ============
  async function deleteDoubaoOne(item) {
    try {
      item.scrollIntoView({ block: 'center' });
      await sleep(300);

      // 尝试多种方式找到菜单按钮
      let menuBtn = null;

      // 方式1: 查找menu-wrapper
      const menuWrapper = item.querySelector('[class*="menu-wrapper"]');
      if (menuWrapper) {
        menuWrapper.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;width:auto!important;height:auto!important;overflow:visible!important;pointer-events:auto!important;';
        const innerBtns = menuWrapper.querySelectorAll('button');
        innerBtns.forEach(b => {
          b.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;width:22px!important;height:22px!important;min-width:22px!important;pointer-events:auto!important;';
        });
        await sleep(200);

        const allBtns = Array.from(menuWrapper.querySelectorAll('button'));
        for (const b of allBtns) {
          if (b.querySelector('svg') || b.querySelector('img')) {
            menuBtn = b;
            break;
          }
        }
        if (!menuBtn && allBtns.length > 0) menuBtn = allBtns[allBtns.length - 1];
      }

      // 方式2: 直接在item中查找所有按钮
      if (!menuBtn) {
        const allBtns = Array.from(item.querySelectorAll('button'));
        // 找包含更多/菜单图标的按钮
        for (const b of allBtns) {
          const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
          if (ariaLabel.includes('more') || ariaLabel.includes('menu') || ariaLabel.includes('选项')) {
            menuBtn = b;
            break;
          }
          if (b.querySelector('svg') && !ariaLabel.includes('delete')) {
            menuBtn = b;
          }
        }
        // 如果没有找到，使用最后一个按钮（通常是菜单按钮）
        if (!menuBtn && allBtns.length > 0) {
          menuBtn = allBtns[allBtns.length - 1];
        }
      }

      if (!menuBtn) {
        log('豆包: 未找到菜单按钮', 'warning');
        return false;
      }

      clickElement(menuBtn);
      await waitForRadixMenuOpen(menuBtn);

      // 查找删除选项
      let deleteItem = findDeleteActionElement();

      // 如果没找到，尝试直接查找包含"删除"文本的元素
      if (!deleteItem) {
        const allElements = document.querySelectorAll('div, button, span, li');
        for (const el of allElements) {
          if (!isVisible(el)) continue;
          const text = normalizeText(el);
          if (text === '删除' || text === '删除对话' || text.includes('delete')) {
            deleteItem = el;
            break;
          }
        }
      }

      if (!deleteItem) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(300);
        return false;
      }

      clickElement(deleteItem);
      await sleep(700);

      const confirmBtn = findConfirmButton();
      if (confirmBtn) {
        clickElement(confirmBtn);
        await sleep(900);
      } else {
        await sleep(600);
      }

      return true;
    } catch (e) {
      log(`豆包删除异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ Grok 专用删除 ============
  async function tryGrokBulkDelete() {
    if (!window.location.hostname.includes('grok.com')) return false;

    log('Grok：尝试批量删除…', 'info');

    // 尝试找到清除所有按钮
    const clearBtn = findClickableByKeywords(['clear all', 'delete all', '清空', '清除所有', '删除所有']);
    if (clearBtn) {
      clickElement(clearBtn);
      await sleep(800);
      const confirmBtn = findConfirmButton();
      if (confirmBtn) { clickElement(confirmBtn); await sleep(1200); }
      return true;
    }

    return false;
  }

  // ============ 通用逐条删除 ============
  async function deleteGenericOne(item) {
    try {
      log(`开始删除: ${normalizeText(item).substring(0, 30)}...`, 'info');
      item.scrollIntoView({ block: 'center' });
      await sleep(250);

      dispatchHover(item);
      await sleep(300);

      const menuBtn = findMenuButton(item);
      if (menuBtn) {
        clickElement(menuBtn);
        // 等待 Radix UI 菜单打开
        await waitForRadixMenuOpen(menuBtn);
      } else {
        // 尝试右键菜单
        item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
        await sleep(1000); // 右键菜单需要更长时间
      }

      const deleteAction = findDeleteActionElement();
      if (!deleteAction) {
        log('未找到删除操作按钮', 'error');
        // 尝试关闭已打开的菜单
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(200);
        return false;
      }

      clickElement(deleteAction);
      await sleep(600);

      const confirmBtn = findConfirmButton();
      if (confirmBtn) { clickElement(confirmBtn); await sleep(800); }
      else { await sleep(600); }

      return true;
    } catch (e) {
      log(`删除过程异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ 主清理器 ============
  class HistoryCleaner {
    constructor() {
      this.isRunning = false;
      this.deletedCount = 0;
      this.failedCount = 0;
      this.maxNoChangeRounds = 6;
      this.noChangeRounds = 0;
    }

    reportProgress() {
      send('PROGRESS', { deleted: this.deletedCount, failed: this.failedCount });
    }

    async deleteOne(item) {
      try {
        if (isChatGPTHost()) {
          return await deleteChatGPTOne(item);
        }
        if (window.location.hostname.includes('doubao.com')) {
          return await deleteDoubaoOne(item);
        }
        return await deleteGenericOne(item);
      } catch (e) {
        log(`删除异常: ${e.message}`, 'error');
        return false;
      }
    }

    async runLoop() {
      let previousCount = -1;
      let safetyRounds = 0;
      let consecutiveFailures = 0;

      while (this.isRunning) {
        safetyRounds += 1;
        if (safetyRounds > 200) {
          log('达到安全上限(200轮)，已停止', 'warning');
          break;
        }

        const items = getConversationItems();
        if (items.length === 0) {
          log('未检测到可删除历史项，已结束', 'info');
          break;
        }

        if (previousCount === items.length) {
          this.noChangeRounds += 1;
          log(`无变化轮次: ${this.noChangeRounds}/${this.maxNoChangeRounds}`, 'warning');
        } else {
          this.noChangeRounds = 0;
          previousCount = items.length;
          consecutiveFailures = 0;
        }

        if (this.noChangeRounds >= this.maxNoChangeRounds) {
          log('多轮无变化，选择器可能失效，已停止', 'warning');
          break;
        }

        log(`检测到 ${items.length} 条历史，删除第 ${this.deletedCount + this.failedCount + 1} 条`, 'info');
        const ok = await this.deleteOne(items[0]);

        if (ok) {
          this.deletedCount += 1;
          consecutiveFailures = 0;
          log(`删除成功，累计 ${this.deletedCount}`, 'success');
        } else {
          this.failedCount += 1;
          consecutiveFailures += 1;
          log(`删除失败 (连续${consecutiveFailures}次)`, 'error');

          if (consecutiveFailures >= 3) {
            log('连续失败3次以上，增加等待时间…', 'warning');
            await sleep(1500);
          } else {
            await sleep(800);
          }
        }

        this.reportProgress();
        await sleep(600);
      }
    }

    async tryBulkDelete() {
      const bulkEntry = findBulkDeleteEntry();
      if (!bulkEntry) return false;
      log('检测到原生全量删除入口', 'info');
      clickElement(bulkEntry);
      await sleep(700);
      const confirmBtn = findConfirmButton();
      if (confirmBtn) { clickElement(confirmBtn); await sleep(1000); }
      this.deletedCount += 1;
      this.reportProgress();
      log('已触发全量删除', 'success');
      return true;
    }

    async start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.deletedCount = 0;
      this.failedCount = 0;
      this.noChangeRounds = 0;
      log(`开始清理: ${window.location.hostname}`, 'info');
      this.reportProgress();

      let usedBulk = false;

      // ChatGPT 批量
      if (isChatGPTHost()) {
        usedBulk = await tryChatGPTDeleteAllViaSettings();
        if (usedBulk) {
          this.deletedCount += 1;
          this.reportProgress();
          log('ChatGPT：已执行全量删除，等待刷新…', 'success');
          await sleep(2500);
        }
      }

      // Claude 批量（API + DOM双策略）
      if (!usedBulk && window.location.hostname.includes('claude.ai')) {
        usedBulk = await tryClaudeBulkDelete();
        if (usedBulk) {
          this.reportProgress();
          log('Claude：批量删除完成，请刷新页面查看效果', 'success');
          this.isRunning = false;
          send('COMPLETED', { deleted: this.deletedCount, failed: this.failedCount });
          return;
        }
      }

      // DeepSeek 批量
      if (!usedBulk && window.location.hostname.includes('deepseek.com')) {
        usedBulk = await tryDeepSeekBulkDelete();
        if (usedBulk) {
          this.deletedCount += 1;
          this.reportProgress();
          await sleep(1500);
        }
      }

      // Grok 批量
      if (!usedBulk && window.location.hostname.includes('grok.com')) {
        usedBulk = await tryGrokBulkDelete();
        if (usedBulk) {
          this.deletedCount += 1;
          this.reportProgress();
          await sleep(1500);
        }
      }

      // Perplexity
      if (!usedBulk && window.location.hostname.includes('perplexity.ai')) {
        usedBulk = await tryPerplexityDelete();
        if (usedBulk) {
          this.deletedCount += 1;
          this.reportProgress();
          await sleep(1500);
        }
      }

      // 通用批量删除尝试
      if (!usedBulk) {
        usedBulk = await this.tryBulkDelete();
      }

      if (!usedBulk) {
        log('未找到全量删除入口，使用逐条删除模式', 'info');
      }

      await this.runLoop();
      this.isRunning = false;
      this.reportProgress();
      send('COMPLETED', { deleted: this.deletedCount, failed: this.failedCount });
      log(`清理结束: 成功 ${this.deletedCount}, 失败 ${this.failedCount}`, 'success');
    }

    stop() {
      this.isRunning = false;
      log('已停止', 'warning');
    }
  }

  const cleaner = new HistoryCleaner();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message.command) {
        case 'START':
          if (cleaner.isRunning) { sendResponse({ status: 'already_running' }); break; }
          cleaner.start();
          sendResponse({ status: 'started' });
          break;
        case 'STOP':
          cleaner.stop();
          sendResponse({ status: 'stopped' });
          break;
        case 'GET_STATUS':
          sendResponse({
            status: 'ready',
            isRunning: cleaner.isRunning,
            deleted: cleaner.deletedCount,
            failed: cleaner.failedCount,
            host: window.location.hostname
          });
          break;
        default:
          sendResponse({ status: 'ignored' });
          break;
      }
    } catch (e) {
      log(`消息处理异常: ${e.message}`, 'error');
      sendResponse({ status: 'error', message: e.message });
    }
    return true;
  });

  window.addEventListener('__ai_cleaner_command__', (event) => {
    const { command } = event.detail || {};
    if (command === 'START' && !cleaner.isRunning) cleaner.start();
    else if (command === 'STOP') cleaner.stop();
  });

  send('READY', { host: window.location.hostname });
  log(`content script v3.0 ready on ${window.location.hostname}`, 'info');
})();
