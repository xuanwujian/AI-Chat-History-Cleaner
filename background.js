/**
 * Background Service Worker - AI History Cleaner
 * 
 * @author yxstars@outlook.com
 * @copyright Copyright (c) 2026 yxstars@outlook.com. All rights reserved.
 * @license MIT License
 * 
 * 用于转发 content script 和 popup 之间的消息
 */

// Background service worker v3.0
// 用于转发content script和popup之间的消息

let lastLogKey = '';
let lastLogTime = 0;

chrome.runtime.onInstalled.addListener(() => {
  console.log('[AI History Cleaner v3.0] Installed');
});

function forwardMessage(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source !== 'AI_HISTORY_CLEANER') return;

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
