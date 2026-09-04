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
    // Third-party, minified, and not ours to style. See vendor/gsap/README.md.
    "vendor/**",
    // Generated HyperFrames projects and everything else the app writes.
    "data/**",
    // Agent skills restored from skills-lock.json, not project source.
    ".agents/**",
  ]),
]);

export default eslintConfig;
