import { describe, expect, it } from "vitest";
import { claimSubmittedDataSchema } from "./claim-submitted-data.schema.js";
const entry = {
  gasClaimId: "507f1f77bcf86cd799439011",
  clientClaimRef: "claim-1",
  claimCode: "PA3",
  claimAmountPence: 150000,
  sbi: "113593357",
  status: "SUBMITTED",
  submittedAt: "2026-08-07T11:16:05.745Z",
};
const data = () => ({
  caseRef: "case-1",
  workflowCode: "woodland",
  claims: [{ ...entry }],
});
describe("claim submitted data", () => {
  it.each([undefined, null, {}])("rejects absent data %j", (value) => {
    expect(claimSubmittedDataSchema.validate(value).error).toBeDefined();
  });
  it("accepts zero pence and multiple distinct claims", () => {
    const value = data();
    value.claims.push({
      ...entry,
      gasClaimId: "other-id",
      claimAmountPence: 0,
    });
    expect(claimSubmittedDataSchema.validate(value).error).toBeUndefined();
  });
  it.each(Object.keys(entry))("requires claim field %s", (field) => {
    const value = data();
    delete value.claims[0][field];
    expect(claimSubmittedDataSchema.validate(value).error).toBeDefined();
  });
  it.each([
    { claimAmountPence: -1 },
    { claimAmountPence: 1.5 },
    { claimAmountPence: "150000" },
    { sbi: 113593357 },
    { status: "APPROVED" },
    { submittedAt: "bad-date" },
    { gasClaimId: " " },
  ])("rejects invalid claim %j", (fields) => {
    const value = data();
    Object.assign(value.claims[0], fields);
    expect(claimSubmittedDataSchema.validate(value).error).toBeDefined();
  });
  it.each([
    { claims: [] },
    { claims: [entry, entry] },
    { caseRef: "" },
    { workflowCode: null },
    { newStatus: "A:B:C" },
  ])("rejects invalid event %j", (fields) => {
    expect(
      claimSubmittedDataSchema.validate({ ...data(), ...fields }).error,
    ).toBeDefined();
  });
});
