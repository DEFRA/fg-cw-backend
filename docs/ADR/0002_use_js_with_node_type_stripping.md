# ADR-002: Use JavaScript with Node 22 Type Stripping for Static Types

## Date

2025-09-24 - When the decision was made

## Status

Accepted

## Context

The team strongly prefers typed languages as they reduce an entire class of bugs and improve code navigation, inspection, tooling assistance, and refactoring. Most mainstream application languages are strongly typed or provide optional typing.

Key external factors and constraints:

- Organisational policy: TypeScript transpilation is currently discouraged/forbidden within Rural Payments Authority (RPA) inside Defra, although it is used elsewhere in Defra. See TR-179.
- Permitted toolset: JavaScript and Node are permitted, with JSDoc as an option for typing.
- Ecosystem trend: According to the State of JS 2024 survey, the majority of JavaScript developers use TypeScript to some extent (only ~8% used no TS; ~67% wrote more TS than JS; ~34% wrote 100% TS).

- Node 22 supports type stripping: you can write real TypeScript syntax (types, interfaces, generics, annotations) directly in source, and Node removes the type information at load time, executing clean JavaScript. This enables advanced type system features (discriminated unions, satisfies, utility types, import type, proper generics) without a transpile step.
- JSDoc-based typing relies on comments interpreted by the TS language service in IDEs. It is more verbose, can drift out of date, and supports a narrower subset of type features. Sharing types across files requires string-based `import()` patterns that are harder to refactor. You must have inline comments to achieve types in the body of methods. It seems
  an abuse of comments to utilise them for typing when better options are available. JSDoc actually depends on TypeScript to work!
- Practically, Node’s type stripping closes much of the gap between “JavaScript with JSDoc” and “real TypeScript,” enabling modern, type-rich code without a build step. Teams can optionally use `tsc --noEmit` in CI for deeper static checking.

## Decision

We will use JavaScript with static types via Node 22’s built-in type stripping. Concretely:

- Source files may use TypeScript type syntax co-located with the code. No transpilation step is required; Node will strip types at load time.
- We will prefer this approach over JSDoc for new and refactored code where static typing adds value.
- Optionally, we may run `tsc --noEmit` in CI to perform deeper type checking without generating output.
- This approach complies with current RPA restrictions because no TypeScript compilation/emission is performed.

## Consequences

Positive:

- Richer, more expressive types (unions, generics, utility types, satisfies) directly in source code.
- Types live alongside logic, improving readability, refactoring safety, and IDE assistance.
- Zero runtime overhead and no build/transpile step required.
- Aligns with team preference for typed development while conforming to current RPA constraints.
- Future-proof path if organisational policies later allow full TypeScript—minimal migration needed.

Negative / Risks:

- Requires Node 22+ runtime environments; older Node versions will not support type stripping.
- Some advanced TS features that rely on emit-time transforms (e.g., experimental decorators that require emitted metadata) are out of scope.
- Tooling must be configured to recognise type syntax in the chosen file extensions; we may need to standardise on file extensions (.ts/.mts/.cts) and editor/linter settings.
- Optional `tsc --noEmit` adds a CI step that can fail builds; teams must maintain types accordingly.
- Files must have the .ts file extension giving the impression that they are TypeScript.

Mitigations:

- Document required Node version in engines and deployment pipelines.
- Provide eslint/IDE configuration and pre-commit checks to maintain consistency.
- Keep runtime code free of emit-dependent TS features.

## Alternatives Considered

1. JavaScript with JSDoc types

   - Pros: Works in plain .js; no new file types; aligns with permitted toolset.
   - Cons: Verbose comment-based annotations; weaker type expressiveness; higher drift risk; harder to share/refactor types.
   - Not chosen: Research shows significant limitations versus real type syntax, impacting maintainability and safety.

2. Full TypeScript with transpilation (tsc or SWC/ESBuild)

   - Pros: Strongest type checking; mature ecosystem; full compiler features.
   - Cons: Conflicts with current RPA policy; introduces build step and emitted artifacts.
   - Not chosen: Currently non-compliant and adds pipeline complexity.

3. Plain dynamic JavaScript (no types)
   - Pros: Simplest toolchain; no new constraints.
   - Cons: Higher defect risk; weaker IDE support and refactoring safety; poorer scalability for larger codebases.
   - Not chosen: Does not meet team quality and maintainability goals.

## References

- Research note: docs/research/js-typing.md
- State of JS 2024 survey: https://2024.stateofjs.com/en-US/usage/#js_ts_balance
- RPA policy reference (internal): https://eaflood.atlassian.net/jira/software/projects/TR/boards/630?selectedIssue=TR-179
- Background on Node type stripping (Node 22+ release notes/documentation)
