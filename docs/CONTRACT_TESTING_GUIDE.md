# Contract Testing Guide for fg-cw-backend

## Table of Contents

1. [Introduction](#introduction)
2. [What is Contract Testing?](#what-is-contract-testing)
3. [Architecture Overview](#architecture-overview)
4. [Our Contract Testing Setup](#our-contract-testing-setup)
5. [Test Files Explained](#test-files-explained)
6. [Running the Tests](#running-the-tests)
7. [Understanding Test Results](#understanding-test-results)
8. [Troubleshooting](#troubleshooting)
9. [Glossary](#glossary)

---

## Introduction

This guide explains how contract testing works in the **fg-cw-backend** (Caseworking Backend) system. It's designed to be accessible to non-technical testers while providing comprehensive technical details for reference.

**Purpose**: Contract tests ensure that different services in our system can communicate with each other reliably, even when they're developed by different teams.

**Audience**: QA testers, product owners, developers, and anyone involved in system integration testing.

---

## What is Contract Testing?

### The Problem

Imagine two teams building different parts of a delivery system:

- Team A builds a **Parcel Sender** that packages and sends parcels
- Team B builds a **Parcel Receiver** that receives and unpacks parcels

For the system to work:

- The **Sender** needs to know what format the **Receiver** expects
- The **Receiver** needs to handle what the **Sender** actually sends

If Team A changes the parcel format without telling Team B, deliveries fail!

### The Solution: Contract Testing

**Contract testing** is like having a written agreement (a contract) that both teams follow:

1. **Consumer** (the team that receives data) writes down what they expect to receive
2. **Provider** (the team that sends data) verifies they can meet those expectations
3. Both teams test against the **same contract**

**Benefits**:

- Teams can work independently without breaking each other
- Changes that break compatibility are caught immediately
- No need to run both services together for integration testing
- Acts as living documentation of how services communicate

### Real-World Example from Our System

In our farming grants system:

```
┌─────────────────┐         Messages         ┌──────────────────┐
│  fg-gas-backend │  ──────────────────────> │  fg-cw-backend   │
│  (Grant App)    │  (Case Creation Events)  │  (Caseworking)   │
└─────────────────┘                          └──────────────────┘
```

When a farmer submits a grant application:

- **fg-gas-backend** sends a message to create a new case
- **fg-cw-backend** receives and processes that message
- The **contract** defines exactly what fields must be in that message

---

## Architecture Overview

### System Components

Our system has five main services that communicate with each other:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Farming Grants System                            │
└──────────────────────────────────────────────────────────────────────────┘

    ┌───────────────┐                                   ┌──────────────┐
    │  grants-ui    │                                   │  agreements  │
    │               │                                   │              │
    │  (Frontend    │                                   │  (Agreement  │
    │   Web App)    │                                   │   Mgmt)      │
    └───────┬───────┘                                   └──────┬───────┘
            │                                                  │
            │ HTTP                                             │ HTTP
            │ Calls                                            │ Calls
            ▼                                                  ▼
┌──────────────────┐                              ┌──────────────────┐
│  fg-gas-backend  │                              │  fg-cw-backend   │
│                  │                              │                  │
│  (Grant         │◄─────── Messages ───────────►│  (Caseworking    │
│   Application    │      via SNS/SQS             │   System)        │
│   System)        │                              │                  │
└──────────────────┘                              └─────────┬────────┘
                                                            │
                                                            │ HTTP
                                                            │ Calls
                                                            ▼
                                                  ┌──────────────────┐
                                                  │ land-grants-api  │
                                                  │                  │
                                                  │ (Rules Engine &  │
                                                  │  Validation)     │
                                                  └──────────────────┘
```

**Key Components:**

- **grants-ui**: Farmer-facing web application for submitting applications
- **fg-gas-backend**: Processes grant applications and business logic
- **fg-cw-backend**: Caseworking system for staff to manage applications
- **land-grants-api**: Rules engine for validation and calculations
- **agreements**: Manages grant funding agreements and contracts

### Communication Patterns

**1. User-Facing Frontend (HTTP)**

- **grants-ui → fg-gas-backend**: Farmers submit applications via web UI
- **agreements → fg-cw-backend**: Staff manage grant funding agreements
- Uses REST API with JSON payloads

**2. Message-Based Communication (Asynchronous)**

- **fg-gas-backend → fg-cw-backend**: Case creation and status update messages
- **fg-cw-backend → fg-gas-backend**: Case status update notifications
- Uses AWS SNS (Simple Notification Service) and SQS (Simple Queue Service)
- Messages follow CloudEvents specification
- **✅ This is what we contract test**

**3. HTTP API Calls (Synchronous)**

- **fg-cw-backend → land-grants-api**: Validation runs and calculations
- Uses REST API with JSON payloads
- **✅ This is what we contract test**

**Note**: Our contract tests focus on the backend-to-backend integrations (message-based and API calls between services), not the frontend-to-backend calls.

### Contract Testing Flow

```
                    ┌─────────────────────┐
                    │   Pact Broker       │
                    │  (Central Storage)  │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
            Publish │                     │ Download
           Contracts│                     │ Contracts
                    │                     │
         ┌──────────▼─────┐    ┌─────────▼────────┐
         │  Consumer Test │    │  Provider Test   │
         │                │    │                  │
         │  "I expect     │    │  "I verify I can │
         │   this format" │    │   provide that"  │
         └────────────────┘    └──────────────────┘
```

**Workflow**:

1. Consumer tests define expectations and publish contracts to broker
2. Provider tests download contracts and verify they meet them
3. If verification passes, integration is guaranteed to work
4. If verification fails, the breaking change is caught before deployment

---

## Our Contract Testing Setup

### Tools and Technologies

**Framework**: Pact (https://pact.io)

- Industry-standard contract testing framework
- Supports both message and HTTP contract testing
- Version: `@pact-foundation/pact` v16.2.0

**Test Runner**: Vitest

- Modern, fast JavaScript test runner
- Compatible with Pact framework

**Infrastructure**:

- **Pact Broker**: Central repository for contracts (hosted service)
- **Local Testing**: Can test against local contracts without broker
- **CI/CD Integration**: Tests run in build pipeline

### File Structure

```
fg-cw-backend/
├── test/
│   ├── contract/
│   │   ├── consumer.gas-backend.test.js          # Consumer: receives from GAS
│   │   ├── consumer.land-grants-api.test.js      # Consumer: calls land-grants API
│   │   ├── provider.gas-backend.test.js          # Provider: sends to GAS
│   │   ├── realistic-payload.integration.test.js # Integration validation
│   │   ├── vitest.config.js                      # Test configuration
│   │   └── messageVerifierConfig.js              # Pact broker settings
│   ├── fixtures/
│   │   └── realistic-frps-payload.js             # Test data fixtures
├── tmp/
│   └── pacts/                                    # Generated contract files
└── package.json                                  # Test scripts defined here
```

### Environment Configuration

**Environment Variables**:

```bash
# Pact Broker Configuration
PACT_BROKER_BASE_URL=https://your-pact-broker.com
PACT_USER=username
PACT_PASS=password
PACT_PUBLISH_VERIFICATION=true  # Publish results to broker

# Local Testing
PACT_USE_LOCAL=true              # Test against local pacts instead of broker
PACT_LOCAL_DIR=./tmp/pacts       # Directory for local pact files
```

---

## Test Files Explained

### 1. consumer.gas-backend.test.js

**Purpose**: Tests that fg-cw-backend can correctly receive messages FROM fg-gas-backend

**Role**: Consumer test (we consume messages from GAS)

**What It Tests**:

#### Test 1: Create New Case Command (Full Payload)

**What it does**: Verifies we can receive a complete case creation message with all optional fields

**Inputs**:

- **CloudEvent Wrapper**: Standard event envelope containing:
  - `id`: Unique message identifier (UUID format)
  - `type`: Message type matching pattern `cloud.defra.{env}.fg-gas-backend.case.create`
  - `source`: Always "fg-gas-backend"
  - `specVersion`: CloudEvents version "1.0"
  - `datacontenttype`: "application/json"
  - `time`: ISO 8601 timestamp with milliseconds
  - `traceparent`: Distributed tracing identifier

- **Data Payload**: Actual case information
  - `caseRef`: Unique case reference (e.g., "CASE-REF-001")
  - `workflowCode`: Workflow identifier (e.g., "frps-private-beta")
  - `payload`:
    - `createdAt`: When application was created
    - `submittedAt`: When application was submitted
    - `identifiers`:
      - `sbi`: Single Business Identifier
      - `frn`: Farmer Reference Number
      - `crn`: Customer Reference Number
      - `defraId`: Defra ID (optional)
    - `answers`: Complex application form data (see realistic payload)
    - `metadata`: Optional additional data

**What We Verify**:

- All critical fields are present (caseRef, workflowCode, payload, identifiers)
- Field types match expectations
- CloudEvent structure is correct
- Data can be parsed as JSON

**Assumptions**:

- GAS always sends CloudEvents format
- Message type follows environment-based pattern
- Timestamps are in ISO 8601 format with milliseconds
- All business identifiers (sbi, frn, crn) are always provided

**Data Setup**:

- Uses `realisticFrpsPayload` from fixtures
- Contains realistic FRPS (Farming Rules for Parcels and Actions) application data
- Includes all nested structures: applicant, parcels, actions, payments

**Expected Outcome**:

- Test generates a pact file: `fg-cw-backend-fg-gas-backend.json`
- Pact defines the expected message structure
- All assertions pass without errors

**Example Message Structure**:

```json
{
  "id": "12345678-1234-1234-1234-123456789001",
  "type": "cloud.defra.test.fg-gas-backend.case.create",
  "source": "fg-gas-backend",
  "specVersion": "1.0",
  "datacontenttype": "application/json",
  "time": "2025-02-09T12:00:00.000Z",
  "traceparent": "00-trace-id",
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
      "answers": {
        /* complex application data */
      },
      "metadata": {}
    }
  }
}
```

#### Test 2: Create New Case Command (Minimal Payload)

**What it does**: Verifies we can handle case creation with only required fields

**Difference from Test 1**:

- No `defraId` in identifiers
- No `metadata` field
- Minimal answers structure (only basic required fields)

**What We Verify**:

- Optional fields can be omitted without breaking processing
- `defraId` is explicitly undefined
- `metadata` is explicitly undefined

**Why This Test Matters**: Ensures backward compatibility if GAS decides to omit optional fields

---

#### Test 3: Update Case Status Command

**What it does**: Verifies we can receive case status update messages from GAS

**Inputs**:

- **CloudEvent Wrapper**: Similar to create message
  - `type`: Pattern `cloud.defra.{env}.fg-gas-backend.case.update.status`

- **Data Payload**:
  - `caseRef`: Case to update
  - `workflowCode`: For validation
  - `newStatus`: New status in format "PHASE:STAGE:STATUS"
    - Example: "PRE_AWARD:ASSESSMENT:IN_REVIEW"
  - `supplementaryData` (optional): Additional data to attach
    - `phase`: Current phase
    - `stage`: Current stage
    - `targetNode`: Where to store data (e.g., "agreements")
    - `dataType`: "ARRAY" or "OBJECT"
    - `data`: The actual supplementary data

**What We Verify**:

- Status format matches required pattern (three parts separated by colons)
- Supplementary data structure is valid
- All required fields present

**Assumptions**:

- Status updates may or may not include supplementary data
- Status must always be in fully qualified format (PHASE:STAGE:STATUS)
- Supplementary data follows specific structure when present

**Example Status Update**:

```json
{
  "data": {
    "caseRef": "CASE-REF-001",
    "workflowCode": "frps-private-beta",
    "newStatus": "PRE_AWARD:ASSESSMENT:IN_REVIEW",
    "supplementaryData": {
      "phase": "PRE_AWARD",
      "stage": "ASSESSMENT",
      "targetNode": "agreements",
      "dataType": "ARRAY",
      "data": [
        {
          "agreementRef": "AGR-001",
          "createdAt": "2023-10-01T12:00:00Z",
          "updatedAt": "2023-10-01T12:00:00Z",
          "agreementStatus": "OFFER"
        }
      ]
    }
  }
}
```

#### Test 4: Update Case Status Without Supplementary Data

**What it does**: Verifies status updates work with minimal supplementary data

**What We Verify**:

- Can receive status updates with only phase and stage
- `targetNode`, `dataType`, and `data` fields are explicitly undefined

**Why This Test Matters**: GAS may not always have supplementary data to attach

---

### 2. consumer.land-grants-api.test.js

**Purpose**: Tests that fg-cw-backend can correctly call land-grants-api HTTP endpoints

**Role**: Consumer test (we consume the API)

**What It Tests**:

#### Test 1: GET Validation Run by ID (Success Case)

**What it does**: Verifies we can fetch validation results for a specific validation run

**Endpoint**: `GET /case-management-adapter/application/validation-run/{id}`

**Inputs**:

- **Request**:
  - Method: GET
  - Path: `/case-management-adapter/application/validation-run/123`
  - Headers: `Content-Type: application/json`

- **Provider State**: "has validation run with id 123"

**What We Verify**:

- Response status is 200
- Response has `message` field
- Response has `response` array with UI components
- Each component has:
  - `component`: Component type (e.g., "paragraph")
  - `text`: Display text

**Assumptions**:

- Validation run ID 123 exists in provider's system
- Provider returns structured UI component data
- Data is suitable for direct rendering in UI

**Expected Response**:

```json
{
  "message": "Application validation run retrieved successfully",
  "response": [
    {
      "component": "paragraph",
      "text": "Validation result text"
    }
  ]
}
```

**Data Setup**: Provider is configured with test data for ID 123

**Expected Outcome**: HTTP mock server responds with expected structure

---

#### Test 2: GET Validation Run (Not Found)

**What it does**: Verifies proper error handling when validation run doesn't exist

**Inputs**:

- Path: `/case-management-adapter/application/validation-run/999`
- Provider State: "has no validation run with id 999"

**What We Verify**:

- Response status is 404
- Error response contains:
  - `statusCode`: 404
  - `error`: "Not Found"
  - `message`: Error description

**Why This Test Matters**: Ensures graceful handling of missing data

---

#### Test 3: POST Rerun Validation (Success)

**What it does**: Verifies we can trigger a validation rerun

**Endpoint**: `POST /case-management-adapter/application/validation-run/rerun`

**Inputs**:

- **Request Body**:
  ```json
  {
    "id": 123,
    "requesterUsername": "CASEWORKING_SYSTEM"
  }
  ```
- **Provider State**: "has application validation run with id 123"

**What We Verify**:

- Response status is 200
- Response contains:
  - `message`: Success message
  - `valid`: Boolean (true/false)
  - `id`: Number (validation run ID)
  - `date`: ISO timestamp string

**Assumptions**:

- Provider accepts system username "CASEWORKING_SYSTEM"
- Validation runs synchronously and returns immediate result
- Result includes pass/fail indicator

**Expected Response**:

```json
{
  "message": "Application validated successfully",
  "valid": true,
  "id": 123,
  "date": "2025-09-30T08:29:21.263Z"
}
```

---

#### Test 4: POST Rerun Validation (Not Found)

**What it does**: Tests error case when trying to rerun non-existent validation

**Inputs**:

- Request body with `id: 999`
- Provider State: "has no application validation run with id 999"

**Expected**: 404 error response

---

#### Test 5: POST Rerun Validation (Validation Errors)

**What it does**: Tests case when validation fails due to business rule violations

**Inputs**:

- Request body with `id: 456`
- Provider State: "has application validation run with id 456 that will fail"

**What We Verify**:

- Response status is 400 (Bad Request)
- Error response indicates validation failure

**Why This Test Matters**: Applications may fail validation due to business rules (e.g., insufficient land, invalid parcels)

---

### 3. provider.gas-backend.test.js

**Purpose**: Verifies that fg-cw-backend sends messages that match what fg-gas-backend expects

**Role**: Provider test (we provide messages to GAS)

**What It Tests**:

#### Test 1: Case Status Updated Event

**What it does**: Verifies our `CaseStatusUpdatedEvent` class produces messages matching GAS's expectations

**How It Works**:

1. Creates actual event using production code:

   ```javascript
   new CaseStatusUpdatedEvent({
     caseRef: "CASE-REF-001",
     workflowCode: "frps-private-beta",
     previousStatus: "PRE_AWARD:ASSESSMENT:IN_REVIEW",
     currentStatus: "PRE_AWARD:ASSESSMENT:WITHDRAWAL_REQUESTED",
   });
   ```

2. Verifies event against pact contract from GAS
3. Downloads contract from broker (or uses local if `PACT_USE_LOCAL=true`)
4. Compares generated event with GAS's expectations

**What We Verify**:

- Message structure matches GAS's consumer test
- All required fields present
- Field types and formats correct
- CloudEvent envelope is valid

**Assumptions**:

- GAS has published their consumer contract to broker
- Our event class produces CloudEvents format
- Status transitions follow workflow rules

**Data Setup**:

- Uses real production code (not mocks)
- Tests actual event generation logic

**Expected Outcome**:

- Verification passes, confirming compatibility with GAS
- Any breaking changes cause verification to fail

**Why This Test Matters**:

- Catches breaking changes before deployment
- Ensures GAS can process our status updates
- Acts as regression test for event structure

**Configuration**:
Uses `messageVerifierConfig.js` which:

- Determines broker vs local mode
- Configures authentication for broker
- Publishes verification results (if enabled)

---

### 4. realistic-payload.integration.test.js

**Purpose**: Integration test proving realistic payloads can be processed by our domain models

**Role**: Safety net between contract tests and actual code

**The "Danger Area" Problem**:

Contract tests verify message structure matches expectations, but don't prove the actual code can process that structure. This test bridges that gap.

**Example**:

```
Contract Test ✓ → Message has field "answers"
Integration Test ✓ → Case.new() can actually process answers object
```

#### Test 1: Realistic FRPS Payload Processing

**What it does**: Verifies `Case.new()` can create a case with realistic payload structure

**Inputs**:

- Uses `realisticFrpsPayload` (same as contract test)
- Complete application data including:
  - Applicant information
  - Business details
  - Parcel data with actions
  - Payment calculations
  - Rules engine results

**What We Verify**:

- No errors thrown during case creation
- Payload stored correctly in case object
- Nested structures accessible:
  - `rulesCalculations`
  - `applicant`
  - `application.parcel` (array)
  - `payments.parcel` (array)

**Assumptions**:

- Case model accepts flexible payload structure
- Schema validation happens at workflow level
- Payload structure matches FRPS workflow requirements

**Expected Outcome**: Case created successfully with all data intact

---

#### Test 2: Minimal Payload Processing

**What it does**: Verifies case creation works with minimum required fields

**Inputs**:

- Uses `minimalFrpsPayload`
- Only includes:
  - Basic identifiers
  - Minimal answers (scheme, year, land up-to-date flag)

**What We Verify**:

- Case creation succeeds with minimal data
- No errors for missing optional fields

**Why This Test Matters**:

- Proves optional fields are truly optional
- Prevents regression where code assumes optional fields exist
- Validates graceful degradation

---

### 5. realistic-frps-payload.js

**Purpose**: Shared test data fixtures used across multiple test files

**What It Contains**:

#### realisticFrpsPayload

A complete, realistic FRPS (Farming Rules Private Beta Scheme) application including:

**Identifiers**:

```javascript
{
  sbi: "SBI001",           // Single Business Identifier
  frn: "FIRM0001",         // Farmer Reference Number
  crn: "CUST0001",         // Customer Reference Number
  defraId: "DEFRA0001"     // Defra ID
}
```

**Applicant Data**:

- Business name, reference, email, phone
- Physical address (multi-line)
- Customer contact details (title, name)

**Application Details**:

- Scheme: "SFI" (Sustainable Farming Incentive)
- Year: 2025
- Land up-to-date confirmation

**Parcel Information**:

```javascript
{
  sheetId: "SD6843",       // Ordnance Survey sheet
  parcelId: "9485",        // Unique parcel identifier
  area: {
    unit: "ha",            // Hectares
    quantity: 0.1447
  },
  actions: [{
    code: "CMOR1",         // Action code (Assess moorland)
    version: 1,
    durationYears: 3,
    appliedFor: {          // Area applied for
      unit: "ha",
      quantity: 0.1447
    }
  }]
}
```

**Payment Calculations**:

- Action descriptions
- Payment rates (pence per hectare)
- Annual payment amounts
- Eligible vs applied-for areas

**Rules Validation**:

```javascript
rulesCalculations: {
  id: 421,
  message: "Application validated successfully",
  valid: true,
  date: "2025-11-18T13:51:50.549Z"
}
```

**Total Payment**: 28062 pence (£280.62)

#### minimalFrpsPayload

Stripped-down version with only required fields:

- Basic identifiers (no defraId)
- Minimal answers (scheme, year, land check)
- No parcel data
- No payment calculations
- No metadata

**Why This Separation Matters**:

- Realistic: Tests against production-like data
- Minimal: Tests backward compatibility and required fields
- Reusability: Same fixtures used in contract and integration tests
- Consistency: Ensures contract tests match integration tests

---

## Running the Tests

### Prerequisites

1. **Node.js**: Version 24 or higher
2. **Dependencies Installed**: Run `npm install`
3. **Environment Variables**: Configure broker credentials (or use local mode)

### Test Commands

#### Run All Contract Tests

```bash
npm run test:contract
```

**What it does**:

- Runs all consumer tests (gas-backend, land-grants-api)
- Runs provider tests
- Runs integration tests
- Generates pact files in `tmp/pacts/`
- Publishes to broker (if configured)

**Expected output**:

```
✓ test/contract/consumer.gas-backend.test.js (4 tests)
✓ test/contract/consumer.land-grants-api.test.js (5 tests)
✓ test/contract/provider.gas-backend.test.js (1 test)
✓ test/contract/realistic-payload.integration.test.js (2 tests)

Test Files  4 passed (4)
     Tests  12 passed (12)
```

---

#### Run Tests Against Local Pacts

```bash
npm run test:contract:local
```

**What it does**:

- Sets `PACT_USE_LOCAL=true`
- Uses pact files from `tmp/pacts/` instead of broker
- Doesn't publish results
- Useful for development and debugging

**When to use**:

- Offline development
- Testing contract changes before publishing
- CI environments without broker access

---

#### Run Specific Test File

```bash
npx vitest test/contract/consumer.gas-backend.test.js
```

---

#### Run Tests in Watch Mode

```bash
npx vitest test/contract --watch
```

**What it does**:

- Reruns tests when files change
- Useful during development

---

### Generated Artifacts

After running consumer tests, pact files are generated:

```bash
tmp/pacts/
├── fg-cw-backend-fg-gas-backend.json      # Consumer: receives from GAS
└── fg-cw-backend-land-grants-api.json     # Consumer: calls land-grants API
```

**Pact File Structure**:

```json
{
  "consumer": {
    "name": "fg-cw-backend"
  },
  "provider": {
    "name": "fg-gas-backend"
  },
  "messages": [
    {
      "description": "a create new case command from GAS",
      "contents": {
        /* expected message structure */
      },
      "matchingRules": {
        /* field matching rules */
      }
    }
  ],
  "metadata": {
    "pactSpecification": {
      "version": "3.0.0"
    }
  }
}
```

These files can be:

- Committed to version control
- Published to Pact Broker
- Shared with provider teams

---

## Understanding Test Results

### Successful Test Run

```
 ✓ test/contract/consumer.gas-backend.test.js (4)
   ✓ fg-cw-backend Consumer (receives messages from fg-gas-backend) (4)
     ✓ CreateNewCaseCommand Message (2)
       ✓ should accept a create new case command from GAS
       ✓ should accept a create new case command without optional fields
     ✓ UpdateCaseStatusCommand Message (2)
       ✓ should accept a case status update command from GAS
       ✓ should accept a case status update command without supplementary data array fields
```

**What this means**:

- All contract tests passed
- Message structures meet expectations
- No breaking changes detected

---

### Failed Test: Missing Required Field

```
❌ test/contract/consumer.gas-backend.test.js
   ❌ should accept a create new case command from GAS

      AssertionError: expected undefined to be defined

      at verify (consumer.gas-backend.test.js:109)

      expect(cloudEvent.data.caseRef).toBeDefined()
                                      ^
```

**What this means**:

- GAS sent a message without `caseRef` field
- This is a **critical failure** - case cannot be created without case reference
- **Action required**: GAS team needs to fix their message structure

---

### Failed Test: Type Mismatch

```
❌ test/contract/consumer.gas-backend.test.js
   ❌ should accept a case status update command from GAS

      Error: status format invalid

      Expected: /^[A-Z_]+:[A-Z_]+:[A-Z_]+$/
      Received: "IN_REVIEW"
```

**What this means**:

- Status format doesn't match expected pattern
- Expected: "PRE_AWARD:ASSESSMENT:IN_REVIEW"
- Received: "IN_REVIEW"
- **Action required**: GAS needs to send fully qualified status

---

### Provider Verification Failure

```
❌ test/contract/provider.gas-backend.test.js

   Pact verification failed:

   1) Verifying a pact between fg-gas-backend and fg-cw-backend
      - a case status updated event from CW

        Expected: object with field 'previousStatus'
        Actual: { caseRef: "...", currentStatus: "...", workflowCode: "..." }
```

**What this means**:

- GAS expects `previousStatus` field in our status update events
- We're not sending it
- **Action required**: Update `CaseStatusUpdatedEvent` class to include previous status

---

### HTTP Consumer Test Failure

```
❌ test/contract/consumer.land-grants-api.test.js
   ❌ should retrieve validation run results by ID

   Expected status: 200
   Received status: 500

   Response body: { "error": "Internal Server Error" }
```

**What this means**:

- land-grants-api endpoint returned error
- Could indicate:
  - API is down
  - Test data not set up correctly
  - API implementation bug
- **Action required**: Check provider state setup, verify API is running

---

## Troubleshooting

### Common Issues

#### Issue 1: "Pact broker authentication failed"

**Error**:

```
Error: Request failed with status code 401
Unauthorized
```

**Cause**: Invalid broker credentials

**Solution**:

```bash
# Check environment variables
echo $PACT_BROKER_BASE_URL
echo $PACT_USER
# Don't echo password!

# Update .env file
PACT_BROKER_BASE_URL=https://correct-url.com
PACT_USER=correct-username
PACT_PASS=correct-password
```

**Workaround**: Use local mode during development

```bash
npm run test:contract:local
```

---

#### Issue 2: "No pact files found"

**Error**:

```
Error: No pact files found in tmp/pacts
```

**Cause**: Consumer tests haven't run yet

**Solution**:

1. Run consumer tests first to generate pacts
2. Then run provider tests

```bash
# Run in this order:
npx vitest test/contract/consumer.gas-backend.test.js
npx vitest test/contract/provider.gas-backend.test.js
```

---

#### Issue 3: "Provider state not recognized"

**Error**:

```
Error: Provider state "has validation run with id 123" not found
```

**Cause**: Provider hasn't implemented required state setup

**Solution**: Contact provider team (land-grants-api) to implement state handler

**Their code should look like**:

```javascript
.stateHandlers({
  "has validation run with id 123": () => {
    // Set up test data for ID 123
    return Promise.resolve();
  }
})
```

---

#### Issue 4: Test timeout

**Error**:

```
Error: Test exceeded timeout of 60000ms
```

**Cause**:

- Network issues connecting to broker
- Slow test execution
- Infinite loop in test code

**Solution**:

1. Check network connection
2. Increase timeout in `vitest.config.js`:
   ```javascript
   testTimeout: 120000; // 2 minutes
   ```
3. Use local mode to isolate network issues

---

#### Issue 5: "Module not found" errors

**Error**:

```
Error: Cannot find module '@pact-foundation/pact'
```

**Cause**: Dependencies not installed

**Solution**:

```bash
# Clean install
rm -rf node_modules
rm package-lock.json
npm install
```

---

#### Issue 6: Pact version conflicts

**Error**:

```
Error: Pact specification version mismatch
Expected: 3.0.0
Got: 2.0.0
```

**Cause**: Provider using older Pact version

**Solution**:

- Coordinate with provider team to upgrade
- Or downgrade our pact spec version (not recommended)

---

### Debugging Tips

#### Enable Verbose Logging

Add to test file:

```javascript
const messagePact = new MessageConsumerPact({
  consumer: "fg-cw-backend",
  provider: "fg-gas-backend",
  logLevel: "debug", // Change from "info" to "debug"
});
```

#### Inspect Generated Pacts

```bash
# Pretty-print pact file
cat tmp/pacts/fg-cw-backend-fg-gas-backend.json | jq
```

#### View Pact Broker

Open broker URL in browser:

```
https://your-pact-broker.com/pacts/provider/fg-gas-backend/consumer/fg-cw-backend/latest
```

#### Run Single Test

```bash
npx vitest test/contract/consumer.gas-backend.test.js -t "should accept a create new case command"
```

#### Check Production Code

Integration tests use real code - check the actual classes:

```bash
# View event class
cat src/cases/events/case-status-updated.event.js

# View case model
cat src/cases/models/case.js
```

---

## Glossary

**Consumer**: Service that receives data or calls an API. In our context, fg-cw-backend is a consumer when receiving messages from fg-gas-backend.

**Provider**: Service that sends data or exposes an API. In our context, fg-cw-backend is a provider when sending status updates to fg-gas-backend.

**Contract**: Agreement defining the structure and format of messages/requests between services.

**Pact**: Specific contract format used by the Pact testing framework. Stored as JSON files.

**Pact Broker**: Central repository for storing and sharing pact contracts between teams.

**CloudEvents**: Specification for describing event data in a common format. Our messages follow this standard.

**Provider State**: Test data setup required by provider to fulfill contract. For example, "has validation run with id 123" means provider creates test validation run with that ID.

**Matcher**: Rule in pact contract defining how to match values. Examples:

- `like("example")`: Any string is acceptable
- `uuid()`: Must be valid UUID format
- `term({ matcher: "regex" })`: Must match regex pattern

**Message Pact**: Contract for asynchronous messaging (like SNS/SQS messages).

**HTTP Pact**: Contract for synchronous HTTP API calls.

**Verification**: Process where provider proves they can meet the contract expectations.

**Publishing**: Uploading pact contract to broker for provider to consume.

**Consumer Driven**: Contract testing approach where consumer defines expectations and provider verifies them.

**Integration Test**: Test verifying multiple components work together. Our integration tests verify contracts work with real code.

**Fixture**: Predefined test data. Our `realistic-frps-payload.js` contains fixtures.

**FRPS**: Farming Rules for Private Beta Scheme - specific workflow type in our system.

**SBI**: Single Business Identifier - unique ID for farming business.

**FRN**: Farmer Reference Number.

**CRN**: Customer Reference Number.

**Defra ID**: Department for Environment, Food & Rural Affairs identifier.

**Workflow Code**: Identifier for specific grant workflow (e.g., "frps-private-beta").

**Case Ref**: Unique reference for a grant application case.

**Supplementary Data**: Additional data attached to case during status updates.

---

## Additional Resources

- **Provider Verification Timing**: [PROVIDER_VERIFICATION_TIMING.md](./PROVIDER_VERIFICATION_TIMING.md) - Understanding warning indicators in Pact Broker
- **Pact Documentation**: https://docs.pact.io/
- **CloudEvents Specification**: https://cloudevents.io/
- **Vitest Documentation**: https://vitest.dev/
- **Internal Docs**: `/docs/EXTERNAL_SERVICES.md` for API configuration

---

**Document Version**: 1.0
**Last Updated**: 2026-03-05
**Maintainer**: fg-cw-backend team
