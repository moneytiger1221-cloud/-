# GAME_DEV_LOG — SpeedTest（リアル志向レーシングゲーム）

> **新しいセッションはこのファイルを最初に読む。** そのあと UE の現状を MCP で確認し、
> 「次のタスク」の最上段から着手する。

最終目標: リアルなグラフィックでスポーツカーを運転し、サーキットを周回して競争するゲーム。
Gran Turismo 7 のようなリアル志向のコンソール級レーシングゲーム（**オンライン通信対戦は対象外**）。
既存ゲームの固有アセットには依存しない。

---

## 現在の Phase

**PHASE 2（レーシングゲームとして成立させる）進行中。**
ラップ計測の中核は完成・PIE検証済み。次は HUD（画面表示）。

PHASE 0（調査）完了 / PHASE 1（基盤）は Day1〜7 の作業で実質完成済み。

---

## プロジェクトの基本情報（PHASE 0 調査結果）

| 項目 | 内容 |
|---|---|
| Unreal Engine | **5.8.2** (`++UE5+Release-5.8-CL-56702186`) |
| プロジェクト | `C:\UE\SpeedTest` / Vehicle Advanced テンプレート由来 |
| **C++ モジュール** | **無し**（`Source/` 無し、`.uproject` に Modules 無し）→ **Blueprint 専用プロジェクト** |
| レベル | `/Game/VehicleTemplate/Maps/Lvl_VehicleBasic`（唯一。World Partition + 外部アクタ） |
| 描画 | DX12/SM6 + Lumen GI/反射 + Virtual Shadow Maps + Nanite + Substrate + MegaLights |
| AA / 解像度 | `r.AntiAliasingMethod=4` (TSR) / `r.ScreenPercentage=75`（実測確認済み） |
| 車両 | 2台。`BP_VehicleAdvSportsCar`(RWD/drag 0.31) / `BP_VehicleAdvOffroadCar`(AWD/drag 0.10)。親は共通 `BP_VehicleAdvPawnBase`。エンジン仕様は同一 |
| コース | Landscape 126m角 + `LandscapeSplineActor` の16セグメントのスプライン道路 + トンネル + コーン19本 + 外周壁4枚 |
| サウンド | **`/Game` に0件、`/Engine` に車のエンジン音も無い。** UI音は `/Engine/VREditor/Sounds/*` 34件が流用可（**エディタ専用＝パッケージ化時は差し替え必須**） |
| 植生・岩・建物 | **0件**（Megascans / StarterContent 未インストール） |

---

## 完成済み機能

| 機能 | 実装場所 | 備考 |
|---|---|---|
| 車両走行（アクセル/ブレーキ/ステア/ハンドブレーキ/リセット） | テンプレート | PHASE 1 |
| チェイスカメラ + ボンネットカメラの切替 | `BP_VehicleAdvPawnBase` / `IA_ToggleCamera` | 切替はテンプレート実装。ボンネット位置は Day6 で調整 |
| カメララグ（重さ） | `BP_VehicleAdvPawnBase` の **BeginPlay で明示設定** | SCS 値がインスタンスに効かない罠を回避（下の「技術的な判断」参照） |
| 速度連動FOV | `BP_VehicleAdvPawnBase` EventGraph（Tick に Sequence を挿入） | 0〜5000cm/s → FOV 90〜105。PIE で実測検証済み |
| 露出固定・太陽角・フォグ・カラーグレーディング | `PostProcessVolume` / `DirectionalLight` / `ExponentialHeightFog` | Day2 |
| 車マテリアル（カーペイント/ホイール/タイヤ/ガラス） | `/Game/Vehicles/SportsCar/Materials/SpeedTest/` の MI 4本 | 原型 Material は未変更 |
| 環境マテリアル（路面/道路/外周壁） | `/Game/VehicleTemplate/Materials/SpeedTest/` の MI 2本 | Day3 |
| 速度計・ギアHUD（可読性改善込み） | `/Game/VehicleTemplate/UI/UI_Vehicle` | アウトライン+シャドウ |
| モーションブラー / TSR / ScreenPercentage 75 | `PostProcessVolume` / `Config/DefaultEngine.ini` | |
| **ラップ計測（周回検出/ラップタイム/ベストラップ/ゴール判定/逆走対策）** | `BP_VehicleAdvGameMode` + `BP_RaceGate` x4 | **PIE検証済み** |
| **レースHUD（LAP / 現在タイム / LAST / BEST）** | `/Game/SpeedTest/UI/WBP_RaceHUD` + PlayerController に非破壊追加 | **PIE で画面表示を確認**（`review/phase2_hud.png`） |
| コース中心線データ | `Scripts/track_centerline.txt` | 原点中心・半径4500cm の真円・周長283m。AI走行ライン/ミニマップで再利用 |
| 高解像度撮影 2560x1440 | `SlateInspectorToolset` 経由の `HighResShot` | **PIE中のみ / 3コールに分割が必須** |
| MRQ 準備（`LS_Hero` + `HeroCam` 35mm/f4） | `/Game/Cinematics/LS_Hero` | レンダリング実行は手作業 |

---

## 開発中の機能

**PHASE 2: レース成立**
- ✅ ラップ計測の中核（ゲート・ラップタイム・ベストラップ・ゴール判定・逆走対策）
- ✅ レースHUD（LAP / 現在タイム / LAST / BEST）**PIE で画面表示を確認済み**
- ⬜ カウントダウン（3-2-1-GO）と入力ロック ← 次
- ⬜ リザルト画面 + RESTART
- ⬜ カウントダウン（3-2-1-GO）と入力ロック
- ⬜ セクタータイムとデルタ表示

---

## 未実装機能

RaceTimer / **Countdown** / **Position** / RaceRestart /
**AI車** / RacingLine / MiniMap / RPM表示 / リザルト画面 / **Title・Menu・車選択・ガレージ** /
コース選択 / 複数コース / 天候・時刻 / **エンジン音・SE** / **リプレイ** / 車両性能差 / 風景アセット

---

## 既知のバグ・問題

| # | 内容 | 重大度 | 状態 |
|---|---|---|---|
| 1 | ゲームループが無い | 最大 | **ラップ計測は完成**。残: HUD / リザルト / カウントダウン / 順位 |
| 2 | 完全に無音。エンジン音の素材が存在しない | 高 | 後回し（素材が必要） |
| 3 | 風景アセット0。路面の市松模様は `M_Landscape` のグラフに焼き込まれていて消せない | 高 | **人間の作業**（Fab） |
| 4 | **FPS 未計測** | 中 | `stat unit` は出力ログのCmd欄から実行してもPIEビューポートに描画されなかった。PHASE 4 で `csvprofile`（CSV出力）で計測する |
| 5 | 継承コンポーネントの上書きで親BPのSCS値がインスタンスに効かない | 中 | 回避済み（BeginPlayで明示設定）。**今後も要警戒** |
| 6 | `/Engine` の音はエディタ専用でパッケージに入らない | 中 | 使用時に明記する |
| 7 | `SM_Track_10M` の Nanite が無効 | 低 | 未対応 |
| 8 | 孤児ファイル `Content/__ExternalActors__/.../2/7T/JEARZZ5JVCB09HQJJ8LN5Z.uasset` | 低 | UE 未認識・未コミット。削除して問題なし |
| 9 | MRQ を MCP から操作できない | 低 | `HighResShot` で代替可 |

---

## 技術的な判断とその理由

| 判断 | 理由 |
|---|---|
| **既存 Blueprint グラフには Sequence を挿す非破壊パターンのみ使う** | `read_graph_dsl` が既存グラフに空文字を返すため、`write_graph_dsl` での上書きはグラフ全消失の危険がある。Day6 で Tick と BeginPlay の2箇所で成功している |
| **`write_graph_dsl` は使えない（検証済み・結論）** | event ヘッダを英語の `AddEvent|EventBeginPlay` に固定変換するため日本語UIではイベントを作れず、`fn` 形式も本体ノードが生成されない（入口1個だけ）。`read_graph_dsl` も空を返す。このビルドでは DSL 機能が実質未実装。**以降もノードAPIで実装する** |
| **pure ノードは使用時に再評価される** | `SetCurrentLap` の後に `Get CurrentLap` が再評価され、更新後の値で比較されるバグを踏んだ。**書き込みの後に同じ変数を読む比較を置かない**。順序に依存する値は比較対象を明示的に選ぶ |
| **エンジンにテキスト連結ノードが無い** | HUD はラベルと数値を別ウィジェットに分ける設計にした（"LAP" と "/ 3" は静的）。結果的に GT 風レイアウトにも合う |
| **ウィジェット変数は名前で紐づく** | `ToggleWidgetAsVariable` だけでは変数の型IDが更新されない。既存の変数名でウィジェットを作り直すと正しく紐づいた |
| PIEでの検証は車をテレポートさせて行う | 車を運転する入力を送れないため。`SetActorTransform` 内でオーバーラップが同期発火するので、1コールで1周分のゲート通過を再現できる |
| **変更は必ず PIE のインスタンスで検証する** | Day6 でカメララグが「BPには入っているがインスタンスに効いていない」状態だった。`UEDPIE_0_` ワールドのアクタを MCP で読んで確認する |
| レース進行は `BP_VehicleAdvGameMode` に置く | EventGraph 0ノードの完全な空であり、レースルールの正しい置き場所 |
| レースHUDは `UI_Vehicle` を壊さず別ウィジェットで重ねる | テンプレートの速度計/ギアを維持しつつ拡張できる |
| グラフィック本格化(PHASE 4)を後ろに回す | 風景アセット導入が人間の作業待ちで、待ちながら他を進める方が効率的 |
| サウンドとリプレイを後回し | 素材が無い / 実装量が大きい。①〜④が動いてからの方が費用対効果が高い |
| C++ 化はしない（現時点） | VSビルド環境とモジュール生成が必要な破壊的変更。実行前にユーザー確認が必要 |

---

## QA 評価履歴

| 対象 | 点数 | 残課題 |
|---|---|---|
| Day2 光 | 65 | 風景アセットが無く「美しい風景」に届かない |
| Day3 舞台（既存アセットのみ） | 70 | 市松模様が消せない / 植生0 |
| Day4 車マテリアル | 70 | 内装が無い |
| Day6 演出 | 90 | PIE で6項目すべて動作確認済み |
| Day7 書き出し | 75 | 構図が真後ろのチェイス視点。任意画角は MRQ 待ち |
| **PHASE2-2 レースHUD** | **91** | 残9点: ゴール後も現在タイムが進む / 時間表記が秒のみ(m:ss.mmm でない) / カウントダウン・リザルト未実装 / Tick で毎フレーム Cast |
| **PHASE2-1 ラップ計測** | **86** | 内訳: 機能25/25・バグ18/20・UX**5/15**・絵15/15・perf10/10・構造8/10・拡張性5/5。**残14点の最大はHUDが無く画面に何も出ないこと**。他: 面内リスタート未実装、AI複数車のゲート追跡は未対応 |

---

## 次のタスク

1. **PHASE 2 Step 5**: カウントダウン（3-2-1-GO）+ カウントダウン中の入力ロック
   + `/Engine/VREditor/Sounds/VR_click1_Cue` / `VR_confirm_Cue`
2. **PHASE 2 Step 6**: `WBP_RaceResult`（全ラップ一覧 / ベスト / トータル / RESTART）
3. **PHASE 2 Step 7**: 時間表記を `m:ss.mmm` にする / ゴール後は現在タイムを止める
4. **PHASE 2 Step 8**: セクタータイムとデルタ表示
5. **QA**: サブエージェントでレビュー → 100点法で採点
6. その後 PHASE 3（AI車。`Scripts/track_centerline.txt` を走行ラインに使う）
