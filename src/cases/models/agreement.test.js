import { describe, expect, it } from "vitest";
import { Agreement, AgreementHistoryEntry, toAgreements } from "./agreement.js";

describe("Agreement", () => {
  it("should create an agreement", () => {
    const agreement = Agreement.new({
      agreementRef: "ref-1",
      date: new Date().toISOString(),
    });
    expect(agreement).toBeInstanceOf(Agreement);
  });

  it("should add a history item", () => {
    const agreement = Agreement.new({
      agreementRef: "ref-1",
      date: new Date().toISOString(),
    });
    agreement.addHistoryEntry({
      agreementStatus: "WITHDRAWN",
      createdAt: new Date().toISOString(),
    });
    expect(agreement.latestStatus).toBe("WITHDRAWN");
    expect(agreement.history[0].agreementStatus).toBe("OFFERED");
    expect(agreement.history[1]).toBeInstanceOf(AgreementHistoryEntry);
  });

  it("should create agreement data", () => {
    const data = {
      "ref-1": {
        latestStatus: "OFFERED",
        updatedAt: "20250910",
        history: [
          {
            agreementStatus: "OFFERED",
            createdAt: new Date().toISOString(),
          },
        ],
      },
      "ref-2": {
        latestStatus: "ACCEPTED",
        updatedAt: "20250910",
        history: [
          {
            agreementStatus: "OFFERED",
            createdAt: new Date().toISOString(),
          },
          {
            agreementStatus: "ACCEPTED",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    };
    const agreements = toAgreements(data);
    expect(agreements["ref-1"]).toBeInstanceOf(Agreement);
    expect(agreements["ref-2"]).toBeInstanceOf(Agreement);
    expect(agreements["ref-2"].history[0].agreementStatus).toBe(
      data["ref-2"].history[0].agreementStatus,
    );
  });
});
