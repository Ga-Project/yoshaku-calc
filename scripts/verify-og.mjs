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
const EXPECTED = `https://ga-project.github.io${process.env.PAGES_BASE_PATH || ""}/og.png`;

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

// 404 は noindex でカードを出さない方針なので対象外。
const targets = pages.filter((p) => !/404\.html$/.test(p));
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
}

if (failed) process.exit(1);
console.log(`verify-og: ${targets.length} ページすべてに ${EXPECTED} が載っている`);
