// 公開 URL の単一の出どころ。
//
// OGP 画像の絶対 URL 解決（metadataBase）・canonical・sitemap / robots が
// すべて同じ URL を指すように、ここ一箇所で組み立てる。
// GitHub Pages のプロジェクトページ配信では basePath ぶんがパスに乗るため、
// ビルド時の PAGES_BASE_PATH（pages.yml が渡す）を末尾に連結する。

const ORIGIN = "https://ga-project.github.io";
const BASE_PATH = process.env.PAGES_BASE_PATH || "";

// 前提: out/ を公開配信するのは PAGES_BASE_PATH を渡す CI 経路だけ。
// env なしでビルドしたものを配信すると、canonical / sitemap が同一 origin に
// 同一 origin のルート URL を自称してしまう。

/** 公開サイトのルート URL（末尾スラッシュ付き。trailingSlash: true の出力に合わせる）。 */
export const SITE_URL = `${ORIGIN}${BASE_PATH}/`;
