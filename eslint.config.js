import eslintConfigPrettier from "eslint-config-prettier/flat";
import neostandard from "neostandard";

const sourcePath = (suffix) => `${import.meta.dirname}/src/**/${suffix}`;

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
              from: [sourcePath("**")],
              except: [
                sourcePath("use-cases/**"),
                sourcePath("schemas/**"),
                sourcePath("common/**"),
              ],
              message: "Routes should only import use cases and schemas",
            },
            {
              target: "**/subscribers/**/!(*.test).js",
              from: [sourcePath("**")],
              except: [
                sourcePath("common/**"),
                sourcePath("use-cases/**"),
                sourcePath("schemas/**"),
                sourcePath("repositories/**"),
              ],
              message:
                "Subscribers should only import common, repositories, use cases and schemas",
            },
            {
              target: "**/use-cases/**/!(*.test).js",
              from: [sourcePath("**")],
              except: [
                sourcePath("common/**"),
                sourcePath("repositories/**"),
                sourcePath("models/**"),
                sourcePath("publishers/**"),
                sourcePath("use-cases/**"),
                sourcePath("events/**"),
              ],
              message:
                "Use cases should only import common, events, repositories, models, publishers and other use cases",
            },
            {
              target: "**/publishers/**/!(*.test).js",
              from: [sourcePath("**")],
              except: [sourcePath("common/**"), sourcePath("events/**")],
              message: "Publishers should only import common and events",
            },
          ],
        },
      ],
    },
  },
];
