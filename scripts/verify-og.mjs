// ビルド成果物（out/）に OGP 画像が実際に載っているか、早見表の全ページが出ているかを検査する。
//
// なぜソースではなく成果物を見るか:
//   metadata をソース文字列で検査すると「書き方」を縛ることになる。共通化した
//   とたんに落ちる一方、ヘルパー越しに画像なしのページを足しても素通りする。
//   実際に配信される HTML を見れば、書き方に関係なく「画像が載っているか」
//   「basePath を含む絶対 URL になっているか」を直接確かめられる。
//
// 実行: pnpm check:og（build と検査の両方に PAGES_BASE_PATH=/yoshaku-calc を渡す。CI と同じ条件）
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeBasePath, siteRoot } from "../lib/url.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = join(root, "out");

// オリジンとサイト名は .ts の実物から読む（写すと改名した日にここだけ落ちる）。
// .mjs から .ts は import できないので正規表現で拾う。前方のコメントに旧値が
// 残っていると String.match が先頭一致でそれを拾うため、行コメントを落としてから読む。
const readSource = (rel) =>
  readFileSync(join(root, rel), "utf8").replace(/^\s*\/\/.*$/gm, "");

const ORIGIN = readSource("app/site.ts").match(/const ORIGIN = "([^"]+)"/)?.[1];
const SITE_NAME = readSource("app/og.ts").match(/siteName: "([^"]+)"/)?.[1];
if (!ORIGIN || !SITE_NAME) {
  console.error("verify-og: app/site.ts の ORIGIN か app/og.ts の siteName を読めない");
  process.exit(1);
}
// 本体（next.config.mjs / app/site.ts）と同じ正規化を通す。生の env を連結すると、
// "/x/" や "x" で本体と検査の期待値がずれて、正しい成果物を誤って落とす／ずれたまま通す。
const BASE = siteRoot(ORIGIN, process.env.PAGES_BASE_PATH).replace(/\/$/, "");
const EXPECTED = `${BASE}/og.png`;

// 404 は URL を持たないページなので、配信 URL との突き合わせから外す。
// canonical の有無で推測すると外れる（404 も layout の canonical を継承している）。
// 推測せず、出力パスを名指しで例外にする。
const NO_URL_PAGES = new Set(["404.html", "404/index.html"]);

let failed = false;
const fail = (msg) => {
  console.error(`verify-og: ${msg}`);
  failed = true;
};

if (!existsSync(outDir)) {
  console.error("verify-og: out/ が無い。先に pnpm build を実行すること");
  process.exit(1);
}

// 画像そのものが配信対象に含まれているか。public/ の実ファイルは og.png が
// 最初なので、「public/ が basePath 配下に出る」経路をここで初めて踏む。
if (!existsSync(join(outDir, "og.png"))) {
  fail("out/og.png が無い（public/ が出力に含まれていない）");
}

const pages = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".html")) pages.push(full);
  }
};
walk(outDir);

// 404 も layout から OGP を継承しており、検査対象に含める。
// trailingSlash: true のため 404 は out/404.html と out/404/index.html の2つ出る。
// 片方だけ除外すると「除外したつもり」で残った側が落ちるので、除外はしない。
const targets = pages;
if (targets.length === 0) fail("検査対象の HTML が 1 つも無い");

for (const page of targets) {
  const html = readFileSync(page, "utf8");
  const rel = relative(outDir, page);
  const where = relative(root, page);
  const pick = (re) => html.match(re)?.[1] ?? "なし";
  const og = pick(/<meta property="og:image" content="([^"]+)"/);
  const tw = pick(/<meta name="twitter:image" content="([^"]+)"/);
  const card = pick(/<meta name="twitter:card" content="([^"]+)"/);

  if (og !== EXPECTED) fail(`${where}: og:image が期待値と違う（実値 ${og} / 期待 ${EXPECTED}）`);
  if (tw !== EXPECTED) fail(`${where}: twitter:image が期待値と違う（実値 ${tw} / 期待 ${EXPECTED}）`);
  if (card !== "summary_large_image") fail(`${where}: twitter:card が ${card}`);

  // ここからが、この増分が本来止めたい故障モード。
  // page 側で openGraph を書くと layout のものが丸ごと置き換わるので、画像だけ
  // 書いて url / site_name / type を落とすことが起きる。画像しか見ないと素通りする。
  const site = pick(/<meta property="og:site_name" content="([^"]+)"/);
  const type = pick(/<meta property="og:type" content="([^"]+)"/);
  if (site !== SITE_NAME) fail(`${where}: og:site_name が ${site}（期待 ${SITE_NAME}）`);
  if (!["website", "article"].includes(type)) fail(`${where}: og:type が ${type}`);

  if (NO_URL_PAGES.has(rel)) continue;

  // og:url は Facebook / LinkedIn 側の正規化キー、canonical は検索側の正規化キー。
  // 両者が一致しているかだけを見ると、ページを複製したときに canonical と url を
  // 揃って複製元のまま残す——最も起きやすいミス——が素通りする。
  // そこで「この HTML がどの URL で配信されるか」を出力パスから導き、両方をそれに
  // 突き合わせる。自己整合ではなく配信先との整合を見る。
  const expectedUrl = `${BASE}/${rel.replace(/index\.html$/, "")}`;
  const ogUrl = pick(/<meta property="og:url" content="([^"]+)"/);
  const canonical = pick(/<link rel="canonical" href="([^"]+)"\s*\/?>/);
  if (ogUrl !== expectedUrl) fail(`${where}: og:url が ${ogUrl}（配信先は ${expectedUrl}）`);
  if (canonical !== expectedUrl) fail(`${where}: canonical が ${canonical}（配信先は ${expectedUrl}）`);
}

// 早見表は GUIDES の全種別ぶんが出力され、サイトマップにも載っていること。
// 上の検査は「出たページ」しか見ないので、種別を足してページが出なかった場合は素通りする。
// 期待するページの一覧はソースの GUIDES から取り、成果物と突き合わせる。
const { GUIDES } = await import("../app/yardage/presets.mjs");
const sitemapPath = join(outDir, "sitemap.xml");
const sitemap = existsSync(sitemapPath) ? readFileSync(sitemapPath, "utf8") : "";
if (!sitemap) fail("out/sitemap.xml が無い");
// 全 <loc> が配信先の下にあり、スラッシュが二重になっていないこと。トップと早見表一覧も載っていること。
for (const [, loc] of sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)) {
  if (!loc.startsWith(`${BASE}/`) || loc.slice("https://".length).includes("//")) {
    fail(`sitemap.xml の <loc> ${loc} が配信先 ${BASE}/ の下の正しい URL でない`);
  }
}
for (const url of [`${BASE}/`, `${BASE}/yardage/`]) {
  if (sitemap && !sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap.xml に ${url} が無い`);
}
// robots.txt の Sitemap 行が配信先の sitemap.xml を指していること。
const robotsPath = join(outDir, "robots.txt");
const robots = existsSync(robotsPath) ? readFileSync(robotsPath, "utf8") : "";
if (!robots.split(/\r?\n/).includes(`Sitemap: ${BASE}/sitemap.xml`)) {
  fail(`out/robots.txt に Sitemap: ${BASE}/sitemap.xml の行が無い`);
}
for (const { slug } of GUIDES) {
  const rel = join("yardage", slug, "index.html");
  if (!pages.includes(join(outDir, rel))) fail(`out/${rel} が無い（早見表 ${slug} が出力されていない）`);
  const url = `${BASE}/yardage/${slug}/`;
  if (sitemap && !sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap.xml に ${url} が無い`);
}

// サイト内リンクの行き先が out/ に実在すること。
// リンクの組み立て（href のテンプレート）を壊してもビルドは通り、壊れたリンクがそのまま
// 配信される。ソースの書き方ではなく、出力された <a href> を実ファイルと突き合わせる。
//   - basePath 配下の絶対パス: URL の規則で正規化し（クエリ・フラグメントを落とし、. や .. を
//     URL として解決する）、ディレクトリなら index.html を探す。out/ の外に出るものは壊れたリンク
//   - ページ内リンク（#id）: 同じ HTML に id 属性としてその値があること（data-testid 等には一致させない）
//   - 外部 URL（http(s)://・mailto: 等）は対象外
//   - basePath の外を指すルート相対パスは、配信先では別サイトに飛ぶので壊れたリンクとして扱う。
//     例外は 404 ページの href="/" だけ（既知の問題で、別に直す。ここで黙って許す範囲を広げない）。
const BASE_PATH = normalizeBasePath(process.env.PAGES_BASE_PATH);
const KNOWN_BROKEN = new Map([...NO_URL_PAGES].map((p) => [p, new Set(["/"])]));
const outRoot = resolve(outDir);
let linkCount = 0;
let knownCount = 0;
/** 正規表現の特殊文字をエスケープする（id をそのまま埋め込むため）。 */
const escapeRe = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** %xx を戻す。壊れた符号化は fail に流して null を返し、検査は続ける。 */
const decode = (rel, href, str) => {
  try {
    return decodeURIComponent(str);
  } catch {
    fail(`${rel}: リンク ${href} の % 符号化が壊れている`);
    return null;
  }
};
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const rel = relative(outDir, page);
  for (const m of html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
    const href = (m[1] ?? "").replace(/&amp;/g, "&");
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;
    if (KNOWN_BROKEN.get(rel)?.has(href)) {
      knownCount += 1;
      continue;
    }
    linkCount += 1;
    if (href.startsWith("#")) {
      const id = decode(rel, href, href.slice(1));
      if (id === null) continue;
      if (!id || !new RegExp(`\\sid="${escapeRe(id)}"`).test(html)) {
        fail(`${rel}: ページ内リンク ${href} の行き先が無い`);
      }
      continue;
    }
    if (!href.startsWith("/")) {
      fail(`${rel}: 相対パスのリンク ${href}（サイト内リンクは basePath 付きの絶対パスで出る想定）`);
      continue;
    }
    const path = new URL(href, "https://x").pathname;
    if (BASE_PATH && path !== BASE_PATH && !path.startsWith(`${BASE_PATH}/`)) {
      fail(`${rel}: リンク ${href} が basePath（${BASE_PATH}）の外を指している`);
      continue;
    }
    const decoded = decode(rel, href, path.slice(BASE_PATH.length));
    if (decoded === null) continue;
    const inner = decoded.replace(/^\/+/, "");
    const target = resolve(outRoot, inner);
    if (target !== outRoot && !target.startsWith(outRoot + sep)) {
      fail(`${rel}: リンク ${href} が out/ の外を指している`);
      continue;
    }
    const exists =
      (existsSync(target) && statSync(target).isFile()) || existsSync(join(target, "index.html"));
    if (!exists) fail(`${rel}: リンク ${href} の行き先 out/${inner} が無い`);
  }
}
if (linkCount === 0) fail("検査したサイト内リンクが 1 つも無い");

// トップの「生地幅の比較表」に出る作業幅・並べる幅が、計算本体（computeYardage）の
// 結果と一致すること。表は読み物の静的テキストで、計算とは別の経路で数字が出るため、
// 一方だけ直すと表と計算結果の図が食い違ったまま配信される。出力された HTML の表を読む。
{
  const { computeYardage, FABRIC_WIDTHS, GARMENTS } = await import("../lib/calc.mjs");
  const topPath = join(outDir, "index.html");
  const top = existsSync(topPath) ? readFileSync(topPath, "utf8") : "";
  const table = top.match(/<table class="guide-table">([\s\S]*?)<\/table>/)?.[1];
  if (!table) {
    fail("out/index.html に生地幅の比較表が無い");
  } else {
    const text = (cell) => cell.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "").trim();
    const rows = [...table.matchAll(/<tr><th scope="row">([^<]*(?:<!-- -->[^<]*)*)<\/th>((?:<td>[\s\S]*?<\/td>)+)<\/tr>/g)].map((m) => ({
      width: text(m[1]),
      cells: [...m[2].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => text(c[1])),
    }));
    if (rows.length !== FABRIC_WIDTHS.length) {
      fail(`生地幅の比較表の行数が ${rows.length}（期待 ${FABRIC_WIDTHS.length}）`);
    }
    for (const w of FABRIC_WIDTHS) {
      const row = rows.find((r) => r.width === `${w}cm`);
      if (!row) {
        fail(`生地幅の比較表に ${w}cm の行が無い`);
        continue;
      }
      // 全衣服で同じ値になること自体も確かめる（衣服ごとに作業幅が違う設計になったら表が嘘になる）。
      for (const g of GARMENTS) {
        const res = computeYardage(g.id, w, {});
        const [working, usable] = row.cells.slice(-2);
        if (working !== `${res.workingWidth}cm`) {
          fail(`生地幅の比較表: ${w}cm の作業幅が ${working}（${g.id} の計算は ${res.workingWidth}cm）`);
        }
        if (usable !== `${res.usableWidth}cm`) {
          fail(`生地幅の比較表: ${w}cm の並べる幅が ${usable}（${g.id} の計算は ${res.usableWidth}cm）`);
        }
      }
    }
  }
}

if (failed) process.exit(1);
console.log(`verify-og: ${targets.length} ページすべてに ${EXPECTED} が載っている（サイト内リンク ${linkCount} 件の行き先も確認・既知の除外 ${knownCount} 件）`);
