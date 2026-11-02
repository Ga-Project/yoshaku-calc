import { test } from "node:test";
import assert from "node:assert/strict";
import { joinUrl, normalizeBasePath, siteRoot } from "../lib/url.mjs";
import { FABRIC_WIDTHS, GARMENTS, SELVAGE_CM, computeYardage, usableWidthOf, workingWidthOf } from "../lib/calc.mjs";

const ORIGIN = "https://example.github.io";

test("basePath の書き方の揺れは同じ値に正規化される", () => {
  for (const raw of ["/x", "/x/", "x", "x/", "//x//", " /x ", "/x//"]) {
    assert.equal(normalizeBasePath(raw), "/x", JSON.stringify(raw));
  }
  assert.equal(normalizeBasePath("/a/b/"), "/a/b");
});

test("basePath が空・未設定・スラッシュだけならルート配信", () => {
  for (const raw of [undefined, "", "/", "//", "  "]) {
    assert.equal(normalizeBasePath(raw), "", JSON.stringify(raw));
    assert.equal(siteRoot(ORIGIN, raw), `${ORIGIN}/`);
  }
});

test("siteRoot は常に末尾スラッシュ1つで、スラッシュが二重にならない", () => {
  for (const base of ["/x", "/x/", "x", "//x//"]) {
    for (const origin of [ORIGIN, `${ORIGIN}/`]) {
      assert.equal(siteRoot(origin, base), `${ORIGIN}/x/`, `${origin} + ${base}`);
    }
  }
});

test("joinUrl はパス先頭のスラッシュの有無・ルートの末尾スラッシュの有無によらず同じ URL を返す", () => {
  const want = `${ORIGIN}/x/yardage/shirt/`;
  for (const root of [`${ORIGIN}/x/`, `${ORIGIN}/x`]) {
    for (const path of ["yardage/shirt/", "/yardage/shirt/", "//yardage/shirt/"]) {
      assert.equal(joinUrl(root, path), want, `${root} + ${path}`);
    }
  }
  // 「//」は https:// の後ろ以外に現れない
  assert.equal(joinUrl(siteRoot(ORIGIN, "/x/"), "/sitemap.xml").replace("https://", "").includes("//"), false);
});

test("作業幅・並べる幅の定義は、全衣服の計算結果と整合する（表と計算の突き合わせは verify-og が配信HTMLで行う）", () => {
  for (const w of FABRIC_WIDTHS) {
    for (const g of GARMENTS) {
      const res = computeYardage(g.id, w, {});
      assert.equal(res.workingWidth, workingWidthOf(w), `${g.id}@${w}: 作業幅`);
      assert.equal(res.usableWidth, usableWidthOf(w), `${g.id}@${w}: 並べる幅`);
    }
    assert.equal(usableWidthOf(w), workingWidthOf(w) - SELVAGE_CM);
  }
});
