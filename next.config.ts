import type { NextConfig } from "next";

/**
 * STATIC_EXPORT=1 のとき、GitHub Pages 向けに静的 HTML として書き出す。
 * - BASE_PATH は「/リポジトリ名」（例：/action-os）
 * - 静的書き出しでは API ルート（AIタスク分解）は使えないため、ワークフロー側で除外する。
 *   アプリは API が無い場合ルールベース分解に自動で切り替わる。
 */
const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH ?? "";

const shared: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const nextConfig: NextConfig = isStaticExport
  ? {
      ...shared,
      output: "export",
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
      env: { NEXT_PUBLIC_BASE_PATH: basePath },
    }
  : {
      ...shared,
      cacheComponents: true,
      partialPrefetching: true,
      env: { NEXT_PUBLIC_BASE_PATH: "" },
    };

export default nextConfig;
