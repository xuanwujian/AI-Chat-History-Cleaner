<!--
  ChatEraser - 清聊大师
  @author yxstars@outlook.com
  @copyright Copyright (c) 2026 yxstars@outlook.com. All rights reserved.
  @license MIT License
-->

# 🧹 ChatEraser - 清聊大师

**一键批量删除 AI 对话历史记录的 Chrome 扩展**

> One-click bulk delete AI chat history — ChatGPT, Claude, Gemini, DeepSeek, Kimi, Doubao.

[![Version](https://img.shields.io/badge/version-3.0.5-blue)](https://github.com/xuanwujian/AI-Chat-History-Cleaner)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Chrome-yellow)](https://chrome.google.com/webstore)

---

## ✨ 功能特性

- **6 大平台支持**：ChatGPT、Claude、Gemini、DeepSeek、Kimi、豆包
- **双模式删除**：API 批量删除（速度快）+ DOM 逐条删除（兜底）
- **自动识别平台**：打开插件自动检测当前 AI 网站，一键启动
- **实时进度日志**：删除过程可视化，已删 / 失败 / 总计实时更新
- **清理浏览历史**：可选一键清空 Chrome 浏览历史记录（需二次确认）
- **完全本地运行**：零服务器通信，不收集任何用户数据

---

## 📦 支持平台

| 平台 | 域名 | 删除模式 |
|------|------|----------|
| **ChatGPT** | chat.openai.com / chatgpt.com | API 批量 |
| **Claude** | claude.ai | API 批量 |
| **Gemini** | gemini.google.com | DOM 逐条 |
| **DeepSeek** | chat.deepseek.com | API 批量 |
| **Kimi** | kimi.moonshot.cn / kimi.com | DOM 逐条 |
| **豆包** | www.doubao.com | CDP + DOM |

---

## 🔧 安装方法

### 方式一：Chrome Web Store（推荐）
在 [Chrome 应用商店](https://chrome.google.com/webstore) 搜索 **ChatEraser** 安装。

### 方式二：开发者模式手动加载
1. 打开 Chrome 扩展管理页：`chrome://extensions/`
2. 启用右上角 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择本项目文件夹（含 `manifest.json` 的目录）

---

## 📖 使用方法

1. 在 Chrome 中访问任意支持的 AI 平台
2. 点击浏览器工具栏中的 **ChatEraser** 图标
3. 弹窗自动检测当前平台并显示支持状态
4. 点击 **"开始删除历史记录"** — 自动批量删除
5. 实时查看进度日志，删除完成后自动停止

### 其他功能

| 功能 | 说明 |
|------|------|
| 停止删除 | 点击"停止删除"随时中断 |
| 重新检测 | 切换标签后刷新当前平台检测 |
| 清理浏览历史 | 勾选底部复选框，确认后清空 Chrome 全部浏览历史 |

---

## ⚠️ 注意事项

1. **删除不可恢复**：对话历史删除后无法找回，请确认后操作
2. **批量删除耗时**：大量历史记录（数百条）可能需要数分钟
3. **保持页面活跃**：删除过程中不要关闭 AI 平台标签页
4. **豆包特殊说明**：豆包平台使用 CDP 鼠标模拟实现悬停删除，删除速度较其他平台慢

---

## 🔒 隐私说明

- ✅ 所有操作完全在本地浏览器执行，无任何服务器通信
- ✅ 不收集、不存储、不上传任何用户数据
- ✅ 不读取对话内容，仅执行删除操作
- ✅ 源代码开源可审计

详见 [PRIVACY.md](PRIVACY.md)

---

## 🛠 技术说明

| 权限 | 用途 |
|------|------|
| `debugger` | 仅用于豆包：通过 CDP `Input.dispatchMouseEvent` 模拟鼠标悬停显示删除按钮 |
| `history` | 用户主动触发"清理浏览历史"功能，执行前有二次确认弹窗 |
| `scripting` | 向 AI 平台页面注入 content.js 执行删除逻辑 |
| `tabs` | 检测当前标签页 URL 以判断是否为支持平台 |
| `storage` | 保存用户配置（删除间隔、保留条数等） |

---

## 📄 版权声明

- **作者**：yxstars@outlook.com
- **版本**：3.0.5
- **版权**：Copyright (c) 2026 yxstars@outlook.com. All rights reserved.
- **许可**：MIT License

---

如有问题或建议，欢迎提交 [Issue](https://github.com/xuanwujian/AI-Chat-History-Cleaner/issues) 或联系：yxstars@outlook.com
