import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Without this, flat config only lints .js/.mjs/.cjs and skips every .jsx file.
  { files: ["**/*.{js,jsx,mjs,cjs}"] },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Photos are on-device blob URLs; next/image can't optimize those in a static export.
      "@next/next/no-img-element": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "android/**",
      "ios/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
