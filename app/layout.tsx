import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme.css";
import JsonLd from "./JsonLd";
import { SITE_URL } from "./site";
import { socialMeta } from "./og";

const TITLE = "用尺カルク｜衣服別の必要生地量（用尺）計算ツール";
const DESC =
  "シャツ・スカート・ワンピース・パンツ・ジャケットなど、衣服の種類と生地幅・サイズを選ぶだけで、必要な生地の長さ（用尺）と裁断レイアウトの目安をすぐに計算します。生地を買う前の確認に。";

// SEO/OGP。metadataBase は OGP 画像の絶対 URL 解決と canonical の基準になる。
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/" },
  ...socialMeta({ title: TITLE, description: DESC, url: SITE_URL, type: "website" }),
};

// 構造化データ（サイト全体で真であるものだけ）。
// ページ固有のもの（トップの FAQPage、早見表のパンくず等）は各ページ側で出す。
// ルートレイアウトに置くと、その内容を表示していないページにも出てしまうため。
const SITE_JSON_LD = {
  "@type": "WebApplication",
  name: "用尺カルク",
  url: SITE_URL,
  description: DESC,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  inLanguage: "ja",
  offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <JsonLd nodes={[SITE_JSON_LD]} />
        {/* analytics: GoatCounter（cookieless・公開タグは秘密ではない公開コード） */}
        <script
          data-goatcounter="https://ga-project.goatcounter.com/count"
          async
          src="//gc.zgo.at/count.js"
        />
        {children}
      </body>
    </html>
  );
}
