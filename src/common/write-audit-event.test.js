import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { getTraceId } from "@defra/hapi-tracing";
import { BSON } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Outbox } from "../cases/models/outbox.js";
import { insertMany } from "../cases/repositories/outbox.repository.js";
import { auditStatus } from "./audit-constants.js";
import { getRequestContext } from "./request-context.js";
import { logger } from "./logger.js";
import {
  UNRECORDED_IP,
  buildPayload,
  normaliseIp,
  stripNulls,
  toAuditIp,
  writeAuditEvent,
} from "./write-audit-event.js";
import { OPERATOR_ID } from "../../test/helpers/operator.js";

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
  getRequestContext.mockReturnValue({ clientIp: "1.2.3.4" });
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

  it("uses the client ip from the request context when present", () => {
    getRequestContext.mockReturnValue({
      clientIp: "10.0.0.1",
      remoteAddress: "127.0.0.1",
    });

    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
    });

    expect(result.ip).toBe("10.0.0.1");
  });

  it("defaults ip to 0.0.0.0 when there is no request context", () => {
    getRequestContext.mockReturnValue(null);

    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
    });

    expect(result.ip).toBe("0.0.0.0");
  });

  it("sets user from the request context's operator", () => {
    getRequestContext.mockReturnValue({
      clientIp: "10.0.0.1",
      user: OPERATOR_ID,
    });

    const result = buildPayload({
      entities: [],
      status: auditStatus.SUCCESS,
    });

    expect(result.user).toBe(OPERATOR_ID);
  });

  it("leaves user out when no operator was set", () => {
    const result = stripNulls(
      buildPayload({ entities: [], status: auditStatus.SUCCESS }),
    );

    expect(result).not.toHaveProperty("user");
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

describe("normaliseIp", () => {
  it("leaves IPv4 unchanged", () => {
    expect(normaliseIp("203.0.113.7")).toBe("203.0.113.7");
  });

  it("turns an IPv4-mapped IPv6 address into plain IPv4", () => {
    expect(normaliseIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("compresses IPv6", () => {
    expect(normaliseIp("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(
      "2001:db8::1",
    );
  });

  it("drops an IPv6 zone id", () => {
    expect(normaliseIp("fe80::1%eth0")).toBe("fe80::1");
  });

  it("answers undefined for something that is not an IP", () => {
    expect(normaliseIp("not-an-ip")).toBeUndefined();
    expect(normaliseIp(undefined)).toBeUndefined();
  });
});

describe("toAuditIp", () => {
  const LONG_IPV6 = "2001:db8:85a3:1234:5678:8a2e:370:7334";

  it("records 0.0.0.0 for system work with no request context", () => {
    expect(toAuditIp(null)).toBe("0.0.0.0");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("prefers the normalised client ip", () => {
    expect(
      toAuditIp({ clientIp: "::ffff:203.0.113.7", remoteAddress: "127.0.0.1" }),
    ).toBe("203.0.113.7");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("compresses a short IPv6 client ip", () => {
    expect(
      toAuditIp({ clientIp: "2001:0db8::0001", remoteAddress: "127.0.0.1" }),
    ).toBe("2001:db8::1");
  });

  it("falls back to the connection address when the client ip is too long for the schema", () => {
    expect(
      toAuditIp({ clientIp: LONG_IPV6, remoteAddress: "198.51.100.4" }),
    ).toBe("198.51.100.4");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("falls back to the connection address when the client ip is not an IP", () => {
    expect(
      toAuditIp({ clientIp: "not-an-ip", remoteAddress: "198.51.100.4" }),
    ).toBe("198.51.100.4");
  });

  it("uses the connection address when no client ip was trusted", () => {
    expect(toAuditIp({ remoteAddress: "127.0.0.1" })).toBe("127.0.0.1");
  });

  it("records the unrecorded marker, never 0.0.0.0, when no address fits, with a warning", () => {
    const ip = toAuditIp({
      clientIp: LONG_IPV6,
      remoteAddress: "2001:db8:85a3:1234:5678:8a2e:370:7335",
    });

    expect(ip).toBe(UNRECORDED_IP);
    expect(ip).not.toBe("0.0.0.0");
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("produces a schema-valid ip in every case", () => {
    for (const ip of [
      toAuditIp(null),
      toAuditIp({ clientIp: LONG_IPV6, remoteAddress: LONG_IPV6 }),
      toAuditIp({ clientIp: "2001:0db8::0001" }),
    ]) {
      expect(ip.length).toBeLessThanOrEqual(20);
    }
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

  it("removes null and undefined entries from objects inside arrays", () => {
    const result = stripNulls({
      entities: [
        { entity: "USER", entityid: undefined },
        { entity: "CASE", entityid: null },
        null,
      ],
    });

    expect(result).toEqual({
      entities: [{ entity: "USER" }, { entity: "CASE" }],
    });
    expect(result.entities[0]).not.toHaveProperty("entityid");
  });

  it("leaves arrays of primitives intact", () => {
    expect(stripNulls({ idpRoles: ["a", "b"] })).toEqual({
      idpRoles: ["a", "b"],
    });
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

  it("constructs Outbox with event, target arn, segregationRef and its stamps", async () => {
    await writeAuditEvent(eventData, {});

    expect(Outbox).toHaveBeenCalledWith({
      event: expect.objectContaining({ application: "Case Working Service" }),
      target: "arn:aws:sns:eu-west-2:123:audit-topic",
      segregationRef: expect.stringMatching(uuidPattern),
      eventType: "Audit",
      refs: ["trace:trace-id-123"],
    });
  });

  it("publishes an event that satisfies the audit schema", async () => {
    await writeAuditEvent({ ...eventData, security: { pmccode: "0701" } }, {});

    const [{ event }] = Outbox.mock.calls[0];
    const { valid, errors } = validateAuditEvent(event);

    expect(errors).toBeUndefined();
    expect(valid).toBe(true);
  });

  // The driver serialises with `ignoreUndefined: false`, storing `undefined` as
  // `null`, and the audit service rejects a null entityid - so the persisted
  // event must not carry the key at all.
  it("writes no entityid key when an entity has none", async () => {
    await writeAuditEvent(
      {
        ...eventData,
        entities: [
          { entity: "USER", action: "CREATE_USER", entityid: undefined },
        ],
        security: { pmccode: "1204" },
      },
      {},
    );

    const [{ event }] = Outbox.mock.calls[0];
    const persisted = BSON.deserialize(
      BSON.serialize(event, { ignoreUndefined: false }),
    );

    expect(persisted.audit.entities).toEqual([
      { entity: "USER", action: "CREATE_USER" },
    ]);
    expect(validateAuditEvent(persisted).valid).toBe(true);
  });

  it("writes no entityid key when an entity's entityid is null", async () => {
    await writeAuditEvent(
      {
        ...eventData,
        entities: [{ entity: "USER", action: "CREATE_USER", entityid: null }],
        security: { pmccode: "1204" },
      },
      {},
    );

    const [{ event }] = Outbox.mock.calls[0];
    expect(event.audit.entities[0]).not.toHaveProperty("entityid");
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

  const invalid = () => ({ ...eventData, entities: "not-an-array" });

  it("skips insertMany when payload fails validation", async () => {
    await writeAuditEvent(invalid(), undefined);

    expect(insertMany).not.toHaveBeenCalled();
  });

  // Best-effort without a transaction: the action has already happened and
  // refusing to report it would not undo it.
  it("does not throw on an invalid payload when there is no session", async () => {
    await expect(
      writeAuditEvent(invalid(), undefined),
    ).resolves.toBeUndefined();
  });

  // Inside a transaction the same skip would let the action commit with no
  // audit event, so it aborts instead.
  it("throws on an invalid payload when a session is active", async () => {
    await expect(writeAuditEvent(invalid(), { id: "s" })).rejects.toThrow(
      "Audit event failed validation",
    );

    expect(insertMany).not.toHaveBeenCalled();
  });

  // The validation detail can quote the payload it rejected, so it stays in
  // the log and out of the error that travels back to the caller.
  it("keeps the validation detail out of the thrown error", async () => {
    const error = await writeAuditEvent(invalid(), { id: "s" }).catch((e) => e);

    expect(error.message).toBe("Audit event failed validation");
  });

  it("reads request context via getRequestContext", async () => {
    getRequestContext.mockReturnValue({ clientIp: "1.2.3.4" });

    await writeAuditEvent(eventData, {});

    expect(getRequestContext).toHaveBeenCalled();
  });

  it("passes the session through to insertMany", async () => {
    const session = { id: "mongo-session" };

    await writeAuditEvent(eventData, session);

    expect(insertMany).toHaveBeenCalledWith(expect.any(Array), session);
  });
});
