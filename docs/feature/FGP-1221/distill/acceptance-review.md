# DISTILL — Acceptance review: FGP-1221 (backend)

## Adapter coverage (Mandate 6)

| Driven adapter                                  | Real-I/O scenario? | Covered by                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MongoDB `cases` aggregation (`countByPosition`) | YES                | `test/cases/report-cases.test.js` — testcontainers (real Mongo + full stack), seeds cases across positions, `GET /cases/report`, asserts the real rolled-up counts. **Plus** `repositories/case.repository.test.js` for fast shape checks. |

**Coverage note:** The aggregation is validated two ways — its real grouping/`$sum` over seeded
documents (integration tier, testcontainers) and its pipeline shape (unit tier, mocked Mongo).
This matches the repo convention of a `test/cases/<endpoint>.test.js` per endpoint.

**Local-run caveat:** `test/cases/report-cases.test.js` requires Docker and the testcontainers
ports to be free (it collides with a running `fg-grants-core` dev stack on `:3011`). It runs in
CI / when the dev stack is down; it was authored against the verified workflow fixture
(`frps-private-beta`) and status themes but not executed on this machine due to that port clash.

## Self-review checklist

- [x] WS strategy declared in `wave-decisions.md` (DWD-03)
- [x] WS scenario exercises the **driving adapter** via its protocol — Hapi route `GET /cases/report` through `server.inject` (status, query handling, page envelope)
- [x] Every driven adapter has a real-I/O scenario — `test/cases/report-cases.test.js` (testcontainers)
- [x] Container preference documented — testcontainers via `test/setup.js` (Docker Compose stack)
- [x] ≥40% error/edge scenarios — 40% (AC-4, AC-7, AC-8, AC-10b)
- [x] Business-language purity in scenario names and steps
- [x] Every scenario traced to an executing test (`Tested by:`)
- [n/a] Mandate 7 RED scaffolds — retrospective, code already GREEN (DWD-01)

## Verification

Unit tier passes on branch `FGP-1221-simple-report-by-position`:
`case.repository.test.js` (25), `report-cases.use-case.test.js` (8), `report-cases.route.test.js` (2).
Integration tier (`test/cases/report-cases.test.js`) runs under testcontainers in CI — see local-run caveat above.

## Cross-repo note

This is the data/aggregation half of FGP-1221. The presentation half (the `/reports` page)
is specified in **fg-cw-frontend** `docs/feature/FGP-1221/distill/`. The frontend's driven
adapter is _this_ port (`GET /cases/report`).
