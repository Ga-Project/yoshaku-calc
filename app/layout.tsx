import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme.css";

const TITLE = "用尺カルク｜衣服別の必要生地量（用尺）計算ツール";
const DESC =
  "シャツ・スカート・ワンピース・パンツ・ジャケットなど、衣服の種類と生地幅・サイズを選ぶだけで、必要な生地の長さ（用尺）と裁断レイアウトの目安をすぐに計算します。生地を買う前の確認に。";

// SEO/OGP。metadataBase は公開 URL が決まったら設定する（OGP 画像の絶対 URL 解決に使う）。
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: {
    title: TITLE,
    description: DESC,
    type: "website",
    locale: "ja_JP",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* analytics: GoatCounter（cookieless・公開タグは秘密ではない公開コード） */}
        <script
          data-goatcounter="https://yoshaku-calc.goatcounter.com/count"
          async
          src="//gc.zgo.at/count.js"
        />
        {children}
      </body>
    </html>
  );
}
