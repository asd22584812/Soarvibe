# SOARVIBE

AI 旅遊規劃 Web App（手機版介面，支援 PWA）。

## 正式站（Firebase Hosting）

**主站 / 正式 PWA：**

- https://soarvibe-885c8.web.app
- https://soarvibe-885c8.firebaseapp.com（同內容備援網域）

請用上述網址「加入主畫面」。這樣 Google Auth `signInWithRedirect` 與 `authDomain` 同站，可避免 iOS Safari / PWA 的 third-party storage 問題。

部署：

```bash
npx firebase deploy --only hosting
```

## 使用方式

### 本機

直接用瀏覽器開啟 `index.html` 即可。

### PWA（加到主畫面）

1. 用手機開啟 **Firebase Hosting 正式網址**（見上）
2. **iPhone（Safari）**：分享 → 「加入主畫面」
3. **Android（Chrome）**：選單 → 「安裝應用程式」或「加到主畫面」

## API 金鑰（重要）

為安全起見，金鑰**不會**寫在 GitHub 程式碼裡，請在 App 內設定：

1. 開啟 App → 右下角 **個人中心**（人形圖示）
2. 捲到 **「API 金鑰設定」**
3. 填入金鑰後按 **儲存金鑰**

| 金鑰 | 用途 | 取得方式 |
|------|------|----------|
| **Gemini AI** | AI 客製化行程 | [Google AI Studio](https://aistudio.google.com/apikey) |
| **Google Maps** | 地圖／Places 搜尋 | [Google Cloud Console](https://cloud.google.com/) |

金鑰只存在**您這台裝置的瀏覽器**（localStorage），不會上傳到 GitHub。

未設定金鑰時，App 仍可使用「精選備援行程」，但 AI 客製化與地圖功能會受限。

## GitHub Pages（備援／開發鏡像）

GitHub Pages **不再是正式 PWA 主站**，僅作備援／開發鏡像：

`https://asd22584812.github.io/Soarvibe/`

在此網域上，iOS Safari / PWA 的 Google redirect 登入可能因 third-party storage 失敗；請改用 Firebase Hosting 正式站。

## 檔案

- `index.html` — 主程式
- `manifest.json` — PWA 設定
- `service-worker.js` — 離線快取
- `bg.png` — 背景圖
- `soarvibe-logo.png` — Logo / App 圖示
