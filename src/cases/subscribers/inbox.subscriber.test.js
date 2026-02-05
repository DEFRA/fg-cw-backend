import { setTimeout } from "node:timers/promises";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { withTraceParent } from "../../common/trace-parent.js";
import { Inbox } from "../models/inbox.js";
import {
  freeFifoLock,
  getFifoLocks,
  setFifoLock,
} from "../repositories/fifo-lock.repository.js";
import {
  claimEvents,
  findNextMessage,
} from "../repositories/inbox.repository.js";
import { createCaseUseCase } from "../use-cases/create-case.use-case.js";
import { handleCaseStatusUpdateUseCase } from "../use-cases/handle-case-status-update.use-case.js";
import { InboxSubscriber } from "./inbox.subscriber.js";

vi.mock("../use-cases/create-case.use-case.js");
vi.mock("../../common/trace-parent.js");
vi.mock("../use-cases/approve-application.use-case.js");
vi.mock("../repositories/inbox.repository.js");
vi.mock("../repositories/fifo-lock.repository.js");
vi.mock("../services/apply-event-status-change.service.js");
vi.mock("../use-cases/handle-case-status-update.use-case.js");
vi.mock("../../common/logger.js");

const createInbox = (doc) =>
  new Inbox({
    event: {
      time: new Date().toISOString(),
    },
    ...doc,
  });

describe("inbox.subscriber", () => {
  let cdpEnv;
  beforeAll(() => {
    vi.useFakeTimers();
    cdpEnv = config.get("cdpEnvironment");
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  afterAll(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it("should create an inbox subscriber", () => {
    const subs = new InboxSubscriber();
    expect(subs).toBeInstanceOf(InboxSubscriber);
    expect(subs.interval).toBe(parseInt(config.get("inbox.inboxPollMs")));
    expect(subs.running).toBeFalsy();
  });

  it("should poll on start()", async () => {
    findNextMessage.mockResolvedValue(createInbox({ segregationRef: "ref_1" }));
    claimEvents.mockResolvedValue([Inbox.createMock()]);
    getFifoLocks.mockResolvedValue([]);
    setFifoLock.mockResolvedValue();
    freeFifoLock.mockResolvedValue();
    vi.spyOn(InboxSubscriber.prototype, "processEvents").mockResolvedValue();
    const subscriber = new InboxSubscriber();
    subscriber.start();
    await vi.waitFor(() => {
      expect(claimEvents).toHaveBeenCalled();
    });
    expect(claimEvents).toHaveBeenCalled();
    expect(setFifoLock).toHaveBeenCalledWith("INBOX", "ref_1");
    expect(freeFifoLock).toHaveBeenCalledWith("INBOX", "ref_1");
    expect(subscriber.running).toBeTruthy();
  });

  it("should continue polling and process events after an error", async () => {
    const error = new Error("Temporary poll failure");
    vi.spyOn(logger, "error");
    vi.spyOn(logger, "info");

    const mockEvent = new Inbox({
      type: `cloud.defra.${cdpEnv}.fg-gas-backend.case.create`,
      traceparent: "test-trace",
      event: { data: { foo: "bar" } },
    });
    findNextMessage.mockResolvedValue(createInbox({ segregationRef: "ref_1" }));
    claimEvents.mockResolvedValue([createInbox()]);
    getFifoLocks.mockResolvedValue([]);
    setFifoLock.mockResolvedValue();
    freeFifoLock.mockResolvedValue();

    claimEvents
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce([mockEvent])
      .mockResolvedValue([]);

    createCaseUseCase.mockResolvedValue(true);
    withTraceParent.mockImplementation((_, fn) => fn());

    const subscriber = new InboxSubscriber();
    subscriber.start();

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(error, "Error polling inbox");
    });

    await vi.advanceTimersByTimeAsync(subscriber.interval);

    await vi.waitFor(() => {
      expect(createCaseUseCase).toHaveBeenCalled();
    });

    await vi.advanceTimersByTimeAsync(subscriber.interval);

    await vi.waitFor(() => {
      expect(claimEvents).toHaveBeenCalledTimes(3);
    });

    expect(subscriber.running).toBeTruthy();

    subscriber.stop();
  });

  it("should stop polling after stop()", async () => {
    findNextMessage.mockResolvedValue(createInbox({ segregationRef: "ref_1" }));
    claimEvents.mockResolvedValue([createInbox()]);
    getFifoLocks.mockResolvedValue([]);
    setFifoLock.mockResolvedValue();
    freeFifoLock.mockResolvedValue();
    claimEvents.mockResolvedValue([
      Inbox.createMock({
        event: { time: new Date().toISOString() },
      }),
    ]);
    const subscriber = new InboxSubscriber();
    subscriber.start();
    await vi.waitFor(() => {
      expect(claimEvents).toHaveBeenCalled();
    });
    expect(claimEvents).toHaveBeenCalledTimes(1);
    subscriber.stop();
    vi.advanceTimersByTime(500);
    expect(subscriber.running).toBeFalsy();
    expect(claimEvents).toHaveBeenCalledTimes(1);
  });

  describe("available segregation Ref", () => {
    it("should claim next available message", async () => {
      const events = [
        Inbox.createMock({
          _id: "1",
          event: { time: new Date(Date.now()).toISOString() },
          segregationRef: "ref-1",
        }),
        Inbox.createMock({
          _id: "2",
          event: { time: new Date(Date.now()).toISOString() },
          segregationRef: "ref-1",
        }),
        Inbox.createMock({
          _id: "3",
          event: { time: new Date(Date.now()).toISOString() },
          segregationRef: "ref-2",
        }),
      ];

      const spy1 = vi.spyOn(InboxSubscriber.prototype, "processEvents");
      spy1.mockResolvedValue();
      setFifoLock.mockResolvedValue();
      freeFifoLock.mockResolvedValue();
      getFifoLocks.mockResolvedValue([]);
      findNextMessage.mockResolvedValue({ segregationRef: "ref-2" });

      claimEvents.mockResolvedValue([events[2]]);
      const subscriber = new InboxSubscriber();

      subscriber.start();
      await vi.waitFor(() => {
        expect(spy1).toBeCalled();
      });
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy1.mock.calls[0][0][0]._id).toEqual("3");
    });
  });

  describe("processEvents", () => {
    it("should process events in correct order", async () => {
      const events = [
        Inbox.createMock({
          _id: "1",
          event: { time: new Date(Date.now()).toISOString() },
        }),
        Inbox.createMock({
          _id: "2",
          event: { time: new Date(Date.now()).toISOString() },
        }),
      ];

      claimEvents.mockResolvedValue(events);
      const subscriber = new InboxSubscriber();
      const spy1 = vi
        .spyOn(subscriber, "handleEvent")
        .mockImplementationOnce(async () => {
          return setTimeout(500);
        })
        .mockImplementationOnce(async () => setTimeout(500));
      await subscriber.processEvents(events);
      expect(spy1).toHaveBeenCalledTimes(2);

      expect(subscriber.handleEvent.mock.calls[0][0]).toEqual(events[0]);
      expect(subscriber.handleEvent.mock.calls[1][0]).toEqual(events[1]);
    });

    it("should use use-cases if mapped", async () => {
      const mockEventData = {
        foo: "barr",
      };
      createCaseUseCase.mockResolvedValue(true);

      withTraceParent.mockImplementation((_, fn) => fn());
      const mockEvent = {
        type: `cloud.defra.${cdpEnv}.fg-gas-backend.case.create`,
        traceparent: "1234-abcd",
        event: {
          data: mockEventData,
        },
        markAsComplete: vi.fn(),
      };
      const inbox = new InboxSubscriber();
      await inbox.processEvents([mockEvent]);
      expect(withTraceParent).toHaveBeenCalled();
      expect(createCaseUseCase).toHaveBeenCalled();
      expect(withTraceParent.mock.calls[0][0]).toBe("1234-abcd");
      expect(mockEvent.markAsComplete).toHaveBeenCalled();
    });

    it("throws if unable to handle inbox message", async () => {
      const mockEventData = {
        foo: "barr",
      };

      const mockMessage = {
        messageId: "message-1234",
        type: "u.nknown.event.id",
        traceparent: "1234-abcd",
        event: {
          data: mockEventData,
        },
        markAsFailed: vi.fn(),
      };
      const inbox = new InboxSubscriber();
      inbox.handleEvent(mockMessage);
      expect(mockMessage.markAsFailed).toHaveBeenCalled();
    });

    it("should mark events as failed", async () => {
      withTraceParent.mockImplementation((_, fn) => fn());

      const mockEventData = {
        currentStatus: "APPROVE",
        foo: "barr",
      };

      const mockEvent = {
        type: "un.known.event.id",
        source: "Gas",
        traceparent: "1234-abcd",
        event: {
          data: mockEventData,
        },
        markAsFailed: vi.fn(),
      };
      const inbox = new InboxSubscriber();
      await inbox.processEvents([mockEvent]);
      expect(mockEvent.markAsFailed).toHaveBeenCalled();
    });

    it("should mark events as complete", async () => {
      const mockEventData = {
        foo: "barr",
      };
      handleCaseStatusUpdateUseCase.mockResolvedValue("COMPLETE");

      withTraceParent.mockImplementationOnce((_, fn) => fn());
      const mockEvent = {
        type: `cloud.defra.${cdpEnv}.fg-gas-backend.case.create`,
        traceparent: "1234-abcd",
        event: {
          data: mockEventData,
        },
        markAsComplete: vi.fn(),
      };
      const inbox = new InboxSubscriber();
      await inbox.processEvents([mockEvent]);
      expect(withTraceParent).toHaveBeenCalled();
      expect(mockEvent.markAsComplete).toHaveBeenCalled();
    });
  });
});
