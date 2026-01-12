import { describe, expect, it } from "vitest";
import { CaseTask } from "./case-task.js";

describe("CaseTask", () => {
  it("should create a basic task", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
    });

    expect(task.code).toBe("TASK_1");
    expect(task.status).toBe("PENDING");
  });

  it("should create a task with optional fields", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
      updatedAt: "2025-01-01T00:00:00.000Z",
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
    });
    expect(task.code).toBe("TASK_1");
    expect(task.status).toBe("PENDING");
    expect(task.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(task.updatedBy).toBe("k0a7-9xv4f2h1n3q8c5w2z1y");
  });

  it("should not create a task with an invalid status", () => {
    expect(
      () =>
        new CaseTask({
          code: "TASK_1",
          status: 999,
        }),
    ).toThrow('Invalid Task: "status" must be a string');
  });

  it("should not create a task with an invalid code", () => {
    expect(
      () =>
        new CaseTask({
          code: "invalid_code",
          status: "PENDING",
        }),
    ).toThrow(
      'Invalid Task: "code" with value "invalid_code" fails to match the required pattern: /^[A-Z0-9_]+$/',
    );
  });

  it("should create a task with empty commentRefs by default", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
    });

    expect(task.commentRefs).toEqual([]);
  });

  it("should create a task with commentRefs array", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
      commentRefs: [{ status: "ACCEPTED", ref: "abc123def456" }],
    });

    expect(task.commentRefs).toEqual([
      { status: "ACCEPTED", ref: "abc123def456" },
    ]);
  });

  it("should not create a task with invalid commentRefs ref", () => {
    expect(
      () =>
        new CaseTask({
          code: "TASK_1",
          status: "PENDING",
          commentRefs: [{ status: "ACCEPTED", ref: "INVALID_REF" }],
        }),
    ).toThrow(
      'Invalid Task: "UrlSafeId" with value "INVALID_REF" fails to match the required pattern: /^[a-z0-9-]+$/',
    );
  });

  it("should not create a task with an invalid code", () => {
    expect(
      () =>
        new CaseTask({
          code: "invalid_code",
          status: "PENDING",
        }),
    ).toThrow(
      'Invalid Task: "code" with value "invalid_code" fails to match the required pattern: /^[A-Z0-9_]+$/',
    );
  });

  it("should not create a task with an invalid code", () => {
    expect(
      () =>
        new CaseTask({
          code: "invalid_code",
          status: "PENDING",
        }),
    ).toThrow(
      'Invalid Task: "code" with value "invalid_code" fails to match the required pattern: /^[A-Z0-9_]+$/',
    );
  });

  it("should not create a task with an invalid code", () => {
    expect(
      () =>
        new CaseTask({
          code: "invalid_code",
          status: "PENDING",
        }),
    ).toThrow(
      'Invalid Task: "code" with value "invalid_code" fails to match the required pattern: /^[A-Z0-9_]+$/',
    );
  });

  it("should update the status of a task", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
    });
    task.updateStatus({
      status: "COMPLETE",
      completed: true,
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
    });
    expect(task.status).toBe("COMPLETE");
  });

  it("should update the updated at of a task", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
    });
    task.updateStatus({
      status: "COMPLETE",
      completed: true,
      updatedBy: "1k0a7-9xv4f2h1n3q8c5w2999",
    });
    expect(task.updatedAt).toBeDefined();
  });

  it("should throw an error if the status is invalid", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
    });
    expect(() =>
      task.updateStatus({
        status: 999,
        completed: false,
        updatedBy: "k0a7-9xv4f2h1n3q8c5w2999",
      }),
    ).toThrow('Invalid Task Status: "value" must be a string');
  });

  it("should create a task with completed field", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "COMPLETE",
      completed: true,
    });

    expect(task.code).toBe("TASK_1");
    expect(task.status).toBe("COMPLETE");
    expect(task.completed).toBe(true);
  });

  it("should update the completed flag when updating status", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
      completed: false,
    });

    task.updateStatus({
      status: "COMPLETE",
      completed: true,
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
    });

    expect(task.status).toBe("COMPLETE");
    expect(task.completed).toBe(true);
    expect(task.updatedBy).toBe("k0a7-9xv4f2h1n3q8c5w2z1y");
  });

  it("should return array with updatedBy from getUserIds", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2999",
    });

    expect(task.getUserIds()).toEqual(["k0a7-9xv4f2h1n3q8c5w2999"]);
  });

  it("should accept null as status", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: null,
    });

    expect(task.status).toBe(null);
  });

  it("should append comment ref when updating status with comment", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
    });

    task.updateStatus({
      status: "ACCEPTED",
      completed: true,
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
      comment: { ref: "abc123def456" },
    });

    expect(task.commentRefs).toEqual([
      { status: "ACCEPTED", ref: "abc123def456" },
    ]);
  });

  it("should append multiple comment refs when updating status multiple times", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
    });

    task.updateStatus({
      status: "RFI",
      completed: false,
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
      comment: { ref: "abc123def456" },
    });

    task.updateStatus({
      status: "ACCEPTED",
      completed: true,
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
      comment: { ref: "xyz789ghi012" },
    });

    expect(task.commentRefs).toEqual([
      { status: "RFI", ref: "abc123def456" },
      { status: "ACCEPTED", ref: "xyz789ghi012" },
    ]);
  });

  it("should not append comment ref when no comment is provided", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
    });

    task.updateStatus({
      status: "ACCEPTED",
      completed: true,
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
    });

    expect(task.commentRefs).toEqual([]);
  });

  it("should preserve existing commentRefs when updating without comment", () => {
    const task = new CaseTask({
      code: "TASK_1",
      status: "PENDING",
      commentRefs: [{ status: "RFI", ref: "abc123def456" }],
    });

    task.updateStatus({
      status: "ACCEPTED",
      completed: true,
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
    });

    expect(task.commentRefs).toEqual([{ status: "RFI", ref: "abc123def456" }]);
  });
});
