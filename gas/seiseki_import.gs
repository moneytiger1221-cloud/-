/**
 * SS（成績進捗）メール → SS管理ツール 自動取込用 Apps Script
 *
 * ■ 何をするか
 *   1. 仕事用Gmailに届く「成績進捗」メールを探す
 *   2. 本文にリンクされているスプシを xlsx として書き出し、仕事用Driveの
 *      「SS自動取込」フォルダに保存する（ダウンロードと同じ形式）
 *   3. SS管理ツール（スマホ可）から「メールから取り込む」を押すと、
 *      このスクリプトがウェブアプリとして新しい xlsx を渡す
 *   → データは仕事用アカウントと、ツールを開いた端末の中だけ。個人アカウントは通らない。
 *
 * ■ 設定手順（仕事用アカウントで。PCがあれば楽だが、スマホのブラウザでも可）
 *   1. https://script.google.com を仕事用アカウントで開く → 新しいプロジェクト
 *   2. このコードを全部貼り付けて保存
 *   3. 左の歯車「プロジェクトの設定」→ スクリプト プロパティ に
 *        プロパティ: KEY   値: 好きな合言葉（ツールに入れるもの）
 *      を追加
 *   4. 関数「setup」を選んで実行 → 権限を許可（毎日の自動実行もここで登録される）
 *   5. 右上「デプロイ」→ 新しいデプロイ → 種類「ウェブアプリ」
 *        次のユーザーとして実行: 自分
 *        アクセスできるユーザー: 全員
 *      → 表示された URL（…/exec）をSS管理ツールの「メールから自動取込」に入れる
 */

const CONFIG = {
  // 対象メールの検索条件（Gmailの検索欄と同じ書き方）
  SEARCH_QUERY: 'subject:成績進捗 from:foresta.goku@gmail.com newer_than:7d',
  // 処理済みのメールに付けるラベル（二重に書き出さないため）
  PROCESSED_LABEL: 'SS取込済み',
  // xlsx の置き場所（仕事用Driveのマイドライブ直下に自動で作る）
  FOLDER_NAME: 'SS自動取込',
  // ツールに渡す対象（この日数より古いファイルは渡さない）
  LIST_DAYS: 14,
  // これより古い xlsx はゴミ箱へ（Driveに溜めないため）
  KEEP_DAYS: 60,
  // 毎日の自動実行の時刻（メールは10:10頃に届く）
  TRIGGER_HOUR: 11,
};

/* ===================== 初期設定 ===================== */

/** 最初に1回だけ実行：権限の許可・フォルダ作成・毎日の自動実行の登録 */
function setup() {
  if (!PropertiesService.getScriptProperties().getProperty('KEY')) {
    throw new Error('先に「プロジェクトの設定」→スクリプト プロパティに KEY（合言葉）を入れてください');
  }
  getFolder_();
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'dailyJob')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyJob')
    .timeBased().everyDays(1).atHour(CONFIG.TRIGGER_HOUR).inTimezone('Asia/Tokyo')
    .create();
  const n = pullNewMails();
  console.log(`準備できました。今回 ${n} 件のメールから書き出しました。`);
}

/** 毎日の自動実行 */
function dailyJob() {
  pullNewMails();
  cleanupOldFiles_();
}

/* ===================== メール → xlsx ===================== */

/** 未処理の成績進捗メールから xlsx を書き出す。書き出したメール数を返す */
function pullNewMails() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) return 0;   // 同時に走ったら片方は何もしない
  try {
    const label = GmailApp.getUserLabelByName(CONFIG.PROCESSED_LABEL) ||
                  GmailApp.createLabel(CONFIG.PROCESSED_LABEL);
    const threads = GmailApp.search(`${CONFIG.SEARCH_QUERY} -label:"${CONFIG.PROCESSED_LABEL}"`);
    const folder = getFolder_();
    let done = 0;

    threads.reverse().forEach((thread) => {
      const msgs = thread.getMessages();
      const msg = msgs[msgs.length - 1];
      const stamp = Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyyMMdd_HHmm');
      let saved = 0;

      // ① 本文にリンクされたスプシ（いつもの形）
      extractSpreadsheetIds_(msg.getBody()).forEach((id) => {
        try {
          const name = DriveApp.getFileById(id).getName();
          folder.createFile(exportXlsx_(id).setName(`${name}_${stamp}.xlsx`));
          saved++;
        } catch (e) {
          console.warn(`書き出せませんでした（${id}）: ${e.message}`);
        }
      });
      // ② xlsx がそのまま添付されている場合
      msg.getAttachments().forEach((a) => {
        if (/\.xlsx$/i.test(a.getName())) {
          folder.createFile(a.copyBlob().setName(a.getName().replace(/\.xlsx$/i, `_${stamp}.xlsx`)));
          saved++;
        }
      });

      if (saved > 0) {
        thread.addLabel(label);
        done++;
        console.log(`書き出し: ${msg.getSubject()}（${saved}ファイル）`);
      } else {
        console.warn(`スプシが見つかりません: ${msg.getSubject()}`);
      }
    });
    return done;
  } finally {
    lock.releaseLock();
  }
}

function extractSpreadsheetIds_(html) {
  const re = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/g;
  const ids = new Set();
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

/** スプシを xlsx の Blob にする（「ダウンロード → Excel」と同じもの） */
function exportXlsx_(id) {
  const res = UrlFetchApp.fetch(
    `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  return res.getBlob();
}

function getFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {}
  }
  const it = DriveApp.getRootFolder().getFoldersByName(CONFIG.FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(CONFIG.FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function cleanupOldFiles_() {
  const limit = Date.now() - CONFIG.KEEP_DAYS * 86400000;
  const it = getFolder_().getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getDateCreated().getTime() < limit) f.setTrashed(true);
  }
}

/* ===================== ウェブアプリ（ツールとの窓口） ===================== */

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: '形式が違います' }); }

  const key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key || req.key !== key) return json_({ ok: false, error: '合言葉が違います' });

  try {
    if (req.action === 'ssList') {
      pullNewMails();                       // 自動実行の前に開いても最新を拾う
      return json_({ ok: true, files: listFiles_() });
    }
    if (req.action === 'ssFile') {
      const folder = getFolder_();
      const f = DriveApp.getFileById(String(req.id || ''));
      // このフォルダの中のファイル以外は渡さない
      let inFolder = false;
      const ps = f.getParents();
      while (ps.hasNext()) if (ps.next().getId() === folder.getId()) inFolder = true;
      if (!inFolder) return json_({ ok: false, error: '対象外のファイルです' });
      return json_({ ok: true, name: f.getName(), data: Utilities.base64Encode(f.getBlob().getBytes()) });
    }
    return json_({ ok: false, error: '不明な操作です' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return ContentService.createTextOutput('SS自動取込: 動いています');
}

function listFiles_() {
  const since = Date.now() - CONFIG.LIST_DAYS * 86400000;
  const out = [];
  const it = getFolder_().getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const t = f.getDateCreated().getTime();
    if (t >= since && /\.xlsx$/i.test(f.getName())) {
      out.push({ id: f.getId(), name: f.getName(), created: new Date(t).toISOString() });
    }
  }
  out.sort((a, b) => a.created < b.created ? -1 : 1);
  return out;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
