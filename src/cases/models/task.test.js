import { describe, expect, it } from "vitest";
import { Task, toTask, toTasks } from "./task.js";

describe("Task", () => {
  it("should create a basic task", () => {
    const task = new Task({
      id: "k0a7-9xv4f2h1n3q8c5w2z1y",
      status: "pending",
    });

    expect(task.id).toBe("k0a7-9xv4f2h1n3q8c5w2z1y");
    expect(task.status).toBe("pending");
  });

  it("should create a task with optional fields", () => {
    const task = new Task({
      id: "k0a7-9xv4f2h1n3q8c5w2z1y",
      status: "pending",
      updatedAt: "2025-01-01T00:00:00.000Z",
      updatedBy: "k0a7-9xv4f2h1n3q8c5w2z1y",
    });
    expect(task.id).toBe("k0a7-9xv4f2h1n3q8c5w2z1y");
    expect(task.status).toBe("pending");
    expect(task.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(task.updatedBy).toBe("k0a7-9xv4f2h1n3q8c5w2z1y");
  });

  it("should not create a task with an invalid status", () => {
    expect(
      () =>
        new Task({
          id: "k0a7-9xv4f2h1n3q8c5w2z1y",
          status: "invalid_status",
        }),
    ).toThrow('Invalid Task: "status" must be one of [complete, pending]');
  });

  it("should not create a task with an invalid id", () => {
    expect(
      () =>
        new Task({
          id: "invalid_id",
          status: "pending",
        }),
    ).toThrow(
      'Invalid Task: "id" with value "invalid_id" fails to match the required pattern: /^[a-z0-9-]+$/',
    );
  });

  it("should not create a task with an invalid commentRef", () => {
    expect(
      () =>
        new Task({
          id: "k0a7-9xv4f2h1n3q8c5w2z1y",
          status: "pending",
          commentRef: "invalid_id",
        }),
    ).toThrow(
      'Invalid Task: "commentRef" with value "invalid_id" fails to match the required pattern: /^[a-z0-9-]+$/',
    );
  });

  it("should not create a task with an invalid id", () => {
    expect(
      () =>
        new Task({
          id: "invalid_id",
          status: "pending",
        }),
    ).toThrow(
      'Invalid Task: "id" with value "invalid_id" fails to match the required pattern: /^[a-z0-9-]+$/',
    );
  });

  it("should update the status of a task", () => {
    const task = new Task({
      id: "k0a7-9xv4f2h1n3q8c5w2z1y",
      status: "pending",
    });
    task.updateStatus("complete", "k0a7-9xv4f2h1n3q8c5w2z1y");
    expect(task.status).toBe("complete");
  });

  it("should update the comment ref of a task", () => {
    const task = new Task({
      id: "k0a7-9xv4f2h1n3q8c5w2z1y",
      status: "pending",
    });
    task.updateCommentRef("k0a7-9xv4f2h1n3q8c5w2999");
    expect(task.commentRef).toBe("k0a7-9xv4f2h1n3q8c5w2999");
  });

  it("should update the updated at of a task", () => {
    const task = new Task({
      id: "k0a7-9xv4f2h1n3q8c5w2999",
      status: "pending",
    });
    task.updateStatus("complete", "1k0a7-9xv4f2h1n3q8c5w2999");
    expect(task.updatedAt).toBeDefined();
  });
});

describe("toTask", () => {
  it("should convert a task document to a task", () => {
    const task = toTask({
      id: "k0a7-9xv4f2h1n3q8c5w2z1y",
      status: "pending",
    });
    expect(task.id).toBe("k0a7-9xv4f2h1n3q8c5w2z1y");
    expect(task.status).toBe("pending");
  });
});

describe("toTasks", () => {
  it("should convert a tasks document to a tasks", () => {
    const tasks = toTasks([
      {
        id: "ssss-9xv4f2h1n3q8c5w2111",
        taskGroups: [
          {
            id: "tgtg-9xv4f2h1n3q8c5w2000",
            tasks: [
              {
                id: "k01a-9xv4f2h1n3q8c5w2z1y",
                status: "complete",
              },
              {
                id: "k02a-9xv4f2h1n3q8c5w2z1o",
                status: "pending",
              },
              {
                id: "k03a-9xv4f2h1n3q8c5w2z00",
                status: "pending",
              },
            ],
          },
        ],
      },
    ]);
    expect(tasks.size).toBe(3);
    expect(tasks.get("k01a-9xv4f2h1n3q8c5w2z1y")).toBeInstanceOf(Task);
    expect(tasks.get("k02a-9xv4f2h1n3q8c5w2z1o")).toBeInstanceOf(Task);
    expect(tasks.get("k03a-9xv4f2h1n3q8c5w2z00")).toBeInstanceOf(Task);
  });
});
