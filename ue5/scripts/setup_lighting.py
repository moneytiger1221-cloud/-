"""
setup_lighting.py — 写実寄りライティングの土台を一括セットアップ

【これは何をするスクリプトか】
UE5で「綺麗な絵」を作るために最低限必要な6つのアクターを配置し、
初心者が必ずハマる「オートエクスポージャー問題」を潰した状態にします。

  1. Directional Light      … 太陽
  2. Sky Atmosphere         … 物理ベースの空
  3. Sky Light              … 空からの環境光（影の中が真っ黒に潰れるのを防ぐ）
  4. Exponential Height Fog … 大気の霞（遠景に奥行きを出す）
  5. Volumetric Cloud       … 立体的な雲
  6. Post Process Volume    … 露出固定 + カラーグレーディング

【実行方法】
  1. UE5エディタで Python Editor Script Plugin が有効になっていること
  2. このファイルを C:\\UE\\SpeedTest\\Scripts\\setup_lighting.py に保存
  3. エディタ下部の「アウトプットログ」を開く
  4. コマンド欄の左のドロップダウンを Cmd → Python に切り替え
  5. 次を入力して Enter:
         Scripts/setup_lighting.py

【調整のしかた】
下の「調整パラメータ」の数値を変えて再実行するだけです。
Claude Code に「SUN_PITCH を -12 にして」のように頼めば書き換えてくれます。

【注意】
UE5.8 の Python API は Experimental です。プロパティ名が変わっている場合、
該当箇所だけスキップして続行し、最後にスキップ一覧を表示します。
全部失敗する場合は、エディタのバージョンをチャットに伝えてください。
"""

import unreal

# ==============================================================
# 調整パラメータ（ここだけ触ればよい）
# ==============================================================

# --- 太陽 ---
SUN_PITCH = -15.0        # 太陽の高さ。-90=真上（平坦でつまらない） / -10〜-25=低い夕方寄り（映画的）
SUN_YAW = 45.0           # 太陽の方角。影の向きが変わる
SUN_INTENSITY = 6.0      # 明るさ(lux)。暗ければ上げる。露出固定しているので効きがはっきり出る
SUN_TEMPERATURE = 5800.0 # 色温度(K)。低い=オレンジの夕日 / 高い=青白い昼光

# --- 空からの環境光 ---
SKYLIGHT_INTENSITY = 1.0 # 影の中の明るさ。上げると暗部が持ち上がる

# --- 霞（遠景の奥行き） ---
FOG_DENSITY = 0.02       # 濃さ。0.02〜0.05 くらいが自然。上げすぎると牛乳
FOG_HEIGHT_FALLOFF = 0.2 # 高さ方向の減衰。小さいほど上空まで霞む
FOG_START_DISTANCE = 500.0  # 何cm先から霞み始めるか。手前が白くなるのを防ぐ
USE_VOLUMETRIC_FOG = True   # 光の筋（ゴッドレイ）が出る。重いがとても効く

# --- 露出（★最重要） ---
# UE5は既定で自動露出ON = カメラを振ると勝手に明るさが変わる。
# これが「なんか安っぽい」の最大原因。Min と Max を同じ値にして固定する。
# 画面が暗すぎたら値を下げる（0.5等）、明るすぎたら上げる（2.0等）。直感と逆なので注意。
EXPOSURE_LOCK = 1.0

# --- カラーグレーディング（映画っぽさ） ---
COLOR_SATURATION = 1.05  # 彩度。1.0が素。上げすぎると嘘っぽい
COLOR_CONTRAST = 1.08    # コントラスト。締まりが出る
BLOOM_INTENSITY = 0.4    # 明部の滲み。既定(0.675)は強すぎることが多い
FRINGE_INTENSITY = 0.3   # レンズの色収差。ごく弱く入れると実写感が出る


# ==============================================================
# 以下、実装（通常は触らなくてよい）
# ==============================================================

_skipped = []


def _log(msg):
    unreal.log("[setup_lighting] {}".format(msg))


def safe_set(obj, prop, value, label=""):
    """プロパティ設定。名前が変わっていても全体を止めないための防御。"""
    try:
        obj.set_editor_property(prop, value)
        return True
    except Exception as e:
        _skipped.append("{}{} = {}  ({})".format(
            label + "." if label else "", prop, value, type(e).__name__))
        return False


def get_actor_subsystem():
    return unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def spawn(actor_class, location=None, rotation=None, label=None):
    """アクターを1体配置して返す。失敗しても None を返して続行。"""
    loc = location or unreal.Vector(0.0, 0.0, 0.0)
    rot = rotation or unreal.Rotator(0.0, 0.0, 0.0)
    try:
        actor = get_actor_subsystem().spawn_actor_from_class(actor_class, loc, rot)
        if actor and label:
            try:
                actor.set_actor_label(label)
            except Exception:
                pass
        _log("配置: {}".format(label or actor_class.__name__))
        return actor
    except Exception as e:
        _skipped.append("spawn {} ({})".format(label or actor_class, type(e).__name__))
        return None


def get_component(actor, component_class):
    """アクターから指定クラスのコンポーネントを取る。取れなければ None。"""
    if actor is None:
        return None
    try:
        comp = actor.get_component_by_class(component_class)
        if comp:
            return comp
    except Exception:
        pass
    # フォールバック: 全コンポーネントを走査
    try:
        for comp in actor.get_components_by_class(component_class):
            return comp
    except Exception:
        pass
    return None


# --------------------------------------------------------------
# 1. 太陽（Directional Light）
# --------------------------------------------------------------
def setup_sun():
    sun = spawn(
        unreal.DirectionalLight,
        unreal.Vector(0.0, 0.0, 1000.0),
        unreal.Rotator(0.0, SUN_PITCH, SUN_YAW),
        "Sun_DirectionalLight",
    )
    comp = get_component(sun, unreal.DirectionalLightComponent)
    if comp is None:
        _skipped.append("DirectionalLightComponent が取得できず、太陽の詳細設定をスキップ")
        return sun

    # Movable にしないと Lumen の動的GIが正しく効かない
    try:
        comp.set_mobility(unreal.ComponentMobility.MOVABLE)
    except Exception:
        _skipped.append("Sun.set_mobility")

    safe_set(comp, "intensity", SUN_INTENSITY, "Sun")
    safe_set(comp, "use_temperature", True, "Sun")
    safe_set(comp, "temperature", SUN_TEMPERATURE, "Sun")
    # Sky Atmosphere と連動させる（太陽の位置が空の色に反映される）
    safe_set(comp, "atmosphere_sun_light", True, "Sun")
    safe_set(comp, "cast_shadows", True, "Sun")
    # 動的影の距離。広い風景を走るので長めに取る
    safe_set(comp, "dynamic_shadow_distance_movable_light", 50000.0, "Sun")
    return sun


# --------------------------------------------------------------
# 2. 空（Sky Atmosphere）
# --------------------------------------------------------------
def setup_sky_atmosphere():
    return spawn(unreal.SkyAtmosphere, label="SkyAtmosphere")


# --------------------------------------------------------------
# 3. 環境光（Sky Light）
# --------------------------------------------------------------
def setup_sky_light():
    sky = spawn(
        unreal.SkyLight,
        unreal.Vector(0.0, 0.0, 1000.0),
        label="SkyLight",
    )
    comp = get_component(sky, unreal.SkyLightComponent)
    if comp is None:
        _skipped.append("SkyLightComponent が取得できず、環境光の詳細設定をスキップ")
        return sky

    try:
        comp.set_mobility(unreal.ComponentMobility.MOVABLE)
    except Exception:
        _skipped.append("SkyLight.set_mobility")

    # Real Time Capture: 空の見た目の変化を環境光にリアルタイム反映する
    # （これがOFFだと、太陽を動かしても影の中の色が変わらず嘘っぽくなる）
    safe_set(comp, "real_time_capture", True, "SkyLight")
    safe_set(comp, "intensity", SKYLIGHT_INTENSITY, "SkyLight")
    return sky


# --------------------------------------------------------------
# 4. 霞（Exponential Height Fog）
# --------------------------------------------------------------
def setup_fog():
    fog = spawn(
        unreal.ExponentialHeightFog,
        unreal.Vector(0.0, 0.0, 0.0),
        label="HeightFog",
    )
    comp = get_component(fog, unreal.ExponentialHeightFogComponent)
    if comp is None:
        _skipped.append("ExponentialHeightFogComponent が取得できず、霞の詳細設定をスキップ")
        return fog

    safe_set(comp, "fog_density", FOG_DENSITY, "Fog")
    safe_set(comp, "fog_height_falloff", FOG_HEIGHT_FALLOFF, "Fog")
    safe_set(comp, "start_distance", FOG_START_DISTANCE, "Fog")
    safe_set(comp, "volumetric_fog", USE_VOLUMETRIC_FOG, "Fog")
    return fog


# --------------------------------------------------------------
# 5. 雲（Volumetric Cloud）
# --------------------------------------------------------------
def setup_clouds():
    return spawn(unreal.VolumetricCloud, label="VolumetricCloud")


# --------------------------------------------------------------
# 6. ポストプロセス（★見た目の半分はここ）
# --------------------------------------------------------------
def setup_post_process():
    ppv = spawn(
        unreal.PostProcessVolume,
        unreal.Vector(0.0, 0.0, 0.0),
        label="GlobalPostProcess",
    )
    if ppv is None:
        return None

    # Unbound = レベル全体に効かせる。
    # これを忘れると「ボリュームの箱の中に入ったときだけ効く」状態になり、
    # 初心者が「設定したのに何も変わらない」と必ず一度ハマる。
    safe_set(ppv, "unbound", True, "PPV")
    safe_set(ppv, "priority", 1.0, "PPV")

    try:
        s = ppv.get_editor_property("settings")
    except Exception:
        _skipped.append("PostProcessVolume.settings が取得できず、全設定をスキップ")
        return ppv

    # --- 露出を固定（このスクリプトの一番の目的） ---
    safe_set(s, "override_auto_exposure_min_brightness", True, "PP")
    safe_set(s, "auto_exposure_min_brightness", EXPOSURE_LOCK, "PP")
    safe_set(s, "override_auto_exposure_max_brightness", True, "PP")
    safe_set(s, "auto_exposure_max_brightness", EXPOSURE_LOCK, "PP")

    # --- カラーグレーディング ---
    # Vector4 の中身は (R, G, B, Luminance)。全体を均等に動かすので4つとも同じ値。
    safe_set(s, "override_color_saturation", True, "PP")
    safe_set(s, "color_saturation",
             unreal.Vector4(COLOR_SATURATION, COLOR_SATURATION, COLOR_SATURATION, 1.0), "PP")
    safe_set(s, "override_color_contrast", True, "PP")
    safe_set(s, "color_contrast",
             unreal.Vector4(COLOR_CONTRAST, COLOR_CONTRAST, COLOR_CONTRAST, 1.0), "PP")

    # --- Bloom（既定値は強すぎて安っぽくなりがち） ---
    safe_set(s, "override_bloom_intensity", True, "PP")
    safe_set(s, "bloom_intensity", BLOOM_INTENSITY, "PP")

    # --- 色収差（ごく弱く入れると実写っぽさが出る） ---
    safe_set(s, "override_scene_fringe_intensity", True, "PP")
    safe_set(s, "scene_fringe_intensity", FRINGE_INTENSITY, "PP")

    # 構造体は値渡しなので、書き換えたら必ず戻す
    safe_set(ppv, "settings", s, "PPV")
    return ppv


# --------------------------------------------------------------
# 実行
# --------------------------------------------------------------
def main():
    _log("=" * 55)
    _log("ライティングのセットアップを開始します")
    _log("=" * 55)

    setup_sun()
    setup_sky_atmosphere()
    setup_sky_light()
    setup_fog()
    setup_clouds()
    setup_post_process()

    _log("-" * 55)
    if _skipped:
        _log("スキップした項目（{}件）:".format(len(_skipped)))
        for item in _skipped:
            _log("  - {}".format(item))
        _log("")
        _log("→ UE5.8 でプロパティ名が変わっている可能性があります。")
        _log("  この一覧をそのまま Claude Code に貼れば修正できます。")
    else:
        _log("すべて成功しました。")

    _log("-" * 55)
    _log("完了。次にやること:")
    _log("  1. ビューポートを見て、明るさが適切か確認")
    _log("  2. 暗すぎ/明るすぎなら EXPOSURE_LOCK を変えて再実行")
    _log("     （暗い→値を下げる / 明るい→値を上げる。直感と逆なので注意）")
    _log("  3. 影が短くて平坦なら SUN_PITCH を -10〜-25 の間で調整")
    _log("  4. スクショを review/day2_after.png に保存")
    _log("=" * 55)


main()
