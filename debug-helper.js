// AI History Cleaner 调试助手
// 在目标网站Console中运行此脚本来检测UI结构

(function() {
  'use strict';

  const DEBUG = {
    // 检测历史记录项
    detectHistoryItems() {
      console.log('%c=== 检测历史记录项 ===', 'color: #667eea; font-size: 14px; font-weight: bold');

      const selectors = [
        'nav a[href^="/c/"]',
        'aside a[href^="/c/"]',
        '[data-testid^="history-item-"]',
        '[data-testid*="conversation-item"]',
        '[data-testid*="history"] a[href^="/c/"]',
        'li[data-testid*="conversation"] a',
        '[role="listitem"] a[href*="/c/"]',
        '[data-testid="history-list"] a[href^="/c/"]',
        '[class*="chat-list"] a[href^="/c/"]',
        '[class*="conversations"] a[href^="/c/"]',
        'a[href^="/chat/"]',
        '[data-testid*="chat-item"]'
      ];

      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`%c✅ ${selector}`, 'color: #4ec9b0', `- 找到 ${elements.length} 个元素`);
            console.log('  第一个元素:', elements[0]);
          } else {
            console.log(`%c❌ ${selector}`, 'color: #f48771', '- 未找到');
          }
        } catch (e) {
          console.log(`%c⚠️ ${selector}`, 'color: #dcdcaa', `- 错误: ${e.message}`);
        }
      });
    },

    // 检测菜单按钮
    detectMenuButtons() {
      console.log('%c=== 检测菜单按钮 ===', 'color: #667eea; font-size: 14px; font-weight: bold');

      const buttons = document.querySelectorAll('button');
      console.log(`页面共有 ${buttons.length} 个按钮`);

      let found = 0;
      buttons.forEach(btn => {
        const label = btn.getAttribute('aria-label') || '';
        const text = btn.textContent.trim();
        const hasSvg = btn.querySelector('svg') !== null;

        if (label.toLowerCase().includes('menu') ||
            label.toLowerCase().includes('more') ||
            label.toLowerCase().includes('option') ||
            text.length <= 3 && hasSvg) {
          console.log(`%c找到菜单按钮 #${++found}:`, 'color: #4ec9b0');
          console.log('  aria-label:', label);
          console.log('  text:', text);
          console.log('  class:', btn.className);
          console.log('  element:', btn);
        }
      });

      if (found === 0) {
        console.log('%c⚠️ 未找到菜单按钮', 'color: #f48771');
      }
    },

    // 检测删除相关元素
    detectDeleteElements() {
      console.log('%c=== 检测删除相关元素 ===', 'color: #667eea; font-size: 14px; font-weight: bold');

      const keywords = ['delete', 'remove', 'trash', '删除', '移除', '清除', 'archive', '归档'];
      const allElements = document.querySelectorAll('button, div, span, a, li');

      let found = 0;
      allElements.forEach(el => {
        const text = (el.textContent || '').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

        keywords.forEach(keyword => {
          if (text.includes(keyword) || ariaLabel.includes(keyword)) {
            if (el.offsetParent !== null) { // 可见元素
              console.log(`%c找到 "${keyword}" 元素 #${++found}:`, 'color: #4ec9b0');
              console.log('  text:', el.textContent.trim().substring(0, 50));
              console.log('  aria-label:', ariaLabel);
              console.log('  element:', el);
            }
          }
        });
      });
    },

    // 检测对话框
    detectDialogs() {
      console.log('%c=== 检测对话框/弹窗 ===', 'color: #667eea; font-size: 14px; font-weight: bold');

      const selectors = [
        '[role="dialog"]',
        '[role="alertdialog"]',
        '[class*="modal"]',
        '[class*="dialog"]',
        '[class*="Modal"]',
        '[data-testid*="modal"]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`%c✅ ${selector}: ${elements.length} 个`, 'color: #4ec9b0');
          elements.forEach((el, i) => {
            const buttons = el.querySelectorAll('button');
            console.log(`  [${i}] 包含 ${buttons.length} 个按钮`);
            buttons.forEach(btn => {
              console.log(`      - "${btn.textContent.trim()}"`);
            });
          });
        }
      });
    },

    // 运行完整诊断
    runFullDiagnostic() {
      console.clear();
      console.log('%c🧹 AI History Cleaner - 调试助手', 'color: #667eea; font-size: 16px; font-weight: bold');
      console.log('%c当前页面: ' + window.location.href, 'color: #9cdcfe');
      console.log('');

      this.detectHistoryItems();
      console.log('');
      this.detectMenuButtons();
      console.log('');
      this.detectDeleteElements();
      console.log('');
      this.detectDialogs();

      console.log('');
      console.log('%c=== 诊断完成 ===', 'color: #667eea; font-size: 14px; font-weight: bold');
      console.log('如果发现选择器失效，请将上述结果复制给开发者');
    }
  };

  // 暴露到全局
  window.AICleanerDebug = DEBUG;

  console.log('%c🔧 调试助手已加载！运行 AICleanerDebug.runFullDiagnostic() 开始诊断', 'color: #4ec9b0; font-size: 12px;');
})();
