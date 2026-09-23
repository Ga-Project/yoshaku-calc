// OGP 画像の唯一の出どころ。
//
// Next の Metadata は layout と page を「openGraph 単位」で置き換える。page 側で
// openGraph を書いた瞬間に layout の images ごと落ちるため、ページを足すたびに
// 画像の指定を書き写すことになる。その書き写しを 1 箇所に閉じ込める。
//
// url は metadataBase（= SITE_URL）起点の相対で書く。GitHub Pages の
// プロジェクトページ配信では basePath がパスに乗るので、絶対パス（/og.png）に
// すると basePath を跨いで 404 になる。
export const OG_IMAGE = {
  url: "og.png",
  width: 1200,
  height: 630,
  alt: "用尺カルク — 衣服別の必要生地量と裁断レイアウトが分かる計算ツール",
};
