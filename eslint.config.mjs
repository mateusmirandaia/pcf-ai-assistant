import eslintjs from "@eslint/js";
import microsoftPowerApps from "@microsoft/eslint-plugin-power-apps";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import typescriptEslint from "typescript-eslint";

export default typescriptEslint.config(
    {
        ignores: ["**/generated/", "out/", "obj/", "bin/", "api/", "coverage/"],
    },
    eslintjs.configs.recommended,
    typescriptEslint.configs.recommendedTypeChecked,
    react.configs.flat.recommended,
    {
        files: ["AiReplyAssistant/**/*.{ts,tsx}"],
        plugins: {
            "@microsoft/power-apps": microsoftPowerApps,
            "react-hooks": reactHooks,
        },
        languageOptions: {
            globals: {
                ...globals.browser,
                ComponentFramework: "readonly",
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        settings: {
            react: { version: "16.14" },
        },
        rules: {
            ...microsoftPowerApps.configs.paCheckerHosted.rules,
            ...reactHooks.configs.recommended.rules,
            "react/prop-types": "off",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
    {
        files: ["AiReplyAssistant/__tests__/**"],
        languageOptions: {
            globals: globals.jest,
        },
        rules: {
            // Mocked fetch calls are inherently loosely typed; the assertions are what matter.
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/unbound-method": "off",
        },
    },
);
