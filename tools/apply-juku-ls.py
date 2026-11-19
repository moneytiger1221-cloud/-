#!/usr/bin/env python3
"""tools/juku-ls.js を各ツールのHTMLに埋め込み、保存先を JUKU_LS（IndexedDB）に切り替える。

何度実行しても同じ結果になる（埋め込み済みの部分は入れ替えるだけ）。
  1. 既存の JUKU_LS ブロックを外して、最新の tools/juku-ls.js を最初のスクリプトの前に入れる
  2. ツール本体の <script> を <script type="text/juku-deferred"> にする
     （JUKU_LS が IndexedDB を読み終えてから動かすため）
  3. localStorage.getItem / setItem / removeItem / key / length / clear を JUKU_LS に置き換える
使い方: python3 tools/apply-juku-ls.py   （リポジトリの一番上で）
"""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHIM = open(os.path.join(ROOT, 'tools', 'juku-ls.js'), encoding='utf-8').read().strip()
BLOCK_RE = re.compile(r'<script id="juku-ls">.*?/\* JUKU_LS:END \*/\s*</script>\n?', re.S)
LS_RE = re.compile(r'(?<![\w.$])localStorage\.(getItem|setItem|removeItem|key|length|clear)\b')
# JS の文字列の中の "<script>" は置き換えない（直前が引用符のもの）
TAG_RE = re.compile(r'(?<!["\'])<script>')
DEFER = '<script type="text/juku-deferred">'

def apply(path):
    s = open(path, encoding='utf-8').read()
    orig = s
    s = BLOCK_RE.sub('', s)
    s = TAG_RE.sub(DEFER, s)
    s = LS_RE.sub(lambda m: 'JUKU_LS.' + m.group(1), s)
    i = s.find(DEFER)
    if i < 0:
        return False
    s = s[:i] + '<script id="juku-ls">\n' + SHIM + '\n</script>\n' + s[i:]
    if s != orig:
        open(path, 'w', encoding='utf-8').write(s)
    return s != orig

if __name__ == '__main__':
    for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        print(('更新 ' if apply(f) else 'そのまま ') + os.path.basename(f))
