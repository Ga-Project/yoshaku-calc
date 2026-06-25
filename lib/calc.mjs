// 用尺カルク — 計算エンジン（依存なしの純関数。ブラウザと node:test の双方から使う）
//
// 設計の要点:
//   - 衣服種別ごとに「裁断する型紙パーツ」を寸法つきで定義する。
//   - 生地は中表に二つ折り（わ裁ち）する前提で、実作業幅 = 生地幅 / 2 とみなす。
//   - パーツを作業幅の中へ左から詰め（棚詰め/shelf packing）、積み上がった長さの合計を
//     必要な生地の長さ（用尺）とする。実裁断に近い幾何で概算するため、生地幅が広いほど
//     パーツが横に並んで用尺が短くなる、という現実の挙動が自然に再現される。
//   - 出てきた長さに少しの余裕（地直し・柄合わせ）を足し、購入単位の 10cm に切り上げる。
//
// すべて cm 単位で計算する。あくまで概算であり、柄合わせ・地の目・縮み・デザインで増減する。

/**
 * @typedef {Object} GarmentInput
 * @property {string} key   入力キー
 * @property {string} label 表示ラベル
 * @property {string} unit  単位（例: "cm"）
 * @property {number} def   既定値
 * @property {number} min   下限
 * @property {number} max   上限
 * @property {string} [hint] 補足
 */

/**
 * @typedef {Object} Piece
 * @property {string} label パーツ名（例: "前身頃"）
 * @property {number} w 生地幅方向の占有幅(cm)
 * @property {number} h 生地長さ方向の占有長(cm)
 * @property {string} color 配色トークン名（front/back/sleeve/accent）
 */

/**
 * @typedef {Object} Garment
 * @property {string} id
 * @property {string} label
 * @property {string} emoji
 * @property {string} blurb 1行説明
 * @property {GarmentInput[]} inputs
 * @property {(v: Record<string, number>) => Piece[]} pieces
 */

/**
 * @typedef {Object} PlacedPiece
 * @property {string} label
 * @property {number} x 作業幅内の左端(cm)
 * @property {number} y 生地長さ方向の上端(cm)
 * @property {number} w
 * @property {number} h
 * @property {string} color
 * @property {boolean} overflow 作業幅を超えるパーツ（生地幅不足の警告対象）
 */

/**
 * @typedef {Object} CalcResult
 * @property {number} totalCm 推奨購入長(cm, 10cm 単位に切り上げ済み)
 * @property {number} totalM  同上(m)
 * @property {number} rawCm   余裕・切り上げ前の素の積み上げ長(cm)
 * @property {number} fabricWidth 選択した生地幅(cm)
 * @property {number} workingWidth わ裁ちの作業幅(cm) = fabricWidth / 2
 * @property {PlacedPiece[]} placed レイアウト図用のパーツ配置
 * @property {string[]} notes 注意書き
 * @property {boolean} widthShortage いずれかのパーツが作業幅を超えた
 */

/** 用尺に上乗せする地直し・裁ち代の安全余裕(cm)。 */
export const SAFETY_MARGIN_CM = 5;

/** 選べる生地幅(cm)。手芸店の定番反物幅。 */
export const FABRIC_WIDTHS = [90, 110, 140];

/** パーツ配色トークン（SVG / 凡例で共有）。 */
export const PIECE_COLORS = {
  front: "front",
  back: "back",
  sleeve: "sleeve",
  accent: "accent",
};

const r = Math.round;

/**
 * 衣服種別の定義。各 pieces() は入力寸法から裁断パーツ一覧を返す。
 * 占有幅は「わ裁ち」を前提に半身分（身幅/4 等）で見積もる。
 * @type {Garment[]}
 */
export const GARMENTS = [
  {
    id: "shirt",
    label: "シャツ・ブラウス",
    emoji: "👔",
    blurb: "身頃＋袖＋見返しを裁つ定番のトップス",
    inputs: [
      { key: "bodyLen", label: "着丈", unit: "cm", def: 62, min: 40, max: 120 },
      { key: "sleeveLen", label: "袖丈", unit: "cm", def: 54, min: 0, max: 80, hint: "ノースリーブは0" },
      { key: "bust", label: "バスト", unit: "cm", def: 88, min: 70, max: 140 },
    ],
    pieces: (v) => {
      const bodiceW = r(v.bust / 4 + 7);
      const bodyH = v.bodyLen + 8;
      const sleeveW = r(v.bust / 4 + 2);
      const sleeveH = v.sleeveLen + 6;
      const pcs = [
        { label: "前身頃", w: bodiceW, h: bodyH, color: "front" },
        { label: "後身頃", w: bodiceW, h: bodyH, color: "back" },
      ];
      if (v.sleeveLen > 0) {
        pcs.push({ label: "袖", w: sleeveW, h: sleeveH, color: "sleeve" });
        pcs.push({ label: "袖", w: sleeveW, h: sleeveH, color: "sleeve" });
      }
      pcs.push({ label: "見返し・衿", w: r(v.bust / 6), h: 24, color: "accent" });
      return pcs;
    },
  },
  {
    id: "dress",
    label: "ワンピース",
    emoji: "👗",
    blurb: "身頃を通し丈で裁つワンピース",
    inputs: [
      { key: "bodyLen", label: "着丈（総丈）", unit: "cm", def: 105, min: 70, max: 160 },
      { key: "sleeveLen", label: "袖丈", unit: "cm", def: 24, min: 0, max: 70, hint: "ノースリーブは0" },
      { key: "bust", label: "バスト", unit: "cm", def: 88, min: 70, max: 140 },
    ],
    pieces: (v) => {
      const bodiceW = r(v.bust / 4 + 8);
      const bodyH = v.bodyLen + 8;
      const sleeveW = r(v.bust / 4 + 2);
      const sleeveH = v.sleeveLen + 6;
      const pcs = [
        { label: "前身頃", w: bodiceW, h: bodyH, color: "front" },
        { label: "後身頃", w: bodiceW, h: bodyH, color: "back" },
      ];
      if (v.sleeveLen > 0) {
        pcs.push({ label: "袖", w: sleeveW, h: sleeveH, color: "sleeve" });
        pcs.push({ label: "袖", w: sleeveW, h: sleeveH, color: "sleeve" });
      }
      return pcs;
    },
  },
  {
    id: "skirt",
    label: "スカート",
    emoji: "🧷",
    blurb: "前後スカート＋ウエストベルト",
    inputs: [
      { key: "skirtLen", label: "スカート丈", unit: "cm", def: 60, min: 20, max: 110 },
      { key: "hip", label: "ヒップ", unit: "cm", def: 92, min: 70, max: 140 },
    ],
    pieces: (v) => {
      const w = r(v.hip / 4 + 6);
      const h = v.skirtLen + 10;
      return [
        { label: "前スカート", w, h, color: "front" },
        { label: "後スカート", w, h, color: "back" },
        { label: "ウエストベルト", w: 22, h: 12, color: "accent" },
      ];
    },
  },
  {
    id: "pants",
    label: "パンツ",
    emoji: "👖",
    blurb: "前後パンツ＋ウエストベルト",
    inputs: [
      { key: "pantsLen", label: "パンツ丈", unit: "cm", def: 96, min: 50, max: 120 },
      { key: "hip", label: "ヒップ", unit: "cm", def: 94, min: 70, max: 140 },
    ],
    pieces: (v) => {
      const w = r(v.hip / 4 + 8);
      const h = v.pantsLen + 10;
      return [
        { label: "前パンツ", w, h, color: "front" },
        { label: "後パンツ", w, h, color: "back" },
        { label: "ウエストベルト", w: 22, h: 12, color: "accent" },
      ];
    },
  },
  {
    id: "jacket",
    label: "ジャケット",
    emoji: "🧥",
    blurb: "身頃＋二枚袖＋衿（表地のみ）",
    inputs: [
      { key: "bodyLen", label: "着丈", unit: "cm", def: 64, min: 45 , max: 110 },
      { key: "sleeveLen", label: "袖丈", unit: "cm", def: 58, min: 30, max: 78 },
      { key: "bust", label: "バスト", unit: "cm", def: 96, min: 78, max: 140 },
    ],
    pieces: (v) => {
      // ジャケットは構造分の縫い代・ゆとりが大きく、大きいサイズを 90cm 幅に
      // 二つ折りで載せると身頃が収まらないことがある（はぎ合わせ案内の対象）。
      const bodiceW = r(v.bust / 4 + 12);
      const bodyH = v.bodyLen + 8;
      const sleeveW = r(v.bust / 4 + 4);
      const sleeveH = v.sleeveLen + 8;
      return [
        { label: "前身頃", w: bodiceW, h: bodyH, color: "front" },
        { label: "後身頃", w: bodiceW, h: bodyH, color: "back" },
        { label: "袖", w: sleeveW, h: sleeveH, color: "sleeve" },
        { label: "袖", w: sleeveW, h: sleeveH, color: "sleeve" },
        { label: "衿・見返し", w: r(v.bust / 5), h: 40, color: "accent" },
      ];
    },
  },
];

/** @param {string} id */
export function getGarment(id) {
  return GARMENTS.find((g) => g.id === id) ?? null;
}

/**
 * 入力値を種別の min/max で正規化（クランプ）し、有限数でなければ既定値にする。
 * @param {Garment} garment
 * @param {Record<string, unknown>} raw
 * @returns {Record<string, number>}
 */
export function normalizeValues(garment, raw) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const input of garment.inputs) {
    const rawVal = raw?.[input.key];
    // 空・null・undefined・数値でない値は「未入力」とみなし既定値にフォールバック。
    const missing = rawVal === "" || rawVal === null || rawVal === undefined;
    const n = missing ? NaN : Number(rawVal);
    const v = Number.isFinite(n) ? n : input.def;
    out[input.key] = Math.min(input.max, Math.max(input.min, v));
  }
  return out;
}

/**
 * パーツを作業幅へ棚詰め（shelf packing）して配置を決める。
 * 背の高いパーツから先に詰めることで行の高さのばらつきを抑え、隙間と総長を減らす。
 * @param {Piece[]} pieces
 * @param {number} workingWidth
 * @returns {{ placed: PlacedPiece[], rawCm: number }}
 */
function pack(pieces, workingWidth) {
  // 背の高い順（同高は元の順）で詰める。安定ソートのため元の添字をタイブレークに使う。
  const ordered = pieces
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.h - a.p.h || a.i - b.i)
    .map((e) => e.p);

  /** @type {PlacedPiece[]} */
  const placed = [];
  let rowY = 0;
  let rowH = 0;
  let cursorX = 0;

  for (const p of ordered) {
    // 現在の行に収まらなければ改行（先頭パーツは必ず現在行に置く）。
    if (cursorX > 0 && cursorX + p.w > workingWidth) {
      rowY += rowH;
      rowH = 0;
      cursorX = 0;
    }
    placed.push({
      label: p.label,
      x: cursorX,
      y: rowY,
      w: p.w,
      h: p.h,
      color: p.color,
      overflow: false,
    });
    cursorX += p.w;
    if (p.h > rowH) rowH = p.h;
  }
  const rawCm = rowY + rowH;
  return { placed, rawCm };
}

/** 10cm 単位に切り上げ。 */
function roundUp10(cm) {
  return Math.ceil(cm / 10) * 10;
}

/**
 * 用尺を計算する。
 * @param {string} garmentId
 * @param {number} fabricWidth
 * @param {Record<string, unknown>} rawValues
 * @returns {CalcResult | null} 種別不正なら null
 */
export function computeYardage(garmentId, fabricWidth, rawValues) {
  const garment = getGarment(garmentId);
  if (!garment) return null;
  const width = FABRIC_WIDTHS.includes(fabricWidth) ? fabricWidth : FABRIC_WIDTHS[1];
  const values = normalizeValues(garment, rawValues);
  const workingWidth = width / 2;
  const pieces = garment.pieces(values);

  // 単調性の保証: 広い生地は狭い生地の裁断配置をそのまま再現できるため、必要長さは
  // 「選択幅以下の各生地幅で詰めた結果のうち最短」になる（広いほど短いか同じ）。
  // 棚詰めだけだと行高の結合で逆転が起きうるので、min を取って物理的な下限に丸める。
  let best = null;
  for (const w of FABRIC_WIDTHS) {
    if (w > width) continue;
    const p = pack(pieces, w / 2);
    if (!best || p.rawCm < best.rawCm) best = p;
  }
  const packed = best ?? pack(pieces, workingWidth);

  // 表示は選択した生地幅（作業幅）で行う。採用した配置は選択幅以下なので必ず収まる。
  // はみ出し判定は選択幅（＝利用可能な最大の作業幅）で再評価する。
  const placed = packed.placed.map((pp) => ({
    ...pp,
    overflow: pp.w > workingWidth,
  }));
  const widthShortage = placed.some((pp) => pp.overflow);

  const safeRaw = Number.isFinite(packed.rawCm) ? packed.rawCm : 0;
  let totalCm = Math.max(30, roundUp10(safeRaw + SAFETY_MARGIN_CM));
  if (!Number.isFinite(totalCm)) totalCm = 30;

  /** @type {string[]} */
  const notes = [
    "用尺は概算です。柄合わせ・地の目・縮み・デザインで増減します。",
    "生地は中表に二つ折り（わ裁ち）し、地直し・裁ち代を見込んだ目安です。",
    "図の空き部分は、見返しや小物の共布取りに使えます。",
  ];
  if (widthShortage) {
    notes.unshift("一部のパーツが生地幅に収まりません。より広い生地幅を選ぶか、はぎ合わせをご検討ください。");
  }
  if (values.sleeveLen === 0) {
    notes.push("袖丈0のため袖は計算に含めていません。");
  }

  return {
    totalCm,
    totalM: totalCm / 100,
    rawCm: safeRaw,
    fabricWidth: width,
    workingWidth,
    placed,
    notes,
    widthShortage,
  };
}

/**
 * m 表記（例: 2.3m）。
 * @param {number} cm
 */
export function formatMeters(cm) {
  return (cm / 100).toFixed(1) + "m";
}
