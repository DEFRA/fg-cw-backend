import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../../common/config.js";
import { logger } from "../../../common/logger.js";
import { findByClient, upsertForClient } from "./access-token.repository.js";
import { parseTokenHash, seedAccessToken } from "./seed-access-token.js";

vi.mock("./access-token.repository.js", () => ({
  findByClient: vi.fn(),
  upsertForClient: vi.fn(),
}));

vi.mock("../../../common/config.js", () => ({ config: { get: vi.fn() } }));

vi.mock("../../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const hash = "a".repeat(64);

describe("parseTokenHash", () => {
  it("parses a client:hash pair", () => {
    expect(parseTokenHash(`fg-gas-backend:${hash}`)).toEqual({
      client: "fg-gas-backend",
      id: hash,
    });
  });

  it("tolerates surrounding whitespace and upper case", () => {
    expect(parseTokenHash(`  FG-GAS-BACKEND:${hash.toUpperCase()}  `)).toEqual({
      client: "fg-gas-backend",
      id: hash,
    });
  });

  it.each([undefined, "", "   "])("treats %o as nothing to seed", (value) => {
    expect(parseTokenHash(value)).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([
    ["no hash", "fg-gas-backend"],
    ["empty hash", "fg-gas-backend:"],
    ["short hash", `fg-gas-backend:${"a".repeat(63)}`],
    ["long hash", `fg-gas-backend:${"a".repeat(65)}`],
    ["non-hex hash", `fg-gas-backend:${"z".repeat(64)}`],
    ["extra colon", `fg-gas-backend:${hash}:extra`],
    ["no client", `:${hash}`],
  ])("rejects a value with %s rather than seeding junk", (_, value) => {
    expect(parseTokenHash(value)).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("seedAccessToken", () => {
  beforeEach(() => {
    upsertForClient.mockResolvedValue({ modifiedCount: 0 });
    config.get.mockReturnValue(`fg-gas-backend:${hash}`);
  });

  it("upserts the configured client's token", async () => {
    await seedAccessToken();

    expect(upsertForClient).toHaveBeenCalledWith({
      client: "fg-gas-backend",
      id: hash,
    });
    expect(logger.info).toHaveBeenCalledWith(
      "Seeded access token for fg-gas-backend",
    );
  });

  it("reports a rotation when an existing record was replaced", async () => {
    upsertForClient.mockResolvedValue({ modifiedCount: 1 });

    await seedAccessToken();

    expect(logger.info).toHaveBeenCalledWith(
      "Seeded access token for fg-gas-backend, replacing the previous one",
    );
  });

  it("warns and writes nothing when the pair is malformed", async () => {
    config.get.mockReturnValue("not-a-pair");

    await seedAccessToken();

    expect(upsertForClient).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "SERVICE_ACCESS_TOKEN_HASH is not a client:sha256hex pair - nothing seeded",
    );
  });

  it("stays silent when no pair is configured", async () => {
    config.get.mockReturnValue("");

    await seedAccessToken();

    expect(upsertForClient).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs the full error and continues when the write fails", async () => {
    const failure = new Error("boom");
    upsertForClient.mockRejectedValue(failure);

    await expect(seedAccessToken()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure }),
      "Failed to seed access token for fg-gas-backend",
    );
  });

  describe("on a duplicate-key error", () => {
    beforeEach(() => {
      upsertForClient.mockRejectedValue(
        Object.assign(new Error("E11000 duplicate key"), { code: 11000 }),
      );
    });

    it("is benign when another instance already wrote the same token", async () => {
      findByClient.mockResolvedValue({ client: "fg-gas-backend", id: hash });

      await seedAccessToken();

      expect(findByClient).toHaveBeenCalledWith("fg-gas-backend");
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "Access token for fg-gas-backend was already seeded by another instance",
      );
    });

    it("is a failure when the stored token differs from the configured one", async () => {
      findByClient.mockResolvedValue({
        client: "fg-gas-backend",
        id: "b".repeat(64),
      });

      await seedAccessToken();

      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to seed access token for fg-gas-backend - the credential conflicts with an existing record",
      );
    });

    it("is a failure when the conflicting record cannot be read back", async () => {
      findByClient.mockRejectedValue(new Error("primary unavailable"));

      await expect(seedAccessToken()).resolves.toBeUndefined();
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to seed access token for fg-gas-backend - the credential conflicts with an existing record",
      );
    });
  });
});
