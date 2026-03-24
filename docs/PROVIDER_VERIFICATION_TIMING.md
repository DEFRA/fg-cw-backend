# Provider Verification Timing and Warning Indicators

## Overview

This document explains why you may see yellow warning triangles (⚠️) in the Pact Broker for provider verification status, and why this is **expected behavior** rather than a problem.

## Quick Summary

**The yellow warnings are normal and expected** when:

- A consumer publishes a new pact version to the broker
- The provider hasn't pushed to main yet to verify the new version

**The warnings will resolve automatically** when the provider's next push to main triggers CI, which downloads and verifies the latest pact.

---

## How Provider Verification Works in CI

### CI Workflow Steps

Both `fg-cw-backend` and `fg-gas-backend` follow this pattern in their `publish.yml` workflows:

```yaml
1. Download message pacts from broker
├─ Downloads LATEST pact from broker to tmp/pacts/
└─ curl -u "${PACT_USER}:${PACT_PASS}" "${BROKER_URL}/pacts/provider/{provider}/consumer/{consumer}/latest"

2. Run message provider tests (local mode)
├─ PACT_USE_LOCAL="true" PACT_LOCAL_DIR="tmp/pacts"
├─ Runs vitest against downloaded pact files
└─ Verifies production code generates messages matching consumer expectations

3. Publish verification results to broker
├─ Extracts verification URL from pact HAL links
├─ Posts success/failure status via REST API
└─ Records provider version (git tag) that was verified
```

### Why Local Mode?

**Design Decision**: Provider tests run in "local mode" (against downloaded pact files) rather than fetching directly from the broker because:

1. **MessageProviderPact limitation**: Unlike HTTP provider verification, `MessageProviderPact.verify()` has no built-in broker integration
2. **Explicit control**: We can inspect, log, and validate downloaded pacts before verification
3. **Reliability**: Download failures are visible and debuggable
4. **Manual verification publishing**: We control exactly when and how results are published

---

## Understanding Verification Timing

### Scenario: Normal Development Flow

**Day 1 (March 3)**

```
CW pushes to main (v1.104.0)
├─ Publishes consumer pacts: "fg-cw-backend -> fg-gas-backend" (v1.104.0)
├─ Runs provider tests: Verifies "fg-gas-backend -> fg-cw-backend" (v1.103.0)
└─ Broker status: ✅ All green
```

**Day 2 (March 4)**

```
GAS pushes to main (v1.58.0)
├─ Publishes NEW consumer pact: "fg-gas-backend -> fg-cw-backend" (v1.58.0)
├─ Runs provider tests: Verifies "fg-cw-backend -> fg-gas-backend" (v1.104.0)
└─ Broker status:
    ├─ "fg-gas-backend -> fg-cw-backend": ✅ Green (just verified)
    └─ "fg-cw-backend -> fg-gas-backend": ⚠️ Yellow warning
```

**Why the warning?**

The broker compares:

- **Latest consumer pact**: fg-gas-backend v1.58.0 (published Day 2)
- **Latest provider verification**: fg-cw-backend last verified v1.103.0 (Day 1)

Result: ⚠️ **Warning** - Provider hasn't verified the latest consumer pact version yet.

**Day 3 (Next CW push)**

```
CW pushes to main (v1.105.0)
├─ Downloads latest GAS pact (v1.58.0)
├─ Runs provider tests: Verifies against v1.58.0 ✅
└─ Broker status: ✅ All green again
```

---

## Real Example from CI Logs

### CW Provider Verification (March 3, 07:39 UTC)

```bash
Run npx vitest test/contract/provider.gas-backend.test.js
✓ Verification successful

Publishing verification results for tmp/pacts/fg-gas-backend-fg-cw-backend.json
Posting to: .../pact-version/170d33372d3211073289dff4145b5a5a31fe32d8/...
HTTP 201 Created

Response:
{
  "providerName": "fg-cw-backend",
  "providerApplicationVersion": "1.104.0",
  "success": true,
  "verificationDate": "2026-03-03T07:39:15+00:00",
  "verificationResult": "2186 for Pact between fg-gas-backend (1.103.0) and fg-cw-backend"
}
```

**Key points**:

- ✅ Tests passed
- ✅ Verified against GAS consumer pact v1.103.0
- ✅ Published successfully to broker

### GAS Provider Verification (March 4, 10:40 UTC)

```bash
Run npx vitest test/contract/provider.cw-backend.test.js
✓ test/contract/provider.cw-backend.test.js (4 tests) 170ms
✓ Verification successful

Publishing verification results for tmp/pacts/fg-cw-backend-fg-gas-backend.json
HTTP 201 Created

Response:
{
  "providerName": "fg-gas-backend",
  "providerApplicationVersion": "1.58.0",
  "success": true,
  "verificationDate": "2026-03-04T10:40:28+00:00",
  "verificationResult": "2204 for Pact between fg-cw-backend (1.104.0) and fg-gas-backend"
}
```

**Key points**:

- ✅ All 4 tests passed
- ✅ Verified against CW consumer pact v1.104.0
- ✅ Published successfully to broker
- ⚠️ **But**: GAS also published a NEW consumer pact (v1.58.0) that CW hasn't verified yet

### Result in Broker

```
Consumer              Provider           Last verified    Status
------------------------------------------------------------------
fg-gas-backend    →   fg-cw-backend      1 day ago        ⚠️ Yellow
  (Latest: v1.58.0, Last verified: v1.103.0 by CW on March 3)

fg-cw-backend     →   fg-gas-backend     1 day ago        ✅ Green
  (Latest: v1.104.0, Verified by GAS on March 4)
```

---

## What the Warning Means

### ⚠️ Yellow Warning Triangle

**Message**: "Provider verification is out of date"

**Meaning**:

- The consumer has published a new pact version
- The provider has NOT yet verified this new version
- The last verification was against an older pact version

**This is NOT an error** - it's an **informational alert** that:

1. A new consumer version exists
2. Provider verification is pending
3. Will be resolved on the provider's next main push

### ✅ Green Checkmark

**Meaning**:

- Provider has verified the latest consumer pact version
- Verification is up-to-date
- Integration is confirmed working

---

## When Warnings Are Expected

### Normal Scenarios (No Action Required)

1. **After consumer pushes to main**
   - Consumer publishes new pact
   - Provider hasn't pushed yet
   - Warning appears until provider's next push
   - **Expected duration**: Hours to days (depends on development cadence)

2. **During active development**
   - Team A is actively developing (frequent pushes)
   - Team B is less active
   - Warnings may appear intermittently
   - **Resolution**: Automatic on next Team B push

3. **Weekend/Holiday periods**
   - One team pushes Friday afternoon
   - Other team won't push until Monday
   - Warning persists over weekend
   - **Resolution**: Automatic Monday morning

### Concerning Scenarios (Investigation Required)

1. **Warning persists for >1 week**
   - Indicates one team is inactive or blocked
   - May need team coordination
   - Check: Are both teams aware of contract changes?

2. **Warning with actual test failures**
   - Provider verification tests are failing
   - CI logs show test errors
   - **Action required**: Fix breaking changes immediately

3. **No verification results at all**
   - Provider hasn't verified ever
   - Provider tests not running in CI
   - **Action required**: Check CI configuration

---

## Troubleshooting

### Check CI Logs

**For GAS (provider for CW)**:

```bash
GitHub Actions → fg-gas-backend → Publish workflow
└─ Step: "Run message provider tests (local mode)"
    ├─ Should show: ✓ test/contract/provider.cw-backend.test.js
    └─ Should show: "Verification successful"
```

**For CW (provider for GAS)**:

```bash
GitHub Actions → fg-cw-backend → Publish workflow
└─ Step: "Run message provider tests (local mode)"
    ├─ Should show: ✓ test/contract/provider.gas-backend.test.js
    └─ Should show: "Verification successful"
```

### Manual Verification (Local Testing)

If you want to verify without waiting for main push:

**In fg-cw-backend**:

```bash
export PACT_USER="pactuser01"
export PACT_PASS="<password>"
./test-publish-verification.sh
```

**In fg-gas-backend**:

```bash
export PACT_USER="pactuser01"
export PACT_PASS="<password>"
./test-publish-verification.sh
```

These scripts will:

1. Download latest pacts from broker
2. Run provider verification tests
3. Publish results to broker
4. Update "Last verified" timestamp

### Check Pact Versions

**View consumer version that needs verification**:

```bash
# For CW as provider
curl -u "${PACT_USER}:${PACT_PASS}" \
  "https://ffc-pact-broker.azure.defra.cloud/pacts/provider/fg-cw-backend/consumer/fg-gas-backend/latest" \
  | jq '{consumer: .consumer.name, version: ._embedded.version[0].number}'

# For GAS as provider
curl -u "${PACT_USER}:${PACT_PASS}" \
  "https://ffc-pact-broker.azure.defra.cloud/pacts/provider/fg-gas-backend/consumer/fg-cw-backend/latest" \
  | jq '{consumer: .consumer.name, version: ._embedded.version[0].number}'
```

---

## CI Configuration Details

### Download Step

**fg-cw-backend** downloads GAS consumer pact:

```yaml
- name: Download message pacts from broker
  env:
    PACT_BROKER_BASE_URL: https://ffc-pact-broker.azure.defra.cloud
  run: |
    mkdir -p tmp/pacts
    curl -u "${PACT_USER}:${PACT_PASS}" \
      "${PACT_BROKER_BASE_URL}/pacts/provider/fg-cw-backend/consumer/fg-gas-backend/latest" \
      -o tmp/pacts/fg-gas-backend-fg-cw-backend.json
```

**fg-gas-backend** downloads CW consumer pact:

```yaml
- name: Download message pacts from broker (CW)
  run: |
    mkdir -p tmp/pacts
    curl -u "${PACT_USER}:${PACT_PASS}" \
      "${PACT_BROKER_BASE_URL}/pacts/provider/fg-gas-backend/consumer/fg-cw-backend/latest" \
      -o tmp/pacts/fg-cw-backend-fg-gas-backend.json
```

### Verification Step

```yaml
- name: Run message provider tests (local mode)
  env:
    PACT_USE_LOCAL: "true"
    PACT_LOCAL_DIR: "tmp/pacts"
  run: |
    npx vitest --config test/contract/vitest.config.js test/contract/provider.*.test.js
```

**Important**: `PACT_USE_LOCAL="true"` tells `messageVerifierConfig.js` to use local pact files instead of attempting broker fetch.

### Publishing Step

```yaml
- name: Publish message provider verification results to broker
  run: |
    PROVIDER_VERSION=$(git describe --tags --abbrev=0 --always)
    for pact_file in tmp/pacts/*-{provider-name}*.json; do
      VERIFICATION_URL=$(jq -r '._links."pb:publish-verification-results".href' "$pact_file")

      VERIFICATION_RESULT=$(cat <<EOF
    {
      "success": true,
      "providerApplicationVersion": "${PROVIDER_VERSION}",
      "testResults": [{
        "testDescription": "Message provider verification",
        "success": true
      }]
    }
    EOF
    )

      curl -X POST \
        -u "${PACT_USER}:${PACT_PASS}" \
        -H "Content-Type: application/json" \
        -d "${VERIFICATION_RESULT}" \
        "$VERIFICATION_URL"
    done
```

**Note**: Currently hardcoded `"success": true`. Future improvement: capture actual test exit code.

---

## Best Practices

### For Development Teams

1. **Don't worry about temporary warnings**
   - Warnings lasting <3 days are normal
   - They resolve automatically on next push

2. **Check broker before merging breaking changes**
   - Ensure consumers have updated their contracts
   - Coordinate major changes with other teams

3. **Monitor for persistent warnings**
   - Set up alerts for warnings >1 week old
   - Indicates need for team coordination

### For DevOps/Platform Teams

1. **Expect warnings in normal workflow**
   - Don't create alerts for warnings <72 hours
   - Focus on test failures, not timing gaps

2. **Monitor verification frequency**
   - Both repos should verify at least weekly
   - Long gaps indicate CI problems or inactive development

3. **Document credential management**
   - `PACT_USER` and `PACT_PASS` must be in GitHub secrets
   - Both repos need valid credentials

---

## Related Documentation

- [Contract Testing Guide](./CONTRACT_TESTING_GUIDE.md) - Comprehensive contract testing overview
- [Message Pact Verification](../fg-gas-backend/docs/MESSAGE_PACT_VERIFICATION.md) - Technical implementation details
- [Pact Broker Documentation](https://docs.pact.io/pact_broker) - Official Pact Broker docs
- [Provider Verification Results](https://docs.pact.io/pact_broker/advanced_topics/provider_verification_results) - Understanding verification status

---

## FAQ

### Q: The warning has been there for 2 days. Is something broken?

**A**: No, this is normal. The warning will clear when the provider's next push to main triggers CI. If it persists >1 week, check if the provider team is actively developing.

### Q: Can I manually clear the warning without pushing to main?

**A**: Yes, run the `./test-publish-verification.sh` script locally with credentials. However, the warning will return if a newer consumer pact is published before the provider's next main push.

### Q: Why don't we auto-trigger provider verification when consumers publish?

**A**:

1. Each provider push already verifies the latest consumer pact
2. Adding automatic cross-repo triggers adds complexity
3. The warning system already alerts teams to gaps
4. Current approach is simpler and sufficient

### Q: Should provider tests run on pull requests?

**A**: Currently they only run on main pushes. Running on PRs would:

- ✅ Catch breaking changes earlier
- ❌ Require VPN access from GitHub runners
- ❌ Add ~2-3 minutes to PR checks

This is a team decision based on your PR velocity and risk tolerance.

### Q: What if the provider test actually fails?

**A**: Currently, the workflow hardcodes `"success": true` in the published result. This is a known limitation. The CI build will fail (due to test exit code), but the broker may show green. **Recommendation**: Capture actual test exit code and publish real success/failure status.

---

**Document Version**: 1.0
**Last Updated**: 2026-03-05
**Maintainer**: fg-cw-backend team
**Applies To**: Both fg-cw-backend and fg-gas-backend repositories
