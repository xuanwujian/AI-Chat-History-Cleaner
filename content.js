/**
 * Content Script - ChatEraser 清聊大师
 *
 * @author yxstars@outlook.com
 * @copyright Copyright (c) 2026 yxstars@outlook.com. All rights reserved.
 * @license MIT License
 *
 * 支持: 豆包, DeepSeek, Kimi, Claude, ChatGPT, Gemini, 腾讯元宝, 通义千问, 智谱清言
 *
 * 删除策略：
 * 1) ChatGPT: API 批量删除 (参考 ChatCompost)
 * 2) Kimi: API 列表获取+批量删除 (参考 kimi-history-cleaner)
 * 3) 豆包: Radix UI 菜单等待+逐条删除
 * 4) DeepSeek: API 批量删除+DOM 回退
 * 5) Claude: API 批量归档+单条回退
 * 6) Gemini: API 批量删除+DOM 回退
 */
(function () {
  'use strict';

  if (window.chatEraserInjected) return;
  window.chatEraserInjected = true;

  const SOURCE = 'CHAT_ERASER';
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
      // 2025/2026 新版豆包 UI（CSS Modules 哈希类名，只能靠结构特征）
      'a[href*="/chat/thread/"]',
      'a[href*="/chat/"][href*="/thread"]',
      'li[class] a[href*="/chat/"]',
      'div[class] a[href*="/chat/"]',
      // 旧版选择器
      'a[class*="chat-item"][href*="/chat/"]',
      '[class*="session_item"] a',
      '[class*="sessionItem"] a',
      '[class*="session-item"]',
      '[class*="conversation-item"]',
      '[class*="conversationItem"]',
      '[class*="history-item"]',
      // 通用回退
      'a[href*="/chat/"]',
    ],
    'chat.deepseek.com': [
      'a[href*="/a/chat/s/"]',
      'a[href*="/chat/"]',
      '[class*="_3098d02"]',
      '[class*="conversation"]',
      '[class*="chat-item"]',
      '[class*="session-item"]',
      '[role="option"]',
      'div[class*="sidebar"] a[href*="/chat"]'
    ],
    'kimi.': [
      '.history-item-container',
      '[class*="history-item"]',
      '[class*="conversation"]',
      '[class*="chat-list"] > div',
      '[class*="chat-item"]',
      'a[href*="/chat/"]',
      'div[role="listitem"]'
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

  // ============ 豆包 CDP 鼠标模拟辅助 ============
  let doubaoDebuggerAttached = false;

  function cdpAttach() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CDP_ATTACH' }, (resp) => {
        if (chrome.runtime.lastError) { resolve(false); return; }
        doubaoDebuggerAttached = !!(resp && resp.ok);
        resolve(doubaoDebuggerAttached);
      });
    });
  }

  function cdpDetach() {
    doubaoDebuggerAttached = false;
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CDP_DETACH' }, () => resolve());
    });
  }

  function cdpHover(x, y) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CDP_MOUSE_HOVER', x, y }, (resp) => resolve(resp));
    });
  }

  function cdpClick(x, y) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CDP_MOUSE_CLICK', x, y }, (resp) => resolve(resp));
    });
  }

  /**
   * 组合 hover+click：在单次 SW 激活内完成"hover item → move to button → click"，
   * 避免 MV3 service worker 休眠后被重新唤醒带来的几秒延迟。
   * ix/iy = 对话项中心坐标（触发 CSS :hover）
   * bx/by = 按钮中心坐标（实际点击位置）
   * hoverDelay = hover 后等待按钮出现的毫秒数（默认 350ms，在 SW 内部执行不占 content script 时间）
   */
  function cdpHoverAndClick(ix, iy, bx, by, hoverDelay = 350) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(
        { type: 'CDP_HOVER_AND_CLICK', ix, iy, bx, by, hoverDelay },
        (resp) => {
          if (chrome.runtime.lastError) { resolve({ error: chrome.runtime.lastError.message }); return; }
          resolve(resp || {});
        }
      );
    });
  }

  /** 在页面上下文（非 isolated world）执行 JS 表达式，返回 returnByValue 结果 */
  function cdpEval(expression) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CDP_EVAL', expression }, (resp) => {
        if (chrome.runtime.lastError) { resolve({ error: chrome.runtime.lastError.message }); return; }
        resolve(resp || {});
      });
    });
  }

  // ============ 豆包 Radix UI 菜单等待 (改进版) ============
  async function waitForRadixMenuOpen(menuBtn, options = {}) {
    if (!menuBtn) return false;
    const maxRetries = options.maxRetries || 20;
    const checkInterval = options.checkInterval || 150;
    const postOpenDelay = options.postOpenDelay || 600;

    // 如果已经打开，直接返回
    if (menuBtn.getAttribute('data-state') === 'open') {
      await sleep(postOpenDelay);
      return true;
    }

    for (let i = 0; i < maxRetries; i++) {
      await sleep(checkInterval);

      // 检查菜单按钮状态
      if (menuBtn.getAttribute('data-state') === 'open') {
        await sleep(postOpenDelay);
        return true;
      }

      // 检查 Radix UI portal 是否存在
      const portals = document.querySelectorAll('[data-radix-popper-content-wrapper]');
      if (portals.length > 0) {
        // 检查 portal 内是否有菜单内容
        for (const portal of portals) {
          const menuContent = portal.querySelector('[role="menu"], [role="listbox"], [role="dialog"]');
          if (menuContent && isVisible(menuContent)) {
            await sleep(postOpenDelay);
            return true;
          }
        }
      }

      // 检查是否有其他菜单容器出现
      const menuContainers = document.querySelectorAll('[role="menu"], [role="listbox"]');
      for (const container of menuContainers) {
        if (isVisible(container) && container.getAttribute('data-state') !== 'closed') {
          await sleep(postOpenDelay);
          return true;
        }
      }
    }

    log('等待 Radix 菜单超时', 'warning');
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
    let filtered = unique.filter((el) => isVisible(el) && isLikelyConversationItem(el));

    // 豆包：只保留 href 以数字 ID 结尾的真实对话（过滤掉 /chat/create-image 等导航项）
    // 同时把"手机版对话"移到最后，优先删除普通对话
    if (window.location.hostname.includes('doubao.com')) {
      filtered = filtered.filter(el => /\/chat\/\d+/.test(el.getAttribute('href') || ''));
      const mobileIdx = filtered.findIndex(el => el.textContent.trim().includes('手机版对话'));
      if (mobileIdx !== -1) {
        const [mobileItem] = filtered.splice(mobileIdx, 1);
        filtered.push(mobileItem);
      }
    }

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

  // ============ ChatGPT API 批量删除 (参考 ChatCompost) ============
  let chatGPTAccessToken = null;

  async function getChatGPTAccessToken() {
    if (chatGPTAccessToken) return chatGPTAccessToken;

    try {
      const response = await fetch('https://chatgpt.com/api/auth/session', {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Session request failed: ${response.status}`);
      }

      const data = await response.json();
      chatGPTAccessToken = data.accessToken;
      log('ChatGPT：已获取 access token', 'success');
      return chatGPTAccessToken;
    } catch (error) {
      log(`ChatGPT：获取 access token 失败: ${error.message}`, 'error');
      throw error;
    }
  }

  async function deleteChatGPTConversation(conversationId) {
    const token = await getChatGPTAccessToken();

    const response = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      body: JSON.stringify({ is_visible: false })
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    return true;
  }

  async function tryChatGPTAPIBulkDelete() {
    if (!isChatGPTHost()) return false;

    log('ChatGPT：尝试 API 批量删除模式…', 'info');

    try {
      // 获取 access token
      const token = await getChatGPTAccessToken();
      if (!token) {
        log('ChatGPT：无法获取 access token，请确保已登录', 'warning');
        return false;
      }

      // 获取所有对话 ID
      const anchors = document.querySelectorAll('nav a[href^="/c/"], aside a[href^="/c/"]');
      const conversationIds = [];

      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        if (!href.startsWith('/c/')) continue;
        if (href.includes('/c/new') || href.includes('/project') || href.includes('/g/')) continue;
        const id = href.substring(3); // 去掉 "/c/"
        if (id && !conversationIds.includes(id)) {
          conversationIds.push(id);
        }
      }

      if (conversationIds.length === 0) {
        log('ChatGPT：没有找到对话记录', 'info');
        return true;
      }

      log(`ChatGPT：找到 ${conversationIds.length} 个对话，开始批量删除…`, 'info');

      let deletedCount = 0;
      let failedCount = 0;
      const total = conversationIds.length;

      for (let i = 0; i < conversationIds.length; i++) {
        const id = conversationIds[i];
        try {
          await deleteChatGPTConversation(id);
          deletedCount++;
          if (deletedCount % 10 === 0 || deletedCount === total) {
            log(`ChatGPT：已删除 ${deletedCount}/${total}`, 'success');
            send('PROGRESS', { deleted: deletedCount, failed: failedCount });
          }
        } catch (error) {
          failedCount++;
          log(`ChatGPT：删除失败 ${id.substring(0, 8)}...: ${error.message}`, 'warning');
        }
        await sleep(150); // 控制请求频率
      }

      log(`ChatGPT：API 批量删除完成，成功 ${deletedCount}，失败 ${failedCount}`, 'success');
      send('PROGRESS', { deleted: deletedCount, failed: failedCount });
      return { deleted: deletedCount, failed: failedCount };
    } catch (error) {
      log(`ChatGPT：API 批量删除异常: ${error.message}`, 'error');
      return false;
    }
  }

  // ============ ChatGPT 逐条删除 (API 方式) ============
  async function deleteChatGPTOne(row) {
    try {
      // 从 row 中提取对话 ID
      const anchor = row.querySelector('a[href^="/c/"]') || (row.tagName === 'A' && row.getAttribute('href')?.startsWith('/c/') ? row : null);
      if (!anchor) {
        log('ChatGPT：无法找到对话链接', 'warning');
        return false;
      }

      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('/c/')) {
        log('ChatGPT：无效的对话链接', 'warning');
        return false;
      }

      const conversationId = href.substring(3);
      if (!conversationId) {
        log('ChatGPT：无法提取对话 ID', 'warning');
        return false;
      }

      log(`ChatGPT：删除对话 ${conversationId.substring(0, 8)}...`, 'info');
      await deleteChatGPTConversation(conversationId);
      log('ChatGPT：删除成功', 'success');
      return true;
    } catch (error) {
      log(`ChatGPT：删除失败: ${error.message}`, 'error');
      return false;
    }
  }

  // ============ Claude API 批量删除 ============
  async function tryClaudeAPIBulkDelete() {
    if (!window.location.hostname.includes('claude.ai')) return false;

    log('Claude：尝试API批量删除模式…', 'info');

    try {
      // 获取组织ID
      const orgResp = await fetch('/api/organizations', { credentials: 'include' });
      if (!orgResp.ok) { log('Claude：获取组织信息失败', 'warning'); return false; }
      const raw_orgs = await orgResp.json();
      const orgs = Array.isArray(raw_orgs) ? raw_orgs : (raw_orgs.organizations || raw_orgs.data || []);
      const orgId = orgs[0]?.uuid || orgs[0]?.id;
      if (!orgId) { log('Claude：无法获取组织ID', 'warning'); return false; }
      log(`Claude：组织ID: ${orgId.substring(0, 8)}...`, 'info');

      // ── 辅助：用单条 DELETE 接口逐一删除 UUID 列表 ──
      async function deleteUUIDs(uuids) {
        let deleted = 0, failed = 0;
        for (const uuid of uuids) {
          try {
            const r = await fetch(`/api/organizations/${orgId}/chat_conversations/${uuid}`, {
              method: 'DELETE', credentials: 'include'
            });
            if (r.ok || r.status === 204) {
              deleted++;
              send('PROGRESS', { deleted, failed });
            } else {
              failed++;
              log(`Claude：删除失败 ${uuid.substring(0,8)} (${r.status})`, 'warning');
            }
          } catch (e) {
            failed++;
          }
          await sleep(150);
        }
        return { deleted, failed };
      }

      // ── 策略1：从 API 列表端点获取 UUID（v2 → v1）──
      let allChats = [];
      let cursor = null;
      let useV2 = true;

      for (let page = 0; page < 50; page++) {
        const base = useV2
          ? `/api/organizations/${orgId}/chat_conversations_v2`
          : `/api/organizations/${orgId}/chat_conversations`;
        const url = cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base;
        const chatsResp = await fetch(url, { credentials: 'include' });
        if (!chatsResp.ok) {
          if (useV2) { useV2 = false; cursor = null; continue; }
          break;
        }
        const raw = await chatsResp.json();
        const page_chats = Array.isArray(raw) ? raw
          : (raw.data || raw.conversations || raw.chat_conversations || []);
        if (page_chats.length === 0) {
          if (useV2 && page === 0) { useV2 = false; cursor = null; continue; }
          break;
        }
        allChats = allChats.concat(page_chats);
        cursor = raw.next_cursor || raw.cursor || null;
        if (!cursor && !raw.has_more) break;
      }

      if (allChats.length > 0) {
        log(`Claude：API找到 ${allChats.length} 个对话，逐条删除…`, 'info');
        const uuids = allChats.map(c => c.uuid || c.id).filter(Boolean);
        const result = await deleteUUIDs(uuids);
        log(`Claude：API删除完成，成功 ${result.deleted} 失败 ${result.failed}`, 'success');
        return { deleted: result.deleted, failed: result.failed };
      }

      // ── 策略2：API 列表为空，从 /recents 页面 DOM 提取 UUID 逐条删除 ──
      log('Claude：API列表为空，改从DOM提取UUID并逐条删除…', 'info');

      // 导航到 /recents
      if (!window.location.pathname.includes('/recents')) {
        const recentsLink = document.querySelector('a[href="/recents"]');
        if (recentsLink) { recentsLink.click(); await sleep(1500); }
        else {
          window.location.href = 'https://claude.ai/recents';
          await sleep(2500);
        }
      }
      if (!window.location.pathname.includes('/recents')) {
        log('Claude：无法导航到 /recents', 'warning');
        return false;
      }

      let totalDeleted = 0;
      let totalFailed = 0;

      for (let round = 0; round < 200; round++) {
        // 向下滚动触发懒加载
        const scroller = document.querySelector('main') || document.body;
        for (let s = 0; s < 5; s++) {
          scroller.scrollTop = scroller.scrollHeight;
          await sleep(400);
        }

        // 从 DOM 链接提取 UUID
        const uuids = [...new Set(
          Array.from(document.querySelectorAll('a[href]'))
            .map(a => { const m = (a.getAttribute('href') || '').match(/\/chat\/([0-9a-f-]{36})/); return m ? m[1] : null; })
            .filter(Boolean)
        )];

        if (uuids.length === 0) {
          log('Claude：DOM未找到更多对话，删除完成', 'info');
          break;
        }

        log(`Claude：DOM发现 ${uuids.length} 个对话（第 ${round + 1} 轮），开始删除…`, 'info');
        const result = await deleteUUIDs(uuids);
        totalDeleted += result.deleted;
        totalFailed += result.failed;

        // 重新导航到 /recents 加载下一批
        const recentsLink = document.querySelector('a[href="/recents"]');
        if (recentsLink) { recentsLink.click(); await sleep(1500); }
        else break;

        // 检查是否还有剩余
        await sleep(500);
        const remaining = Array.from(document.querySelectorAll('a[href]'))
          .filter(a => /\/chat\/[0-9a-f-]{36}/.test(a.getAttribute('href') || ''));
        if (remaining.length === 0) break;
      }

      if (totalDeleted > 0 || totalFailed > 0) {
        log(`Claude：DOM模式删除完成，成功 ${totalDeleted} 失败 ${totalFailed}`, 'success');
        return { deleted: totalDeleted, failed: totalFailed };
      }

      log('Claude：没有找到可删除的对话', 'info');
      return { deleted: 0, failed: 0 };

    } catch (e) {
      log(`Claude：API批量删除异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ Claude DOM 批量删除 ============
  async function tryClaudeBulkDelete() {
    if (!window.location.hostname.includes('claude.ai')) return false;

    // 先尝试API方式（返回 {deleted, failed} 或 false）
    const apiResult = await tryClaudeAPIBulkDelete();
    if (apiResult && typeof apiResult === 'object' && apiResult.deleted !== undefined) {
      return apiResult; // 把计数传回给 start()
    }
    if (apiResult === true) return true;
    if (apiResult && typeof apiResult === 'object' && apiResult.deleted === 0 && apiResult.failed === 0) {
      return true; // 没有对话，算成功
    }

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

    log('Claude：检测到 Recents/Chats 页面，尝试批量删除…', 'info');

    // ── Step 1: 点击 "Select" 进入选择模式 ──
    // 新版 Claude.ai：/recents 页面有 "Select" button
    const selectBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Select');
    if (!selectBtn) { log('Claude：未找到 Select 按钮', 'warning'); return false; }
    selectBtn.click();
    await sleep(800);

    // ── Step 2: 全选 ──
    // 新版：是 <label> 而非 <button>，含文字 "Select all"
    let selectAllEl = Array.from(document.querySelectorAll('label, button, [role="checkbox"]'))
      .find(el => el.textContent.trim() === 'Select all' && isVisible(el));
    // 如果还是找不到，找 checkbox input 旁边的 label
    if (!selectAllEl) {
      selectAllEl = Array.from(document.querySelectorAll('label'))
        .find(el => /select all/i.test(el.textContent) && isVisible(el));
    }
    if (selectAllEl) {
      selectAllEl.click();
      await sleep(600);
    } else {
      log('Claude：未找到 Select all 元素，继续尝试删除已选…', 'warning');
    }

    // ── Step 3: 点击删除按钮 ──
    // 新版：aria-label="Delete X selected items"（文本为空图标按钮）
    const deleteBtn = Array.from(document.querySelectorAll('button')).find(b => {
      const label = b.getAttribute('aria-label') || '';
      const text = b.textContent.trim();
      return isVisible(b) && (
        /delete.*selected/i.test(label) ||
        /delete.*selected/i.test(text) ||
        /Delete\s+Selected/i.test(text)
      );
    });

    if (!deleteBtn) { log('Claude：未找到删除选中按钮', 'warning'); return false; }
    log(`Claude：找到删除按钮 aria-label="${deleteBtn.getAttribute('aria-label')}"`, 'debug');
    deleteBtn.click();
    await sleep(1000);

    // ── Step 4: 确认 ──
    const confirmBtn = document.querySelector('button[data-testid="delete-modal-confirm"]')
                    || Array.from(document.querySelectorAll('button')).find(b => isVisible(b) && /^(Delete|确认|Confirm)$/.test(b.textContent.trim()))
                    || findConfirmButton();
    if (confirmBtn) {
      log('Claude：点击确认删除', 'debug');
      confirmBtn.click();
      await sleep(1500);
      return true;
    }

    log('Claude：未找到确认按钮', 'warning');
    return false;
  }

  // ============ Kimi DOM 批量删除 (v4 — /chat/history，含导航守护) ============
  /** 点击 Kimi 侧边栏"查看全部"链接做 SPA 导航，不刷新页面不杀脚本 */
  async function kimiNavToHistory() {
    if (window.location.pathname.includes('/chat/history')) return true;
    log('Kimi：不在历史页，点击"查看全部"导航回去…', 'info');
    const link = Array.from(document.querySelectorAll('a[href*="/chat/history"]'))
      .find(a => isVisible(a));
    if (link) {
      link.click();
      await sleep(2000);
      return window.location.pathname.includes('/chat/history');
    }
    return false;
  }

  async function tryKimiAPIBulkDelete() {
    if (!window.location.hostname.includes('kimi.')) return false;

    log('Kimi：启动历史页面 DOM 批量删除…', 'info');

    try {
      // 1. 若不在历史页，优先 SPA 点击导航（不重载页面）
      if (!window.location.pathname.includes('/chat/history')) {
        const ok = await kimiNavToHistory();
        if (!ok) {
          // 降级：跳转（可能重载，但后续无法继续）
          log('Kimi：SPA 导航失败，尝试直接跳转…', 'warning');
          window.location.href = 'https://www.kimi.com/chat/history';
          await sleep(3000);
        }
      }

      // 2. 等待页面加载
      let waitMs = 0;
      while (!document.querySelector('.history-item-container') && waitMs < 8000) {
        await sleep(500);
        waitMs += 500;
      }

      let totalDeleted = 0;
      let totalFailed = 0;
      let noProgressRounds = 0;

      // 3. 持续删除，直到无更多条目
      while (cleaner.isRunning) {
        // ── 导航守护：每轮开始前确保在历史页 ──
        if (!window.location.pathname.includes('/chat/history')) {
          const ok = await kimiNavToHistory();
          if (!ok) { log('Kimi：无法回到历史页，停止', 'warning'); break; }
          // 等待 .history-item-container 重新加载
          let w2 = 0;
          while (!document.querySelector('.history-item-container') && w2 < 4000) {
            await sleep(400); w2 += 400;
          }
        }

        // ── 每次只取第一条（避免旧引用失效），删后等待DOM更新再取下一条 ──
        const items = Array.from(document.querySelectorAll('.history-item-container'));
        if (items.length === 0) {
          log('Kimi：页面上已无更多记录', 'success');
          break;
        }

        let deletedThisRound = 0;
        let navigatedAway = false;

        // 逐条：每次从DOM重新查询第一条，避免旧节点引用问题
        let singleLoopFail = 0;
        while (cleaner.isRunning) {
          // 导航守护
          if (!window.location.pathname.includes('/chat/history')) {
            navigatedAway = true;
            break;
          }

          // 每次重新查询
          const freshItems = Array.from(document.querySelectorAll('.history-item-container'));
          if (freshItems.length === 0) break;
          const item = freshItems[0];

          const title = item.querySelector('.title-wrapper')?.textContent?.trim() || '(未知)';
          try {
            item.scrollIntoView({ block: 'center' });
            await sleep(300);

            // ── 触发 hover ──
            const ir = item.getBoundingClientRect();
            const hx = ir.left + ir.width / 2, hy = ir.top + ir.height / 2;
            const hOpts = { bubbles: true, cancelable: true, view: window, clientX: hx, clientY: hy };
            item.dispatchEvent(new MouseEvent('mouseenter', hOpts));
            item.dispatchEvent(new MouseEvent('mouseover', hOpts));
            item.dispatchEvent(new MouseEvent('mousemove', hOpts));
            await sleep(450);

            // ── 找删除按钮 ──
            const actionWrapper = item.querySelector('.action-wrapper');
            const ops = actionWrapper ? Array.from(actionWrapper.querySelectorAll('.operation')) : [];
            const deleteOp = ops.find(op => op.querySelector('.delete-icon, [class*="delete"]'))
                          || (ops.length > 0 ? ops[ops.length - 1] : null);

            if (!deleteOp) {
              log(`Kimi：找不到删除按钮 "${title}"，跳过`, 'warning');
              totalFailed++;
              singleLoopFail++;
              if (singleLoopFail >= 3) break;
              continue;
            }

            deleteOp.click();

            // ── 等待确认弹窗出现（最多1.5s）──
            let confirmBtn = null;
            for (let t = 0; t < 15; t++) {
              await sleep(100);
              confirmBtn = document.querySelector('button.kimi-button.danger, button.danger[class*="kimi"]');
              if (confirmBtn) break;
            }

            if (!confirmBtn) {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
              await sleep(300);
              log(`Kimi：找不到确认按钮 "${title}"，跳过`, 'warning');
              totalFailed++;
              singleLoopFail++;
              if (singleLoopFail >= 3) break;
              continue;
            }

            confirmBtn.click();

            // ── 等待该条目从DOM消失（最多2s）──
            for (let t = 0; t < 20; t++) {
              await sleep(100);
              if (!document.contains(item)) break;
            }
            await sleep(400); // 额外缓冲

            totalDeleted++;
            deletedThisRound++;
            singleLoopFail = 0;
            cleaner.deletedCount = totalDeleted;
            cleaner.failedCount = totalFailed;
            send('PROGRESS', { deleted: totalDeleted, failed: totalFailed });
            log(`Kimi：已删除 "${title}"（共 ${totalDeleted}）`, 'debug');

          } catch (e) {
            log(`Kimi：删除 "${title}" 出错: ${e.message}`, 'error');
            totalFailed++;
            singleLoopFail++;
            if (singleLoopFail >= 3) break;
          }
        }

        if (navigatedAway) {
          await sleep(500);
          continue;
        }

        if (deletedThisRound === 0) {
          noProgressRounds++;
          if (noProgressRounds >= 3) {
            log('Kimi：无新进展，停止删除', 'warning');
            break;
          }
          window.scrollTo(0, document.body.scrollHeight);
          await sleep(1000);
        } else {
          noProgressRounds = 0;
          await sleep(500);
        }
      }

      log(`Kimi：批量删除完成，共删除 ${totalDeleted} 条`, 'success');
      send('PROGRESS', { deleted: totalDeleted, failed: totalFailed });
      return totalDeleted > 0;
    } catch (error) {
      log(`Kimi：批量删除异常: ${error.message}`, 'error');
      return false;
    }
  }

  // ============ Kimi DOM 逐条删除（/chat/history 页面专用）============
  async function deleteKimiOne(item) {
    try {
      item.scrollIntoView({ block: 'center' });
      await sleep(200);

      // 触发 hover 显示操作按钮
      item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
      item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
      await sleep(400);

      // 找到 .action-wrapper 内的删除按钮（最右边的 .operation）
      const actionWrapper = item.querySelector('.action-wrapper');
      const ops = actionWrapper ? Array.from(actionWrapper.querySelectorAll('.operation')) : [];
      const deleteOp = ops.find(op => op.querySelector('.delete-icon, [class*="delete"]'))
                    || (ops.length > 0 ? ops[ops.length - 1] : null);

      if (!deleteOp) {
        log('Kimi：找不到删除按钮，尝试旧版菜单方式…', 'warning');
        // 回退：旧版 Kimi 侧边栏菜单
        dispatchHover(item);
        await sleep(400);
        const deleteAction = findDeleteActionElement();
        if (!deleteAction) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return false;
        }
        clickElement(deleteAction);
        await sleep(600);
        const confirmBtn = findConfirmButton();
        if (confirmBtn) { clickElement(confirmBtn); await sleep(800); }
        return true;
      }

      deleteOp.click();
      await sleep(500);

      // 确认删除
      const confirmBtn = document.querySelector('button.kimi-button.danger, button.danger[class*="kimi"]');
      if (confirmBtn) {
        confirmBtn.click();
        await sleep(600);
        return true;
      }

      // 没有确认弹窗时关闭可能打开的面板
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(300);
      return false;
    } catch (e) {
      log(`Kimi DOM删除异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ DeepSeek API 批量删除 (修复版 v3 — 基于实测接口) ============
  async function tryDeepSeekAPIBulkDelete() {
    if (!window.location.hostname.includes('deepseek.com')) return false;

    log('DeepSeek：尝试 API 批量删除模式…', 'info');

    try {
      // 从 localStorage 获取 Bearer token（实测字段名 userToken）
      let authToken = null;
      try {
        const raw = localStorage.getItem('userToken');
        const parsed = raw ? JSON.parse(raw) : null;
        authToken = parsed?.value || parsed?.token || (typeof parsed === 'string' ? parsed : null);
      } catch(e) {}
      if (!authToken) authToken = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('ds_token');

      if (!authToken) {
        log('DeepSeek：未找到认证 token，回退到 DOM 模式', 'warning');
        return false;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
      };
      const fetchOpts = { headers, credentials: 'include' };

      // ---- 分页获取全部会话 ----
      // 端点: GET /api/v0/chat_session/fetch_page?lte_cursor.pinned=false[&lte_cursor.updated_at=<ts>&lte_cursor.id=<id>]
      let allSessions = [];
      let cursorUpdatedAt = null;
      let cursorId = null;
      let pageNum = 0;
      const MAX_PAGES = 200;

      log('DeepSeek：正在获取会话列表…', 'info');

      while (pageNum < MAX_PAGES) {
        pageNum++;
        let url = 'https://chat.deepseek.com/api/v0/chat_session/fetch_page?lte_cursor.pinned=false';
        if (cursorUpdatedAt !== null) url += `&lte_cursor.updated_at=${cursorUpdatedAt}&lte_cursor.id=${cursorId}`;

        const resp = await fetch(url, { method: 'GET', ...fetchOpts });
        if (!resp.ok) {
          log(`DeepSeek：获取列表失败 HTTP ${resp.status}`, 'warning');
          break;
        }
        const data = await resp.json();
        const sessions = data?.data?.biz_data?.chat_sessions || [];
        if (!Array.isArray(sessions) || sessions.length === 0) break;

        allSessions.push(...sessions);
        log(`DeepSeek：已获取 ${allSessions.length} 条…`, 'info');

        if (!data?.data?.biz_data?.has_more) break;
        // 使用最后一条记录作为下一页游标
        const last = sessions[sessions.length - 1];
        cursorUpdatedAt = last.updated_at;
        cursorId = last.id;
        await sleep(200);
      }

      if (allSessions.length === 0) {
        log('DeepSeek：没有可删除的对话', 'info');
        return true;
      }

      log(`DeepSeek：找到 ${allSessions.length} 个对话，开始批量删除…`, 'info');

      let deletedCount = 0;
      let failedCount = 0;

      for (const session of allSessions) {
        if (!cleaner.isRunning) break;
        const sessionId = session.id || session.chat_session_id;
        if (!sessionId) continue;

        try {
          const deleteResp = await fetch('https://chat.deepseek.com/api/v0/chat_session/delete', {
            method: 'POST',
            ...fetchOpts,
            body: JSON.stringify({ chat_session_id: sessionId })
          });

          const result = deleteResp.ok ? await deleteResp.json() : null;
          const success = deleteResp.ok && (result?.code === 0 || result?.data?.biz_code === 0 || deleteResp.status === 200);

          if (success) {
            deletedCount++;
            cleaner.deletedCount = deletedCount;
            if (deletedCount % 10 === 0) {
              log(`DeepSeek：已删除 ${deletedCount}/${allSessions.length}`, 'info');
              send('PROGRESS', { deleted: deletedCount, failed: failedCount });
            }
          } else {
            failedCount++;
            log(`DeepSeek：删除失败 ${sessionId} HTTP${deleteResp.status}`, 'warning');
          }
        } catch(e) {
          failedCount++;
        }
        await sleep(150);
      }

      log(`DeepSeek：API 批量删除完成，共删除 ${deletedCount}/${allSessions.length}`, 'success');
      send('PROGRESS', { deleted: deletedCount, failed: failedCount });
      return deletedCount > 0;
    } catch (error) {
      log(`DeepSeek：API 批量删除异常: ${error.message}`, 'error');
      return false;
    }
  }

  // ============ DeepSeek 逐条 DOM 删除 ============
  async function deleteDeepSeekOne(item) {
    try {
      item.scrollIntoView({ block: 'center' });
      await sleep(200);
      item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await sleep(350);

      // 点击 "..." 图标按钮（class 含 icon-button 但不是 hover-bg）
      const moreBtn = item.querySelector('[class*="icon-button"]:not([class*="hover-bg"])');
      if (!moreBtn) return false;
      moreBtn.click();
      await sleep(400);

      // 找到下拉菜单中的 "删除" 选项
      const allEls = Array.from(document.querySelectorAll('*'));
      const delLabel = allEls.find(el => el.children.length === 0 && el.textContent.trim() === '删除');
      const delOpt = delLabel?.closest('.ds-dropdown-menu-option, [class*="option"], [class*="item"]') || delLabel?.parentElement;
      if (!delOpt) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return false;
      }
      delOpt.click();
      await sleep(400);

      // 确认删除弹窗
      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '删除' && b.className.includes('danger'));
      if (!confirmBtn) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return false;
      }
      confirmBtn.click();
      await sleep(700);
      return true;
    } catch(e) {
      log(`DeepSeek DOM删除异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ DeepSeek DOM 批量删除 ============
  async function tryDeepSeekBulkDelete() {
    if (!window.location.hostname.includes('deepseek.com')) return false;

    log('DeepSeek：尝试清除所有对话…', 'info');

    // 首先尝试 API 方式
    const apiResult = await tryDeepSeekAPIBulkDelete();
    if (apiResult) return true;

    log('DeepSeek：API 方式不可用，回退到 DOM 操作…', 'info');

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

  // ============ Gemini DOM 批量删除 ============
  async function tryGeminiDOMBulkDelete() {
    if (!window.location.hostname.includes('gemini.google.com')) return false;

    log('Gemini：启动 DOM 批量删除…', 'info');

    try {
      let totalDeleted = 0;
      let totalFailed = 0;
      let noProgressRounds = 0;

      while (cleaner.isRunning) {
        // 每轮重新查询，始终取第一条（避免旧引用）
        const convs = Array.from(document.querySelectorAll('[data-test-id="conversation"]'));
        if (convs.length === 0) {
          log('Gemini：所有对话已删除', 'success');
          break;
        }

        const conv = convs[0];
        const title = conv.textContent.trim().slice(0, 20) || '(未知)';

        try {
          // 找同级"更多选项"按钮
          const parent = conv.parentElement;
          const menuBtn = parent?.querySelector('[data-test-id="actions-menu-button"]')
                       || Array.from(document.querySelectorAll('[data-test-id="actions-menu-button"]'))[0];

          if (!menuBtn) {
            log(`Gemini：找不到更多按钮 "${title}"`, 'warning');
            totalFailed++;
            noProgressRounds++;
            if (noProgressRounds >= 3) break;
            continue;
          }

          menuBtn.click();

          // 轮询等待菜单中的删除项（最多1.5s）
          let deleteBtn = null;
          for (let t = 0; t < 15; t++) {
            await sleep(100);
            deleteBtn = document.querySelector('[data-test-id="delete-button"]');
            if (deleteBtn) break;
          }
          if (!deleteBtn) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await sleep(200);
            log(`Gemini：找不到菜单删除项 "${title}"`, 'warning');
            totalFailed++;
            noProgressRounds++;
            if (noProgressRounds >= 3) break;
            continue;
          }

          deleteBtn.click();

          // 轮询等待确认弹窗（最多1.5s）
          let confirmBtn = null;
          for (let t = 0; t < 15; t++) {
            await sleep(100);
            confirmBtn = document.querySelector('[data-test-id="confirm-button"]');
            if (confirmBtn) break;
          }
          if (!confirmBtn) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await sleep(200);
            log(`Gemini：找不到确认按钮 "${title}"`, 'warning');
            totalFailed++;
            noProgressRounds++;
            if (noProgressRounds >= 3) break;
            continue;
          }

          confirmBtn.click();

          // 等待该条目从DOM消失（最多2s）
          for (let t = 0; t < 20; t++) {
            await sleep(100);
            if (!document.contains(conv)) break;
          }
          await sleep(300);

          totalDeleted++;
          noProgressRounds = 0;
          cleaner.deletedCount = totalDeleted;
          cleaner.failedCount = totalFailed;
          send('PROGRESS', { deleted: totalDeleted, failed: totalFailed });
          log(`Gemini：已删除 "${title}"（共 ${totalDeleted}）`, 'debug');

        } catch (e) {
          log(`Gemini：删除 "${title}" 出错: ${e.message}`, 'error');
          totalFailed++;
          noProgressRounds++;
          if (noProgressRounds >= 3) break;
        }
      }

      if (totalDeleted > 0 || totalFailed > 0) {
        log(`Gemini：完成，成功 ${totalDeleted} 失败 ${totalFailed}`, 'success');
        return { deleted: totalDeleted, failed: totalFailed };
      }
      return false;
    } catch (e) {
      log(`Gemini：批量删除异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ 豆包 API 批量删除 ============
  async function tryDoubaoAPIBulkDelete() {
    if (!window.location.hostname.includes('doubao.com')) return false;

    log('豆包：尝试 API 批量删除模式…', 'info');

    try {
      const headers = { 'Content-Type': 'application/json' };
      const fetchOpts = { headers, credentials: 'include' };

      // 豆包 API 必须带的公共参数（从页面网络请求抓取）
      const commonParams = 'version_code=20800&language=zh&device_platform=web&aid=497858&real_aid=497858&pkg_type=release_version&samantha_web=1&use-olympus-account=1';

      // 分页获取所有对话
      let sessions = [];
      let cursor = '';
      let pageNum = 0;
      const MAX_PAGES = 50;

      while (pageNum < MAX_PAGES) {
        pageNum++;
        const cursorParam = cursor ? `&cursor=${cursor}` : '';
        let data = null;

        // 端点1：新版 REST API（需要登录 cookie）
        try {
          const resp = await fetch(
            `https://www.doubao.com/api/conversation/list?${commonParams}&page_size=50${cursorParam}`,
            { method: 'GET', ...fetchOpts }
          );
          if (resp.ok) {
            data = await resp.json();
          }
        } catch (e) { /* 继续 */ }

        // 端点2：旧版 API
        if (!data) {
          try {
            const resp = await fetch(
              `https://www.doubao.com/api/chat/list?${commonParams}&page_size=50${cursorParam}`,
              { method: 'GET', ...fetchOpts }
            );
            if (resp.ok) data = await resp.json();
          } catch (e) { /* 继续 */ }
        }

        if (!data) break;

        const items = data?.data?.list || data?.data?.conversations || data?.data || data?.list || data?.items || [];
        if (!Array.isArray(items) || items.length === 0) break;

        sessions.push(...items);
        log(`豆包：已获取 ${sessions.length} 个对话…`, 'info');

        cursor = data?.data?.cursor || data?.data?.next_cursor || data?.cursor || '';
        if (!cursor || !data?.data?.has_more) break;
      }

      if (sessions.length === 0) {
        log('豆包：API 未返回数据，回退到 DOM 模式', 'warning');
        return false;
      }

      log(`豆包：找到 ${sessions.length} 个对话，开始批量删除…`, 'info');

      let deletedCount = 0;
      const totalItems = sessions.length;

      for (const session of sessions) {
        if (!this.isRunning) break;

        const id = session.id || session.conversation_id || session.uuid || session.chat_id;
        if (!id) continue;

        let deleted = false;

        // 方式1：POST /api/conversation/delete（新版）
        try {
          const resp = await fetch(
            `https://www.doubao.com/api/conversation/delete?${commonParams}`,
            { method: 'POST', ...fetchOpts, body: JSON.stringify({ conversation_id: String(id) }) }
          );
          if (resp.ok) { deleted = true; }
        } catch (e) { /* 继续 */ }

        // 方式2：DELETE /api/chat/{id}（旧版）
        if (!deleted) {
          try {
            const resp = await fetch(
              `https://www.doubao.com/api/chat/${id}?${commonParams}`,
              { method: 'DELETE', ...fetchOpts }
            );
            if (resp.ok) { deleted = true; }
          } catch (e) { /* 继续 */ }
        }

        // 方式3：POST /api/chat/{id}/delete
        if (!deleted) {
          try {
            const resp = await fetch(
              `https://www.doubao.com/api/chat/${id}/delete?${commonParams}`,
              { method: 'POST', ...fetchOpts }
            );
            if (resp.ok) { deleted = true; }
          } catch (e) { /* 继续 */ }
        }

        if (deleted) {
          deletedCount++;
          this.deletedCount++;
          if (deletedCount % 5 === 0 || deletedCount === totalItems) {
            log(`豆包：已删除 ${deletedCount}/${totalItems}`, 'success');
            send('PROGRESS', { deleted: this.deletedCount, failed: this.failedCount });
          }
        } else {
          this.failedCount++;
        }
        await sleep(200);
      }

      log(`豆包：API 批量删除完成，共删除 ${deletedCount}/${totalItems}`, 'success');
      send('PROGRESS', { deleted: this.deletedCount, failed: this.failedCount });
      return deletedCount > 0;
    } catch (e) {
      log(`豆包：API 批量删除异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ 豆包专用删除（CDP 真实鼠标事件模式）============
  async function deleteDoubaoOne(item) {
    try {
      // 跳过导航项（真正的历史对话 href 以数字 ID 结尾）
      const href = item.getAttribute('href') || '';
      if (href && !/\/chat\/\d+/.test(href)) {
        log(`豆包：跳过非对话项 ${href}`, 'debug');
        return false;
      }

      // 手机版对话：特殊处理（需进入页面逐批删除消息）
      if (item.textContent.trim().includes('手机版对话')) {
        return await deleteDoubaoMobileConv(item);
      }

      // 首次调用时附加调试器
      if (!doubaoDebuggerAttached) {
        log('豆包：正在附加 CDP 调试器…', 'info');
        const ok = await cdpAttach();
        if (!ok) {
          log('豆包：CDP 调试器附加失败', 'error');
          return false;
        }
        log('豆包：CDP 调试器已附加', 'debug');
        await sleep(300);
      }

      // 滚动到可见区域
      item.scrollIntoView({ block: 'center' });
      await sleep(400);

      // 获取 item 中心坐标（CSS 像素）
      const itemRect = item.getBoundingClientRect();
      if (itemRect.width === 0 || itemRect.height === 0) {
        log('豆包：item 不可见，跳过', 'warning');
        return false;
      }
      const itemCX = itemRect.left + itemRect.width / 2;
      const itemCY = itemRect.top + itemRect.height / 2;

      // ── Phase 1: 用独立 hover 消息让按钮先出现在 DOM 里 ──
      log(`豆包：CDP hover (${Math.round(itemCX)}, ${Math.round(itemCY)})`, 'debug');
      await cdpHover(itemCX, itemCY);
      await sleep(600);  // 等待 React 渲染 "..." 按钮

      // ── Phase 2: 查找菜单按钮坐标 ──
      let menuBtn = null;
      const container = item.closest('li') || item.parentElement;
      const searchRoot = container || item;

      // 策略1：Radix trigger 特征（含 data-state 属性的按钮）
      for (const btn of searchRoot.querySelectorAll('button[data-state], button[data-radix-collection-item]')) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { menuBtn = btn; break; }
      }
      // 策略2：extra / menu wrapper 内的按钮
      if (!menuBtn) {
        for (const wrapper of searchRoot.querySelectorAll(
          '[class*="extra"], [class*="menu"], [class*="action"], [class*="operate"]'
        )) {
          for (const btn of wrapper.querySelectorAll('button')) {
            const r = btn.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) { menuBtn = btn; break; }
          }
          if (menuBtn) break;
        }
      }
      // 策略3：searchRoot 内最后一个可见含 SVG 的按钮
      if (!menuBtn) {
        for (const btn of Array.from(searchRoot.querySelectorAll('button')).reverse()) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && btn.querySelector('svg')) { menuBtn = btn; break; }
        }
      }

      if (!menuBtn) {
        log('豆包：hover 后仍未找到菜单按钮，跳过', 'warning');
        return false;
      }

      const btnRect = menuBtn.getBoundingClientRect();
      const btnCX = btnRect.left + btnRect.width / 2;
      const btnCY = btnRect.top + btnRect.height / 2;
      log(`豆包：按钮坐标 (${Math.round(btnCX)}, ${Math.round(btnCY)}) html="${menuBtn.outerHTML.slice(0, 100)}"`, 'debug');

      // ── Phase 3: 组合 hover→move→click（单次 SW 激活，无休眠间隔）──
      // 关键改进：SW 内部连续执行 hover+click，避免两次独立消息之间 SW 休眠几秒
      log(`豆包：CDP hover→click item(${Math.round(itemCX)},${Math.round(itemCY)}) → btn(${Math.round(btnCX)},${Math.round(btnCY)})`, 'debug');
      const hoverClickResult = await cdpHoverAndClick(itemCX, itemCY, btnCX, btnCY, 350);
      if (hoverClickResult && hoverClickResult.error) {
        log(`豆包：cdpHoverAndClick 错误: ${hoverClickResult.error}`, 'warning');
      }

      // ── Phase 4: 等待 Radix 菜单打开 ──
      log('豆包：等待菜单打开…', 'debug');
      const menuOpened = await waitForRadixMenuOpen(menuBtn, { maxRetries: 16, checkInterval: 200, postOpenDelay: 300 });

      if (!menuOpened) {
        // Fallback A: 菜单可能用了非标准容器，尝试全局搜索"删除"文字
        log('豆包：waitForRadixMenuOpen 未检测到 portal，尝试全局搜索…', 'debug');
        await sleep(300);

        // Fallback B: 用 cdpEval 在页面上下文直接 .click() 按钮（isTrusted=false，作为最后手段）
        log('豆包：尝试 cdpEval JS click fallback…', 'debug');
        const safeHref = href.replace(/['"\\]/g, '');
        const evalRes = await cdpEval(`
          (function() {
            try {
              var links = document.querySelectorAll('a[href="${safeHref}"]');
              for (var i = 0; i < links.length; i++) {
                var root = links[i].closest('li') || links[i].parentElement;
                if (!root) continue;
                var btns = root.querySelectorAll('button');
                for (var j = btns.length - 1; j >= 0; j--) {
                  var r = btns[j].getBoundingClientRect();
                  if (r.width > 0 && r.height > 0) {
                    btns[j].dispatchEvent(new MouseEvent('mousedown', {bubbles:true,cancelable:true,buttons:1}));
                    btns[j].dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true}));
                    btns[j].dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));
                    btns[j].click();
                    return 'clicked:' + btns[j].outerHTML.slice(0,80);
                  }
                }
              }
              return 'btn_not_found';
            } catch(e) { return 'err:' + e.message; }
          })()
        `);
        log(`豆包：cdpEval 结果: ${JSON.stringify(evalRes && evalRes.result)}`, 'debug');
        await sleep(600);
        const menuOpened2 = await waitForRadixMenuOpen(menuBtn, { maxRetries: 10, checkInterval: 200, postOpenDelay: 300 });
        if (!menuOpened2) {
          log('豆包：菜单仍未打开，关闭并跳过', 'warning');
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(200);
          return false;
        }
      }

      // ── Phase 5: 找 "删除" 菜单项 ──
      let deleteItem = findRadixMenuDeleteButton();

      // 补充策略：全局搜索可见的 "删除" 元素
      if (!deleteItem) {
        for (const el of document.querySelectorAll('[role="menuitem"], div[tabindex], li, button')) {
          const text = normalizeText(el);
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (text === '删除' || text === '删除对话' || text === '删除会话')) {
            deleteItem = el;
            break;
          }
        }
      }

      if (!deleteItem) {
        // 调试：打印所有可见的 portal 内容
        const portals = document.querySelectorAll('[data-radix-popper-content-wrapper]');
        log(`豆包：portal 数=${portals.length}，菜单项 role="menuitem" 数=${document.querySelectorAll('[role="menuitem"]').length}`, 'debug');
        log('豆包：未找到删除菜单项，关闭菜单', 'warning');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(300);
        return false;
      }

      // ── Phase 6: CDP click "删除" ──
      const delRect = deleteItem.getBoundingClientRect();
      const delCX = delRect.left + delRect.width / 2;
      const delCY = delRect.top + delRect.height / 2;
      log(`豆包：CDP click 删除项 (${Math.round(delCX)}, ${Math.round(delCY)})`, 'debug');
      await cdpClick(delCX, delCY);
      await sleep(700);

      // ── Phase 7: 找确认按钮并点击 ──
      const confirmBtn = findConfirmButton();
      if (confirmBtn) {
        const confRect = confirmBtn.getBoundingClientRect();
        const confCX = confRect.left + confRect.width / 2;
        const confCY = confRect.top + confRect.height / 2;
        log(`豆包：CDP click 确认按钮 (${Math.round(confCX)}, ${Math.round(confCY)})`, 'debug');
        await cdpClick(confCX, confCY);
        await sleep(1000);
      } else {
        log('豆包：未找到确认按钮（对话可能直接删除，无需确认）', 'debug');
        await sleep(700);
      }

      return true;
    } catch (e) {
      log(`豆包删除异常: ${e.message}`, 'error');
      return false;
    }
  }

  // ============ 豆包"手机版对话"专项删除 ============
  // 进入手机版对话页面，通过消息级别的"..."→删除→全选→批量删除完成清理
  async function deleteDoubaoMobileConv(sidebarItem) {
    try {
      // 确保调试器已附加
      if (!doubaoDebuggerAttached) {
        const ok = await cdpAttach();
        if (!ok) { log('豆包手机版对话：CDP 附加失败', 'error'); return false; }
        await sleep(300);
      }

      const convHref = sidebarItem?.getAttribute('href') || '';
      const convUrl = convHref ? `https://www.doubao.com${convHref}` : window.location.href;

      // 如果不在该页面则 CDP 点击侧边栏链接导航（SPA 不刷新页面）
      if (convHref && !window.location.pathname.includes(convHref.replace('/chat/', ''))) {
        log('豆包手机版对话：CDP 点击链接导航…', 'info');
        const link = sidebarItem || Array.from(document.querySelectorAll('a[href*="/chat/"]'))
          .find(el => el.textContent.trim().includes('手机版对话'));
        if (link) {
          const lr = link.getBoundingClientRect();
          await cdpClick(lr.left + lr.width / 2, lr.top + lr.height / 2);
          await sleep(2000); // 等待 SPA 路由切换完毕
        } else {
          log('豆包手机版对话：找不到侧边栏链接', 'error');
          return false;
        }
      }

      // 等待 action-bar 出现（最多 5 秒）
      log('豆包手机版对话：等待消息区域加载…', 'info');
      let loadWait = 0;
      while (loadWait < 10) {
        const testBars = document.querySelectorAll('[class*="message-action-bar"]');
        if (testBars.length > 0) break;
        await sleep(500);
        loadWait++;
      }
      // 滚动到顶部确保最多消息可见
      const scrollEl = document.querySelector('[class*="scroll-view"]');
      if (scrollEl) scrollEl.scrollTop = 0;
      await sleep(400);

      log('豆包手机版对话：开始批量清除消息…', 'info');

      let totalDeleted = 0;
      let rounds = 0;
      const MAX_ROUNDS = 50;

      while (rounds < MAX_ROUNDS) {
        rounds++;
        await sleep(600);

        // 找所有可见的 message-action-bar（不限 y 坐标，只要 width/height > 0）
        const bars = Array.from(document.querySelectorAll('[class*="message-action-bar"]'))
          .filter(bar => {
            const r = bar.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });

        if (bars.length === 0) {
          log(`豆包手机版对话：无更多消息，清除完毕（共 ${totalDeleted} 轮）`, 'success');
          break;
        }

        // 取第一个操作栏的最后一个按钮（即"..."）
        const firstBar = bars[0];
        const btns = firstBar.querySelectorAll('button');
        if (btns.length === 0) {
          log('豆包手机版对话：未找到操作按钮', 'warning');
          break;
        }
        const moreBtn = btns[btns.length - 1]; // 最后一个按钮是"..."
        const mbRect = moreBtn.getBoundingClientRect();
        const mbCX = mbRect.left + mbRect.width / 2;
        const mbCY = mbRect.top + mbRect.height / 2;

        log(`豆包手机版对话：CDP click "..." (${Math.round(mbCX)}, ${Math.round(mbCY)})`, 'debug');
        await cdpClick(mbCX, mbCY);
        await sleep(600);

        // 找菜单里的"删除"
        let delMenuItem = null;
        for (const el of document.querySelectorAll('[role="menuitem"], [data-radix-collection-item], div[tabindex]')) {
          const text = normalizeText(el);
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (text === '删除' || text.includes('删除'))) {
            delMenuItem = el;
            break;
          }
        }

        if (!delMenuItem) {
          log('豆包手机版对话：未找到删除菜单项，按 Esc 退出', 'warning');
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(300);
          break;
        }

        const dmRect = delMenuItem.getBoundingClientRect();
        log(`豆包手机版对话：CDP click 删除 (${Math.round(dmRect.left + dmRect.width/2)}, ${Math.round(dmRect.top + dmRect.height/2)})`, 'debug');
        await cdpClick(dmRect.left + dmRect.width / 2, dmRect.top + dmRect.height / 2);
        await sleep(800);

        // 进入勾选模式后，查找所有未勾选的 checkbox 并全部勾选
        const checkboxes = Array.from(document.querySelectorAll(
          'input[type="checkbox"], [class*="checkbox"], [class*="check-box"], [role="checkbox"]'
        )).filter(cb => {
          const r = cb.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });

        if (checkboxes.length > 0) {
          log(`豆包手机版对话：发现 ${checkboxes.length} 个勾选框，全部勾选`, 'info');
          for (const cb of checkboxes) {
            const cbRect = cb.getBoundingClientRect();
            // 若未勾选则点击
            const isChecked = cb.checked || cb.getAttribute('aria-checked') === 'true'
                              || cb.getAttribute('data-state') === 'checked'
                              || cb.classList.contains('checked');
            if (!isChecked) {
              await cdpClick(cbRect.left + cbRect.width / 2, cbRect.top + cbRect.height / 2);
              await sleep(100);
            }
          }
          await sleep(400);
        }

        // 找右下角的"删除"确认按钮
        let confirmDelBtn = null;
        // 找显眼的"删除"按钮（红色/primary，在页面底部）
        for (const btn of document.querySelectorAll('button')) {
          const text = normalizeText(btn);
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.bottom > window.innerHeight * 0.6
              && (text === '删除' || text.includes('删除'))) {
            confirmDelBtn = btn;
            break;
          }
        }

        if (!confirmDelBtn) {
          // 降级：找任意可见的"删除"按钮
          confirmDelBtn = findConfirmButton();
        }

        if (confirmDelBtn) {
          const cdRect = confirmDelBtn.getBoundingClientRect();
          log(`豆包手机版对话：CDP click 确认删除 (${Math.round(cdRect.left + cdRect.width/2)}, ${Math.round(cdRect.top + cdRect.height/2)})`, 'debug');
          await cdpClick(cdRect.left + cdRect.width / 2, cdRect.top + cdRect.height / 2);
          await sleep(1200);
          totalDeleted++;
        } else {
          log('豆包手机版对话：未找到确认删除按钮', 'warning');
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(300);
          break;
        }
      }

      // 删除完内容后，再从侧边栏删除这个对话本身
      log('豆包手机版对话：消息清理完毕，尝试从侧边栏删除会话条目…', 'info');
      await sleep(500);
      // 导航回主页
      if (!window.location.pathname.startsWith('/chat') || window.location.pathname !== '/chat/') {
        window.history.back();
        await sleep(1000);
      }
      // 找侧边栏中的手机版对话项并用正常流程删除
      const mobileLink = Array.from(document.querySelectorAll('a[href*="/chat/"]'))
        .find(el => el.textContent.trim().includes('手机版对话'));
      if (mobileLink) {
        const mlRect = mobileLink.getBoundingClientRect();
        const mlCX = mlRect.left + mlRect.width / 2;
        const mlCY = mlRect.top + mlRect.height / 2;
        await cdpHover(mlCX, mlCY);
        await sleep(500);
        const container = mobileLink.closest('li') || mobileLink.parentElement;
        const menuBtns = (container || mobileLink).querySelectorAll('button');
        if (menuBtns.length > 0) {
          const lastBtn = menuBtns[menuBtns.length - 1];
          const lbRect = lastBtn.getBoundingClientRect();
          if (lbRect.width > 0 && lbRect.height > 0) {
            await cdpClick(lbRect.left + lbRect.width / 2, lbRect.top + lbRect.height / 2);
            await sleep(700);
            const sidebarDelItem = Array.from(document.querySelectorAll('[role="menuitem"], div[tabindex]'))
              .find(el => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && normalizeText(el) === '删除';
              });
            if (sidebarDelItem) {
              const sdRect = sidebarDelItem.getBoundingClientRect();
              await cdpClick(sdRect.left + sdRect.width / 2, sdRect.top + sdRect.height / 2);
              await sleep(700);
              const confirmBtn = findConfirmButton();
              if (confirmBtn) {
                const cbRect = confirmBtn.getBoundingClientRect();
                await cdpClick(cbRect.left + cbRect.width / 2, cbRect.top + cbRect.height / 2);
                await sleep(1000);
              }
            }
          }
        }
      }

      return true;
    } catch (e) {
      log(`豆包手机版对话删除异常: ${e.message}`, 'error');
      return false;
    }
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
        if (window.location.hostname.includes('kimi.')) {
          return await deleteKimiOne(item);
        }
        if (window.location.hostname.includes('deepseek.com')) {
          return await deleteDeepSeekOne(item);
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

      // ChatGPT 批量 (API 方式)
      if (isChatGPTHost()) {
        const result = await tryChatGPTAPIBulkDelete();
        if (result && result.deleted) {
          this.deletedCount = result.deleted;
          this.failedCount = result.failed || 0;
          this.reportProgress();
          log('ChatGPT：API 批量删除完成，即将刷新页面…', 'success');
          this.isRunning = false;
          send('COMPLETED', { deleted: this.deletedCount, failed: this.failedCount });
          // API 设置 is_visible:false 后，ChatGPT 前端不会自动更新 DOM，必须刷新页面
          await sleep(800);
          window.location.reload();
          return;
        }
      }

      // Claude 批量（API + DOM双策略）
      if (!usedBulk && window.location.hostname.includes('claude.ai')) {
        const claudeResult = await tryClaudeBulkDelete();
        if (claudeResult) {
          if (typeof claudeResult === 'object' && claudeResult.deleted !== undefined) {
            this.deletedCount = claudeResult.deleted;
            this.failedCount = claudeResult.failed || 0;
          }
          usedBulk = true;
          this.reportProgress();
          log('Claude：批量删除完成，即将刷新页面…', 'success');
          this.isRunning = false;
          send('COMPLETED', { deleted: this.deletedCount, failed: this.failedCount });
          await sleep(800);
          window.location.reload();
          return;
        }
      }

      // 豆包 批量（先试 API，再走 DOM）
      if (!usedBulk && window.location.hostname.includes('doubao.com')) {
        usedBulk = await tryDoubaoAPIBulkDelete();
        if (usedBulk) {
          this.reportProgress();
          log('豆包：API 批量删除完成，请刷新页面查看效果', 'success');
          this.isRunning = false;
          send('COMPLETED', { deleted: this.deletedCount, failed: this.failedCount });
          await sleep(800);
          window.location.reload();
          return;
        }
        // API 不可用，继续走后面的 DOM 逐条删除
        log('豆包：API 不可用，将使用 DOM 逐条删除', 'info');
      }

      // Kimi 批量（API 模式优先，失败则走 DOM）
      if (!usedBulk && window.location.hostname.includes('kimi.')) {
        usedBulk = await tryKimiAPIBulkDelete();
        if (usedBulk) {
          this.reportProgress();
          log('Kimi：API 批量删除完成，请刷新页面查看效果', 'success');
          this.isRunning = false;
          send('COMPLETED', { deleted: this.deletedCount, failed: this.failedCount });
          await sleep(800);
          window.location.reload();
          return;
        }
        log('Kimi：API 不可用，将使用 DOM 逐条删除', 'info');
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

      // Gemini 专用 DOM 批量删除
      if (!usedBulk && window.location.hostname.includes('gemini.google.com')) {
        const geminiResult = await tryGeminiDOMBulkDelete();
        if (geminiResult) {
          if (typeof geminiResult === 'object' && geminiResult.deleted !== undefined) {
            this.deletedCount = geminiResult.deleted;
            this.failedCount = geminiResult.failed || 0;
          }
          usedBulk = true;
          this.reportProgress();
          log('Gemini：批量删除完成', 'success');
          this.isRunning = false;
          send('COMPLETED', { deleted: this.deletedCount, failed: this.failedCount });
          return;
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
      // 豆包：释放 CDP 调试器
      if (window.location.hostname.includes('doubao.com') && doubaoDebuggerAttached) {
        await cdpDetach();
      }
      this.reportProgress();
      send('COMPLETED', { deleted: this.deletedCount, failed: this.failedCount });
      log(`清理结束: 成功 ${this.deletedCount}, 失败 ${this.failedCount}`, 'success');
    }

    stop() {
      this.isRunning = false;
      if (window.location.hostname.includes('doubao.com') && doubaoDebuggerAttached) {
        cdpDetach();
      }
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
