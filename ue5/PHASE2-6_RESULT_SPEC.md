# PHASE 2 Step 6 — リザルト画面 + RESTART 実装仕様

> **このファイルの立ち位置**
> クラウド側セッション（UE5 に触れない方）が書いた**設計書**です。
> **PC 側の Claude Code（UE5 MCP 接続あり）がこれを読んで実装します。**
> 前セッションが `BPL_RaceUtil` 作成中に止まったため、そこから先を再設計して書き下ろしました。
>
> 読む順番: `GAME_DEV_LOG.md` → `PROGRESS.md` の先頭 → **このファイル** → 実装

---

## 0. 今どこにいるか

| | 状態 |
|---|---|
| PHASE2-1 ラップ計測 | ✅ 完了（QA 86） |
| PHASE2-2 レースHUD | ✅ 完了（QA 91） |
| PHASE2-5 カウントダウン | ✅ 完了（QA 87） |
| PHASE2-7 時間表記 `m:ss.mmm` / タイマー停止 | ✅ 完了（QA 92） |
| PHASE2-6a リザルト用データ（GameMode 側） | ✅ コミット済み（**要確認**: 下の §2） |
| **PHASE2-6b リザルト画面 + RESTART** | ⬜ **これから。本仕様の対象** |

ゴールの定義（これが全部できたら Step 6 完了）:

1. 3周ゴールした瞬間に **「FINISH」とリザルト画面**が出る
2. リザルトに**全ラップのタイム / TOTAL / BEST** が `m:ss.mmm` で並ぶ
3. **RESTART ボタン**でカウントダウンからやり直せる（前回のタイムが残らない）
4. HUD の `/ 3` が `TotalLaps` 連動になる（既知バグ #13）
5. ゴール時に何も出ない問題が解消する（既知バグ #14）

---

## 1. 復旧手順（最初にここ）

### 人間がやること

1. UE5 の画面に**ダイアログ（小さいウィンドウ）が出ていたら閉じる / OK を押す**
2. 戻らなければ UE5 を再起動 → 出力ログ下の `Cmd` 欄で `ModelContextProtocol.StartServer`

> **どのみち再起動は1回必要です**（§3-A の理由）。迷ったら再起動してください。

### Claude（PC 側）が最初に打つ MCP コール

```
1) list_toolsets                     … MCP が生きているかの確認
2) /Game/SpeedTest/Race/BPL_RaceUtil が存在するか確認
   → 中途半端に出来ていたら削除する（本仕様では BPL は作らない。§3-A）
3) /Game/SpeedTest/ 配下のアセット一覧を取得（どこまで出来ているかの答え合わせ）
4) cd C:\UE\SpeedTest && git log --oneline -5 && git status
```

---

## 2. 着手前の現状確認（飛ばさない）

`BP_VehicleAdvGameMode` の**変数を全部ダンプ**して、下の想定と突き合わせてください。
本仕様は「PHASE2-6a でリザルト用データが入っている」前提で書いていますが、**変数名は実物が正です。**

| 想定している変数 | 型 | 用途 | 無かったら |
|---|---|---|---|
| `RaceState` | int | 0=カウントダウン / 1=走行 / 2=ゴール | 必ずある（PHASE2-1） |
| `CurrentLap` | int | 現在の周回 | 必ずある |
| `TotalLaps` | int | 総周回数（=3） | 必ずある |
| `LapStartTime` | float | 現ラップの開始時刻 | 必ずある |
| `BestTime` | float | ベストラップ秒 | 必ずある |
| `LastTime` | float | 直前ラップ秒 | 必ずある |
| **`LapTimes`** | **float 配列** | **全ラップのタイム** | **§2-1 で追加**（再起動が要る） |
| **`TotalTime`** | **float** | **ゴールまでの合計秒** | **§2-1 で追加**（再起動が要る） |

### 2-1. `LapTimes` / `TotalTime` が無かった場合（追加手順）

1. `BP_VehicleAdvGameMode` に `LapTimes`(float 配列) と `TotalTime`(float) を追加
2. `NotifyGatePassed` のラップ確定処理（`LastTime` を書いている所）の直後に、**Sequence を挿して非破壊で**
   `Add (LapTimes, 確定したラップ秒)` を足す
   - ⚠️ **`LastTime` を Get して Add しないこと。** pure ノード再評価の罠（既知の技術判断）に当たります。
     ラップ秒を計算している元のピンから**直接**分岐させてください
3. ゴール判定（`RaceState` に 2 を入れる所）の直後に `TotalTime = 今の時刻 - レース開始時刻` を入れる
   - レース開始時刻は GO の瞬間に `LapStartTime` へ入っている値がラップ1の開始 = レース開始なので、
     **GO のタイミングで `RaceStartTime`(float) も別に持たせる**のが素直です（変数をもう1つ追加）
   - それが面倒なら `TotalTime = LapTimes の全要素の合計`（配列 → `Add` の畳み込み、または `Array Sum` 相当）で代用可。
     **合計方式を採るなら、リザルトの TOTAL とラップ合計が必ず一致するので検証は楽になります**（推奨）
4. `AssetTools.save_assets([])` → `git commit` → **UE5 を再起動**
   - 理由: 同一セッションで追加した変数は他 BP（= ウィジェット）のアクションDBに出てこない（既知バグ #12）

---

## 3. 実装方針の決定事項（なぜこうするか）

### A. `BPL_RaceUtil`（Blueprint 関数ライブラリ）は**今は作らない**

前セッションが止まったのがまさにこの新規作成でした。そして作っても、
**同一セッションで作った関数は他 BP のアクションDBに出てこない**ため、結局もう一度再起動が要ります。

→ **`FormatTime` は `WBP_RaceResult` の中に複製します**（§4 S2）。
`自BPの関数は同一セッション中でも呼び出しノードを作れる`（既知の技術判断）ので、これが最短で確実です。

> 共通化（BPL への切り出し）は**PHASE 4 のリファクタでまとめてやる**。
> 今は「同じ関数が HUD とリザルトに2つある」状態を**意図的に許容**します。
> ただし **2つの実装を1ノードでも食い違わせないこと**（表示が食い違うと原因調査が高くつきます）。

### B. ラップ行は **3行固定**で置く（動的生成しない）

`TotalLaps` は 3。VerticalBox に実行時に子を足す実装は MCP のノードAPIでは高コストで、
検証も難しくなります。**3行を先に置いて、Construct で値を流し込む**方式にします。

> 制限として記録: `TotalLaps` を 4 以上にすると 4周目以降がリザルトに出ません。
> 周回数を可変にするのは PHASE 3 以降。

### C. RESTART は **`OpenLevel` でレベルごと作り直す**

変数を1つずつ初期値に戻す方式は、戻し忘れが必ず出ます（`LapTimes` の残留、
ゲートの `NextGateIndex`、車の位置・速度・サスペンションの沈み、HUD の残存…）。

→ `Get Current Level Name (bRemovePrefixString = true)` → `Open Level (by Name)`。
GameMode の BeginPlay からやり直るので**カウントダウンも含めて完全に初期状態**に戻ります。

> 面内リスタート（レベルを再読込せずに戻す）は速いですが、上の戻し忘れリスクを
> 全部自前で潰す必要があるので **PHASE 3 以降**に回します。

### D. 「FINISH」はリザルト画面の中に置く（HUD には足さない）

既知バグ #14（ゴールしても画面に何も出ない）は、リザルト画面の `FinishText` で解決します。
HUD 側にも FINISH を足すと**二重管理**になるので足しません。

---

## 4. 実装ステップ（1ステップ = 1コミット）

### S1. `WBP_RaceResult` の見た目を作る

パス: `/Game/SpeedTest/UI/WBP_RaceResult`

```
CanvasPanel (root)
├─ DimBG           Image      アンカー(0,0)-(1,1) / Offset 全部0 / Color (0,0,0, A=0.55)
└─ Root_VB         VerticalBox アンカー中央(0.5,0.5) / Alignment(0.5,0.5) / Size 760x600
   ├─ FinishText   TextBlock  "FINISH"  96px Bold / 白 / Outline 4(黒) / Shadow(3,3) A=0.7 / 中央揃え
   ├─ HeaderRow    HorizontalBox
   │  ├─ (静的)    TextBlock  "LAP"   24px / (0.70,0.72,0.78)
   │  └─ (静的)    TextBlock  "TIME"  24px / (0.70,0.72,0.78) / 右寄せ
   ├─ Lap1Row      HorizontalBox
   │  ├─ (静的)    TextBlock  "1"     32px / 幅120 左寄せ
   │  └─ LapTimeText1  TextBlock "--:--.---" 40px Bold / 右寄せ / Outline 2
   ├─ Lap2Row … LapTimeText2   （同上）
   ├─ Lap3Row … LapTimeText3   （同上）
   ├─ Sep          Image      高さ2 / Color (1,1,1,0.25) / 上下 padding 12
   ├─ TotalRow     HorizontalBox  "TOTAL" + TotalTimeText  44px Bold / 白
   ├─ BestRow      HorizontalBox  "BEST"  + BestTimeText   44px Bold / **(0.65,0.45,1.0) 紫**
   │                              ※紫は WBP_RaceHUD の BEST と**同じ色にそろえる**（実物の値を読んで合わせる）
   ├─ RestartButton Button    幅320 高さ72 / 上 padding 28
   │  └─ (静的)    TextBlock  "RESTART" 32px Bold
   │     Style: Normal (0.12,0.13,0.16, A=0.95) / Hovered (0.85,0.15,0.05) / Pressed (0.60,0.10,0.03)
   └─ HintText     TextBlock  "クリックでもう一度" 20px / (0.7,0.72,0.78)
```

- 文字の可読性は **Day6 と同じ処方**（Bold + Outline + Drop Shadow）。背景が明るくても沈みません
- **値を入れる TextBlock は `IsVariable = true`**（`LapTimeText1..3` / `TotalTimeText` / `BestTimeText`）
  - 既知の罠: `ToggleWidgetAsVariable` だけでは型IDが更新されないことがある。**変数名で紐づく**ので、
    うまく繋がらないときは**同じ名前で作り直す**
- ここまでで一度 `save_assets([])` → コミット（メッセージ例: `PHASE2-6b: WBP_RaceResult レイアウト`）

### S2. `FormatTime` を `WBP_RaceResult` に複製

1. `WBP_RaceHUD` の `FormatTime` を `find_nodes` + `get_node_infos` で**ノード構成ごと読み取る**
2. 同じシグネチャで新規作成: `FormatTime(Seconds: float) -> Out: Text`
3. **読み取った構成と同じ形**に組む（テキスト連結ノードが無いので、既存と同じ
   `ToText(Integer)` のゼロ埋め → `ToString(Text)` → `Append` → `ToText(String)` の順）

> ⚠️ **既存実装を「改良」しないこと。** ここで丸めや桁数を変えると HUD と表示が食い違います。
> 改善点に気づいたら**このファイルの §8 にメモだけ残して、HUD 側と同時に直す**。

### S3. リザルトに値を流し込む（`Event Construct`）

```
Event Construct
 → Get Game Mode → Cast To BP_VehicleAdvGameMode   （失敗ピンは Print String で握りつぶさない）
 → Sequence
    then_0: LapTimes を取得
            ├ Length >= 1 → Get(0) → FormatTime → SetText(LapTimeText1)
            ├ Length >= 2 → Get(1) → FormatTime → SetText(LapTimeText2)
            └ Length >= 3 → Get(2) → FormatTime → SetText(LapTimeText3)
    then_1: TotalTime → FormatTime → SetText(TotalTimeText)
    then_2: BestTime  → FormatTime → SetText(BestTimeText)
    then_3: ベストの行だけ色を変える（下記）
```

- 変数取得ノードは日本語UIの流儀で: **`クラス|BPVehicleAdvGameMode|LapTimesを取得`**
  （`変数|デフォルト|…` や `|GetLapTimes` では作れない — 既知の技術判断）
- **配列 Get は必ず Length で守る**。範囲外アクセスは Blueprint ランタイムエラーになります
- **ベスト行のハイライト**: `LapTimes[i]` と `BestTime` の比較は
  **`Nearly Equal (Float)` / tolerance 0.0005** を使う。`==` は浮動小数で落ちます
  → 一致した行の `LapTimeTextN` に `SetColorAndOpacity` で紫
- **pure ノード再評価の罠**: 同じ `Get(0)` を複数の入力に使い回さず、**必要な数だけノードを置く**

コミット: `PHASE2-6b: リザルトにラップ/TOTAL/BEST を表示`

### S4. ゴール時に出す（GameMode 側・非破壊）

`BP_VehicleAdvGameMode` のゴール判定（`RaceState` に 2 を入れている所）の**直後に Sequence を挿す**。
**既存のチェーンは1本も消さない**（Day6 / PHASE2-5 と同じ非破壊パターン）。

```
… SetRaceState(2) → [新規 Sequence] ─ then_0 ─→ 既存の続き（そのまま）
                                     └ then_1 ─→ Delay 1.5
                                                → Create Widget (WBP_RaceResult,
                                                     Owning Player = Get Player Controller(0))
                                                → Add to Viewport (ZOrder 10)
                                                → Set Input Mode UI Only
                                                     (PlayerController, InWidgetToFocus = 作ったウィジェット)
                                                → Set Show Mouse Cursor = true
                                                → Disable Input (プレイヤーPawn)
```

- `Delay 1.5` はゴール直後の余韻。**0 にすると「ゴールした感」が消えます**
- `Disable Input` の経路は **PHASE2-5 のカウントダウンで使ったのと同じもの**を使い回す
- 作ったウィジェットの参照は `RestartButton` の処理で使うので、**GameMode に `ResultWidget` 変数**を1つ持つ
  （同一セッションで追加した変数は他BPから見えないが、**GameMode 自身からは使える**ので問題なし）

コミット: `PHASE2-6b: ゴール時にリザルト画面を表示`

### S5. RESTART ボタン

`WBP_RaceResult` の `RestartButton` の `OnClicked`:

```
OnClicked
 → Remove from Parent
 → Get Player Controller(0) → Set Input Mode Game Only
 → Set Show Mouse Cursor = false
 → Get Current Level Name (bRemovePrefixString = true)
 → Open Level (by Name)
```

- `bRemovePrefixString = true` が肝。PIE では `UEDPIE_0_Lvl_VehicleBasic` という名前になるので、
  **外さないと開けません**
- `Open Level` の後に処理を繋がない（レベルが破棄されます）

コミット: `PHASE2-6b: RESTART`

### S6. HUD の `/ 3` を `TotalLaps` 連動に（既知バグ #13）

- `WBP_RaceHUD` の静的テキスト `/ 3` を `TotalLapsText` に変えて `IsVariable = true`
- 既存の更新経路（Tick）で `TotalLaps` → `ToText(Integer)` → `"/ "` と `Append` → `SetText`
  （S2 と同じ連結手順）

コミット: `PHASE2-6b: HUD の総ラップ数を TotalLaps 連動に`

---

## 5. PIE 検証チェックリスト（全部やる）

車は運転できないので、**既存の「車をゲートへテレポートさせる」手法**で3周させます。

| # | 確認すること | 期待する結果 |
|---|---|---|
| 1 | 3周ゴール | 1.5秒後にリザルトが出る |
| 2 | ラップ一覧 | 3行とも `m:ss.mmm`。3行目が HUD の `LAST` と一致 |
| 3 | TOTAL | 3行の合計と一致（合計方式なら完全一致） |
| 4 | BEST | 最小のラップと一致し、**その行だけ紫** |
| 5 | マウスカーソル | リザルト表示中だけ出る |
| 6 | **RESTART** | **カウントダウンからやり直り、`LapTimes` が空に戻る（前回の値が残らない）** ★最重要 |
| 7 | リスタート後にもう一度ゴール | リザルトが二重に出ない / 値が前回と混ざらない |
| 8 | ゴール後に車を動かす | 入力が効かない |
| 9 | `LogBlueprint` | Error / Warning **0件** |
| 10 | 既存HUD（速度計 `N`/`000`、LAP/LAST/BEST） | 壊れていない |
| 11 | スクショ | `review/phase2_result.png` を `SpeedTest/review/` と `guide/ue5/review/` の両方に |

> **#6 と #7 は前セッションで一度も検証していない領域**です（既知バグ #10 の
> 「リスタート・2周目以降の再検証」）。`OpenLevel` なら GameMode ごと作り直るので
> 理屈の上では初期化されますが、**必ず目で確認**してください。

---

## 6. QA（目標 95点）

配点は既存と同じ 7 項目: 機能25 / バグ20 / UX15 / 絵15 / perf10 / 構造10 / 拡張性5。

**取りこぼしやすい所**:

| 観点 | 落とし穴 |
|---|---|
| 機能 | TOTAL がラップ合計と合わない / ベスト行のハイライトが出ない |
| バグ | 配列の範囲外アクセス / リスタート後の値の混ざり |
| UX | リザルトが一瞬で出て「ゴールした感」が無い / RESTART が押しにくい（当たり判定が小さい） |
| 絵 | 背景の暗幕が濃すぎてコースが見えない（0.55 前後が目安） / HUD とフォント・色がちぐはぐ |
| 構造 | `FormatTime` が2箇所にある（**意図的。§3-A**。ログに明記すれば減点は最小限） |
| 拡張性 | ラップ行3固定（**制限として明記する**） |

---

## 7. 罠リスト（着手前に毎回読む）

1. **`AssetTools.save_assets([])` を呼ぶまでディスクに書かれない** → 1タスクごとに save → `git add`
2. **同一セッションで追加した変数/関数は他BPのアクションDBに出ない** → UE 再起動が要る
3. **pure ノードは使用時に再評価される** → 書き込みの後に同じ変数を読んで比較しない
4. **`write_graph_dsl` は使わない**（このビルドでは実質未実装。グラフ全消失の危険）
5. **`StartPIE` は必ずエラーを返すが実際は起動している** → **単独コール**にして続きは次のコールで
6. **日本語UIの変数取得ノード**: `クラス|BPVehicleAdvGameMode|RaceStateを取得` / 自BPは `変数|<自BP名>|<変数名>を取得`
7. **新規アセット作成でモーダルが出て固まることがある**（← 前回の停止原因）
   → **アセットを1つ作ったら、次の操作の前にスクショで画面を確認する**
8. **MCP が2回続けて失敗したら UE が落ちた可能性** → リトライせず `PROGRESS.md` に `■要対応` を書いて push して停止
9. `Content/` の `.uasset` / `.umap` は読まない

---

## 8. この先のメモ置き場（気づいたら書く）

- `FormatTime` の改善案（HUD 側と**同時に**直すこと）:
  - 60分超・負値の扱いが未検証（既知の残課題）
  - ミリ秒が 1000 に丸まる境界（`0:12.1000` になっていないか要確認）
- BPL への共通化は PHASE 4 のリファクタでまとめて

---

## 9. Step 6 が終わったら

1. `GAME_DEV_LOG.md` の「完成済み機能 / 開発中の機能 / 既知のバグ（#13 #14 を消す）/ QA 評価履歴」を更新
2. `PROGRESS.md` に作業ログを追記
3. 次は **PHASE 2 Step 8（セクタータイムとデルタ表示）**
   - `Scripts/track_centerline.txt`（原点中心・半径4500cm の真円・16セグメント）から
     セクター境界を作れる。ゲートを増やす形が素直
4. その後 **PHASE 3（AI車）**
