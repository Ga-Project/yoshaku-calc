# 用尺カルク

衣服の種類・生地幅・サイズを選ぶと、必要な生地の長さ（用尺）と裁断レイアウトの目安をすぐに表示するブラウザツール。
インストール不要・登録不要で、入力したサイズは利用者のブラウザにのみ保存される（外部送信なし）。

対象: シャツ／ブラウス・ワンピース・スカート・パンツ・ジャケット。生地幅 90 / 110 / 140cm。

## 計算の考え方

- 生地は中表に二つ折り（わ裁ち）する前提で、実作業幅 = 生地幅 ÷ 2 とみなす。
- 衣服種別ごとに裁断する型紙パーツ（前身頃・後身頃・袖・ベルト等）を寸法つきで定義し、
  作業幅へ詰めて積み上がった長さを用尺とする（生地幅が広いほど用尺は短くなる）。
- 地直し・裁ち代の余裕を足し、購入単位の 10cm に切り上げる。
- あくまで概算。柄合わせ・地の目・縮み・デザインで増減する。

計算ロジックは `lib/calc.mjs`（依存なしの純関数）にまとまっており、`test/calc.test.mjs` で検証している。

## セットアップ & 開発

```bash
./setup.sh                 # pnpm install
pnpm dev                   # http://localhost:3000（ホットリロード）
```

## ビルド

```bash
pnpm build                 # next build → out/ に書き出し
./run.sh serve             # out/ をビルドしてローカル配信（http://localhost:3000）
```

`out/` がそのまま配信物。

## テスト

```bash
pnpm test                  # node --test（標準ランナー・追加の依存なし）
```

## デプロイ

GitHub Pages（GitHub Actions で自動デプロイ）。`main` への push で `scripts/public-gate.sh`（公開前ゲート）→
`pnpm build` → `out/` の公開を `.github/workflows/pages.yml` が直列に実行する。ゲート不合格ならデプロイされない。

プロジェクトページ（`<owner>.github.io/yoshaku-calc/` のようなサブパス配信）の場合のみ、
`next.config.mjs` に `basePath: "/yoshaku-calc"` / `assetPrefix: "/yoshaku-calc/"` を足す。

## 構成

```
yoshaku-calc/
├─ app/
│  ├─ page.tsx          # 計算ツール本体（種別・幅・サイズ → 用尺＋裁断レイアウト図）
│  ├─ layout.tsx        # SEO/OGP メタ・アナリティクススロット
│  ├─ globals.css       # 共通デザイン基盤（CSS変数トークン・light/dark・a11y）
│  └─ theme.css         # 製品テーマ（アクセント色・フォーム/結果/レイアウト図のスタイル）
├─ lib/calc.mjs         # 用尺の計算エンジン（純関数・テスト対象）
├─ test/calc.test.mjs   # 計算エンジンのテスト
├─ next.config.mjs      # output: "export"
└─ scripts/public-gate.sh  # 公開前ゲート
```

## アナリティクス（公開直前に有効化）

`app/layout.tsx` に cookieless のアナリティクススロットをコメントで用意してある。
公開直前に GoatCounter か Cloudflare Web Analytics のどちらか 1 つを有効化する。
