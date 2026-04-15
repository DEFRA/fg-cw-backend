# Contract Testing for fg-cw-backend

## Architecture Overview

### Message Flow:

```
farming-grants-agreements-api (Agreement Service)
    │
    │ Produces agreement events
    │ (via SNS/SQS)
    ▼
fg-gas-backend (GAS)
    │
    │ Produces case commands and status updates
    │ (via SNS/SQS)
    ▼
fg-cw-backend (Case Working)
    │
    │ Produces case status updates
    │ (via SNS/SQS)
    ▼
fg-gas-backend (GAS)
```

**Key Points**:

- CW is a **CONSUMER** of case commands from GAS
- CW is a **PROVIDER** of case status updates to GAS
- All communication is async via SNS/SQS (no HTTP calls)

## Contract Test Files

### 1. Consumer Tests (What CW Expects to Receive)

**File**: `consumer.gas-backend.test.js`

**Purpose**: Define what message structures CW expects to receive from fg-gas-backend

**Role**:

- **Consumer**: fg-cw-backend (Case Working)
- **Provider**: fg-gas-backend (GAS)

**What it does**:

- Defines the contract for messages CW can handle
- Generates a pact file in `tmp/pacts/`
- This pact gets published to the broker
- GAS team uses this to verify they send correct messages

**Messages Defined**:

**FRPS (`workflowCode: "frps-private-beta"`):**

1. **CreateNewCaseCommand** (full) - UUID `123456789001`
   - Full FRPS answers including scheme, applicant, application, payments wrappers
   - Includes optional `defraId` and `metadata`
2. **CreateNewCaseCommand** (minimal) - UUID `123456789003`
   - Minimal FRPS answers (`scheme`, `year`, `hasCheckedLandIsUpToDate` only)
3. **UpdateCaseStatusCommand** (with supplementary data) - UUID `123456789002`
   - `newStatus`: e.g. `PRE_AWARD:ASSESSMENT:IN_REVIEW`
   - `supplementaryData` with `targetNode: "agreements"`, `dataType: "ARRAY"`, `data: [...]`
4. **UpdateCaseStatusCommand** (minimal supplementary data) - UUID `123456789004`
   - `supplementaryData` with only `phase` and `stage` (no targetNode/dataType/data)

**WMG — Woodland Management Grant (`workflowCode: "woodland"`):**

5. **CreateNewCaseCommand** (full) - UUID `123456789005`
   - WMG answers: flat form fields (no scheme/applicant/application/payments wrapper)
   - Includes optional `defraId` and `metadata`
   - `appLandHasExistingWmp: true` with `existingWmps` array
6. **CreateNewCaseCommand** (minimal) - UUID `123456789007`
   - WMG answers with `appLandHasExistingWmp: false` (no `existingWmps`)
7. **UpdateCaseStatusCommand** (WMG status) - UUID `123456789006`
   - `newStatus`: e.g. `PHASE_PRE_AWARD:STAGE_REVIEWING_APPLICATION:STATUS_IN_REVIEW`
   - WMG uses `PHASE_`/`STAGE_`/`STATUS_` prefixed format (unlike FRPS's bare names)
   - Minimal `supplementaryData` (phase/stage only — WMG has no agreements data yet)
8. **UpdateCaseStatusCommand** (WMG stage transition) - UUID `123456789008`
   - `newStatus`: e.g. `PHASE_PRE_AWARD:STAGE_AWAITING_FC:STATUS_AWAITING_FC_REVIEW`
   - Minimal `supplementaryData` (phase/stage only)

**⚠️ Critical Assumptions**:

- `newStatus` values must be in fully qualified format "PHASE:STAGE:STATUS" matching regex `^[A-Z_]+:[A-Z_]+:[A-Z_]+$`
- FRPS uses bare names: `PRE_AWARD:ASSESSMENT:IN_REVIEW`
- WMG uses prefixed names: `PHASE_PRE_AWARD:STAGE_REVIEWING_APPLICATION:STATUS_IN_REVIEW`
- `caseRef` must be unique and match across systems
- `payload.identifiers` must include at least `sbi`, `frn`, `crn`
- WMG `supplementaryData` does not have `targetNode`/`dataType`/`data` (agreements not yet implemented)

**Fixtures**: WMG payloads are in `test/fixtures/realistic-wmg-payload.js`

## Running Tests

### Run Consumer Tests (Generate Pacts)

```bash
npm run test:contract -- test/contract/consumer.gas-backend.test.js
```

This generates: `tmp/pacts/fg-cw-backend-fg-gas-backend.json`

### Publish Consumer Contracts to Broker

```bash
# Publish the pact so GAS team can verify against it
pact broker publish --merge tmp/pacts/*.json \
  --consumer-app-version=$(git describe --tags --abbrev=0 --always) \
  --broker-base-url=https://ffc-pact-broker.azure.defra.cloud \
  --broker-username=$PACT_USER \
  --broker-password=$PACT_PASS
```

**Note**: The `--merge` flag allows updating pacts for the same version without conflicts.

### Run All Contract Tests

```bash
npm run test:contract
```

This runs all contract tests (consumer and provider) and fetches pacts from the broker by default.

### Run Tests in Local Mode

```bash
npm run test:contract:local
```

This runs tests using local pact files from `tmp/pacts/` instead of fetching from the broker. Useful for local development when you want to test against locally generated pacts.

**Environment Variables**:

- `PACT_USE_LOCAL=true` - Use local pact files instead of broker
- `PACT_LOCAL_DIR` - Custom directory for local pacts (default: `tmp/pacts`)
- `PACT_BROKER_BASE_URL` - Pact broker URL (default: `https://ffc-pact-broker.azure.defra.cloud`)
- `PACT_USER` - Broker username
- `PACT_PASS` - Broker password
- `PACT_PUBLISH_VERIFICATION` - Publish verification results to broker (default: `false`)

### Provider Tests

Provider tests verify that CW sends messages matching GAS expectations. The test uses `MessageProviderPact` and fetches pacts from the broker by default:

**File**: `provider.gas-backend.test.js`

- In CI: Fetches from broker using `PACT_USER` and `PACT_PASS`
- Locally: Set `PACT_USE_LOCAL=true` to test against local pact files
- Configuration: `messageVerifierConfig.js` handles broker vs local mode

## Pact Broker

**URL**: https://ffc-pact-broker.azure.defra.cloud

**Expected Contracts**:

1. **fg-cw-backend → fg-gas-backend** (SNS Messages)
   - Consumer: fg-cw-backend
   - Provider: fg-gas-backend
   - Type: Message contract
   - Test: `consumer.gas-backend.test.js`
   - Messages: CreateNewCaseCommand, UpdateCaseStatusCommand (FRPS + WMG)

## Workflow

### For CW Team (Consumer of Case Commands):

1. Define what messages CW can handle (`consumer.gas-backend.test.js`)
2. Run consumer tests to generate pact
3. Publish pact to broker
4. GAS team verifies they meet this contract

### For GAS Team (Provider of Commands):

1. Download CW consumer contract from broker
2. Write provider verification tests
3. Verify their message producer meets CW expectations
4. Publish verification results

## Message Details

### CreateNewCaseCommand

**When**: GAS sends this when user submits application

**Purpose**: Create new case in CW system

**Critical Fields**:

- `data.caseRef`: Unique case identifier (used as primary key)
- `data.workflowCode`: Workflow type (validated against CW config)
- `data.payload.identifiers`: Business identifiers
  - `sbi`: Single Business Identifier (required)
  - `frn`: Farmer Reference Number (required)
  - `crn`: Customer Reference Number (required)
  - `defraId`: Defra ID (optional but expected)
- `data.payload.answers`: Application form data (validated by workflow schema)

**Example**:

```json
{
  "type": "cloud.defra.test.fg-gas-backend.case.create",
  "source": "fg-gas-backend",
  "data": {
    "caseRef": "CASE-REF-001",
    "workflowCode": "frps-private-beta",
    "payload": {
      "createdAt": "2025-02-09T11:00:00.000Z",
      "submittedAt": "2025-02-09T12:00:00.000Z",
      "identifiers": {
        "sbi": "SBI001",
        "frn": "FIRM0001",
        "crn": "CUST0001",
        "defraId": "DEFRA0001"
      },
      "answers": { ... }
    }
  }
}
```

### UpdateCaseStatusCommand

**When**: GAS sends this when application status changes or supplementary data needs to be attached

**Purpose**: Update case position or attach data (like agreements)

**Critical Fields**:

- `data.caseRef`: Case identifier for lookup
- `data.workflowCode`: Workflow validation
- `data.newStatus`: Target position in format "PHASE:STAGE:STATUS"
- `data.supplementaryData` (optional):
  - `targetNode`: Where to store data (e.g., "agreements")
  - `dataType`: "ARRAY" or "OBJECT"
  - `data`: The actual data to attach

**Example**:

```json
{
  "type": "cloud.defra.test.fg-gas-backend.case.update.status",
  "source": "fg-gas-backend",
  "data": {
    "caseRef": "CASE-REF-001",
    "workflowCode": "frps-private-beta",
    "newStatus": "PRE_AWARD:ASSESSMENT:IN_REVIEW",
    "supplementaryData": {
      "targetNode": "agreements",
      "dataType": "ARRAY",
      "data": [
        {
          "agreementRef": "AGR-001",
          "createdAt": "2023-10-01T12:00:00Z",
          "agreementStatus": "OFFER"
        }
      ]
    }
  }
}
```

## Integration Points

### Inbox Pattern

CW uses the inbox pattern to reliably consume messages from GAS:

1. Message arrives via SQS queue
2. Saved to `inbox` collection in MongoDB
3. InboxSubscriber polls and claims messages
4. Routes to appropriate use case handler
5. Updates case in MongoDB
6. Marks inbox message as completed

**Queues**:

- `CW__SQS__CREATE_NEW_CASE_URL`: Receives CreateNewCaseCommand
- `CW__SQS__UPDATE_STATUS_URL`: Receives UpdateCaseStatusCommand

### Outbox Pattern

CW uses the outbox pattern to reliably publish status updates to GAS:

1. Case status updated in CW (via updateStageOutcomeUseCase)
2. Event saved to `outbox` collection (transactional with case update)
3. OutboxSubscriber polls and claims events
4. Publishes to SNS topic
5. Marks outbox event as completed

**Topics**:

- `CW__SNS__CASE_STATUS_UPDATED_TOPIC_ARN`: Publishes CaseStatusUpdatedEvent

## WMG (Woodland Management Grant) Contract Notes

**Ticket**: FGP-1011

WMG (`workflowCode: "woodland"`, `referenceNumberPrefix: "WMP"`) was added to consumer and provider tests. Key differences from FRPS:

### WMG Answers Shape

WMG answers are **flat form fields** stored directly in `payload.answers` (no scheme/applicant/application/payments nesting):

```json
{
  "businessDetailsUpToDate": true,
  "guidanceRead": true,
  "landRegisteredWithRpa": true,
  "landManagementControl": true,
  "publicBodyTenant": false,
  "landHasGrazingRights": false,
  "appLandHasExistingWmp": true,
  "existingWmps": ["WMP-2024-001"],
  "intendToApplyHigherTier": false,
  "includedAllEligibleWoodland": true,
  "totalHectaresAppliedFor": 15.0,
  "hectaresTenOrOverYearsOld": 8.5,
  "hectaresUnderTenYearsOld": 4.2,
  "centreGridReference": "SK512347",
  "fcTeamCode": "YORKSHIRE_AND_NORTH_EAST",
  "applicationConfirmation": true
}
```

`existingWmps` is only present when `appLandHasExistingWmp: true`. Field names come from the AJV schema in `fg-gas-backend` (`woodland.json`), validated with `removeAdditional: true`.

### WMG Status Format

WMG statuses use `PHASE_`/`STAGE_`/`STATUS_` prefixes:

| Phase             | Stage                         | Status                           |
| ----------------- | ----------------------------- | -------------------------------- |
| `PHASE_PRE_AWARD` | `STAGE_REVIEWING_APPLICATION` | `STATUS_APPLICATION_RECEIVED`    |
| `PHASE_PRE_AWARD` | `STAGE_REVIEWING_APPLICATION` | `STATUS_IN_REVIEW`               |
| `PHASE_PRE_AWARD` | `STAGE_AWAITING_FC`           | `STATUS_AWAITING_FC_REVIEW`      |
| `PHASE_PRE_AWARD` | `STAGE_AWAITING_FC`           | `STATUS_AGREEMENT_GENERATING`    |
| `PHASE_PRE_AWARD` | `STAGE_AWAITING_FC`           | `STATUS_REJECTED_BY_FC`          |
| `PHASE_PRE_AWARD` | `STAGE_AGREEMENT_GENERATED`   | `STATUS_AGREEMENT_GENERATED`     |
| `PHASE_PRE_AWARD` | `STAGE_SENDING_AGREEMENT`     | `STATUS_AWAITING_SEND_AGREEMENT` |
| `PHASE_PRE_AWARD` | `STAGE_SENDING_AGREEMENT`     | `STATUS_AGREEMENT_WITH_CUSTOMER` |
| `PHASE_PRE_AWARD` | `STAGE_REJECTED_BY_APPLICANT` | `STATUS_REJECTED_BY_APPLICANT`   |

### WMG Agreements

WMG does **not** yet have an agreements journey. `UpdateCaseStatusCommand` supplementaryData for WMG contains only `phase` and `stage` — no `targetNode`, `dataType`, or `data`.

## Related Documentation

- Pact Documentation: https://docs.pact.io/
- Message Pacts: https://docs.pact.io/getting_started/how_pact_works#messages
- Pact Broker: https://github.com/pact-foundation/pact_broker

---

**Last Updated**: 2026-04-14
**Tickets**: FGP-789, FGP-1011
