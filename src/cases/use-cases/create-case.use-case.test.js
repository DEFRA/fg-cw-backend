import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTransaction } from "../../common/with-transaction.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/case.repository.js";
import { createCaseUseCase } from "./create-case.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../repositories/outbox.repository.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../repositories/case.repository.js");
vi.mock("./find-workflow-by-code.use-case.js");

describe("createCaseUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a case", async () => {
    const mockSession = {};
    withTransaction.mockImplementation(async (cb) => cb(mockSession));

    findWorkflowByCodeUseCase.mockResolvedValue(
      new Workflow({
        code: "wf-001",
        stages: [
          {
            code: "STAGE_1",
            taskGroups: [
              {
                code: "TASK_GROUP_1",
                tasks: [
                  {
                    code: "TASK_1",
                    type: "task-type-1",
                  },
                ],
              },
            ],
          },
        ],
        requiredRoles: {
          allOf: ["ROLE_1", "ROLE_2"],
          anyOf: ["ROLE_3"],
        },
      }),
    );

    findWorkflowByCodeUseCase.mockResolvedValue(Workflow.createMock());

    await createCaseUseCase({
      event: {
        data: {
          workflowCode: "workflow-code",
          caseRef: "TEST-001",
          payload: {
            createdAt: "2025-01-01T00:00:00.000Z",
            submittedAt: "2025-01-01T00:00:00.000Z",
            identifiers: {},
            answers: {},
          },
        },
      },
    });

    expect(save).toHaveBeenCalledWith(expect.any(Case), mockSession);
  });
});
