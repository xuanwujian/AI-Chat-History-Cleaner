/**
 * Popup Script - AI History Cleaner
 * 
 * @author yxstars@outlook.com
 * @copyright Copyright (c) 2026 yxstars@outlook.com. All rights reserved.
 * @license MIT License
 */

let isCleaning = false;
let deletedCount = 0;
let failedCount = 0;

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(command) {
  const tab = await getCurrentTab();
  if (!tab) {
    addLog('无法获取当前标签页', 'error');
    return;
  }

  const url = new URL(tab.url);
  const supportedHosts = [
    'chat.openai.com', 'chatgpt.com',
    'www.doubao.com',
    'tongyi.aliyun.com',
    'gemini.google.com',
    'chat.deepseek.com',
    'kimi.moonshot.cn',
    'grok.com',
    'claude.ai',
    'chatglm.cn',
    'yuanbao.tencent.com',
    'www.perplexity.ai',
    'copilot.microsoft.com',
    'poe.com'
  ];

  if (!supportedHosts.some(host => url.hostname.includes(host))) {
    addLog('当前网站不在支持列表中', 'warning');
    return;
  }

  // 首先尝试注入content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (injectError) {
    // 可能已经注入了，忽略错误
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      addLog(`[尝试${attempt}] 向content script发送: ${command}`, 'debug');
      const response = await chrome.tabs.sendMessage(tab.id, { command });
      addLog(`消息已发送，响应: ${JSON.stringify(response)}`, 'info');
      return;
    } catch (e) {
      lastError = e;
      if (attempt < 3) {
        addLog(`尝试${attempt}失败，准备重试...`, 'warning');
        await new Promise(resolve => setTimeout(resolve, 800));
        // 再次尝试注入
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (e2) {}
      }
    }
  }

  if (lastError) {
    addLog(`发送失败(已重试3次): ${lastError.message}`, 'error');
    addLog('请刷新页面后重试', 'warning');
  }
}

let lastLogSig = '';
let lastLogTs = 0;

function addLog(message, type = 'info') {
  const sig = `${type}:${message}`;
  const now = Date.now();
  if (sig === lastLogSig && now - lastLogTs < 450) return;
  lastLogSig = sig;
  lastLogTs = now;

  const container = document.getElementById('logContainer');
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const item = document.createElement('div');
  item.className = 'log-item';
  item.innerHTML = `<span class="log-time">[${time}]</span><span class="log-${type}">${message}</span>`;

  container.appendChild(item);
  container.scrollTop = container.scrollHeight;

  while (container.children.length > 50) {
    container.removeChild(container.firstChild);
  }
}

function updateStats() {
  document.getElementById('deletedCount').textContent = deletedCount;
  document.getElementById('failedCount').textContent = failedCount;
  document.getElementById('totalCount').textContent = deletedCount + failedCount;
}

async function checkCurrentSite() {
  const tab = await getCurrentTab();
  if (!tab) return;

  const url = new URL(tab.url);
  const hostname = url.hostname;

  const siteNames = {
    'chat.openai.com': 'ChatGPT (OpenAI)',
    'chatgpt.com': 'ChatGPT',
    'www.doubao.com': '豆包',
    'tongyi.aliyun.com': '通义千问',
    'gemini.google.com': 'Gemini',
    'chat.deepseek.com': 'DeepSeek',
    'kimi.moonshot.cn': 'Kimi',
    'grok.com': 'Grok',
    'claude.ai': 'Claude',
    'chatglm.cn': '智谱清言',
    'yuanbao.tencent.com': '腾讯元宝',
    'www.perplexity.ai': 'Perplexity',
    'copilot.microsoft.com': 'Copilot',
    'poe.com': 'Poe'
  };

  const siteNameEl = document.getElementById('siteName');
  const siteStatusEl = document.getElementById('siteStatus');
  const startBtn = document.getElementById('startBtn');

  let foundSite = null;
  for (const [key, name] of Object.entries(siteNames)) {
    if (hostname.includes(key)) {
      foundSite = name;
      break;
    }
  }

  if (foundSite) {
    siteNameEl.textContent = foundSite;
    siteNameEl.className = 'status-value';
    siteStatusEl.textContent = '✅ 支持';
    siteStatusEl.className = 'status-value supported';
    startBtn.disabled = false;
  } else {
    siteNameEl.textContent = hostname || '未知';
    siteNameEl.className = 'status-value';
    siteStatusEl.textContent = '❌ 不支持';
    siteStatusEl.className = 'status-value unsupported';
    startBtn.disabled = true;
  }
}

async function checkContentScriptReady() {
  const tab = await getCurrentTab();
  if (!tab) return false;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { command: 'GET_STATUS' });
    return response && (response.status === 'ready' || typeof response.isRunning === 'boolean');
  } catch (e) {
    return false;
  }
}

async function startCleaning() {
  if (isCleaning) return;

  isCleaning = true;
  deletedCount = 0;
  failedCount = 0;

  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('stopBtn').style.display = 'block';
  document.getElementById('refreshBtn').style.display = 'none';
  document.getElementById('progressSection').classList.add('active');
  document.getElementById('runStatus').textContent = '运行中';
  document.getElementById('logContainer').innerHTML = '';

  addLog('正在启动清理...', 'info');
  updateStats();

  // 检查content script是否就绪
  addLog('检查content script状态...', 'debug');
  const isReady = await checkContentScriptReady();
  if (!isReady) {
    addLog('首次使用，正在注入content script...', 'info');
    const tab = await getCurrentTab();
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      addLog('Content script注入成功', 'success');
    } catch (e) {
      addLog(`注入失败: ${e.message}`, 'error');
    }
  } else {
    addLog('Content script已就绪', 'debug');
  }

  await sendToContent('START');
}

async function stopCleaning() {
  isCleaning = false;

  document.getElementById('startBtn').style.display = 'block';
  document.getElementById('stopBtn').style.display = 'none';
  document.getElementById('refreshBtn').style.display = 'block';
  document.getElementById('runStatus').textContent = '已停止';

  addLog('正在停止...', 'warning');
  await sendToContent('STOP');
}

async function refreshDetection() {
  await checkCurrentSite();
  addLog('重新检测网站', 'info');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source !== 'AI_HISTORY_CLEANER') return;

  switch (message.type) {
    case 'LOG':
      addLog(message.data.message, message.data.type);
      break;
    case 'PROGRESS':
      deletedCount = message.data.deleted ?? deletedCount;
      failedCount = message.data.failed ?? failedCount;
      updateStats();
      break;
    case 'COMPLETED':
      isCleaning = false;
      document.getElementById('startBtn').style.display = 'block';
      document.getElementById('stopBtn').style.display = 'none';
      document.getElementById('refreshBtn').style.display = 'block';
      document.getElementById('runStatus').textContent = '已完成';
      addLog('清理完成！', 'success');
      break;
    case 'READY':
      addLog('清理器已就绪', 'info');
      break;
  }
});

document.getElementById('startBtn').addEventListener('click', startCleaning);
document.getElementById('stopBtn').addEventListener('click', stopCleaning);
document.getElementById('refreshBtn').addEventListener('click', refreshDetection);

checkCurrentSite();
