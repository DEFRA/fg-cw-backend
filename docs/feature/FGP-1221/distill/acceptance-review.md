# DISTILL — Acceptance review: FGP-1221 (backend)

## Adapter coverage (Mandate 6)

| Driven adapter                                  | Real-I/O scenario? | Covered by                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MongoDB `cases` aggregation (`countByPosition`) | NO — mocked        | `repositories/case.repository.test.js` asserts the pipeline **shape** and the mapping of grouped `_id` docs, with `db.collection` mocked. Pipeline is **not executed against real Mongo**. |

**Gap & rationale:** No `@real-io` adapter test. This is an accepted, documented deviation
(DWD-03) — the repo convention is mocked-Mongo unit tests, and this is a simple prototype.
**To close for production:** add one scenario running `countByPosition` against a real/in-memory
Mongo (testcontainers), asserting actual grouping over seeded documents.

## Self-review checklist

- [x] WS strategy declared in `wave-decisions.md` (DWD-03)
- [x] WS scenario exercises the **driving adapter** via its protocol — Hapi route `GET /cases/report` through `server.inject` (status, query handling, page envelope)
- [~] Every driven adapter has a real-I/O scenario — **NO**, documented gap above (mocked by repo convention)
- [x] For the mocked adapter: documented what it cannot model (real grouping/`$sum` over real documents)
- [x] Container preference documented — none, by convention
- [x] ≥40% error/edge scenarios — 40% (AC-4, AC-7, AC-8, AC-10b)
- [x] Business-language purity in scenario names and steps
- [x] Every scenario traced to an executing test (`Tested by:`)
- [n/a] Mandate 7 RED scaffolds — retrospective, code already GREEN (DWD-01)

## Verification

All referenced tests pass on branch `FGP-1221-simple-report-by-position`:
`case.repository.test.js` (25), `report-cases.use-case.test.js` (8), `report-cases.route.test.js` (2).

## Cross-repo note

This is the data/aggregation half of FGP-1221. The presentation half (the `/reports` page)
is specified in **fg-cw-frontend** `docs/feature/FGP-1221/distill/`. The frontend's driven
adapter is _this_ port (`GET /cases/report`).
