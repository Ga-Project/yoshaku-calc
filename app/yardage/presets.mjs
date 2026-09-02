// 用尺早見表のデータ定義。
//
// ここに用尺の「数字」は書かない。表に出る値はすべて lib/calc.mjs の computeYardage() を
// ビルド時に呼んで生成する。読み物に手で書いた数値が計算機の実出力と食い違う事故を
// 構造的に起こせなくするための設計。
//
// このファイルが持つのは「どの条件を並べて見せるか」だけ:
//   base = 固定する寸法 / axes = 1 つだけ動かす寸法とその段階。
//
// .mjs にしているのは node:test から実体を import して検証するため。TypeScript の
// ままだとテストがソース文字列を正規表現で読むしかなく、整形を変えただけで
// 無言で通ってしまう（実際それで本文と表の食い違いを 3 件見逃した）。

// node:test から素の ESM として読めるよう、パスエイリアス(@/)ではなく相対で読む。
import { FABRIC_WIDTHS, computeYardage, getGarment } from "../../lib/calc.mjs";

/**
 * @typedef {Object} AxisRow
 * @property {number} value 動かす入力の値(cm)
 * @property {string} label 行見出し（例: "88cm"）
 */

/**
 * 1 つの表 = 「1 つの寸法だけ動かし、生地幅 3 種を横に並べる」。
 * @typedef {Object} Axis
 * @property {string} key 動かす入力キー（garment.inputs の key と一致させる）
 * @property {string} caption 表のキャプション
 * @property {string} rowHeader 行見出し列のラベル（例: "バスト"）
 * @property {string} fixedNote 固定した寸法の説明
 * @property {AxisRow[]} rows
 */

/**
 * 1 ページぶんの定義。
 * @typedef {Object} GarmentGuide
 * @property {string} slug URL スラッグ = 計算機の garment id
 * @property {string} searchName 検索で使われる言い回し（title/h1 に使う）
 * @property {string} description meta description
 * @property {string} lead 導入文
 * @property {string} pieces 何を裁つのか
 * @property {Record<string, number>} base 固定する寸法
 * @property {Axis[]} axes
 * @property {string[]} tips この衣服ならではの注意（数字を含めない）
 * @property {((h: {axisSpan: (key: string) => {min: number, max: number}, m: (v: number) => string}) => string[])} [derivedTips]
 *   表から導出して出す注記。数値を含む主張はこちらで書き、手書きしない
 */

/** @type {GarmentGuide[]} */
export const GUIDES = [
  {
    slug: "shirt",
    searchName: "シャツ・ブラウス",
    description:
      "シャツ・ブラウスに必要な生地の長さ（用尺）を、バスト・袖丈と生地幅 90／110／140cm の組み合わせで一覧にした早見表。手芸店で反物を選ぶ前の目安に。",
    lead: "シャツやブラウスは、身頃 2 枚と袖 2 枚、それに見返し・衿がつきます。袖があるぶん横に置くパーツが多く、生地幅の影響を受けやすい衣服です。",
    pieces:
      "前身頃・後身頃をそれぞれ「わ」で 1 枚ずつ、袖を 2 枚、見返しと衿を 1 組。袖丈を 0 にするとノースリーブとして袖を除いて計算します。",
    base: { bodyLen: 62, sleeveLen: 54, bust: 88 },
    axes: [
      {
        key: "bust",
        caption: "バスト別の用尺（着丈 62cm・長袖 54cm）",
        rowHeader: "バスト",
        fixedNote: "着丈 62cm・袖丈 54cm で固定したときの必要な長さ",
        rows: [
          { value: 80, label: "80cm" },
          { value: 88, label: "88cm" },
          { value: 96, label: "96cm" },
          { value: 104, label: "104cm" },
        ],
      },
      {
        key: "sleeveLen",
        caption: "袖丈別の用尺（着丈 62cm・バスト 88cm）",
        rowHeader: "袖丈",
        fixedNote: "着丈 62cm・バスト 88cm で固定したときの必要な長さ",
        rows: [
          { value: 0, label: "0cm（ノースリーブ）" },
          { value: 24, label: "24cm（半袖）" },
          { value: 40, label: "40cm（七分袖）" },
          { value: 54, label: "54cm（長袖）" },
        ],
      },
    ],
    tips: [
      "衿と見返しは小さなパーツなので、身頃や袖の脇にできた空きに収まることが多く、そのぶん用尺には表れにくくなります。",
      "半袖で足りるなら、袖のぶんの差がそのまま生地代の差になります。",
    ],
    // 数字を含む注記は表から導出する。手で書くと同じページの表と食い違う。
    derivedTips: (h) => {
      const d = h.axisSpan("sleeveLen");
      return [
        `袖の有無は用尺に大きく効きます。この表のノースリーブと長袖の差は、生地幅によって ${h.m(d.min)}〜${h.m(d.max)} です。`,
      ];
    },
  },
  {
    slug: "dress",
    searchName: "ワンピース",
    description:
      "ワンピースに必要な生地の長さ（用尺）を、総丈・バストと生地幅 90／110／140cm の組み合わせで一覧にした早見表。生地を買う前の見積りに。",
    lead: "ワンピースは身頃を通し丈で裁つため、必要な長さに総丈がそのまま効きます。丈が長い一着ほど、生地幅の選び方で差が開きます。",
    pieces:
      "前身頃・後身頃を総丈のまま「わ」で 1 枚ずつ、袖がある場合は 2 枚。袖丈 0 でノースリーブになります。",
    base: { bodyLen: 105, sleeveLen: 24, bust: 88 },
    axes: [
      {
        key: "bodyLen",
        caption: "総丈別の用尺（バスト 88cm・半袖 24cm）",
        rowHeader: "総丈",
        fixedNote: "バスト 88cm・袖丈 24cm で固定したときの必要な長さ",
        rows: [
          { value: 90, label: "90cm（ひざ上）" },
          { value: 105, label: "105cm（ひざ下）" },
          { value: 120, label: "120cm（ミモレ）" },
          { value: 135, label: "135cm（ロング）" },
        ],
      },
      {
        key: "bust",
        caption: "バスト別の用尺（総丈 105cm・半袖 24cm）",
        rowHeader: "バスト",
        fixedNote: "総丈 105cm・袖丈 24cm で固定したときの必要な長さ",
        rows: [
          { value: 80, label: "80cm" },
          { value: 88, label: "88cm" },
          { value: 96, label: "96cm" },
          { value: 104, label: "104cm" },
        ],
      },
    ],
    tips: [
      "丈を伸ばしたときの効き方は生地幅で変わります。前身頃と後身頃が縦に積まれる 90・110cm 幅では、丈を 15cm 伸ばすと必要な長さは 2 枚ぶんの 30cm 増えます。身頃が横に並ぶ 140cm 幅では増えるのは伸ばしたぶんだけで、10cm 単位に丸めた表では 10〜20cm の増加として現れます。",
      "身頃が 2 枚とも縦に積まれる配置になると、生地幅を広げても必要な長さは減りません。140cm 幅の恩恵が出るのは、身頃を横に 2 枚並べられるサイズのときです。",
    ],
  },
  {
    slug: "skirt",
    searchName: "スカート",
    description:
      "スカートに必要な生地の長さ（用尺）を、スカート丈・ヒップと生地幅 90／110／140cm の組み合わせで一覧にした早見表。「スカート 生地 何メートル」の目安に。",
    lead: "スカートは前後 2 枚とウエストベルトだけの、最も生地を使わない衣服です。丈が短ければ 1m を切ることもあります。",
    pieces: "前スカート・後スカートを「わ」で 1 枚ずつ、ウエストベルトを 1 本。",
    base: { skirtLen: 60, hip: 92 },
    axes: [
      {
        key: "skirtLen",
        caption: "スカート丈別の用尺（ヒップ 92cm）",
        rowHeader: "スカート丈",
        fixedNote: "ヒップ 92cm で固定したときの必要な長さ",
        rows: [
          { value: 40, label: "40cm（ミニ）" },
          { value: 60, label: "60cm（ひざ丈）" },
          { value: 75, label: "75cm（ミモレ）" },
          { value: 90, label: "90cm（ロング）" },
        ],
      },
      {
        key: "hip",
        caption: "ヒップ別の用尺（スカート丈 60cm）",
        rowHeader: "ヒップ",
        fixedNote: "スカート丈 60cm で固定したときの必要な長さ",
        rows: [
          { value: 84, label: "84cm" },
          { value: 92, label: "92cm" },
          { value: 100, label: "100cm" },
          { value: 108, label: "108cm" },
        ],
      },
    ],
    tips: [
      "前後スカートが横に並べば、必要な長さはスカート丈 1 枚ぶんで済みます。並ばなければ 2 枚ぶん積むことになります。ヒップ別の表で 90cm 幅と 110cm 幅の差が大きく開いているところが、その切り替わりです。",
      "ギャザーやフレアを入れる型紙は、裾に向かって広がるぶん幅を食います。表の数字は直線的な型紙を前提とした下限とお考えください。",
    ],
  },
  {
    slug: "pants",
    searchName: "パンツ",
    description:
      "パンツに必要な生地の長さ（用尺）を、パンツ丈・ヒップと生地幅 90／110／140cm の組み合わせで一覧にした早見表。生地を買う前の確認に。",
    lead: "パンツは前後 2 枚を縦長に裁ちます。丈が長いぶん、前後が横に並ぶかどうかで必要な長さが大きく変わります。",
    pieces: "前パンツ・後パンツを「わ」で 1 枚ずつ、ウエストベルトを 1 本。",
    base: { pantsLen: 96, hip: 94 },
    axes: [
      {
        key: "pantsLen",
        caption: "パンツ丈別の用尺（ヒップ 94cm）",
        rowHeader: "パンツ丈",
        fixedNote: "ヒップ 94cm で固定したときの必要な長さ",
        rows: [
          { value: 55, label: "55cm（ハーフ）" },
          { value: 75, label: "75cm（クロップド）" },
          { value: 96, label: "96cm（フルレングス）" },
          { value: 108, label: "108cm（ワイド・長め）" },
        ],
      },
      {
        key: "hip",
        caption: "ヒップ別の用尺（パンツ丈 96cm）",
        rowHeader: "ヒップ",
        fixedNote: "パンツ丈 96cm で固定したときの必要な長さ",
        rows: [
          { value: 86, label: "86cm" },
          { value: 94, label: "94cm" },
          { value: 102, label: "102cm" },
          { value: 110, label: "110cm" },
        ],
      },
    ],
    tips: [
      "フルレングスのパンツは、前後が縦に積まれると必要な長さが 2m を超えます。前後を横に並べられる条件に入ると、一気に半分近くまで落ちます。",
      "裾を折り返して仕立てる場合や、股上を深く取る型紙では、表の数字に 10〜20cm 足しておくと安心です。",
    ],
  },
  {
    slug: "jacket",
    searchName: "ジャケット",
    description:
      "ジャケット（表地）に必要な生地の長さ（用尺）を、バスト・着丈と生地幅 90／110／140cm の組み合わせで一覧にした早見表。ウール地・スーツ地の見積りに。",
    lead: "ジャケットは縫い代とゆとりが大きく、身頃 1 枚が生地の幅を大きく取ります。サイズによっては 90cm 幅に身頃が収まりません。",
    pieces:
      "前身頃・後身頃を「わ」で 1 枚ずつ、袖を 2 枚、衿と見返しを 1 組。ここでの用尺は表地のみで、裏地・芯地は別に必要です。",
    base: { bodyLen: 64, sleeveLen: 58, bust: 96 },
    axes: [
      {
        key: "bust",
        caption: "バスト別の用尺（着丈 64cm・袖丈 58cm）",
        rowHeader: "バスト",
        fixedNote: "着丈 64cm・袖丈 58cm で固定したときの必要な長さ",
        rows: [
          { value: 84, label: "84cm" },
          { value: 96, label: "96cm" },
          { value: 108, label: "108cm" },
          { value: 120, label: "120cm" },
          { value: 136, label: "136cm" },
        ],
      },
      {
        key: "bodyLen",
        caption: "着丈別の用尺（バスト 96cm・袖丈 58cm）",
        rowHeader: "着丈",
        fixedNote: "バスト 96cm・袖丈 58cm で固定したときの必要な長さ",
        rows: [
          { value: 52, label: "52cm（ショート）" },
          { value: 64, label: "64cm（標準）" },
          { value: 76, label: "76cm（ロング）" },
          { value: 88, label: "88cm（コート寄り）" },
        ],
      },
    ],
    tips: [
      "表の数字は表地だけの用尺です。裏地はおおむね同じか少し少なめ、接着芯は前身頃と衿・見返しぶんを別途見積もってください。",
      "身頃が生地幅に収まらない組み合わせでは、表にその印が出ます。その場合は広い生地を選ぶか、はぎ合わせを前提に型紙を割る必要があります。",
    ],
  },
];

/**
 * 表の 1 セル = ある生地幅での結果。
 * @typedef {Object} Cell
 * @property {number} fabricWidth
 * @property {number} totalCm
 * @property {number} totalM
 * @property {boolean} widthShortage パーツが生地幅に収まらない（この幅では裁てない）
 */

/**
 * 表の 1 行 = 行見出し + 生地幅ごとのセル + 計算機への深いリンク。
 * @typedef {Object} TableRow
 * @property {number} value この行が表す寸法の値(cm)。代表行の照合に使う（表示ラベルに依存させない）
 * @property {string} label 行見出し
 * @property {Cell[]} cells
 * @property {string} query その条件を計算機で開くクエリ文字列（先頭の ? を含む）
 */

/**
 * @typedef {Object} BuiltTable
 * @property {string} caption
 * @property {string} rowHeader
 * @property {string} fixedNote
 * @property {number[]} widths
 * @property {TableRow[]} rows
 */

/** 深いリンクを開くときの生地幅（店頭で最も一般的な標準幅）。表の見出しにも明記する。 */
export const LINK_WIDTH = 110;

/**
 * 計算機（トップページ）でその条件を開くためのクエリ。
 * @param {string} slug
 * @param {Record<string, number>} values
 * @param {number} width
 */
function queryFor(slug, values, width) {
  const params = new URLSearchParams();
  params.set("g", slug);
  params.set("w", String(width));
  for (const [k, v] of Object.entries(values)) params.set(k, String(v));
  return `?${params.toString()}`;
}

/**
 * 表を組み立てる。数値はすべて computeYardage() の実出力。
 * 種別 id や入力キーが計算エンジンとズレていればここで例外になり、ビルドが落ちる。
 * @param {GarmentGuide} guide
 * @param {Axis} axis
 * @returns {BuiltTable}
 */
export function buildTable(guide, axis) {
  const garment = getGarment(guide.slug);
  if (!garment) throw new Error(`unknown garment id: ${guide.slug}`);
  if (!garment.inputs.some((i) => i.key === axis.key)) {
    throw new Error(`unknown input key: ${guide.slug}.${axis.key}`);
  }

  const rows = axis.rows.map((row) => {
    const values = { ...guide.base, [axis.key]: row.value };
    const cells = FABRIC_WIDTHS.map((w) => {
      const res = computeYardage(guide.slug, w, values);
      if (!res) throw new Error(`compute failed: ${guide.slug}@${w}`);
      return {
        fabricWidth: w,
        totalCm: res.totalCm,
        totalM: res.totalM,
        widthShortage: res.widthShortage,
      };
    });
    return {
      value: row.value,
      label: row.label,
      cells,
      query: queryFor(guide.slug, values, LINK_WIDTH),
    };
  });

  return {
    caption: axis.caption,
    rowHeader: axis.rowHeader,
    fixedNote: axis.fixedNote,
    widths: [...FABRIC_WIDTHS],
    rows,
  };
}

/**
 * slug から定義を引く。
 * @param {string} slug
 * @returns {GarmentGuide | null}
 */
export function getGuide(slug) {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}

/**
 * 各種別の「代表的な一着」（base の条件）での用尺を、生地幅ごとに並べた比較。
 * トップの一覧表と、そこに添える文言の両方をこの 1 か所から作る。
 * 文章に「倍以上」等の数字を手で書かず、ここで実測した値だけを言葉にする。
 * @returns {{ rows: {guide: GarmentGuide, cells: Cell[]}[], widths: number[],
 *             spread: {width: number, max: number, min: number, ratio: number}[] }}
 */
export function buildOverview() {
  const rows = GUIDES.map((guide) => {
    const axis = guide.axes[0];
    if (!axis) throw new Error(`no axis: ${guide.slug}`);
    const table = buildTable(guide, axis);
    // 代表行は「動かす寸法が base と同じ値」の行。表示ラベルではなく値で照合する。
    const baseValue = guide.base[axis.key];
    const row = table.rows.find((r) => r.value === baseValue);
    if (!row) {
      throw new Error(
        `代表行が見つからない: ${guide.slug}.${axis.key}=${baseValue} が axes[0].rows に無い`,
      );
    }
    return { guide, cells: row.cells };
  });

  const spread = FABRIC_WIDTHS.map((width, i) => {
    const vals = rows.map((r) => {
      const c = r.cells[i];
      if (!c) throw new Error(`missing cell: ${r.guide.slug}@${width}`);
      return c.totalM;
    });
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    return { width, max, min, ratio: max / min };
  });

  return { rows, widths: [...FABRIC_WIDTHS], spread };
}

/**
 * ある軸で「動かした寸法が最小のとき」と「最大のとき」の用尺差を、生地幅ごとに実測する。
 * 本文で「◯m 変わります」と書くための値をここから取り、手書きしない。
 * @param {GarmentGuide} guide
 * @param {string} axisKey
 * @returns {{min: number, max: number}} 差の m 表記の最小・最大
 */
export function axisSpanMeters(guide, axisKey) {
  const axis = guide.axes.find((a) => a.key === axisKey);
  if (!axis) throw new Error(`no axis ${axisKey} on ${guide.slug}`);
  const table = buildTable(guide, axis);
  const first = table.rows[0];
  const last = table.rows[table.rows.length - 1];
  if (!first || !last) throw new Error(`empty axis ${axisKey} on ${guide.slug}`);
  const diffs = table.widths.map((_, i) => {
    const a = first.cells[i];
    const b = last.cells[i];
    if (!a || !b) throw new Error(`missing cell on ${guide.slug}`);
    return b.totalM - a.totalM;
  });
  return { min: Math.min(...diffs), max: Math.max(...diffs) };
}
