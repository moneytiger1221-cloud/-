/* JUKU_LS:BEGIN — tools/juku-ls.js から tools/apply-juku-ls.py で埋め込み。ここを直接直さないこと */
/* ===== JUKU_LS：塾ツール共通の保存先（IndexedDB）=====
   localStorage はスマホ(Safari)だと全ツール合わせて約5MBしかなく、すぐ満杯になる。
   そこで中身は IndexedDB に置き、各ツールからは localStorage と同じ書き方で使えるようにする。
   ・起動時に IndexedDB を全部メモリに読み込んでから、ツール本体のスクリプトを動かす
     （本体は <script type="text/juku-deferred">。読み書きは今まで通り同期のままでよい）
   ・書き込みはメモリに入れてすぐ IndexedDB へ。同じ画面の他のツール(iframe)にも知らせる
   ・localStorage に残っているもの（以前のデータ／IndexedDB が使えなかった時の書き込み）は
     起動のたびに IndexedDB へ移し、localStorage からは消す
   ・IndexedDB が使えない環境では、localStorage をそのまま使う
   ・スプシと自動で同期する（下の「スプシ同期」）。どの端末で変えても、開くたびに最新になる
   ★ツールのコードでは localStorage を直接使わず、必ず JUKU_LS を使うこと。 */
(function () {
  var DBN = 'juku_store', ST = 'kv';
  var mem = {}, db = null, early = [];
  /* 項目ごとの「この端末でいつ変えたか」(mt) と「最後にスプシで見た値」(base)。
     同じ IndexedDB に、ふつうの項目と混ざらない名前で置く */
  var MT = '\u0001m:', BS = '\u0001b:', meta = {};
  var readKeys = {}, started = false;
  var me = Math.random().toString(36).slice(2);
  var bc = null; try { bc = new BroadcastChannel('juku_ls'); } catch (e) {}
  function LS() { try { return window.localStorage; } catch (e) { return null; } }
  var warned = false;
  function fail(e) {
    if (warned) return; warned = true;
    try { alert('端末への保存に失敗しました。\n\n' + (e && e.message ? e.message : e)); } catch (x) {}
  }
  function put(k, v) {
    try {
      var tx = db.transaction(ST, 'readwrite'), s = tx.objectStore(ST);
      if (v === null) s['delete'](k); else s.put(v, k);
      tx.onabort = function () { fail(tx.error); };
    } catch (e) { fail(e); }
  }
  function nowIso() { return new Date().toISOString(); }
  function tell(k, v, remote) { if (bc) { try { bc.postMessage({ by: me, k: k, v: v, remote: !!remote }); } catch (e) {} } }
  function apply(d) {
    if (d.v === null) delete mem[d.k]; else mem[d.k] = d.v;
    if (d.remote) remoteChanged([d.k]); else if (SYNC.role) SYNC.soon();
  }
  function touch(k) { var t = nowIso(); meta[MT + k] = t; put(MT + k, t); }
  var api = {
    getItem: function (k) {
      k = String(k);
      if (!db) { var l = LS(); return l ? l.getItem(k) : null; }
      readKeys[k] = 1;   // スプシから変更が来たとき、このページを読み直すかどうかに使う
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    setItem: function (k, v) {
      k = String(k); v = String(v);
      if (!db) { LS().setItem(k, v); return; }
      if (mem[k] === v) return;
      mem[k] = v; put(k, v); touch(k); tell(k, v);
      if (SYNC.role) SYNC.soon();
    },
    removeItem: function (k) {
      k = String(k);
      if (!db) { var l = LS(); if (l) l.removeItem(k); return; }
      if (!Object.prototype.hasOwnProperty.call(mem, k)) return;
      delete mem[k]; put(k, null); touch(k); tell(k, null);
      if (SYNC.role) SYNC.soon();
    },
    key: function (i) {
      if (!db) { var l = LS(); return l ? l.key(i) : null; }
      var ks = Object.keys(mem); return i >= 0 && i < ks.length ? ks[i] : null;
    },
    clear: function () {
      if (!db) { var l = LS(); if (l) l.clear(); return; }
      Object.keys(mem).forEach(function (k) { api.removeItem(k); });
    },
    usingIdb: function () { return !!db; },
    /* スプシ同期が動いているか。動いているときは、各ツールの古い同期は止める */
    syncOn: function () { return !!db && !!syncCfg().url; },
    syncStatus: function () { return SYNC.status; },
    /* 今すぐ同期する。接続先を入れたばかりで、まだ同期係になっていなければ、ここで始める */
    syncNow: function () {
      if (!SYNC.role && db && window.top === window && syncCfg().url) { SYNC.role = true; SYNC.start(); }
      return SYNC.role ? SYNC.cycle() : Promise.resolve();
    }
  };
  Object.defineProperty(api, 'length', { get: function () {
    if (!db) { var l = LS(); return l ? l.length : 0; }
    return Object.keys(mem).length;
  } });
  if (bc) bc.onmessage = function (e) {
    var d = e.data; if (!d || d.by === me) return;
    if (db) apply(d); else early.push(d);   // 読み込み中に届いた分は、読み終わってから反映する
  };
  window.JUKU_LS = api;

  function openDb(cb) {
    var done = false;
    function fin(d) { if (done) { if (d) try { d.close(); } catch (e) {} return; } done = true; cb(d); }
    setTimeout(function () { fin(null); }, 4000);   // 開けないまま固まる端末があるので待ちすぎない
    try {
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { fin(r.result); };
      r.onerror = function () { fin(null); };
    } catch (e) { fin(null); }
  }
  function load(d, cb) {
    try {
      var tx = d.transaction(ST, 'readwrite'), s = tx.objectStore(ST), got = {}, moved = [], l = LS();
      s.openCursor().onsuccess = function (e) {
        var c = e.target.result;
        if (c) {
          if (String(c.key).charAt(0) === '\u0001') meta[c.key] = c.value; else got[c.key] = c.value;
          c['continue'](); return;
        }
        if (l) {
          for (var i = 0; i < l.length; i++) {
            var k = l.key(i); if (k == null) continue;
            var v = l.getItem(k); got[k] = v; s.put(v, k); moved.push(k);
            var t = nowIso(); meta[MT + k] = t; s.put(t, MT + k);
          }
        }
      };
      tx.oncomplete = function () {
        moved.forEach(function (k) { try { l.removeItem(k); } catch (e) {} });
        mem = got; db = d;
        early.forEach(apply); early = [];
        cb();
      };
      tx.onabort = function () { cb(); };   // 移せなかったら localStorage のまま動かす
    } catch (e) { cb(); }
  }
  /* ===================== スプシ同期 =====================
     ・項目（キー）を、ツールごとのまとまり（kv_koma / kv_grade / kv_survey / kv_ys / kv_shinro / kv_ss / kv_common）
       にしてスプシに置く。変えたら少し待ってすぐ送り、開いたとき・画面に戻ったとき・5分おきに読む
     ・端末の中（IndexedDB）にも持つのは、速さ（スプシは1回数秒かかる）と、電波が無いときも使えて、送れなかった分を残すため。
       正はスプシで、端末の中はその写し
     ・読むときは「最後にスプシで見た値(base)・この端末の値・スプシの値」の3つを比べて混ぜる。
       片方しか変えていなければそちらを採る。両方変えていたら中身をたどって混ぜ、
       id のある並びは1件ずつ、消したものは消えたまま、同じところを両方変えていたら新しく変えたほうを採る
     ・送っている間に別の端末が上書きしても、次に読んだときに混ぜ直して送り直すので消えない
     ・端末ごとの設定（接続先・端末名・同期の記録・画面の状態）は送らない */
  var SKIP = { juku_sync_last_v1: 1, juku_sync_seen_v1: 1, juku_touched_v1: 1, juku_device_v1: 1, juku_auto_sync_v1: 1,
    komawari_booth_at_v1: 1, jukutool_tab_v1: 1, juku_seen_files_v1: 1, ss_mail_v1: 1, ss_ui_v1: 1 };
  function grp(k) {
    if (SKIP[k] || /sync/i.test(k) || k.charAt(0) === '\u0001' || /^__/.test(k)) return null;
    if (/^komawari/.test(k)) return 'kv_koma';
    if (/^gradeTracker/.test(k)) return 'kv_grade';
    if (/^survey/.test(k)) return 'kv_survey';
    if (/^ysboard/.test(k) || k === 'juku_pw_hash') return 'kv_ys';
    if (/^shinro/.test(k)) return 'kv_shinro';
    if (/^ss_/.test(k)) return 'kv_ss';
    return 'kv_common';
  }
  var GROUPS = ['kv_common', 'kv_koma', 'kv_grade', 'kv_survey', 'kv_ys', 'kv_shinro', 'kv_ss'];
  function syncCfg() {
    var tries = [
      function () { return JSON.parse(api.getItemRaw('juku_sync_cfg_v1') || 'null'); },
      function () { return JSON.parse(api.getItemRaw('gradeTracker_syncConfig_v1') || 'null'); },
      function () { return { url: JSON.parse(api.getItemRaw('survey_syncUrl') || '""'), key: JSON.parse(api.getItemRaw('survey_syncKey') || '""') }; },
      function () { return JSON.parse(api.getItemRaw('shinro_sync_v1') || 'null'); },
      function () { return JSON.parse(api.getItemRaw('komawari_syncCfg_v1') || 'null'); },
      function () { return JSON.parse(api.getItemRaw('ysboard-sync-config') || 'null'); },
      function () { var c = JSON.parse(api.getItemRaw('ss_cfg_v1') || 'null'); return c && { url: c.syncUrl, key: c.syncKey }; }
    ];
    for (var i = 0; i < tries.length; i++) {
      try { var o = tries[i](); if (o && o.url && o.key) return { url: String(o.url).trim(), key: String(o.key).trim() }; } catch (e) {}
    }
    return { url: '', key: '' };
  }
  api.getItemRaw = function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; };

  /* ---- 3つを比べて混ぜる ---- */
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function eq(a, b) { if (a === b) return true; try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }
  function hasIds(a) { return Array.isArray(a) && a.every(function (x) { return x && typeof x === 'object' && x.id !== undefined && x.id !== null; }); }
  function isPrimArr(a) { return Array.isArray(a) && a.every(function (x) { return x === null || typeof x !== 'object'; }); }
  function merge3(B, M, R, mineNewer) {
    if (eq(M, R)) return M;
    if (eq(B, M)) return R;        // こちらは変えていない
    if (eq(B, R)) return M;        // スプシ側は変わっていない
    if (isObj(M) && isObj(R)) {
      var b = isObj(B) ? B : {}, out = {}, ks = {};
      Object.keys(M).concat(Object.keys(R)).forEach(function (k) { ks[k] = 1; });
      Object.keys(ks).forEach(function (k) { var v = merge3(b[k], M[k], R[k], mineNewer); if (v !== undefined) out[k] = v; });
      return out;
    }
    if (Array.isArray(M) && Array.isArray(R)) {
      var bb = Array.isArray(B) ? B : [];
      if (hasIds(M) && hasIds(R) && (bb.length === 0 || hasIds(bb))) {
        var bm = {}, mm = {}, rm = {}, order = [], seen = {};
        bb.forEach(function (x) { bm[String(x.id)] = x; });
        M.forEach(function (x) { mm[String(x.id)] = x; if (!seen[x.id]) { seen[x.id] = 1; order.push(String(x.id)); } });
        R.forEach(function (x) { rm[String(x.id)] = x; if (!seen[x.id]) { seen[x.id] = 1; order.push(String(x.id)); } });
        var res = [];
        order.forEach(function (id) { var v = merge3(bm[id], mm[id], rm[id], mineNewer); if (v !== undefined) res.push(v); });
        return res;
      }
      if (isPrimArr(M) && isPrimArr(R) && isPrimArr(bb)) {
        var inB = function (x) { return bb.indexOf(x) >= 0; };
        var keep = M.filter(function (x) { return !(inB(x) && R.indexOf(x) < 0); });
        R.forEach(function (x) { if (keep.indexOf(x) < 0 && !(inB(x) && M.indexOf(x) < 0)) keep.push(x); });
        return keep;
      }
    }
    return mineNewer ? M : R;      // 同じところを両方変えた：あとから変えたほう
  }
  function parse(s) { if (s === null || s === undefined) return undefined; try { return JSON.parse(s); } catch (e) { return { __raw: s }; } }
  function mergeStr(b, m, r, mt, rt) {
    if (m === r) return m;
    if (b === m) return r;
    if (b === r) return m;
    // 一度もスプシで見ていない項目（この端末が初めて加わったとき）は、ぶつかったらスプシ側を採る
    var mineNewer = b === null ? false : (mt || '') > (rt || '');
    var B = parse(b), M = parse(m), R = parse(r);
    if (M === undefined || R === undefined || (M && M.__raw !== undefined) || (R && R.__raw !== undefined)) return mineNewer ? m : r;
    var v = merge3(B, M, R, mineNewer);
    return v === undefined ? null : JSON.stringify(v);
  }

  /* ---- やりとり ---- */
  var SYNC = { role: false, status: { state: 'idle', at: '', msg: '' }, busy: false, again: false, timer: null };
  function post(body) {
    var c = syncCfg();
    var payload = JSON.stringify(Object.assign({ key: c.key }, body));
    return fetch(c.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload, keepalive: payload.length < 60000 }).then(function (r) { return r.json(); });
  }
  function setStatus(state, msg) {
    SYNC.status = { state: state, at: nowIso(), msg: msg || '' };
    try { window.dispatchEvent(new CustomEvent('juku-sync', { detail: SYNC.status })); } catch (e) {}
    badge();
  }
  function reloadMem() {          // ほかのページ(iframe)の書き込みも拾うため、毎回 IndexedDB から読み直す
    return new Promise(function (res) {
      try {
        var tx = db.transaction(ST, 'readonly'), got = {}, mt = {};
        tx.objectStore(ST).openCursor().onsuccess = function (e) {
          var c = e.target.result;
          if (c) { if (String(c.key).charAt(0) === '\u0001') mt[c.key] = c.value; else got[c.key] = c.value; c['continue'](); return; }
        };
        tx.oncomplete = function () { mem = got; meta = mt; res(); };
        tx.onabort = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function setLocal(k, v, base) {   // スプシから来た値を入れる（この端末の変更扱いにはしない）
    if (v === null) delete mem[k]; else mem[k] = v;
    put(k, v); meta[BS + k] = base; put(BS + k, base);
    tell(k, v, true);
  }
  function syncGroup(g, pushOnly) {
    return post({ tool: g, action: 'load' }).then(function (d) {
      if (!d || !d.ok) throw new Error((d && d.error) || '読み込めません');
      var remote = {};
      try { remote = (JSON.parse(d.data || '{}') || {}).kv || {}; } catch (e) {}
      var keys = {}, changed = [], dirty = false;
      Object.keys(mem).forEach(function (k) { if (grp(k) === g) keys[k] = 1; });
      Object.keys(remote).forEach(function (k) { if (grp(k) === g) keys[k] = 1; });
      Object.keys(meta).forEach(function (mk) { if (mk.indexOf(BS) === 0 && grp(mk.slice(BS.length)) === g) keys[mk.slice(BS.length)] = 1; });
      Object.keys(keys).forEach(function (k) {
        // 無い＝null。一度もスプシで見ていない項目は「前は無かった」とみなす（片方にしか無ければ、それを残す）
        var b = meta[BS + k] == null ? null : meta[BS + k], m = Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
        var re = remote[k], r = re ? re.v : null;
        var v = mergeStr(b, m, r, meta[MT + k], re && re.t);
        if (v !== m) { setLocal(k, v, r); changed.push(k); }
        else if (meta[BS + k] !== r) { meta[BS + k] = r; put(BS + k, r); }
        if (v !== r) dirty = true;
      });
      if (changed.length) remoteChanged(changed);
      if (!dirty) return false;
      var kv = {};
      Object.keys(keys).forEach(function (k) {   // 消した項目も null で送る（別の端末でも消えるように）
        kv[k] = { v: Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null, t: meta[MT + k] || '' };
      });
      return post({ tool: g, data: JSON.stringify({ format: 1, kv: kv }) }).then(function (s) {
        if (!s || !s.ok) throw new Error((s && s.error) || '保存できません');
        return true;
      });
    });
  }
  SYNC.cycle = function () {
    if (!db || !syncCfg().url) return Promise.resolve();
    if (SYNC.busy) { SYNC.again = true; return Promise.resolve(); }
    SYNC.busy = true; SYNC.pending = false; setStatus('busy');
    return reloadMem().then(function () {
      // まとまりごとに並行してやりとりする（順番に待つと開くのが遅くなる）
      return Promise.all(GROUPS.map(function (g) { return syncGroup(g); })).then(function (rs) {
        setStatus('ok'); return rs.some(Boolean); });
    }).catch(function (e) { setStatus('error', e && e.message ? e.message : String(e)); SYNC.retry = true; })
      .then(function (sent) {
        SYNC.busy = false;
        // 送ったら、別の端末が同時に上書きしていないか少しあとで確かめる
        if (SYNC.again || sent) { SYNC.again = false; SYNC.soon(sent ? 4000 : 500); }
        else if (SYNC.retry) { SYNC.retry = false; clearTimeout(SYNC.timer); SYNC.timer = setTimeout(SYNC.cycle, 30000); }
      });
  };
  SYNC.soon = function (ms) { clearTimeout(SYNC.timer); SYNC.pending = true; SYNC.timer = setTimeout(SYNC.cycle, ms || 400); setStatus('pending'); };
  SYNC.start = function () {
    /* スマホ(Safari)は、閉じたりアプリを切り替えたりした瞬間に処理を止める。
       送る前に止まると、保存したつもりの変更が別の端末に届かないので、隠れる瞬間にすぐ送る */
    var flush = function () { if (SYNC.pending) { clearTimeout(SYNC.timer); SYNC.cycle(); } };
    document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); else SYNC.soon(300); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('focus', function () { SYNC.soon(300); });
    window.addEventListener('online', function () { SYNC.soon(300); });
    setInterval(function () { if (!document.hidden) SYNC.cycle(); }, 300000);   // 開きっぱなしのとき用（隠れているときは通信しない）
  };
  /* スプシから変更が来たとき：その項目を読んでいたページは読み直す（画面の中身が古いままにならないように）。
     統合版の外枠（iframe を持つページ）は読み直さない */
  var reloadT = null;
  function remoteChanged(keys) {
    if (!started) return;
    if (!keys.some(function (k) { return readKeys[k]; })) return;
    if (document.querySelector('iframe')) return;
    clearTimeout(reloadT); reloadT = setTimeout(function () { location.reload(); }, 400);
  }
  /* 画面の隅に同期の状態を出す（最上位のページだけ） */
  function badge() {
    if (!SYNC.role || !document.body) return;
    var el = document.getElementById('juku-sync-badge');
    if (!el) {
      el = document.createElement('div'); el.id = 'juku-sync-badge';
      el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483646;font:11px/1.4 sans-serif;padding:3px 8px;border-radius:10px;' +
        'background:rgba(30,40,55,.82);color:#fff;pointer-events:none;';
      document.body.appendChild(el);
    }
    var s = SYNC.status, t = s.at ? new Date(s.at) : null, hm = t ? t.getHours() + ':' + String(t.getMinutes()).padStart(2, '0') : '';
    el.textContent = s.state === 'ok' ? '☁ 同期済み ' + hm : s.state === 'busy' ? '☁ 同期中…' : s.state === 'pending' ? '☁ 送信中…' :
      s.state === 'error' ? '⚠ 同期できません（' + s.msg + '）' : '';
    el.style.background = s.state === 'error' ? 'rgba(184,67,58,.92)' : 'rgba(30,40,55,.82)';
  }

  function run() {
    started = true;
    var list = Array.prototype.slice.call(document.querySelectorAll('script[type="text/juku-deferred"]'));
    list.forEach(function (o) {
      var s = document.createElement('script');
      if (o.id) s.id = o.id;
      s.text = o.text;
      o.parentNode.replaceChild(s, o);
    });
    // 本体は読み込み完了の後に動くので、それを待っているコードのために合図を出し直す
    try { document.dispatchEvent(new Event('DOMContentLoaded')); } catch (e) {}
    if (document.readyState === 'complete') { try { window.dispatchEvent(new Event('load')); } catch (e) {} }
  }
  var stored = false, parsed = document.readyState !== 'loading', started = false;
  function go() { if (started || !stored || !parsed) return; started = true; run(); }
  function onDcl() { document.removeEventListener('DOMContentLoaded', onDcl); parsed = true; go(); }
  if (!parsed) document.addEventListener('DOMContentLoaded', onDcl);
  function ok() {
    // 最上位のページ（統合版か、ツールを単体で開いたとき）だけがスプシとやりとりする。開く前に一度読む
    if (db && window.top === window && syncCfg().url) {
      SYNC.role = true;
      var done = false, fin = function () { if (done) return; done = true; stored = true; go(); SYNC.start(); };
      setTimeout(fin, 5000);                 // つながらなくても5秒で開く
      SYNC.cycle(true).then(fin, fin);
    } else { stored = true; go(); }
  }
  if (!window.indexedDB) ok();
  else openDb(function (d) { if (!d) ok(); else load(d, ok); });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
})();
/* JUKU_LS:END */
