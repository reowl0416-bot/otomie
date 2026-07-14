/*
 * engine.js — 音楽理論エンジン（純ロジック / UI非依存）
 *
 * SPEC.md 第4章(音名) / 第5章(コード) の実装。
 * ブラウザでは window.MusicEngine、Node では module.exports として公開する。
 * （classic script として index.html から読めるようにモジュール構文は使わない）
 *
 * 設計の芯:
 *  - 五線上の垂直位置(staffStep)が「音の文字(C..B)」を一意に決める。
 *    → F# と G♭ の区別は、位置が決める文字＋調号/臨時記号の変化記号で自然に決まる
 *      (SPEC 4.3「調号・臨時記号に従う」)。
 *  - 真ん中のC = C4（科学的音高表記, MIDI 60）。
 */
(function (global) {
  'use strict';

  // ---- 基本テーブル ------------------------------------------------------
  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  // 各文字の基準セミトーン（Cを0とする）
  var LETTER_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // 調号の並び
  var SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  var FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

  // 変化記号の表示（SPEC例: F#4, B♭3 に合わせる）
  var SHARP = '#';
  var FLAT = '♭';
  var NATURAL = '♮';

  // 音部記号ごとの「staffStep=0（最下線）」の diatonicNumber
  //   diatonicNumber = octave*7 + letterIndex(C=0..B=6)
  //   treble 最下線 = E4 = 4*7+2 = 30
  //   bass   最下線 = G2 = 2*7+4 = 18
  var CLEF_BASE = { treble: 30, bass: 18 };

  // ---- ユーティリティ ----------------------------------------------------
  function mod(n, m) { return ((n % m) + m) % m; }

  function accidentalSymbol(offset) {
    if (offset === 0) return '';
    if (offset === 1) return SHARP;
    if (offset === -1) return FLAT;
    if (offset === 2) return SHARP + SHARP;
    if (offset === -2) return FLAT + FLAT;
    return '';
  }

  /**
   * 調号(keySig: 正=シャープ数, 負=フラット数)が、ある文字に与える変化量を返す。
   * 例: keySig=1(ト長調) では F -> +1、他は 0。
   */
  function keySigOffset(letter, keySig) {
    if (!keySig) return 0;
    if (keySig > 0) {
      return SHARP_ORDER.slice(0, keySig).indexOf(letter) >= 0 ? 1 : 0;
    }
    return FLAT_ORDER.slice(0, -keySig).indexOf(letter) >= 0 ? -1 : 0;
  }

  /**
   * 五線位置 -> 文字・オクターブ
   * @param {'treble'|'bass'} clef
   * @param {number} staffStep 最下線=0、1つ上の間/線ごとに+1（加線は範囲外の整数）
   */
  function letterOctaveFromStaff(clef, staffStep) {
    var base = CLEF_BASE[clef];
    if (base === undefined) throw new Error('unknown clef: ' + clef);
    var dn = base + staffStep;
    var letterIndex = mod(dn, 7);
    var octave = Math.floor(dn / 7);
    return { letter: LETTERS[letterIndex], octave: octave, diatonicNumber: dn };
  }

  /**
   * 音符1つを解決する。
   * @param {object} spec
   *   - clef: 'treble' | 'bass'
   *   - staffStep: number（最下線=0）
   *   - keySig: number（正=♯数, 負=♭数）省略時0
   *   - accidental: number|null（その音に明示された臨時記号 -2..+2。null/undefined=なし）
   * @returns {object} { letter, octave, accidental(offset), name, pitchClass, midi }
   */
  function resolveNote(spec) {
    var lo = letterOctaveFromStaff(spec.clef, spec.staffStep);
    var keySig = spec.keySig || 0;
    // 明示の臨時記号が最優先。なければ調号の効果。
    var offset = (spec.accidental === undefined || spec.accidental === null)
      ? keySigOffset(lo.letter, keySig)
      : spec.accidental;
    var semitone = LETTER_SEMITONE[lo.letter] + offset;
    var midi = (lo.octave + 1) * 12 + semitone;
    var pitchClass = mod(semitone, 12);
    return {
      letter: lo.letter,
      octave: lo.octave,
      accidental: offset,
      name: lo.letter + accidentalSymbol(offset) + lo.octave,
      pitchClass: pitchClass,
      midi: midi
    };
  }

  // pc -> 既定表記（文脈が無い場合のフォールバック。シャープ優先）
  var PC_DEFAULT = ['C', 'C' + SHARP, 'D', 'D' + SHARP, 'E', 'F',
                    'F' + SHARP, 'G', 'G' + SHARP, 'A', 'A' + SHARP, 'B'];

  function pcNameDefault(pc) { return PC_DEFAULT[mod(pc, 12)]; }

  // ---- コードエンジン ----------------------------------------------------
  // 各テンプレート: intervals=ルートからのセミトーン, suffix=表記, prio=優先度(小さいほど優先)
  var CHORD_TEMPLATES = [
    { suffix: '',      intervals: [0, 4, 7],        prio: 1 },  // major
    { suffix: 'm',     intervals: [0, 3, 7],        prio: 1 },  // minor
    { suffix: 'dim',   intervals: [0, 3, 6],        prio: 3 },  // diminished
    { suffix: 'aug',   intervals: [0, 4, 8],        prio: 3 },  // augmented
    { suffix: 'sus2',  intervals: [0, 2, 7],        prio: 4 },
    { suffix: 'sus4',  intervals: [0, 5, 7],        prio: 4 },
    { suffix: '6',     intervals: [0, 4, 7, 9],     prio: 2 },
    { suffix: 'm6',    intervals: [0, 3, 7, 9],     prio: 2 },
    { suffix: 'maj7',  intervals: [0, 4, 7, 11],    prio: 1 },
    { suffix: '7',     intervals: [0, 4, 7, 10],    prio: 1 },
    { suffix: 'm7',    intervals: [0, 3, 7, 10],    prio: 1 },
    { suffix: 'mMaj7', intervals: [0, 3, 7, 11],    prio: 4 },
    { suffix: 'm7' + FLAT + '5', intervals: [0, 3, 6, 10], prio: 2 },
    { suffix: 'dim7',  intervals: [0, 3, 6, 9],     prio: 3 },
    { suffix: '7sus4', intervals: [0, 5, 7, 10],    prio: 4 },
    { suffix: 'add9',  intervals: [0, 2, 4, 7],     prio: 3 },
    { suffix: 'madd9', intervals: [0, 2, 3, 7],     prio: 4 },
    { suffix: 'maj9',  intervals: [0, 2, 4, 7, 11], prio: 3 },
    { suffix: '9',     intervals: [0, 2, 4, 7, 10], prio: 3 },
    { suffix: 'm9',    intervals: [0, 2, 3, 7, 10], prio: 3 }
  ];

  /**
   * 音の集合からコード名を推定する（SPEC 5.2 / 5.3）。
   * @param {Array} notes  各要素は {midi, letter?, accidental?, name?} か、数値(midi)
   * @param {object} [opts] { maxCandidates=3, minScore=0 }
   * @returns {object} { candidates: [{name, root, quality, bass, score, exact}], best }
   *   notes が空/単音なら candidates=[]。
   */
  function identifyChord(notes, opts) {
    opts = opts || {};
    var maxCandidates = opts.maxCandidates || 3;

    // 正規化
    var arr = (notes || []).map(function (n) {
      if (typeof n === 'number') return { midi: n, pc: mod(n, 12) };
      return { midi: n.midi, pc: mod(n.midi, 12), letter: n.letter, name: n.name, accidental: n.accidental };
    }).filter(function (n) { return typeof n.midi === 'number' && !isNaN(n.midi); });

    if (arr.length < 3) return { candidates: [], best: null };

    // pc集合と、pc -> 表記（実際の音符の綴りを優先）
    var present = {};       // pc -> true
    var pcSpelling = {};    // pc -> 表示名(オクターブ無し)
    var lowest = arr[0];
    arr.forEach(function (n) {
      present[n.pc] = true;
      if (pcSpelling[n.pc] === undefined) {
        pcSpelling[n.pc] = spellPc(n);
      }
      if (n.midi < lowest.midi) lowest = n;
    });
    var presentList = Object.keys(present).map(Number);
    var bassPc = lowest.pc;

    function spelledName(pc) {
      return pcSpelling[pc] !== undefined ? pcSpelling[pc] : pcNameDefault(pc);
    }

    var candidates = [];
    // ルート候補は「集合内に存在するpc」（ルートレス表記はMVPでは扱わない）
    presentList.forEach(function (root) {
      CHORD_TEMPLATES.forEach(function (t) {
        var templatePcs = t.intervals.map(function (i) { return mod(root + i, 12); });
        var matched = 0;
        templatePcs.forEach(function (pc) { if (present[pc]) matched++; });
        var missing = templatePcs.length - matched;
        var extra = presentList.length - matched; // 集合内でテンプレに無い音
        // ルートが鳴っていること・三和音以上一致を要求
        if (!present[root] || matched < 3) return;
        var exact = (missing === 0 && extra === 0);
        var rootIsBass = (root === bassPc);
        // スコア: 一致を加点、欠け/余分を減点、単純なコードを僅かに優先。
        // 同じ音集合に複数解釈がある場合、ルート=最低音(基本形)を優先し不要な分数表記を避ける。
        var score = matched - 1.6 * missing - 0.8 * extra - 0.05 * t.prio
                  + (exact ? 0.5 : 0) + (rootIsBass ? 0.3 : 0);
        var rootName = spelledName(root);
        var name = rootName + t.suffix;
        if (bassPc !== root) name += '/' + spelledName(bassPc);
        candidates.push({
          name: name,
          root: rootName,
          quality: t.suffix,
          bass: bassPc !== root ? spelledName(bassPc) : null,
          score: Math.round(score * 1000) / 1000,
          exact: exact
        });
      });
    });

    candidates.sort(function (a, b) { return b.score - a.score; });
    // 同名の重複を除去
    var seen = {};
    candidates = candidates.filter(function (c) {
      if (seen[c.name]) return false;
      seen[c.name] = true;
      return true;
    });
    candidates = candidates.slice(0, maxCandidates);
    return { candidates: candidates, best: candidates[0] || null };
  }

  // 音符オブジェクトからオクターブ無しの綴りを得る
  function spellPc(n) {
    if (n.letter) {
      var off = (n.accidental === undefined || n.accidental === null) ? 0 : n.accidental;
      return n.letter + accidentalSymbol(off);
    }
    if (n.name) {
      // 末尾のオクターブ数字を除去
      return String(n.name).replace(/-?\d+$/, '');
    }
    return pcNameDefault(n.pc);
  }

  // ---- 解説エンジン（指導用・ルールベース） ------------------------------
  // 外部AI/送信を使わず、確定情報から「響きの印象」「調内の役割」等を組み立てる。
  // 誤情報を出さないため、断定は理論的に確実な範囲にとどめる。
  var QUALITY_DESC = {
    '':      { name: 'メジャー',                  impr: '明るく安定した響き。曲の芯になる基本の和音。' },
    'm':     { name: 'マイナー',                  impr: '暗め・落ち着いた、少し切ない響き。' },
    'maj7':  { name: 'メジャー・セブンス',        impr: '洗練された浮遊感のある明るさ。叙情的でおしゃれ。' },
    '7':     { name: 'ドミナント・セブンス',      impr: '次へ進みたくなる緊張感。ブルージーにも響く。' },
    'm7':    { name: 'マイナー・セブンス',        impr: '柔らかく角の取れた、ジャジーで落ち着いた響き。' },
    'm7♭5':  { name: 'ハーフ・ディミニッシュ',    impr: '翳りのある不安定な響き。次への橋渡しに使われる。' },
    'dim7':  { name: 'ディミニッシュ・セブンス',  impr: '強い緊張。経過的に使い、すぐ解決したくなる。' },
    'dim':   { name: 'ディミニッシュ',            impr: '不安定で張り詰めた響き。' },
    'aug':   { name: 'オーギュメント',            impr: 'ふわっと浮く不思議な不安定さ。' },
    '6':     { name: 'シックスス',                impr: '明るく懐かしい、ポップで柔らかな安定感。' },
    'm6':    { name: 'マイナー・シックスス',      impr: 'ほろ苦く洒落た響き。' },
    'sus2':  { name: 'サストゥー',                impr: '開放的で透明、風通しのよい響き。' },
    'sus4':  { name: 'サスフォー',                impr: '宙づりの未解決感。透明で、解決を期待させる。' },
    '7sus4': { name: 'セブンス・サスフォー',      impr: '推進力と未解決感の同居。ポップスで多用。' },
    'add9':  { name: 'アドナイン',                impr: '透明感ときらめきが加わった、広がりのある響き。' },
    'madd9': { name: 'マイナー・アドナイン',      impr: '翳りに透明な広がりが差す響き。' },
    '9':     { name: 'ナインス',                  impr: '色彩感のある、豊かで広がる響き。' },
    'maj9':  { name: 'メジャー・ナインス',        impr: '洗練と透明感、浮遊するような美しさ。静かで叙情的な曲で映える。' },
    'm9':    { name: 'マイナー・ナインス',        impr: '翳りと広がりが同居する、しっとりした響き。' }
  };

  // 綴り(例 'B♭','F#')→ pitchClass
  function letterAccPc(str) {
    if (!str) return null;
    var letter = str.charAt(0);
    if (LETTER_SEMITONE[letter] === undefined) return null;
    var acc = 0;
    for (var i = 1; i < str.length; i++) {
      var c = str.charAt(i);
      if (c === SHARP || c === '#') acc++;
      else if (c === FLAT || c === 'b') acc--;
    }
    return mod(LETTER_SEMITONE[letter] + acc, 12);
  }

  // 長調トニックからの半音差 → 度数(1..7の文字) / ローマ数字 / 機能
  function degreeOrdinal(off) {
    var map = { 0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7' };
    return map[off] || null;
  }
  function degreeInfo(off) {
    switch (off) {
      case 0:  return { roman: 'I',   func: 'トニック（主和音・安定の中心）' };
      case 2:  return { roman: 'II',  func: 'サブドミナント寄り（II）' };
      case 4:  return { roman: 'III', func: 'トニック寄り（III）' };
      case 5:  return { roman: 'IV',  func: 'サブドミナント（広がり・出発点）' };
      case 7:  return { roman: 'V',   func: 'ドミナント（緊張し解決を促す）' };
      case 9:  return { roman: 'VI',  func: 'トニック寄り（平行短調の主和音）' };
      case 11: return { roman: 'VII', func: 'ドミナント寄り（不安定）' };
      default: return { roman: null,  func: '調外の音を含む借用/経過的な和音' };
    }
  }

  /**
   * コード＋文脈から、指導用の解説セクション配列を返す。
   * @param {object} best identifyChord().best（{root, quality, bass}）
   * @param {object} [opts] { keySig, notes:[{midi,name,pitchClass}] }
   * @returns {Array<{head:string, body:string}>}
   */
  function explainChord(best, opts) {
    opts = opts || {};
    if (!best) return [];
    var out = [];
    var q = (QUALITY_DESC[best.quality] !== undefined)
      ? QUALITY_DESC[best.quality] : { name: best.quality || '', impr: '' };
    out.push({ head: '響き', body: best.root + (best.quality || '') + '（' + q.name + '）。' + q.impr });

    // 調内での役割（調号が分かる場合のみ）
    if (opts.keySig !== undefined && opts.keySig !== null) {
      var tonic = mod(opts.keySig * 7, 12);
      var rootPc = letterAccPc(best.root);
      if (rootPc !== null) {
        var off = mod(rootPc - tonic, 12);
        var d = degreeInfo(off);
        var keyName = pcNameDefault(tonic);
        var isMinorChord = /^m/.test(best.quality || '') && !/^maj/.test(best.quality || '');
        if (d.roman) {
          var rn = isMinorChord ? d.roman.toLowerCase() : d.roman;
          out.push({ head: '調内の位置',
            body: keyName + '長調では ' + rn + '（第' + degreeOrdinal(off) + '度上）。' + d.func + '。' });
        } else {
          out.push({ head: '調内の位置', body: d.func + '。' });
        }
      }
    }

    // ベース／転回・オンベース
    if (best.bass) {
      out.push({ head: 'ベース',
        body: '最低音が ' + best.bass + '（ルート以外）。ベースが段階的に動いたり、同じ音を保つ（ペダルポイント）ことで、和音に流れや落ち着きが生まれる。' });
    }

    // メロディ最高音
    if (opts.notes && opts.notes.length) {
      var top = opts.notes[0];
      opts.notes.forEach(function (n) { if (n.midi > top.midi) top = n; });
      var body = 'いちばん高い音は ' + (top.name || '') + '。ここが耳に残る「歌」の線になりやすい。';
      if (opts.keySig !== undefined && opts.keySig !== null && top.pitchClass !== undefined) {
        var toff = mod(top.pitchClass - mod(opts.keySig * 7, 12), 12);
        var deg = degreeOrdinal(toff);
        if (deg) body += ' 調の第' + deg + '度にあたる。';
      }
      out.push({ head: 'メロディ', body: body });
    }
    return out;
  }

  // ---- 公開API ----------------------------------------------------------
  var api = {
    // 音名
    resolveNote: resolveNote,
    letterOctaveFromStaff: letterOctaveFromStaff,
    keySigOffset: keySigOffset,
    accidentalSymbol: accidentalSymbol,
    // コード
    identifyChord: identifyChord,
    explainChord: explainChord,
    CHORD_TEMPLATES: CHORD_TEMPLATES,
    // 定数
    CLEF_BASE: CLEF_BASE
  };

  global.MusicEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
