/*
 * cv.js — 楽譜画像の自動認識（ブラウザ内・ベストエフォート）
 *
 * SPEC.md 第6章 / TASKS.md Phase 3 の実装。
 * きれいにレンダリングされた大譜表スクショ（例: EveryonePiano の楽譜）を主対象とする。
 * 純粋な画像処理関数の集まりで、UI（index.html）から分離する。外部送信・依存なし。
 *
 * 方針:
 *  - 五線検出（水平投影）は高信頼。手動の五線合わせを不要にする中核。
 *  - 符頭検出はベストエフォート。塗り(filled)/白抜き(hollow)の両方を積分画像で高速判定。
 *    取りこぼし・誤検出は必ず出る前提で、結果は全て手動修正できる（呼び出し側の責務）。
 *  - 座標は画像ピクセル（＝アプリのワールド座標）で返す。
 */
(function (global) {
  'use strict';

  // ---- 2値化（グレースケール + Otsu 閾値） -------------------------------
  function toGray(imageData) {
    var d = imageData.data, n = imageData.width * imageData.height;
    var g = new Uint8ClampedArray(n);
    for (var i = 0, p = 0; p < n; i += 4, p++) {
      g[p] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    }
    return g;
  }

  function otsu(gray) {
    var hist = new Array(256), t;
    for (t = 0; t < 256; t++) hist[t] = 0;
    for (var i = 0; i < gray.length; i++) hist[gray[i]]++;
    var total = gray.length, sum = 0;
    for (t = 0; t < 256; t++) sum += t * hist[t];
    var sumB = 0, wB = 0, maxVar = 0, thr = 127;
    for (t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue;
      var wF = total - wB; if (!wF) break;
      sumB += t * hist[t];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var v = wB * wF * (mB - mF) * (mB - mF);
      if (v > maxVar) { maxVar = v; thr = t; }
    }
    return thr;
  }

  function binarize(imageData, fixedThr) {
    var g = toGray(imageData), w = imageData.width, h = imageData.height;
    var thr = fixedThr || otsu(g);
    var bin = new Uint8Array(w * h); // ink(黒)=1, 紙(白)=0
    for (var i = 0; i < g.length; i++) bin[i] = g[i] < thr ? 1 : 0;
    return { bin: bin, w: w, h: h, thresh: thr };
  }

  // ある行の「最長の黒連続（小さな隙間は許容）」を返す。五線本体の x 範囲取得に使う。
  function longestRun(bin, w, y, gapTol) {
    var best = 0, bestStart = 0, runStart = -1, lastInk = -1e9;
    for (var x = 0; x < w; x++) {
      if (bin[y * w + x]) {
        if (runStart < 0 || x - lastInk > gapTol) runStart = x;
        lastInk = x;
        var len = lastInk - runStart + 1;
        if (len > best) { best = len; bestStart = runStart; }
      }
    }
    return { start: bestStart, end: bestStart + best, len: best };
  }

  // ---- 五線検出（水平投影） ----------------------------------------------
  // 各行の黒画素数を数え、幅広く黒が続く行＝五線とみなす。
  // 連続する五線行をまとめて中心を取り、等間隔な線群を「段」に分ける。
  function detectStaves(bin, w, h) {
    var rows = new Int32Array(h), y, x;
    for (y = 0; y < h; y++) {
      var base = y * w, c = 0;
      for (x = 0; x < w; x++) c += bin[base + x];
      rows[y] = c;
    }
    var maxRow = 0;
    for (y = 0; y < h; y++) if (rows[y] > maxRow) maxRow = rows[y];
    if (maxRow < w * 0.2) return []; // 五線らしい長い線が無い
    var thr = Math.max(w * 0.3, maxRow * 0.5);

    // 連続する線行 → 線中心（重み付き平均）
    var lines = [];
    y = 0;
    while (y < h) {
      if (rows[y] >= thr) {
        var sw = 0, swy = 0;
        while (y < h && rows[y] >= thr) { sw += rows[y]; swy += rows[y] * y; y++; }
        lines.push(swy / sw);
      } else y++;
    }
    if (lines.length < 5) return [];

    // 線間隔の代表値（中央値）
    var gaps = [];
    for (var i = 1; i < lines.length; i++) gaps.push(lines[i] - lines[i - 1]);
    var sg = gaps.slice().sort(function (a, b) { return a - b; });
    var space = sg[Math.floor(sg.length / 2)] || 10;

    // 間隔が space に近い連続線を1段にまとめる（大きく空いたら段の切れ目）
    var groups = [], group = [lines[0]];
    for (i = 1; i < lines.length; i++) {
      if (lines[i] - lines[i - 1] <= space * 1.7) group.push(lines[i]);
      else { groups.push(group); group = [lines[i]]; }
    }
    groups.push(group);

    var out = [];
    groups.forEach(function (g) {
      if (g.length >= 4 && g.length <= 6) { // 五線（多少の欠け/余りは許容）
        var top = g[0], bot = g[g.length - 1];
        var midRow = Math.round(g[Math.floor(g.length / 2)]);
        var run = longestRun(bin, w, midRow, 3); // 五線本体の x 範囲（ブレース等を除いた実線）
        out.push({ topY: top, bottomY: bot, spacing: (bot - top) / (g.length - 1),
                   lines: g.slice(), xStart: run.start, xEnd: run.end });
      }
    });
    return out; // y昇順（上→下）
  }

  // ---- 符頭検出（積分画像 + 矩形フィル率） -------------------------------
  function buildIntegral(bin, w, h) {
    var w1 = w + 1, I = new Int32Array(w1 * (h + 1));
    for (var y = 0; y < h; y++) {
      var rs = 0;
      for (var x = 0; x < w; x++) {
        rs += bin[y * w + x];
        I[(y + 1) * w1 + (x + 1)] = I[y * w1 + (x + 1)] + rs;
      }
    }
    return I;
  }
  function rectSum(I, w1, x0, y0, x1, y1) { // [x0,x1) x [y0,y1)
    return I[y1 * w1 + x1] - I[y0 * w1 + x1] - I[y1 * w1 + x0] + I[y0 * w1 + x0];
  }

  /**
   * 符頭候補を検出する。塗り(filled)と白抜き(hollow)の両方を狙う。
   * 誤検出（音部記号・ブレース・拍子・連桁・テンポ表記）を減らすため：
   *  (1) 各段の左端（音部記号＋調号＋拍子）区画をスキップ、
   *  (2) 左右が白い＝横に孤立していること（符頭の特徴）を要求。
   * @returns {Array<{x,y,filled,score}>}（画像px座標, y中心）
   */
  function detectNoteheads(bin, w, h, staves, opts) {
    if (!staves.length) return [];
    var ksN = Math.abs((opts && opts.keySig) || 0); // 調号の♯/♭の数 → 左スキップ幅に反映
    var I = buildIntegral(bin, w, h), w1 = w + 1;
    var spaces = staves.map(function (s) { return s.spacing; }).sort(function (a, b) { return a - b; });
    var medSpace = spaces[Math.floor(spaces.length / 2)] || 10;

    function fillRatio(x0, y0, x1, y1) {
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w, x1); y1 = Math.min(h, y1);
      if (x1 <= x0 || y1 <= y0) return 0;
      return rectSum(I, w1, x0, y0, x1, y1) / ((x1 - x0) * (y1 - y0));
    }

    // 譜面全体の上端・下端の段（タイトルや作曲者名・ページ番号がある余白側）を把握。
    var gTop = Math.min.apply(null, staves.map(function (s) { return s.topY; }));
    var gBot = Math.max.apply(null, staves.map(function (s) { return s.bottomY; }));

    var cand = [];
    staves.forEach(function (st) {
      var space = st.spacing;
      var hw = Math.max(2, Math.round(space * 0.60)); // 符頭 半幅
      var hh = Math.max(2, Math.round(space * 0.48)); // 符頭 半高
      var ihw = Math.max(1, Math.round(hw * 0.5));
      var ihh = Math.max(1, Math.round(hh * 0.5));
      var lb = Math.max(2, Math.round(space * 0.55)); // 左右の孤立チェック幅
      // 左端の記号区画（音部記号＋調号）をスキップ。幅は調号の♯/♭の数に比例させる
      // （多い調ほど右まで記号が続く）。拍子記号は第1段の最初だけなので、ここでは含めず
      // 後続の段の最初の音を巻き込まない。第1段の拍子記号は「消しゴム」で消せる。
      var xMin = (st.xStart || 0) + Math.round(space * (4.0 + ksN * 0.85));
      var xMax = (st.xEnd || w) - 2;
      // 加線ぶん上下に拡張。段の内側は加線 4本ぶん、譜面の最上段の「上」と最下段の「下」は
      // タイトル/作曲者名/テンポ表記/ページ番号が来るので 3本弱に狭める（実音 D6/E6 は届く）。
      var upMul = (st.topY <= gTop + 1) ? 3 : 4;
      var dnMul = (st.bottomY >= gBot - 1) ? 3 : 4;
      var yTop = Math.max(hh + 1, Math.round(st.topY - space * upMul));
      var yBot = Math.min(h - hh - 2, Math.round(st.bottomY + space * dnMul));
      for (var y = yTop; y <= yBot; y += 2) {
        for (var x = Math.max(hw + 1, xMin); x < Math.min(w - hw - 1, xMax); x += 2) {
          var fo = fillRatio(x - hw, y - hh, x + hw, y + hh);
          if (fo < 0.34) continue; // インクが少なすぎ
          var fi = fillRatio(x - ihw, y - ihh, x + ihw, y + ihh);
          var filled = fo > 0.62 && fi > 0.72;               // 中まで詰まっている
          var hollow = fo >= 0.34 && fo <= 0.62 && fi < 0.45; // 縁だけ黒・中は白
          if (hollow) {
            // 本物の白抜きはリングの上弧・下弧が箱の上帯・下帯に必ず入る。
            // 塗り和音の上下の縁（片側だけインク）はここで落ちる。
            // 積み重なった和音は隣の符頭がインクを足す方向なので誤って落ちない。
            var bt = Math.max(2, Math.round(hh * 0.6));
            var topF = fillRatio(x - hw, y - hh, x + hw, y - hh + bt);
            var botF = fillRatio(x - hw, y + hh - bt, x + hw, y + hh);
            if (topF < 0.18 || botF < 0.18) hollow = false;
          }
          if (!(filled || hollow)) continue;
          // 横の孤立性：符頭は左右が白い（茎は細いので帯平均では低く出る）。
          // 音部記号・連桁・拍子・テンポ表記はここで落ちる。
          var leftF = fillRatio(x - hw - lb, y - hh, x - hw, y + hh);
          var rightF = fillRatio(x + hw, y - hh, x + hw + lb, y + hh);
          if (leftF > 0.5 && rightF > 0.5) continue; // 両側に地続きのインク → 符頭でない
          // 符頭は必ず「線上」か「間」＝半空間グリッドに乗る。ここで y を量子化して
          // おくと、積み重なった3度（インクが繋がり柱になる）でも NMS が
          // グリッド刻みで正しい位置を拾える（柱の上から機械的に拾うズレを防ぐ）。
          var half = space / 2;
          var yq = Math.round(st.bottomY - Math.round((st.bottomY - y) / half) * half);
          // 量子化先にも符頭相当のインクが実在すること（線と符頭の隙間の候補が
          // 隣のグリッドへ飛んで NMS を逃れるのを防ぐ）
          var foQ = fillRatio(x - hw, yq - hh, x + hw, yq + hh);
          if (foQ < 0.34) continue;
          cand.push({ x: x, y: yq, filled: filled, score: fo });
        }
      }
    });

    // 非最大抑制（重複除去）。楕円状にして「横に広い」符頭の二重検出を潰す。
    // 縦は狭くして、積み重なるコード構成音（最短で3度＝約1空間）は残す。
    //   横 ax≈1.0空間 … 同一符頭の左右で二重に出るのを1つに
    //   縦 ay≈0.6空間 … 3度(≈1空間)以上離れた和音の音は別物として残す
    cand.sort(function (a, b) { return b.score - a.score; });
    var kept = [];
    var ax2 = Math.pow(medSpace * 1.0, 2), ay2 = Math.pow(medSpace * 0.75, 2);
    // 矩形条件：符頭1個ぶんの箱（横0.78・縦0.85空間）に重なる弱い候補は
    // 同じ符頭（＋茎の付け根）の縁のにじみとみなして吸収。
    // 3度（縦=1空間）も横並びの2度（横≈1.1空間）もこの箱の外なので消えない。
    var rx = medSpace * 0.78, ry = medSpace * 0.85;
    cand.forEach(function (c) {
      for (var k = 0; k < kept.length; k++) {
        var dx = c.x - kept[k].x, dy = c.y - kept[k].y;
        if ((dx * dx) / ax2 + (dy * dy) / ay2 < 1) return;
        if (Math.abs(dx) < rx && Math.abs(dy) < ry) return;
      }
      kept.push(c);
    });

    // x をインク重心へスナップ（走査2px刻みの粗さを補正。y は半空間グリッドに
    // 量子化済みなので触らない）。寄った結果の重複をもう一度統合する。
    var hw2 = Math.max(2, Math.round(medSpace * 0.62));
    var hh2 = Math.max(2, Math.round(medSpace * 0.48));
    var refined = kept.map(function (c) {
      var sx = 0, n = 0;
      for (var yy = Math.max(0, c.y - hh2); yy <= Math.min(h - 1, c.y + hh2); yy++)
        for (var xx = Math.max(0, c.x - hw2); xx <= Math.min(w - 1, c.x + hw2); xx++)
          if (bin[yy * w + xx]) { sx += xx; n++; }
      return n ? { x: Math.round(sx / n), y: c.y, filled: c.filled, score: c.score } : c;
    });
    var out = [];
    refined.forEach(function (c) {
      for (var k = 0; k < out.length; k++) {
        var dx = c.x - out[k].x, dy = c.y - out[k].y;
        if (Math.abs(dx) < rx && Math.abs(dy) < ry) return;
      }
      out.push(c);
    });
    return out;
  }

  // ---- 小節線検出（縦投影） ----------------------------------------------
  // 小節線＝五線の上端〜下端をほぼ埋める縦の実線。各段ごとに x 位置を返す。
  // 音符の「茎(stem)」も縦線だが、茎は上端か下端の片側で途切れる。
  // そこで「上端付近と下端付近の両方にインクがある」列だけを小節線とみなす。
  function detectBarlines(bin, w, h, staves) {
    return staves.map(function (st) {
      var y0 = Math.max(0, Math.round(st.topY));
      var y1 = Math.min(h - 1, Math.round(st.bottomY));
      var height = y1 - y0 + 1;
      if (height < 4) return [];
      var need = height * 0.85;                 // 縦にほぼ埋まっている
      var edge = Math.max(1, Math.round(height * 0.12)); // 上下端の判定帯
      var xs = (st.xStart || 0), xe = (st.xEnd || w);
      var xMin = xs + Math.round((st.spacing || 8) * 5.5); // 左端の記号帯を避ける
      var cols = [];
      for (var x = xMin; x < xe; x++) {
        var c = 0, topInk = false, botInk = false;
        for (var y = y0; y <= y1; y++) {
          if (bin[y * w + x]) {
            c++;
            if (y <= y0 + edge) topInk = true;
            if (y >= y1 - edge) botInk = true;
          }
        }
        if (c >= need && topInk && botInk) cols.push(x);
      }
      // 隣接列（線幅ぶん）を1本にまとめる
      var lines = [], run = [];
      for (var i = 0; i < cols.length; i++) {
        if (run.length === 0 || cols[i] - run[run.length - 1] <= 2) run.push(cols[i]);
        else { lines.push(mid(run)); run = [cols[i]]; }
      }
      if (run.length) lines.push(mid(run));
      return lines;
    });
    function mid(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return Math.round(s / arr.length); }
  }

  // ---- 一括解析 ----------------------------------------------------------
  function analyze(imageData, opts) {
    var b = binarize(imageData);
    var staves = detectStaves(b.bin, b.w, b.h);
    if (!staves.length) {
      // 動画キャプチャ等では五線が圧縮で薄いグレーになり、Otsu のしきい値
      //（濃い音符と白背景の間）では背景側に落ちて消えることがある。
      // 「ほぼ白でなければインク」の緩い2値化でもう一度だけ試す。
      var b2 = binarize(imageData, 230);
      var staves2 = detectStaves(b2.bin, b2.w, b2.h);
      if (staves2.length) { b = b2; staves = staves2; }
    }
    var noteheads = detectNoteheads(b.bin, b.w, b.h, staves, opts);
    var barlines = detectBarlines(b.bin, b.w, b.h, staves);
    return { staves: staves, noteheads: noteheads, barlines: barlines, w: b.w, h: b.h, thresh: b.thresh };
  }

  var api = {
    binarize: binarize,
    otsu: otsu,
    detectStaves: detectStaves,
    detectNoteheads: detectNoteheads,
    detectBarlines: detectBarlines,
    analyze: analyze
  };
  global.MusicCV = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
