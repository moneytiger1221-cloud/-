# 塾ツール 開発メモ

## 保存先は JUKU_LS（IndexedDB）を使う
- 各ツールのデータは `localStorage` ではなく **`JUKU_LS`** に保存する。使い方は localStorage と同じ
  （`JUKU_LS.getItem / setItem / removeItem / key / length`）。
- スマホ(Safari)の localStorage は全ツール合わせて約5MBしかなく、満杯になったため IndexedDB に移した。
  起動時に localStorage に残っているものは IndexedDB へ移されて消えるので、
  **localStorage を直接読むコードを書くと、データが空に見える。**
- ツール本体のスクリプトは `<script type="text/juku-deferred">`。JUKU_LS が読み込みを終えてから動く。
- HTMLを書き換えたり作り直したりしたら（YSボードのビルドなども）、最後に必ず
  `python3 tools/apply-juku-ls.py` を実行する。共通部分の埋め込みと置き換えをやり直す（何度実行してもよい）。
- 共通部分の中身を直すときは `tools/juku-ls.js` を直してから上のスクリプトを実行する。HTML内の埋め込みは直接直さない。

## スプシ同期は JUKU_LS が全ツールまとめてやる
- JUKU_LS に保存したものは、自動でスプシと同期する（`tools/juku-ls.js` の「スプシ同期」）。
  ツールごとのまとまり（kv_koma / kv_grade / kv_survey / kv_ys / kv_shinro / kv_ss / kv_common）で置き、
  変えたらすぐ送り、開いたとき・画面に戻ったとき・5分おきに読む。
- 読むときは「最後にスプシで見た値・この端末の値・スプシの値」を比べて混ぜる（3方向マージ）。
  id を持つ並びは1件ずつ混ぜ、消したものは消えたまま。なので**並びの要素には必ず id を付ける**。
- 接続先・端末名・同期の記録など端末ごとの項目は送らない（名前に sync を含むキーと、SKIP の一覧）。
  端末ごとにしたい項目を増やすときは SKIP に足す。
- これが動いているあいだ、各ツールの古い同期（JUKU_SYNC の自動保存・自動読込）は止まる。
  新しく同期を作らないこと。JUKU_LS に保存すれば同期される。
- スプシから変更が来ると、その項目を読んでいたページは読み直される。
- 接続先URL・合言葉の入力と、全ツールまとめてのバックアップ／復元は、統合版（index.html）の「取込」タブだけにある。
  各ツールに接続先の入力欄やバックアップのボタンを作らないこと。
- ファイルの取り込みも統合版の「取込」タブに一本化した（各ツールは window.JUKU_IMPORT の窓口だけ持つ）。

## SSの成績進捗メール自動取込
- `gas/seiseki_import.gs` は仕事用Googleアカウントの Apps Script に貼り付けて使う（このリポジトリでは動かない）。
