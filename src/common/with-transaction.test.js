import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";
import { mongoClient } from "./mongo-client.js";
import { transactionOptions, withTransaction } from "./with-transaction.js";

vi.mock("./mongo-client.js");

describe("withTransaction", () => {
  it("should call session.withTransaction", async () => {
    const mockSession = {
      withTransaction: vi.fn().mockImplementation((cb, opts) => cb()),
      endSession: vi.fn(),
    };
    vi.spyOn(mongoClient, "startSession").mockReturnValue(mockSession);
    const transactionSpy = vi.fn().mockImplementation();

    await withTransaction(transactionSpy);

    expect(mockSession.withTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      transactionOptions,
    );
    expect(transactionSpy).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  // A use case with something to answer - a redrive answers with the updated
  // row - must not lose it to the transaction wrapper.
  it("answers with the callback's result", async () => {
    const mockSession = {
      withTransaction: vi.fn().mockImplementation((run) => run("the-session")),
      endSession: vi.fn(),
    };
    vi.spyOn(mongoClient, "startSession").mockReturnValue(mockSession);

    await expect(
      withTransaction(async (session) => ({ ok: true, session })),
    ).resolves.toEqual({ ok: true, session: "the-session" });
  });

  it("hands the driver's session to the callback", async () => {
    const mockSession = {
      withTransaction: vi.fn().mockImplementation((run) => run("the-session")),
      endSession: vi.fn(),
    };
    vi.spyOn(mongoClient, "startSession").mockReturnValue(mockSession);
    const callback = vi.fn();

    await withTransaction(callback);

    expect(callback).toHaveBeenCalledWith("the-session");
  });

  it("should handle errors", async () => {
    const mockSession = {
      withTransaction: vi.fn().mockImplementation((cb, opts) => {
        throw Boom.badRequest("bad request");
      }),
      endSession: vi.fn(),
    };
    vi.spyOn(mongoClient, "startSession").mockReturnValue(mockSession);
    const transactionSpy = vi.fn().mockImplementation();

    try {
      await withTransaction(transactionSpy);
    } catch (e) {
      expect(e.output.payload.message).toBe("bad request");
      expect(e.output.payload.statusCode).toBe(400);
    }

    expect(mockSession.withTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      transactionOptions,
    );
    expect(mockSession.endSession).toHaveBeenCalled();
  });
});
