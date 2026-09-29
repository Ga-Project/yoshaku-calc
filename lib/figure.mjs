// 裁断図（app/page.tsx の LayoutFigure）の枠と、図の下の表記。
//
// 表記が図の枠に収まるかを node:test から確かめられるよう、TSX から切り出して .mjs に置く。
// 図は SVG の cm 座標系で描くので、ここでの長さはすべて cm（= viewBox の単位）。

/** 「わ」表示の左余白。 */
export const FIG_PAD_L = 8;
/** 寸法注記の右余白。 */
export const FIG_PAD_R = 22;
/** 図の下の表記の文字サイズ。 */
export const CAPTION_FONT = 3.4;

/**
 * 図の枠の横幅（viewBox の幅）。
 * @param {number} workingWidth
 */
export function figureWidth(workingWidth) {
  return FIG_PAD_L + workingWidth + FIG_PAD_R;
}

/**
 * 図の下の表記。枠が最も狭い 90cm 幅でも収まる長さにしている。
 * @param {number} workingWidth
 * @param {number} fabricWidth
 */
export function figureCaption(workingWidth, fabricWidth) {
  return `作業幅 ${workingWidth}cm（${fabricWidth}cm 幅を二つ折り）`;
}

/**
 * 文字列の描画幅の概算（全角 = 1em、半角 = 0.6em）。
 * @param {string} text
 * @param {number} fontSize
 */
export function estimateTextWidth(text, fontSize) {
  let em = 0;
  for (const ch of text) em += /[ -~]/.test(ch) ? 0.6 : 1;
  return em * fontSize;
}
