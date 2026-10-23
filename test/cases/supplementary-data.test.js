import { randomUUID } from "node:crypto";
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
import { updateSupplementaryDataUseCase } from "../../src/cases/use-cases/update-supplementary-data.use-case.js";

const entry = {
  id: "record-1",
  arbitrary: { score: -100, labels: ["anything", null] },
};
const testCases = { caseRef: /^fgp-1382-/ };
const cases = db.collection("cases");
let original;
const message = (data = entry, targetNode = "results", dataType = "ARRAY") => ({
  event: {
    data: {
      caseRef: original.caseRef,
      workflowCode: original.workflowCode,
      supplementaryData: { targetNode, dataType, key: "id", data },
    },
  },
});
const find = () =>
  caseRepository.findByCaseRefAndWorkflowCode(
    original.caseRef,
    original.workflowCode,
  );
beforeAll(async () => {
  await mongoClient.connect();
});
afterAll(async () => {
  await cases.deleteMany(testCases);
  await mongoClient.close();
});
beforeEach(async () => {
  await cases.deleteMany(testCases);
  const kase = Case.createMock({
    supplementaryData: { documents: [{ id: "document-1" }] },
  });
  kase.caseRef = `fgp-1382-${randomUUID()}`;
  original = new CaseDocument(kase);
  await cases.insertOne(original);
  original = await cases.findOne({ _id: original._id });
});
describe("generic supplementary data persistence", () => {
  it("keeps ordinary case fields literal and leaves loaded supplementary data alone", async () => {
    const kase = await find();
    kase.payload = { literal: "$notAnExpression", nested: { value: "$$ROOT" } };
    await caseRepository.update(kase);
    const stored = await cases.findOne({ _id: original._id });
    expect(stored.payload).toEqual(kase.payload);
    expect(stored.supplementaryData).toEqual(original.supplementaryData);
  });
  it.each([false, true])(
    "retains received data when a stale case edit commits afterward (prior data: %s)",
    async (priorData) => {
      const initial = priorData ? [{ id: "earlier", opaque: true }] : [];
      if (priorData)
        await cases.updateOne(
          { _id: original._id },
          { $set: { "supplementaryData.results": initial } },
        );
      const stale = await find();
      await updateSupplementaryDataUseCase(message());
      stale.assignedUser = { id: "new-assignee" };
      stale.position.statusCode = "EDITED_STATUS";
      await caseRepository.update(stale);
      const stored = await cases.findOne({ _id: original._id });
      expect(stored.supplementaryData.results).toEqual([...initial, entry]);
      expect(stored).toMatchObject({
        assignedUserId: "new-assignee",
        currentStatus: "EDITED_STATUS",
      });
    },
  );
  it("preserves linked references and unknown stored fields", async () => {
    const stale = await find();
    await cases.updateOne(
      { _id: original._id },
      {
        $addToSet: { refs: "ref:linked-case" },
        $set: { storedMarker: "$literal" },
      },
    );
    await updateSupplementaryDataUseCase(message());
    stale.payload = { identifiers: { sbi: "900000101" } };
    await caseRepository.update(stale);
    const stored = await cases.findOne({ _id: original._id });
    expect(stored.refs).toEqual(
      expect.arrayContaining([
        ...original.refs,
        "ref:linked-case",
        "sbi:900000101",
      ]),
    );
    expect(new Set(stored.refs).size).toBe(stored.refs.length);
    expect(stored.supplementaryData.results).toEqual([entry]);
    expect(stored.storedMarker).toBe("$literal");
  });
  it("persists an explicit arbitrary-node edit without overwriting other nodes", async () => {
    const stale = await find();
    await updateSupplementaryDataUseCase(message());
    stale.updateSupplementaryData({
      targetNode: "documents",
      dataType: "ARRAY",
      key: "id",
      data: { id: "document-1", note: "$literal" },
    });
    await caseRepository.update(stale);
    const stored = await cases.findOne({ _id: original._id });
    expect(stored.supplementaryData).toEqual({
      results: [entry],
      documents: [{ id: "document-1", note: "$literal" }],
    });
    expect(stale.getSupplementaryDataUpdates()).toEqual({});
  });
  it("stores keyed arrays idempotently and supports multiple entries", async () => {
    await updateSupplementaryDataUseCase(message());
    await updateSupplementaryDataUseCase(message());
    expect(await cases.findOne({ _id: original._id })).toEqual({
      ...original,
      supplementaryData: { ...original.supplementaryData, results: [entry] },
    });
    await updateSupplementaryDataUseCase(message({ ...entry, id: "record-2" }));
    expect(
      (await cases.findOne({ _id: original._id })).supplementaryData.results,
    ).toHaveLength(2);
  });
  it("supports an arbitrary keyed object node", async () => {
    await updateSupplementaryDataUseCase(
      message(entry, "calculations", "OBJECT"),
    );
    expect(
      (await cases.findOne({ _id: original._id })).supplementaryData
        .calculations,
    ).toEqual({ "record-1": entry });
  });
  it("preserves a concurrent case edit made after the data handler read", async () => {
    const read = caseRepository.findByCaseRefAndWorkflowCode;
    vi.spyOn(
      caseRepository,
      "findByCaseRefAndWorkflowCode",
    ).mockImplementationOnce(async (...args) => {
      const stale = await read(...args);
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
      return stale;
    });
    await updateSupplementaryDataUseCase(message());
    expect(await cases.findOne({ _id: original._id })).toMatchObject({
      currentStatus: "NEWER_STATUS",
      assignedUserId: "new-assignee",
      phases: [],
      supplementaryData: { other: { current: true }, results: [entry] },
    });
  });
  it("does not resend an old supplementary edit when the same case is saved again", async () => {
    const kase = await find();
    kase.updateSupplementaryData({
      targetNode: "results",
      dataType: "ARRAY",
      key: "id",
      data: entry,
    });
    await caseRepository.update(kase);
    await updateSupplementaryDataUseCase(
      message({ ...entry, changedLater: true }),
    );
    kase.payload = { edited: true };
    await caseRepository.update(kase);
    expect(
      (await cases.findOne({ _id: original._id })).supplementaryData.results,
    ).toEqual([{ ...entry, changedLater: true }]);
  });
  it.each([
    ["ARRAY", false],
    ["ARRAY", true],
    ["OBJECT", false],
    ["OBJECT", true],
  ])(
    "reloads a stale %s node and retains newer entries (replay: %s)",
    async (dataType, replay) => {
      const first = { id: "first", opaque: { original: true } };
      const second = { id: "second", opaque: { newer: true } };
      if (replay)
        await updateSupplementaryDataUseCase(
          message(first, "results", dataType),
        );
      const stale = await find();
      await updateSupplementaryDataUseCase(
        message(second, "results", dataType),
      );
      vi.spyOn(
        caseRepository,
        "findByCaseRefAndWorkflowCode",
      ).mockResolvedValueOnce(stale);
      await updateSupplementaryDataUseCase(message(first, "results", dataType));
      const stored = (await cases.findOne({ _id: original._id }))
        .supplementaryData.results;
      expect(dataType === "ARRAY" ? stored : Object.values(stored)).toEqual(
        expect.arrayContaining([first, second]),
      );
      expect(
        dataType === "ARRAY" ? stored : Object.values(stored),
      ).toHaveLength(2);
    },
  );
  it.each(["ARRAY", "OBJECT"])(
    "rejects an ordinary case save with a stale %s supplementary node",
    async (dataType) => {
      const stale = await find();
      stale.updateSupplementaryData({
        targetNode: "results",
        dataType,
        key: "id",
        data: { id: "late" },
      });
      stale.payload = { edit: "must not commit on conflict" };
      await updateSupplementaryDataUseCase(
        message({ id: "newer" }, "results", dataType),
      );
      await expect(caseRepository.update(stale)).rejects.toMatchObject({
        output: { statusCode: 409 },
      });
      const stored = await cases.findOne({ _id: original._id });
      expect(stored.payload).toEqual(original.payload);
      expect(
        dataType === "ARRAY"
          ? stored.supplementaryData.results
          : Object.values(stored.supplementaryData.results),
      ).toEqual([{ id: "newer" }]);
    },
  );
  it("rejects malformed instructions before writing", async () => {
    await expect(
      updateSupplementaryDataUseCase(message({ notTheKey: true })),
    ).rejects.toThrow();
    expect(await cases.findOne({ _id: original._id })).toEqual(original);
  });
});

it("stores an object identity named __proto__ as ordinary opaque data", async () => {
  const value = { id: "__proto__", opaque: { retained: true } };
  await updateSupplementaryDataUseCase(message(value, "results", "OBJECT"));
  const stored = await cases.findOne({ _id: original._id });
  expect(Object.hasOwn(stored.supplementaryData.results, "__proto__")).toBe(
    true,
  );
  expect(
    Object.getOwnPropertyDescriptor(
      stored.supplementaryData.results,
      "__proto__",
    ).value,
  ).toEqual(value);
  expect(Object.getPrototypeOf(stored.supplementaryData.results)).toBe(
    Object.prototype,
  );
});
