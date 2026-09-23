// OGP 画像まわりが黙ってズレないようにする回帰テスト。
//
// og.png は画像なので、中身がマスタとズレても誰も気づけない。画像に焼き込んで
// よい具体値は生地幅だけ（tools/og-source.html に理由を書いてある）なので、
// その生地幅が lib/calc.mjs と一致していることをここで縛る。
//
// もう一つは Next の Metadata の合流規則。page 側で openGraph を書くと layout の
// openGraph は丸ごと置き換わり、images が黙って落ちる。openGraph を書いている
// ファイルは必ず画像も持っていること、を検査する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FABRIC_WIDTHS } from "../lib/calc.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("og.png は OGP の規定サイズ（1200x630）で出力されている", () => {
  const png = readFileSync(new URL("../public/og.png", import.meta.url));
  // PNG の IHDR は先頭 8 バイトのシグネチャに続き、幅・高さが各 4 バイトの BE 整数。
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test("og-source.html の生地幅は FABRIC_WIDTHS と一致する", () => {
  const html = read("../tools/og-source.html");
  const chips = [...html.matchAll(/<span class="chip">(\d+)<\/span>/g)].map((m) =>
    Number(m[1]),
  );
  assert.deepEqual(chips, FABRIC_WIDTHS);
});

test("og-source.html は用尺の実数値を焼き込んでいない", () => {
  // 寸法や係数を直すと画像だけが古い数値のまま残るため、「◯.◯ m」「◯◯◯ cm」の
  // 類は置かない。生地幅チップ（cm なしの整数）だけが許される具体値。
  const body = read("../tools/og-source.html")
    .replace(/<!--[\s\S]*?-->/g, "") // 生成コマンドの --window-size=1200,630 等を拾わない
    .replace(/<div class="widths">[\s\S]*?<\/div>/, "") // 生地幅チップは上のテストが縛る
    .replace(/<style>[\s\S]*?<\/style>/, "") // CSS の px/%/flex 値は文言ではない
    .replace(/<[^>]+>/g, " ");
  assert.equal(/\d+(\.\d+)?\s*(m|ｍ|cm|ｃｍ)(?![a-z])/.test(body), false);
});

test("openGraph を宣言するページはすべて OG 画像を持つ", () => {
  const appDir = new URL("../app/", import.meta.url).pathname;
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) files.push(full);
    }
  };
  walk(appDir);

  const declaring = files.filter((f) => /openGraph:\s*\{/.test(readFileSync(f, "utf8")));
  assert.ok(declaring.length > 0, "openGraph を宣言するファイルが見つからない");
  for (const f of declaring) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /images:\s*\[OG_IMAGE\]/, `${f} の openGraph に OG 画像がない`);
    assert.match(src, /card:\s*"summary_large_image"/, `${f} の twitter カードが大判でない`);
  }
});
