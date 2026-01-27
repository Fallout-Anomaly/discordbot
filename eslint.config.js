const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.es2021
            }
        },
        rules: {
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "no-undef": "error",
            "no-console": "off",
            "no-empty": ["error", { "allowEmptyCatch": true }]
        }
    },
    {
        ignores: ["DoNotUpload/", "node_modules/", ".gemini/", "temp_casino/"]
    }
];
