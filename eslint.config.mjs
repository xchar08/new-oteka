// eslint-config-next v16 exports flat configs directly — do not wrap in FlatCompat.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "android/**",
      "planner-wasm/**",
      "supabase/functions/**",
      "tools/**",
      "src/lib/engine/planner/planner_wasm.js",
    ],
  },
];

export default eslintConfig;
