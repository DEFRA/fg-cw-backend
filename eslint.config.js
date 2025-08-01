import eslintConfigPrettier from "eslint-config-prettier/flat";
import neostandard from "neostandard";

export default [
  ...neostandard({
    env: ["node"],
  }),
  eslintConfigPrettier,
  {
    files: ["src/**/*", "test/**/*"],
    rules: {
      "func-style": ["error", "expression"],
      "no-console": "error",
      complexity: ["error", { max: 4 }],
      "import-x/extensions": ["error", { js: "always", json: "always" }],
      "import-x/no-unresolved": "error",
      "import-x/named": "error",
      "import-x/default": "error",
      "import-x/export": "error",
      "import-x/no-default-export": "error",
      "import-x/no-mutable-exports": "error",
      "import-x/no-duplicates": "error",
      "import-x/no-useless-path-segments": "error",
      "import-x/no-cycle": "error",
      "import-x/no-extraneous-dependencies": [
        "error",
        { devDependencies: ["src/**/*.test.js", "test/**"] },
      ],
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "**/models/**/!(*.test).js",
              from: [
                "**/routes/**",
                "**/subscribers/**",
                "**/use-cases/**",
                "**/repositories/**",
              ],
              message:
                "Models should not import routes, subscribers, use cases or repositories",
            },
            {
              target: "**/repositories/**/!(*.test).js",
              from: ["**/routes/**", "**/subscribers/**", "**/use-cases/**"],
              message:
                "Respositories should not import routes, subscribers, use cases or models",
            },
            {
              target: "**/routes/**/!(*.test).js",
              from: ["src/**/**"],
              except: ["**/use-cases/**", "**/schemas/**"],
              message: "Routes should only import use cases and schemas",
            },
            {
              target: "**/subscribers/**/!(*.test).js",
              from: ["src/**/**"],
              except: ["**/common/**", "**/use-cases/**", "**/schemas/**"],
              message:
                "Subscribers should only import common, use cases and schemas",
            },
            {
              target: "**/use-cases/**/!(*.test).js",
              from: ["src/**/**"],
              except: [
                "**/common/**",
                "**/repositories/**",
                "**/models/**",
                "**/publishers/**",
                "**/use-cases/**",
              ],
              message:
                "Use cases should only import common, repositories, models, publishers and other use cases",
            },
            {
              target: "**/publishers/**/!(*.test).js",
              from: ["src/**/**"],
              except: ["**/common/**", "**/events/**"],
              message: "Publishers should only import common and events",
            },
          ],
        },
      ],
    },
  },
];
