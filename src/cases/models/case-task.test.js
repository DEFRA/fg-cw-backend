import { describe, expect, it } from "vitest";
import { CaseTask } from "./case-task.js";

describe("CaseTask", () => {
  it("should create a basic task", () => {
    const task = new CaseTask({
      code: "k0a7-9xv4f2h1n3q8c5w2z1y",
      status: "pending",
    });

    expect(task.code).toBe("k0a7-9xv4f2h1n3q8c5w2z1y");
    expect(task.status).toBe("pending");
  });

  it("should create a task with optional fields", () => {
    const task = new CaseTask({
      code: "k0a7-9xv4f2h1n3q8c5w2z1y",
      status: "pending",
      updatedAt: "2025-01-01T00:00:00.000Z",
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
    });
    expect(task.code).toBe("k0a7-9xv4f2h1n3q8c5w2z1y");
    expect(task.status).toBe("pending");
    expect(task.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(task.updatedBy).toBe("k0a7-9xv4f2h1n3q8c5w2z1y");
  });

  it("should not create a task with an invalid status", () => {
    expect(
      () =>
        new CaseTask({
          code: "k0a7-9xv4f2h1n3q8c5w2z1y",
          status: 999,
        }),
    ).toThrow('Invalid Task: "status" must be a string');
  });

  it("should not create a task with an invalid code", () => {
    expect(
      () =>
        new CaseTask({
          code: "invalid_code",
          status: "pending",
        }),
    ).toThrow(
      'Invalid Task: "code" with value "invalid_code" fails to match the required pattern: /^[a-z0-9-]+$/',
    );
  });

  it("should not create a task with an invalid commentRef", () => {
    expect(
      () =>
        new CaseTask({
          code: "k0a7-9xv4f2h1n3q8c5w2z1y",
          status: "pending",
          commentRef: "invalid_id",
        }),
    ).toThrow(
      'Invalid Task: "commentRef" with value "invalid_id" fails to match the required pattern: /^[a-z0-9-]+$/',
    );
  });

  it("should not create a task with an invalid code", () => {
    expect(
      () =>
        new CaseTask({
          code: "invalid_code",
          status: "pending",
        }),
    ).toThrow(
      'Invalid Task: "code" with value "invalid_code" fails to match the required pattern: /^[a-z0-9-]+$/',
    );
  });

  it("should not create a task with an invalid code", () => {
    expect(
      () =>
        new CaseTask({
          code: "invalid_code",
          status: "pending",
        }),
    ).toThrow(
      'Invalid Task: "code" with value "invalid_code" fails to match the required pattern: /^[a-z0-9-]+$/',
    );
  });

  it("should not create a task with an invalid code", () => {
    expect(
      () =>
        new CaseTask({
          code: "invalid_code",
          status: "pending",
        }),
    ).toThrow(
      'Invalid Task: "code" with value "invalid_code" fails to match the required pattern: /^[a-z0-9-]+$/',
    );
  });

  it("should update the status of a task", () => {
    const task = new CaseTask({
      code: "k0a7-9xv4f2h1n3q8c5w2z1y",
      status: "pending",
    });
    task.updateStatus({
      status: "complete",
      completed: true,
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
    });
    expect(task.status).toBe("complete");
  });

  it("should update the comment ref of a task", () => {
    const task = new CaseTask({
      code: "k0a7-9xv4f2h1n3q8c5w2z1y",
      status: "pending",
    });
    task.updateCommentRef("k0a7-9xv4f2h1n3q8c5w2999");
    expect(task.commentRef).toBe("k0a7-9xv4f2h1n3q8c5w2999");
  });

  it("should update the updated at of a task", () => {
    const task = new CaseTask({
      code: "k0a7-9xv4f2h1n3q8c5w2999",
      status: "pending",
    });
    task.updateStatus({
      status: "complete",
      completed: true,
      updatedBy: "1k0a7-9xv4f2h1n3q8c5w2999",
    });
    expect(task.updatedAt).toBeDefined();
  });

  it("should throw an error if the status is invalid", () => {
    const task = new CaseTask({
      code: "k0a7-9xv4f2h1n3q8c5w2999",
      status: "pending",
    });
    expect(() =>
      task.updateStatus({
        status: 999,
        completed: false,
        updatedBy: "k0a7-9xv4f2h1n3q8c5w2999",
      }),
    ).toThrow('Invalid Task Status: "value" must be a string');
  });
});
