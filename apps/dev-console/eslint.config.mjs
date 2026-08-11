import { baseConfig } from "@pulse/config/eslint.base.mjs";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
