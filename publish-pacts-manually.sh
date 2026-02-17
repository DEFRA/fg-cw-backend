#!/bin/bash
# Manual script to publish consumer pacts to broker

set -e

PACT_BROKER_BASE_URL="https://ffc-pact-broker.azure.defra.cloud"

# Check for required environment variables
if [ -z "${PACT_USER}" ] || [ -z "${PACT_PASS}" ]; then
  echo "Error: PACT_USER and PACT_PASS environment variables must be set"
  echo ""
  echo "Set them like this:"
  echo "  export PACT_USER='your-username'"
  echo "  export PACT_PASS='your-password'"
  echo ""
  exit 1
fi

echo "=== Step 1: Run consumer tests to generate pacts ==="
npm run test:contract -- test/contract/consumer.gas-backend.test.js
npm run test:contract -- test/contract/consumer.land-grants-api.test.js

echo ""
echo "=== Step 2: Check generated pacts ==="
ls -lh tmp/pacts/*.json

echo ""
echo "=== Step 3: Install Pact CLI if needed ==="
if ! command -v pact-broker &> /dev/null; then
  echo "Installing Pact CLI..."
  curl -fsSL https://raw.githubusercontent.com/pact-foundation/pact-standalone/master/install.sh | PACT_CLI_VERSION=v2.5.9 bash
  export PATH="${PATH}:${PWD}/pact/bin/"
else
  echo "Pact CLI already installed ✅"
fi

echo ""
echo "=== Step 4: Publish pacts to broker ==="
CONSUMER_VERSION=$(git describe --tags --abbrev=0 --always)
echo "Consumer version: $CONSUMER_VERSION"

pact-broker publish --merge \
  --broker-base-url "${PACT_BROKER_BASE_URL}" \
  --broker-username "${PACT_USER}" \
  --broker-password "${PACT_PASS}" \
  --consumer-app-version "${CONSUMER_VERSION}" \
  tmp/pacts/*.json

echo ""
echo "=== Done! ==="
echo ""
echo "View your pacts in the broker:"
echo "  ${PACT_BROKER_BASE_URL}"
echo ""
echo "Consumer pacts published:"
echo "  - fg-cw-backend → fg-gas-backend"
echo "  - fg-cw-backend → land-grants-api"
