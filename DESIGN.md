---
version: alpha
name: オトミエ（LEDテーマ）
description: >
  純黒(#000)のキャンバスに、LEDアシッドグリーン(#b8ff1f)が「点灯」するハードウェア・インジケーターの
  メタファー（参考: Capsomnia）。アクティブな状態＝LEDが光る。文字は緑がかったオフホワイト(#f2f4ec)。
  アクセントは一色、光（グロー）は意味のある場所（選択中・現在の小節・CTA）にだけ。
colors:
  canvas: "#000000"
  surface: "#050505"
  surface-1: "#0a0a0a"
  surface-2: "#141414"
  surface-3: "#1d1d1d"
  hairline: "#1f1f1f"
  hairline-strong: "#2f2f2f"
  ink: "#f2f4ec"
  ink-subtle: "#a7ad9c"
  ink-tertiary: "#6f7466"
  led: "#b8ff1f"
  led-bright: "#d8ff63"
  led-deep: "#92f21d"
  led-glow: "rgba(184,255,31,0.55)"
  on-led: "#000000"
  danger: "#e5484d"
  success: "#27a644"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Inter', 'Hiragino Sans', sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "1.15"
    letterSpacing: "-0.6px"
  body:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "1.55"
    letterSpacing: "-0.1px"
  button:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "1.2"
    letterSpacing: "-0.1px"
  eyebrow:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: "1.2"
    letterSpacing: "0.6px"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0"
rounded:
  sm: "9px"
  lg: "14px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "14px"
  lg: "16px"
components:
  button:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: "6px 11px"
  button-primary:
    backgroundColor: "{colors.led}"
    textColor: "{colors.on-led}"
  toggle-on:
    backgroundColor: "{colors.led}"
    textColor: "{colors.on-led}"
  button-warn:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
  card:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.lg}"
    padding: "12px 13px"
  hint:
    backgroundColor: "rgba(5,5,5,0.92)"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
  select:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.sm}"
---

# DESIGN.md — オトミエ（LEDテーマ）

Google Labs（Stitch）の [DESIGN.md 仕様](https://github.com/google-labs-code/design.md) 準拠。
視覚言語は [Capsomnia](https://fuji-mak.github.io/Capsomnia/) の「LEDインジケーター」メタファーを参考に、
本アプリ（対面/画面共有のライブ指導・[CLAUDE.md](CLAUDE.md)）向けに再構成した。
実装は `index.html` の `<style>`（CSS変数）がこのトークンを反映する。

## Overview

“純黒の機材に灯るLED”。UIは電源の落ちたハードウェアのように沈み、アクティブな状態だけがLEDグリーンに**点灯**する
（選択中のモード＝点灯、現在の小節＝点灯、CTA＝点灯）。ユーザーは画面共有で「この音は C4」「ここは Am7」と指す。
光は情報。グローは装飾ではなく「今ここが生きている」の合図としてのみ使う。

## Colors

- 背景は純黒の階層：`canvas`(#000) → `surface`(ヘッダー/パネル) → `surface-1`(カード) → `surface-2/3`(コントロール/ホバー)。差は極小、線(`hairline`)で仕切る。
- 文字は緑がかったオフホワイト3段：`ink`(#f2f4ec) / `ink-subtle`(#a7ad9c) / `ink-tertiary`(#6f7466)。無彩色グレーではなくLEDと同族の色味に寄せる。
- アクセントは LED グリーン一色（`led`#b8ff1f / hover `led-bright` / 深み `led-deep`）。**操作可能・選択中・フォーカス・CTA・現在の小節・コード名**に使う。
- 点灯状態は `led-glow` のグロー（box-shadow）を伴う。グローは「状態」の表現であり装飾に撒かない。
- 意味色は `danger`(#e5484d)＝削除/消しゴム のみ追加。
- キャンバス上と右パネルで色の意味を一致（選択音符＝LED、現在の小節＝LED枠、コード＝LED、消しゴム＝赤）。白い譜面上のラベルは暗色チップに載せて可読性を確保。

## Typography

- 単一のシステムフォント（`system-ui`／日本語 `Hiragino Sans`）。外部フォントは読み込まない（オフライン厳守）。
- タイトな負トラッキング：本文 `-0.1px`、表示値 `-0.6px`。太さは 400（本文）/ 500-600（UI）/ 700（点灯ボタン・タイトル）。
- 表示値（音名 `C4`・コード `Am7`）は `display`(28px) で最大。セクション見出しは `eyebrow`(10px・大文字・字間+0.6px)。機械的な値は `mono`。

## Layout

- 4px グリッド（`xxs`4 / `xs`8 / `sm`12 / `md`14 / `lg`16）。密度は高め。
- 3ペイン：ツールバー（役割ごとの箱＋hairline 区切り）／キャンバス（伸縮）／右パネル 300px。モバイルは横スクロール1行ツールバー＋下部パネル。
- CTA は先頭に1つ（自動認識＝LED点灯）。画像を開くは副次。以降は箱で「モード／譜表・調号／密度／レッスン／ズーム」。

## Elevation & Depth

- 通常の影は抑え、面の明度差と hairline で階層を作る。浮くのは overlay 要素（`hint`）だけ。
- **奥行きの主役はグロー**：点灯状態（`.on`/`.primary`/選択）に `0 0 10px var(--led-glow)`。ブランドのLEDドットは4.5sで呼吸（`prefers-reduced-motion` では停止）。
- ホバーは面を1段上げ＋1px浮かせ、`hairline-strong` に締める。

## Shapes

- 角丸：コントロール `sm`9px、カード/箱 `lg`14px、チップ/バッジ `pill`。ハードウェアの筐体らしい、やや丸めの精度感。

## Components

- **Button**：既定は `surface-2`＋hairline。`primary`（LED・黒文字）＝CTA。`warn`（赤アウトライン）＝削除系、`ghost` は低優先。ホバーで1px浮く。
- **Mode / Density トグル**：アクティブ＝LED点灯（黒文字＋グロー）。削除系モード（消す）は**アクティブ時に赤点灯**で危険を明示。
- **Brand LED**：タイトル横の10pxドット。電源ランプとしてゆっくり呼吸する（アプリの生存表示）。
- **Card**：右パネルの単位。`eyebrow` 見出し＋LEDドット。表示値（コード名）はLEDグリーンで特大。
- **Hint**：キャンバス左上の overlay チップ。今のモードの操作を1行、`ink-subtle` で静かに。
- **Select / Input**：暗い面、フォーカスは LED のアウトライン（2px, offset 2px）。
- **Dropzone（空状態）**：中央の導線。アイコン背後に radial のLEDグローを敷く。CTAはLED。

## Do's and Don'ts

- **Do** LEDは「点灯＝アクティブ」の意味でだけ光らせる。**Don't** グローを装飾で撒かない。
- **Do** 純黒＋hairline で階層を作る。**Don't** LED以外の色を増やして賑やかにしない（例外は削除の赤のみ）。
- **Do** 白い譜面上のラベルは暗色チップに載せる。**Don't** LEDグリーンの文字を白地に直置きしない（読めない）。
- **Do** `prefers-reduced-motion` でアニメーションを止める。**Don't** 常時動く要素を増やさない（呼吸するのはブランドLED一つ）。
- **Do** すべてローカル完結（Unicode／CSSのみ）。**Don't** 外部フォント/CDN/画像に依存しない。
