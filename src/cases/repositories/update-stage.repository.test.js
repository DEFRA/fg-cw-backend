import { describe, it, vi, expect } from "vitest";
import { db } from "../../common/mongo-client.js";
import { ObjectId } from "mongodb";
import { updateStage } from "./update-stage.repository.js";
import { collection } from "./constants.js";

describe("updateStage", () => {
  it("should update case stage", async () => {
    const caseId = "6800c9feb76f8f854ebf901a";
    const updateOne = vi.fn();
    vi.spyOn(db, "collection").mockReturnValue({
      updateOne
    });

    await updateStage(caseId, "NEW-STAGE");
    expect(db.collection).toBeCalledWith(collection);
    expect(updateOne).toBeCalledWith(
      { _id: new ObjectId(caseId) },
      { $set: { currentStage: "NEW-STAGE" } }
    );
  });
});
