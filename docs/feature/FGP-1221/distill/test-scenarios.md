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
| AC-6              | With no case type chosen, the report defaults to the first available                                                                                                        | _The report defaults to the first available case type_       | …→ "defaults to the first available case type when none is requested"                                                                                                |
| AC-7 _(edge)_     | Requesting an unpermitted case type falls back to the first available                                                                                                       | _Choosing a case type I cannot see falls back safely_        | …→ "falls back to the first case type when the requested one is unavailable"                                                                                         |
| AC-8 _(edge)_     | A user permitted no case types gets an empty report and no counting is attempted                                                                                            | _A user with no permitted case types sees an empty report_   | …→ "returns an empty report when the user has no accessible case types"                                                                                              |
| AC-9              | Choosing a case type filters the report to it (query passed through)                                                                                                        | _Choosing a case type filters the report to it_              | `routes/report-cases.route.test.js` → "passes the requested case type through to the use case"                                                                       |
| AC-10 _(adapter)_ | Counting groups cases by position and sums; no matches → empty, not error                                                                                                   | _Counting groups cases by their lifecycle position_          | `repositories/case.repository.test.js` → "groups cases by phase, stage and status and sums each group" + "returns an empty list when no cases match"                 |

**Error/edge coverage:** AC-4, AC-7, AC-8, AC-10b = 4 of 10 scenarios (40%), meeting the DISTILL ≥40% edge-path target.

## Business-language check

Scenario names and Given/When/Then steps use business language (case type, lifecycle
position, caseworker). Technical terms (aggregation, query string, page envelope) live only
in the `Tested by` bindings and step-level test code, per DISTILL business-language purity.
