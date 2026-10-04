// ビルド成果物（out/）に OGP 画像が実際に載っているか、早見表の全ページが出ているかを検査する。
//
// なぜソースではなく成果物を見るか:
//   metadata をソース文字列で検査すると「書き方」を縛ることになる。共通化した
//   とたんに落ちる一方、ヘルパー越しに画像なしのページを足しても素通りする。
//   実際に配信される HTML を見れば、書き方に関係なく「画像が載っているか」
//   「basePath を含む絶対 URL になっているか」を直接確かめられる。
//
// 実行: PAGES_BASE_PATH=/yoshaku-calc pnpm build && node scripts/verify-og.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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
const BASE = `${ORIGIN}${process.env.PAGES_BASE_PATH || ""}`;
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
for (const { slug } of GUIDES) {
  const rel = join("yardage", slug, "index.html");
  if (!pages.includes(join(outDir, rel))) fail(`out/${rel} が無い（早見表 ${slug} が出力されていない）`);
  const url = `${BASE}/yardage/${slug}/`;
  if (sitemap && !sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap.xml に ${url} が無い`);
}

// サイト内リンクの行き先が out/ に実在すること。
// リンクの組み立て（href のテンプレート）を壊してもビルドは通り、壊れたリンクがそのまま
// 配信される。ソースの書き方ではなく、出力された <a href> を実ファイルと突き合わせる。
//   - basePath 配下の絶対パス: クエリ・フラグメントを落とし、ディレクトリなら index.html を探す
//   - ページ内リンク（#id）: 同じ HTML にその id があること
//   - 外部 URL（http(s)://・mailto: 等）は対象外
//   - basePath の外を指すルート相対パスは、配信先では別サイトに飛ぶので壊れたリンクとして扱う。
//     例外は 404 ページの href="/" だけ（既知の問題で、別に直す。ここで黙って許す範囲を広げない）。
const BASE_PATH = process.env.PAGES_BASE_PATH || "";
const KNOWN_BROKEN = new Map([...NO_URL_PAGES].map((p) => [p, new Set(["/"])]));
let linkCount = 0;
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const rel = relative(outDir, page);
  for (const m of html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
    const href = (m[1] ?? "").replace(/&amp;/g, "&");
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;
    linkCount += 1;
    if (href.startsWith("#")) {
      const id = href.slice(1);
      if (!id || !html.includes(`id="${id}"`)) fail(`${rel}: ページ内リンク ${href} の行き先が無い`);
      continue;
    }
    if (!href.startsWith("/")) {
      fail(`${rel}: 相対パスのリンク ${href}（サイト内リンクは basePath 付きの絶対パスで出る想定）`);
      continue;
    }
    if (KNOWN_BROKEN.get(rel)?.has(href)) continue;
    const path = href.replace(/[?#].*$/, "");
    if (BASE_PATH && path !== BASE_PATH && !path.startsWith(`${BASE_PATH}/`)) {
      fail(`${rel}: リンク ${href} が basePath（${BASE_PATH}）の外を指している`);
      continue;
    }
    const inner = decodeURIComponent(path.slice(BASE_PATH.length)).replace(/^\/+/, "");
    const target = join(outDir, inner);
    const exists =
      (existsSync(target) && statSync(target).isFile()) || existsSync(join(target, "index.html"));
    if (!exists) fail(`${rel}: リンク ${href} の行き先 out/${inner} が無い`);
  }
}
if (linkCount === 0) fail("検査したサイト内リンクが 1 つも無い");

if (failed) process.exit(1);
console.log(`verify-og: ${targets.length} ページすべてに ${EXPECTED} が載っている（サイト内リンク ${linkCount} 件の行き先も確認）`);
