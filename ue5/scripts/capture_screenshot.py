"""
capture_screenshot.py — レビュー用スクリーンショットを撮る

【これは何をするスクリプトか】
現在のビューポートの見た目を高解像度で書き出します。
毎日 before / after を撮るのに使います。

【なぜスクショが重要か】
辛口レビューは「絵」を見ないと成立しません。文章での説明では
「空の青が浅い」「路面の反射が死んでいる」といった指摘が出てきません。
また、Day1 と Day7 を並べたときの変化が、そのまま自分の成果の証明になります。

【実行方法】
  1. ビューポートを「見せたい画角」に合わせる
  2. 下の LABEL を書き換える（例: "day2_before"）
  3. アウトプットログ → Python モード → Scripts/capture_screenshot.py

【出力先】
  C:\\UE\\SpeedTest\\Saved\\Screenshots\\  （UE5の既定の保存場所）
  撮れたらそこから ue5/review/ にコピーしてください。
"""

import unreal

# ==============================================================
# 撮るたびにここを書き換える
# ==============================================================
LABEL = "day1_before"     # 命名規則: dayN_before / dayN_after
RESOLUTION = "2560x1440"  # 1440p。4Kで撮りたいなら "3840x2160"
HIDE_UI = True            # エディタのUI（ギズモ、グリッド等）を隠す


def get_world():
    try:
        return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    except Exception:
        try:
            return unreal.EditorLevelLibrary.get_editor_world()
        except Exception:
            return None


def run(cmd):
    try:
        unreal.SystemLibrary.execute_console_command(get_world(), cmd)
        return True
    except Exception as e:
        unreal.log_warning("[capture] 失敗: {} ({})".format(cmd, type(e).__name__))
        return False


def main():
    unreal.log("[capture] === スクリーンショット撮影: {} ===".format(LABEL))

    if HIDE_UI:
        # ギズモ・グリッド・アイコン類を隠して「ゲームの絵」として撮る
        run("ShowFlag.Grid 0")
        run("ShowFlag.BillboardSprites 0")
        run("ShowFlag.Selection 0")

    # HighResShot は UE標準の高解像度スクショコマンド。
    # ファイル名には自動で連番が付きます。
    run("HighResShot {}".format(RESOLUTION))

    if HIDE_UI:
        # 作業に戻れるよう表示を元に戻す
        run("ShowFlag.Grid 1")
        run("ShowFlag.BillboardSprites 1")
        run("ShowFlag.Selection 1")

    unreal.log("[capture] ")
    unreal.log("[capture] 保存先: Saved/Screenshots/ 配下")
    unreal.log("[capture] （エクスプローラーで C:\\UE\\SpeedTest\\Saved\\Screenshots\\ を開く）")
    unreal.log("[capture] ")
    unreal.log("[capture] 次にやること:")
    unreal.log("[capture]   1. 撮れた画像を {}.png にリネーム".format(LABEL))
    unreal.log("[capture]   2. ue5/review/ にコピー")
    unreal.log("[capture]   3. Claude Code で /review を実行")
    unreal.log("[capture] ")
    unreal.log("[capture] もっと綺麗に撮りたい場合:")
    unreal.log("[capture]   apply_scalability_3080.py の MODE を 'screenshot' にして実行 → 撮影")
    unreal.log("[capture]   さらに上を狙うなら Movie Render Queue（Day7で使用）")


main()
