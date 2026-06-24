# DISTILL — Wave decisions: FGP-1221 (backend)

## DWD-01 — Retrospective DISTILL

This DISTILL was run **after** implementation, to capture an already-shipped prototype as
first-class acceptance specs. Consequences:

- **Mandate 7 (RED scaffolding) does not apply.** The production code exists and the tests
  are GREEN. There are no scaffolds to create; the lifecycle is Spec → (already) GREEN.
- Scenarios are reverse-derived from the implementation, then re-expressed in business
  language and Given-When-Then to keep them behaviour-focused rather than implementation-coupled.

## DWD-02 — No upstream SSOT / prior-wave artifacts

`docs/product/` (SSOT) and `docs/feature/FGP-1221/{discuss,design,devops}/` do not exist —
this repository predates the nWave SSOT model. Graceful degradation applied: acceptance
criteria derived from the implemented code; driving ports identified directly from the Hapi
routes; no traceability to user stories (none exist). Zero contradictions to reconcile.

## DWD-03 — Walking Skeleton strategy: **Strategy C (real I/O), matching the repo's two-tier convention**

> Correction: an earlier draft of this decision claimed the repo convention was "mocked Mongo
> only" and chose to skip testcontainers. That was wrong. The repo runs **two tiers** —
> `test:unit` (`--dir src`, Mongo mocked, asserts pipeline shape) **and** `test:integration`
> (`--dir test`, `test/setup.js` brings up a real Dockerised Mongo via testcontainers, with a
> `test/cases/<endpoint>.test.js` per endpoint). The correct decision is to honour **both**.

Decision: follow the established two-tier convention.

- **Unit tier** — `repositories/case.repository.test.js` asserts the aggregation pipeline shape
  with Mongo mocked (fast change-detector); `report-cases.use-case.test.js` covers orchestration
  with the repository mocked; `report-cases.route.test.js` exercises the real Hapi route via
  `inject` (driving-adapter mandate: status, query handling, page envelope).
- **Integration tier (`@real-io @adapter-integration`)** — `test/cases/report-cases.test.js`
  seeds cases across positions in a **real Mongo** (testcontainers), calls `GET /cases/report`,
  and asserts the real rolled-up counts. This is the end-to-end walking skeleton and the
  adapter-integration test in one, matching every sibling endpoint.

**Local-run caveat:** the integration test needs Docker and free testcontainers ports; it
collides with a running `fg-grants-core` dev stack on `:3011`. It executes in CI / with the dev
stack down. Authored against the verified `frps-private-beta` workflow fixture and `INFO` status
themes; not executed on the authoring machine due to that port clash.

## DWD-04 — Executable binding is vitest, not Cucumber

No Cucumber/Gherkin runner exists here. `acceptance.feature` is the canonical human-readable
spec; the executable acceptance tests are the named vitest tests it references. The two are
kept in step by the `Tested by:` annotations.
