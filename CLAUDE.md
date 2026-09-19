# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

## What this is

A suite of **standalone, single-file HTML tools for a Japanese cram school (塾)**,
served as a static site. There is **no build system, no package manager, no test
runner, no CI, and no dependencies to install**. Every file in the repo root is a
complete, self-contained application: markup, CSS, and JavaScript all live inside
one `.html` file.

```
index.html           統合ハブ「塾ツール」 — tab shell + 取込センター (import center)
komawari.html        コマ割ツール — lesson-slot assignment board
grade-tracker.html   成績推移トラッカー — test-score tracking
survey-app.html      アンケート確認ツール — student satisfaction surveys
ys-board-sync.html   YSボード（同期版）— friend-referral pipeline board (React bundle)
ss-tracker.html      SS（成績進捗）— daily "SS" progress metrics per teacher
shinro.html          進路 — private-school 打診値 + 神奈川県公立 admissions
shindan.html         コマ割ツール 診断とリセット — standalone diagnostics/reset page
version.txt          cache-busting stamp, e.g. `202609131537` (NO trailing newline)
```

There is **no `.gitignore`, no config directory, no `Code.gs`** in the repo. The
Google Apps Script backend that all sync talks to lives outside this repository
(deployed as a Web App); the tools deliberately never require it to be re-deployed.

## Working conventions (read before editing)

1. **Japanese is the language of the product and the source.** Every UI string,
   every code comment, and every commit message is Japanese. Comments are written
   in plain, explanatory prose aimed at a non-programmer maintainer — they explain
   *why* a rule exists ("7月に2学期、12月に3学期…"), not what the code does. Match
   this register; do not switch to English or to terse technical comments.
2. **Never split a tool into separate files.** These are distributed and opened as
   loose files (even via `file://` double-click) and must keep working that way.
   No `<script src>`, no `<link rel=stylesheet>`, no CDN, no bundler.
3. **Edit in place with surgical diffs.** The files are large (`ys-board-sync.html`
   is 15k lines / 750 KB). Locate the relevant `/* ===== … ===== */` section first
   and change only that; never reformat or rewrite a whole file.
4. **Do not embed personal data.** Student/teacher names, phone numbers and rosters
   must never be written into the HTML (see `komawari.html:1867` and `komawari.html:3045`).
   Internal ID numbers and teacher remarks (`TNOTE`, `SKILL_SEED`, `FEMALE_PREF_SEED`)
   *are* present by design — that is the existing line; do not widen it.
5. **Everything is client-side.** PDF and xlsx parsing is hand-written in-browser
   (`shinro.html` zip/inflate + CID-font CMap, `ss-tracker.html` PDF CMap decoding).
   Uploaded files must never be sent to a third-party conversion service.

## Release ritual — version stamping (do not skip)

Cache-busting is manual and must stay in lockstep across **three places**:

- `version.txt` — the single line (no trailing newline)
- `index.html` — the six `?v=…` query strings in the `TOOLS` array (~line 142)
- `index.html` — `var MINE = '…';` in the self-update block at the bottom (~line 1193)

The stamp format is `YYYYMMDDHHMM`. On load, `index.html` fetches `version.txt`
with `cache:'no-store'`; if it differs from `MINE`, it reloads itself once with
`?v=<stamp>` and then strips the query string back off via `history.replaceState`
so bookmarks stay stable. A mismatch either leaves phones on a stale build or
causes a reload loop — always bump all three together.

Commit messages follow `ツール更新 YYYY-MM-DD HH:MM` (matching the stamp), and a
typical commit touches the edited tool(s) + `index.html` + `version.txt`.

## Architecture

### The hub (`index.html`)

`index.html` is a tab shell. Each tool is loaded into a lazily-created `<iframe>`
(only on first tab activation), so state survives tab switches. The 取込 (import)
tab is the one pane rendered inline rather than in an iframe.

Because every tool sits on the **same origin**, they share one `localStorage`.
That is the entire integration substrate — there is no message bus for data, and
cross-tool reads are done by reading another tool's keys directly
(`komawari.html:1370` reads grade / survey / YS keys, **read-only, never writes**).

The hub reaches *into* iframes for imports via `window.JUKU_IMPORT` (below) and,
when the term changes, calls the iframe's `pullRoster(true)` / `shelfNotice()`.
Tools reach *out* with `jukuInHub()` — detecting `window.parent.document#panes` —
to hide their own import widgets when running inside the hub.

### Shared modules are copy-pasted, not imported

Four blocks appear near-verbatim in several files, each marked
`/* ===== … （塾ツール共通）===== */`:

| Block | Purpose |
|---|---|
| `JUKU_TERM` | 学期 (term) arithmetic: 年度 starts in April; per-tool term guessing |
| `JUKU_ROSTER` | the 棚 ("shelf"): CSV rosters stored per-term under `juku_roster_v1` |
| `JUKU_SYNC` | device naming, `stamp`/`peek`, auto save+load, `merge`, `touch` |
| import tidy-up | `jukuInHub()` / `jukuHideImports()` |

Rough locations: `index.html:216/305/731`, `grade-tracker.html:491/580/904/1001`,
`komawari.html:1928/2017/493/590`, `survey-app.html:445/534/607/704`,
`shinro.html:3542/3639`, `ss-tracker.html:3242/3339`, `ys-board-sync.html:8`.

**When you change one of these blocks, change every copy.** Copies have already
drifted on purpose — e.g. `JUKU_TERM.paint()` takes an extra `cb` argument in
`grade-tracker.html`, `komawari.html` and `survey-app.html` but not in `index.html`
— so diff before you paste, and preserve intentional per-tool differences.
`JUKU_TERM`/`JUKU_ROSTER` are only present in the tools that consume rosters
(hub, コマ組, 成績, アンケート); `shinro`, `ss` and `ys` carry `JUKU_SYNC` only.

### Terms (学期) — why there is no single "current term"

年度 begins in April. Different tools are legitimately working on different terms
in the same month, because コマ組 plans ahead while アンケート reviews the past:

- コマ組: 4–6月→1学期, 7–11月→2学期, 12–2月→3学期, 3月→**next year's** 1学期
- アンケート: 4–10月→1学期, 11–1月→2学期, 2–3月→3学期
- 成績: driven by test round — ①②=1学期, ③④=2学期, ⑤=3学期 (`JUKU_TERM.termOfKai`)
- 講習 (seasonal courses) is a separate axis entirely: `JUKU_TERM.kousyu()`

Each tool stores its own term under `juku_roster_mark_v1`; the hub's 取込 tab
shows all three side by side and flags a tool whose mark disagrees with the month.

### The 取込センター (import center)

`detectKind(name, head)` in `index.html` classifies a dropped file by filename
pattern and by CSV header keywords, then routes it:

- **Rosters** (`student` / `teacher` CSV) → decoded to text once (UTF-8, falling
  back to Shift_JIS by counting `U+FFFD`) and shelved under a term in
  `juku_roster_v1`. Tools pull from the shelf with `JUKU_ROSTER.pull(tool, kind, apply)`,
  which no-ops if already consumed (tracked in `juku_roster_seen_v1`).
- **Everything else** (PDF / xlsx / grade CSV / survey answers) is too large to
  shelve, so the hub mounts the target iframe, waits for `window.JUKU_IMPORT` to
  appear (20 s timeout), and hands the `File` straight to it.

`window.JUKU_IMPORT` is the tool-side contract. Each key is called with a single
`File` and may return a promise:

| Tool | Keys |
|---|---|
| `grade-tracker.html:3224` | `grade` |
| `survey-app.html:2849` | `survey`, `elem` |
| `ss-tracker.html:3800` | `ss`, `kouken` |
| `shinro.html:3993` | `dashin`, `koritsu` |
| `ys-board-sync.html:14023` | `ys`, `ysStudent`, `ysTeacher` |

`JUKU_SYNC.autoAfterImport(tool, doSave)` wraps every `JUKU_IMPORT` key so a
successful import automatically queues a spreadsheet save. If you add a key,
register it in `KINDS` in `index.html` and give `detectKind` a rule for it.

There is also **folder watching** (`showDirectoryPicker` + IndexedDB handle, in
`index.html:588` and again in `ss-tracker.html:3156`): daily files are imported
silently, rosters are queued for human term confirmation, unrecognised files are
ignored. This requires a real origin — it does not work under `file://`.

### Spreadsheet sync (Google Apps Script)

All tools speak the same tiny protocol to one Apps Script Web App URL, guarded by
a shared 合言葉 (passphrase). `Content-Type` is `text/plain` to dodge CORS preflight.

```
save: POST {key, tool, data:"<json string>"}      -> {ok, bytes}
load: POST {key, tool, action:"load"}             -> {ok, data, updatedAt}
```

`tool` selects the backing sheet (`sync_<tool>`): `komawari`, `grade`, `survey`,
`ysboard`, `ss`, `shinro`, and `roster` (the hub's shelf, kept separate so a
~270 KB roster is not re-sent inside every tool's payload).

The backend **replaces wholesale**, so conflict handling lives in the client:

- `JUKU_SYNC.stamp(payload)` adds `_meta = {savedAt, savedBy}`; payloads also carry
  `_touchedAt` from `JUKU_SYNC.touchedAt(tool)`.
- `JUKU_SYNC.touch(tool)` must be called **whenever the user hand-edits something**
  (see `grade-tracker.html:1252-1255`, `shinro.html:2354`). This timestamp is the
  only tiebreaker available.
- `JUKU_SYNC.merge(mine, theirs, mineNewer)` merges recursively instead of
  replacing: keys present on one side survive; arrays of `{id:…}` objects merge by
  `id`; genuine conflicts go to whichever device touched last. Loaders call
  `JUKU_SYNC.iAmNewer(tool, d._touchedAt)` to get `mineNewer`.
- `JUKU_SYNC.queueSave(tool, doSave)` debounces ~4 s, and re-checks the remote
  before sending so a newer remote is pulled in first.
- `JUKU_SYNC.autoLoad(tool, cfgOrFn, doLoad, say)` pulls only when `updatedAt`
  beats both `juku_sync_last_v1` and `juku_sync_seen_v1`. Re-checks fire on
  `visibilitychange`, `focus`, and every 180 s.
- Auto mode is on by default (`juku_auto_sync_v1`); `JUKU_SYNC.tuckManual()` hides
  the manual buttons while it is on.

Network failures are swallowed on purpose — the tools must stay usable offline.

The hub discovers a sync URL/passphrase by falling back through the other tools'
configs (`hubSyncCfg()` in `index.html:962`), so the user only ever types it once.

## localStorage key map

Shared (written by hub, read by tools):

```
juku_roster_v1        {学期:{student:{file,at,text}, teacher:{…}, kousyu}}  the 棚
juku_roster_mark_v1   {tool: '2026年度2学期'}   which term each tool is on
juku_roster_seen_v1   {tool:kind: {term, at}}  shelf-consumption marks
juku_device_v1        this device's display name
juku_sync_last_v1     {tool:{at,by}}  last save from this device
juku_sync_seen_v1     {tool: updatedAt}  last remote version pulled
juku_auto_sync_v1     {tool: bool}  auto-sync on/off
juku_touched_v1       {tool: ISO}  last manual edit on this device
juku_seen_files_v1    filenames already consumed by the folder watcher
jukutool_tab_v1       last active hub tab
```

Per tool (prefix → owner): `komawari*` / `komawari2026*` → コマ組 ·
`gradeTracker_*` → 成績 · `survey_*` → アンケート · `ss_*` → SS ·
`shinro_*` → 進路 · `ysboard-data` / `ysboard-sync-config` / `juku_pw_hash` → YSボード.
Sync configs live at `komawari_syncCfg_v1`, `gradeTracker_syncConfig_v1`,
`survey_syncUrl`+`survey_syncKey`, `shinro_sync_v1`, `ss_cfg_v1`,
`ysboard-sync-config`, and the hub's own `juku_sync_cfg_v1`.

IndexedDB: `juku_import` (hub) and `ss_tracker` (SS) each hold a `kv` store with
one `dir` key — the persisted directory handle for folder watching.

## Per-tool notes

- **`komawari.html`** — the most interconnected tool. Sections are marked
  `/* ============ name ============ */`; useful landmarks: CSV parse (789),
  teachers (802), teacher skills (860), `TNOTE` remarks (958), students & komas
  (1028), cross-tool linking (1370), persistence (1705), state (2148), error
  engine (2160), rendering (2365), drag & drop (2669), sync (3045), init (3188).
  Name matching across tools goes through `normJoinName()` (NFKC → katakana-to-
  hiragana → strip spaces/中黒 → fold 異体字 via `KANJI_VAR`) — reuse it rather
  than writing new normalisation.
- **`shinro.html`** — numbered sections 1–16. Contains a dependency-free PDF
  parser for 打診値 PDFs (515) and a dependency-free xlsx reader built on
  `DecompressionStream` (2135). Its parser IIFE is written to also export under
  Node (`shinro.html:911`). 打診値 is confidential; keep it device + spreadsheet only.
- **`ss-tracker.html`** — lines 237–747 are a DOM-free parsing core that runs in
  both browser and Node (`module.exports` at 745, exporting `parseSSFile`,
  `resolveTerms`, `nameKey`, `weekOf`, `zipEntries`); keep it DOM-free. Then data
  layer (748), view layers (1276, 1788), 貢献シート PDF reader (2371), score
  correlation (2654), import/watch/sync/boot (3058).
- **`ys-board-sync.html`** — **an esbuild bundle with React 19.2.5 inlined; the
  original `entry.jsx` is not in this repository.** Vendor code runs to ~line 13045;
  application code starts at the `// ../../../tmp/entry.jsx` marker. Edit the
  compiled app section in place (it is readable, with `\uXXXX`-escaped Japanese
  strings) and leave the vendor chunk untouched. Note it has its own passcode
  screen (`juku_pw_hash`, default `1234`, 5-minute auto-lock) — that is UI
  convenience, not real security.
- **`shindan.html`** — a recovery page for when コマ割ツール renders blank. It is
  **not** registered in the hub's `TOOLS` array and is opened directly. Its `KEYS`
  table has drifted from the live key set: it still lists `komawari_ct_v1`, which
  コマ組 renamed to `komawari_compat_th_v1`, and it is missing
  `komawari_mgroups_v1`, `komawari_showall_v1`, `komawari_withdraw_v1` and
  `komawari_dow_v2`. If you add or rename a コマ組 key, update this table too.

## Running and testing

There is nothing to build. Open a tool directly for a quick look, but note the
behaviour differences:

| Opened via | iframe hub | localStorage sharing | Import center | Folder watch |
|---|---|---|---|---|
| double-click (`file://`) | ✅ | ⚠️ per-file origins in modern Chrome | ❌ warns and refuses | ❌ |
| `START-TOOL.bat` (localhost) | ✅ | ✅ | ✅ | ✅ |
| published https URL | ✅ | ✅ | ✅ | ✅ |

`START-TOOL.bat` is referenced in the UI text but is **not** in this repository; it
is part of the distributed folder. For local checking, any static server on the
repo root is equivalent (`python3 -m http.server`). Folder watching needs Chrome
or Edge (`showDirectoryPicker`).

Verification is manual: open the affected tool, exercise the changed path, and
check the browser console. Where sync is involved, verify on two "devices"
(two browser profiles) that a save from one does not erase hand-typed edits on
the other — that is the invariant `JUKU_SYNC.merge` exists to protect.

## Git

- Work on the branch you were assigned; push with `git push -u origin <branch>`.
- Author of record is `morijuku-tools <moneytiger1221@gmail.com>`.
- History is linear, one commit per release, message `ツール更新 YYYY-MM-DD HH:MM`.
- A commit that changes any tool should also bump `version.txt` and the two
  stamps in `index.html` (see **Release ritual** above).
