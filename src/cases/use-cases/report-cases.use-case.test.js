import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { Workflow } from "../models/workflow.js";
import { countByPosition } from "../repositories/case.repository.js";
import { createRoleFilter } from "./find-cases.use-case.js";
import { findWorkflowsUseCase } from "./find-workflows.use-case.js";
import { buildReport, reportCasesUseCase } from "./report-cases.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-workflows.use-case.js");

const workflow = {
  phases: [
    {
      code: "PRE_AWARD",
      name: "Pre-award",
      stages: [
        {
          code: "REVIEW",
          name: "Review application",
          statuses: [
            { code: "IN_PROGRESS", name: "In progress", theme: "INFO" },
            { code: "AWAITING", name: "Awaiting info", theme: "WARNING" },
          ],
        },
        {
          code: "ASSESS",
          name: "Assess",
          statuses: [
            { code: "IN_PROGRESS", name: "In progress", theme: "INFO" },
          ],
        },
      ],
    },
    {
      code: "CLOSED",
      name: "Closed",
      stages: [
        {
          code: "CLOSED",
          name: "Closed",
          statuses: [{ code: "WITHDRAWN", name: "Withdrawn", theme: "GREY" }],
        },
      ],
    },
  ],
};

describe("buildReport", () => {
  it("rolls counts up phase > stage > status and totals them", () => {
    const counts = [
      {
        phaseCode: "PRE_AWARD",
        stageCode: "REVIEW",
        statusCode: "IN_PROGRESS",
        count: 40,
      },
      {
        phaseCode: "PRE_AWARD",
        stageCode: "REVIEW",
        statusCode: "AWAITING",
        count: 15,
      },
      {
        phaseCode: "PRE_AWARD",
        stageCode: "ASSESS",
        statusCode: "IN_PROGRESS",
        count: 35,
      },
      {
        phaseCode: "CLOSED",
        stageCode: "CLOSED",
        statusCode: "WITHDRAWN",
        count: 10,
      },
    ];

    const report = buildReport(workflow, counts);

    expect(report.total).toBe(100);
    expect(report.phases).toEqual([
      {
        code: "PRE_AWARD",
        name: "Pre-award",
        count: 90,
        stages: [
          {
            code: "REVIEW",
            name: "Review application",
            count: 55,
            statuses: [
              {
                code: "IN_PROGRESS",
                name: "In progress",
                theme: "INFO",
                count: 40,
              },
              {
                code: "AWAITING",
                name: "Awaiting info",
                theme: "WARNING",
                count: 15,
              },
            ],
          },
          {
            code: "ASSESS",
            name: "Assess",
            count: 35,
            statuses: [
              {
                code: "IN_PROGRESS",
                name: "In progress",
                theme: "INFO",
                count: 35,
              },
            ],
          },
        ],
      },
      {
        code: "CLOSED",
        name: "Closed",
        count: 10,
        stages: [
          {
            code: "CLOSED",
            name: "Closed",
            count: 10,
            statuses: [
              {
                code: "WITHDRAWN",
                name: "Withdrawn",
                theme: "GREY",
                count: 10,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("omits positions that hold no cases", () => {
    const counts = [
      {
        phaseCode: "PRE_AWARD",
        stageCode: "REVIEW",
        statusCode: "IN_PROGRESS",
        count: 3,
      },
    ];

    const report = buildReport(workflow, counts);

    expect(report.total).toBe(3);
    expect(report.phases).toHaveLength(1);
    expect(report.phases[0].stages).toHaveLength(1);
    expect(report.phases[0].stages[0].statuses).toHaveLength(1);
  });

  it("surfaces positions not present in the workflow definition rather than dropping them", () => {
    const counts = [
      {
        phaseCode: "PRE_AWARD",
        stageCode: "REVIEW",
        statusCode: "IN_PROGRESS",
        count: 2,
      },
      { phaseCode: "LEGACY", stageCode: "OLD", statusCode: "GONE", count: 5 },
    ];

    const report = buildReport(workflow, counts);

    expect(report.total).toBe(7);
    const legacy = report.phases.find((p) => p.code === "LEGACY");
    expect(legacy).toEqual({
      code: "LEGACY",
      name: "LEGACY",
      count: 5,
      stages: [
        {
          code: "OLD",
          name: "OLD",
          count: 5,
          statuses: [{ code: "GONE", name: "GONE", theme: null, count: 5 }],
        },
      ],
    });
  });
});

describe("reportCasesUseCase", () => {
  const user = User.createMock();

  // A caseworker who can see two case types (frps, woodland).
  const accessibleWorkflows = [
    Workflow.createMock({ code: "woodland" }),
    Workflow.createMock({ code: "frps" }),
  ];

  // One case sitting at a position that exists in the mock workflow definition.
  const counts = [
    {
      phaseCode: "PHASE_1",
      stageCode: "STAGE_1",
      statusCode: "STATUS_1",
      count: 7,
    },
  ];

  beforeEach(() => {
    findWorkflowsUseCase.mockResolvedValue(accessibleWorkflows);
    countByPosition.mockResolvedValue(counts);
  });

  // Given a caseworker requests a case type they have access to
  // When the report is built
  // Then only that case type is counted and reported
  it("reports the requested case type", async () => {
    const result = await reportCasesUseCase({
      user,
      query: { workflowCode: "woodland" },
    });

    expect(countByPosition).toHaveBeenCalledWith(["woodland"]);
    expect(result.selectedCaseType).toBe("woodland");
    expect(result.total).toBe(7);
  });

  // Given a caseworker only sees workflows their roles permit
  // When the report is built
  // Then workflows are fetched using the role filter
  it("restricts available case types to the user's roles", async () => {
    const result = await reportCasesUseCase({ user, query: {} });

    expect(findWorkflowsUseCase).toHaveBeenCalledWith(
      createRoleFilter(user.getRoles()),
    );
    // And case types are offered in a stable, alphabetical order
    expect(result.availableCaseTypes).toEqual(["frps", "woodland"]);
  });

  // Given no case type is requested (first visit)
  // When the report is built
  // Then no case type is selected and no counting is attempted
  it("makes no selection when no case type is requested", async () => {
    const result = await reportCasesUseCase({ user, query: {} });

    expect(result.selectedCaseType).toBeNull();
    expect(result.total).toBe(0);
    expect(result.phases).toEqual([]);
    // The available case types are still offered for the caseworker to choose.
    expect(result.availableCaseTypes).toEqual(["frps", "woodland"]);
    expect(countByPosition).not.toHaveBeenCalled();
  });

  // Given a case type is requested that the user cannot access
  // When the report is built
  // Then no case type is selected (it does not silently pick another)
  it("makes no selection when the requested case type is unavailable", async () => {
    const result = await reportCasesUseCase({
      user,
      query: { workflowCode: "not-permitted" },
    });

    expect(result.selectedCaseType).toBeNull();
    expect(result.phases).toEqual([]);
    expect(countByPosition).not.toHaveBeenCalled();
  });

  // Regression (FGP-1221): the frontend's blank option submits workflowCode="".
  // Given an empty case type is requested
  // When the report is built
  // Then it is treated as no selection (not counted)
  it("makes no selection when the requested case type is empty", async () => {
    const result = await reportCasesUseCase({
      user,
      query: { workflowCode: "" },
    });

    expect(result.selectedCaseType).toBeNull();
    expect(result.phases).toEqual([]);
    expect(countByPosition).not.toHaveBeenCalled();
  });

  // Given the user has access to no case types at all
  // When the report is built
  // Then an empty report is returned and no counting is attempted
  it("returns an empty report when the user has no accessible case types", async () => {
    findWorkflowsUseCase.mockResolvedValue([]);

    const result = await reportCasesUseCase({ user, query: {} });

    expect(result).toEqual({
      selectedCaseType: null,
      availableCaseTypes: [],
      total: 0,
      phases: [],
    });
    expect(countByPosition).not.toHaveBeenCalled();
  });
});
