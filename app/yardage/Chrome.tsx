// 早見表ページ共通の外枠（銘板ヘッダー・パンくず・フッター）。
// トップの製図台と同じ「藍と紙」の顔を保ちつつ、こちらは読み物としての
// 静かな組版にする（製図台の主役＝裁断図はトップに置いたまま）。

import Link from "next/link";
import type { ReactNode } from "react";

export function Plate() {
  return (
    <header className="plate">
      <div className="plate-brand">
        <span className="plate-mark" aria-hidden="true">
          尺
        </span>
        <span>
          <Link className="plate-word plate-home" href="/">
            用<span className="mark">尺</span>カルク
          </Link>
          <span className="plate-sub">衣服別 必要生地量・裁断レイアウト早見</span>
        </span>
      </div>
      <span className="plate-stamp" aria-hidden="true">
        YARDAGE&nbsp;TABLE
      </span>
    </header>
  );
}

/** パンくず（現在地は link にせず aria-current を付ける）。 */
export function Crumbs({ trail }: { trail: { href?: string; label: string }[] }) {
  return (
    <nav className="crumbs" aria-label="現在地">
      <ol>
        {trail.map((c) => (
          <li key={c.label}>
            {c.href ? (
              <Link href={c.href}>{c.label}</Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Sheet({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>
      <div className="sheet sheet-paper">{children}</div>
    </>
  );
}

export function Footer() {
  return (
    <footer className="sheet-footer">
      用尺カルク — 表の数値は計算機と同じ計算式から作っています。実際の型紙・柄合わせで増減します。
    </footer>
  );
}
