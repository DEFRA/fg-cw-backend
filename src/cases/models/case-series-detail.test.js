import { describe, expect, it } from "vitest";
import { CaseSeriesDetail } from "./case-series-detail.js";

const validProps = () => ({
  caseRef: "TEST-001",
  dateReceived: "2025-01-01T00:00:00.000Z",
  closed: false,
  status: "In progress",
  link: { text: "This case" },
});

describe("CaseSeriesDetail", () => {
  describe("constructor", () => {
    it("creates a valid instance with required fields", () => {
      const detail = new CaseSeriesDetail(validProps());
      expect(detail.caseRef).toBe("TEST-001");
      expect(detail.dateReceived).toBe("2025-01-01T00:00:00.000Z");
      expect(detail.closed).toBe(false);
      expect(detail.status).toBe("In progress");
      expect(detail.link).toEqual({ text: "This case" });
    });

    it("accepts an optional dateClosed", () => {
      const detail = new CaseSeriesDetail({
        ...validProps(),
        dateClosed: "2025-06-01T00:00:00.000Z",
      });
      expect(detail.dateClosed).toBe("2025-06-01T00:00:00.000Z");
    });

    it("accepts a link with an href", () => {
      const detail = new CaseSeriesDetail({
        ...validProps(),
        link: { href: "/cases/abc123/timeline", text: "View case" },
      });
      expect(detail.link).toEqual({
        href: "/cases/abc123/timeline",
        text: "View case",
      });
    });

    it("throws Boom.badRequest when required fields are missing", () => {
      expect(() => new CaseSeriesDetail({})).toThrow(
        "Invalid CaseSeriesDetail",
      );
    });

    it("throws Boom.badRequest when caseRef is missing", () => {
      const { caseRef: _, ...rest } = validProps();
      expect(() => new CaseSeriesDetail(rest)).toThrow(
        "Invalid CaseSeriesDetail",
      );
    });

    it("throws Boom.badRequest when closed is missing", () => {
      const { closed: _, ...rest } = validProps();
      expect(() => new CaseSeriesDetail(rest)).toThrow(
        "Invalid CaseSeriesDetail",
      );
    });
  });

  describe("fromCase", () => {
    const mockWorkflow = {
      getStatus: () => ({ name: "Submitted" }),
    };

    it("maps caseDoc fields onto a CaseSeriesDetail instance", () => {
      const caseDoc = {
        _id: "doc-id",
        caseRef: "TEST-001",
        createdAt: new Date(),
        closed: false,
        closedAt: undefined,
        position: {},
      };

      const detail = CaseSeriesDetail.fromCase(
        caseDoc,
        "OTHER-001",
        mockWorkflow,
      );

      expect(detail).toBeInstanceOf(CaseSeriesDetail);
      expect(detail.caseRef).toBe("TEST-001");
      expect(detail.closed).toBe(false);
      expect(detail.status).toBe("Submitted");
      expect(detail.link).toEqual({
        href: "/cases/doc-id/timeline",
        text: "View case",
      });
    });

    it("sets link to 'This case' when caseRef matches currentCaseRef", () => {
      const caseDoc = {
        _id: "doc-id",
        caseRef: "TEST-001",
        createdAt: new Date(),
        closed: false,
        position: {},
      };

      const detail = CaseSeriesDetail.fromCase(
        caseDoc,
        "TEST-001",
        mockWorkflow,
      );

      expect(detail.link).toEqual({ text: "This case" });
    });

    it("sets dateClosed from closedAt when present", () => {
      const caseDoc = {
        _id: "doc-id",
        caseRef: "TEST-001",
        createdAt: new Date(),
        closed: true,
        closedAt: new Date(),
        position: {},
      };

      const detail = CaseSeriesDetail.fromCase(
        caseDoc,
        "OTHER-001",
        mockWorkflow,
      );

      expect(detail.dateClosed).toEqual(expect.any(String));
    });
  });
});
