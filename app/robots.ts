import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";

// static export では out/robots.txt として書き出される。
// クロールを明示的に許可し、sitemap の在り処を検索エンジンに知らせる。
//
// 注意: プロジェクトページ配信では出力先が /<slug>/robots.txt になり、
// クローラが実際に読むのは origin 直下の /robots.txt だけなので、この
// ファイル経由での sitemap 自動発見は効かない。クロールは既定で許可の
// ため実害はないが、sitemap は Search Console から直接送信すること。
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}sitemap.xml`,
  };
}
