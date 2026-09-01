// 用尺早見表のテスト。
//
// 目的は「表に出る数値が計算機の答えと必ず一致する」ことを機械で保つこと。
// 読み物に手で書いた数値が計算エンジンの実出力と食い違う事故が過去に起きているため、
// 表を作る経路（buildTable）が computeYardage の出力そのものであることを検査する。
//
// presets.ts は TypeScript なので node:test からは直接読めない。型注釈だけを落とした
// 実行可能な断片を取り出すのではなく、定義の実体（GUIDES）を JSON として持たせるのは
// 二重管理になるため、ここでは「ページが使うのと同じ入力条件」を presets.ts から
// 機械的に読み取って検証する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FABRIC_WIDTHS, computeYardage, getGarment } from "../lib/calc.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const presetsSrc = readFileSync(join(here, "..", "app", "yardage", "presets.ts"), "utf8");

/** presets.ts に書かれた slug を抜き出す。 */
function slugsInPresets() {
  return [...presetsSrc.matchAll(/^\s{4}slug: "([a-z-]+)",$/gm)].map((m) => m[1]);
}

/** presets.ts に書かれた入力キー（base と axes.key）を抜き出す。 */
function inputKeysInPresets() {
  const base = [...presetsSrc.matchAll(/^\s{4}base: \{([^}]*)\}/gm)]
    .flatMap((m) => [...m[1].matchAll(/(\w+):/g)].map((k) => k[1]));
  const axes = [...presetsSrc.matchAll(/^\s{8}key: "(\w+)",$/gm)].map((m) => m[1]);
  return { base, axes };
}

test("早見表の slug は計算エンジンの種別 id と 1 対 1 で対応する", () => {
  const slugs = slugsInPresets();
  assert.equal(slugs.length, 5, "5 種別ぶんのページ定義がある");
  for (const slug of slugs) {
    assert.ok(getGarment(slug), `${slug} が計算エンジンに存在する`);
  }
  assert.equal(new Set(slugs).size, slugs.length, "slug が重複しない");
});

test("早見表が使う入力キーはすべて計算エンジンの入力に存在する", () => {
  const slugs = slugsInPresets();
  const known = new Set(
    slugs.flatMap((s) => getGarment(s).inputs.map((i) => i.key)),
  );
  const { base, axes } = inputKeysInPresets();
  for (const key of [...base, ...axes]) {
    assert.ok(known.has(key), `入力キー ${key} が計算エンジンに存在する`);
  }
});

test("生地幅は計算エンジンの FABRIC_WIDTHS と同じ 3 種", () => {
  // 表の列は FABRIC_WIDTHS をそのまま並べる設計なので、増減したら表も自動で追随する。
  assert.deepEqual(FABRIC_WIDTHS, [90, 110, 140]);
});

test("表に出る用尺は生地幅が広いほど短いか同じ（列の並びが単調）", () => {
  // 早見表は「幅を変えるとどれだけ違うか」を見せるための表なので、
  // 幅を広げたのに必要量が増える、という読者を裏切る並びが出ないことを保証する。
  for (const slug of slugsInPresets()) {
    const garment = getGarment(slug);
    const values = {};
    for (const input of garment.inputs) values[input.key] = input.def;
    let prev = Infinity;
    for (const w of FABRIC_WIDTHS) {
      const res = computeYardage(slug, w, values);
      assert.ok(res, `${slug}@${w} が結果を返す`);
      assert.ok(
        res.totalCm <= prev,
        `${slug}: 生地幅 ${w}cm の用尺 ${res.totalCm}cm が、より狭い幅の ${prev}cm を上回らない`,
      );
      prev = res.totalCm;
    }
  }
});

test("早見表の数値はページ側で手書きされていない（計算結果のみを描画する）", () => {
  // presets.ts に用尺そのもの（m 表記）が書かれていたら、それは計算機の答えと
  // 食い違いうる二重管理。数値は computeYardage の戻り値だけを使う。
  const pagePath = join(here, "..", "app", "yardage", "[garment]", "page.tsx");
  const pageSrc = readFileSync(pagePath, "utf8");
  for (const [label, src] of [["presets.ts", presetsSrc], ["page.tsx", pageSrc]]) {
    const hardcoded = src.match(/["'>][\s]*\d+\.\d\s*m["'<]/g);
    assert.equal(
      hardcoded,
      null,
      `${label} に用尺の数値が直書きされていない（見つかった: ${hardcoded}）`,
    );
  }
});
