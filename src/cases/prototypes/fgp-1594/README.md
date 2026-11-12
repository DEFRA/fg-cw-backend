# FGP-1594: configurable dedupe spike — THROW AWAY

Source: [FGP-1594 — SPIKE: Configurable De-duplication List](https://eaflood.atlassian.net/browse/FGP-1594), read 12 November 2026.

**Question:** can a configured page derive duplicate groups and completion live,
while persisting only group assignment and generic case labels? What prevents
this becoming a reusable caseworking page type?

**Verdict:** feasible for exact keys on the synthetic dataset. Real Mongo grouping,
combined transactional saves and the proposed endpoint contract work. This does
not establish production readiness, performance at volume, or compatibility with
the real frontend. All code here is disposable and is not registered by the app.

## Run it

Open `demo.html` directly in a browser. No installation, server, login or database
is needed. It contains the same logic as the Mongo experiment. Walkthroughs cover
completion/reopening, historical references after exclusion, and invalid saves.
Use the editable config to change grouping or scope; reload to discard changes.

From the repository root, with Node 24 and `npm ci` dependencies installed:

```sh
# Explicit evaluator/save-validation checks required by the ticket
node --test src/cases/prototypes/fgp-1594/logic.check.js

# Real aggregation, transactions and Hapi-injected HTTP contract checks
node src/cases/prototypes/fgp-1594/probe.js

# Rebuild the shareable HTML after editing logic, seeds or configuration
node src/cases/prototypes/fgp-1594/build-demo.js
```

The Mongo command defaults to local `127.0.0.1:27017`, using the repository's
Mongo driver. Override with `SPIKE_MONGO_URI` for a **local scratch replica set**.
Transactions require a replica set, as supplied by the repository's Compose
configuration. The command creates its own randomly suffixed database named
`PROTOTYPE_fgp1594_wipe_me_<id>`, then removes only that database in `finally`.
An interrupted process may leave that explicitly disposable database behind.
It never opens the configured application database or starts an HTTP listener.

The checks use Node's test runner, so `logic.check.js` deliberately avoids the
production Vitest discovery convention. The demo is a behavioural shell, not
the final Nunjucks templates. Its case references are plain text; production
case links and Save-and-continue navigation belong to the frontend ticket.

## Design exercised

- `config.json` is the standalone configuration extracted from the proposed
  `page-type.configuration`, with case type and page identity alongside it.
- `logic.js` compiles a restricted expression grammar with named pure functions;
  no `eval` or arbitrary code. The spike permits only the declared stored case
  paths, exact scalar keys and the five functions in the issue. Unknown paths,
  functions and unsupported matching strategies fail before handling requests.
- Group identity is SHA-256 of a JSON tuple containing case type, page key and
  canonical typed key values. Sorted object keys and tuple encoding avoid
  delimiter ambiguity; strings and numbers remain distinct.
- `mongo.js` matches `workflowCode/currentPhase/currentStage`, groups and filters
  in Mongo, hashes in JS, and fetches owners in one batch. Details use the same
  grouping without the summary's minimum-active-count filter.
- `case_groups` stores identity, owner and timestamps/version. There is no stored
  membership, active count or derived status. It is created on first non-null
  assignment; clearing an existing owner retains the aggregate.
- A save validates the submission, then writes only changed labels and timeline
  entries alongside the owner inside a transaction. No case status is changed.
  Unchanged historical references remain valid. New cases need not be present
  in an older submitted form. Spike concurrency is last write wins.
- `api.js` exercises the three proposed GET/GET/PUT routes through Hapi injection.
  Its users are synthetic and errors simplified; it has no production auth or
  audit wiring. Never register these routes in the running application.

## Evidence from this run

On 12 November 2026, eight Node checks passed, changed-file ESLint passed, and
the real Mongo probe passed all six reported checkpoints:

| Experiment                                                                                                       | Observed result                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Three SBIs with two active cases each, plus rejected, singleton, foreign-scheme, out-of-scope and null-SBI cases | Exactly three visible groups; correct counts and deterministic oldest display                        |
| Group by SBI plus status; change stage through config                                                            | Composite grouping works; changing scope changes membership without logic edits                      |
| Save one label, then both labels, then repeat the save                                                           | Not started → In progress → Completed; repeat produces zero label writes and no extra timeline entry |
| Add a matching case after completion                                                                             | In progress again, with the same saved owner                                                         |
| Withdraw the referenced case                                                                                     | Existing label retained; target absent from new choices; excluded label writes rejected              |
| Exclude until only one active case remains                                                                       | Summary hides the group; detail still returns all its cases                                          |
| Inject failure after label writes but before owner write                                                         | Transaction rolls back labels, timelines and owner; no partial save                                  |
| Aggregation explain on tiny seed                                                                                 | Explain succeeds; this is not a scale benchmark                                                      |

The demo's generated JavaScript was checked for syntax and exercised with a
minimal DOM harness. No browser rendering/accessibility assessment was performed.
Production routes, workflow publication, existing case timeline rendering,
assignment eligibility and frontend integration are not demonstrated here.

## Problems found and decisions still needed

1. **The inspirational config does not match this repository.** Case type is
   stored as `workflowCode`; the FRPS fixture reads SBI from
   `payload.identifiers.sbi` and business name from
   `payload.answers.applicant.business.name`. Its review position is
   `PRE_AWARD:REVIEW_APPLICATION`; excluded statuses are `APPLICATION_REJECTED`
   and `APPLICATION_WITHDRAWN`. `WITHDRAWAL_REQUESTED` is a separate, still-active
   status under these rules. Confirm against the published grant config before
   implementation; fixtures are evidence, not the live source of truth.
2. **There is no case-list page-type configuration today.** Existing workflow
   schemas model `pages.cases.details`; the case list is a fixed `/cases` read.
   Add the new tab configuration to both publication and runtime validation,
   with an explicit policy for which workflow config version drives the list.
3. **Missing keys must not create false duplicate groups.** This spike omits
   missing/null/empty/non-scalar keys. Numeric and string SBIs are distinct.
   Decide whether to reject invalid ingestion, normalise values or flag data
   quality separately. Do not silently coerce them in the final grouping query.
4. **Counts in the ticket's example mix active and excluded cases.** The example
   counts all labels but only active unlabelled cases. This demo counts labels
   over active cases and reports exclusions separately so the hint reconciles.
   Product agreement is needed on this copy/count definition.
5. **Hidden does not mean inaccessible.** Applying the summary threshold to
   detail reads breaks a bookmarked page or a form open during withdrawal.
   Keep the detail readable while any scoped members remain. If cases move out
   of the configured phase/stage, they leave membership entirely, even if their
   status is excluded. Confirm whether historical context should span scopes.
6. **Historical labels need an explicit display option.** A select built only
   from current active targets otherwise silently resets an existing label.
   The demo adds a selected historical option and permits unchanged resubmission.
   Missing targets, references leaving scope and label cycles need product rules.
   Cycles are currently permitted because the issue does not prohibit them.
7. **A transaction is necessary even with last-write-wins.** Validation alone
   cannot keep several case labels, timeline entries and owner atomic. Production
   needs optimistic versions and concurrent-save behaviour too. Replacing a whole
   labels array can overwrite another namespace; final writes must be designed
   together with namespace-level concurrency. Clearing a label removes its stored
   version: decide where a monotonic revision/tombstone lives to prevent ABA races.
8. **Generic labels cross existing domain boundaries.** `Case`, `CaseDocument`,
   case hydration, timeline schemas/enums and UI timeline renderers currently know
   nothing about labels. Direct Mongo writes prove storage only; integrate the
   generic label model end to end and preserve labels through normal case saves.
9. **Configuration evolution changes identity.** Composite entries need explicit
   names when final path segments collide. Changing a key name changes its hash;
   changing only its source path can reuse a hash when names and values coincide.
   Decide whether identity includes a config fingerprint and how to migrate or
   retire owners and labels. A namespaced label can also outlive a key change.
10. **Scale is unproven.** The spike collects full documents and materialises
    groups before JS sorting; it will meet Mongo document limits on large groups.
    Project only needed fields, constrain group/detail sizes, establish pagination
    and completion-count semantics, then benchmark against realistic volumes.
    The equality-prefix scope index alone proves no throughput target.

## Proposed implementation tickets

These are ticket drafts, not issues created in Jira. Split estimates after the
product decisions above are settled. Do not merge this spike as the implementation.

| Draft title                                            | Acceptance criteria                                                                                                                                                                                                     | Depends on                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Publish and validate configurable case-list page types | Extend workflow publication/runtime schema for dedupe tabs; select list config version; reject unknown expressions/paths and invalid workflow scope; register page type; specify group-key names and identity evolution | Product decisions on config/counts/scope |
| Add generic namespaced case labels and timeline events | Preserve through normal case hydration/saves; one label per namespace; set/change/clear carry actor/time and old/new values; support timeline API/template; protect other namespaces                                    | Label lifecycle/version decision         |
| Build live dedupe summary and group queries            | Correct scoped grouping/exclusions; stable typed hashes; oldest display; hidden-group detail reads; batch owner hydration; summary totals/sort; group/index migration                                                   | Config and labels                        |
| Save group assignment and labels atomically            | Use existing eligible assignment-user list and validate role access; validate group/target membership; transaction; changed-only timeline writes; lazy group creation; no status changes                                | Queries and labels                       |
| Prevent stale dedupe saves                             | Version owner and namespace labels including clears; return 409 without partial writes; test simultaneous saves, other-namespace writes and new arrivals; define stale membership handling                              | Atomic save                              |
| Render reusable dedupe page templates                  | Tab/type registry; summary components and tags; detail case links; owner plus labels in one form; excluded read-only rows; selected historical option; validation errors and navigation; accessibility checks           | Endpoint/view-model contract             |
| Authorise and audit dedupe reads and writes            | Reuse case workflow roles and Read/ReadWrite permissions; enforce scheme/page isolation; audit actor, labels and group owner; verify permitted assignment users and access on every route                               | Backend routes                           |
| Validate dedupe scale and rollout                      | Use realistic dataset and query explain; bounded projections/group sizes; agreed pagination and completion totals; migrate indexes; publish actual grant config; rehearse config-key changes and end-to-end regression  | Working integrated feature               |

Compare applications, extra detail columns, tolerance matching and richer scopes
remain separate optional work already listed by FGP-1594. Do not block the initial
implementation on them. Obtain product agreement on historical-target copy and
whether label cycles should be allowed before finalising label validation.

## Capture and disposal

Keep this directory on the dedicated `fgp-1594-spike` branch. The HTML is the
shareable primary source; the Mongo probe reproduces the backend evidence. This
README is the design/findings handoff and follow-up backlog. Jira was read only;
no ticket changes or new tickets have been published. Discard this directory when
the answers have been absorbed into implementation tickets and production code.
