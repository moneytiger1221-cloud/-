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
   ★ツールのコードでは localStorage を直接使わず、必ず JUKU_LS を使うこと。 */
(function () {
  var DBN = 'juku_store', ST = 'kv';
  var mem = {}, db = null, early = [];
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
  function tell(k, v) { if (bc) { try { bc.postMessage({ by: me, k: k, v: v }); } catch (e) {} } }
  function apply(d) { if (d.v === null) delete mem[d.k]; else mem[d.k] = d.v; }
  var api = {
    getItem: function (k) {
      k = String(k);
      if (!db) { var l = LS(); return l ? l.getItem(k) : null; }
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    setItem: function (k, v) {
      k = String(k); v = String(v);
      if (!db) { LS().setItem(k, v); return; }
      mem[k] = v; put(k, v); tell(k, v);
    },
    removeItem: function (k) {
      k = String(k);
      if (!db) { var l = LS(); if (l) l.removeItem(k); return; }
      if (!Object.prototype.hasOwnProperty.call(mem, k)) return;
      delete mem[k]; put(k, null); tell(k, null);
    },
    key: function (i) {
      if (!db) { var l = LS(); return l ? l.key(i) : null; }
      var ks = Object.keys(mem); return i >= 0 && i < ks.length ? ks[i] : null;
    },
    clear: function () {
      if (!db) { var l = LS(); if (l) l.clear(); return; }
      Object.keys(mem).forEach(function (k) { api.removeItem(k); });
    },
    usingIdb: function () { return !!db; }
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
        if (c) { got[c.key] = c.value; c['continue'](); return; }
        if (l) {
          for (var i = 0; i < l.length; i++) {
            var k = l.key(i); if (k == null) continue;
            var v = l.getItem(k); got[k] = v; s.put(v, k); moved.push(k);
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
  function run() {
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
  function ok() { stored = true; go(); }
  if (!window.indexedDB) ok();
  else openDb(function (d) { if (!d) ok(); else load(d, ok); });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
})();
/* JUKU_LS:END */
