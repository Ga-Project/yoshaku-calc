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
  SELVAGE_CM,
  MAX_PERMUTE_PIECES,
  packPieces,
} from "../lib/calc.mjs";

/** 各種別の既定値で raw 入力を作る。 */
function defaults(garment) {
  const v = {};
  for (const input of garment.inputs) v[input.key] = input.def;
  return v;
}

test("GARMENTS は8種別・各々が入力定義と pieces 関数を持つ", () => {
  assert.equal(GARMENTS.length, 8);
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
  // （以前に行高の結合で逆転が起きた入力と同じ形の組み合わせを含める）。
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
      assert.ok(p.x + p.w <= res.usableWidth + 0.001, "耳を除いた幅に収まる");
  }
});

test("formatMeters は小数1桁の m 表記", () => {
  assert.equal(formatMeters(230), "2.3m");
  assert.equal(formatMeters(100), "1.0m");
});

test("エプロン: 本体・腰ひも・首ひも・ポケットを裁ち、袖は持たない", () => {
  const res = computeYardage("apron", 110, {});
  const labels = res.placed.map((p) => p.label).sort();
  assert.deepEqual(labels, ["ポケット", "本体", "腰ひも（2本分）", "首ひも"].sort());
  assert.ok(!getGarment("apron").inputs.some((i) => i.key === "sleeveLen"), "袖丈の入力を持たない");
});

test("エプロン: 140cm 幅ではひもが本体の横に並び、並ばない 90cm 幅より短い", () => {
  const wide = computeYardage("apron", 140, {});
  const body = wide.placed.find((p) => p.label === "本体");
  const tie = wide.placed.find((p) => p.label === "腰ひも（2本分）");
  assert.equal(tie.y, body.y, "腰ひもが本体と同じ行に置かれる");
  const narrow = computeYardage("apron", 90, {});
  assert.ok(wide.totalCm < narrow.totalCm, `140cm(${wide.totalCm}) < 90cm(${narrow.totalCm})`);
});

test("エプロン: 裾幅が広すぎると 90cm 幅で本体が収まらない印が出る", () => {
  const res = computeYardage("apron", 90, { apronLen: 85, hemWidth: 90, tieLen: 60 });
  assert.equal(res.widthShortage, true);
  assert.ok(res.placed.find((p) => p.label === "本体").overflow);
  assert.equal(computeYardage("apron", 140, { apronLen: 85, hemWidth: 90, tieLen: 60 }).widthShortage, false);
});

test("必要長さが同じなら、図は選んだ生地幅での並べ方を見せる", () => {
  // 裾幅 60cm のエプロンは 90cm と 110cm で必要長さが同じ。110cm を選んだら、腰ひもが本体の横に並ぶ
  // 110cm の配置を描く（90cm の配置を流用すると、右に空きを残したまま下に積んだ図になる）。
  const v = { apronLen: 85, hemWidth: 60, tieLen: 60 };
  const res = computeYardage("apron", 110, v);
  const narrow = computeYardage("apron", 90, v);
  assert.equal(res.rawCm, narrow.rawCm, "前提: 90cm と同じ長さ");
  assert.notDeepEqual(res.placed.map((p) => [p.x, p.y]), narrow.placed.map((p) => [p.x, p.y]), "前提: 配置は違う");
  const body = res.placed.find((p) => p.label === "本体");
  const tie = res.placed.find((p) => p.label === "腰ひも（2本分）");
  assert.equal(tie.y, body.y, "腰ひもが本体と同じ行にある");
});

test("寸法を増やして必要量が減らない（全種別・全入力を 1cm 刻みで走査）", () => {
  // 詰める順番を 1 通りに固定していた頃は、丈を 1cm 伸ばすと順番が入れ替わって
  // 必要量が 20cm 減る、といった逆転が起きていた（例: エプロン総丈 55→56cm）。
  let checked = 0;
  for (const g of GARMENTS) {
    const base = defaults(g);
    for (const input of g.inputs) {
      for (const w of FABRIC_WIDTHS) {
        let prev = -Infinity;
        for (let x = input.min; x <= input.max; x += 1) {
          const t = computeYardage(g.id, w, { ...base, [input.key]: x }).totalCm;
          assert.ok(t >= prev, `${g.id}.${input.key}@${w}: ${x - 1}→${x}cm で ${prev}→${t}cm に減った`);
          prev = t;
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 1000, `走査した組み合わせが十分にある: ${checked}`);
});

/** 各入力を min / 既定値 / max に振った全組み合わせ。 */
function grid(garment) {
  let combos = [{}];
  for (const input of garment.inputs) {
    const vals = [...new Set([input.min, input.def, input.max])];
    combos = combos.flatMap((c) => vals.map((v) => ({ ...c, [input.key]: v })));
  }
  return combos;
}

test("配置の不変条件: はみ出しは必ず印つき・重ならない・長さは配置の外形と一致・広い幅で長くならない", () => {
  let checked = 0;
  for (const g of GARMENTS) {
    for (const v of grid(g)) {
      let prevTotal = Infinity;
      for (const w of FABRIC_WIDTHS) {
        const r = computeYardage(g.id, w, v);
        for (const p of r.placed) {
          assert.equal(p.overflow, p.w > r.usableWidth, `${g.id}@${w}: ${p.label} の overflow は使える幅超えと一致`);
          if (!p.overflow) assert.ok(p.x + p.w <= r.usableWidth, `${g.id}@${w}: ${p.label} が耳を除いた幅に収まる`);
        }
        for (let i = 0; i < r.placed.length; i += 1) {
          for (let j = i + 1; j < r.placed.length; j += 1) {
            const a = r.placed[i];
            const b = r.placed[j];
            const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            assert.ok(!overlap, `${g.id}@${w}: ${a.label} と ${b.label} が重ならない`);
          }
        }
        assert.equal(r.rawCm, Math.max(...r.placed.map((p) => p.y + p.h)), `${g.id}@${w}: rawCm = 配置の外形`);
        assert.ok(r.totalCm <= prevTotal, `${g.id}@${w}: 広い幅で長くならない`);
        prevTotal = r.totalCm;
        checked += 1;
      }
    }
  }
  assert.ok(checked > 100, `検査した組み合わせ: ${checked}`);
});

test("寸法を増やして必要量が減らない（他の入力を min/既定値/max に振った格子でも）", () => {
  let checked = 0;
  for (const g of GARMENTS) {
    for (const base of grid(g)) {
      for (const input of g.inputs) {
        for (const w of FABRIC_WIDTHS) {
          let prev = -Infinity;
          const xs = [];
          for (let x = input.min; x < input.max; x += 2) xs.push(x);
          xs.push(input.max);
          for (const x of xs) {
            const t = computeYardage(g.id, w, { ...base, [input.key]: x }).totalCm;
            assert.ok(t >= prev, `${g.id}.${input.key}@${w} (${JSON.stringify(base)}): ${x}cm で ${prev}→${t}`);
            prev = t;
            checked += 1;
          }
        }
      }
    }
  }
  assert.ok(checked > 10000, `走査した組み合わせ: ${checked}`);
});

test("全種別のパーツ枚数は全順番を試す上限以内（上限を超える種別を足すと詰め方が粗くなる）", () => {
  for (const g of GARMENTS) {
    for (const v of grid(g)) {
      const n = g.pieces(normalizeValues(g, v)).length;
      assert.ok(n <= MAX_PERMUTE_PIECES, `${g.id}: ${n} 枚 <= ${MAX_PERMUTE_PIECES}`);
    }
  }
});

test("上限を超える枚数では背の高い順の 1 通りだけで詰め、すぐに返る", () => {
  const pieces = Array.from({ length: MAX_PERMUTE_PIECES + 3 }, (_, i) => ({
    label: `p${i}`,
    w: 10 + (i % 3) * 7,
    h: 20 + ((i * 13) % 50),
    color: "front",
  }));
  const r = packPieces(pieces, 45);
  const heights = r.placed.map((p) => p.h);
  assert.deepEqual(heights, [...heights].sort((a, b) => b - a), "背の高い順に置かれている");
  assert.deepEqual(r.placed.map((p) => p.order).sort((a, b) => a - b), pieces.map((_, i) => i), "order は元の順番");
});

test("耳の分を引いた幅で並べる: 使える幅 = 作業幅 − 耳。表示の作業幅いっぱいに頼る配置は採らない", () => {
  for (const g of GARMENTS) {
    for (const w of FABRIC_WIDTHS) {
      const r = computeYardage(g.id, w, defaults(g));
      assert.equal(r.usableWidth, w / 2 - SELVAGE_CM);
      const right = Math.max(...r.placed.filter((p) => !p.overflow).map((p) => p.x + p.w));
      assert.ok(right <= r.usableWidth, `${g.id}@${w}: 右端 ${right} が使える幅 ${r.usableWidth} 以内`);
    }
  }
  // 設計レビューで見つかった「残り幅 0〜1cm」の配置が採られていないこと。
  assert.ok(computeYardage("dress", 110, {}).totalCm >= 270, "ワンピース 110cm は袖を身頃の横に詰め込まない");
  assert.ok(computeYardage("apron", 90, {}).totalCm >= 180, "エプロン 90cm は作業幅ちょうどの配置に頼らない");
});

test("裁断図の下の表記は、どの生地幅でも図の枠に収まる（左右に余白を残す）", async () => {
  const { figureWidth, figureCaption, estimateTextWidth, CAPTION_FONT } = await import("../lib/figure.mjs");
  for (const w of FABRIC_WIDTHS) {
    const working = w / 2;
    const text = figureCaption(working, w);
    const width = estimateTextWidth(text, CAPTION_FONT);
    assert.ok(width <= figureWidth(working) - 2, `${w}cm 幅: 表記 ${width.toFixed(1)} <= 枠 ${figureWidth(working) - 2}`);
  }
  // 見積もり自体の妥当性: 全角だけの文字列は 1 字 = 文字サイズ。
  assert.equal(estimateTextWidth("作業幅", 2), 6);
});

// ---------------------------------------------------------------------------
// コート: ジャケットとの違い（丈・ゆとり・ポケット・衿/見返し）が計算に現れること。
// ---------------------------------------------------------------------------

/** コートとジャケットが共通に受け付ける範囲（どちらでもクランプされない値）。 */
function sharedRange(key) {
  const c = getGarment("coat").inputs.find((i) => i.key === key);
  const j = getGarment("jacket").inputs.find((i) => i.key === key);
  return { min: Math.max(c.min, j.min), max: Math.min(c.max, j.max) };
}

test("コート: 入力は着丈・袖丈・バストで、説明に表地のみ・裏地は別と書く", () => {
  const coat = getGarment("coat");
  assert.deepEqual(coat.inputs.map((i) => i.key), ["bodyLen", "sleeveLen", "bust"]);
  for (const i of coat.inputs) assert.ok(i.min <= i.def && i.def <= i.max, `${i.key}: 既定値が範囲内`);
  assert.ok(coat.blurb.includes("表地のみ") && coat.blurb.includes("裏地は別"), "表地のみ・裏地は別を明示");
  const labels = computeYardage("coat", 110, {}).placed.map((p) => p.label);
  assert.ok(labels.includes("ポケット"), "ジャケットに無いポケットを裁つ");
  assert.equal(labels.length, MAX_PERMUTE_PIECES, "全順番を試せる枚数に収まる");
});

test("コート: 同じ寸法なら各パーツがジャケット以上の大きさで、衿・見返しは着丈とともに伸びる", () => {
  const v = { bodyLen: 90, sleeveLen: 58, bust: 96 };
  const coat = getGarment("coat").pieces(v);
  const jacket = getGarment("jacket").pieces(v);
  for (const jp of jacket) {
    const cp = coat.find((p) => p.label === jp.label);
    assert.ok(cp, `${jp.label} をコートも裁つ`);
    assert.ok(cp.w >= jp.w && cp.h >= jp.h, `${jp.label}: コート ${cp.w}x${cp.h} >= ジャケット ${jp.w}x${jp.h}`);
  }
  const body = (pcs) => pcs.find((p) => p.label === "前身頃");
  assert.ok(body(coat).w > body(jacket).w, "身頃のゆとりがジャケットより大きい");
  const facing = (len) => getGarment("coat").pieces({ ...v, bodyLen: len }).find((p) => p.label === "衿・見返し").h;
  assert.ok(facing(120) > facing(80), "衿・見返しは着丈に比例する（ジャケットの固定長と違う）");
});

test("コート: 同じ寸法ならジャケットより短くならない（共通の入力範囲を走査）", () => {
  const L = sharedRange("bodyLen");
  const S = sharedRange("sleeveLen");
  const B = sharedRange("bust");
  let checked = 0;
  let longer = 0;
  for (let bodyLen = L.min; bodyLen <= L.max; bodyLen += 5) {
    for (let sleeveLen = S.min; sleeveLen <= S.max; sleeveLen += 4) {
      for (let bust = B.min; bust <= B.max; bust += 4) {
        const v = { bodyLen, sleeveLen, bust };
        for (const w of FABRIC_WIDTHS) {
          const c = computeYardage("coat", w, v).totalCm;
          const j = computeYardage("jacket", w, v).totalCm;
          assert.ok(c >= j, `${JSON.stringify(v)}@${w}: コート ${c}cm >= ジャケット ${j}cm`);
          if (c > j) longer += 1;
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 1000, `走査した組み合わせ: ${checked}`);
  assert.ok(longer > checked / 2, `違いが計算に現れる（長くなる組み合わせが過半: ${longer}/${checked}）`);
});

test("コート: 既定値では 90/110/140cm で必要量が単調非増加、幅不足は使える幅との比較どおりに印がつく", () => {
  const coat = getGarment("coat");
  for (const v of [defaults(coat), ...grid(coat)]) {
    let prev = Infinity;
    for (const w of FABRIC_WIDTHS) {
      const r = computeYardage("coat", w, v);
      assert.ok(r.totalCm <= prev, `${JSON.stringify(v)}@${w}: ${r.totalCm} <= ${prev}`);
      prev = r.totalCm;
      const over = r.placed.filter((p) => p.w > r.usableWidth);
      assert.equal(r.widthShortage, over.length > 0, `${JSON.stringify(v)}@${w}: 幅不足の印は使える幅超えと一致`);
      if (r.widthShortage) assert.ok(r.notes[0].includes("生地幅"), "幅不足の注記を先頭に出す");
    }
  }
  const at = FABRIC_WIDTHS.map((w) => computeYardage("coat", w, {}));
  assert.ok(at.every((r) => !r.widthShortage), "既定値はどの幅にも収まる");
  assert.ok(at[0].totalCm > at[at.length - 1].totalCm, "広い幅の方が短い");
});

test("コート: 大きいサイズは 90cm 幅で身頃が収まらず、140cm 幅なら収まる", () => {
  const big = { bodyLen: 95, sleeveLen: 58, bust: 136 };
  const narrow = computeYardage("coat", 90, big);
  assert.equal(narrow.widthShortage, true);
  assert.ok(narrow.placed.some((p) => p.overflow && p.label.includes("身頃")));
  assert.equal(computeYardage("coat", 140, big).widthShortage, false);
});

test("コート: 寸法を増やして必要量が減らない（各入力を 1cm 刻み・全生地幅）", () => {
  const coat = getGarment("coat");
  for (const input of coat.inputs) {
    for (const w of FABRIC_WIDTHS) {
      let prev = -Infinity;
      for (let x = input.min; x <= input.max; x += 1) {
        const t = computeYardage("coat", w, { ...defaults(coat), [input.key]: x }).totalCm;
        assert.ok(t >= prev, `coat.${input.key}@${w}: ${x}cm で ${prev}→${t}`);
        prev = t;
      }
    }
  }
});

test("コート: 全入力範囲（1cm 刻み）で、ジャケットの各パーツ以上の大きさのパーツを持ち、枚数は全順番を試せる範囲", () => {
  // 1 つの詰め順に固定した棚詰めでは、パーツを大きくして逆に短くなることがある
  // （例: 幅 10 に A(5×1)・B(5×10)・C(5×10) の順で 20、A を幅 6 にすると 11）。
  // 根拠はそこではなく、全ての詰め順を試した最小が「最適な棚の分け方」の長さと一致し、
  // その最適値はパーツを縮めても取り除いても増えない（同じ分け方がそのまま使える）こと。
  // 選んだ幅以下の生地幅での最小も同じ理由で保たれる。したがってコートの各パーツが
  // ジャケットの対応するパーツ以上なら、用尺もジャケット以上になる。全ての詰め順を試すのは
  // 枚数が上限以内のときだけなので、両方の枚数が上限以内であることも確かめる。
  const L = sharedRange("bodyLen");
  const S = sharedRange("sleeveLen");
  const B = sharedRange("bust");
  let checked = 0;
  for (let bodyLen = L.min; bodyLen <= L.max; bodyLen += 1) {
    for (let sleeveLen = S.min; sleeveLen <= S.max; sleeveLen += 1) {
      for (let bust = B.min; bust <= B.max; bust += 1) {
        const v = { bodyLen, sleeveLen, bust };
        const coat = getGarment("coat").pieces(v);
        const jacket = getGarment("jacket").pieces(v);
        assert.ok(coat.length <= MAX_PERMUTE_PIECES, `${JSON.stringify(v)}: コートの枚数が上限以内`);
        assert.ok(jacket.length <= MAX_PERMUTE_PIECES, `${JSON.stringify(v)}: ジャケットの枚数が上限以内`);
        const used = new Set();
        for (const jp of jacket) {
          const k = coat.findIndex((cp, i) => !used.has(i) && cp.label === jp.label && cp.w >= jp.w && cp.h >= jp.h);
          assert.ok(k >= 0, `${JSON.stringify(v)}: ${jp.label} に対応するコートのパーツが同じ大きさ以上`);
          used.add(k);
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, (L.max - L.min + 1) * (S.max - S.min + 1) * (B.max - B.min + 1));
});

test("種別の絵文字は重複せず、コートは 🧥（ジャケットはコートの絵を使わない）", () => {
  const emojis = GARMENTS.map((g) => g.emoji);
  assert.equal(new Set(emojis).size, emojis.length, "絵文字が重複しない");
  assert.equal(getGarment("coat").emoji, "🧥");
  assert.notEqual(getGarment("jacket").emoji, "🧥");
  assert.ok(getGarment("coat").blurb.includes("二枚袖"), "袖の 2 枚が二枚袖（上袖・下袖）だと分かる");
});

// ---------------------------------------------------------------------------
// ベスト: 袖を持たず、前後の身頃と見返しを裁つ。
// ---------------------------------------------------------------------------

test("ベスト: 入力は着丈・バストだけで、前後の身頃と見返しを裁ち、袖は持たない", () => {
  const vest = getGarment("vest");
  assert.deepEqual(vest.inputs.map((i) => i.key), ["bodyLen", "bust"]);
  for (const i of vest.inputs) assert.ok(i.min <= i.def && i.def <= i.max, `${i.key}: 既定値が範囲内`);
  assert.ok(vest.blurb.includes("袖なし") && vest.blurb.includes("表地のみ") && vest.blurb.includes("裏地は別"));
  const labels = computeYardage("vest", 110, {}).placed.map((p) => p.label);
  assert.deepEqual([...labels].sort(), ["前身頃", "後身頃", "見返し"].sort());
  assert.ok(labels.length <= MAX_PERMUTE_PIECES, "全順番を試せる枚数に収まる");
});

test("ベスト: 着丈・バストを増やしても必要量は減らず、広い生地幅ほど短い（1cm 刻み・全生地幅）", () => {
  const vest = getGarment("vest");
  for (const input of vest.inputs) {
    for (const w of FABRIC_WIDTHS) {
      let prev = -Infinity;
      for (let x = input.min; x <= input.max; x += 1) {
        const t = computeYardage("vest", w, { ...defaults(vest), [input.key]: x }).totalCm;
        assert.ok(t >= prev, `vest.${input.key}@${w}: ${x}cm で ${prev}→${t}`);
        prev = t;
      }
    }
  }
  for (const v of [defaults(vest), ...grid(vest)]) {
    let prev = Infinity;
    for (const w of FABRIC_WIDTHS) {
      const r = computeYardage("vest", w, v);
      assert.ok(r.totalCm <= prev, `${JSON.stringify(v)}@${w}: ${r.totalCm} <= ${prev}`);
      prev = r.totalCm;
      const over = r.placed.filter((p) => p.w > r.usableWidth);
      assert.equal(r.widthShortage, over.length > 0, "幅不足の印は使える幅超えと一致");
    }
  }
});

test("ベスト: 最も大きい寸法でも 90cm 幅の使える幅に身頃が収まる（早見表に幅不足の印を出す必要がない）", () => {
  const vest = getGarment("vest");
  const maxV = Object.fromEntries(vest.inputs.map((i) => [i.key, i.max]));
  for (const w of FABRIC_WIDTHS) assert.equal(computeYardage("vest", w, maxV).widthShortage, false, `${w}cm 幅`);
});

test("ベストの絵文字は安全ベスト（🦺）ではなく、袖なしの上衣に近い 🎽", () => {
  assert.equal(getGarment("vest").emoji, "🎽");
});
