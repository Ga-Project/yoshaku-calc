// yoshaku-calc — 404 ページ（web テンプレ）。
// Next 既定の英語・無スタイル 404 ではなく、共通デザイン基盤を当てた日本語の 404。
// static export（output: "export"）では out/404.html に書き出され、GitHub Pages の 404 になる。
// page.tsx と同じランドマーク（header / main / footer）・h1 は1つ・skip-link を持つ。

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ページが見つかりません — yoshaku-calc",
  // 404 は検索インデックス対象外にする（誤ってインデックスされないように）。
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>

      <header className="app-header">
        <div className="container">
          <a
            href="/"
            className="app-title"
            style={{ textDecoration: "none", color: "var(--text)" }}
          >
            用<span className="mark">尺</span>カルク
          </a>
          <span className="app-tagline">
            衣服別・必要生地量（用尺）と裁断レイアウトの早見ツール
          </span>
        </div>
      </header>

      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        <div className="container container-narrow app-main">
          <div className="card">
            <div className="empty-state">
              <span className="card-icon" aria-hidden="true">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6l9-3 9 3-9 3-9-3z" />
                  <path d="M3 6v12l9 3 9-3V6" />
                  <path d="M12 9v12" />
                </svg>
              </span>
              <p className="badge">404</p>
              <h1>ページが見つかりません</h1>
              <p>
                お探しのページは見つかりませんでした。移動・削除されたか、URL
                が誤っている可能性があります。
              </p>
              <div className="hero-actions" style={{ justifyContent: "center" }}>
                <a className="btn btn-primary" href="/">
                  計算ツールへ戻る
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>用尺カルク</p>
        </div>
      </footer>
    </>
  );
}
