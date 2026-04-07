// 注入脚本 - 用于与页面更深层的交互
// 这个文件会被注入到页面中，可以访问页面的JavaScript上下文

(function() {
  'use strict';

  // 如果页面使用了React/Vue/Angular等框架，可能需要通过这种方式访问内部状态
  // 这里预留一些高级功能的钩子

  window.aiHistoryCleaner = {
    version: '2.0.0',
    
    // 获取React组件实例（如果页面使用React）
    getReactInstance: function(element) {
      const key = Object.keys(element).find(key => 
        key.startsWith('__reactInternalInstance$') || 
        key.startsWith('__reactFiber$')
      );
      return key ? element[key] : null;
    },

    // 模拟键盘事件
    simulateKeyPress: function(key, element) {
      const events = ['keydown', 'keypress', 'keyup'];
      events.forEach(type => {
        const event = new KeyboardEvent(type, {
          key: key,
          code: `Key${key.toUpperCase()}`,
          bubbles: true,
          cancelable: true
        });
        (element || document).dispatchEvent(event);
      });
    },

    // 等待元素出现
    waitForElement: function(selector, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }

        const observer = new MutationObserver(() => {
          const element = document.querySelector(selector);
          if (element) {
            observer.disconnect();
            resolve(element);
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Timeout waiting for ${selector}`));
        }, timeout);
      });
    }
  };

  console.log('[AI History Cleaner] Injected script loaded');
})();
