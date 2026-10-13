import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditedRead } from "../../common/audited-read.js";
import { parseQuery, runQuery } from "../../common/buckets/engine.js";
import { refuse } from "../../common/buckets/refusal.js";
import { findBucket } from "../../common/buckets/registry.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import {
  queryBucketAuditBuilder,
  queryBucketUseCase,
} from "./query-bucket.use-case.js";

const audit = vi.hoisted(() => ({ builder: null, reads: 0 }));

vi.mock("../../common/buckets/engine.js");
vi.mock("../../common/buckets/registry.js");
vi.mock("../../common/audited-read.js", () => ({
  auditedRead: vi.fn((read, builder) => {
    audit.builder = builder;

    return (args) => {
      audit.reads += 1;

      return read(args);
    };
  }),
}));

const OPERATOR = { id: OPERATOR_ID, name: OPERATOR_NAME };
const BODY = { where: { workflowCode: "example-workflow" }, limit: 20 };
const QUERY = {
  where: { workflowCode: "example-workflow" },
  asked: ["workflowCode"],
  ref: "ref:abc-123",
  refKind: "ref",
  from: "2026-10-08T12:00:00.000Z",
  to: "2026-10-09T12:00:00.000Z",
  cursor: null,
  plan: { kind: "exact" },
};
const RESULT = {
  bucket: "cw.cases",
  rows: [{ id: "1" }, { id: "2" }],
};

const reasonOf = (reason) =>
  expect.objectContaining({
    output: expect.objectContaining({
      payload: expect.objectContaining({ reason }),
    }),
  });

const ask = (bucketId, overrides) =>
  queryBucketUseCase({
    bucketId,
    body: BODY,
    operator: OPERATOR,
    caller: "fg-gas-backend",
    repeat: false,
    ...overrides,
  });

describe("queryBucketUseCase", () => {
  beforeEach(() => {
    audit.reads = 0;
    parseQuery.mockReturnValue(QUERY);
    runQuery.mockResolvedValue(RESULT);
  });

  it("is audited as a read that releases data", () => {
    expect(auditedRead).toBeDefined();
    expect(audit.builder).toBe(queryBucketAuditBuilder);
  });

  it("reads a bucket that is not audited without an audit", async () => {
    const bucket = { id: "cw.outbox", audited: false };
    findBucket.mockReturnValue(bucket);

    expect(await ask("cw.outbox")).toBe(RESULT);
    expect(findBucket).toHaveBeenCalledWith("cw.outbox");
    expect(parseQuery).toHaveBeenCalledWith(bucket, BODY);
    expect(runQuery).toHaveBeenCalledWith(bucket, QUERY);
    expect(audit.reads).toBe(0);
  });

  it("reads an audited bucket through the audited read", async () => {
    const bucket = { id: "cw.cases", audited: true };
    findBucket.mockReturnValue(bucket);

    expect(await ask("cw.cases")).toBe(RESULT);
    expect(runQuery).toHaveBeenCalledWith(bucket, QUERY);
    expect(audit.reads).toBe(1);
  });

  it("refuses before the read, so a refused request writes no audit", async () => {
    findBucket.mockReturnValue({ id: "cw.cases", audited: true });
    parseQuery.mockImplementation(() => {
      throw refuse("UNKNOWN_FACT");
    });

    await expect(ask("cw.cases")).rejects.toThrow(reasonOf("UNKNOWN_FACT"));
    expect(audit.reads).toBe(0);
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("refuses UNKNOWN_BUCKET for an id nobody registered", async () => {
    findBucket.mockReturnValue(undefined);

    await expect(ask("cw.nothing")).rejects.toThrow(reasonOf("UNKNOWN_BUCKET"));
    expect(parseQuery).not.toHaveBeenCalled();
  });

  it.each(["CW.Cases", "cases", "cw.cases/query", "constructor"])(
    "refuses UNKNOWN_BUCKET for the malformed id %s without a lookup",
    async (bucketId) => {
      await expect(ask(bucketId)).rejects.toThrow(reasonOf("UNKNOWN_BUCKET"));
      expect(findBucket).not.toHaveBeenCalled();
      expect(runQuery).not.toHaveBeenCalled();
    },
  );
});

describe("queryBucketAuditBuilder", () => {
  const args = {
    bucket: { id: "cw.cases" },
    query: QUERY,
    operator: OPERATOR,
    caller: "fg-gas-backend",
    repeat: false,
  };

  it("records what was asked, for whom, and how it was read", () => {
    expect(queryBucketAuditBuilder(args, RESULT)).toEqual({
      entities: [
        { entity: "BUCKET", action: "QUERY_BUCKET", entityid: "cw.cases" },
      ],
      details: {
        security: { actor: OPERATOR },
        caller: "fg-gas-backend",
        facts: ["workflowCode"],
        refKind: "ref",
        from: "2026-10-08T12:00:00.000Z",
        to: "2026-10-09T12:00:00.000Z",
        page: "first",
        plan: "exact",
        resultCount: 2,
        repeat: false,
      },
      security: { pmccode: "0706" },
      segregationRef: "admin-query-bucket",
    });
  });

  it("never records a filter value or the ref searched for", () => {
    const written = JSON.stringify(queryBucketAuditBuilder(args, RESULT));

    expect(written).not.toContain("example-workflow");
    expect(written).not.toContain("abc-123");
  });

  it("names a later page, and carries the plan of a read that failed", () => {
    const { details } = queryBucketAuditBuilder(
      {
        ...args,
        repeat: true,
        query: {
          ...QUERY,
          ref: null,
          refKind: null,
          cursor: { t: "t", i: "i" },
          plan: { kind: "bounded" },
        },
      },
      null,
    );

    expect(details).toMatchObject({
      page: "next",
      plan: "bounded",
      refKind: null,
      repeat: true,
    });
    expect(details.resultCount).toBeUndefined();
  });
});
