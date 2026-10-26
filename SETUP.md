# 部署步驟（全部在瀏覽器完成，手機也可以）

需要：一個 Google 帳號（你的）、約 30 分鐘。費用：家用量在 Firebase 免費額度內。

## 第一步：建立 Firebase 專案

1. 開 https://console.firebase.google.com ，用你的 Google 帳號登入，按「建立專案」。
2. 專案名稱輸入 `mom-care`（或任何名稱），Google Analytics 可以關掉，建立。
3. 進入專案後，左邊選單 **安全性 → Authentication** → 開始使用 → 登入方式 → **Google** → 啟用，
   填專案的公開名稱與支援電子郵件，儲存。
4. **資料庫和儲存空間 → Firestore Database** → 建立資料庫 → 位置選 `asia-east1`（台灣）→ 以「正式版模式」開始 → 建立。
5. 不需要開 Storage（新專案要付費方案才能用；照片改存在 Firestore，免費額度 1 GB 足夠家用多年）。
6. 左上角齒輪 → **專案設定** → 往下捲到「您的應用程式」→ 按 `</>`（網頁）→
   暱稱填 `web`，**不要**勾選 Hosting → 註冊 → 會出現一段 `firebaseConfig = { ... }`，
   把裡面的內容貼給我，我會幫你填進 `public/firebase-config.js`（或你自己改也行）。

## 第二步：貼上安全規則

1. Firestore Database → 上方「規則」分頁 → 全選刪掉 → 貼上 `firestore.rules` 的全部內容 → 發布。

## 第三步：建立初始資料（只做一次）

Firestore Database → 「資料」分頁 → 開始集合：

1. 集合 ID `allowlist`，文件 ID 填**你自己的 Gmail**（全小寫），欄位：
   - `name`（字串）＝ `老二`
   - `role`（字串）＝ `admin`
   - `order`（數字）＝ `2`
   - `color`（字串）＝ `#B45F12`
2. 集合 ID `settings`，文件 ID `main`，欄位：
   - `fund`（數字）＝ `3000000`
   - `objectionDays`（數字）＝ `7`
   - `backfillDays`（數字）＝ `7`
   - `startDate`（字串）＝ 起算日，例如 `2026-11-01`
   - `motherName`（字串）＝ `媽媽`
   - `version`（數字）＝ `0`

其他兩位的 Gmail 與點數表，登入網站後在「管理」頁新增即可。

## 第四步：放上網站（二選一）

### A. GitHub Pages（建議，不用安裝任何東西）

1. 到 https://github.com 註冊或登入，按「New repository」，名稱 `mom-care`，Public，建立。
2. 在 claude.ai 的「設定 → 連接器」連接 GitHub，然後告訴我 repo 名稱，我會把程式推上去並開啟 Pages。
   （或自己上傳：repo 頁面 → Add file → Upload files → 把 `public` 資料夾裡的檔案全部拖進去 → Commit。
   然後 Settings → Pages → Branch 選 `main`、資料夾 `/ (root)` → Save。）
3. 幾分鐘後網址會是 `https://<你的帳號>.github.io/mom-care/`。

### B. Firebase Hosting（需要一台能開終端機的電腦）

```
npm install -g firebase-tools
firebase login
firebase deploy
```
網址會是 `https://<專案ID>.web.app`。

## 第五步：授權網域

Firebase → Authentication → 設定 → **已授權的網域** → 新增你的網址網域
（例如 `你的帳號.github.io`）。沒加的話 Google 登入會失敗。

## 第六步：測試

1. 用你的 Gmail 開網站登入 → 應該會看到空的日曆。
2. 右上角你的名字 → 個人設定 → 改顯示名稱與顏色。
3. 管理 → 點數表：把附件一的項目填進去，儲存為第 1 版。
4. 管理 → 家人名單：新增哥哥與弟弟的 Gmail。
5. 新增一筆紀錄、附照片，確認日曆有顯示、統計有算到。

## 之後若要改程式

把需求告訴我，我改好後給你新檔案，再用同樣方式上傳覆蓋即可。資料都在 Firebase，不會因為換程式而消失。

## 備份

每年結算時，統計區的「匯出全部紀錄（CSV）」會下載所有紀錄。
照片存在 Firestore 的 `photos` 集合，可在主控台「匯入／匯出」整批備份（需要 Blaze 方案），或請我寫一支匯出工具。
