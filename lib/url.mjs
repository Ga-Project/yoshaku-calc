// 公開 URL の組み立て（canonical / og:url / sitemap / robots の共通部品）。
//
// 文字列連結で作ると、PAGES_BASE_PATH の書き方（"/x" と "/x/" と "x"）や
// パスの先頭スラッシュの有無で「//」や「/」欠けが起き、canonical が配信先と
// ずれる。ここに集めて、書き方の揺れを吸収する。

/**
 * basePath を "/a/b" の形（先頭にスラッシュ・末尾なし）か空文字に正規化する。
 * 空・空白・"/" だけは空文字（＝ルート配信）。
 * @param {string | undefined} raw
 */
export function normalizeBasePath(raw) {
  const segments = String(raw ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.length ? `/${segments.join("/")}` : "";
}

/**
 * 公開サイトのルート URL（末尾スラッシュ付き）。
 * @param {string} origin 例 "https://example.github.io"（末尾スラッシュは無視）
 * @param {string | undefined} basePath
 */
export function siteRoot(origin, basePath) {
  return `${origin.replace(/\/+$/, "")}${normalizeBasePath(basePath)}/`;
}

/**
 * ルート URL にサイト内パスをつなぐ。パスの先頭スラッシュの有無は問わない。
 * @param {string} root 末尾スラッシュ付きでも無しでもよい
 * @param {string} path 例 "yardage/shirt/" または "/yardage/shirt/"
 */
export function joinUrl(root, path) {
  return `${root.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
