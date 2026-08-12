# 羽曳野 レイティング・大会データ 統合版

## 構成
- `/` トップ
- `/rating/` レイティング比較
- `/winners/` 入賞者検索
- `/match-rating/` 勝敗・レイティング計算
- 旧Streamlit版はトップの `config.js` にURLを設定

## GitHub Pages
1. このフォルダの中身をRepositoryへアップロード。
2. Settings → Pages → Deploy from a branch → main / root。
3. 数分後に公開。

## 必要なCSV
`data/rating_data_all.csv` は同梱済みです。
`data/winner_list.csv` は元のStreamlit版で使用しているものを追加してください。元アプリではこのCSVに「日付」「名前」「チーム名」「クラス」「部」「位」の列を使用しています。

## 旧Streamlit URL
`config.js` の `LEGACY_STREAMLIT_URL` に②のStreamlitアプリURLを入れてください。
