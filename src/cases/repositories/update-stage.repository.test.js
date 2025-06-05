import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { db } from "../../common/mongo-client.js";
import { collection } from "./constants.js";
import { updateStage } from "./update-stage.repository.js";

describe("updateStage", () => {
  it("should update case stage", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";
    const updateOne = vi.fn();
    vi.spyOn(db, "collection").mockReturnValue({
      updateOne,
    });

    await updateStage(caseId, "NEW-STAGE");
    expect(db.collection).toBeCalledWith(collection);
    expect(updateOne).toBeCalledWith(
      { _id: new ObjectId(caseId) },
      { $set: { currentStage: "NEW-STAGE" } },
    );
  });
});
