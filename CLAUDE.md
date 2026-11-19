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

## SSの成績進捗メール自動取込
- `gas/seiseki_import.gs` は仕事用Googleアカウントの Apps Script に貼り付けて使う（このリポジトリでは動かない）。
