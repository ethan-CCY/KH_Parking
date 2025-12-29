# 高雄停車場資料（可直接丟給 Codex 做網頁）

## 檔案
- `kaohsiung_parking_lots_2025-12-25_curated.csv`
- `kaohsiung_parking_lots_2025-12-25_curated.json`

## 欄位說明
- `parking_name`：停車場名稱
- `address`：地址/位置（本資料多為「地號/路口/門牌」描述）
- `vehicle_types`：停車種類（汽車/機車）
- `weekday_fee`、`weekend_fee`：平日/假日收費（若來源未區分，兩欄會相同）
- `google_rating`、`google_review_count`：Google 評分/評論數（本檔先留空，建議用 Google Places API 批次補齊）
- `google_maps_url`：Google 地圖搜尋連結（可直接點開）
- `street_view_thumbnail_url`：街景縮圖（Google Street View Static API 範本，需要填入 `YOUR_API_KEY`）

## 如何補齊 Google 評分/評論（建議）
1. 使用 Google Places API (Text Search 或 Find Place) 用 `parking_name + address` 查到 `place_id`
2. 用 Place Details 取 `rating`、`user_ratings_total`
3. 回寫到 `google_rating`、`google_review_count`

> 注意：Google 評分與評論會隨時間變動；本檔以「官方停車場清冊」為主，Google 欄位留給你在部署前一次性更新即可。

產出時間：2025-12-29（本對話系統日期）
