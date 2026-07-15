/*
 * cv.test.js — cv.js の回帰テスト（Node / JXA 両対応）
 * 実行: cat cv.js cv.test.js | osascript -l JavaScript   （Node なら node cv.test.js）
 *
 * 実画像はリポジトリに置けない（著作権・サイズ）ため、合成データで
 * 「五線間隔・線の太さ・塗り/白抜き・茎・小節線」のバリエーションに対する
 * 検出の頑健性を担保する。実フォーマット固有の調整はブラウザ実機で行う。
 */
var CV = (typeof require !== 'undefined') ? require('./cv.js') : MusicCV;

var passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log('  x ' + msg); }
}

function hline(bin, w, y, x0, x1, th) { for (var t = 0; t < th; t++) for (var x = x0; x < x1; x++) bin[(y + t) * w + x] = 1; }
function vline(bin, w, x, y0, y1, th) { for (var t = 0; t < th; t++) for (var y = y0; y <= y1; y++) bin[y * w + x + t] = 1; }
function blobFilled(bin, w, h, cx, cy, rw, rh) {
  for (var y = cy - rh; y <= cy + rh; y++) for (var x = cx - rw; x <= cx + rw; x++) {
    var ex = (x - cx) / rw, ey = (y - cy) / rh;
    if (ex * ex + ey * ey <= 1 && x >= 0 && x < w && y >= 0 && y < h) bin[y * w + x] = 1;
  }
}
function blobHollow(bin, w, h, cx, cy, rw, rh, lw) {
  for (var y = cy - rh; y <= cy + rh; y++) for (var x = cx - rw; x <= cx + rw; x++) {
    var d = Math.pow((x - cx) / rw, 2) + Math.pow((y - cy) / rh, 2);
    var di = Math.pow((x - cx) / (rw - lw), 2) + Math.pow((y - cy) / (rh - lw), 2);
    if (d <= 1 && di > 1 && x >= 0 && x < w && y >= 0 && y < h) bin[y * w + x] = 1;
  }
}

// ---- 五線検出：間隔 8〜16px × 線の太さ 1〜3px、2段 ----
[[8, 1], [12, 1], [12, 2], [16, 3]].forEach(function (cfg) {
  var sp = cfg[0], th = cfg[1];
  var w = 400, h = sp * 40;
  var bin = new Uint8Array(w * h);
  [5 * sp, 20 * sp].forEach(function (top) {
    for (var i = 0; i < 5; i++) hline(bin, w, Math.round(top + i * sp), 20, 380, th);
  });
  var st = CV.detectStaves(bin, w, h);
  ok(st.length === 2, 'staves=2 (sp=' + sp + ', th=' + th + ') got ' + st.length);
  if (st.length === 2) {
    ok(Math.abs(st[0].spacing - sp) <= 1.5, 'spacing~' + sp + ' got ' + st[0].spacing.toFixed(1));
    ok(st[0].xStart <= 25 && st[0].xEnd >= 375, 'xRange covers staff body');
  }
});

// ---- 符頭検出：塗り和音・白抜き・茎・小節線の識別 ----
(function () {
  var sp = 12, w = 600, h = 260;
  var bin = new Uint8Array(w * h);
  var top = 100;
  for (var i = 0; i < 5; i++) hline(bin, w, top + i * sp, 20, 580, 2);
  var bot = top + 4 * sp;
  var rw = Math.round(sp * 0.62), rh = Math.round(sp * 0.46);
  // 塗り3つ（和音: 最下線・第3線・第5線）x=200 ＋ 茎
  [0, 1, 2].forEach(function (k) { blobFilled(bin, w, h, 200, bot - k * sp, rw, rh); });
  vline(bin, w, 200 + Math.round(sp * 0.55), bot - 2 * sp - Math.round(sp * 2.5), bot - 2 * sp, 2);
  // 白抜き1つ x=350（線幅2＝実際のレンダリングに近い比率）
  blobHollow(bin, w, h, 350, bot - sp, rw, rh, 2);
  // 小節線 x=450（五線の上端〜下端）
  vline(bin, w, 450, top, bot + 1, 2);

  var st = CV.detectStaves(bin, w, h);
  ok(st.length === 1, 'notehead scene: 1 staff, got ' + st.length);
  var nh = CV.detectNoteheads(bin, w, h, st);
  function near(x, tol) { return nh.filter(function (n) { return Math.abs(n.x - x) < tol; }); }
  ok(near(200, sp).length === 3, 'filled chord = 3 heads, got ' + near(200, sp).length);
  ok(near(350, sp).length === 1, 'hollow head = 1, got ' + near(350, sp).length);
  ok(near(450, sp * 0.7).length === 0, 'barline is not a head, got ' + near(450, sp * 0.7).length);
  var bl = CV.detectBarlines(bin, w, h, st);
  ok(bl[0] && bl[0].some(function (x) { return Math.abs(x - 450) < 4; }), 'barline found at x~450');
})();

// ---- 左端スキップ：調号ゾーンの記号を拾わない ----
(function () {
  var sp = 12, w = 600, h = 260;
  var bin = new Uint8Array(w * h);
  var top = 100;
  for (var i = 0; i < 5; i++) hline(bin, w, top + i * sp, 20, 580, 2);
  var bot = top + 4 * sp;
  // 「調号の♯」に相当する塗りインクを左端ゾーン（xStart+2*sp 付近）へ
  blobFilled(bin, w, h, 20 + 2 * sp, bot - sp, Math.round(sp * 0.5), Math.round(sp * 0.5));
  var st = CV.detectStaves(bin, w, h);
  var nh = CV.detectNoteheads(bin, w, h, st, { keySig: 1 });
  ok(nh.length === 0, 'key-sig zone symbol skipped, got ' + nh.length);
})();

// ---- 動画キャプチャ想定：薄いグレーの五線（Otsuでは消える）→ 緩い2値化で救済 ----
(function () {
  var w = 400, h = 160;
  var data = new Uint8ClampedArray(w * h * 4);
  for (var i = 0; i < data.length; i++) data[i] = 255; // 白背景
  function setPx(x, y, v) { var p = (y * w + x) * 4; data[p] = data[p+1] = data[p+2] = v; data[p+3] = 255; }
  // 薄いグレー(205)の五線 5本（間隔12）
  [40, 52, 64, 76, 88].forEach(function (yy) {
    for (var x = 20; x < 380; x++) setPx(x, yy, 205);
  });
  // 濃い(30)符頭を1個（Otsuはこの黒と白の間にしきい値を置き、線が消える）
  for (var y = 58; y <= 70; y++) for (var x = 193; x <= 207; x++) {
    var ex = (x - 200) / 7, ey = (y - 64) / 6;
    if (ex * ex + ey * ey <= 1) setPx(x, y, 30);
  }
  var res = CV.analyze({ data: data, width: w, height: h });
  ok(res.staves.length === 1, 'faint gray staff rescued by lenient binarize, got ' + res.staves.length);
  if (res.staves.length) ok(Math.abs(res.staves[0].spacing - 12) <= 1.5, 'faint staff spacing ~12');
})();

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (typeof process !== 'undefined' && process.exit) process.exit(failed ? 1 : 0);
