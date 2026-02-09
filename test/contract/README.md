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

1. **CreateNewCaseCommand** - Event type: `cloud.defra.(test|local|prod).fg-gas-backend.case.create`
   - Required fields: `id`, `source`, `specVersion`, `datacontenttype`, `time`, `type`, `traceparent`
   - Data: `caseRef`, `workflowCode`, `payload` (with `identifiers`, `answers`, `createdAt`, `submittedAt`)
   - **Critical**: `caseRef` is primary key, `identifiers` (sbi, frn, crn) required for case operations

2. **UpdateCaseStatusCommand** - Event type: `cloud.defra.(test|local|prod).fg-gas-backend.case.update.status`
   - Required fields: `id`, `source`, `specVersion`, `datacontenttype`, `time`, `type`, `traceparent`
   - Data: `caseRef`, `workflowCode`, `newStatus` (format: "PHASE:STAGE:STATUS")
   - Optional: `supplementaryData` (for attaching agreements or other data)
   - **Critical**: `newStatus` must match "PHASE:STAGE:STATUS" format, wrong format will cause validation failure

**⚠️ Critical Assumptions**:

- `newStatus` values must be in fully qualified format "PHASE:STAGE:STATUS" (e.g., "PRE_AWARD:ASSESSMENT:IN_REVIEW")
- `caseRef` must be unique and match across systems
- `payload.identifiers` must include at least `sbi`, `frn`, `crn`
- `supplementaryData` structure, when present, must match expected format (targetNode, dataType, data)

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

## Pact Broker

**URL**: https://ffc-pact-broker.azure.defra.cloud

**Expected Contracts**:

1. **fg-cw-backend → fg-gas-backend** (SNS Messages)
   - Consumer: fg-cw-backend
   - Provider: fg-gas-backend
   - Type: Message contract
   - Test: `consumer.gas-backend.test.js`
   - Messages: CreateNewCaseCommand, UpdateCaseStatusCommand

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

## Related Documentation

- Pact Documentation: https://docs.pact.io/
- Message Pacts: https://docs.pact.io/getting_started/how_pact_works#messages
- Pact Broker: https://github.com/pact-foundation/pact_broker

---

**Last Updated**: 2026-02-09
