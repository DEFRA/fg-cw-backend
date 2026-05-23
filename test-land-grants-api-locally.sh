#!/bin/bash
# Test script for local integration testing with land-grants-api

set -e

echo "=== Local Integration Test: fg-cw-backend → land-grants-api ==="
echo ""

# Step 1: Check if land-grants-api is running
echo "Step 1: Checking if land-grants-api is running on http://localhost:3001..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo "✅ land-grants-api is running"
else
  echo "❌ land-grants-api is NOT running on localhost:3001"
  echo ""
  echo "Please start land-grants-api first:"
  echo "  cd /Users/nitinmali/workspace/farming/land-grants-api"
  echo "  npm run dev"
  echo ""
  exit 1
fi

echo ""
echo "Step 2: Testing GET /case-management-adapter/application/validation-run/{id}..."

# Test with a real ID (you'll need to use an actual ID from your database)
VALIDATION_RUN_ID=1
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3001/case-management-adapter/application/validation-run/${VALIDATION_RUN_ID})
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ GET endpoint returned 200"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" == "404" ]; then
  echo "⚠️  GET endpoint returned 404 (validation run not found)"
  echo "Try a different validation run ID"
else
  echo "❌ GET endpoint returned $HTTP_CODE"
  echo "$BODY"
fi

echo ""
echo "Step 3: Testing POST /case-management-adapter/application/validation-run/rerun..."

# Test rerun (you'll need to use an actual validation run ID)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  http://localhost:3001/case-management-adapter/application/validation-run/rerun \
  -H "Content-Type: application/json" \
  -d "{\"id\": ${VALIDATION_RUN_ID}, \"requesterUsername\": \"CASEWORKING_SYSTEM\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ POST endpoint returned 200"
  echo "Response: $BODY" | jq '.' 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" == "404" ]; then
  echo "⚠️  POST endpoint returned 404 (validation run not found)"
  echo "Try a different validation run ID"
elif [ "$HTTP_CODE" == "400" ]; then
  echo "⚠️  POST endpoint returned 400 (validation error)"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "❌ POST endpoint returned $HTTP_CODE"
  echo "$BODY"
fi

echo ""
echo "Step 4: Running consumer pact test..."
npm run test:contract -- test/contract/consumer.land-grants-api.test.js

echo ""
echo "=== All Done! ==="
echo ""
echo "✅ Consumer pact test passed"
echo "✅ Pact file generated at: tmp/pacts/fg-cw-backend-land-grants-api.json"
echo ""
echo "To view the pact file:"
echo "  cat tmp/pacts/fg-cw-backend-land-grants-api.json | jq ."
