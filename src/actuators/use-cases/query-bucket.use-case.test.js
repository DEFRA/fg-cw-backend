import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditedRead } from "../../common/audited-read.js";
import { prepareQuery, runQuery } from "../../common/buckets/engine.js";
import { refuse } from "../../common/buckets/refusal.js";
import { findBucket } from "../../common/buckets/registry.js";
import { config } from "../../common/config.js";
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
  field: null,
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
    prepareQuery.mockResolvedValue(QUERY);
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
    expect(prepareQuery).toHaveBeenCalledWith(bucket, BODY);
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
    prepareQuery.mockRejectedValue(refuse("UNKNOWN_FACT"));

    await expect(ask("cw.cases")).rejects.toThrow(reasonOf("UNKNOWN_FACT"));
    expect(audit.reads).toBe(0);
    expect(runQuery).not.toHaveBeenCalled();
  });

  it("refuses UNKNOWN_BUCKET for an id nobody registered", async () => {
    findBucket.mockReturnValue(undefined);

    await expect(ask("cw.nothing")).rejects.toThrow(reasonOf("UNKNOWN_BUCKET"));
    expect(prepareQuery).not.toHaveBeenCalled();
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

  const digest = (text) =>
    createHmac("sha256", "an-invented-search-audit-key-0001")
      .update(text)
      .digest("hex");

  afterEach(() => {
    config.set("search.auditKey", null);
  });

  it("records what was asked, for whom, and how it was read", () => {
    expect(queryBucketAuditBuilder(args, RESULT)).toEqual({
      entities: [
        { entity: "BUCKET", action: "QUERY_BUCKET", entityid: "cw.cases" },
      ],
      details: {
        security: { actor: OPERATOR },
        caller: "fg-gas-backend",
        actor: OPERATOR_NAME,
        actorId: OPERATOR_ID,
        facts: ["workflowCode"],
        refKind: "ref",
        field: null,
        match: null,
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

  it("records a field search's key and match, and a keyed digest of its value", () => {
    config.set("search.auditKey", "an-invented-search-audit-key-0001");
    const query = {
      ...QUERY,
      ref: null,
      refKind: null,
      field: { key: "businessName", match: "prefix", value: "hilltop" },
    };

    const event = queryBucketAuditBuilder({ ...args, query }, RESULT);

    expect(event.details).toMatchObject({
      refKind: null,
      field: "businessName",
      match: "prefix",
      valueDigest: digest("businessName:hilltop"),
    });
    expect(JSON.stringify(event)).not.toContain("hilltop");
  });

  it("digests a searched ref as kind:value", () => {
    config.set("search.auditKey", "an-invented-search-audit-key-0001");

    expect(queryBucketAuditBuilder(args, RESULT).details.valueDigest).toBe(
      digest("ref:abc-123"),
    );
  });

  it("writes no digest without a key, or with nothing searched", () => {
    expect(queryBucketAuditBuilder(args, RESULT).details).not.toHaveProperty(
      "valueDigest",
    );

    config.set("search.auditKey", "an-invented-search-audit-key-0001");
    const { details } = queryBucketAuditBuilder(
      { ...args, query: { ...QUERY, ref: null, refKind: null } },
      RESULT,
    );

    expect(details).not.toHaveProperty("valueDigest");
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
