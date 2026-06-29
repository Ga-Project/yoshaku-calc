"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GARMENTS,
  FABRIC_WIDTHS,
  computeYardage,
  getGarment,
} from "@/lib/calc.mjs";

type CalcResult = NonNullable<ReturnType<typeof computeYardage>>;
type Store = Record<string, Record<string, string>>;

const STORAGE_KEY = "yoshaku-calc:v1";
const FIRST_GARMENT = GARMENTS[0]!;
const DEFAULT_WIDTH = FABRIC_WIDTHS[1]!; // 110cm

const PIECE_VARS: Record<string, string> = {
  front: "--piece-front",
  back: "--piece-back",
  sleeve: "--piece-sleeve",
  accent: "--piece-accent",
};

const WIDTH_KIND: Record<number, string> = {
  90: "シングル幅",
  110: "標準幅",
  140: "ダブル幅",
};

function defaultStore(): Store {
  const store: Store = {};
  for (const g of GARMENTS) {
    const row: Record<string, string> = {};
    for (const input of g.inputs) row[input.key] = String(input.def);
    store[g.id] = row;
  }
  return store;
}

function rowFor(store: Store, garmentId: string): Record<string, string> {
  return store[garmentId] ?? {};
}

function isFieldInvalid(raw: string, min: number, max: number): boolean {
  const t = raw.trim();
  if (t === "") return true;
  const n = Number(t);
  return !Number.isFinite(n) || n < min || n > max;
}

export default function Home() {
  const [garmentId, setGarmentId] = useState<string>(FIRST_GARMENT.id);
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [store, setStore] = useState<Store>(defaultStore);
  const [copied, setCopied] = useState(false);
  // 復元（localStorage/URL）が終わるまで保存 effect を走らせない。
  // 初回マウントで既定値が保存値を上書きするのを防ぐ。
  const [isRestored, setIsRestored] = useState(false);

  // マウント後にだけ 保存値 → URL クエリ の順で復元（描画時は window に触れない）。
  useEffect(() => {
    const next = defaultStore();
    let g = FIRST_GARMENT.id;
    let w = DEFAULT_WIDTH;
    let restored = false;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          if (getGarment(parsed.g)) g = parsed.g;
          if (FABRIC_WIDTHS.includes(parsed.w)) w = parsed.w;
          if (parsed.store && typeof parsed.store === "object") {
            for (const gid of Object.keys(next)) {
              const savedRow = parsed.store[gid];
              const row = next[gid];
              if (savedRow && row) {
                for (const k of Object.keys(row)) {
                  if (typeof savedRow[k] === "string") row[k] = savedRow[k];
                }
              }
            }
          }
          restored = true;
        }
      }
    } catch {
      /* 壊れた保存値は無視して既定値で続行 */
    }

    const params = new URLSearchParams(window.location.search);
    const qg = params.get("g");
    const qGarment = qg ? getGarment(qg) : null;
    if (qg && qGarment) {
      g = qg;
      const qw = Number(params.get("w"));
      if (FABRIC_WIDTHS.includes(qw)) w = qw;
      const row = next[g];
      if (row) {
        for (const input of qGarment.inputs) {
          const qv = params.get(input.key);
          if (qv !== null && qv.trim() !== "") row[input.key] = qv;
        }
      }
      restored = true;
    }

    if (restored) {
      setGarmentId(g);
      setWidth(w);
      setStore(next);
    }
    setIsRestored(true);
  }, []);

  const garment = getGarment(garmentId) ?? FIRST_GARMENT;
  const values = rowFor(store, garmentId);

  // 入力のうち1つでも範囲外/空なら結果は概算（計算は既定値にクランプされるが、
  // ユーザーには「いま見ている数値が入力どおりではない」ことを明示する）。
  const invalidCount = garment.inputs.filter((input) =>
    isFieldInvalid(values[input.key] ?? String(input.def), input.min, input.max),
  ).length;

  const result = useMemo<CalcResult>(() => {
    // garmentId は復元時に getGarment で検証済みなので常に有効。null にはならない。
    return computeYardage(garmentId, width, values)!;
  }, [garmentId, width, values]);

  // 状態を保存 & 共有用に URL を更新（履歴は汚さず replaceState）。
  useEffect(() => {
    if (!isRestored) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ g: garmentId, w: width, store }),
      );
    } catch {
      /* 保存不可（プライベートモード等）でも動作は継続 */
    }
    const params = new URLSearchParams();
    params.set("g", garmentId);
    params.set("w", String(width));
    for (const input of garment.inputs) {
      params.set(input.key, values[input.key] ?? String(input.def));
    }
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", url);
  }, [isRestored, garmentId, width, store, garment, values]);

  function updateField(key: string, raw: string) {
    setStore((prev) => ({
      ...prev,
      [garmentId]: { ...rowFor(prev, garmentId), [key]: raw },
    }));
    setCopied(false);
  }

  async function shareUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function resetDefaults() {
    setStore((prev) => {
      const row: Record<string, string> = {};
      for (const input of garment.inputs) row[input.key] = String(input.def);
      return { ...prev, [garmentId]: row };
    });
    setCopied(false);
  }

  return (
    <>
      <a className="skip-link" href="#board">
        本文へスキップ
      </a>

      <div className="sheet">
        {/* 銘板ヘッダー（製図台の表題欄） */}
        <header className="plate">
          <div className="plate-brand">
            <span className="plate-mark" aria-hidden="true">
              尺
            </span>
            <span>
              <span className="plate-word">
                用<span className="mark">尺</span>カルク
              </span>
              <span className="plate-sub">
                衣服別 必要生地量・裁断レイアウト早見
              </span>
            </span>
          </div>
          <span className="plate-stamp" aria-hidden="true">
            CUTTING&nbsp;LAYOUT
          </span>
        </header>

        <p className="sheet-lead">
          作りたいものと生地幅・サイズを指定すると、
          <strong>必要な用尺と裁断の取り方</strong>
          を製図台の上に描き出します。布を買う前の見積りに。
        </p>

        <div className="board" id="board">
          {/* 脇: 型紙の指定パネル */}
          <form
            className="spec"
            aria-label="型紙の指定"
            onSubmit={(e) => e.preventDefault()}
          >
            <p className="spec-head">型紙の指定</p>

            <span className="spec-label" id="garment-label">
              衣服の種類
            </span>
            <div
              className="garment-list"
              role="group"
              aria-labelledby="garment-label"
            >
              {GARMENTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="garment-opt"
                  aria-pressed={g.id === garmentId}
                  onClick={() => {
                    setGarmentId(g.id);
                    setCopied(false);
                  }}
                >
                  <span className="emoji" aria-hidden="true">
                    {g.emoji}
                  </span>
                  {g.label}
                </button>
              ))}
            </div>
            <p className="spec-blurb">{garment.blurb}</p>

            <span className="spec-label" id="width-label">
              生地幅
            </span>
            <div
              className="width-row"
              role="group"
              aria-labelledby="width-label"
            >
              {FABRIC_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className="width-chip"
                  aria-pressed={w === width}
                  onClick={() => {
                    setWidth(w);
                    setCopied(false);
                  }}
                >
                  <span>{w}</span>
                  <small>{WIDTH_KIND[w] ?? ""}</small>
                </button>
              ))}
            </div>

            <span className="spec-label">サイズ（cm）</span>
            <div className="dims">
              {garment.inputs.map((input) => {
                const raw = values[input.key] ?? String(input.def);
                const invalid = isFieldInvalid(raw, input.min, input.max);
                const fieldId = `f-${garmentId}-${input.key}`;
                return (
                  <div className="dim" key={input.key}>
                    <input
                      id={fieldId}
                      type="number"
                      inputMode="numeric"
                      min={input.min}
                      max={input.max}
                      step={1}
                      value={raw}
                      aria-invalid={invalid}
                      aria-describedby={`${fieldId}-hint`}
                      onChange={(e) => updateField(input.key, e.target.value)}
                    />
                    <label htmlFor={fieldId}>{input.label}</label>
                    {invalid && (
                      <span className="dim-err" id={`${fieldId}-hint`}>
                        {input.min}〜{input.max}
                      </span>
                    )}
                    {!invalid && (
                      <span className="sr-only" id={`${fieldId}-hint`}>
                        {input.hint ?? `${input.min}〜${input.max}cm`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="spec-note">
              ＊裁ち代・地の目を見込んだ目安です。柄合わせのある生地は別途加算してください。
            </p>
          </form>

          {/* 主役: 製図台ステージ */}
          <section className="stage" aria-label="裁断レイアウト">
            {!isRestored ? (
              <div aria-hidden="true">
                <div
                  className="skeleton"
                  style={{ height: "2.6rem", width: "55%" }}
                />
                <div
                  className="skeleton"
                  style={{
                    height: "18px",
                    width: "100%",
                    marginTop: "var(--sp-4)",
                  }}
                />
                <div
                  className="skeleton"
                  style={{
                    height: "20rem",
                    width: "100%",
                    marginTop: "var(--sp-2)",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
              </div>
            ) : (
              <>
                <div className="stage-head">
                  <span className="stage-title">
                    裁断レイアウト
                    <br />
                    生地幅 {result.fabricWidth}cm
                  </span>
                  <p
                    className="stage-figure"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="stage-num">
                      {result.totalM.toFixed(1)}
                    </span>
                    <span className="stage-unit">
                      m / {result.totalCm}cm
                    </span>
                  </p>
                  <span className="stage-sub">
                    生地幅 {result.fabricWidth}cm・10cm 単位で購入する目安。
                  </span>
                </div>

                {invalidCount > 0 && (
                  <div
                    className="alert alert-err"
                    role="alert"
                    style={{ marginTop: "var(--sp-3)" }}
                  >
                    <span aria-hidden="true">⚠</span>
                    <span>
                      入力に範囲外の項目があります（{invalidCount}件）。その項目は
                      安全な範囲に丸めて計算しています。寸法欄をご確認ください。
                    </span>
                  </div>
                )}

                {result.widthShortage && (
                  <p className="stage-flag">
                    <span className="badge badge-warn">
                      生地幅が不足する可能性
                    </span>
                  </p>
                )}

                <Ruler workingWidth={result.workingWidth} totalCm={result.totalCm} />

                <div className="bolt">
                  <LayoutFigure result={result} />
                </div>

                <ul className="legend" aria-label="パーツの色">
                  {legendItems(result).map((item) => (
                    <li className="legend-item" key={item.color}>
                      <span
                        className="legend-swatch"
                        style={{
                          color: `var(${PIECE_VARS[item.color] ?? "--piece-front"})`,
                        }}
                        aria-hidden="true"
                      />
                      {item.label}
                    </li>
                  ))}
                </ul>

                <ul className="notes">
                  {result.notes.map((n, i) => (
                    <li key={`${i}-${n}`}>{n}</li>
                  ))}
                </ul>

                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={shareUrl}
                  >
                    この裁断図を共有
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => window.print()}
                  >
                    PDFで印刷
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetDefaults}
                  >
                    既定値に戻す
                  </button>
                  <span
                    className="action-status"
                    role="status"
                    aria-live="polite"
                  >
                    {copied ? "✓ URLをコピーしました" : ""}
                  </span>
                </div>
              </>
            )}
          </section>
        </div>

        <footer className="sheet-footer">
          用尺カルク —
          入力したサイズはこのブラウザにのみ保存され、外部には送信されません。
        </footer>
      </div>
    </>
  );
}

/** 凡例に出す色（結果に登場するパーツ種別だけ）。 */
function legendItems(result: CalcResult) {
  const labels: Record<string, string> = {
    front: "前パーツ",
    back: "後パーツ",
    sleeve: "袖",
    accent: "見返し・ベルト等",
  };
  const seen = new Set<string>();
  const out: { color: string; label: string }[] = [];
  for (const p of result.placed) {
    if (!seen.has(p.color)) {
      seen.add(p.color);
      out.push({ color: p.color, label: labels[p.color] ?? p.color });
    }
  }
  return out;
}

/** 製図台の目盛り定規（作業幅を 0〜上限の物差しとして示す）。 */
function Ruler({
  workingWidth,
  totalCm,
}: {
  workingWidth: number;
  totalCm: number;
}) {
  // 作業幅 = 生地幅/2。目盛りは作業幅方向（横）に 0 / 中間 / 端 を出す。
  const mid = Math.round(workingWidth / 2);
  return (
    <div
      className="ruler"
      role="img"
      aria-label={`製図台の物差し。作業幅 0 から ${workingWidth}cm。必要長さ 約 ${totalCm}cm。`}
    >
      <span className="r0">0</span>
      <span style={{ left: "50%" }}>{mid}</span>
      <span className="rend">{workingWidth}cm</span>
    </div>
  );
}

/** 裁断レイアウト概算図（わ裁ち・作業幅 = 生地幅/2 にパーツを配置）。 */
function LayoutFigure({ result }: { result: CalcResult }) {
  const W = result.workingWidth;
  const H = Math.max(result.totalCm, result.rawCm);
  const padL = 8; // 「わ」表示の余白
  const padR = 22; // 寸法注記の余白
  const padB = 12; // 幅寸法の余白
  const vbW = padL + W + padR;
  const vbH = H + padB;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      role="img"
      aria-label={`生地幅${result.fabricWidth}cm・必要長さ約${result.totalCm}cmの裁断レイアウト概算。前後の身頃や袖などを二つ折りの生地に配置した図。`}
      style={{ maxHeight: "64vh" }}
    >
      {/* 生地（作業幅ぶん） */}
      <rect
        x={padL}
        y={0}
        width={W}
        height={H}
        style={{
          fill: "var(--fabric)",
          stroke: "var(--fabric-line)",
          strokeWidth: 0.5,
        }}
      />
      {/* わ（折り山）= 左端の破線 */}
      <line
        x1={padL}
        y1={0}
        x2={padL}
        y2={H}
        style={{
          stroke: "var(--accent)",
          strokeWidth: 0.6,
          strokeDasharray: "3 2",
        }}
      />
      <text
        x={padL - 1.5}
        y={H / 2}
        transform={`rotate(-90 ${padL - 1.5} ${H / 2})`}
        textAnchor="middle"
        style={{ fill: "var(--accent)", fontSize: 3.4, fontWeight: 700 }}
      >
        わ（折り山）
      </text>

      {/* パーツ */}
      {result.placed.map((p) => {
        const cvar = `var(${PIECE_VARS[p.color] ?? "--piece-front"})`;
        const cx = padL + p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const showLabel = p.w >= 12 && p.h >= 10;
        return (
          <g key={`${p.label}-${p.x}-${p.y}`}>
            <rect
              x={padL + p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx={1}
              style={{
                fill: cvar,
                fillOpacity: "var(--piece-fill-opacity)",
                stroke: cvar,
                strokeWidth: p.overflow ? 1 : 0.6,
                strokeDasharray: p.overflow ? "2 1.5" : "none",
              }}
            />
            {showLabel && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fill: "var(--text)", fontSize: 3.2 }}
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}

      {/* 右側: 必要長さの寸法線（生地の右辺に寄り添わせる） */}
      <g style={{ stroke: "var(--text-dim)", strokeWidth: 0.4 }}>
        <line x1={padL + W} y1={0} x2={padL + W + 6} y2={0} />
        <line x1={padL + W} y1={H} x2={padL + W + 6} y2={H} />
        <line x1={padL + W + 5} y1={0} x2={padL + W + 5} y2={H} />
        <line x1={padL + W + 3.5} y1={0} x2={padL + W + 6.5} y2={0} />
        <line x1={padL + W + 3.5} y1={H} x2={padL + W + 6.5} y2={H} />
      </g>
      <text
        x={padL + W + padR - 4}
        y={H / 2}
        transform={`rotate(-90 ${padL + W + padR - 4} ${H / 2})`}
        textAnchor="middle"
        style={{ fill: "var(--text-dim)", fontSize: 3.6, fontWeight: 700 }}
      >
        {`必要長さ 約 ${result.totalCm}cm（${result.totalM.toFixed(1)}m）`}
      </text>

      {/* 下側: 作業幅 */}
      <text
        x={padL + W / 2}
        y={H + padB - 3}
        textAnchor="middle"
        style={{ fill: "var(--text-dim)", fontSize: 3.4 }}
      >
        {`作業幅 ${W}cm（生地幅 ${result.fabricWidth}cm を二つ折り）`}
      </text>
    </svg>
  );
}
