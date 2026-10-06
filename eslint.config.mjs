import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...fixupConfigRules([...nextVitals, ...nextTs]),
  {
    files: ["src/ui/**/*.{ts,tsx}", "src/app/**/*.client.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/**", "@/adapters/**", "@/capabilities/**"],
              message: "UI code must call the server through an HTTP boundary.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/contracts/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/**", "@/server/**", "server-only", "node:*"],
              message: "Contracts must stay framework and server independent.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/domains/**", "@/adapters/**"],
              message: "Core services must not depend on concrete domains or adapters.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", ".next-e2e-*/**", "out/**", "build/**", "next-env.d.ts"]),
]);
