"""
dump_vehicle_settings.py — 車両の現在設定をテキストに書き出す（Day5 の要）

【これは何をするスクリプトか】
選択中の車アクターから Chaos Vehicle の設定値を読み取り、
テキストファイルに書き出します。

【なぜこれが重要か】
車の挙動調整は「全部が数値」です。つまり Claude Code の独壇場。
ただし Claude はバイナリの Blueprint を直接読めません。
このスクリプトで数値をテキスト化すれば、Claude が現状を正確に把握したうえで
「トルクカーブの低回転側を太くする」といった具体的な提案ができるようになります。

【実行方法】
  1. ビューポートで車のアクターを1つ選択する（★これを忘れると何も出ません）
  2. アウトプットログ → Python モード → Scripts/dump_vehicle_settings.py
  3. 出力された vehicle_settings.txt の中身を Claude Code に貼る
  4. 「もっと低回転からドンと出る感じにして」のように狙いを言葉で伝える
"""

import os
import unreal

OUTPUT_NAME = "vehicle_settings.txt"

# 読み取りを試みるプロパティ。UE5.8で名前が違えば「(取得不可)」と記録して続行します。
MOVEMENT_PROPS = [
    # --- エンジン ---
    "engine_setup",
    "max_engine_rpm",
    "engine_idle_rpm",
    "engine_brake_effect",
    # --- 変速機 ---
    "transmission_setup",
    "differential_setup",
    # --- 車体 ---
    "mass",
    "chassis_height",
    "drag_coefficient",
    "center_of_mass_override",
    "enable_center_of_mass_override",
    # --- ステアリング ---
    "steering_setup",
    # --- 補助 ---
    "wheel_setups",
    "torque_control",
    "target_rotation_control",
    "stability_control",
]


def out_dir():
    """プロジェクトの Saved フォルダを返す。"""
    try:
        return unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir())
    except Exception:
        return unreal.Paths.project_saved_dir()


def describe(value, depth=0):
    """UEの構造体を人間が読める形に展開する。"""
    pad = "  " * depth

    if value is None:
        return "None"

    # 配列
    if isinstance(value, (list, tuple, unreal.Array)):
        items = list(value)
        if not items:
            return "[]"
        lines = []
        for i, item in enumerate(items):
            lines.append("{}  [{}] {}".format(pad, i, describe(item, depth + 1)))
        return "\n" + "\n".join(lines)

    # 構造体（中身を展開する）
    if isinstance(value, unreal.StructBase) and depth < 3:
        lines = []
        for name in dir(value):
            if name.startswith("_"):
                continue
            try:
                inner = getattr(value, name)
            except Exception:
                continue
            if callable(inner):
                continue
            lines.append("{}    {}: {}".format(pad, name, describe(inner, depth + 1)))
        if lines:
            return "\n" + "\n".join(lines)

    return str(value)


def find_vehicle_component(actor):
    """車アクターから車両移動コンポーネントを探す。クラス名がバージョンで異なるので順に試す。"""
    candidates = []
    for cls_name in ("ChaosWheeledVehicleMovementComponent",
                     "ChaosVehicleMovementComponent",
                     "WheeledVehicleMovementComponent"):
        cls = getattr(unreal, cls_name, None)
        if cls is not None:
            candidates.append((cls_name, cls))

    for cls_name, cls in candidates:
        try:
            comp = actor.get_component_by_class(cls)
            if comp:
                return cls_name, comp
        except Exception:
            continue
    return None, None


def main():
    subsys = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    selected = subsys.get_selected_level_actors()

    if not selected:
        unreal.log_error("[vehicle] ビューポートで車のアクターを選択してから実行してください。")
        unreal.log_error("[vehicle] （Playモード中ではなく、エディタのビューポートで選択します）")
        return

    lines = []
    lines.append("=" * 60)
    lines.append("車両設定ダンプ")
    lines.append("=" * 60)
    lines.append("")
    lines.append("※ このファイルの中身をそのまま Claude Code に貼り付けて、")
    lines.append("   どう変えたいかを言葉で伝えてください。")
    lines.append("   例: 「低回転からもっとトルクが出て、ドンと出る感じにして」")
    lines.append("       「コーナーで滑りすぎる。グリップを上げて」")
    lines.append("       「ハンドルの反応が鈍い。もっとクイックに」")
    lines.append("")

    found_any = False

    for actor in selected:
        try:
            label = actor.get_actor_label()
        except Exception:
            label = str(actor)

        cls_name, comp = find_vehicle_component(actor)

        lines.append("-" * 60)
        lines.append("アクター: {}".format(label))

        if comp is None:
            lines.append("  → 車両コンポーネントが見つかりません。")
            lines.append("     車の本体（Pawn）を選択しているか確認してください。")
            lines.append("")
            continue

        found_any = True
        lines.append("  コンポーネント: {}".format(cls_name))
        lines.append("")

        for prop in MOVEMENT_PROPS:
            try:
                value = comp.get_editor_property(prop)
            except Exception:
                lines.append("  {}: (このバージョンでは取得不可)".format(prop))
                continue
            lines.append("  {}: {}".format(prop, describe(value)))

        lines.append("")

    if not found_any:
        unreal.log_error("[vehicle] 選択したアクターに車両コンポーネントがありませんでした。")
        unreal.log_error("[vehicle] アウトライナーで車の Pawn（BP_SportsCar 等）を選んでください。")

    text = "\n".join(lines)
    path = os.path.join(out_dir(), OUTPUT_NAME)

    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        unreal.log("[vehicle] 書き出しました: {}".format(path))
        unreal.log("[vehicle] このファイルを開いて、中身を Claude Code に貼ってください。")
    except Exception as e:
        unreal.log_error("[vehicle] ファイル書き込みに失敗: {}".format(e))
        unreal.log("[vehicle] 代わりにログに出力します:")
        unreal.log(text)


main()
