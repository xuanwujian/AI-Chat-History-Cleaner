/**
 * Options Script - AI History Cleaner
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

// 保存设置
document.getElementById('saveBtn').addEventListener('click', async () => {
  const settings = {
    confirmBeforeDelete: document.getElementById('confirmBeforeDelete').checked,
    keepRecent: document.getElementById('keepRecent').checked,
    keepCount: parseInt(document.getElementById('keepCount').value),
    deleteInterval: parseInt(document.getElementById('deleteInterval').value),
    maxRetries: parseInt(document.getElementById('maxRetries').value)
  };
  
  await chrome.storage.sync.set(settings);
  
  const status = document.getElementById('status');
  status.classList.add('success');
  setTimeout(() => {
    status.classList.remove('success');
  }, 2000);
});
