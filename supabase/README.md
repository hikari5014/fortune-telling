# Supabase（贊助會員與福幣錢包）

一般使用完全不碰雲端。只有贊助者登入會員時，App 才會連到這個專案。

- 專案：`xuanjian`（東京 ap-northeast-1）
- 前端用的是公開的 anon key（寫在 `src/account.js`），本來就會出現在網頁裡。
- 資料表 `wallets`、`ledger` 只開放「讀自己的」；加減福幣一律走 `wallet_*` 函式（security definer），前端改不了餘額。
- `app_config.demo_topup = true` 時，示範儲值可用（每人上限 2000 枚）。接上真金流時改成 `false`，
  並由金流回呼（Edge Function，用 service role）寫入 `kind = 'topup'`、`refundable_until = 付款時間 + 30 天`。

## 需要在 Supabase 後台手動設定的

1. Authentication → URL Configuration
   - Site URL：`https://hikari5014.github.io/fortune-telling/`
   - Redirect URLs：加入同一個網址
2. Authentication → Sign In / Providers → Google：填入 Google Cloud 的 OAuth Client ID 與 Secret
3. Authentication → Emails → Magic Link 範本：加上 `{{ .Token }}`（App 可以直接輸入 6 位數驗證碼）
4. 正式開放前：Authentication → Emails → SMTP 設定自己的寄信服務（內建寄信只寄給專案成員，且每小時有上限）
