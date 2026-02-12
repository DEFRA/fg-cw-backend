// test/contract/provider.gas-backend.test.js
// Provider test: Verify fg-cw-backend sends messages that match fg-gas-backend's expectations
//
// This test verifies that CaseStatusUpdatedEvent messages produced by CW
// match what GAS expects (defined in GAS's consumer.cw-backend.test.js)
//
import {
  MessageProviderPact,
  providerWithMetadata,
} from "@pact-foundation/pact";
import { describe, it, vi } from "vitest";

// Mock config before importing production code
vi.mock("../../src/common/config.js", () => ({
  config: {
    serviceName: "fg-cw-backend",
    cdpEnvironment: "test",
  },
}));

// eslint-disable-next-line import-x/first
import { CaseStatusUpdatedEvent } from "../../src/cases/events/case-status-updated.event.js";
// eslint-disable-next-line import-x/first
import { buildMessageVerifierOptions } from "./messageVerifierConfig.js";

describe("CW Provider (sends messages to GAS)", () => {
  describe("CaseStatusUpdatedEvent Provider Verification", () => {
    it("should verify CW sends messages matching GAS expectations", async () => {
      const messagePact = new MessageProviderPact({
        messageProviders: {
          "a case status updated event from CW": () => {
            // Create the actual message using production code
            const event = new CaseStatusUpdatedEvent({
              caseRef: "CASE-REF-001",
              workflowCode: "frps-private-beta",
              previousStatus: "PRE_AWARD:ASSESSMENT:IN_REVIEW",
              currentStatus: "PRE_AWARD:ASSESSMENT:WITHDRAWAL_REQUESTED",
            });

            // Return the message content that will be verified against the pact
            return providerWithMetadata(event, {
              contentType: "application/json",
            });
          },
        },
      });

      // Verify against the pact file from broker (or local if PACT_USE_LOCAL=true)
      const verifyOpts = buildMessageVerifierOptions({
        providerName: "fg-cw-backend",
        consumerName: "fg-gas-backend",
      });

      return messagePact.verify(verifyOpts);
    });
  });
});
