import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme.css";
import { FAQ } from "./Guide";
import { SITE_URL } from "./site";

const TITLE = "用尺カルク｜衣服別の必要生地量（用尺）計算ツール";
const DESC =
  "シャツ・スカート・ワンピース・パンツ・ジャケットなど、衣服の種類と生地幅・サイズを選ぶだけで、必要な生地の長さ（用尺）と裁断レイアウトの目安をすぐに計算します。生地を買う前の確認に。";

// SEO/OGP。metadataBase は OGP 画像の絶対 URL 解決と canonical の基準になる。
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESC,
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: "用尺カルク",
  },
  twitter: { card: "summary", title: TITLE, description: DESC },
};

// 構造化データ。ツール本体（WebApplication）と、ページ内の FAQ を検索エンジンに伝える。
// FAQ は Guide.tsx の表示内容と同じ配列から生成し、表示と構造化データが食い違わないようにする。
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "用尺カルク",
      url: SITE_URL,
      description: DESC,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      inLanguage: "ja",
      offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <script
          type="application/ld+json"
          // `<` をエスケープして、FAQ 本文に将来 `</script>` 相当が混ざっても
          // script 要素が途中で閉じられないようにする。
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c"),
          }}
        />
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
