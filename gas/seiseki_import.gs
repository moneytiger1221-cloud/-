/**
 * 毎日の「成績進捗」メールに付いているスプレッドシートを、SSツールに取り込むスクリプト
 *
 * 【前提】校舎用（仕事用）Googleアカウントで動かす。
 *   - SSツールのスプレッドシートも仕事用アカウントのDriveに置く
 *   - 取込データは会社アカウント外に出ない
 *
 * 【設定手順】
 *   1. SSツールのスプレッドシートを開く → 拡張機能 → Apps Script
 *   2. このコードを貼り付けて保存
 *   3. 関数「importDailyProgress」を選んで一度手動で実行 → 権限を許可
 *   4. 関数「createDailyTrigger」を一度だけ実行 → 以後毎日自動で動く
 */

const CONFIG = {
  // 対象メールの検索条件（Gmailの検索欄と同じ書き方）
  SEARCH_QUERY: 'subject:成績進捗 from:foresta.goku@gmail.com newer_than:3d',
  // 取り込み済みメールに付けるラベル（同じメールを二重に取り込まないため）
  PROCESSED_LABEL: 'SS取込済み',
  // 取込先シート名の頭につける文字。元スプシのタブ名ごとに「取込_タブ名」シートを作る
  DEST_SHEET_PREFIX: '取込_',
  // 毎日の実行時刻（メールは10:10頃に届くので11時台）
  TRIGGER_HOUR: 11,
};

function importDailyProgress() {
  const label =
    GmailApp.getUserLabelByName(CONFIG.PROCESSED_LABEL) ||
    GmailApp.createLabel(CONFIG.PROCESSED_LABEL);

  const threads = GmailApp.search(
    `${CONFIG.SEARCH_QUERY} -label:"${CONFIG.PROCESSED_LABEL}"`
  );
  if (threads.length === 0) {
    console.log('新しい成績進捗メールはありません');
    return;
  }

  const tool = SpreadsheetApp.getActiveSpreadsheet();

  // 古い順に処理（最新のメールの内容が最後に上書きされるように）
  threads.reverse().forEach((thread) => {
    const messages = thread.getMessages();
    const msg = messages[messages.length - 1];
    const ids = extractSpreadsheetIds(msg.getBody());

    if (ids.length === 0) {
      console.warn(`スプシのリンクが見つかりません: ${msg.getSubject()}`);
      return;
    }

    ids.forEach((id) => copySpreadsheetInto(id, tool, msg));
    thread.addLabel(label);
    console.log(`取込完了: ${msg.getSubject()}`);
  });
}

/** メール本文（HTML）からGoogleスプレッドシートのIDを抜き出す */
function extractSpreadsheetIds(html) {
  const re = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/g;
  const ids = new Set();
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

/** 元スプシの全タブを、SSツール側の「取込_タブ名」シートに上書きコピー */
function copySpreadsheetInto(sourceId, tool, msg) {
  const source = SpreadsheetApp.openById(sourceId);
  const receivedAt = Utilities.formatDate(
    msg.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'
  );

  source.getSheets().forEach((sheet) => {
    const values = sheet.getDataRange().getValues();
    const destName = CONFIG.DEST_SHEET_PREFIX + sheet.getName();
    const dest = tool.getSheetByName(destName) || tool.insertSheet(destName);

    dest.clearContents();
    // 1行目：いつのメールのデータか
    dest.getRange(1, 1, 1, 2).setValues([['メール受信日時', receivedAt]]);
    // 3行目以降：元データそのまま
    if (values.length > 0 && values[0].length > 0) {
      dest.getRange(3, 1, values.length, values[0].length).setValues(values);
    }
  });
}

/** 毎日自動実行のトリガーを作成（最初に1回だけ実行） */
function createDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'importDailyProgress')
    .forEach((t) => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('importDailyProgress')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.TRIGGER_HOUR)
    .inTimezone('Asia/Tokyo')
    .create();
}
