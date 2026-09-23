// OGP（SNS に貼ったときのカード）の指定を 1 箇所に集める。
//
// Next の Metadata は openGraph を layout と page で deep-merge せず、page 側で
// openGraph を書いた時点で layout のものを丸ごと置き換える。素直に書くと
// type / locale / siteName / images / twitter 4 行をページごとに写経することに
// なるので、socialMeta() にまとめて呼び出し側は差分だけ渡す形にする。
//
// 画像の url は metadataBase（= SITE_URL・basePath を含む）起点の相対で書く。
// なお "/og.png" と絶対パスで書いても Next は metadataBase の pathname と
// 結合するため、出力される絶対 URL は同じになる（実測済み）。相対で書くのは
// basePath への依存を 1 箇所（SITE_URL）に閉じておくためで、絶対パスが壊れる
// からではない。配信される実値は scripts/verify-og.mjs が out/ で検査する。
import type { Metadata } from "next";

export const OG_IMAGE = {
  url: "og.png",
  width: 1200,
  height: 630,
  alt: "用尺カルク — 衣服別の必要生地量と裁断レイアウトが分かる計算ツール",
};

type SocialInput = {
  title: string;
  description: string;
  /** 絶対 URL（SITE_URL 起点で組み立てたもの）。 */
  url: string;
  type: "website" | "article";
};

/** openGraph と twitter を、画像つきで一組にして返す。 */
export function socialMeta({ title, description, url, type }: SocialInput): Metadata {
  return {
    openGraph: {
      title,
      description,
      type,
      locale: "ja_JP",
      url,
      siteName: "用尺カルク",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // object で渡すと twitter:image:alt も出る。
      images: [OG_IMAGE],
    },
  };
}
