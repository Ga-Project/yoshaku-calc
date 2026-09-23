// ビルド成果物（out/）に OGP 画像が実際に載っているかを検査する。
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

// オリジンは app/site.ts から読む（写すと独自ドメインへ移した日にここだけ落ちる）。
// .mjs から .ts は import できないので、test/og.test.mjs と同じ読み方に揃える。
const ORIGIN = readFileSync(join(root, "app/site.ts"), "utf8").match(/const ORIGIN = "([^"]+)"/)?.[1];
if (!ORIGIN) {
  console.error("verify-og: app/site.ts から ORIGIN を読めない");
  process.exit(1);
}
const BASE = `${ORIGIN}${process.env.PAGES_BASE_PATH || ""}`;
const EXPECTED = `${BASE}/og.png`;

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
  const ogUrl = pick(/<meta property="og:url" content="([^"]+)"/);
  const site = pick(/<meta property="og:site_name" content="([^"]+)"/);
  const type = pick(/<meta property="og:type" content="([^"]+)"/);
  if (site !== "用尺カルク") fail(`${where}: og:site_name が落ちている（実値 ${site}）`);
  if (!["website", "article"].includes(type)) fail(`${where}: og:type が ${type}`);

  // og:url は Facebook / LinkedIn 側の正規化キー。canonical と食い違うと、
  // そのページのシェアが別ページに吸われる。socialMeta() の url 引数は
  // 各ページが手で渡す値なので、取り違えてもここ以外では気づけない。
  // 404 は noindex で canonical を持たないため、突き合わせの対象から外す。
  const canonical = pick(/<link rel="canonical" href="([^"]+)"\/?>/);
  if (canonical !== "なし" && ogUrl !== canonical) {
    fail(`${where}: og:url と canonical が食い違う（og:url ${ogUrl} / canonical ${canonical}）`);
  }
  if (canonical === "なし" && !ogUrl.startsWith(BASE)) {
    fail(`${where}: og:url が配信先の外を指している（実値 ${ogUrl}）`);
  }
}

if (failed) process.exit(1);
console.log(`verify-og: ${targets.length} ページすべてに ${EXPECTED} が載っている`);
