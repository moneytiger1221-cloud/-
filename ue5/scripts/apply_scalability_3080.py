"""
apply_scalability_3080.py — RTX 3080 / 1440p 向けの描画設定を適用

【これは何をするスクリプトか】
UE5の描画品質をコンソールコマンドでまとめて設定します。
「綺麗さ優先」と「動作優先」をワンタッチで切り替えられます。

【実行方法】
  アウトプットログ → 左のドロップダウンを Python に切り替え → 次を入力:
      Scripts/apply_scalability_3080.py

【切り替え方】
  下の MODE を "quality" / "performance" / "screenshot" に変えて再実行。
"""

import unreal

# ==============================================================
# MODE を変えて再実行するだけ
#   "quality"    … 通常作業用。綺麗さと動作のバランス（1440p / 目標60fps）
#   "performance"… 重くて作業にならないとき。見た目を落として快適さ優先
#   "screenshot" … レビュー用スクショを撮るとき。fpsを捨てて最高品質
# ==============================================================
MODE = "quality"


PRESETS = {
    # --------------------------------------------------------------
    "quality": [
        # Scalability は 0=Low 1=Medium 2=High 3=Epic 4=Cinematic
        ("sg.ViewDistanceQuality", 3),
        ("sg.AntiAliasingQuality", 3),
        ("sg.ShadowQuality", 3),
        ("sg.GlobalIlluminationQuality", 3),   # Lumen GI の品質
        ("sg.ReflectionQuality", 3),           # Lumen 反射の品質
        ("sg.PostProcessQuality", 3),
        ("sg.TextureQuality", 3),
        ("sg.EffectsQuality", 3),
        ("sg.FoliageQuality", 3),
        ("sg.ShadingQuality", 3),
        # TSR（UE5標準のアップスケーラ）。低解像度で描いて綺麗に拡大する
        ("r.AntiAliasingMethod", 4),           # 4 = TSR
        ("r.ScreenPercentage", 75),            # 75%で描いてTSRで1440pへ。体感の劣化は小さく、fpsは大きく上がる
        # Lumen
        ("r.Lumen.HardwareRayTracing", 1),     # RTX3080ならハードウェアRTで品質が上がる
        ("r.Lumen.Reflections.Allow", 1),
        # Nanite / 影
        ("r.Nanite", 1),
        ("r.Shadow.Virtual.Enable", 1),
    ],
    # --------------------------------------------------------------
    "performance": [
        ("sg.ViewDistanceQuality", 2),
        ("sg.AntiAliasingQuality", 2),
        ("sg.ShadowQuality", 1),
        ("sg.GlobalIlluminationQuality", 1),
        ("sg.ReflectionQuality", 1),
        ("sg.PostProcessQuality", 2),
        ("sg.TextureQuality", 2),
        ("sg.EffectsQuality", 2),
        ("sg.FoliageQuality", 1),
        ("sg.ShadingQuality", 2),
        ("r.AntiAliasingMethod", 4),
        ("r.ScreenPercentage", 60),
        ("r.Lumen.HardwareRayTracing", 0),
        ("r.Shadow.Virtual.Enable", 1),
    ],
    # --------------------------------------------------------------
    "screenshot": [
        ("sg.ViewDistanceQuality", 4),
        ("sg.AntiAliasingQuality", 4),
        ("sg.ShadowQuality", 4),
        ("sg.GlobalIlluminationQuality", 4),
        ("sg.ReflectionQuality", 4),
        ("sg.PostProcessQuality", 4),
        ("sg.TextureQuality", 4),
        ("sg.EffectsQuality", 4),
        ("sg.FoliageQuality", 4),
        ("sg.ShadingQuality", 4),
        ("r.AntiAliasingMethod", 4),
        ("r.ScreenPercentage", 100),           # 等倍で描く
        ("r.Lumen.HardwareRayTracing", 1),
        ("r.Lumen.Reflections.Allow", 1),
        ("r.Shadow.Virtual.Enable", 1),
    ],
}


def get_world():
    try:
        return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    except Exception:
        try:
            return unreal.EditorLevelLibrary.get_editor_world()
        except Exception:
            return None


def run_command(cmd):
    world = get_world()
    try:
        unreal.SystemLibrary.execute_console_command(world, cmd)
        return True
    except Exception as e:
        unreal.log_warning("[scalability] 失敗: {} ({})".format(cmd, type(e).__name__))
        return False


def main():
    preset = PRESETS.get(MODE)
    if preset is None:
        unreal.log_error(
            "[scalability] MODE が不正です: '{}'  使える値: {}".format(
                MODE, " / ".join(PRESETS.keys())))
        return

    unreal.log("[scalability] === モード: {} を適用します ===".format(MODE))

    ok = 0
    for name, value in preset:
        if run_command("{} {}".format(name, value)):
            ok += 1

    unreal.log("[scalability] {} / {} 件を適用しました".format(ok, len(preset)))
    unreal.log("[scalability] ")
    unreal.log("[scalability] 効果の確認方法:")
    unreal.log("[scalability]   ` キー（バッククォート）→ stat fps    … フレームレート")
    unreal.log("[scalability]   ` キー → stat unit                   … どこが重いかの内訳")
    unreal.log("[scalability]     GPU が大きい → 描画負荷。ScreenPercentage を下げる")
    unreal.log("[scalability]     Game が大きい → CPU/ロジック負荷。描画設定では直らない")
    unreal.log("[scalability] ")
    unreal.log("[scalability] 注意: この設定はエディタを再起動すると既定に戻ります。")
    unreal.log("[scalability]       恒久化したい場合は Config/DefaultEngine.ini に書きます。")
    unreal.log("[scalability]       必要になったら Claude Code に頼んでください。")


main()
