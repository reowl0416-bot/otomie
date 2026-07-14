---
version: alpha
name: 楽譜 音名・コード表示（Linear風）
description: >
  Linear の視覚言語に寄せた、対面/画面共有のライブ指導ツール。near-black のキャンバス(#010102)に
  チャコールのパネル(#0f1011)と hairline のボーダー(#23252a)、シグネチャーのラベンダー(#5e6ad2)を
  唯一のアクセントとして焦点にだけ使う。文字は明るいグレー(#f7f8f8)、タイポはタイトで負トラッキング。
  静かで技術的、余計な色を持たない“ソフトウェアの計器盤”。
colors:
  canvas: "#010102"
  surface: "#0b0c0d"
  surface-1: "#0f1011"
  surface-2: "#16181a"
  surface-3: "#202225"
  hairline: "#23252a"
  hairline-strong: "#34343a"
  ink: "#f7f8f8"
  ink-subtle: "#8a8f98"
  ink-tertiary: "#62666d"
  primary: "#5e6ad2"
  primary-hover: "#828fff"
  on-primary: "#ffffff"
  harmony: "#d7a44a"
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
  sm: "7px"
  lg: "10px"
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
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  toggle-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-warn:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
  card:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.lg}"
    padding: "12px 13px"
  hint:
    backgroundColor: "rgba(15,16,17,0.92)"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
  select:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.sm}"
  input:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.sm}"
---

# DESIGN.md — 楽譜 音名・コード表示（Linear風）

Google Labs（Stitch）の [DESIGN.md 仕様](https://github.com/google-labs-code/design.md) 準拠。
配色・タイポは [awesome-design-md の Linear](https://github.com/VoltAgent/awesome-design-md) を実値ベースに、
本アプリ（対面/画面共有のライブ指導・[CLAUDE.md](CLAUDE.md)）向けに最小限だけ拡張した。
実装は `index.html` の `<style>`（CSS変数）がこのトークンを反映する。

## Overview

Linear の“near-black・技術的・静かに高級”な質感を、教える道具に移植する。ユーザーは画面を相手に共有しながら
「この音は C4」「ここは Am7」と指す。だから UI は徹底して沈め、光るのは**焦点（選択中・現在の小節・コード名）だけ**。
感情は「集中」「迷いのなさ」。Linear 同様、色は装飾に使わない — 意味のある一点にだけ置く。

## Colors

- 背景は near-black の階層：`canvas`(#010102) → `surface`(ヘッダー/パネル) → `surface-1`(カード) → `surface-2/3`(コントロール/ホバー)。差は極小、線(`hairline`)で仕切る。
- 文字は `ink`(#f7f8f8) / `ink-subtle`(ラベル・補助) / `ink-tertiary`(最も弱い)。
- アクセントは Linear のラベンダー `primary`(#5e6ad2) が主役で、**操作可能・選択中・フォーカス・主CTA**にのみ使う（装飾禁止）。
- 本アプリ固有の意味色は最小追加：`harmony`(#d7a44a) はコード名/和声、`danger`(#e5484d) は削除/消しゴム。彩度は Linear の暗さに馴染むよう抑える。
- キャンバス上と右パネルで色の意味を一致（選択音符＝ラベンダー、選択小節＝ラベンダー枠、消しゴム＝赤、コード＝アンバー）。

## Typography

- 単一のシステムフォント（`system-ui`／日本語 `Hiragino Sans`、Inter があれば使用）。外部フォントは読み込まない（オフライン厳守）。
- Linear の“タイトで負トラッキング”を再現：本文 `-0.1px`、表示値 `-0.6px`。太さは 400（本文）/ 500（UI・ボタン）/ 600（表示値・見出し）。派手な太字は使わない。
- 表示値（音名 `C4`・コード `Am7`）は `display`(28px/600) で最大。セクション見出しは `eyebrow`(10px・大文字・字間+0.6px)。機械的な値は `mono`。

## Layout

- 4px グリッド（`xxs`4 / `xs`8 / `sm`12 / `md`14 / `lg`16）。密度は高め（Linear のダッシュボード感）。
- 3ペイン：ツールバー（役割ごとの箱＋hairline 区切り）／キャンバス（伸縮）／右パネル 300px。
- CTA は先頭に1つ（自動認識＝ラベンダー）。画像を開くは副次。以降は箱で「モード／譜表・調号／密度／レッスン／ズーム」。

## Elevation & Depth

- Linear 流に影を抑える。面の明度差と hairline で階層を作り、浮くのは overlay 的な要素（`hint`）だけ（`0 8px 24px rgba(0,0,0,.5)`）。
- アクティブ状態は**塗り（ラベンダー）でフラットに**示す。内側ハイライトやグラデは使わない（Linear のフラットさ）。
- ホバーは面を1段上げ、`hairline-strong` に締める。

## Shapes

- 角丸は控えめでシャープ：コントロール `sm`7px、カード/箱 `lg`10px、チップ `pill`。
- 丸みで柔らかくしすぎない。計器としての精度感を優先。

## Components

- **Button**：既定は `surface-2`＋hairline。`primary`（ラベンダー）＝唯一のCTAアクセント。`warn`（赤アウトライン）＝削除系、`ghost` はズーム等の低優先。
- **Mode / Density トグル**：アクティブはラベンダー塗り。削除系モード（消す）は**アクティブ時に赤塗り**で危険を明示。
- **Card**：右パネルの単位。`eyebrow` 見出し＋意味色ドット（音符=ラベンダー／コード=アンバー）。表示値は特大。
- **Hint**：キャンバス左上の overlay チップ。今のモードの操作を1行、`ink-subtle` で静かに。
- **Select / Input**：暗い面、フォーカスでラベンダーのリング（`0 0 0 3px rgba(94,106,210,.32)`）。
- **Dropzone（空状態）**：画像未読込時に中央の導線。淡色・低ノイズ。

## Do's and Don'ts

- **Do** ラベンダーは焦点にだけ。**Don't** アクセントを装飾で撒かない（Linear の単一アクセント原則）。
- **Do** near-black＋hairline で階層を作る。**Don't** 強い影・グラデ・光彩で立体化しない。
- **Do** タイトな負トラッキングで“計器”らしく。**Don't** ゆったりした正トラッキングや極太フォントにしない。
- **Do** 意味色は最小（ラベンダー＝操作／アンバー＝和声／赤＝削除）。**Don't** 色数を増やして賑やかにしない。
- **Do** すべてローカル完結（Unicode／CSSのみ）。**Don't** 外部フォント/CDN/画像に依存しない。
