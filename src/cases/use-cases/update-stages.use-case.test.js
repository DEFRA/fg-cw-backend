import { describe, expect, it, vi } from "vitest";
import { db } from "../../common/mongo-client.js";
import { updateStages } from "./update-stages.use-case.js";

describe("update stages use case", () => {
  it("should update stages", async () => {
    const payload = {
      caseId: "123412341234123412341234",
      isComplete: true,
      taskId: "simple-review",
      groupId: "application-receipt-tasks",
    };

    const stages = [
      {
        id: "application-receipt",
        taskGroups: [
          {
            id: "application-receipt-tasks",
            tasks: [
              {
                id: "simple-review",
                isComplete: false,
              },
            ],
          },
        ],
      },
      {
        id: "contract",
        taskGroups: [],
      },
    ];

    const expectedStages = [
      {
        id: "application-receipt",
        taskGroups: [
          {
            id: "application-receipt-tasks",
            tasks: [
              {
                id: "simple-review",
                isComplete: true,
              },
            ],
          },
        ],
      },
      {
        id: "contract",
        taskGroups: [],
      },
    ];

    const curStageId = "application-receipt";

    const mockupdate = vi.fn();
    const mockCursor = {
      updateOne: mockupdate,
    };

    vi.spyOn(db, "collection").mockReturnValue(mockCursor);

    await updateStages({ payload, stages, curStageId });
    expect(db.collection).toHaveBeenCalled();

    expect(mockupdate).toHaveBeenCalledWith(expect.any(Object), {
      $set: {
        stages: expectedStages,
      },
    });
  });
});
