import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { Case } from "../models/case.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { Workflow } from "../models/workflow.js";
import { enrichCaseUseCase } from "./enrich-case.use-case.js";

vi.mock("../../users/use-cases/find-user-by-id.use-case.js");
vi.mock("../../users/use-cases/find-users.use-case.js");

describe("enrichCaseUseCase", () => {
  it("enriches case with timeline info, stages, pages, and required roles", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const kase = Case.createMock({ _id: "test-case-id" });

    findUserByIdUseCase.mockResolvedValue(mockUser);
    findUsersUseCase.mockResolvedValue([]);
    findUsersUseCase.mockResolvedValue([]);

    const result = await enrichCaseUseCase(kase, mockWorkflow);

    expect(result.requiredRoles).toEqual(mockWorkflow.requiredRoles);
    expect(result.pages).toEqual(mockWorkflow.pages);
    expect(result.stages).toBeDefined();
    expect(result.timeline).toBeDefined();
  });

  it("enriches case with assigned user and populates user name", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock({
      assignedUser: { id: mockUser.id },
    });

    findUserByIdUseCase.mockResolvedValue(mockUser);
    findUsersUseCase.mockResolvedValue([]);
    findUsersUseCase.mockResolvedValue([]);

    const result = await enrichCaseUseCase(mockCase, mockWorkflow);

    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(result.assignedUser.name).toBe(mockUser.name);
  });

  it("enriches case with timeline events and populates user data", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock({
      assignedUser: { id: mockUser.id },
    });

    mockCase.timeline.unshift({
      eventType: TimelineEvent.eventTypes.CASE_ASSIGNED,
      createdAt: "2025-01-01T00:00:00.000Z",
      description: "Case assigned",
      createdBy: "64c88faac1f56f71e1b89a44",
      data: {
        assignedTo: "64c88faac1f56f71e1b89a33",
      },
    });

    const mockUserAssigned = User.createMock({
      id: "64c88faac1f56f71e1b89a33",
    });

    findUserByIdUseCase.mockResolvedValue(mockUser);
    findUsersUseCase.mockResolvedValueOnce([mockUserAssigned]); // for createdBy users
    findUsersUseCase.mockResolvedValueOnce([mockUserAssigned]); // for assignedTo users

    const result = await enrichCaseUseCase(mockCase, mockWorkflow);

    expect(result.timeline[0].data.assignedTo).toEqual({
      email: mockUserAssigned.email,
      name: mockUserAssigned.name,
      id: mockUserAssigned.id,
    });
  });

  it("enriches case with workflow stages and task information", async () => {
    const mockUser = User.createMock();
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock({
      assignedUser: { id: mockUser.id },
    });

    findUserByIdUseCase.mockResolvedValue(mockUser);
    findUsersUseCase.mockResolvedValue([]);
    findUsersUseCase.mockResolvedValue([]);

    const result = await enrichCaseUseCase(mockCase, mockWorkflow);

    expect(result.stages).toBeDefined();
    expect(result.stages.length).toBeGreaterThan(0);
    expect(result.stages[0].title).toBeDefined();
    expect(result.stages[0].actions).toBeDefined();
  });

  it("handles case with no assigned user", async () => {
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock({
      assignedUser: null,
    });

    findUsersUseCase.mockResolvedValue([]);
    findUsersUseCase.mockResolvedValue([]);

    const result = await enrichCaseUseCase(mockCase, mockWorkflow);

    expect(result.assignedUser).toBeNull();
    expect(result.requiredRoles).toEqual(mockWorkflow.requiredRoles);
  });

  it("handles timeline events with system created by", async () => {
    const mockWorkflow = Workflow.createMock();
    const mockCase = Case.createMock();

    mockCase.timeline.push({
      eventType: TimelineEvent.eventTypes.CASE_CREATED,
      createdAt: "2025-01-01T00:00:00.000Z",
      description: "Case created",
      createdBy: "System",
      data: {},
    });

    findUsersUseCase.mockResolvedValue([]);
    findUsersUseCase.mockResolvedValue([]);

    const result = await enrichCaseUseCase(mockCase, mockWorkflow);

    expect(result.timeline[0].createdBy).toEqual({ name: "System" });
  });

  it("throws when user lookup fails for assigned user", async () => {
    const mockCase = Case.createMock({
      assignedUser: { id: "unknown-user-id" },
    });
    const mockWorkflow = Workflow.createMock();
    const userError = new Error("User not found");

    findUserByIdUseCase.mockRejectedValue(userError);

    await expect(enrichCaseUseCase(mockCase, mockWorkflow)).rejects.toThrow(
      "User not found",
    );

    expect(findUserByIdUseCase).toHaveBeenCalledWith("unknown-user-id");
  });
});
