import { describe, expect, it } from "vitest";
import { buildReport } from "./report-cases.use-case.js";

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
