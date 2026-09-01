// 用尺早見表のデータ定義。
//
// ここに用尺の「数字」は書かない。表に出る値はすべて lib/calc.mjs の computeYardage() を
// ビルド時に呼んで生成する。読み物に手で書いた数値が計算機の実出力と食い違う事故を
// 構造的に起こせなくするための設計。
//
// このファイルが持つのは「どの条件を並べて見せるか」だけ:
//   base = 固定する寸法 / axes = 1 つだけ動かす寸法とその段階。

import { FABRIC_WIDTHS, computeYardage, getGarment } from "@/lib/calc.mjs";

/** 表の 1 行が表す寸法の値。 */
export type AxisRow = {
  /** 動かす入力の値(cm)。 */
  value: number;
  /** 行見出し（例: "88cm"）。 */
  label: string;
};

/** 1 つの表 = 「1 つの寸法だけ動かし、生地幅 3 種を横に並べる」。 */
export type Axis = {
  /** 動かす入力キー（garment.inputs の key と一致させる）。 */
  key: string;
  /** 表のキャプション。 */
  caption: string;
  /** 行見出し列のラベル（例: "バスト"）。 */
  rowHeader: string;
  /** 固定した寸法の説明。 */
  fixedNote: string;
  rows: AxisRow[];
};

/** 1 ページぶんの定義。 */
export type GarmentGuide = {
  /** URL スラッグ = 計算機の garment id と同じにして、深いリンクを素直に作る。 */
  slug: string;
  /** 検索で使われる言い回し（title/h1 に使う）。 */
  searchName: string;
  /** ページの説明文（meta description）。 */
  description: string;
  /** 導入文。 */
  lead: string;
  /** 何を裁つのか（パーツ構成の説明）。 */
  pieces: string;
  /** 固定する寸法。 */
  base: Record<string, number>;
  axes: Axis[];
  /** この衣服ならではの注意。 */
  tips: string[];
};

export const GUIDES: GarmentGuide[] = [
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
      "袖の有無は用尺に大きく効きます。同じ着丈でも、ノースリーブと長袖では 1m 前後変わります。半袖で足りるなら、その差がそのまま生地代の差になります。",
    ],
  },
  {
    slug: "dress",
    searchName: "ワンピース",
    description:
      "ワンピースに必要な生地の長さ（用尺）を、総丈・バストと生地幅 90／110／140cm の組み合わせで一覧にした早見表。生地を買う前の見積りに。",
    lead: "ワンピースは身頃を通し丈で裁つため、必要な長さがほぼそのまま総丈に比例して伸びます。5 種のなかで最も生地を使う衣服です。",
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
      "丈を伸ばしたときの効き方は生地幅で変わります。前身頃と後身頃が縦に積まれる 90・110cm 幅では、丈を 15cm 伸ばすと必要な長さは 2 枚ぶんの 30cm 増えます。身頃が横に並ぶ 140cm 幅なら、増えるのは伸ばした 15cm ぶんだけです。",
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
      "前後スカートが横に並べば、必要な長さはスカート丈 1 枚ぶんで済みます。並ばなければ 2 枚ぶん積むことになり、必要な長さはおよそ倍になります。この段差が生地幅を選ぶ意味です。",
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
    lead: "ジャケットは縫い代とゆとりが大きく、身頃 1 枚あたりの幅を最も食う衣服です。90cm 幅では身頃が収まらないこともあります。",
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

/** 表の 1 セル = ある生地幅での結果。 */
export type Cell = {
  fabricWidth: number;
  totalCm: number;
  totalM: number;
  /** パーツが生地幅に収まらない（はぎ合わせが要る）。 */
  widthShortage: boolean;
};

/** 表の 1 行 = 行見出し + 生地幅ごとのセル + 計算機への深いリンク。 */
export type TableRow = {
  label: string;
  cells: Cell[];
  /** その条件を計算機で開くクエリ文字列（先頭の ? を含む）。 */
  query: string;
};

export type BuiltTable = {
  caption: string;
  rowHeader: string;
  fixedNote: string;
  widths: number[];
  rows: TableRow[];
};

/** 深いリンクを開くときの既定の生地幅（店頭で最も一般的な標準幅）。 */
const LINK_WIDTH = 110;

/** 計算機（トップページ）でその条件を開くためのクエリ。 */
function queryFor(slug: string, values: Record<string, number>, width: number) {
  const params = new URLSearchParams();
  params.set("g", slug);
  params.set("w", String(width));
  for (const [k, v] of Object.entries(values)) params.set(k, String(v));
  return `?${params.toString()}`;
}

/**
 * 表を組み立てる。数値はすべて computeYardage() の実出力。
 * 種別 id や入力キーが計算エンジンとズレていればここで例外になり、ビルドが落ちる。
 */
export function buildTable(guide: GarmentGuide, axis: Axis): BuiltTable {
  const garment = getGarment(guide.slug);
  if (!garment) throw new Error(`unknown garment id: ${guide.slug}`);
  if (!garment.inputs.some((i) => i.key === axis.key)) {
    throw new Error(`unknown input key: ${guide.slug}.${axis.key}`);
  }

  const rows: TableRow[] = axis.rows.map((row) => {
    const values = { ...guide.base, [axis.key]: row.value };
    const cells: Cell[] = FABRIC_WIDTHS.map((w) => {
      const res = computeYardage(guide.slug, w, values);
      if (!res) throw new Error(`compute failed: ${guide.slug}@${w}`);
      return {
        fabricWidth: w,
        totalCm: res.totalCm,
        totalM: res.totalM,
        widthShortage: res.widthShortage,
      };
    });
    return { label: row.label, cells, query: queryFor(guide.slug, values, LINK_WIDTH) };
  });

  return {
    caption: axis.caption,
    rowHeader: axis.rowHeader,
    fixedNote: axis.fixedNote,
    widths: [...FABRIC_WIDTHS],
    rows,
  };
}

/** slug から定義を引く。 */
export function getGuide(slug: string): GarmentGuide | null {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}
