# 00 セットアップ — UE5.8 と Claude Code をつなぐ

上から順に。**各ステップの「✅ 確認」が通ってから次へ進むこと。**
途中で止まったら、そのステップ番号と画面の文字をチャットに貼れば診断できます。

---

## なぜ 5.8 なのか（30秒で理解する）

UE **5.8**（2026年6月）から、**Epic公式の「Unreal MCP」プラグインがエンジンに標準同梱**されました。
これは Claude Code がエディタを**直接操作**できるようにする仕組みです。アクター配置、Blueprint、マテリアル、ライティング、パッケージングまで。

**5.7以前には入っていません。**
プログラミング知識ゼロの人にとって「Blueprintのノードを自分で繋がなくていい」この差は決定的です。

⚠️ ただしEpicはこれを **Experimental（実験的）** と明言しています。壊れる可能性があります。
その場合の退避ルートは [STEP 9](#step-9-mcpがつながらないときの退避ルート) に用意してあります。

---

## Phase A — インストール待ち時間にやること

### STEP 1. Epic Launcher のインストールオプション

Epic Games Launcher → Unreal Engine → ライブラリ → 5.8 の横の**歯車アイコン** → オプション

| 項目 | どうする | 理由 |
|---|---|---|
| Android / iOS / Linux / TVOS | ❌ **外す** | 使わない。合計数十GB浮く |
| **Starter Content** | ✅ **残す** | 基本マテリアル・マネキンが入っている |
| **Templates and Feature Packs** | ✅ **必ず残す** | **Vehicleテンプレート（車）がここ。外すと初日が始まらない** |
| Engine Source | ❌ 外してよい | C++を書かないので不要 |

✅ **確認**: インストールサイズが表示される。だいたい 60〜90GB 程度に収まっていればOK。

---

### STEP 2. プロジェクトの保存場所を作る

エクスプローラーで **`C:\UE\`**（Cの空きが少なければ `D:\UE\`）を新規作成。

**絶対に避ける場所:**

| ❌ ダメな場所 | 何が起きるか |
|---|---|
| OneDrive の中 | 同期がプロジェクトファイルを壊す。実例が非常に多い |
| デスクトップ / ドキュメント | 上と同じ（既定でOneDrive同期対象になっている） |
| 日本語を含むパス（`C:\Users\たろう\`） | UEとビルドツールが非ASCIIパスで事故る |
| パスが長い場所 | Windowsの260文字制限にUEが引っかかる |

Windowsのユーザー名が日本語の人は特に要注意。**だから `C:\UE\` という短い英数字パスにします。**

✅ **確認**: `C:\UE\` がエクスプローラーで見える。

---

### STEP 3. Git for Windows を入れる

https://git-scm.com/download/win

ダウンロードして実行。**オプションは全部デフォルトのまま「Next」連打でOK。**

> **なぜ必要か**: Claude CodeのUnrealプラグインは、起動時に `bash` というコマンドを使います。
> これはMac/Linuxには標準で入っていますが、Windowsには入っていません。Git for Windowsに同梱の「Git Bash」がそれを提供します。

インストール後、スタートメニューから **Git Bash** を起動して、以下を貼り付けて Enter：

```bash
git --version
git lfs install
```

> **`git lfs` とは**: UE5のファイル（`.uasset`）は画像や3Dモデルを含む巨大なバイナリです。
> 普通のGitはテキスト向けなので、これらを扱うとリポジトリが数GBに膨れて破綻します。
> Git LFS（Large File Storage）はそれを別管理してくれる仕組み。**UE5でGitを使うなら必須です。**

✅ **確認**: `git version 2.xx.x` と `Git LFS initialized.` が表示される。

---

### STEP 4. 参照画像を集める

`C:\UE\reference\` フォルダを作り、**目標にしたいゲームのスクショを5〜10枚**入れる。
（GT7、GTA5、Forza、MGS5 など。「gran turismo 7 screenshot」で画像検索すれば出ます）

> **なぜこれが重要か**: 後の「辛口レビュー」で採点基準になります。
> これが無いと「なんか綺麗じゃない」という曖昧な評価しか出ません。
> あると「参照画像と比べて空の青が浅い」「路面の反射が弱い」「影が硬すぎる」という**直せる指摘**に変わります。

✅ **確認**: `C:\UE\reference\` に画像が5枚以上ある。

---

### STEP 5. PC側の準備（任意だが効果大）

**a. NVIDIAドライバを最新に**
GeForce Experience か NVIDIAアプリ から更新。RTX 3080 なら Studio Driver 推奨。

**b. Windows Defender の除外設定**
Windowsセキュリティ → ウイルスと脅威の防止 → 設定の管理 → 除外の追加または削除 → フォルダーを追加：
- `C:\UE\`
- `C:\Program Files\Epic Games\`

> **なぜ**: UE5は起動やマテリアル編集のたびに大量のシェーダーをコンパイルし、無数の小ファイルを読み書きします。
> Defenderが1つずつスキャンするので劇的に遅くなります。除外すると体感で分かるレベルで速くなります。

**c. 電源プランを「高パフォーマンス」に**（ノートPCなら特に）

✅ **確認**: 特になし。やっておくと後が快適。

---

## Phase B — インストール完了後

### STEP 6. Vehicleテンプレートでプロジェクトを作る

1. Epic Launcher → Unreal Engine → ライブラリ → **5.8 の「起動」**
2. プロジェクトブラウザが開く → 左の **「ゲーム」** カテゴリ
3. **「Vehicle」**（または Vehicle Advanced）テンプレートを選択
4. 設定:
   - Blueprint（C++ではなく）
   - ターゲットプラットフォーム: Desktop
   - Starter Content: **有効**
   - レイトレーシング: オフでOK（Lumenを使うので不要）
5. 保存場所: **`C:\UE\`**
6. プロジェクト名: **`SpeedTest`**（英数字のみ。日本語・スペース厳禁）
7. 作成

初回起動はシェーダーコンパイルで5〜15分かかります。右下の進行バーが終わるまで待つ。

✅ **確認**: エディタが開いたら **Alt + P**（またはツールバーの ▶ Play）を押す。
**車が出てきて、W/A/S/D で走れたら成功。** ここまでで「動くゲーム」は既に手元にあります。

---

### STEP 7. Unreal MCP プラグインを有効化

エディタのメニュー → **編集(Edit)** → **プラグイン(Plugins)**

検索窓で以下を探して、それぞれ**チェックを入れる**：

| プラグイン名 | 役割 |
|---|---|
| **ModelContextProtocol** | MCPサーバー本体。Claude Codeとの通信口 |
| **AllToolsets** | 実際の操作ツール群（アクター、Blueprint、マテリアル等）。**MCP本体だけでは何もできないので必須** |
| **Python Editor Script Plugin** | Pythonスクリプト実行。退避ルート用に一緒に入れておく |

3つ入れたら **エディタを再起動**（求められます）。

✅ **確認**: 再起動後、プラグイン画面で3つともチェックが付いている。

---

### STEP 8. MCPサーバーを起動して Claude Code をつなぐ

**8-1. エディタ側でサーバーを起動**

エディタ下部の **アウトプットログ(Output Log)** を開く
（見当たらなければ メニュー → ウィンドウ → 出力ログ）。
一番下にコマンド入力欄があるので、そこに以下を入力して Enter：

```
ModelContextProtocol.StartServer
```

既定でポート **8000**、URLパス **`/mcp`** で起動します。
（もし8000が使用中なら `ModelContextProtocol.StartServer 8001` のように番号を指定）

**8-2. 接続設定ファイルを生成**

同じコンソールに続けて：

```
ModelContextProtocol.GenerateClientConfig ClaudeCode
```

> **なぜこれが必要か**: このプラグインは固定の設定ファイル（`.mcp.json`）を同梱していません。
> 実際に起動しているポートとURLから設定を**生成する**のが正規の手順です。
> **ポートを変えたら、このコマンドを再実行すること。**

**8-3. Claude Code 側**

**Git Bash** を開いて、プロジェクトフォルダへ移動：

```bash
cd /c/UE/SpeedTest
claude
```

Claude Code が起動したら、以下を入力：

```
/plugin install unreal-engine-skills-for-claude-code@claude-plugins-official
```

（Epic公式のプラグイン。Anthropicの公式マーケットプレイスに入っているので、追加設定なしで入ります）

✅ **確認（ここが最重要）**:
1. `/plugin` と打つ → Installed タブに `unreal-engine-skills-for-claude-code` が **enabled** と表示される
2. `/mcp` と打つ → `unreal-mcp` が **connected** と表示される

**両方OKなら接続成功。** 試しにこう頼んでみてください：

```
レベルの原点に立方体を1つ置いて
```

UE5のエディタ画面に実際に立方体が出現したら、**あなたはもうClaude Codeでゲームエンジンを操作できています。**

---

### STEP 9. MCPがつながらないときの退避ルート

Experimental なので繋がらないこともあります。慌てず、こちらへ。

**Python経由の手動連携:**

1. STEP 7 で入れた **Python Editor Script Plugin** が有効なことを確認
2. Claude Code に「◯◯するPythonスクリプトを書いて」と頼む
3. 出てきた `.py` ファイルを `C:\UE\SpeedTest\Scripts\` に保存
4. UE5のアウトプットログのコマンド欄で、左のドロップダウンを **Cmd → Python** に切り替え
5. `Scripts/ファイル名.py` と入力して Enter

このリポジトリの [`../scripts/`](../scripts/) にすぐ使えるスクリプトが入っています。

> **実はこちらの方が優れている場面もあります**: MCP経由は1操作ごとにトークンを消費しますが、
> Pythonスクリプトは**一度書けば何度でもタダで再実行できます**。
> 繰り返す作業（ライティング初期設定、スクショ撮影など）はスクリプト化した方が圧倒的に効率的です。

---

### STEP 10. Git でプロジェクトを守る

作業が飛ぶと1週間が消えます。Day1のうちにやっておく。

Git Bash で：

```bash
cd /c/UE/SpeedTest
git init
```

このリポジトリの [`../templates/UE5_gitignore.txt`](../templates/UE5_gitignore.txt) を
`C:\UE\SpeedTest\.gitignore` として保存、
[`../templates/UE5_gitattributes.txt`](../templates/UE5_gitattributes.txt) を
`C:\UE\SpeedTest\.gitattributes` として保存。

```bash
git add .
git commit -m "Day1: Vehicleテンプレートで初期状態"
```

> `Saved/` `Intermediate/` `DerivedDataCache/` は**絶対にコミットしない**（数十GBになります）。
> 上の `.gitignore` がそれを除外しています。

---

## 次にやること

**→ [`01-roadmap-7days.md`](01-roadmap-7days.md) の Day 2 へ。**

Day 2 は「光」です。**初心者が最短で最大の"綺麗さ"を得られるのがライティングとポストプロセス。**
高級アセットを買うより、まず光を整える方が効果が大きい。ここが一番テンションが上がる日です。

---

## 参考リンク

- [Unreal MCP in Unreal Editor — UE公式ドキュメント](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)
- [Unreal Engine Skills for Claude Code Plugin — Epic公式リポジトリ](https://github.com/EpicGames/unreal-engine-skills-for-claude-code-plugin)
- [Scripting the Unreal Editor Using Python](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-unreal-editor-using-python)
