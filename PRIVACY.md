# Privacy Policy — ChatEraser（清聊大师）

**yxstars@outlook.com**
Last updated: 2026-04-13

## Data Collection

ChatEraser operates **entirely on your local device**. This extension does not:

- Send any data to external servers
- Collect, store, or transmit your conversation content
- Track, log, or share your browsing activity
- Use analytics, telemetry, or third-party tracking services

## Permissions Used

| Permission | Purpose |
|------------|---------|
| `activeTab` | Inject content script into supported AI platform pages when you click "Start Deletion" |
| `scripting` | Execute deletion operations on supported AI platform pages |
| `storage` | Save your personal preferences (deletion interval, retry count, etc.) locally |
| `tabs` | Detect the current active tab and its URL to determine if it is a supported platform |
| `debugger` | Simulate mouse hover/click events on platforms (e.g. Doubao) that require real user interaction — used only on supported AI platform pages you explicitly target |
| `history` | Delete locally stored browsing history entries for supported AI platforms when you enable the "清理历史访问记录" option — only affects your local Chrome browsing history |

## How It Works

When you click "Start Deletion," the extension:

1. Detects the current website URL
2. If it is a supported AI platform, injects a content script into that page
3. Performs deletion via the platform's own API (where available) or via DOM interaction
4. All operations execute **locally** in your browser — no data ever leaves your device

## Third-Party Platforms

The extension interacts with AI platforms operated by third parties (OpenAI, Anthropic, Google, ByteDance, Alibaba, Moonshot, DeepSeek, Zhipu, Tencent, etc.). These platforms' own privacy policies and terms of service apply to their services. ChatEraser only automates deletion of your locally stored conversation history on those platforms.

## Contact

If you have any questions or concerns, contact the developer at: **yxstars@outlook.com**
