// OGP 画像まわりの回帰テスト。
//
// ■ ここで縛れること / 縛れないこと（正確に）
//   このテストが見ているのは「生成元」であって「画像の中身」ではない。
//   og.png の中に何が描かれているかは検査できないので、代わりに
//   「生成元を編集したら必ず気づく」形にしてある（og-source.sha256）。
//   配信される HTML に画像が載っているかは、ソース文字列ではなくビルド出力を
//   見る scripts/verify-og.mjs が担当する（CI の build ジョブが実行）。
//   metadata の書き方をソースで検査すると、共通化した瞬間に落ちる一方で
//   ヘルパー越しの画像なしページは素通りするため、ここでは検査しない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { FABRIC_WIDTHS } from "../lib/calc.mjs";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const SOURCE = read("../tools/og-source.html");
/** コメントと style を落とした、画像に文字として出る部分。 */
const VISIBLE = SOURCE.replace(/<!--[\s\S]*?-->/g, "").replace(/<style>[\s\S]*?<\/style>/, "");

test("og.png は PNG で、OGP の規定サイズ（1200x630）", () => {
  const png = readFileSync(fileURLToPath(new URL("../public/og.png", import.meta.url)));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "PNG シグネチャが不正");
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test("生成元を編集したら og.png の撮り直しを促す（ハッシュ固定）", () => {
  // 画像が生成元と一致しているかは機械的に確かめられない。そこで生成元の
  // ハッシュを固定し、編集したら必ずこのテストが落ちるようにしてある。
  // 落ちたときは og.png を撮り直したうえで tools/og-source.sha256 を更新する
  // ＝「撮り直した」と明示的に記録する手続きに変える、という趣旨のテスト。
  // （更新だけして撮り直さないことは防げない。そこは人の宣言に依る。）
  const recorded = read("../tools/og-source.sha256").trim();
  const actual = createHash("sha256").update(SOURCE).digest("hex");
  assert.equal(
    actual,
    recorded,
    "tools/og-source.html が変わっている。og.png を撮り直し、tools/og-source.sha256 を更新すること",
  );
});

test("画像に焼き込んだ生地幅は FABRIC_WIDTHS と一致する", () => {
  const chips = [...SOURCE.matchAll(/<span class="chip">(\d+)<\/span>/g)].map((m) => Number(m[1]));
  assert.deepEqual(chips, FABRIC_WIDTHS);
});

test("画像に用尺の実数値を焼き込んでいない", () => {
  // 寸法や係数を直すと画像だけが古い数値のまま残るため、「◯.◯ m」「◯◯◯ cm」の
  // 類は置かない。生地幅チップ（上のテストが縛る）だけが許される具体値。
  const text = VISIBLE.replace(/<div class="row widths">[\s\S]*?<\/div>/, "").replace(/<[^>]+>/g, " ");
  assert.equal(/\d+(\.\d+)?\s*(m|ｍ|cm|ｃｍ)(?![a-z])/.test(text), false);
});

test("画像に書いた URL は配信先（SITE_URL）と一致する", () => {
  // 画像内の URL は手書きなので、slug 変更やドメイン移行で黙ってズレる。
  // 前方のコメントに旧 ORIGIN が残っていると先頭一致でそれを拾うので、行コメントを落とす。
  const origin = read("../app/site.ts")
    .replace(/^\s*\/\/.*$/gm, "")
    .match(/const ORIGIN = "([^"]+)"/)?.[1];
  const slug = JSON.parse(read("../package.json")).name;
  assert.ok(origin, "app/site.ts から ORIGIN を読めない");
  const expected = `${origin.replace(/^https?:\/\//, "")}/${slug}`;
  assert.ok(
    VISIBLE.includes(expected),
    `画像内の URL が ${expected} でない（tools/og-source.html のフッタを確認）`,
  );
});
