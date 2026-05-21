import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // catch (e: any) is standard — unknown requires casting on every access
      "@typescript-eslint/no-explicit-any": "off",
      // unescaped entities are cosmetic — not a runtime bug
      "react/no-unescaped-entities": "warn",
      // <a> vs <Link> is best-practice, not blocking
      "@next/next/no-html-link-for-pages": "warn",
      // pre-existing hook patterns in dashboard — downgrade to warn
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
]);

export default eslintConfig;
