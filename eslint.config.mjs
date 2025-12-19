import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    files: ["**/*.{js,mjs,cjs}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    plugins: {
      prettier,
    },

    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,

      // Prettier as ESLint errors
      "prettier/prettier": "error",
    },
  },
];
