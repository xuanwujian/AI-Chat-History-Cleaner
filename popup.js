/**
 * Popup Script - ChatEraser 清聊大师
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
    'claude.ai',
    'gemini.google.com',
    'chat.deepseek.com',
    'kimi.moonshot.cn', 'kimi.com', 'www.kimi.com',
    'www.doubao.com',
  ];

  if (!supportedHosts.some(host => url.hostname.includes(host))) {
    addLog('当前网站不在支持列表中', 'warning');
    return;
  }

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
    'chatgpt.com':          'ChatGPT',
    'chat.openai.com':      'ChatGPT',
    'claude.ai':            'Claude',
    'gemini.google.com':    'Gemini',
    'chat.deepseek.com':    'DeepSeek',
    'kimi.moonshot.cn':     'Kimi',
    'kimi.com':             'Kimi',
    'www.doubao.com':       '豆包',
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
  if (message.source !== 'CHAT_ERASER') return;

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

// ——— GitHub 链接（popup 内链接必须用 chrome.tabs.create，target="_blank" 不可靠）———
document.getElementById('githubLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://github.com/xuanwujian/AI-Chat-History-Cleaner' });
});

// ——— 清理历史访问记录 ———
async function clearAllBrowsingHistory() {
  const statusEl = document.getElementById('historyCleanStatus');

  // 必须经过用户二次确认，防止误操作（CWS 合规要求）
  const confirmed = window.confirm(
    '⚠️ 此操作将清空 Chrome 全部浏览历史记录，且无法恢复。\n\n确定要继续吗？'
  );
  if (!confirmed) {
    // 用户取消，恢复 checkbox
    document.getElementById('historyCleanCheck').checked = false;
    statusEl.textContent = '已取消';
    statusEl.className = 'history-clean-status show';
    statusEl.style.color = '#FFE4B5';
    return;
  }

  statusEl.textContent = '🔄 正在清空全部历史记录...';
  statusEl.className = 'history-clean-status show';
  statusEl.style.color = '';

  try {
    await chrome.history.deleteAll();
    statusEl.textContent = '✅ 已清空全部浏览器历史记录';
    statusEl.style.color = '#90EE90';
  } catch (e) {
    statusEl.textContent = '❌ 清空失败：' + e.message;
    statusEl.style.color = '#FFB6C1';
    document.getElementById('historyCleanCheck').checked = false;
  }
}

document.getElementById('historyCleanCheck').addEventListener('change', async () => {
  if (document.getElementById('historyCleanCheck').checked) {
    await clearAllBrowsingHistory();
  } else {
    const statusEl = document.getElementById('historyCleanStatus');
    statusEl.className = 'history-clean-status';
    statusEl.style.color = '';
  }
});

checkCurrentSite();
