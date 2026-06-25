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
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>

      <header className="app-header">
        <div className="container">
          <span className="app-title">
            用<span className="mark">尺</span>カルク
          </span>
          <span className="app-tagline">
            衣服別・必要生地量（用尺）と裁断レイアウトの早見ツール
          </span>
        </div>
      </header>

      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        <div className="container app-main">
          <h1 className="sr-only">
            用尺カルク — 衣服別 必要生地量（用尺）計算ツール
          </h1>

          <div className="calc-grid">
            {/* 入力 */}
            <section className="input-col" aria-label="入力">
              <div className="panel">
                <p className="panel-title" id="garment-label">
                  作りたいもの
                </p>
                <div
                  className="seg"
                  role="group"
                  aria-labelledby="garment-label"
                >
                  {GARMENTS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className="seg-item"
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
                <p className="seg-blurb">{garment.blurb}</p>
              </div>

              <div className="panel">
                <p className="panel-title" id="width-label">
                  生地幅
                </p>
                <div
                  className="seg width-seg"
                  role="group"
                  aria-labelledby="width-label"
                >
                  {FABRIC_WIDTHS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      className="seg-item"
                      aria-pressed={w === width}
                      onClick={() => {
                        setWidth(w);
                        setCopied(false);
                      }}
                    >
                      <span>{w}cm</span>
                      <span className="seg-sub">
                        {w === 90
                          ? "シングル幅"
                          : w === 110
                            ? "標準幅"
                            : "ダブル幅"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel">
                <p className="panel-title">サイズ（cm）</p>
                <div className="fields">
                  {garment.inputs.map((input) => {
                    const raw = values[input.key] ?? String(input.def);
                    const invalid = isFieldInvalid(raw, input.min, input.max);
                    const fieldId = `f-${garmentId}-${input.key}`;
                    return (
                      <div className="field" key={input.key}>
                        <label htmlFor={fieldId}>
                          {input.label}{" "}
                          <span className="unit">（{input.unit}）</span>
                        </label>
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
                          onChange={(e) =>
                            updateField(input.key, e.target.value)
                          }
                        />
                        <span
                          className={invalid ? "field-error" : "hint"}
                          id={`${fieldId}-hint`}
                        >
                          {invalid
                            ? `${input.min}〜${input.max} の範囲で入力してください`
                            : (input.hint ?? `${input.min}〜${input.max}cm`)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 結果 */}
            <section className="result-col" aria-label="計算結果">
              <div className="panel">
                <p className="panel-title">必要な生地の目安</p>
                <p className="result-figure" role="status" aria-live="polite">
                  <span className="result-num">{result.totalM.toFixed(1)}</span>
                  <span className="result-unit">
                    <span className="result-unit-m">m</span>（{result.totalCm}
                    cm）
                  </span>
                </p>
                <p className="result-sub">
                  生地幅 {result.fabricWidth}cm・10cm 単位で購入する目安。
                </p>
                {result.widthShortage && (
                  <p className="result-badge">
                    <span className="badge badge-warn">
                      生地幅が不足する可能性
                    </span>
                  </p>
                )}

                <div className="layout-figure">
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
                    この計算を共有
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => window.print()}
                  >
                    印刷・PDF保存
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
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>
            用尺カルク —
            入力したサイズはこのブラウザにのみ保存され、外部には送信されません。
          </p>
        </div>
      </footer>
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
      style={{ maxHeight: "68vh" }}
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
        {/* rect 右辺から寸法線への引出線（上・下） */}
        <line x1={padL + W} y1={0} x2={padL + W + 6} y2={0} />
        <line x1={padL + W} y1={H} x2={padL + W + 6} y2={H} />
        {/* 寸法線本体（端の矢じり代わりの短いティック付き） */}
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
