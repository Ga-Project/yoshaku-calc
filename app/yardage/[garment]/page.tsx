// 衣服別の用尺早見表（静的 1 ページ／種別）。
//
// 計算機は「自分の寸法を入れて 1 つの答えを得る」道具だが、買い物の前段では
// 「だいたい何 m 買えばいいのか」「幅を変えるとどれだけ違うのか」を先に知りたい。
// このページはその問いに、入力なしで答える。数値はすべてビルド時に
// computeYardage() を呼んで作るため、計算機の答えと必ず一致する。

import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "../../JsonLd";
import { SITE_URL } from "../../site";
import { OG_IMAGE } from "../../og";
import {
  GUIDES,
  LINK_WIDTH,
  axisSpanMeters,
  buildTable,
  getGuide,
} from "../presets.mjs";
// presets.mjs の JSDoc @typedef は allowJs で型として読める。
import type { BuiltTable } from "../presets.mjs";
import { Crumbs, Footer, Plate, Sheet } from "../Chrome";
import "../yardage.css";

export const dynamic = "force-static";

/** 生地幅の呼び名（トップの表と同じ言い回しを使う）。 */
const WIDTH_KIND: Record<number, string> = {
  90: "シングル幅",
  110: "標準幅",
  140: "ダブル幅",
};

export function generateStaticParams() {
  return GUIDES.map((g) => ({ garment: g.slug }));
}

type Params = { params: { garment: string } };

export function generateMetadata({ params }: Params): Metadata {
  const guide = getGuide(params.garment);
  if (!guide) return {};
  const title = `${guide.searchName}の用尺早見表｜生地幅90・110・140cmで必要な生地の長さ`;
  const path = `yardage/${guide.slug}/`;
  return {
    title,
    description: guide.description,
    alternates: { canonical: `/${path}` },
    openGraph: {
      title,
      description: guide.description,
      type: "article",
      locale: "ja_JP",
      url: `${SITE_URL}${path}`,
      siteName: "用尺カルク",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: guide.description,
      images: [OG_IMAGE.url],
    },
  };
}

export default function GarmentYardagePage({ params }: Params) {
  const guide = getGuide(params.garment);
  // generateStaticParams が返した slug しか生成されないため、ここは通らない。
  if (!guide) return null;

  const tables = guide.axes.map((axis) => buildTable(guide, axis));
  // 数値を含む注記は表から導出する（手書きすると同じページの表と食い違う）。
  const derived =
    guide.derivedTips?.({
      axisSpan: (key: string) => axisSpanMeters(guide, key),
      m: (v: number) => `${v.toFixed(1)}m`,
    }) ?? [];
  const title = `${guide.searchName}の用尺早見表`;
  const path = `yardage/${guide.slug}/`;

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "用尺カルク", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "用尺早見表", item: `${SITE_URL}yardage/` },
      { "@type": "ListItem", position: 3, name: title, item: `${SITE_URL}${path}` },
    ],
  };

  return (
    <Sheet>
      <JsonLd nodes={[breadcrumb]} />
      <Plate />
      <Crumbs
        trail={[
          { href: "/", label: "用尺カルク" },
          { href: "/yardage/", label: "用尺早見表" },
          { label: guide.searchName },
        ]}
      />

      <main id="main" className="paper">
        <h1 className="paper-title">
          {guide.searchName}の<span className="mark">用尺</span>早見表
        </h1>
        <p className="paper-lead">{guide.lead}</p>

        <p className="paper-note">
          <strong>裁つパーツ</strong>：{guide.pieces}
        </p>

        {tables.map((table) => (
          <YardageTable key={table.caption} table={table} />
        ))}

        <section className="paper-section" aria-labelledby="tips-head">
          <h2 id="tips-head">{guide.searchName}で気をつけたいこと</h2>
          <ul className="guide-list">
            {[...derived, ...guide.tips].map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
            <li>
              表の数値は水通しの縮みぶんを含みません。綿・麻はおおむね 3〜5%
              縮むので、水通しをする生地はそのぶんを足して購入してください。
            </li>
          </ul>
        </section>

        <section className="paper-cta" aria-labelledby="cta-head">
          <h2 id="cta-head">自分の寸法で確かめる</h2>
          <p>
            表は代表的な寸法での目安です。手持ちの型紙の実寸を入れると、
            必要な長さと裁断の取り方を図で確認できます。
          </p>
          <Link className="btn btn-primary" href={`/?g=${guide.slug}`}>
            {guide.searchName}の裁断図をつくる
          </Link>
        </section>

        <nav className="paper-siblings" aria-label="ほかの衣服の早見表">
          <h2>ほかの衣服の早見表</h2>
          <ul>
            {GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
              <li key={g.slug}>
                <Link href={`/yardage/${g.slug}/`}>{g.searchName}の用尺早見表</Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>

      <Footer />
    </Sheet>
  );
}

/** 用尺表 1 つ。行 = 寸法の段階、列 = 生地幅。 */
function YardageTable({ table }: { table: BuiltTable }) {
  const hasShortage = table.rows.some((r) => r.cells.some((c) => c.widthShortage));
  return (
    <section className="paper-section" aria-labelledby={headingId(table.caption)}>
      <h2 id={headingId(table.caption)}>{table.caption}</h2>
      <p className="paper-note">{table.fixedNote}（10cm 単位に切り上げた購入の目安）。</p>

      {/* 横スクロール領域はキーボードでも送れるよう、フォーカス可能な region にする */}
      {/* 横スクロール領域はキーボードでも送れるよう、フォーカス可能な region にする。
          名前は見出しを参照させ、同じ文言を読み上げで重複させない。 */}
      <div
        className="guide-table-wrap"
        tabIndex={0}
        role="region"
        aria-labelledby={headingId(table.caption)}
      >
        <table className="guide-table yardage-table">
          <thead>
            <tr>
              <th scope="col">{table.rowHeader}</th>
              {table.widths.map((w) => (
                <th scope="col" key={w}>
                  生地幅 {w}cm
                  <small>{WIDTH_KIND[w] ?? ""}</small>
                </th>
              ))}
              <th scope="col">
                裁断図
                <small>生地幅 {LINK_WIDTH}cm</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell) =>
                  cell.widthShortage ? (
                    // パーツがこの幅に収まらない条件。長さの数字を出すと、はぎ合わせ代を
                    // 含まない値を「これだけ買えば足りる」と読まれるので数値は出さない。
                    <td key={cell.fabricWidth} className="yardage-na">
                      <span aria-hidden="true">—</span>
                      <span className="badge badge-warn yardage-warn">幅が足りない</span>
                      <span className="sr-only">この生地幅では裁てません</span>
                    </td>
                  ) : (
                    <td key={cell.fabricWidth} className="tabular">
                      <span className="yardage-m">{cell.totalM.toFixed(1)}m</span>
                      <small>{cell.totalCm}cm</small>
                    </td>
                  ),
                )}
                <td>
                  <Link className="yardage-open" href={`/${row.query}`}>
                    裁断図
                    <span className="sr-only">
                      （{row.label}・生地幅{LINK_WIDTH}cm）
                    </span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasShortage && (
        <p className="paper-note">
          「幅が足りない」は、そのサイズのパーツが二つ折りにした生地の幅に収まらず、
          その幅では裁てないことを表します。より広い生地を選ぶか、はぎ合わせを前提に
          型紙を割ってください。はぎ合わせに必要な追加分は表に含めていません。
        </p>
      )}
    </section>
  );
}

/** キャプションから安定した見出し ID を作る（英数以外は落とす）。 */
function headingId(caption: string) {
  let h = 0;
  for (let i = 0; i < caption.length; i += 1) {
    h = (h * 31 + caption.charCodeAt(i)) >>> 0;
  }
  return `t-${h.toString(36)}`;
}
