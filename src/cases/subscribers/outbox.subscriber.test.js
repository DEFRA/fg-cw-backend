import { AsyncLocalStorage } from "node:async_hooks";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { logger } from "../../common/logger.js";
import { publish } from "../../common/sns-client.js";
import { Outbox } from "../models/outbox.js";
import {
  freeFifoLock,
  getFifoLocks,
  setFifoLock,
} from "../repositories/fifo-lock.repository.js";
import {
  claimEvents,
  findNextMessage,
  update,
  updateDeadEvents,
  updateExpiredEvents,
  updateFailedEvents,
  updateResubmittedEvents,
} from "../repositories/outbox.repository.js";
import { OutboxSubscriber } from "./outbox.subscriber.js";

vi.mock("../../common/sns-client.js");
vi.mock("../repositories/fifo-lock.repository.js");
vi.mock("../repositories/outbox.repository.js");

const createOutbox = (doc) =>
  new Outbox({
    target: "arn:aws:sns:eu-west-2:000000000000:test-topic",
    event: {
      time: new Date().toISOString(),
    },
    segregationRef: "test-segregation-ref",
    ...doc,
  });

describe("outbox.subscriber", () => {
  beforeEach(() => {
    updateDeadEvents.mockResolvedValue({ modifiedCount: 1 });
    updateResubmittedEvents.mockResolvedValue({ modifiedCount: 1 });
    updateFailedEvents.mockResolvedValue({ modifiedCount: 1 });
    updateExpiredEvents.mockResolvedValue({ modifiedCount: 0 });
    publish.mockResolvedValue(1);
    claimEvents.mockResolvedValue([]);
    findNextMessage.mockResolvedValue(
      createOutbox({ segregationRef: "ref_1" }),
    );
    claimEvents.mockResolvedValue([Outbox.createMock()]);
    getFifoLocks.mockResolvedValue([]);
    setFifoLock.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    freeFifoLock.mockResolvedValue();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("should start polling on start()", async () => {
    claimEvents.mockResolvedValue([
      new Outbox({
        target: "arn:aws:sns:eu-west-2:000000000000:test-topic",
        event: {},
        segregationRef: "test-segregation-ref",
      }),
    ]);
    vi.spyOn(OutboxSubscriber.prototype, "processEvents").mockResolvedValue();
    const subscriber = new OutboxSubscriber();
    subscriber.start();
    await vi.waitFor(() => {
      expect(claimEvents).toHaveBeenCalled();
    });
    expect(claimEvents).toHaveBeenCalled();
    expect(subscriber.running).toBeTruthy();
  });

  it("should stop polling after stop()", async () => {
    claimEvents.mockResolvedValue([
      new Outbox({
        target: "arn:aws:sns:eu-west-2:000000000000:test-topic",
        event: {},
        segregationRef: "test-segregation-ref",
      }),
    ]);
    const subscriber = new OutboxSubscriber();
    subscriber.start();

    await vi.waitFor(() => {
      expect(claimEvents).toHaveBeenCalled();
    });
    expect(claimEvents).toHaveBeenCalledTimes(1);
    subscriber.stop();
    expect(subscriber.running).toBeFalsy();
  });

  it("should continue polling and process events after an error", async () => {
    const error = new Error("Temporary poll failure");
    vi.spyOn(logger, "error");
    vi.spyOn(logger, "info");

    const mockEvent = new Outbox({
      target: "arn:aws:sns:eu-west-2:000000000000:test-topic",
      event: { data: { foo: "bar" }, messageGroupId: "group-1" },
      segregationRef: "test-segregation-ref",
    });
    mockEvent.markAsComplete = vi.fn();

    claimEvents
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce([mockEvent])
      .mockResolvedValue([]);

    publish.mockResolvedValue(1);

    const subscriber = new OutboxSubscriber();
    subscriber.start();

    await vi.waitFor(() => {
      expect(claimEvents).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(error, "Error polling outbox");
    });

    await vi.advanceTimersByTimeAsync(subscriber.interval);

    await vi.waitFor(() => {
      expect(publish).toHaveBeenCalled();
    });

    await vi.advanceTimersByTimeAsync(subscriber.interval);

    await vi.waitFor(() => {
      expect(claimEvents).toHaveBeenCalledTimes(3);
    });

    expect(subscriber.running).toBeTruthy();

    subscriber.stop();
  });

  it("should mark events as unsent", async () => {
    publish.mockRejectedValue(1);
    const mockEvent = {
      target: "arn:some:value",
      event: { messageGroupId: "group-1" },
      markAsFailed: vi.fn(),
    };
    const outbox = new OutboxSubscriber();
    await outbox.sendEvent(mockEvent);
    expect(mockEvent.markAsFailed).toHaveBeenCalled();
  });

  it("should mark events as sent", async () => {
    publish.mockResolvedValue(1);

    const mockEvent = {
      target: "arn:some:value",
      event: { messageGroupId: "group-1" },
      markAsComplete: vi.fn(),
    };
    const outbox = new OutboxSubscriber();
    await outbox.sendEvent(mockEvent);
    expect(mockEvent.markAsComplete).toHaveBeenCalled();
  });

  it("should mark event as complete", async () => {
    vi.spyOn(logger, "info").mockImplementation(() => {});
    AsyncLocalStorage.prototype.getStore = vi.fn().mockReturnValue("1234");

    const mockEvent = {
      target: "arn:some:value",
      event: {},
      markAsComplete: vi.fn(),
    };
    const outbox = new OutboxSubscriber();
    await outbox.markEventComplete(mockEvent);
    expect(mockEvent.markAsComplete).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(mockEvent, "1234");
  });

  it("should mark an event as unsent", async () => {
    vi.spyOn(logger, "info").mockImplementation(() => {});
    AsyncLocalStorage.prototype.getStore = vi.fn().mockReturnValue("1234");

    const mockEvent = {
      target: "arn:some:value",
      event: {},
      markAsFailed: vi.fn(),
    };
    const outbox = new OutboxSubscriber();
    await outbox.markEventUnsent(mockEvent);
    expect(mockEvent.markAsFailed).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(mockEvent, "1234");
  });

  it("should skip processing when lock is not acquired", async () => {
    setFifoLock.mockResolvedValue({ upsertedCount: 0, matchCount: 0 });

    const subscriber = new OutboxSubscriber();
    const processEventsSpy = vi
      .spyOn(subscriber, "processEvents")
      .mockResolvedValue();

    await subscriber.processWithLock("claim-token", "ref_1");

    expect(setFifoLock).toHaveBeenCalledWith("OUTBOX", "ref_1");
    expect(claimEvents).not.toHaveBeenCalled();
    expect(processEventsSpy).not.toHaveBeenCalled();
  });

  it("should append _fifo.fifo to topic string", () => {
    const subscriber = new OutboxSubscriber();
    expect(subscriber.topicStringToFifo("arn:aws:sns:topic")).toBe(
      "arn:aws:sns:topic_fifo.fifo",
    );
  });

  it("should not double-append _fifo.fifo", () => {
    const subscriber = new OutboxSubscriber();
    expect(subscriber.topicStringToFifo("arn:aws:sns:topic_fifo.fifo")).toBe(
      "arn:aws:sns:topic_fifo.fifo",
    );
  });

  it("should processExpiredEvents", async () => {
    updateExpiredEvents.mockResolvedValue({ modifiedCount: 2 });
    const subscriber = new OutboxSubscriber();
    await subscriber.processExpiredEvents();
    expect(updateExpiredEvents).toHaveBeenCalled();
  });

  it("should getNextAvailable", async () => {
    const mockLock = { segregationRef: "locked-ref" };
    getFifoLocks.mockResolvedValue([mockLock]);
    findNextMessage.mockResolvedValue({ segregationRef: "available-ref" });

    const subscriber = new OutboxSubscriber();
    const result = await subscriber.getNextAvailable();

    expect(getFifoLocks).toHaveBeenCalledWith("OUTBOX");
    expect(findNextMessage).toHaveBeenCalledWith(["locked-ref"]);
    expect(result).toBe("available-ref");
  });

  it("should return undefined when no next available", async () => {
    getFifoLocks.mockResolvedValue([]);
    findNextMessage.mockResolvedValue(null);

    const subscriber = new OutboxSubscriber();
    const result = await subscriber.getNextAvailable();
    expect(result).toBeUndefined();
  });

  it("should processFailedEvents", async () => {
    claimEvents.mockResolvedValue([]);
    updateFailedEvents.mockResolvedValue({ modifiedCount: 1 });
    const subscriber = new OutboxSubscriber();
    await subscriber.processFailedEvents();
    expect(updateFailedEvents).toHaveBeenCalled();
  });

  it("should processResubmittedEvents", async () => {
    claimEvents.mockResolvedValue([]);
    updateResubmittedEvents.mockResolvedValue({ modifiedCount: 1 });
    const subscriber = new OutboxSubscriber();
    await subscriber.processResubmittedEvents();
    expect(updateResubmittedEvents).toHaveBeenCalled();
  });

  it("should processDeadEvents", async () => {
    claimEvents.mockResolvedValue([]);
    updateDeadEvents.mockResolvedValue({ modifiedCount: 1 });
    const subscriber = new OutboxSubscriber();
    await subscriber.processDeadEvents();
    expect(updateDeadEvents).toHaveBeenCalled();
  });
});
