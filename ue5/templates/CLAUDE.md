# SpeedTest — UE5 車ゲーム プロジェクト

> このファイルを `C:\UE\SpeedTest\CLAUDE.md` として保存してください。
> Claude Code が自動で読み込み、毎回この前提を説明する必要がなくなります。

## プロジェクト概要

- **目標**: 美しい風景の中を、気持ちよく走れる車が1台ある状態（1週間スプリント）
- **ベース**: UE5 Vehicle テンプレート（Blueprint、C++なし）
- **エンジン**: Unreal Engine 5.8
- **プロジェクトパス**: `C:\UE\SpeedTest`

## 作業環境

| 項目 | 内容 |
|---|---|
| OS | Windows（ターミナルは Git Bash） |
| GPU | RTX 3080 |
| 目標解像度 | 1440p |
| 描画 | Lumen + Nanite + Virtual Shadow Maps + DLSS |
| 目標fps | 30fps 以上（60fps必須ではない。今週は絵の品質を優先） |

## ユーザーについて（重要）

- **プログラミング経験なし。UE5も超初心者。**
- 専門用語は使ってよいが、**初出時は一言で意味を添える**こと
- 「Blueprintのノードを繋ぐ」ような手作業の指示は避け、**MCP経由で自分で実行する**か
  **Pythonスクリプトを渡して実行してもらう**こと
- 手順を渡すときは「どのメニューのどこをクリックするか」まで具体的に
- **エラーが出たら、原因の推測ではなく確認方法から**提示する

## 絶対に守るルール

1. **`Content/` 配下の `.uasset` `.umap` を読もうとしない。**
   バイナリで内容は読めず、トークンだけ大量に消費する。中身を知りたいときはMCPツールを使う
2. **`Saved/` `Intermediate/` `DerivedDataCache/` は読まない・コミットしない**
3. **同じ作業を2回以上やるなら Python スクリプト化する**（MCP往復はトークンを消費するが、スクリプトの再実行は無料）
4. **1つの変更を入れたら、必ず「何を確認すれば成功か」を伝える**
5. スクリーンショットは `review/` に `dayN_before.png` / `dayN_after.png` の形式で保存

## 触ってよい / いけないもの

| | 対象 |
|---|---|
| ✅ 自由に編集 | `Config/*.ini`、`Scripts/*.py`、`CLAUDE.md`、`.gitignore` |
| ⚠️ MCP経由でのみ | Blueprint、マテリアル、レベル、アクター配置 |
| ❌ 触らない | `Saved/`、`Intermediate/`、`DerivedDataCache/`、`Binaries/` |

## 用語の共通認識

- 「露出」= Post Process Volume の Exposure（Min/Max Brightness で固定する方針）
- 「光の4点セット」= Directional Light + Sky Atmosphere + Sky Light + Exponential Height Fog
- 「質感」= Material Instance の Base Color / Metallic / Roughness
- 「追従カメラ」= Spring Arm + Camera、遅れは Camera Lag
- マテリアル調整は**必ず Material Instance 側**で行う（原型のMaterialは触らない）

## 今週の日割り

| Day | テーマ |
|---|---|
| 1 | 環境構築・MCP接続・車が走る |
| 2 | **光**（ライティング + ポストプロセス）★最重要 |
| 3 | 舞台（Fabアセット + 道） |
| 4 | 車の見た目（マテリアル） |
| 5 | 挙動（Chaos Vehicle の数値調整） |
| 6 | 演出（カメラ、HUD、音、DLSS） |
| 7 | 書き出し（MRQ + パッケージ化） |

**その日のテーマ以外の作業を提案しないこと。** スコープが広がると1週間で終わらない。

## スコープ外（今週はやらない）

街づくり / 複数車種 / ミッション・ゲームループ / マルチプレイヤー /
本格的な最適化 / カスタム3Dモデリング（Blenderは今週使わない）

これらを頼まれたら、**「来週以降のリストに入れましょう」と提案して今週のタスクに戻す**こと。
