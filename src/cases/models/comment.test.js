import { randomUUID } from "node:crypto";
import { afterEach, beforeEach } from "node:test";
import { describe, expect, it, vi } from "vitest";
import { Comment } from "./comment.js";
import { EventEnums } from "./event-enums.js";

vi.mock("node:crypto");

describe("Comment", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create a comment", () => {
    randomUUID.mockReturnValue("1234-BBBB");

    vi.setSystemTime(new Date("2025-08-05T14:45:41.307Z"));

    const comment = new Comment(EventEnums.eventTypes.CASE_ASSIGNED, "Hello");

    expect(comment).toEqual(
      Comment.createMock({
        type: "CASE_ASSIGNED",
        ref: "1234-BBBB",
        text: "Hello",
        createdAt: "2025-08-05T14:45:41.307Z",
      }),
    );
  });
});
