import Boom from "@hapi/boom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { findWorkflowByCodeUseCase } from "../../cases/use-cases/find-workflow-by-code.use-case.js";
import { findSecretWorkflowUseCase } from "./find-secret-workflow.use-case.js";

vi.mock("../../cases/use-cases/find-workflow-by-code.use-case.js");

describe("findSecretWorkflowUseCase", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-15T12:00:00.000Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const mockUserWithValidRoles = {
    id: "user-123",
    name: "John Doe",
    email: "john@example.com",
    appRoles: { role1: { startDate: "2025-07-01", endDate: "2025-08-01" } },
  };

  const mockUserWithNoRoles = {
    id: "user-456",
    name: "Jane Doe",
    email: "jane@example.com",
    appRoles: {},
  };

  const mockWorkflow = {
    code: "TEST_WORKFLOW",
    requiredRoles: { allOf: ["role1"], anyOf: [] },
  };

  it("returns workflow data when user is authorized", async () => {
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    const result = await findSecretWorkflowUseCase({
      workflowCode: "TEST_WORKFLOW",
      user: mockUserWithValidRoles,
    });

    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("TEST_WORKFLOW");
    expect(result).toEqual({
      message: "Access granted to workflow",
      workflow: {
        code: mockWorkflow.code,
        requiredRoles: mockWorkflow.requiredRoles,
      },
      user: {
        id: mockUserWithValidRoles.id,
        name: mockUserWithValidRoles.name,
        email: mockUserWithValidRoles.email,
        appRoles: mockUserWithValidRoles.appRoles,
      },
    });
  });

  it("throws not found error when workflow does not exist", async () => {
    findWorkflowByCodeUseCase.mockResolvedValue(null);

    await expect(
      findSecretWorkflowUseCase({
        workflowCode: "NONEXISTENT_WORKFLOW",
        user: mockUserWithValidRoles,
      }),
    ).rejects.toThrow(
      Boom.notFound('Workflow with code "NONEXISTENT_WORKFLOW" not found'),
    );

    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(
      "NONEXISTENT_WORKFLOW",
    );
  });

  it("throws forbidden error when user lacks required roles", async () => {
    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await expect(
      findSecretWorkflowUseCase({
        workflowCode: "TEST_WORKFLOW",
        user: mockUserWithNoRoles,
      }),
    ).rejects.toThrow(Boom.forbidden("Access denied"));

    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("TEST_WORKFLOW");
  });
});
