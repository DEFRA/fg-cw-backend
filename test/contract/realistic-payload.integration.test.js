// Integration test to verify realistic frps-private-beta payload
// can be processed through CW's case creation logic
//
// This test addresses the "danger area" - proving that the payload structure
// defined in the pact contract can actually be processed by Case.new(),
// not just pass pact matchers.

import { describe, expect, it } from "vitest";
import { Case } from "../../src/cases/models/case.js";
import { Position } from "../../src/cases/models/position.js";
import {
  minimalFrpsPayload,
  realisticFrpsPayload,
} from "../fixtures/realistic-frps-payload.js";
import {
  minimalWmgPayload,
  realisticWmgPayload,
} from "../fixtures/realistic-wmg-payload.js";

describe("Realistic Payload Processing", () => {
  describe("frps-private-beta realistic payload", () => {
    it("should be processable into a Case object", () => {
      // Using realistic payload from shared fixture
      // This is the exact structure from the consumer pact test
      // Verify Case.new can accept this realistic payload without throwing
      expect(() => {
        const kase = Case.new({
          caseRef: "CASE-REF-001",
          workflowCode: "frps-private-beta",
          position: Position.from("PRE_AWARD:ASSESSMENT:IN_REVIEW"),
          payload: realisticFrpsPayload,
          phases: [],
        });

        // Verify the payload is stored correctly
        expect(kase.payload).toEqual(realisticFrpsPayload);
        expect(kase.payload.answers.rulesCalculations).toBeDefined();
        expect(kase.payload.answers.applicant).toBeDefined();
        expect(kase.payload.answers.application.parcel).toHaveLength(1);
        expect(kase.payload.answers.payments.parcel).toHaveLength(1);
      }).not.toThrow();
    });

    it("should handle minimal payload (without optional fields)", () => {
      // Using minimal payload from shared fixture
      expect(() => {
        const kase = Case.new({
          caseRef: "CASE-REF-002",
          workflowCode: "frps-private-beta",
          position: Position.from("PRE_AWARD:ASSESSMENT:IN_REVIEW"),
          payload: minimalFrpsPayload,
          phases: [],
        });

        expect(kase.payload).toEqual(minimalFrpsPayload);
      }).not.toThrow();
    });
  });

  describe("woodland (WMG) realistic payload", () => {
    it("should be processable into a Case object", () => {
      expect(() => {
        const kase = Case.new({
          caseRef: "WMP-CASE-001",
          workflowCode: "woodland",
          position: Position.from(
            "PHASE_PRE_AWARD:STAGE_REVIEWING_APPLICATION:STATUS_APPLICATION_RECEIVED",
          ),
          payload: realisticWmgPayload,
          phases: [],
        });

        expect(kase.payload).toEqual(realisticWmgPayload);
        expect(kase.payload.answers.businessDetailsUpToDate).toBe(true);
        expect(kase.payload.answers.totalHectaresAppliedFor).toBe(15.0);
        expect(kase.payload.answers.fcTeamCode).toBe(
          "YORKSHIRE_AND_NORTH_EAST",
        );
        expect(kase.payload.answers.existingWmps).toHaveLength(1);
      }).not.toThrow();
    });

    it("should handle minimal payload (appLandHasExistingWmp false, no existingWmps)", () => {
      expect(() => {
        const kase = Case.new({
          caseRef: "WMP-CASE-002",
          workflowCode: "woodland",
          position: Position.from(
            "PHASE_PRE_AWARD:STAGE_REVIEWING_APPLICATION:STATUS_APPLICATION_RECEIVED",
          ),
          payload: minimalWmgPayload,
          phases: [],
        });

        expect(kase.payload).toEqual(minimalWmgPayload);
        expect(kase.payload.answers.appLandHasExistingWmp).toBe(false);
        expect(kase.payload.answers.existingWmps).toBeUndefined();
      }).not.toThrow();
    });
  });
});
