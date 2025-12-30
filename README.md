# KH_Parking｜高雄市停車場資訊專案

本專案是一個以 **GitHub Pages 靜態網站** 為基礎的學習型專案，目標是建立一個可維護、可擴充、且不依賴前端即時 API 的高雄市停車場資訊頁面。

---

##  專案目標

- 建立可在 GitHub Pages 穩定運作的停車場資訊網站
- 練習資料分層設計（Primary Data / Overrides Data）
- 實作「後台批次更新、前端純顯示」的實務架構
- 熟悉 Google Places API（New）的正確使用方式
- 練習與 AI（Codex）協作進行問題診斷與修正

---

##  專案架構

```text
KH_Parking/
├─ index.html
├─ app.js
├─ overrides.json
├─ kaohsiung_parking_lots_2025-12-25_schema_placephoto_fallback.json
├─ assets/
│  └─ photos/
│     └─ *.jpg
└─ scripts/
   └─ update_google_rating.py
```

---

##  學習重點（Learning Highlights）

### 1. 靜態網站 × 動態資料的正確模式

- GitHub Pages 屬於純靜態網站
- 不適合在前端：
  - 即時呼叫第三方 API
  - 儲存或暴露 API Key
- 採用實務穩定模式：

```text
後台（本機）批次更新資料
        ↓
產生乾淨、可版控的 JSON
        ↓
前端僅負責讀取與顯示
```

---

### 2. 資料分層設計（Data Layering）

#### 2.1 主資料（Primary Data）

- 來源：政府停車場清冊
- 檔案：
  - `kaohsiung_parking_lots_2025-12-25_schema_placephoto_fallback.json`
- 特性：
  - 結構穩定
  - 不常變動
  - 不含第三方商業平台資訊

#### 2.2 補值資料（Overrides / Enrichment Data）

- 來源：Google Places API（後台批次）
- 檔案：
  - `overrides.json`
- 內容：
  - Google 星等（rating）
  - 評論數（review_count）
  - 本地圖片路徑（thumbnail_url）
  - 更新日期（as_of）

---

### 3. Google Places API 的實務用法

- 使用 **Places API (New)**，避免 Legacy API 的 REQUEST_DENIED 問題
- API Key 僅存在於本機環境變數
- 後台以 Python 批次取得：
  - rating
  - userRatingCount
- 取得後寫入 JSON，前端不再即時呼叫 API

---

### 4. Python 批次腳本實作

透過 `scripts/update_google_rating.py` 練習：

- JSON 讀寫
- REST API 呼叫（requests）
- 錯誤診斷（找不到 place_id、REQUEST_DENIED）
- 地址清洗（去括號、地號、段小段）
- 環境變數管理敏感資訊
- `.venv` 虛擬環境與專案目錄分離

---

### 5. 前端資料合併與除錯

- 初始化時同時載入：
  - 主資料 JSON
  - overrides.json
- 以停車場名稱作為 key 合併資料
- 透過 DevTools：
  - Network：確認 JSON 載入成功
  - Console：驗證資料是否成功覆蓋

---

### 6. 圖片顯示策略（不依賴第三方 API）

- 不使用 Google Street View / Place Photo API
- 圖片來源：
  - `overrides.json` 指定的本地圖片
  - 無圖片則顯示 placeholder
- 優點：
  - 不需 API Key
  - 不受 ORB / CORS 影響
  - 適合 GitHub Pages

---

### 7. AI（Codex）協作開發

- 練習撰寫結構化指令給 AI
- 指令包含：
  - 問題背景
  - 明確修正目標
  - 不可使用的技術
  - 驗收條件
- 讓 AI 協助診斷、修正與驗證

---

##  專案總結

本專案重點不在畫面設計，而在：

- 資料來源分離與分層
- 後台批次更新 × 前端穩定顯示
- API 合規與安全使用
- 實務除錯流程
- 與 AI 工具的有效協作

