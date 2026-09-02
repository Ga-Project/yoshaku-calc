// 用尺早見表の入口。5 種別への導線と、種別どうしの必要量の違いを 1 枚で見せる。

import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "../JsonLd";
import { SITE_URL } from "../site";
import { getGarment } from "@/lib/calc.mjs";
import { GUIDES, buildOverview } from "./presets.mjs";
import { Crumbs, Footer, Plate, Sheet } from "./Chrome";
import "./yardage.css";

export const dynamic = "force-static";

const TITLE = "衣服別の用尺早見表｜生地幅90・110・140cmで必要な生地の長さ";
const DESC =
  "シャツ・ワンピース・スカート・パンツ・ジャケットの用尺（必要な生地の長さ）を、生地幅 90／110／140cm ごとに一覧にした早見表。入力なしで、買う前のおおよその長さが分かります。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/yardage/" },
  openGraph: {
    title: TITLE,
    description: DESC,
    type: "article",
    locale: "ja_JP",
    url: `${SITE_URL}yardage/`,
    siteName: "用尺カルク",
  },
  twitter: { card: "summary", title: TITLE, description: DESC },
};

export default function YardageIndex() {
  // 代表寸法（各種別の base）での比較。種別ごとに寸法の意味が違うので、
  // 「その種別の標準的な一着」を横に並べる表として読む。
  // 代表行の照合・生地幅ごとの開き（spread）はすべて presets 側で実測する。
  const { rows: overview, widths, spread } = buildOverview();

  // 「どれくらい違うか」は表から導く。文章に倍率を手で書くと、寸法の刻みを
  // 変えた瞬間に同じページの表と食い違う。
  const minRatio = Math.min(...spread.map((s) => s.ratio));
  const maxRatio = Math.max(...spread.map((s) => s.ratio));

  const itemList = {
    "@type": "ItemList",
    name: "衣服別の用尺早見表",
    itemListElement: GUIDES.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${g.searchName}の用尺早見表`,
      url: `${SITE_URL}yardage/${g.slug}/`,
    })),
  };
  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "用尺カルク", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "用尺早見表", item: `${SITE_URL}yardage/` },
    ],
  };

  return (
    <Sheet>
      <JsonLd nodes={[breadcrumb, itemList]} />
      <Plate />
      <Crumbs trail={[{ href: "/", label: "用尺カルク" }, { label: "用尺早見表" }]} />

      <main id="main" className="paper">
        <h1 className="paper-title">
          衣服別の<span className="mark">用尺</span>早見表
        </h1>
        <p className="paper-lead">
          「この服なら生地は何 m 買えばいいのか」を、寸法を入力しなくても確かめられる一覧です。
          数値は計算機とまったく同じ計算式から作っています。
        </p>

        <section className="paper-section" aria-labelledby="overview-head">
          <h2 id="overview-head">代表的な一着で比べる</h2>
          <p className="paper-note">
            各種別の標準的な寸法での必要量です。同じ生地幅でも、衣服によって
            {minRatio.toFixed(1)}〜{maxRatio.toFixed(1)} 倍の開きがあります。
            固定した寸法は衣服ごとのページに書いてあります。
          </p>
          <div
            className="guide-table-wrap"
            tabIndex={0}
            role="region"
            aria-labelledby="overview-head"
          >
            <table className="guide-table yardage-table">
              <thead>
                <tr>
                  <th scope="col">衣服</th>
                  {widths.map((w) => (
                    <th scope="col" key={w}>
                      生地幅 {w}cm
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.map(({ guide, cells }) => (
                  <tr key={guide.slug}>
                    <th scope="row">
                      <Link href={`/yardage/${guide.slug}/`}>
                        <span className="yardage-emoji" aria-hidden="true">
                          {getGarment(guide.slug)?.emoji}
                        </span>
                        {guide.searchName}
                      </Link>
                    </th>
                    {cells.map((cell) =>
                      cell.widthShortage ? (
                        <td key={cell.fabricWidth} className="yardage-na">
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">この生地幅では裁てません</span>
                        </td>
                      ) : (
                        <td key={cell.fabricWidth} className="tabular">
                          <span className="yardage-m">{cell.totalM.toFixed(1)}m</span>
                          <small>{cell.totalCm}cm</small>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="paper-section" aria-labelledby="list-head">
          <h2 id="list-head">衣服別の早見表</h2>
          <ul className="yardage-cards">
            {GUIDES.map((guide) => (
              <li key={guide.slug}>
                <Link className="yardage-card" href={`/yardage/${guide.slug}/`}>
                  <span className="yardage-card-title">
                    <span className="yardage-emoji" aria-hidden="true">
                      {getGarment(guide.slug)?.emoji}
                    </span>
                    {guide.searchName}の用尺早見表
                  </span>
                  <span className="yardage-card-desc">{guide.lead}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="paper-cta" aria-labelledby="cta-head">
          <h2 id="cta-head">自分の寸法で確かめる</h2>
          <p>
            型紙の実寸を入れると、必要な長さと裁断の取り方を図で確認できます。
          </p>
          <Link className="btn btn-primary" href="/">
            裁断図をつくる
          </Link>
        </section>
      </main>

      <Footer />
    </Sheet>
  );
}
