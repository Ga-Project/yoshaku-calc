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
 * @property {((h: TipHelpers) => string[])} [derivedTips]
 *   表から導出して出す注記。数値を含む主張はこちらで書き、手書きしない
 */

/**
 * derivedTips に渡す、表と配置から値を引く道具。
 * @typedef {Object} TipHelpers
 * @property {(key: string) => {min: number, max: number} | null} axisSpan 最初と最後の行の差(m)の最小・最大（幅不足は除外・比べられなければ null）
 * @property {(key: string) => {first: string, last: string}} axisEnds 最初と最後の行見出し
 * @property {(key: string) => {width: number, from: string}[]} axisSteps 前の行より増えた箇所（全件）
 * @property {(key: string) => {width: number, min: number, max: number}[]} axisIncrements 行ごとの増え方(cm)
 * @property {(key: string) => number} axisStep 行の値の刻み(cm)。等間隔でなければ例外
 * @property {(key: string, fromRow: number) => number[]} flatWidths fromRow 行目以降の値が全て同じ生地幅
 * @property {() => Cell[]} baseCells 固定寸法（base）での各生地幅の結果（幅不足の幅は含めない）
 * @property {(width: number, a: string, b: string) => boolean} sideBySide base の配置で a と b が同じ段にあるか
 * @property {(v: number) => string} m
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
    ],
    // 数字を含む注記は表から導出する。手で書くと同じページの表と食い違う。
    derivedTips: (h) => {
      const d = h.axisSpan("sleeveLen");
      /** @type {string[]} */
      const tips = [];
      if (d) {
        tips.push(`袖の有無で用尺は変わります。この表のノースリーブと長袖の差は、生地幅によって ${h.m(d.min)}〜${h.m(d.max)} です。`);
      }
      // 半袖〜長袖の行で値が変わらない生地幅 = 袖が身頃の横に収まっている幅。
      const flat = h.flatWidths("sleeveLen", 1);
      if (flat.length > 0) {
        tips.push(
          `${flat.join("・")}cm 幅では、半袖から長袖まで必要な長さが変わりません。袖が身頃の横に収まるためです。`,
        );
      }
      return tips;
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
      "140cm 幅で必要な長さが大きく減るのは、前後の身頃を横に 2 枚並べられるときです。身頃が縦に積まれたままでは、生地幅を広げても減り方は小さくなります。",
    ],
    // 増え方の数字は表から導出する。手で書くと詰め方の改善で同じページの表と食い違う。
    derivedTips: (h) => {
      const incs = h.axisIncrements("bodyLen");
      const step = h.axisStep("bodyLen");
      const range = (i) => (i.min === i.max ? `${i.min}cm` : `${i.min}〜${i.max}cm`);
      return [
        `丈を伸ばしたときの効き方は生地幅で変わります。丈を ${step}cm ずつ伸ばしたこの表では、必要な長さの増え方が ${incs
          .map((i) => `${i.width}cm 幅で ${range(i)}`)
          .join("、")}です。前後の身頃が縦に積まれる幅では 2 枚ぶん、横に並ぶ幅では 1 枚ぶん伸びるためです（10cm 単位に丸めています）。`,
      ];
    },
  },
  {
    slug: "skirt",
    searchName: "スカート",
    description:
      "スカートに必要な生地の長さ（用尺）を、スカート丈・ヒップと生地幅 90／110／140cm の組み合わせで一覧にした早見表。「スカート 生地 何メートル」の目安に。",
    lead: "スカートは前後 2 枚とウエストベルトだけで、必要な生地が少なくて済む衣服です。丈が短ければ 1m を切ることもあります。",
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
      "前後スカートが横に並べば、必要な長さはスカート丈 1 枚ぶんで済みます。並ばなければ 2 枚ぶん積むことになります。",
      "ギャザーやフレアを入れる型紙は、裾に向かって広がるぶん幅を食います。表の数字は直線的な型紙を前提とした下限とお考えください。",
    ],
    // どの生地幅で前後が横に並ぶかは配置から導出する（耳の余裕や詰め方で変わる）。
    derivedTips: (h) => {
      const at = h.baseCells();
      const beside = at.filter((c) => h.sideBySide(c.fabricWidth, "前スカート", "後スカート"));
      if (beside.length === 0 || beside.length === at.length) return [];
      return [
        `表の標準的な寸法では、前後が横に並ぶのは ${beside.map((c) => `${c.fabricWidth}cm`).join("・")} 幅です。`,
      ];
    },
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
      "裾を折り返して仕立てる場合や、股上を深く取る型紙では、表の数字に 10〜20cm 足しておくと安心です。",
    ],
    // 「縦に積まれる／横に並ぶ」と、そのときの長さは配置から導出する。
    derivedTips: (h) => {
      const at = h.baseCells();
      const stacked = at.filter((c) => !h.sideBySide(c.fabricWidth, "前パンツ", "後パンツ"));
      const beside = at.filter((c) => h.sideBySide(c.fabricWidth, "前パンツ", "後パンツ"));
      const list = (cs) => cs.map((c) => `${c.fabricWidth}cm 幅で ${h.m(c.totalM)}`).join("、");
      if (stacked.length === 0 || beside.length === 0) return [];
      return [
        `表の標準的な寸法では、前後が縦に積まれる ${list(stacked)}、前後を横に並べられる ${list(beside)} です。並べられるかどうかで必要な長さが大きく変わります。`,
      ];
    },
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
  {
    slug: "apron",
    searchName: "エプロン",
    description:
      "胸当てエプロンに必要な生地の長さ（用尺）を、総丈・裾幅と生地幅 90／110／140cm の組み合わせで一覧にした早見表。保育・給食・カフェ用のエプロン作りの目安に。",
    lead: "胸当てエプロンは、本体 1 枚に細長いひもとポケットがつくだけの、形の単純な一着です。袖が無いぶん、ひもを本体の横に並べられるかどうかが必要な長さを左右します。",
    pieces:
      "本体を「わ」で 1 枚、腰ひもを 2 本、首ひもを 1 本、ポケットを 1 枚。腰ひもは二つ折りの生地から一度に 2 本取れるので、図では 1 本ぶんの場所に描いています。ひもは四つ折りで仕上がり幅 3cm（裁ち幅 12cm）を想定しています。胸当ても裾幅の長方形として見積もるため、実際の型紙より少し多めに出ます。首ひもは長さを固定した目安なので、首回りに合わせて調整してください。",
    base: { apronLen: 85, hemWidth: 76, tieLen: 60 },
    axes: [
      {
        key: "apronLen",
        caption: "総丈別の用尺（裾幅 76cm・腰ひも 60cm）",
        rowHeader: "総丈",
        fixedNote: "裾幅 76cm・腰ひも 60cm で固定したときの必要な長さ",
        rows: [
          { value: 65, label: "65cm（子ども用）" },
          { value: 75, label: "75cm（短め）" },
          { value: 85, label: "85cm（標準）" },
          { value: 95, label: "95cm（長め）" },
        ],
      },
      {
        key: "hemWidth",
        caption: "裾幅別の用尺（総丈 85cm・腰ひも 60cm）",
        rowHeader: "裾幅",
        fixedNote: "総丈 85cm・腰ひも 60cm で固定したときの必要な長さ",
        rows: [
          { value: 60, label: "60cm（細め）" },
          { value: 70, label: "70cm" },
          { value: 80, label: "80cm" },
          { value: 90, label: "90cm（ゆったり）" },
        ],
      },
    ],
    tips: [
      "ひもは細長いパーツなので、本体の横に並べられる生地幅なら用尺はほとんど増えません。裾幅を広げてひもやポケットが横に並びきらなくなると、下の段に回り、そのぶん必要な長さが増えます。",
      "裾幅を広げると、本体が生地幅に収まらない組み合わせがあり、表にその印が出ます。その場合は広い生地を選ぶか、本体の中心ではぎ合わせる型紙にします。",
    ],
    // 数字を含む注記は表から導出する。手で書くと同じページの表と食い違う。
    derivedTips: (h) => {
      const d = h.axisSpan("apronLen");
      const ends = h.axisEnds("apronLen");
      /** @type {string[]} */
      const tips = [];
      if (d) {
        const span = h.m(d.min) === h.m(d.max) ? h.m(d.min) : `${h.m(d.min)}〜${h.m(d.max)}`;
        tips.push(`総丈を伸ばしたぶんは、そのまま用尺に足されます。この表の${ends.first}と${ends.last}の差は ${span} です。`);
      }
      const steps = h.axisSteps("hemWidth");
      if (steps.length > 0) {
        /** @type {Map<number, string[]>} */
        const byWidth = new Map();
        for (const s of steps) byWidth.set(s.width, [...(byWidth.get(s.width) ?? []), s.from]);
        const where = [...byWidth]
          .map(([w, froms]) => `${w}cm 幅では裾幅 ${froms.join("・")} のところ`)
          .join("、");
        tips.push(`裾幅別の表で、パーツが下の段に回って必要な長さが増える切り替わりは、${where}です。`);
      }
      return tips;
    },
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
 * 代表行（動かす寸法が base と同じ値の行）を選ぶ。
 *
 * 表示ラベルの前方一致で選ぶと、base=10 のときに "104cm" の行に当たる、といった
 * 取り違えが起きる。ラベルは表示の都合で変わりうるので、必ず値で照合する。
 * 見つからないまま別の行を返すと「標準的な寸法」と偽った表になるため、
 * フォールバックせず例外にしてビルドを落とす。
 * @param {TableRow[]} rows
 * @param {number} baseValue
 * @param {string} [label] エラーメッセージ用の識別子
 * @returns {TableRow}
 */
export function findRepresentativeRow(rows, baseValue, label = "") {
  const row = rows.find((r) => r.value === baseValue);
  if (!row) {
    throw new Error(`代表行が見つからない: ${label} の行に ${baseValue} が無い`);
  }
  return row;
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
    const row = findRepresentativeRow(table.rows, guide.base[axis.key], guide.slug);
    return { guide, cells: row.cells };
  });

  return { rows, widths: [...FABRIC_WIDTHS], spread: spreadOf(rows) };
}

/**
 * 生地幅ごとの「種別間の開き」（最大/最小）。幅不足のセルは比べられないので除き、
 * 比べられる種別が 2 つ未満の生地幅は結果に含めない。
 * @param {{guide: GarmentGuide, cells: Cell[]}[]} rows
 * @returns {{width: number, max: number, min: number, ratio: number}[]}
 */
export function spreadOf(rows) {
  return FABRIC_WIDTHS.flatMap((width, i) => {
    const vals = rows.flatMap((r) => {
      const c = r.cells[i];
      if (!c) throw new Error(`missing cell: ${r.guide.slug}@${width}`);
      return c.widthShortage ? [] : [c.totalM];
    });
    if (vals.length < 2) return [];
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    return [{ width, max, min, ratio: max / min }];
  });
}

/**
 * ある軸の最初と最後の行の見出し（例: "65cm（子ども用）"）。本文で「◯◯と◯◯の差」と
 * 書くときに使い、行を差し替えても文言がずれないようにする。
 * @param {GarmentGuide} guide
 * @param {string} axisKey
 * @returns {{first: string, last: string}}
 */
export function axisEnds(guide, axisKey) {
  const axis = guide.axes.find((a) => a.key === axisKey);
  const first = axis?.rows[0];
  const last = axis?.rows[axis.rows.length - 1];
  if (!axis || !first || !last) throw new Error(`no axis ${axisKey} on ${guide.slug}`);
  return { first: first.label, last: last.label };
}

/** @param {GarmentGuide} guide @param {string} axisKey */
function axisTable(guide, axisKey) {
  const axis = guide.axes.find((a) => a.key === axisKey);
  if (!axis) throw new Error(`no axis ${axisKey} on ${guide.slug}`);
  return buildTable(guide, axis);
}

/**
 * ある軸を上から見て、前の行より必要量が増えた箇所を生地幅ごとに全て実測する。
 * 「幅が足りない」セル（その幅では裁てない）は比較に使わない。
 * @param {GarmentGuide} guide
 * @param {string} axisKey
 * @returns {{width: number, from: string}[]}
 */
export function axisSteps(guide, axisKey) {
  const table = axisTable(guide, axisKey);
  /** @type {{width: number, from: string}[]} */
  const out = [];
  table.widths.forEach((width, i) => {
    table.rows.forEach((row, k) => {
      if (k === 0) return;
      const prev = table.rows[k - 1].cells[i];
      const cur = row.cells[i];
      if (prev.widthShortage || cur.widthShortage) return;
      if (cur.totalCm > prev.totalCm) out.push({ width, from: `${row.value}cm` });
    });
  });
  return out;
}

/**
 * 行ごとの増え方(cm)の最小・最大を生地幅ごとに実測する。
 * @param {GarmentGuide} guide
 * @param {string} axisKey
 * @returns {{width: number, min: number, max: number}[]}
 */
export function axisIncrements(guide, axisKey) {
  const table = axisTable(guide, axisKey);
  return table.widths.flatMap((width, i) => {
    // 幅不足のセルを含む行の組は比べない。比べられる組が無い生地幅は結果に含めない。
    const diffs = table.rows.slice(1).flatMap((row, k) => {
      const prev = table.rows[k].cells[i];
      const cur = row.cells[i];
      return prev.widthShortage || cur.widthShortage ? [] : [cur.totalCm - prev.totalCm];
    });
    return diffs.length === 0 ? [] : [{ width, min: Math.min(...diffs), max: Math.max(...diffs) }];
  });
}

/**
 * 行の値の刻み(cm)。等間隔でなければ「◯cm ずつ」と書けないので例外にする。
 * @param {GarmentGuide} guide
 * @param {string} axisKey
 */
export function axisStep(guide, axisKey) {
  const axis = guide.axes.find((a) => a.key === axisKey);
  if (!axis || axis.rows.length < 2) throw new Error(`no axis ${axisKey} on ${guide.slug}`);
  const steps = new Set(axis.rows.slice(1).map((r, k) => r.value - axis.rows[k].value));
  if (steps.size !== 1) throw new Error(`${guide.slug}.${axisKey} の行が等間隔でない`);
  return [...steps][0];
}

/**
 * fromRow 行目以降の値がすべて同じになる生地幅。
 * @param {GarmentGuide} guide
 * @param {string} axisKey
 * @param {number} fromRow
 * @returns {number[]}
 */
export function flatWidths(guide, axisKey, fromRow) {
  const table = axisTable(guide, axisKey);
  return table.widths.filter((_, i) => {
    const vals = table.rows.slice(fromRow).map((r) => r.cells[i]);
    return vals.length > 1 && vals.every((c) => !c.widthShortage && c.totalCm === vals[0].totalCm);
  });
}

/**
 * base の配置で、ラベル a と b のパーツが同じ段（同じ y）に並んでいるか。
 * @param {GarmentGuide} guide
 * @param {number} width
 * @param {string} a
 * @param {string} b
 */
export function sideBySide(guide, width, a, b) {
  const res = computeYardage(guide.slug, width, guide.base);
  if (!res) throw new Error(`compute failed: ${guide.slug}@${width}`);
  const pa = res.placed.find((p) => p.label === a);
  const pb = res.placed.find((p) => p.label === b);
  if (!pa || !pb) throw new Error(`no piece ${a}/${b} on ${guide.slug}`);
  return pa.y === pb.y;
}

/**
 * 固定寸法（base）での各生地幅の結果。幅不足（その幅では裁てない）の生地幅は含めない。
 * @param {GarmentGuide} guide
 * @returns {Cell[]}
 */
export function baseCells(guide) {
  return FABRIC_WIDTHS.flatMap((w) => {
    const res = computeYardage(guide.slug, w, guide.base);
    if (!res) throw new Error(`compute failed: ${guide.slug}@${w}`);
    if (res.widthShortage) return [];
    return [{ fabricWidth: w, totalCm: res.totalCm, totalM: res.totalM, widthShortage: false }];
  });
}

/**
 * 種別ページの「表から導いた注記」。ページとテストが同じ入口を通るよう、ここで組み立てる。
 * @param {GarmentGuide} guide
 * @returns {string[]}
 */
export function derivedTipsFor(guide) {
  return (
    guide.derivedTips?.({
      axisSpan: (key) => axisSpanMeters(guide, key),
      axisEnds: (key) => axisEnds(guide, key),
      axisSteps: (key) => axisSteps(guide, key),
      axisIncrements: (key) => axisIncrements(guide, key),
      axisStep: (key) => axisStep(guide, key),
      flatWidths: (key, fromRow) => flatWidths(guide, key, fromRow),
      baseCells: () => baseCells(guide),
      sideBySide: (width, a, b) => sideBySide(guide, width, a, b),
      m: (v) => `${v.toFixed(1)}m`,
    }) ?? []
  );
}

/**
 * ある軸で「動かした寸法が最小のとき」と「最大のとき」の用尺差を、生地幅ごとに実測する。
 * 本文で「◯m 変わります」と書くための値をここから取り、手書きしない。
 * @param {GarmentGuide} guide
 * @param {string} axisKey
 * 幅不足のセルは除外する。比べられる生地幅が 1 つも無ければ null（注記を出さない）。
 * @returns {{min: number, max: number} | null} 差の m 表記の最小・最大
 */
export function axisSpanMeters(guide, axisKey) {
  const axis = guide.axes.find((a) => a.key === axisKey);
  if (!axis) throw new Error(`no axis ${axisKey} on ${guide.slug}`);
  const table = buildTable(guide, axis);
  const first = table.rows[0];
  const last = table.rows[table.rows.length - 1];
  if (!first || !last) throw new Error(`empty axis ${axisKey} on ${guide.slug}`);
  if (first.cells.length !== last.cells.length) throw new Error(`missing cell on ${guide.slug}`);
  return spanOfCells(first.cells, last.cells);
}

/**
 * 2 行のセルから生地幅ごとの差(m)の最小・最大を取る。「幅が足りない」セル（表では — と出る）は
 * 数値を本文に使わないので除き、比べられる生地幅が 1 つも無ければ null。
 * @param {Cell[]} firstCells
 * @param {Cell[]} lastCells
 * @returns {{min: number, max: number} | null}
 */
export function spanOfCells(firstCells, lastCells) {
  const diffs = firstCells.flatMap((a, i) => {
    const b = lastCells[i];
    if (!b) return [];
    return a.widthShortage || b.widthShortage ? [] : [b.totalM - a.totalM];
  });
  if (diffs.length === 0) return null;
  return { min: Math.min(...diffs), max: Math.max(...diffs) };
}
