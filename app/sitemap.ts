import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";
import { GUIDES } from "./yardage/presets";

// static export では out/sitemap.xml として書き出される。
// ルートを増やしたときの入れ忘れを避けるため、早見表は GUIDES から機械的に生成する。
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}yardage/`, changeFrequency: "monthly", priority: 0.8 },
    ...GUIDES.map((g) => ({
      url: `${SITE_URL}yardage/${g.slug}/`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
