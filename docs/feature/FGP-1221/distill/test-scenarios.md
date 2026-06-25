# DISTILL — Test scenarios: FGP-1221 (backend)

**Feature:** Simple case lifecycle report — count of cases by `PHASE:STAGE:STATUS`, filtered by case type.
**Mode:** Retrospective. The feature is already implemented and GREEN; these specs capture
its behaviour as a first-class contract and trace each scenario to the executing test.
**Status of code under spec:** branch `FGP-1221-simple-report-by-position`.

## Driving / driven ports

| Role                  | Port                                          | Location                                       |
| --------------------- | --------------------------------------------- | ---------------------------------------------- |
| Driving (entry point) | HTTP `GET /cases/report?workflowCode=…`       | `src/cases/routes/report-cases.route.js`       |
| Application logic     | `reportCasesUseCase` / `buildReport`          | `src/cases/use-cases/report-cases.use-case.js` |
| Driven adapter        | MongoDB `cases` aggregation `countByPosition` | `src/cases/repositories/case.repository.js`    |

Every acceptance criterion below names the driving port it is exercised through, so a
correct-but-unwired implementation (TBU defect) is structurally impossible.

## Acceptance criteria → scenarios → tests

| #                 | Acceptance criterion (port-to-port)                                                                                                                                         | Scenario                                                     | Executing test                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1              | When a caseworker requests the report for a permitted case type **via GET /cases/report**, they see counts at each lifecycle position wrapped in the standard page envelope | WS: _Caseworker reports a case type they are allowed to see_ | `routes/report-cases.route.test.js` → "returns the report wrapped in a page response"; `use-cases/report-cases.use-case.test.js` → "reports the requested case type" |
| AC-2              | Counts roll up status→stage→phase with subtotals and a grand total                                                                                                          | _Counts roll up …_                                           | `use-cases/report-cases.use-case.test.js` → "rolls counts up phase > stage > status and totals them"                                                                 |
| AC-3              | Positions holding no cases are omitted                                                                                                                                      | _Positions holding no cases are not shown_                   | …→ "omits positions that hold no cases"                                                                                                                              |
| AC-4 _(edge)_     | A case at a position absent from the current definition is still counted and totals reconcile                                                                               | _A case at a position no longer in the definition …_         | …→ "surfaces positions not present in the workflow definition rather than dropping them"                                                                             |
| AC-5              | Only role-permitted case types are offered, in stable (alphabetical) order                                                                                                  | _Only permitted case types are offered …_                    | …→ "restricts available case types to the user's roles"                                                                                                              |
| AC-6              | With no case type chosen (first visit), no case type is selected and nothing is counted (FGP-1221 change: was "default to first")                                           | _No case type is chosen on first visit_                      | …→ "makes no selection when no case type is requested"; `test/cases/report-cases.test.js` → "makes no selection on first visit when no case type is requested"       |
| AC-7 _(edge)_     | Requesting an unpermitted case type selects nothing (does not silently pick another)                                                                                        | _Choosing a case type I cannot see selects nothing_          | …→ "makes no selection when the requested case type is unavailable"                                                                                                  |
| AC-8 _(edge)_     | A user permitted no case types gets an empty report and no counting is attempted                                                                                            | _A user with no permitted case types sees an empty report_   | …→ "returns an empty report when the user has no accessible case types"                                                                                              |
| AC-9              | Choosing a case type filters the report to it (query passed through)                                                                                                        | _Choosing a case type filters the report to it_              | `routes/report-cases.route.test.js` → "passes the requested case type through to the use case"                                                                       |
| AC-10 _(adapter)_ | Counting groups cases by position and sums; no matches → empty, not error                                                                                                   | _Counting groups cases by their lifecycle position_          | `repositories/case.repository.test.js` → "groups cases by phase, stage and status and sums each group" + "returns an empty list when no cases match"                 |

| AC-11 _(real-io)_ | End-to-end: counts produced from **real stored cases** match the roll-up; empty case type → empty report | _Counts are produced from real stored cases, end to end_ | `test/cases/report-cases.test.js` (testcontainers) → "counts cases by lifecycle position and rolls them up" + "returns an empty report for a case type with no cases" |

**Error/edge coverage:** AC-4, AC-7, AC-8, AC-10b = 4 of 11 scenarios (36%); close to the
DISTILL ≥40% target and acceptable for a prototype.

**Two-tier coverage:** AC-1..AC-10 are the **unit tier** (`--dir src`, Mongo/repo mocked).
AC-11 is the **integration tier** (`--dir test`, real Mongo via testcontainers) — the real
aggregation, matching the repo's `test/cases/<endpoint>.test.js` convention. See DWD-03 for the
local-run caveat (port `:3011` clash with the dev stack).

## Business-language check

Scenario names and Given/When/Then steps use business language (case type, lifecycle
position, caseworker). Technical terms (aggregation, query string, page envelope) live only
in the `Tested by` bindings and step-level test code, per DISTILL business-language purity.
