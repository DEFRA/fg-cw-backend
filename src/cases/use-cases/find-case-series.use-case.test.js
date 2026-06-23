import { describe, expect, it, vi } from "vitest";
import { CaseSeriesDetail } from "../models/case-series-detail.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findInCaseRefsAndWorkflowCode } from "../repositories/case-series.repository.js";
import {
  findByCaseRefAndWorkflowCode,
  findCasesByCaseRefsAndWorkflowCode,
} from "../repositories/case.repository.js";
import { findCaseSeries } from "./find-case-series.use-case.js";
import { resolveCurrentWorkflowUseCase } from "./resolve-current-workflow.use-case.js";

vi.mock("../repositories/case-series.repository.js");
vi.mock("../repositories/case.repository.js");
vi.mock("./resolve-current-workflow.use-case.js");

describe("findCaseSeries", () => {
  it("should return basic series information when tabid is not 'timeline'", async () => {
    const caseRefs = new Set([{}, {}]);
    findInCaseRefsAndWorkflowCode.mockResolvedValueOnce({
      caseRefs,
    });
    const caseRef = "223344";
    const workflowCode = "workflow-1";
    const tabId = "foo";
    const result = await findCaseSeries({ caseRef, workflowCode, tabId });
    expect(result.length).toBe(2);
    expect(result.seriesDetails).toBeUndefined();
  });

  it("should return full case series details if tabId is 'timeline'", async () => {
    const caseRefs = new Set([{}, {}]);
    const mockCase1 = Case.createMock({
      caseRef: "1234",
      createdAt: new Date().toISOString(),
    });
    const mockCase2 = Case.createMock({
      caseRef: "2345",
      createdAt: new Date().toISOString(),
    });
    const mockWorkflow = Workflow.createMock();
    const mockCurrentCase = Case.createMock({
      caseRef: "1234",
      originalConfigVersion: null,
    });
    findByCaseRefAndWorkflowCode.mockResolvedValueOnce(mockCurrentCase);
    resolveCurrentWorkflowUseCase.mockResolvedValueOnce({
      workflow: mockWorkflow,
      resolvedVersion: null,
    });
    findCasesByCaseRefsAndWorkflowCode.mockResolvedValueOnce([
      mockCase1,
      mockCase2,
    ]);

    findInCaseRefsAndWorkflowCode.mockResolvedValueOnce({
      caseRefs,
    });
    const caseRef = "1234";
    const workflowCode = "workflow-1";
    const tabId = "timeline";
    const result = await findCaseSeries({ caseRef, workflowCode, tabId });
    expect(resolveCurrentWorkflowUseCase).toHaveBeenCalledTimes(1);
    expect(result.length).toBe(2);
    expect(result.seriesDetails).toHaveLength(2);
    expect(result.seriesDetails[0]).toBeInstanceOf(CaseSeriesDetail);
    expect(result.seriesDetails[0]).toEqual(
      expect.objectContaining({
        caseRef: "1234",
        closed: false,
        dateReceived: expect.any(String),
        link: { text: "This case" },
        status: "Stage status 1",
      }),
    );
    expect(result.seriesDetails[1]).toBeInstanceOf(CaseSeriesDetail);
    expect(result.seriesDetails[1]).toEqual(
      expect.objectContaining({
        caseRef: "2345",
        closed: false,
        dateReceived: expect.any(String),
        link: {
          text: "View case",
          href: "/cases/" + mockCase2._id.toString() + "/timeline",
        },
        status: "Stage status 1",
      }),
    );
  });
});
