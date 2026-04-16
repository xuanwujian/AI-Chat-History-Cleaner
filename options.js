/**
 * Options Script - ChatEraser 清聊大师
 * 
 * @author yxstars@outlook.com
 * @copyright Copyright (c) 2026 yxstars@outlook.com. All rights reserved.
 * @license MIT License
 */

const defaultSettings = {
  confirmBeforeDelete: true,
  keepRecent: true,
  keepCount: 3,
  deleteInterval: 1500,
  maxRetries: 3
};

// 加载设置
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get(defaultSettings);
  
  document.getElementById('confirmBeforeDelete').checked = settings.confirmBeforeDelete;
  document.getElementById('keepRecent').checked = settings.keepRecent;
  document.getElementById('keepCount').value = settings.keepCount;
  document.getElementById('deleteInterval').value = settings.deleteInterval;
  document.getElementById('maxRetries').value = settings.maxRetries;
});

// ── 输入校验辅助 ──────────────────────────────────────────────────────────────
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, Number(val) || min));
}

function showFieldError(input, msg) {
  input.style.borderColor = '#ff4757';
  const existing = input.nextElementSibling;
  if (existing && existing.classList.contains('field-error')) existing.remove();
  const err = document.createElement('span');
  err.className = 'field-error';
  err.style.cssText = 'color:#ff4757;font-size:11px;display:block;margin-top:4px;margin-left:28px';
  err.textContent = msg;
  input.parentNode.insertBefore(err, input.nextSibling);
  setTimeout(() => { err.remove(); input.style.borderColor = ''; }, 3000);
}

// ── 保存设置 ─────────────────────────────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', async () => {
  const keepCountVal     = document.getElementById('keepCount').value;
  const deleteIntervalVal = document.getElementById('deleteInterval').value;
  const maxRetriesVal    = document.getElementById('maxRetries').value;

  // 校验 keepCount：整数，0–20
  const keepCount = clamp(keepCountVal, 0, 20);
  if (keepCount !== Number(keepCountVal)) {
    showFieldError(document.getElementById('keepCount'), '保留条数必须在 0–20 之间');
    return;
  }

  // 校验 deleteInterval：整数，300–5000ms
  const deleteInterval = clamp(deleteIntervalVal, 300, 5000);
  if (deleteInterval !== Number(deleteIntervalVal)) {
    showFieldError(document.getElementById('deleteInterval'), '间隔必须在 300–5000ms 之间');
    return;
  }

  // 校验 maxRetries：整数，1–10
  const maxRetries = clamp(maxRetriesVal, 1, 10);
  if (maxRetries !== Number(maxRetriesVal)) {
    showFieldError(document.getElementById('maxRetries'), '重试次数必须在 1–10 之间');
    return;
  }

  const settings = {
    confirmBeforeDelete: document.getElementById('confirmBeforeDelete').checked,
    keepRecent:          document.getElementById('keepRecent').checked,
    keepCount,
    deleteInterval,
    maxRetries
  };

  await chrome.storage.sync.set(settings);

  const status = document.getElementById('status');
  status.classList.add('success');
  setTimeout(() => status.classList.remove('success'), 2000);
});

// ── 实时校验反馈（输入时即清理错误样式）──────────────────────────────────────
['keepCount', 'deleteInterval', 'maxRetries'].forEach(id => {
  document.getElementById(id).addEventListener('input', function () {
    if (this.nextElementSibling?.classList.contains('field-error')) {
      this.nextElementSibling.remove();
      this.style.borderColor = '';
    }
  });
});
