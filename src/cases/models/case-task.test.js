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

  it("should not create a task with an invalid commentRef", () => {
    expect(
      () =>
        new CaseTask({
          code: "TASK_1",
          status: "PENDING",
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
});
