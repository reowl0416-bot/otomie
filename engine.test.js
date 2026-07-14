/*
 * engine.test.js — engine.js の自動テスト（Node, 依存なし）
 * 実行: node engine.test.js
 *
 * 指導用途では誤った音名を出さないことが最優先(SPEC 1/4/6)なので、
 * 音名・コードの純ロジックをここで担保する。
 */
// Node では require、JXA/ブラウザでは事前に読み込まれた MusicEngine を使う
var E = (typeof require !== 'undefined') ? require('./engine.js') : MusicEngine;

var passed = 0, failed = 0;
var cerr = (typeof console !== 'undefined' && console.error)
  ? function (s) { console.error(s); }
  : function (s) { console.log(s); };
function eq(actual, expected, msg) {
  var a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; }
  else { failed++; cerr('  x ' + msg + '\n     expected: ' + b + '\n     actual:   ' + a); }
}

// ---- 音名: 素の五線位置 (C major) ------------------------------------
// トレブル最下線から上へ: E4(0) F4(1) G4(2) A4(3) B4(4) C5(5) D5(6) E5(7) F5(8)
eq(E.resolveNote({ clef: 'treble', staffStep: 0 }).name, 'E4', 'treble bottom line = E4');
eq(E.resolveNote({ clef: 'treble', staffStep: 1 }).name, 'F4', 'treble step1 = F4');
eq(E.resolveNote({ clef: 'treble', staffStep: 2 }).name, 'G4', 'treble step2 = G4');
eq(E.resolveNote({ clef: 'treble', staffStep: 3 }).name, 'A4', 'treble step3 = A4');
eq(E.resolveNote({ clef: 'treble', staffStep: 4 }).name, 'B4', 'treble step4 = B4');
eq(E.resolveNote({ clef: 'treble', staffStep: 5 }).name, 'C5', 'treble step5 = C5');
eq(E.resolveNote({ clef: 'treble', staffStep: 8 }).name, 'F5', 'treble top line = F5');
// 真ん中のC: トレブルでは1本下の加線 (staffStep=-2)
eq(E.resolveNote({ clef: 'treble', staffStep: -2 }).name, 'C4', 'middle C on treble (ledger below) = C4');
// バス最下線 = G2、真ん中のCはバスの1本上の加線 (staffStep=10)
eq(E.resolveNote({ clef: 'bass', staffStep: 0 }).name, 'G2', 'bass bottom line = G2');
eq(E.resolveNote({ clef: 'bass', staffStep: 10 }).name, 'C4', 'middle C on bass (ledger above) = C4');

// ---- MIDI / オクターブ定義 -------------------------------------------
eq(E.resolveNote({ clef: 'treble', staffStep: -2 }).midi, 60, 'C4 midi = 60');
eq(E.resolveNote({ clef: 'treble', staffStep: 3 }).midi, 69, 'A4 midi = 69');

// ---- 調号: シャープ調 -------------------------------------------------
// ト長調(♯1): F5(step8) が F#5
eq(E.resolveNote({ clef: 'treble', staffStep: 8, keySig: 1 }).name, 'F#5', 'G major: F5 -> F#5');
// ニ長調(♯2): F#5, C#6(step12)
eq(E.resolveNote({ clef: 'treble', staffStep: 8, keySig: 2 }).name, 'F#5', 'D major: F#5');
eq(E.resolveNote({ clef: 'treble', staffStep: 12, keySig: 2 }).name, 'C#6', 'D major: C6 -> C#6');
// G4(step2) は変わらない
eq(E.resolveNote({ clef: 'treble', staffStep: 2, keySig: 2 }).name, 'G4', 'D major: G stays natural');

// ---- 調号: フラット調 ------------------------------------------------
// ヘ長調(♭1): B4(step4) が B♭4、C5(step5) は不変、G4(step2) は不変
eq(E.resolveNote({ clef: 'treble', staffStep: 4, keySig: -1 }).name, 'B♭4', 'F major: B4 -> B♭4');
eq(E.resolveNote({ clef: 'treble', staffStep: 5, keySig: -1 }).name, 'C5', 'F major: C unaffected');
eq(E.resolveNote({ clef: 'treble', staffStep: 2, keySig: -1 }).accidental, 0, 'F major: G unaffected');

// ---- 臨時記号の上書き ------------------------------------------------
// ニ長調でも、明示のナチュラルが付けば F ナチュラル
eq(E.resolveNote({ clef: 'treble', staffStep: 8, keySig: 2, accidental: 0 }).name, 'F5', 'explicit natural overrides key sig');
// ハ長調で明示のシャープ
eq(E.resolveNote({ clef: 'treble', staffStep: 8, accidental: 1 }).name, 'F#5', 'explicit sharp');

// ---- コード: 基本三和音 ----------------------------------------------
function chord(names) {
  // names 例: ['C4','E4','G4'] を midi+letter付きに変換
  return names.map(function (nm) {
    var m = nm.match(/^([A-G])([#♭]*)(-?\d+)$/);
    var letter = m[1];
    var accStr = m[2];
    var acc = 0;
    if (accStr) { acc = accStr[0] === '#' ? accStr.length : -accStr.length; }
    var LS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    var oct = parseInt(m[3], 10);
    var midi = (oct + 1) * 12 + LS[letter] + acc;
    return { midi: midi, letter: letter, accidental: acc, name: nm };
  });
}
eq(E.identifyChord(chord(['C4', 'E4', 'G4'])).best.name, 'C', 'C E G = C');
eq(E.identifyChord(chord(['A3', 'C4', 'E4'])).best.name, 'Am', 'A C E = Am');
eq(E.identifyChord(chord(['C4', 'E4', 'G4', 'B4'])).best.name, 'Cmaj7', 'C E G B = Cmaj7');
eq(E.identifyChord(chord(['G3', 'B3', 'D4', 'F4'])).best.name, 'G7', 'G B D F = G7');
eq(E.identifyChord(chord(['D4', 'F4', 'A4', 'C5'])).best.name, 'Dm7', 'D F A C = Dm7');
eq(E.identifyChord(chord(['B3', 'D4', 'F4', 'A4'])).best.name, 'Bm7' + '♭' + '5', 'B D F A = Bm7♭5');
eq(E.identifyChord(chord(['C4', 'E4', 'G4', 'A4'])).best.name, 'C6', 'C E G A = C6');
eq(E.identifyChord(chord(['C4', 'D4', 'E4', 'G4'])).best.name, 'Cadd9', 'C D E G = Cadd9');

// ---- コード: 分数 / オンベース ---------------------------------------
eq(E.identifyChord(chord(['E3', 'G4', 'C5'])).best.name, 'C/E', 'bass E, C major -> C/E');

// ---- コード: 単音/空は候補なし ---------------------------------------
eq(E.identifyChord(chord(['C4', 'E4'])).candidates.length, 0, 'dyad -> no chord (MVP)');
eq(E.identifyChord([]).candidates.length, 0, 'empty -> no chord');

// ---- 解説エンジン ----------------------------------------------------
function explainText(best, opts) {
  return E.explainChord(best, opts).map(function (s) { return s.head + ':' + s.body; }).join(' | ');
}
// 響きの説明は常に返る
eq(E.explainChord({ root: 'C', quality: '' }).length >= 1, true, 'explain returns at least the 響き section');
// C長調で G7 は V（ドミナント）
eq(/\bV\b/.test(explainText({ root: 'G', quality: '7' }, { keySig: 0 })), true, 'G7 in C major = V (dominant)');
// C長調で Am7 は vi（小文字）
eq(/vi/.test(explainText({ root: 'A', quality: 'm7' }, { keySig: 0 })), true, 'Am7 in C major = vi');
// オンベース(分数)ならベースの説明が入る
eq(/ベース/.test(explainText({ root: 'C', quality: '', bass: 'E' }, { keySig: 0 })), true, 'slash chord mentions bass');
// メロディ最高音の説明（notes与えたとき）
eq(/メロディ/.test(explainText({ root: 'C', quality: '' },
  { keySig: 0, notes: [{ midi: 60, name: 'C4', pitchClass: 0 }, { midi: 67, name: 'G4', pitchClass: 7 }] })),
  true, 'melody top note section appears');
// 調号なしなら「調内の位置」は出さない（誤った断定を避ける）
eq(/調内の位置/.test(explainText({ root: 'C', quality: '' })), false, 'no key => no scale-degree claim');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (typeof process !== 'undefined' && process.exit) process.exit(failed ? 1 : 0);
