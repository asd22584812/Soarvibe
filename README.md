# SOARVIBE

AI 旅遊規劃 Web App（手機版介面，支援 PWA）。

## 使用方式

### 本機

直接用瀏覽器開啟 `index.html` 即可。

### PWA（加到主畫面）

1. 將專案部署到 **HTTPS** 網站（見下方 GitHub Pages）
2. 用手機瀏覽器開啟網址
3. **iPhone（Safari）**：分享 → 「加入主畫面」
4. **Android（Chrome）**：選單 → 「安裝應用程式」或「加到主畫面」

## API 金鑰（重要）

為安全起見，金鑰**不會**寫在 GitHub 程式碼裡，請在 App 內設定：

1. 開啟 App → 右下角 **個人中心**（人形圖示）
2. 捲到 **「API 金鑰設定」**
3. 填入金鑰後按 **儲存金鑰**

| 金鑰 | 用途 | 取得方式 |
|------|------|----------|
| **Gemini AI** | AI 客製化行程 | [Google AI Studio](https://aistudio.google.com/apikey) |
| **Google Maps** | 地圖／Places 搜尋 | [Google Cloud Console](https://console.cloud.google.com/) |

金鑰只存在**您這台裝置的瀏覽器**（localStorage），不會上傳到 GitHub。

未設定金鑰時，App 仍可使用「精選備援行程」，但 AI 客製化與地圖功能會受限。

## GitHub Pages 部署

1. 到 GitHub 倉庫 **Settings → Pages**
2. **Source** 選 `Deploy from a branch`
3. **Branch** 選 `main`，資料夾選 `/ (root)`
4. 儲存後約 1～2 分鐘，網址會是：

   `https://asd22584812.github.io/Soarvibe/`

## 檔案

- `index.html` — 主程式
- `manifest.json` — PWA 設定
- `service-worker.js` — 離線快取
- `bg.png` — 背景圖
- `soarvibe-logo.png` — Logo / App 圖示
