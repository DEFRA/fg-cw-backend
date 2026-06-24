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

## DWD-03 — Walking Skeleton strategy: **mocked port boundary (repo convention)**

The feature's only driven adapter is MongoDB. The DISTILL decision tree would suggest
Strategy C / real-I/O with a database (testcontainers). However, the established convention
in this repository is **port-boundary unit tests with the Mongo client mocked**
(`vi.mock("../../common/mongo-client.js")`) and routes exercised via `hapi.server().inject(...)`.

Decision: **follow the repo convention**, not introduce testcontainers for a deliberately
simple prototype. The walking-skeleton scenario (_Caseworker reports a case type …_) is
exercised through the real Hapi route via `inject`, with the use-case mocked — verifying
wiring, status, query handling and the page envelope (the driving-adapter mandate).

**Known limitation (see acceptance-review.md):** the aggregation pipeline is asserted by
_shape_, not executed against a real MongoDB. If this prototype is hardened for production,
add one `@real-io @adapter-integration` scenario running `countByPosition` against a
testcontainer / in-memory Mongo to close the adapter-coverage gap.

## DWD-04 — Executable binding is vitest, not Cucumber

No Cucumber/Gherkin runner exists here. `acceptance.feature` is the canonical human-readable
spec; the executable acceptance tests are the named vitest tests it references. The two are
kept in step by the `Tested by:` annotations.
