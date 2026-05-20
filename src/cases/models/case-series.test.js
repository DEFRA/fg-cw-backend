import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseSeries } from "./case-series.js";

const validProps = () => ({
  caseRefs: ["TEST-001"],
  workflowCode: "wf-001",
  latestCaseId: "abc123",
  latestCaseRef: "TEST-001",
  updatedAt: "2025-01-01T00:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
});

describe("CaseSeries", () => {
  describe("constructor", () => {
    it("creates a valid CaseSeries instance", () => {
      const series = new CaseSeries(validProps());
      expect(series.workflowCode).toBe("wf-001");
      expect(series.latestCaseRef).toBe("TEST-001");
      expect(series.latestCaseId).toBe("abc123");
      expect(series.caseRefs).toBeInstanceOf(Set);
      expect(series.caseRefs.has("TEST-001")).toBe(true);
    });

    it("throws Boom.badRequest when required fields are missing", () => {
      expect(() => new CaseSeries({})).toThrow("Invalid CaseSeries");
    });

    it("stores _id from props", () => {
      const props = { ...validProps(), _id: "some-id" };
      const series = new CaseSeries(props);
      expect(series._id).toBe("some-id");
    });
  });

  describe("addCaseRef", () => {
    it("adds a caseRef and updates latestCaseId and latestCaseRef", () => {
      const series = new CaseSeries(validProps());
      series.addCaseRef("TEST-002", "def456");
      expect(series.caseRefs.has("TEST-002")).toBe(true);
      expect(series.latestCaseId).toBe("def456");
      expect(series.latestCaseRef).toBe("TEST-002");
    });

    it("throws Boom.badData when caseRef is missing", () => {
      const series = new CaseSeries(validProps());
      expect(() => series.addCaseRef(null, "def456")).toThrow(
        "CaseSeries can not be updated, caseRef is missing.",
      );
    });

    it("throws Boom.badData when caseId is missing", () => {
      const series = new CaseSeries(validProps());
      expect(() => series.addCaseRef("TEST-002", null)).toThrow(
        "CaseSeries can not be updated, caseId is missing.",
      );
    });

    it("updates updatedAt", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01T00:00:00.000Z"));
      const series = new CaseSeries(validProps());
      series.addCaseRef("TEST-002", "def456");
      expect(series.updatedAt).toBe("2025-06-01T00:00:00.000Z");
      vi.useRealTimers();
    });
  });

  describe("CaseSeries.new", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    });

    afterEach(() => vi.useRealTimers());

    it("creates a new CaseSeries with the provided values", () => {
      const series = CaseSeries.new({
        workflowCode: "wf-001",
        caseRef: "TEST-001",
        caseId: "abc123",
      });
      expect(series).toBeInstanceOf(CaseSeries);
      expect(series.workflowCode).toBe("wf-001");
      expect(series.latestCaseId).toBe("abc123");
      expect(series.latestCaseRef).toBe("TEST-001");
      expect(series.caseRefs.has("TEST-001")).toBe(true);
      expect(series.createdAt).toBe("2025-01-01T00:00:00.000Z");
    });
  });

  describe("CaseSeries.fromDocument", () => {
    it("creates a CaseSeries from a database document", () => {
      const doc = {
        _id: "doc-id",
        caseRefs: ["TEST-001", "TEST-002"],
        workflowCode: "wf-001",
        latestCaseId: "abc123",
        latestCaseRef: "TEST-002",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-02-01T00:00:00.000Z",
      };
      const series = CaseSeries.fromDocument(doc);
      expect(series).toBeInstanceOf(CaseSeries);
      expect(series._id).toBe("doc-id");
      expect(series.caseRefs.has("TEST-001")).toBe(true);
      expect(series.caseRefs.has("TEST-002")).toBe(true);
      expect(series.latestCaseRef).toBe("TEST-002");
    });
  });

  describe("toDocument", () => {
    it("returns a plain object with caseRefs as array", () => {
      const series = new CaseSeries({ ...validProps(), _id: "doc-id" });
      const doc = series.toDocument();
      expect(doc._id).toBe("doc-id");
      expect(Array.isArray(doc.caseRefs)).toBe(true);
      expect(doc.caseRefs).toContain("TEST-001");
      expect(doc.workflowCode).toBe("wf-001");
      expect(doc.latestCaseRef).toBe("TEST-001");
      expect(doc.latestCaseId).toBe("abc123");
    });
  });
});
