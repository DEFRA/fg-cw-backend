# External Services Configuration

## Overview

This service integrates with external APIs (e.g., Rules Engine for land grants calculations) using a flexible, environment-based configuration system that supports secure credential management.

### Environment Variables Structure

For each external service, you configure:

1. **Base URL** - `{SERVICE}_URL`
2. **Authentication Secrets** (stored in Truststore) - `TRUSTSTORE_{SERVICE}_AUTH_TOKEN`, `TRUSTSTORE_{SERVICE}_API_KEY`, etc.
3. **HTTP Headers** - `{SERVICE}_HEADERS` (can reference secrets)

### Variable Reference Syntax

Headers can reference other environment variables using **`${VAR_NAME}`** syntax:

```bash
# Define the secret
TRUSTSTORE_RULES_ENGINE_AUTH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Reference it in headers
RULES_ENGINE_HEADERS=Authorization: Bearer ${TRUSTSTORE_RULES_ENGINE_AUTH_TOKEN}
```

**At runtime**, `${TRUSTSTORE_RULES_ENGINE_AUTH_TOKEN}` is replaced with the actual token value from the environment.

### Multiple Headers

Separate multiple headers with commas:

```bash
RULES_ENGINE_HEADERS=x-api-key: ${API_KEY},Authorization: Bearer ${AUTH_TOKEN},x-request-id: 12345
```

## Example: Rules Engine Configuration

### Local Development

Create a `.env` file (never commit this!):

```bash
# Rules Engine API
RULES_ENGINE_URL=https://land-grants-api.dev.cdp-int.defra.cloud
TRUSTSTORE_RULES_ENGINE_AUTH_TOKEN=dev-token-abc123xyz
TRUSTSTORE_RULES_ENGINE_API_KEY=dev-api-key-456

# Headers with secret references
RULES_ENGINE_HEADERS=x-api-key: ${TRUSTSTORE_RULES_ENGINE_API_KEY},Authorization: Bearer ${TRUSTSTORE_RULES_ENGINE_AUTH_TOKEN}
```

### CDP Environment Configuration

**In `cdp-app-config` repository** (`services/fg-cw-backend/prod/fg-cw-backend.env`):

```bash
# Public configuration (safe to commit)
RULES_ENGINE_URL=https://land-grants-api.prod.cdp-int.defra.cloud
RULES_ENGINE_HEADERS=Authorization: Bearer ${TRUSTSTORE_RULES_ENGINE_AUTH_TOKEN}
```

**In CDP Portal > Secrets**:

Create these secrets:

- **Name**: `TRUSTSTORE_RULES_ENGINE_AUTH_TOKEN`
  - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (actual bearer token)

## Workflow Definition

External actions and endpoints are defined in the workflow definition (MongoDB):

```
{
  code: "frps-private-beta",

  // Define available endpoints
  endpoints: [
    {
      code: "FETCH_RULES_ENDPOINT",
      service: "RULES_ENGINE",  // Maps to RULES_ENGINE_* env vars
      path: "/case-management-adapter/application/validation-run/{runId}",
      method: "GET",
      request: null
    }
  ],

  // Define actions that call endpoints
  externalActions: [
    {
      code: "FETCH_RULES",
      name: "Fetch Rules",
      endpoint: {
        code: "FETCH_RULES_ENDPOINT",
        endpointParams: {
          PATH: {
            // Extract runId from case data using JSONPath
            runId: "jsonata:$.request.query.runId ? $.request.query.runId : $.payload.answers.rulesCalculations.rulesCalculation.id"
          }
        }
      }
    }
  ],

  // Reference actions in page definitions
  pages: {
    cases: {
      details: {
        tabs: {
          calculations: {
            action: {
              rulesData: "FETCH_RULES"  // Call the FETCH_RULES action
            },
            content: [
              {
                component: "component-container",
                contentRef: "$.actionData.rulesData.response"  // Use the response
              }
            ]
          }
        }
      }
    }
  }
}
```

## Usage Flow

1. **User navigates** to Calculations tab
2. **Tab definition** specifies action: `{ rulesData: "FETCH_RULES" }`
3. **Use case finds** external action by code `"FETCH_RULES"`
4. **External action** references endpoint `"FETCH_RULES_ENDPOINT"`
5. **Use case extracts** PATH and REQUEST parameters from case data using JSONPath
6. **Endpoint resolver** gets URL and headers from environment config
7. **Variable references** are resolved (e.g., `${RULES_ENGINE_AUTH_TOKEN}` → actual token)
8. **HTTP client** builds URL, adds headers, makes request
9. **Response data** is returned and rendered in the tab

## Adding a New External Service

1. **Add config to convict** (`src/common/config.js`):

   ```
   externalServices: {
     myService: {
       url: {
         env: "MY_SERVICE_URL",
         // ...
       },
       headers: {
         env: "MY_SERVICE_HEADERS",
         // ...
       }
     }
   }
   ```

2. **Add to `.env.example`**:

   ```bash
   MY_SERVICE_URL=https://api.example.com
   TRUSTSTORE_MY_SERVICE_AUTH_TOKEN=replace-with-token
   MY_SERVICE_HEADERS=Authorization: Bearer ${TRUSTSTORE_MY_SERVICE_AUTH_TOKEN}
   ```

3. **Configure in CDP**:
   - Add URL and headers to `cdp-app-config`
   - Add secrets to CDP Portal

4. **Define in workflow**:
   ```javascript
   endpoints: [
     {
       code: "MY_ENDPOINT",
       service: "MY_SERVICE",
       path: "/api/resource/{id}",
       method: "GET",
     },
   ];
   ```
