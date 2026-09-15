# UE5 × Claude Code ゲーム開発プロジェクト

プログラミング知識ゼロから、UE5.8 + Claude Code で「綺麗なグラフィックのゲーム」を作るための手順書一式。

## まずここを開く

**→ [`docs/00-setup.md`](docs/00-setup.md)**

上から順番にやるだけ。各ステップに「成功したかの確認方法」が付いています。

## 目次

| ファイル | 内容 | いつ読む |
|---|---|---|
| [`docs/00-setup.md`](docs/00-setup.md) | 環境構築。UE5.8導入 → Claude Code接続まで | **最初** |
| [`docs/01-roadmap-7days.md`](docs/01-roadmap-7days.md) | 7日間で「走れる車」を作る日割り計画 | セットアップ完了後 |
| [`docs/02-minimum-knowledge.md`](docs/02-minimum-knowledge.md) | 最低限これだけ知っておく用語集 | 困ったとき随時 |
| [`docs/03-token-rules.md`](docs/03-token-rules.md) | Proプラン($20)を焼き切らない運用ルール | Day1の前に一度 |
| [`docs/04-rubric.md`](docs/04-rubric.md) | 辛口レビューの採点基準（100点満点） | 各Dayの終わり |

## フォルダ構成

```
ue5/
├── docs/        手順書・知識・ルール
├── templates/   UE5プロジェクトにコピーする設定ファイル雛形
├── scripts/     UE5エディタで実行するPythonスクリプト
└── review/      レビュー用スクリーンショット置き場
```

## 大前提（勘違いしやすいので最初に）

**このリポジトリのWebチャット版Claudeは、あなたのPCのUE5には触れません。**
クラウド上のLinux環境で動いているためです。

- **Webチャット** → 設計、調べ物、資料作り、相談
- **PCのClaude Code** → UE5の実作業（エディタ操作、数値調整、スクリプト生成）
- **あなた** → 判断、アセット選び、「気持ちいいか」の評価

この3者の役割分担で進めます。
