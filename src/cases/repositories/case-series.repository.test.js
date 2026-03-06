import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";
import { db } from "../../common/mongo-client.js";
import { CaseSeries } from "../models/case-series.js";
import {
  findByCaseRefAndWorkflowCode,
  save,
  update,
} from "./case-series.repository.js";

vi.mock("../../common/mongo-client.js");

const createMockSeries = () =>
  CaseSeries.new({
    workflowCode: "wf-001",
    latestCaseId: "abc123",
    latestCaseRef: "TEST-001",
  });

describe("case-series.repository", () => {
  describe("save", () => {
    it("inserts the series document and returns the result", async () => {
      const insertOne = vi.fn().mockResolvedValue({ acknowledged: true });
      db.collection.mockReturnValue({ insertOne });

      const series = createMockSeries();
      const result = await save(series, {});

      expect(db.collection).toHaveBeenCalledWith("case_series");
      expect(insertOne).toHaveBeenCalledWith(series.toDocument(), {
        session: {},
      });
      expect(result).toEqual({ acknowledged: true });
    });
  });

  describe("findByCaseRefAndWorkflowCode", () => {
    it("returns a CaseSeries when document is found", async () => {
      const doc = {
        _id: "doc-id",
        caseRefs: ["TEST-001"],
        workflowCode: "wf-001",
        latestCaseId: "abc123",
        latestCaseRef: "TEST-001",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };
      const findOne = vi.fn().mockResolvedValue(doc);
      db.collection.mockReturnValue({ findOne });

      const result = await findByCaseRefAndWorkflowCode(
        "TEST-001",
        "wf-001",
        {},
      );

      expect(db.collection).toHaveBeenCalledWith("case_series");
      expect(result).toBeInstanceOf(CaseSeries);
      expect(result.latestCaseRef).toBe("TEST-001");
    });

    it("throws Boom.notFound when no document is found", async () => {
      const findOne = vi.fn().mockResolvedValue(null);
      db.collection.mockReturnValue({ findOne });

      await expect(
        findByCaseRefAndWorkflowCode("TEST-999", "wf-001", {}),
      ).rejects.toThrow(
        Boom.notFound(
          `Case Series with currentCaseRef "TEST-999" and workflowCode "wf-001" not found.`,
        ),
      );
    });
  });

  describe("update", () => {
    it("replaces the document and returns the result", async () => {
      const replaceOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
      db.collection.mockReturnValue({ replaceOne });

      const series = createMockSeries();
      series._id = "doc-id";

      const result = await update(series, {});

      expect(db.collection).toHaveBeenCalledWith("case_series");
      expect(replaceOne).toHaveBeenCalledWith(
        { _id: "doc-id" },
        series.toDocument(),
        { session: {} },
      );
      expect(result).toEqual({ modifiedCount: 1 });
    });

    it("throws Boom.notFound when modifiedCount is 0", async () => {
      const replaceOne = vi.fn().mockResolvedValue({ modifiedCount: 0 });
      db.collection.mockReturnValue({ replaceOne });

      const series = createMockSeries();
      series._id = "doc-id";

      await expect(update(series, {})).rejects.toThrow(
        Boom.notFound(`Failed to update case_series with _id "doc-id"`),
      );
    });
  });
});
