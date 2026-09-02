// 用尺早見表のテスト。
//
// 目的は「ページに出るものが、計算エンジンの実出力と食い違わない」ことを機械で保つこと。
// 過去に読み物の手書き数値が実出力と矛盾した事故が2度起きているため、
// 数値そのものだけでなく、**本文の定量的な主張**も表から導いた値と突き合わせる。
//
// 以前のこのファイルは presets をソース文字列として正規表現で読んでいたが、
// それでは buildTable も GUIDES も一度も実行されず、本文と表の食い違いを
// 1件も検出できなかった（レビューで指摘）。実体を import して検証する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FABRIC_WIDTHS, computeYardage, getGarment } from "../lib/calc.mjs";
import {
  GUIDES,
  LINK_WIDTH,
  axisSpanMeters,
  buildOverview,
  buildTable,
  findRepresentativeRow,
  getGuide,
} from "../app/yardage/presets.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const read = (...seg) => readFileSync(join(here, "..", ...seg), "utf8");

/** そのページに載る全ての表。 */
function allTables() {
  return GUIDES.flatMap((g) => g.axes.map((a) => ({ guide: g, axis: a, table: buildTable(g, a) })));
}

test("早見表の slug は計算エンジンの種別 id と 1 対 1 で対応する", () => {
  assert.ok(GUIDES.length >= 1, "ページ定義が存在する");
  const slugs = GUIDES.map((g) => g.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slug が重複しない");
  for (const slug of slugs) {
    assert.ok(getGarment(slug), `${slug} が計算エンジンに存在する`);
    assert.equal(getGuide(slug)?.slug, slug, `${slug} を getGuide で引ける`);
  }
});

test("早見表が使う入力キーはすべて計算エンジンの入力に存在する", () => {
  let checked = 0;
  for (const guide of GUIDES) {
    const known = new Set(getGarment(guide.slug).inputs.map((i) => i.key));
    for (const key of Object.keys(guide.base)) {
      assert.ok(known.has(key), `${guide.slug}.base.${key} が計算エンジンに存在する`);
      checked += 1;
    }
    for (const axis of guide.axes) {
      assert.ok(known.has(axis.key), `${guide.slug}.axes.${axis.key} が計算エンジンに存在する`);
      checked += 1;
    }
  }
  // 検査対象が空のまま合格する（silent pass）ことを防ぐ。
  assert.ok(checked >= GUIDES.length * 2, `検査した入力キーが十分にある: ${checked}`);
});

test("表に出る全セルが computeYardage の実出力と一致する（手書き値ゼロ）", () => {
  let cells = 0;
  for (const { guide, axis, table } of allTables()) {
    assert.deepEqual(table.widths, [...FABRIC_WIDTHS], "列は FABRIC_WIDTHS そのもの");
    assert.ok(table.rows.length >= 2, `${guide.slug}/${axis.key} に行がある`);
    for (const row of table.rows) {
      const values = { ...guide.base, [axis.key]: row.value };
      assert.equal(row.cells.length, FABRIC_WIDTHS.length, "行の列数が生地幅の数と一致");
      row.cells.forEach((cell, i) => {
        const expected = computeYardage(guide.slug, FABRIC_WIDTHS[i], values);
        assert.equal(cell.fabricWidth, FABRIC_WIDTHS[i]);
        assert.equal(cell.totalCm, expected.totalCm, `${guide.slug}/${axis.key}/${row.value}@${cell.fabricWidth}`);
        assert.equal(cell.totalM, expected.totalM);
        assert.equal(cell.widthShortage, expected.widthShortage);
        cells += 1;
      });
    }
  }
  assert.ok(cells >= 30, `検査したセル数が十分にある: ${cells}`);
});

test("各行の深いリンクは、その行の条件をそのまま計算機へ渡す", () => {
  for (const { guide, axis, table } of allTables()) {
    for (const row of table.rows) {
      const params = new URLSearchParams(row.query);
      assert.equal(params.get("g"), guide.slug);
      assert.equal(params.get("w"), String(LINK_WIDTH));
      assert.equal(params.get(axis.key), String(row.value), "動かした寸法が反映される");
      for (const [k, v] of Object.entries(guide.base)) {
        if (k === axis.key) continue;
        assert.equal(params.get(k), String(v), `固定寸法 ${k} が反映される`);
      }
      // トップの復元 effect は空文字を無視するので、0 も文字列として乗ること。
      for (const input of getGarment(guide.slug).inputs) {
        assert.ok((params.get(input.key) ?? "").trim() !== "", `${input.key} が空でない`);
      }
    }
  }
});

test("表の列は生地幅について単調非増加（幅を広げて必要量が増えない）", () => {
  for (const { guide, axis, table } of allTables()) {
    for (const row of table.rows) {
      let prev = Infinity;
      for (const cell of row.cells) {
        assert.ok(
          cell.totalCm <= prev,
          `${guide.slug}/${axis.key}/${row.value}: 幅${cell.fabricWidth}cm の ${cell.totalCm}cm が狭い幅の ${prev}cm を上回らない`,
        );
        prev = cell.totalCm;
      }
    }
  }
});

test("代表行（buildOverview）は base と同じ値の行を選ぶ", () => {
  const { rows, widths, spread } = buildOverview();
  assert.equal(rows.length, GUIDES.length);
  assert.deepEqual(widths, [...FABRIC_WIDTHS]);
  for (const { guide, cells } of rows) {
    const axis = guide.axes[0];
    const values = { ...guide.base };
    cells.forEach((cell, i) => {
      const expected = computeYardage(guide.slug, FABRIC_WIDTHS[i], values);
      assert.equal(cell.totalCm, expected.totalCm, `${guide.slug} の代表行は base の条件`);
    });
    // base の値が axes[0].rows に無ければ buildOverview は例外を投げる契約。
    assert.ok(
      guide.axes[0].rows.some((r) => r.value === guide.base[axis.key]),
      `${guide.slug}: base.${axis.key} が axes[0].rows に含まれる`,
    );
  }
  assert.equal(spread.length, FABRIC_WIDTHS.length);
  for (const s of spread) assert.ok(s.ratio >= 1, "max/min の比は 1 以上");
});

// ---------------------------------------------------------------------------
// 本文の定量的な主張が、同じページの表に反証されないこと。
// ここが従来のテストに無く、レビューで 3 件の食い違いを見逃した箇所。
// ---------------------------------------------------------------------------

test("本文に用尺の数値・倍率・最上級を手書きしていない", () => {
  const sources = {
    "presets.mjs": read("app", "yardage", "presets.mjs"),
    "yardage/page.tsx": read("app", "yardage", "page.tsx"),
    "yardage/[garment]/page.tsx": read("app", "yardage", "[garment]", "page.tsx"),
  };
  // 文字列リテラル（本文）だけを見る。コメントや識別子は対象外。
  const banned = [
    {
      re: /(最も|いちばん|一番)[^"'`]{0,8}(使う|食う|取る|長い|短い|多い|少ない)/,
      why: "最上級は表で反証されうる（実測から導くか、断定を避けること）",
    },
    { re: /倍(以上|近く|前後)/, why: "倍率は表から算出すること" },
    { re: /\d+(\.\d+)?\s*m\s*(前後|ほど|程度)/, why: "用尺の概数は表から導出すること" },
  ];
  for (const [name, src] of Object.entries(sources)) {
    // JSDoc / 行コメントを除いてから、日本語の本文候補を拾う。
    const body = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    for (const { re, why } of banned) {
      const hit = body.match(re);
      assert.equal(hit, null, `${name}: 「${hit?.[0]}」を手書きしない — ${why}`);
    }
  }
});

test("derivedTips の数値は表の実測差と一致する", () => {
  let produced = 0;
  for (const guide of GUIDES) {
    if (!guide.derivedTips) continue;
    const tips = guide.derivedTips({
      axisSpan: (key) => axisSpanMeters(guide, key),
      m: (v) => `${v.toFixed(1)}m`,
    });
    assert.ok(Array.isArray(tips) && tips.length > 0, `${guide.slug} の derivedTips が文言を返す`);
    for (const tip of tips) {
      // 文中の m 表記が、その軸の実測差の範囲から作られていること。
      const nums = [...tip.matchAll(/(\d+\.\d)m/g)].map((mm) => Number(mm[1]));
      assert.ok(nums.length > 0, `${guide.slug}: derivedTip に実測値が入る`);
      for (const axis of guide.axes) {
        const span = axisSpanMeters(guide, axis.key);
        const lo = Number(Math.min(span.min, span.max).toFixed(1));
        const hi = Number(Math.max(span.min, span.max).toFixed(1));
        if (nums.every((n) => n >= lo && n <= hi)) {
          produced += 1;
          break;
        }
      }
    }
  }
  assert.ok(produced > 0, "derivedTips を持つ種別が少なくとも1つあり、値が実測範囲に収まる");
});

test("ワンピースの導入文は最上級を主張しない（ジャケットの方が長い幅がある）", () => {
  // 具体的な反証: 代表条件でジャケットが全生地幅でワンピースを上回る。
  const { rows } = buildOverview();
  const dress = rows.find((r) => r.guide.slug === "dress");
  const jacket = rows.find((r) => r.guide.slug === "jacket");
  assert.ok(dress && jacket);
  const jacketWins = dress.cells.filter((c, i) => jacket.cells[i].totalCm >= c.totalCm).length;
  assert.ok(jacketWins > 0, "ジャケットが上回る幅が存在する（前提が変わったらこのテストを見直す）");
  assert.ok(
    !/最も生地を使う/.test(dress.guide.lead),
    "ワンピースの lead が『最も生地を使う』と主張していない",
  );
});

test("代表行は値で選ぶ（表示ラベルの前方一致では取り違える条件で確かめる）", () => {
  // 実データでは base 値とラベルがたまたま一致するため、前方一致実装でも同じ行に
  // 当たってしまい回帰を検出できない。ここでは前方一致なら必ず誤る合成データを使う。
  const rows = [
    { value: 104, label: "104cm", cells: [], query: "" },
    { value: 10, label: "10cm", cells: [], query: "" },
  ];
  assert.equal(findRepresentativeRow(rows, 10, "synthetic").value, 10);
  // 前方一致だと "104cm".startsWith("10") が真になり 104 の行を拾ってしまう。
  assert.notEqual(
    rows.find((r) => r.label.startsWith("10")).value,
    10,
    "この合成データでは前方一致が誤ることを確認（テスト自体の妥当性）",
  );
  assert.throws(
    () => findRepresentativeRow(rows, 999, "synthetic"),
    /代表行が見つからない/,
    "見つからなければ例外にしてビルドを落とす",
  );
});
