// 用尺カルク — 計算エンジンのテスト（node:test 標準ランナー・追加の依存なし）
// 実行: pnpm test (= node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GARMENTS,
  FABRIC_WIDTHS,
  computeYardage,
  normalizeValues,
  getGarment,
  formatMeters,
  SAFETY_MARGIN_CM,
} from "../lib/calc.mjs";

/** 各種別の既定値で raw 入力を作る。 */
function defaults(garment) {
  const v = {};
  for (const input of garment.inputs) v[input.key] = input.def;
  return v;
}

test("GARMENTS は5種別・各々が入力定義と pieces 関数を持つ", () => {
  assert.equal(GARMENTS.length, 5);
  for (const g of GARMENTS) {
    assert.ok(g.id && g.label && typeof g.pieces === "function");
    assert.ok(Array.isArray(g.inputs) && g.inputs.length >= 1);
    for (const input of g.inputs) {
      assert.ok(
        input.min <= input.def && input.def <= input.max,
        `${g.id}.${input.key} の既定値が範囲内`,
      );
    }
  }
});

test("既定値で全種別が妥当な用尺を返す（正の長さ・10cm 単位・最低30cm）", () => {
  for (const g of GARMENTS) {
    for (const w of FABRIC_WIDTHS) {
      const res = computeYardage(g.id, w, defaults(g));
      assert.ok(res, `${g.id}@${w} が結果を返す`);
      assert.ok(res.totalCm >= 30, `${g.id}@${w} は最低30cm`);
      assert.equal(res.totalCm % 10, 0, `${g.id}@${w} は10cm単位`);
      assert.equal(res.totalM, res.totalCm / 100);
      assert.ok(res.placed.length >= 2, `${g.id}@${w} はパーツが配置される`);
      assert.equal(res.workingWidth, w / 2);
    }
  }
});

test("生地幅が広いほど用尺は短く（または同じに）なる", () => {
  for (const g of GARMENTS) {
    const v = defaults(g);
    const narrow = computeYardage(g.id, 90, v).totalCm;
    const mid = computeYardage(g.id, 110, v).totalCm;
    const wide = computeYardage(g.id, 140, v).totalCm;
    assert.ok(mid <= narrow, `${g.id}: 110cm(${mid}) <= 90cm(${narrow})`);
    assert.ok(wide <= mid, `${g.id}: 140cm(${wide}) <= 110cm(${mid})`);
  }
});

test("単調性: 入力空間を広く走査しても 90cm >= 110cm >= 140cm が常に成立", () => {
  // shelf packing の行高結合で逆転が起きやすい領域を含めて網羅的にサンプルする
  // （CTO レビュー B-1 の反例クラスをカバー）。
  const lensA = [40, 53, 62, 80, 105, 140];
  const lensB = [0, 24, 54, 70];
  const circ = [70, 88, 96, 120, 140];
  let checked = 0;
  for (const g of GARMENTS) {
    for (const a of lensA) {
      for (const b of lensB) {
        for (const c of circ) {
          const v = {};
          for (const input of g.inputs) {
            v[input.key] = input.key.includes("Len")
              ? input.key === "sleeveLen"
                ? b
                : a
              : c;
          }
          const t90 = computeYardage(g.id, 90, v).totalCm;
          const t110 = computeYardage(g.id, 110, v).totalCm;
          const t140 = computeYardage(g.id, 140, v).totalCm;
          assert.ok(
            t110 <= t90 && t140 <= t110,
            `${g.id} ${JSON.stringify(v)}: 90=${t90} 110=${t110} 140=${t140} で逆転`,
          );
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 200, `走査件数 ${checked}`);
});

test("回帰: 旧実装の反例(shirt bust70/sleeve53/body40)で逆転しない", () => {
  const v = { bodyLen: 40, sleeveLen: 53, bust: 70 };
  const t90 = computeYardage("shirt", 90, v).totalCm;
  const t110 = computeYardage("shirt", 110, v).totalCm;
  const t140 = computeYardage("shirt", 140, v).totalCm;
  assert.ok(t110 <= t90, `110(${t110}) <= 90(${t90})`);
  assert.ok(t140 <= t110, `140(${t140}) <= 110(${t110})`);
});

test("用尺は素の積み上げ長 + 余裕を 10cm 切り上げた値", () => {
  const g = getGarment("skirt");
  const res = computeYardage("skirt", 110, defaults(g));
  const expected = Math.max(
    30,
    Math.ceil((res.rawCm + SAFETY_MARGIN_CM) / 10) * 10,
  );
  assert.equal(res.totalCm, expected);
});

test("範囲外の入力はクランプされる（負値→下限・特大→上限）", () => {
  const g = getGarment("shirt");
  const clamped = normalizeValues(g, {
    bodyLen: -50,
    sleeveLen: 9999,
    bust: 88,
  });
  const bodyLenDef = g.inputs.find((i) => i.key === "bodyLen");
  const sleeveDef = g.inputs.find((i) => i.key === "sleeveLen");
  assert.equal(clamped.bodyLen, bodyLenDef.min);
  assert.equal(clamped.sleeveLen, sleeveDef.max);
});

test("数値でない入力は既定値にフォールバックする", () => {
  const g = getGarment("shirt");
  const norm = normalizeValues(g, {
    bodyLen: "abc",
    sleeveLen: null,
    bust: undefined,
  });
  for (const input of g.inputs) {
    assert.equal(norm[input.key], input.def, `${input.key} は既定値`);
  }
});

test("袖丈0なら袖パーツを含めず注記を出す", () => {
  const res = computeYardage("shirt", 110, {
    bodyLen: 60,
    sleeveLen: 0,
    bust: 88,
  });
  const hasSleeve = res.placed.some((p) => p.label === "袖");
  assert.equal(hasSleeve, false);
  assert.ok(res.notes.some((n) => n.includes("袖丈0")));
});

test("大きいサイズのジャケットを90cm幅に載せると生地幅不足を警告する", () => {
  const big = { bodyLen: 70, sleeveLen: 60, bust: 140 };
  const onNarrow = computeYardage("jacket", 90, big);
  assert.equal(onNarrow.widthShortage, true);
  assert.ok(onNarrow.placed.some((p) => p.overflow));
  assert.ok(onNarrow.notes[0].includes("生地幅"));
  // 広い幅なら収まる
  const onWide = computeYardage("jacket", 140, big);
  assert.equal(onWide.widthShortage, false);
});

test("不正な種別 id は null を返す", () => {
  assert.equal(computeYardage("not-a-garment", 110, {}), null);
  assert.equal(getGarment("nope"), null);
});

test("不正な生地幅は標準幅(110)にフォールバックする", () => {
  const res = computeYardage("skirt", 123, defaults(getGarment("skirt")));
  assert.equal(res.fabricWidth, 110);
});

test("配置パーツは作業幅内に概ね収まり座標が非負", () => {
  const g = getGarment("dress");
  const res = computeYardage("dress", 140, defaults(g));
  for (const p of res.placed) {
    assert.ok(p.x >= 0 && p.y >= 0, "座標は非負");
    if (!p.overflow)
      assert.ok(p.x + p.w <= res.workingWidth + 0.001, "作業幅内に収まる");
  }
});

test("formatMeters は小数1桁の m 表記", () => {
  assert.equal(formatMeters(230), "2.3m");
  assert.equal(formatMeters(100), "1.0m");
});
