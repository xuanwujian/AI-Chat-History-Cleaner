/**
 * Background Service Worker - ChatEraser 清聊大师
 *
 * @author yxstars@outlook.com
 * @copyright Copyright (c) 2026 yxstars@outlook.com. All rights reserved.
 * @license MIT License
 *
 * 用于转发 content script 和 popup 之间的消息，以及 CDP 鼠标事件模拟（豆包）
 */

// ChatEraser Background Service Worker v3.1
let lastLogKey = '';
let lastLogTime = 0;

// Track tabs with debugger attached
const attachedTabs = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ChatEraser 清聊大师 v3.1] Installed');
});

// Clean up debugger on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (attachedTabs.has(tabId)) {
    chrome.debugger.detach({ tabId }, () => {
      attachedTabs.delete(tabId);
    });
  }
});

// Clean up if debugger detached externally (e.g. DevTools opened)
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) attachedTabs.delete(source.tabId);
});

function forwardMessage(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

// CDP helper: send a mouse event to a tab
function cdpMouseEvent(tabId, type, x, y, extra = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type,
      x: Math.round(x),
      y: Math.round(y),
      button: (type === 'mouseMoved') ? 'none' : 'left',
      buttons: (type === 'mousePressed') ? 1 : 0,
      clickCount: (type === 'mousePressed') ? 1 : 0,
      modifiers: 0,
      pointerType: 'mouse',
      ...extra
    }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source !== 'CHAT_ERASER' && !message.type?.startsWith('CDP_')) {
    return;
  }

  // ——— CDP 鼠标模拟（豆包专用）———

  if (message.type === 'CDP_ATTACH') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ error: 'no tabId' }); return true; }
    if (attachedTabs.has(tabId)) { sendResponse({ ok: true, alreadyAttached: true }); return true; }
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        attachedTabs.add(tabId);
        sendResponse({ ok: true });
      }
    });
    return true; // async
  }

  if (message.type === 'CDP_DETACH') {
    const tabId = sender.tab?.id;
    if (!tabId || !attachedTabs.has(tabId)) { sendResponse({ ok: true }); return true; }
    chrome.debugger.detach({ tabId }, () => {
      attachedTabs.delete(tabId);
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'CDP_MOUSE_HOVER') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ error: 'no tabId' }); return true; }
    cdpMouseEvent(tabId, 'mouseMoved', message.x, message.y)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === 'CDP_MOUSE_CLICK') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ error: 'no tabId' }); return true; }
    (async () => {
      try {
        await cdpMouseEvent(tabId, 'mouseMoved', message.x, message.y);
        await sleep(40);
        await cdpMouseEvent(tabId, 'mousePressed', message.x, message.y);
        await sleep(30);
        await cdpMouseEvent(tabId, 'mouseReleased', message.x, message.y);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  // ——— 组合 hover→move→click（单次 SW 激活，无延迟）———
  if (message.type === 'CDP_HOVER_AND_CLICK') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ error: 'no tabId' }); return true; }
    (async () => {
      try {
        const { ix, iy, bx, by, hoverDelay = 350 } = message;
        // 1. Hover over item to trigger CSS :hover state
        await cdpMouseEvent(tabId, 'mouseMoved', ix, iy);
        await sleep(hoverDelay);
        // 2. Move to button position (keeps hover chain alive)
        await cdpMouseEvent(tabId, 'mouseMoved', bx, by);
        await sleep(80);
        // 3. Click at button
        await cdpMouseEvent(tabId, 'mousePressed', bx, by);
        await sleep(30);
        await cdpMouseEvent(tabId, 'mouseReleased', bx, by);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  // ——— CDP Runtime.evaluate（在页面上下文执行 JS，用于 fallback）———
  if (message.type === 'CDP_EVAL') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ error: 'no tabId' }); return true; }
    chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: message.expression,
      returnByValue: true,
      awaitPromise: false
    }, (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else if (result && result.exceptionDetails) {
        sendResponse({ error: JSON.stringify(result.exceptionDetails).slice(0, 200) });
      } else {
        sendResponse({ ok: true, result: result && result.result && result.result.value });
      }
    });
    return true;
  }

  // ——— 普通消息转发 ———

  if (!message.source || message.source !== 'CHAT_ERASER') return;

  // 对 LOG 类型消息做去重
  if (message.type === 'LOG') {
    const key = String(message.data?.message || '');
    const now = Date.now();
    if (key && key === lastLogKey && now - lastLogTime < 400) {
      return true;
    }
    lastLogKey = key;
    lastLogTime = now;
  }

  // 转发消息给 popup（如果打开着）
  forwardMessage(message);

  return true;
});
