# レイティング比較グラフ（GitHub Pages版）

## ファイル構成

- `index.html`：画面
- `style.css`：スマホ対応のデザイン
- `app.js`：CSV読み込み・集計・グラフ・表の処理
- `data/rating_data_all.csv`：元データ

## GitHub Pagesで公開する手順

1. GitHubで新しいPublic Repositoryを作成。
2. このフォルダの中身をRepositoryのルートにアップロード。
3. `Settings` → `Pages` を開く。
4. `Build and deployment` の `Source` を `Deploy from a branch` にする。
5. Branchを `main`、Folderを `/ (root)` にしてSave。
6. 数分待つと `https://ユーザー名.github.io/リポジトリ名/` で公開される。

## 注意

グラフにはChart.jsをjsDelivr CDNから読み込んでいます。
インターネット接続がある環境で利用してください。

CSVはブラウザ上で読み込んで処理します。サーバー側で会員番号を検索する構成ではありません。
