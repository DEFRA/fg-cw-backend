import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db, mongoClient } from "../../src/common/mongo-client.js";
import { Case } from "../../src/cases/models/case.js";
import { CaseDocument } from "../../src/cases/repositories/case/case-document.js";
import * as caseRepository from "../../src/cases/repositories/case.repository.js";
import { handleClaimSubmittedUseCase } from "../../src/cases/use-cases/handle-claim-submitted.use-case.js";

const entry = {
  gasClaimId: "gas-1",
  clientClaimRef: "claim-1",
  claimCode: "PA3",
  claimAmountPence: 150000,
  sbi: "113593357",
  status: "SUBMITTED",
  submittedAt: "2026-08-07T11:16:05.745Z",
};
const DATABASE = "fgp-1382-claim-ingestion-test";
const cases = db.collection("cases");
let original;
const message = (claims = [entry]) => ({
  event: {
    data: {
      caseRef: original.caseRef,
      workflowCode: original.workflowCode,
      claims,
    },
  },
});
beforeAll(async () => {
  await mongoClient.connect();
});
afterAll(async () => {
  await cases.deleteMany({ _claimDeliveryTest: DATABASE });
  await mongoClient.close();
});
beforeEach(async () => {
  await cases.deleteMany({ _claimDeliveryTest: DATABASE });
  const kase = Case.createMock();
  kase.supplementaryData = { agreements: [{ agreementRef: "agreement-1" }] };
  original = { ...new CaseDocument(kase), _claimDeliveryTest: DATABASE };
  await cases.insertOne(original);
  original = await cases.findOne({ _id: original._id });
});

describe("claim data ingestion into MongoDB", () => {
  it("persists claims idempotently without altering the remaining case document", async () => {
    await handleClaimSubmittedUseCase(message());
    await handleClaimSubmittedUseCase(message());
    const stored = await cases.findOne({ _id: original._id });
    expect(stored).toEqual({
      ...original,
      supplementaryData: { ...original.supplementaryData, claims: [entry] },
    });
    await handleClaimSubmittedUseCase(
      message([{ ...entry, gasClaimId: "gas-2" }]),
    );
    expect(
      (await cases.findOne({ _id: original._id })).supplementaryData.claims,
    ).toHaveLength(2);
  });
  it("preserves a concurrent edit made after the case was read", async () => {
    const read = caseRepository.findByCaseRefAndWorkflowCode;
    vi.spyOn(
      caseRepository,
      "findByCaseRefAndWorkflowCode",
    ).mockImplementationOnce(async (...args) => {
      const staleCase = await read(...args);
      await cases.updateOne(
        { _id: original._id },
        {
          $set: {
            currentStatus: "NEWER_STATUS",
            assignedUserId: "new-assignee",
            phases: [],
            "supplementaryData.other": { current: true },
          },
        },
      );
      return staleCase;
    });
    await handleClaimSubmittedUseCase(message());
    const stored = await cases.findOne({ _id: original._id });
    expect(stored).toMatchObject({
      currentStatus: "NEWER_STATUS",
      assignedUserId: "new-assignee",
      phases: [],
      supplementaryData: { other: { current: true }, claims: [entry] },
    });
  });
  it("rejects a malformed batch before storing any entry", async () => {
    await expect(
      handleClaimSubmittedUseCase(
        message([
          entry,
          { ...entry, gasClaimId: "gas-2", claimAmountPence: -1 },
        ]),
      ),
    ).rejects.toThrow();
    expect(await cases.findOne({ _id: original._id })).toEqual(original);
  });
});
