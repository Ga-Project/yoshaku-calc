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
import { FABRIC_WIDTHS, SELVAGE_CM, computeYardage, getGarment } from "../lib/calc.mjs";
import {
  GUIDES,
  spanOfCells,
  axisSteps,
  axisIncrements,
  baseCells,
  spreadOf,
  LINK_WIDTH,
  axisSpanMeters,
  buildOverview,
  buildTable,
  derivedTipsFor,
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
    const tips = derivedTipsFor(guide);
    assert.ok(Array.isArray(tips) && tips.length > 0, `${guide.slug} の derivedTips が文言を返す`);
    for (const tip of tips) {
      // 文中の m 表記が、その軸の実測差の範囲から作られていること。
      const nums = [...tip.matchAll(/(\d+\.\d)m/g)].map((mm) => Number(mm[1]));
      // m 表記を持たない注記（切り替わり位置の説明など）は下の axisSteps のテストで検査する。
      if (nums.length === 0) continue;
      for (const axis of guide.axes) {
        const span = axisSpanMeters(guide, axis.key);
        if (!span) continue;
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

test("エプロンの注記: 裾幅別の表で必要量が増える箇所では、パーツが下の段に回っている", () => {
  // tips は「横に並びきらなくなったパーツが下の段に回って必要量が増える」と主張している。
  // 値が増えたことだけでなく、その原因が配置の変化（本体の横から外れる／段が増える）であることを確かめる。
  const guide = getGuide("apron");
  const axis = guide.axes.find((a) => a.key === "hemWidth");
  const table = buildTable(guide, axis);
  const shape = (w, value) => {
    const res = computeYardage("apron", w, { ...guide.base, hemWidth: value });
    const body = res.placed.find((p) => p.label === "本体");
    return {
      beside: res.placed.filter((p) => p !== body && p.y === body.y).length,
      rows: new Set(res.placed.map((p) => p.y)).size,
    };
  };
  let jumps = 0;
  table.widths.forEach((w, i) => {
    table.rows.forEach((row, r) => {
      if (r === 0 || row.cells[i].totalCm <= table.rows[r - 1].cells[i].totalCm) return;
      const before = shape(w, table.rows[r - 1].value);
      const after = shape(w, row.value);
      assert.ok(
        after.beside < before.beside || after.rows > before.rows,
        `${w}cm 幅・裾幅 ${row.label}: 増えた箇所でパーツが下の段に回っている`,
      );
      jumps += 1;
    });
  });
  assert.ok(jumps > 0, "裾幅を広げて必要量が増える箇所が表に少なくとも1つある");
  assert.ok(
    table.rows.some((row) => row.cells.some((c) => c.widthShortage)),
    "『収まらない印が出る』組み合わせが表に含まれる",
  );
});

test("どの種別の導入文も最上級を主張しない", () => {
  for (const guide of GUIDES) {
    assert.ok(!/最も|いちばん|一番/.test(guide.lead), `${guide.slug} の lead に最上級が無い`);
  }
});

test("axisSteps が挙げる切り替わりは、表で実際に前の行より増えている行を全て指す", () => {
  const guide = getGuide("apron");
  const table = buildTable(guide, guide.axes.find((a) => a.key === "hemWidth"));
  const steps = axisSteps(guide, "hemWidth");
  // 表を直接走査した結果と一致すること（見落とし・余計な行が無い）。
  const expected = [];
  table.widths.forEach((width, i) => {
    table.rows.forEach((row, k) => {
      if (k === 0) return;
      const prev = table.rows[k - 1].cells[i];
      const cur = row.cells[i];
      if (!prev.widthShortage && !cur.widthShortage && cur.totalCm > prev.totalCm) {
        expected.push({ width, from: `${row.value}cm` });
      }
    });
  });
  assert.ok(expected.length > 0, "切り替わりが少なくとも1つある");
  assert.deepEqual(steps, expected);
  const tips = derivedTipsFor(guide).join("\n");
  for (const { width, from } of steps) {
    assert.ok(new RegExp(`${width}cm 幅では裾幅 [^、]*${from}`).test(tips), `${width}cm/${from} が本文に載る`);
  }
});

/** base の条件で a と b が同じ段にあるか（テスト側で独立に計算する）。 */
function sameRow(slug, width, values, a, b) {
  const res = computeYardage(slug, width, values);
  const pa = res.placed.find((p) => p.label === a);
  const pb = res.placed.filter((p) => p.label === b);
  return pb.some((q) => q.y === pa.y);
}

test("シャツ: 『半袖から長袖まで変わらない』幅では、袖が身頃の横に収まっている", () => {
  const guide = getGuide("shirt");
  const axis = guide.axes.find((a) => a.key === "sleeveLen");
  const flatTip = derivedTipsFor(guide).find((t) => t.includes("変わりません")) ?? "";
  const named = [...(flatTip.split("cm 幅では")[0] ?? "").matchAll(/\d+/g)].map((m) => Number(m[0]));
  const table = buildTable(guide, axis);
  const flatWidths = table.widths.filter((_, i) => {
    const vals = table.rows.slice(1).map((r) => r.cells[i].totalCm);
    return vals.every((v) => v === vals[0]);
  });
  assert.deepEqual(named, flatWidths, "本文が挙げる幅 = 表で半袖〜長袖の値が変わらない幅");
  let claimed = 0;
  table.widths.forEach((w) => {
    if (!flatWidths.includes(w)) return;
    claimed += 1;
    for (const row of table.rows.slice(1)) {
      assert.ok(
        sameRow("shirt", w, { ...guide.base, sleeveLen: row.value }, "前身頃", "袖"),
        `${w}cm 幅・袖丈 ${row.label}: 袖が身頃と同じ段にある`,
      );
    }
  });
  assert.ok(claimed > 0, "前提: 値が変わらない幅が少なくとも1つある（無ければ文言が出ないことを別途確認）");
  assert.ok(!/袖のぶんの差がそのまま/.test(guide.tips.join("")), "表に反証される旧い主張が残っていない");
});

test("ワンピース: 140cm 幅で大きく減るのは前後の身頃が横に並ぶとき（表と配置で裏づける）", () => {
  const guide = getGuide("dress");
  const t = (w) => computeYardage("dress", w, guide.base).totalCm;
  assert.ok(sameRow("dress", 140, guide.base, "前身頃", "後身頃"), "140cm 幅では身頃が横に並ぶ");
  assert.ok(!sameRow("dress", 110, guide.base, "前身頃", "後身頃"), "110cm 幅では身頃が縦に積まれる");
  assert.ok(!sameRow("dress", 90, guide.base, "前身頃", "後身頃"), "90cm 幅では身頃が縦に積まれる");
  assert.ok(t(110) - t(140) > t(90) - t(110), "140cm 幅での減り方の方が大きい");
});

test("ワンピース: 丈の増え方は、身頃が縦に積まれる幅で 2 枚ぶん・横に並ぶ幅で 1 枚ぶん（丸め込み）", () => {
  const guide = getGuide("dress");
  const axis = guide.axes.find((a) => a.key === "bodyLen");
  const step = axis.rows[1].value - axis.rows[0].value;
  const table = buildTable(guide, axis);
  table.widths.forEach((w, i) => {
    const stacked = !sameRow("dress", w, guide.base, "前身頃", "後身頃");
    const diffs = table.rows.slice(1).map((r, k) => r.cells[i].totalCm - table.rows[k].cells[i].totalCm);
    for (const d of diffs) {
      if (stacked) assert.equal(d, step * 2, `${w}cm 幅（縦積み）は 2 枚ぶん`);
      else assert.ok(d >= step - 10 && d <= step + 10, `${w}cm 幅（横並び）は 1 枚ぶん±丸め: ${d}`);
    }
  });
});

test("パンツ: 本文の『縦に積まれる／横に並べられる』と長さは配置から出ている", () => {
  const guide = getGuide("pants");
  const tips = derivedTipsFor(guide).join("\n");
  assert.ok(tips.length > 0, "注記が出る");
  for (const w of FABRIC_WIDTHS) {
    const res = computeYardage("pants", w, guide.base);
    const beside = sameRow("pants", w, guide.base, "前パンツ", "後パンツ");
    const seg = beside ? tips.split("横に並べられる")[1] : tips.split("横に並べられる")[0];
    assert.ok(seg.includes(`${w}cm 幅で ${res.totalM.toFixed(1)}m`), `${w}cm 幅は${beside ? "横並び" : "縦積み"}側に実測値で載る`);
  }
  assert.ok(!/2m を超え|半分近く/.test(guide.tips.join("")), "手書きの数値主張が残っていない");
});

test("スカート: 『前後が横に並ぶのは◯cm 幅』は配置から出ていて、並ぶ幅は 1 枚ぶん・並ばない幅は 2 枚ぶん積む", () => {
  const guide = getGuide("skirt");
  const tip = derivedTipsFor(guide).join("\n");
  assert.ok(tip.length > 0, "注記が出る（前提: 並ぶ幅と並ばない幅の両方がある）");
  for (const w of FABRIC_WIDTHS) {
    const beside = sameRow("skirt", w, guide.base, "前スカート", "後スカート");
    assert.equal(tip.includes(`${w}cm`), beside, `${w}cm 幅: 本文に載る ⇔ 横に並ぶ`);
    const res = computeYardage("skirt", w, guide.base);
    const h = res.placed.find((p) => p.label === "前スカート").h;
    if (beside) assert.ok(res.rawCm < h * 2, `${w}cm 幅: 1 枚ぶんで済む`);
    else assert.ok(res.rawCm >= h * 2, `${w}cm 幅: 2 枚ぶん積む`);
  }
});

// ---------------------------------------------------------------------------
// 導入文・パーツ説明の定量的な主張（数字や「収まらない」等）を計算機の実出力で固定する。
// 詰め方を変えたときに、表の外の文言が黙って嘘になるのを防ぐ。
// ---------------------------------------------------------------------------

test("スカートの lead『丈が短ければ 1m を切ることもある』は入力範囲内で成立する", () => {
  const guide = getGuide("skirt");
  assert.ok(/1m を切る/.test(guide.lead), "前提: lead がこの主張をしている");
  const g = getGarment("skirt");
  const len = g.inputs.find((i) => i.key === "skirtLen");
  const min = Math.min(...FABRIC_WIDTHS.map((w) => computeYardage("skirt", w, { ...guide.base, skirtLen: len.min }).totalCm));
  assert.ok(min < 100, `最短丈で ${min}cm < 100cm になる生地幅がある`);
});

test("ジャケットの lead『サイズによっては 90cm 幅に身頃が収まらない』は表と配置で成立する", () => {
  const guide = getGuide("jacket");
  assert.ok(/90cm 幅に身頃が収まりません/.test(guide.lead), "前提: lead がこの主張をしている");
  const table = buildTable(guide, guide.axes.find((a) => a.key === "bust"));
  const i90 = table.widths.indexOf(90);
  const short = table.rows.filter((r) => r.cells[i90].widthShortage);
  assert.ok(short.length > 0, "90cm 幅で幅不足の行が表にある");
  for (const r of short) {
    const res = computeYardage("jacket", 90, { ...guide.base, bust: r.value });
    assert.ok(res.placed.some((p) => p.overflow && p.label.includes("身頃")), `${r.label}: 収まらないのは身頃`);
  }
});

test("エプロンの説明の『仕上がり幅・裁ち幅』は計算機のひもの寸法と一致する（四つ折り = 裁ち幅の 1/4）", () => {
  const guide = getGuide("apron");
  const m = guide.pieces.match(/仕上がり幅 (\d+)cm（裁ち幅 (\d+)cm）/);
  assert.ok(m, "説明に仕上がり幅と裁ち幅がある");
  const finished = Number(m[1]);
  const cut = Number(m[2]);
  const pieces = getGarment("apron").pieces({ apronLen: 85, hemWidth: 76, tieLen: 60 });
  for (const p of pieces.filter((q) => q.label.includes("ひも"))) {
    assert.equal(p.w, cut, `${p.label} の裁ち幅が説明と一致`);
  }
  assert.equal(cut / 4, finished, "四つ折りの仕上がり幅 = 裁ち幅 / 4");
});

test("ワンピースの lead『丈が長い一着ほど生地幅の選び方で差が開く』は表で成立する", () => {
  const guide = getGuide("dress");
  const table = buildTable(guide, guide.axes.find((a) => a.key === "bodyLen"));
  const gap = table.rows.map((r) => r.cells[0].totalCm - r.cells[r.cells.length - 1].totalCm);
  for (let k = 1; k < gap.length; k += 1) assert.ok(gap[k] >= gap[k - 1], `丈を伸ばして差が縮まない: ${gap}`);
  assert.ok(gap[gap.length - 1] > gap[0], `最長丈の差が最短丈の差より大きい: ${gap}`);
});

// ---------------------------------------------------------------------------
// 「幅が足りない」（表では — と出る）セルの数値を、本文・比率に使わない。
// 現行データでは該当しないため、幅不足を含む合成ガイドで確かめる。
// ---------------------------------------------------------------------------

test("幅不足のセルは差・増え方・固定寸法の結果・種別間の比率のいずれにも使わない", () => {
  // ジャケットのバスト 136cm は 90cm 幅で身頃が収まらない（上のテストで固定）。
  const jacket = getGuide("jacket");
  const synthetic = {
    ...jacket,
    base: { ...jacket.base, bust: 136 },
    axes: [
      {
        key: "bust",
        caption: "",
        rowHeader: "",
        fixedNote: "",
        rows: [
          { value: 96, label: "96cm" },
          { value: 136, label: "136cm" },
        ],
      },
    ],
  };
  const table = buildTable(synthetic, synthetic.axes[0]);
  const i90 = table.widths.indexOf(90);
  assert.ok(table.rows[1].cells[i90].widthShortage, "前提: 最後の行の 90cm 幅は幅不足");

  const span = axisSpanMeters(synthetic, "bust");
  const valid = table.widths
    .map((_, i) => i)
    .filter((i) => !table.rows[0].cells[i].widthShortage && !table.rows[1].cells[i].widthShortage)
    .map((i) => table.rows[1].cells[i].totalM - table.rows[0].cells[i].totalM);
  assert.deepEqual(span, { min: Math.min(...valid), max: Math.max(...valid) }, "差は幅不足の幅を除いて取る");

  assert.ok(!axisIncrements(synthetic, "bust").some((x) => x.width === 90), "増え方に 90cm 幅が入らない");
  assert.ok(!baseCells(synthetic).some((c) => c.fabricWidth === 90), "固定寸法の結果に 90cm 幅が入らない");

  const rows = [
    { guide: synthetic, cells: table.rows[1].cells },
    { guide: getGuide("skirt"), cells: buildOverview().rows.find((r) => r.guide.slug === "skirt").cells },
  ];
  const spread = spreadOf(rows);
  assert.ok(!spread.some((s) => s.width === 90), "比べられる種別が 1 つしかない 90cm 幅は比率に含めない");
  assert.ok(spread.length > 0, "他の幅では比率が出る");

  // 全て幅不足なら注記は出さない（null）。実データでは作れないので、セルを直接渡して確かめる。
  const cell = (w, m, short) => ({ fabricWidth: w, totalCm: m * 100, totalM: m, widthShortage: short });
  assert.equal(spanOfCells([cell(90, 1, true), cell(110, 1, true)], [cell(90, 2, true), cell(110, 2, true)]), null);
  assert.deepEqual(
    spanOfCells([cell(90, 1, true), cell(110, 1, false)], [cell(90, 3, false), cell(110, 1.5, false)]),
    { min: 0.5, max: 0.5 },
    "片方の行でも幅不足の生地幅は比べない",
  );
  assert.throws(() => spanOfCells([cell(90, 1, false)], []), /列数が一致しない/, "列数の食い違いは例外");
  assert.throws(() => spanOfCells([cell(90, 1, false)], [undefined]), /セルが無い/, "セルの欠落は例外");
});

test("耳の説明は計算の定数と一致する（FAQ・生地幅の表・幅不足の説明・README・裁断図）", () => {
  const guide = read("app", "Guide.tsx");
  assert.ok(guide.includes("${SELVAGE_CM}cm を除いた幅にパーツを配置"), "FAQ の耳の幅は SELVAGE_CM から入る");
  assert.ok(!/作業幅＝生地幅÷2 で配置/.test(guide), "耳を無視した旧い説明が残っていない");
  assert.ok(guide.includes("{w / 2 - SELVAGE_CM}cm"), "生地幅の表の『並べる幅』は定数から出す");
  const garmentPage = read("app", "yardage", "[garment]", "page.tsx");
  assert.ok(garmentPage.includes("{SELVAGE_CM}cm を除いた幅に収まらず"), "幅不足の説明に耳が入る");
  const readme = read("README.md");
  assert.ok(readme.includes(`\`SELVAGE_CM\` = ${SELVAGE_CM}cm`), "README の耳の幅が定数と一致");
  const page = read("app", "page.tsx");
  assert.ok(/data-selvage[\s\S]{0,80}x=\{padL \+ result\.usableWidth\}/.test(page), "裁断図に使える幅から右端までの耳の帯を描く");
});

test("はみ出しの印がついたパーツは、必ず耳の帯か生地の外に掛かる（図と警告が食い違わない）", () => {
  let flagged = 0;
  for (const g of GUIDES) {
    for (const axis of g.axes) {
      for (const row of axis.rows) {
        for (const w of FABRIC_WIDTHS) {
          const r = computeYardage(g.slug, w, { ...g.base, [axis.key]: row.value });
          for (const p of r.placed) {
            if (!p.overflow) continue;
            flagged += 1;
            assert.ok(p.x + p.w > r.workingWidth - SELVAGE_CM, `${g.slug}@${w}: ${p.label} が耳の帯に掛かる`);
          }
        }
      }
    }
  }
  assert.ok(flagged > 0, "前提: はみ出しの印がつく組み合わせが表にある");
});

// ---------------------------------------------------------------------------
// コートの早見表: ページが出ること、本文の主張が計算と配置で裏づけられること。
// ---------------------------------------------------------------------------

test("コートの早見表ページが生成対象・サイトマップ・一覧に入る", () => {
  assert.ok(getGuide("coat"), "GUIDES に coat がある");
  // ページ生成・サイトマップ・一覧（構造化データ含む）は GUIDES から機械的に作る。
  // 手書きのルート一覧に戻ると coat だけ出ない、が起きるのでその前提を固定する。
  const garmentPage = read("app", "yardage", "[garment]", "page.tsx");
  assert.ok(/generateStaticParams\(\)\s*\{\s*return GUIDES\.map\(\(g\) => \(\{ garment: g\.slug \}\)\)/.test(garmentPage));
  const sitemap = read("app", "sitemap.ts");
  assert.ok(/GUIDES\.map\(\(g\) => \(\{\s*url: `\$\{SITE_URL\}yardage\/\$\{g\.slug\}\/`/.test(sitemap));
  const index = read("app", "yardage", "page.tsx");
  assert.ok(index.includes("itemListElement: GUIDES.map("), "一覧の構造化データも GUIDES から作る");
  assert.ok(buildOverview().rows.some((r) => r.guide.slug === "coat"), "代表的な一着の比較表に入る");
  for (const src of [read("README.md"), read("app", "layout.tsx"), index]) {
    assert.ok(src.includes("コート"), "対象の衣服の列挙にコートが入る");
  }
});

test("コートの lead『同じバスト・着丈・袖丈のジャケットと比べて同じか多め』は表の全寸法で成立する", () => {
  // 全入力範囲での成立は test/calc.test.mjs（パーツの大小関係と計算結果の格子走査）で固定している。
  const guide = getGuide("coat");
  assert.ok(
    /同じバスト・着丈・袖丈のジャケットと比べて、必要な生地は同じか多め/.test(guide.lead),
    "前提: lead がこの主張をしている（同じになる場合と矛盾しない言い方）",
  );
  for (const axis of guide.axes) {
    for (const row of axis.rows) {
      const v = { ...guide.base, [axis.key]: row.value };
      for (const w of FABRIC_WIDTHS) {
        const c = computeYardage("coat", w, v).totalCm;
        const j = computeYardage("jacket", w, v).totalCm;
        assert.ok(c >= j, `${axis.key}=${row.value}@${w}: コート ${c} >= ジャケット ${j}`);
      }
    }
  }
});

test("コートの注記『身頃が収まらない組み合わせは表に印が出る』は表と配置で成立する", () => {
  const guide = getGuide("coat");
  assert.ok(guide.tips.some((t) => t.includes("表にその印が出ます")), "前提: 注記がこの主張をしている");
  const table = buildTable(guide, guide.axes.find((a) => a.key === "bust"));
  const short = table.rows.flatMap((r) =>
    r.cells.filter((c) => c.widthShortage).map((c) => ({ value: r.value, width: c.fabricWidth })),
  );
  assert.ok(short.length > 0, "幅不足の組み合わせが表にある");
  for (const { value, width } of short) {
    const res = computeYardage("coat", width, { ...guide.base, bust: value });
    assert.ok(res.placed.some((p) => p.overflow && p.label.includes("身頃")), `${value}@${width}: 収まらないのは身頃`);
  }
});

test("コートの derivedTips: 増え方は表の実測、『縦に積まれる』幅は配置の実測と一致する", () => {
  const guide = getGuide("coat");
  const tips = derivedTipsFor(guide);
  const incTip = tips.find((t) => t.includes("増え方")) ?? "";
  const axis = guide.axes.find((a) => a.key === "bodyLen");
  const step = axis.rows[1].value - axis.rows[0].value;
  assert.ok(incTip.includes(`着丈を ${step}cm ずつ`), "刻みが行の値から出ている");
  for (const inc of axisIncrements(guide, "bodyLen")) {
    const range = inc.min === inc.max ? `${inc.min}cm` : `${inc.min}〜${inc.max}cm`;
    assert.ok(incTip.includes(`${inc.width}cm 幅で ${range}`), `${inc.width}cm 幅の増え方 ${range} が本文に載る`);
  }
  const stackTip = tips.find((t) => t.includes("縦に積まれます")) ?? "";
  const stacked = FABRIC_WIDTHS.filter((w) => !sameRow("coat", w, guide.base, "前身頃", "後身頃"));
  assert.ok(stacked.length > 0, "前提: 前後の身頃が縦に積まれる幅がある");
  if (stacked.length === FABRIC_WIDTHS.length) {
    assert.ok(stackTip.includes("どの生地幅でも"), "全ての幅で縦に積まれるなら『どの生地幅でも』と書く");
  } else {
    const named = [...(stackTip.split("cm 幅で")[0] ?? "").matchAll(/\d+/g)].map((m) => Number(m[0]));
    assert.deepEqual(named, stacked, "本文が挙げる幅 = 配置で身頃が縦に積まれる幅");
  }
  assert.ok(stackTip.includes("前後の身頃 2 枚ぶん以上ずつ増えます"), "前提: 本文がこの主張をしている");
  // 「身頃 2 枚ぶん以上ずつ増える」: 縦に積まれる幅では、隣り合う全ての行で増え方が刻みの 2 倍以上。
  const table = buildTable(guide, axis);
  assert.ok(table.rows.length >= 2, "隣り合う行の組がある");
  for (const w of stacked) {
    const i = table.widths.indexOf(w);
    for (let k = 1; k < table.rows.length; k += 1) {
      const d = table.rows[k].cells[i].totalCm - table.rows[k - 1].cells[i].totalCm;
      assert.ok(d >= step * 2, `${w}cm 幅・${table.rows[k].label}: 増え方 ${d}cm >= ${step * 2}cm`);
    }
  }
});

test("ジャケットの着丈別の表から、コートの早見表へ案内する", () => {
  const jacket = getGuide("jacket");
  const axis = jacket.axes.find((a) => a.key === "bodyLen");
  assert.ok(axis.rows.some((r) => r.label.includes("コート寄り")), "前提: コート寄りの丈の行がある");
  const table = buildTable(jacket, axis);
  assert.deepEqual(
    table.seeAlso && { slug: table.seeAlso.slug, name: table.seeAlso.name },
    { slug: "coat", name: getGuide("coat").searchName },
    "案内先はコートの早見表",
  );
  const garmentPage = read("app", "yardage", "[garment]", "page.tsx");
  assert.ok(garmentPage.includes("href={`/yardage/${table.seeAlso.slug}/`}"), "ページが案内のリンクを出す");
  const broken = { ...axis, seeAlso: { slug: "no-such", text: "" } };
  assert.throws(() => buildTable(jacket, broken), /unknown seeAlso/, "案内先が無ければビルドを落とす");
});

test("表の見出しは語の途中で折り返さないかたまりで組む（全種別共通の部品）", () => {
  const garmentPage = read("app", "yardage", "[garment]", "page.tsx");
  assert.ok(/<h2 id=\{headingId\(table\.caption\)\}>\s*<CaptionText caption=\{table\.caption\} \/>/.test(garmentPage));
  assert.ok(/\.yardage-keep\s*\{\s*white-space: nowrap;/.test(read("app", "yardage", "yardage.css")));
  // かたまりの分け方（本題と括弧内の「・」区切り）が全ての見出しで成り立つ形になっている。
  for (const { table } of allTables()) {
    assert.ok(/^[^（]+（[^（）]+）$/.test(table.caption), `${table.caption}: 本題（条件・条件）の形`);
  }
});

// ---------------------------------------------------------------------------
// ベストの早見表: ページが出ること、本文の主張が計算と配置で裏づけられること。
// ---------------------------------------------------------------------------

test("ベストの早見表ページが生成対象・一覧・作品の列挙に入る", () => {
  assert.ok(getGuide("vest"), "GUIDES に vest がある");
  assert.ok(buildOverview().rows.some((r) => r.guide.slug === "vest"), "代表的な一着の比較表に入る");
  for (const src of [read("README.md"), read("app", "layout.tsx"), read("app", "yardage", "page.tsx")]) {
    assert.ok(src.includes("ベスト"), "対象の衣服の列挙にベストが入る");
  }
});

test("ベストの lead『着丈が長いほど必要な長さは増える』は、全生地幅で着丈の行ごとに増えることで成立する", () => {
  const guide = getGuide("vest");
  assert.ok(/着丈が長いほど、必要な長さは増えます/.test(guide.lead), "前提: lead がこの主張をしている");
  const axis = guide.axes.find((a) => a.key === "bodyLen");
  const table = buildTable(guide, axis);
  assert.ok(table.rows.length >= 2);
  for (let i = 0; i < table.widths.length; i += 1) {
    for (let k = 1; k < table.rows.length; k += 1) {
      const a = table.rows[k - 1].cells[i];
      const b = table.rows[k].cells[i];
      assert.ok(b.totalCm > a.totalCm, `${table.widths[i]}cm 幅: ${table.rows[k - 1].label}→${table.rows[k].label} で増える`);
    }
  }
});

test("ベスト: 『前後の身頃が横に並ぶのは◯cm 幅』は配置から出ていて、並ばない幅は身頃 2 枚ぶん以上積み、並ぶ幅は 2 枚ぶんに届かない", () => {
  const guide = getGuide("vest");
  const tip = derivedTipsFor(guide).join("\n");
  assert.ok(tip.length > 0, "注記が出る（前提: 並ぶ幅と並ばない幅の両方がある）");
  for (const w of FABRIC_WIDTHS) {
    const beside = sameRow("vest", w, guide.base, "前身頃", "後身頃");
    assert.equal(tip.includes(`${w}cm`), beside, `${w}cm 幅: 本文に載る ⇔ 横に並ぶ`);
    const res = computeYardage("vest", w, guide.base);
    const h = res.placed.find((p) => p.label === "前身頃").h;
    if (beside) assert.ok(res.rawCm < h * 2, `${w}cm 幅: 身頃 2 枚ぶんに届かない`);
    else assert.ok(res.rawCm >= h * 2, `${w}cm 幅: 身頃 2 枚ぶん以上積む`);
  }
});

test("ベストの早見表は、袖丈を使わず、表地のみ・裏地は別を明記する", () => {
  const guide = getGuide("vest");
  assert.ok(guide.axes.every((a) => a.key !== "sleeveLen") && !("sleeveLen" in guide.base));
  assert.ok(guide.tips.some((t) => t.includes("表地だけ") && t.includes("裏地")));
  assert.ok(guide.tips.some((t) => t.includes("ポケット") && t.includes("衿") && t.includes("含みません")), "含まないパーツを明記する");
  assert.ok(guide.pieces.includes("表地のみ"));
});

// ---------------------------------------------------------------------------
// ハーフパンツの早見表: ページが出ること、本文の主張が計算と配置で裏づけられること。
// ---------------------------------------------------------------------------

test("ハーフパンツの早見表ページが生成対象・一覧・作品の列挙に入る", () => {
  assert.ok(getGuide("shorts"), "GUIDES に shorts がある");
  assert.ok(buildOverview().rows.some((r) => r.guide.slug === "shorts"), "代表的な一着の比較表に入る");
  for (const src of [read("README.md"), read("app", "layout.tsx"), read("app", "yardage", "page.tsx")]) {
    assert.ok(src.includes("ハーフパンツ"), "対象の衣服の列挙にハーフパンツが入る");
  }
});

test("ハーフパンツの lead『丈が長いほど必要な長さは増える』は、全生地幅で丈の行ごとに増えることで成立する", () => {
  const guide = getGuide("shorts");
  assert.ok(/丈が長いほど、必要な長さは増えます/.test(guide.lead), "前提: lead がこの主張をしている");
  const axis = guide.axes.find((a) => a.key === "shortsLen");
  const table = buildTable(guide, axis);
  assert.ok(table.rows.length >= 2);
  for (let i = 0; i < table.widths.length; i += 1) {
    for (let k = 1; k < table.rows.length; k += 1) {
      const a = table.rows[k - 1].cells[i];
      const b = table.rows[k].cells[i];
      assert.ok(b.totalCm > a.totalCm, `${table.widths[i]}cm 幅: ${table.rows[k - 1].label}→${table.rows[k].label} で増える`);
    }
  }
});

test("ハーフパンツ: 本文の『縦に積まれる／横に並べられる』と長さは配置から出ていて、積まれる幅は前パンツ 2 枚ぶん以上", () => {
  const guide = getGuide("shorts");
  const tips = derivedTipsFor(guide).join("\n");
  assert.ok(tips.length > 0, "注記が出る（前提: 積まれる幅と並ぶ幅の両方がある）");
  for (const w of FABRIC_WIDTHS) {
    const res = computeYardage("shorts", w, guide.base);
    const beside = sameRow("shorts", w, guide.base, "前パンツ", "後パンツ");
    const seg = beside ? tips.split("横に並べられる")[1] : tips.split("横に並べられる")[0];
    assert.ok(seg.includes(`${w}cm 幅で ${res.totalM.toFixed(1)}m`), `${w}cm 幅は${beside ? "横並び" : "縦積み"}側に実測値で載る`);
    const h = res.placed.find((p) => p.label === "前パンツ").h;
    if (beside) assert.ok(res.rawCm < h * 2, `${w}cm 幅: 前パンツ 2 枚ぶんに届かない`);
    else assert.ok(res.rawCm >= h * 2, `${w}cm 幅: 前パンツ 2 枚ぶん以上積む`);
  }
});

test("ハーフパンツの早見表: 丈の行は入力範囲内で、含まないものを tips に一本で明記し、断定を避ける", () => {
  const guide = getGuide("shorts");
  const axis = guide.axes.find((a) => a.key === "shortsLen");
  const input = getGarment("shorts").inputs.find((i) => i.key === "shortsLen");
  for (const row of axis.rows) assert.ok(row.value >= input.min && row.value <= input.max, `${row.label}: 入力範囲内`);
  assert.ok(guide.base.shortsLen >= input.min && guide.base.shortsLen <= input.max);
  // 含まないパーツの案内は tips の 1 か所だけにする（pieces・lead に重ねて書かない）。
  const notIncluded = (t) => t.includes("ポケット") && t.includes("別に見積もって") && t.includes("ゴムを通す場合は、仕立て方によって別に必要なことがあります");
  assert.equal(guide.tips.filter(notIncluded).length, 1, "tips に 1 件");
  assert.ok(!guide.pieces.includes("ポケット") && !guide.lead.includes("ポケット"), "pieces・lead に重ねない");
  assert.ok(/見込んでいます/.test(guide.lead) && !/だけで仕立てます/.test(guide.lead), "lead は見込みの範囲として書く");
  assert.ok(!/夏/.test(guide.description + guide.lead), "季節の用途を主張しない");
  assert.ok(getGarment("shorts").blurb.includes("ポケット"), "計算機の説明にも含まないものを書く");
  assert.ok(!/ゴムの通し代は(含みません|含まない)/.test(JSON.stringify(guide) + getGarment("shorts").blurb), "ゴムの通し代を『含まない』と断定しない（余裕との二重計上を言い切れない）");
  // 丈の行は身長・体型で意味が変わる呼称（ひざ丈・ハーフ等）を付けない。
  for (const row of axis.rows) assert.ok(!/（/.test(row.label), `${row.label}: 呼称を付けない`);
});

for (const [slug, front, back] of [["shorts", "前パンツ", "後パンツ"], ["pants", "前パンツ", "後パンツ"]]) {
  test(`${slug}: 『ヒップ別の表で前後が横に並ばなくなる行』は配置から出ていて、その行で必要な長さが他の行より大きく増える`, () => {
    const guide = getGuide(slug);
    const tips = derivedTipsFor(guide).join("\n");
    const axis = guide.axes.find((a) => a.key === "hip");
    const table = buildTable(guide, axis);
    let lostCount = 0;
    table.widths.forEach((w, i) => {
      for (let k = 1; k < table.rows.length; k += 1) {
        const prev = sameRow(slug, w, { ...guide.base, hip: table.rows[k - 1].value }, front, back);
        const cur = sameRow(slug, w, { ...guide.base, hip: table.rows[k].value }, front, back);
        const said = tips.includes(`${w}cm 幅は ${axis.rowHeader} ${table.rows[k].label} の行から`);
        assert.equal(said, prev && !cur, `${w}cm 幅・${table.rows[k].label}: 本文に載る ⇔ 並ぶ→並ばない`);
        if (!(prev && !cur)) continue;
        lostCount += 1;
        const inc = (j) => table.rows[j].cells[i].totalCm - table.rows[j - 1].cells[i].totalCm;
        for (let j = 1; j < table.rows.length; j += 1) {
          if (j !== k) assert.ok(inc(k) > inc(j), `${w}cm 幅: ${table.rows[k].label} の増え方 ${inc(k)}cm > ${table.rows[j].label} の ${inc(j)}cm`);
        }
      }
    });
    assert.ok(lostCount > 0, "前提: 並ばなくなる箇所がある（空のまま通さない）");
  });
}

test("ハーフパンツ⇔パンツの案内は、入力範囲の数値（重なる丈・上限）から書いていて、重なる丈は同じ用尺になる", () => {
  const shorts = getGuide("shorts");
  const sIn = getGarment("shorts").inputs.find((i) => i.key === "shortsLen");
  const pIn = getGarment("pants").inputs.find((i) => i.key === "pantsLen");
  // ハーフパンツ → パンツ: 上限を超える丈の案内。
  const back = buildTable(shorts, shorts.axes.find((a) => a.key === "shortsLen"));
  assert.equal(back.seeAlso?.slug, "pants");
  assert.ok(back.seeAlso.text.includes(`${sIn.max}cm を超える`), "案内の境界は入力の上限と一致");
  // パンツ → ハーフパンツ: 重なる丈（パンツの下限〜ハーフパンツの上限）。
  const pants = getGuide("pants");
  const pAxis = pants.axes.find((a) => a.key === "pantsLen");
  const table = buildTable(pants, pAxis);
  assert.deepEqual(table.seeAlso && { slug: table.seeAlso.slug, name: table.seeAlso.name }, { slug: "shorts", name: shorts.searchName });
  assert.ok(table.seeAlso.text.includes(`${pIn.min}〜${sIn.max}cm`), "重なる丈の範囲を数値で言う");
  assert.ok(/同じ値/.test(table.seeAlso.after), "『同じ値』と言う");
  assert.ok(pIn.min <= sIn.max, "前提: 範囲が重なる");
  // 『同じ値』の根拠: 固定する寸法（ヒップ）が両ページで同じで、重なる丈はどの生地幅でも同じ用尺。
  assert.equal(pants.base.hip, shorts.base.hip, "ヒップの固定値が同じ");
  let checked = 0;
  for (let len = pIn.min; len <= sIn.max; len += 1) {
    for (const w of FABRIC_WIDTHS) {
      const a = computeYardage("pants", w, { ...pants.base, pantsLen: len });
      const b = computeYardage("shorts", w, { ...shorts.base, shortsLen: len });
      assert.deepEqual([a.totalCm, a.widthShortage], [b.totalCm, b.widthShortage], `丈 ${len}cm@${w}`);
      checked += 1;
    }
  }
  assert.ok(checked > 0);
  // パンツ側の丈の行のうち重なる範囲にある行は、ハーフパンツ側と同じ値を表に出す。
  assert.ok(pAxis.rows.some((r) => r.value >= pIn.min && r.value <= sIn.max), "前提: 重なる範囲に行がある");
  // 呼称は、身長・体型で意味が変わる語（ハーフ等）を行ラベルに付けない。
  for (const row of pAxis.rows.filter((r) => r.value <= sIn.max)) assert.ok(!/ハーフ|短め/.test(row.label), `${row.label}: 呼称を付けない`);
  assert.ok(read("app", "yardage", "[garment]", "page.tsx").includes("{table.seeAlso.after}"), "ページが案内の続きを出す");
});

test("表の右端（裁断図の列）の余白・見出し補足の折り返しは、フェードが掛かる狭い画面（40rem 以下）だけに効く", () => {
  const css = read("app", "yardage", "yardage.css");
  const globals = read("app", "globals.css");
  // フェードの幅と、フェードを掛ける画面幅（globals.css の mask）を取り、同じ条件で余白を取っていること。
  const fade = globals.match(/@media \(max-width: ([\d.]+rem)\)\s*\{\s*\.guide-table-wrap\s*\{[^}]*calc\(100% - (\d+)px\)/);
  assert.ok(fade, "前提: globals.css のフェード定義が見つかる");
  const [, maxWidth, fadePx] = fade;
  const block = css.match(new RegExp(`@media \\(max-width: ${maxWidth.replace(".", "\\.")}\\)\\s*\\{([\\s\\S]*?\\n\\})`, "g")) ?? [];
  const mine = block.find((b) => b.includes(".yardage-table th:last-child"));
  assert.ok(mine, "最後の列の規則が同じ幅条件の @media の中にある");
  assert.ok(new RegExp(`padding-inline-end: ${fadePx}px`).test(mine), "余白はフェードの幅と同じ");
  assert.ok(/\.yardage-table thead th:last-child small\s*\{\s*white-space: normal;/.test(mine));
  // @media の外には、最後の列への規則が無い（広い画面と既存の見た目を変えない）。
  const outside = css.replace(mine, "");
  assert.ok(!/th:last-child|td:last-child/.test(outside), "広い画面には効かせない");
});
