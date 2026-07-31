import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { getTraceId } from "@defra/hapi-tracing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Outbox } from "../cases/models/outbox.js";
import { insertMany } from "../cases/repositories/outbox.repository.js";
import { auditStatus } from "./audit-constants.js";
import { getRequestContext } from "./request-context.js";
import {
  buildPayload,
  stripNulls,
  writeAuditEvent,
} from "./write-audit-event.js";

vi.mock("@defra/hapi-tracing", () => ({
  getTraceId: vi.fn(),
}));

vi.mock("./config.js", () => ({
  config: {
    get: vi.fn((key) => {
      const configMap = {
        serviceVersion: "1.0.0",
        serviceName: "fg-cw-backend",
        cdpEnvironment: "test",
        "aws.sns.auditTopicArn": "arn:aws:sns:eu-west-2:123:audit-topic",
      };
      return configMap[key];
    }),
  },
}));

vi.mock("./logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock("./request-context.js", () => ({
  getRequestContext: vi.fn(),
}));

vi.mock("../cases/models/outbox.js", () => ({
  Outbox: vi.fn(),
}));

vi.mock("../cases/repositories/outbox.repository.js", () => ({
  insertMany: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getTraceId.mockReturnValue("trace-id-123");
  getRequestContext.mockReturnValue({ ip: "1.2.3.4" });
  Outbox.mockImplementation(function (data) {
    Object.assign(this, data);
  });
  insertMany.mockResolvedValue(undefined);
});

describe("buildPayload", () => {
  it("includes service metadata from config", () => {
    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
    });

    expect(result).toMatchObject({
      version: "1.0.0",
      application: "Case Working Service",
      component: "fg-cw-backend",
      environment: "test",
    });
  });

  it("uses correlationid from getTraceId when available", () => {
    getTraceId.mockReturnValue("my-trace-id");

    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
    });

    expect(result.correlationid).toBe("my-trace-id");
  });

  it("falls back to a uuid for correlationid when getTraceId returns null", () => {
    getTraceId.mockReturnValue(null);

    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
    });

    expect(result.correlationid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("uses ip from request context when present", () => {
    getRequestContext.mockReturnValue({ ip: "10.0.0.1" });

    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
    });

    expect(result.ip).toBe("10.0.0.1");
  });

  it("defaults ip to 0.0.0.0 when request context has no ip", () => {
    getRequestContext.mockReturnValue(null);

    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
    });

    expect(result.ip).toBe("0.0.0.0");
  });

  it("includes entities, accounts, status and details under audit", () => {
    const result = buildPayload({
      entities: [{ entity: "USER", action: "LOGIN", entityid: "user-1" }],
      accounts: { sbi: "sbi-1" },
      status: auditStatus.SUCCESS,
      details: { name: "Bob Bill" },
    });

    expect(result.audit).toEqual({
      entities: [{ entity: "USER", action: "LOGIN", entityid: "user-1" }],
      accounts: { sbi: "sbi-1" },
      status: auditStatus.SUCCESS,
      details: { name: "Bob Bill" },
    });
  });

  it("includes security as a top-level field, sibling to audit", () => {
    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
      security: { pmccode: "TBC" },
    });

    expect(result.security).toEqual({ pmccode: "TBC" });
  });

  it("includes a datetime ISO string", () => {
    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
    });

    expect(result.datetime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );
  });
});

describe("stripNulls", () => {
  it("removes null and undefined entries, including nested objects", () => {
    const result = stripNulls({
      a: "keep",
      b: null,
      c: undefined,
      d: { e: null, f: "keep" },
    });

    expect(result).toEqual({ a: "keep", d: { f: "keep" } });
  });
});

describe("writeAuditEvent", () => {
  const eventData = {
    entities: [{ entity: "USER", action: "LOGIN", entityid: "user-1" }],
    accounts: undefined,
    details: { name: "Bob Bill" },
    status: auditStatus.SUCCESS,
  };

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it("inserts an outbox entry on a valid payload", async () => {
    const session = {};

    await writeAuditEvent(eventData, session);

    expect(insertMany).toHaveBeenCalledOnce();
    expect(insertMany).toHaveBeenCalledWith([expect.any(Object)], session);
  });

  it("constructs Outbox with event, target arn and segregationRef", async () => {
    await writeAuditEvent(eventData, {});

    expect(Outbox).toHaveBeenCalledWith({
      event: expect.objectContaining({ application: "Case Working Service" }),
      target: "arn:aws:sns:eu-west-2:123:audit-topic",
      segregationRef: expect.stringMatching(uuidPattern),
    });
  });

  it("publishes an event that satisfies the audit schema", async () => {
    await writeAuditEvent({ ...eventData, security: { pmccode: "0701" } }, {});

    const [{ event }] = Outbox.mock.calls[0];
    const { valid, errors } = validateAuditEvent(event);

    expect(errors).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("keeps messageGroupId out of the published event payload", async () => {
    await writeAuditEvent(eventData, {});

    const [{ event }] = Outbox.mock.calls[0];
    expect(event).not.toHaveProperty("messageGroupId");
  });

  it("uses the caller-supplied segregationRef without publishing it", async () => {
    await writeAuditEvent({ ...eventData, segregationRef: "login-idp-1" }, {});

    const [{ segregationRef, event }] = Outbox.mock.calls[0];
    expect(segregationRef).toBe("login-idp-1");
    expect(event).not.toHaveProperty("segregationRef");
  });

  it("groups repeat events from the same caller under one segregationRef", async () => {
    const grouped = { ...eventData, segregationRef: "login-idp-1" };

    await writeAuditEvent(grouped, {});
    await writeAuditEvent(grouped, {});

    const [{ segregationRef: first }] = Outbox.mock.calls[0];
    const [{ segregationRef: second }] = Outbox.mock.calls[1];

    expect(first).toBe(second);
  });

  it("falls back to a unique uuid segregationRef when the caller provides none", async () => {
    await writeAuditEvent(eventData, {});
    await writeAuditEvent(eventData, {});

    const [{ segregationRef: first }] = Outbox.mock.calls[0];
    const [{ segregationRef: second }] = Outbox.mock.calls[1];

    expect(first).toMatch(uuidPattern);
    expect(second).toMatch(uuidPattern);
    expect(first).not.toBe(second);
  });

  it("nests details under audit in the outbox event", async () => {
    await writeAuditEvent(eventData, {});

    expect(Outbox).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          audit: expect.objectContaining({
            details: { name: "Bob Bill" },
          }),
        }),
      }),
    );

    const [{ event }] = Outbox.mock.calls[0];
    expect(event.details).toBeUndefined();
  });

  it("strips nulls from within details before writing", async () => {
    await writeAuditEvent(
      { ...eventData, details: { name: "Bob Bill", note: null } },
      {},
    );

    expect(Outbox).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          audit: expect.objectContaining({
            details: { name: "Bob Bill" },
          }),
        }),
      }),
    );
  });

  it("includes security as a top-level field in the outbox event", async () => {
    await writeAuditEvent({ ...eventData, security: { pmccode: "TBC" } }, {});

    expect(Outbox).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          security: { pmccode: "TBC" },
        }),
      }),
    );
  });

  it("omits security from the outbox event when not provided", async () => {
    await writeAuditEvent(eventData, {});

    expect(Outbox).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.not.objectContaining({ security: expect.anything() }),
      }),
    );
  });

  it("skips insertMany when payload fails validation", async () => {
    await writeAuditEvent({ ...eventData, entities: "not-an-array" }, {});

    expect(insertMany).not.toHaveBeenCalled();
  });

  it("reads request context via getRequestContext", async () => {
    getRequestContext.mockReturnValue({ ip: "1.2.3.4" });

    await writeAuditEvent(eventData, {});

    expect(getRequestContext).toHaveBeenCalled();
  });

  it("passes the session through to insertMany", async () => {
    const session = { id: "mongo-session" };

    await writeAuditEvent(eventData, session);

    expect(insertMany).toHaveBeenCalledWith(expect.any(Array), session);
  });
});
