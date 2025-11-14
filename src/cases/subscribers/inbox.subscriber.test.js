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
import { withTraceParent } from "../../common/trace-parent.js";
import { Inbox } from "../models/inbox.js";
import { claimEvents } from "../repositories/inbox.repository.js";
import { createCaseUseCase } from "../use-cases/create-case.use-case.js";
import { handleAgreementStatusUpdateUseCase } from "../use-cases/handle-agreement-status-update.use-case.js";
import { InboxSubscriber } from "./inbox.subscriber.js";

vi.mock("../use-cases/create-case.use-case.js");
vi.mock("../../common/trace-parent.js");
vi.mock("../use-cases/approve-application.use-case.js");
vi.mock("../repositories/inbox.repository.js");
vi.mock("../services/apply-event-status-change.service.js");
vi.mock("../use-cases/handle-agreement-status-update.use-case.js");
vi.mock("../../common/logger.js");

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
    claimEvents.mockResolvedValue([new Inbox({})]);
    const subscriber = new InboxSubscriber();
    subscriber.start();
    expect(claimEvents).toHaveBeenCalled();
    expect(subscriber.running).toBeTruthy();
  });

  it("should stop polling after stop()", async () => {
    claimEvents.mockResolvedValue([new Inbox({})]);
    const subscriber = new InboxSubscriber();
    subscriber.start();
    expect(claimEvents).toHaveBeenCalledTimes(1);
    subscriber.stop();
    vi.advanceTimersByTime(500);
    expect(subscriber.running).toBeFalsy();
    expect(claimEvents).toHaveBeenCalledTimes(1);
  });

  describe("processEvents", () => {
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
      handleAgreementStatusUpdateUseCase.mockResolvedValue("COMPLETE");

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
