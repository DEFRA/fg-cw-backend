import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedUserRoles } from "../../common/auth.js";
import { User } from "../../users/models/user.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findAll } from "../repositories/case.repository.js";
import {
  createUserRolesFilter,
  findCasesUseCase,
} from "./find-cases.use-case.js";
import { findWorkflowsUseCase } from "./find-workflows.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../../users/use-cases/find-users.use-case.js");
vi.mock("./find-workflows.use-case.js");
vi.mock("../../common/auth.js");

describe("filters", () => {
  const userRoles = ["ROLE_1", "ROLE_3", "ROLE_APP_1"];

  it("creates a filter for user roles", () => {
    const expectedFilters = {
      $expr: {
        $and: [
          {
            $or: [
              {
                $eq: [{ $ifNull: ["$requiredRoles.allOf", []] }, []],
              },
              {
                $setIsSubset: ["$requiredRoles.allOf", userRoles],
              },
            ],
          },
          {
            $or: [
              {
                $eq: [{ $ifNull: ["$requiredRoles.anyOf", []] }, []],
              },
              {
                $gt: [
                  {
                    $size: {
                      $setIntersection: ["$requiredRoles.anyOf", userRoles],
                    },
                  },
                  0,
                ],
              },
            ],
          },
          {},
        ],
      },
    };
    expect(createUserRolesFilter(userRoles)).toEqual(expectedFilters);
  });

  it("adds additional filters if passed", () => {
    const expectedFilters = {
      $expr: {
        $and: [
          {
            $or: [
              {
                $eq: [{ $ifNull: ["$requiredRoles.allOf", []] }, []],
              },
              {
                $setIsSubset: ["$requiredRoles.allOf", userRoles],
              },
            ],
          },
          {
            $or: [
              {
                $eq: [{ $ifNull: ["$requiredRoles.anyOf", []] }, []],
              },
              {
                $gt: [
                  {
                    $size: {
                      $setIntersection: ["$requiredRoles.anyOf", userRoles],
                    },
                  },
                  0,
                ],
              },
            ],
          },
          {
            codes: ["workflow-code-1"],
          },
        ],
      },
    };

    expect(
      createUserRolesFilter(userRoles, { codes: ["workflow-code-1"] }),
    ).toEqual(expectedFilters);
  });
});

describe("findCasesUseCase", () => {
  const userRolesObjects = { ROLE_1: {}, ROLE_2: {} };
  const userRoles = Object.keys(userRolesObjects);
  beforeEach(() => {
    findWorkflowsUseCase.mockResolvedValue([]);
    getAuthenticatedUserRoles.mockReturnValue(userRolesObjects);
  });

  it("finds cases without assigned users", async () => {
    const workflows = [
      Workflow.createMock({
        code: "WORKFLOW_1",
        requiredRoles: ["ROLE_1", "ROLE_2"],
      }),
      Workflow.createMock({
        code: "WORKFLOW_2",
        requiredRoles: ["ROLE_3"],
      }),
    ];

    const casesWithoutUsers = [
      Case.createMock({ workflowCode: "WORKFLOW_1", assignedUser: null }),
      Case.createMock({ workflowCode: "WORKFLOW_2", assignedUser: null }),
    ];

    findAll.mockResolvedValue(casesWithoutUsers);
    findUsersUseCase.mockResolvedValue([]);
    findWorkflowsUseCase.mockResolvedValue(workflows);

    const result = await findCasesUseCase();

    expect(findAll).toHaveBeenCalledWith();
    expect(findWorkflowsUseCase).toHaveBeenCalledWith(
      createUserRolesFilter(userRoles, { codes: ["WORKFLOW_1", "WORKFLOW_2"] }),
    );
    expect(findUsersUseCase).toHaveBeenCalledWith({ ids: [] });
    expect(result).toEqual([
      {
        _id: casesWithoutUsers[0]._id,
        assignedUser: null,
        caseRef: "case-ref",
        currentStatus: "Stage status 1",
        currentStatusTheme: "INFO",
        dateReceived: "2025-01-01T00:00:00.000Z",
        payload: {},
        workflowCode: "WORKFLOW_1",
      },
      {
        _id: casesWithoutUsers[1]._id,
        assignedUser: null,
        caseRef: "case-ref",
        currentStatus: "Stage status 1",
        currentStatusTheme: "INFO",
        dateReceived: "2025-01-01T00:00:00.000Z",
        payload: {},
        workflowCode: "WORKFLOW_2",
      },
    ]);
  });

  it("finds cases with assigned users and populates user", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const user2 = User.createMock({ id: "user-2", name: "Jane Jones" });
    const users = [user1, user2];

    const casesWithUsers = [
      Case.createMock({ assignedUser: { id: user1.id } }),
      Case.createMock({ assignedUser: { id: user2.id } }),
    ];

    findAll.mockResolvedValue(casesWithUsers);
    findUsersUseCase.mockResolvedValue(users);
    findWorkflowsUseCase.mockResolvedValue([Workflow.createMock()]);

    const result = await findCasesUseCase();

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, user2.id],
    });
    expect(result[0].assignedUser.name).toBe(user1.name);
    expect(result[1].assignedUser.name).toBe(user2.name);
  });

  it("finds cases with and without assigned users", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const user2 = User.createMock({ id: "user-2", name: "Jane Jones" });
    const users = [user1, user2];

    const mixedCases = [
      Case.createMock({ assignedUser: null }),
      Case.createMock({ assignedUser: { id: user1.id } }),
      Case.createMock({ assignedUser: null }),
      Case.createMock({ assignedUser: { id: user2.id } }),
    ];

    findAll.mockResolvedValue(mixedCases);
    findUsersUseCase.mockResolvedValue(users);
    findWorkflowsUseCase.mockResolvedValue([Workflow.createMock()]);

    const result = await findCasesUseCase();

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, user2.id],
    });
    expect(result[0].assignedUser).toBeNull();
    expect(result[1].assignedUser.name).toBe(user1.name);
    expect(result[2].assignedUser).toBeNull();
    expect(result[3].assignedUser.name).toBe(user2.name);
  });

  it("handles cases where assigned user is not found", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const users = [user1];

    const casesWithUsers = [
      Case.createMock({ assignedUser: { id: user1.id } }),
      Case.createMock({ assignedUser: { id: "user-missing" } }),
    ];

    findAll.mockResolvedValue(casesWithUsers);
    findUsersUseCase.mockResolvedValue(users);
    findWorkflowsUseCase.mockResolvedValue([Workflow.createMock()]);

    const result = await findCasesUseCase();

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, "user-missing"],
    });

    expect(result[0].assignedUser.name).toBe(user1.name);
    expect(result[1].assignedUser).toBeNull();
  });

  it("throws when user lookup fails", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const casesWithUsers = [
      Case.createMock({ assignedUser: { id: user1.id } }),
    ];
    const userError = new Error("Find users error");

    findAll.mockResolvedValue(casesWithUsers);
    findUsersUseCase.mockRejectedValue(userError);

    await expect(findCasesUseCase()).rejects.toThrow("Find users error");

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({ ids: [user1.id] });
  });

  it("extracts workflow codes correctly from cases", async () => {
    const casesWithWorkflowCodes = [
      Case.createMock({ workflowCode: "CODE_1", assignedUser: null }),
      Case.createMock({ workflowCode: "CODE_2", assignedUser: null }),
      Case.createMock({ workflowCode: "CODE_3", assignedUser: null }),
    ];

    findAll.mockResolvedValue(casesWithWorkflowCodes);
    findUsersUseCase.mockResolvedValue([]);
    findWorkflowsUseCase.mockResolvedValue([]);

    await findCasesUseCase(userRoles);

    expect(findWorkflowsUseCase).toHaveBeenCalledWith(
      createUserRolesFilter(userRoles, {
        codes: ["CODE_1", "CODE_2", "CODE_3"],
      }),
    );
  });

  it("calls both findUsersUseCase and findWorkflowsUseCase with correct parameters", async () => {
    const user1 = User.createMock({ id: "user-1" });
    const user2 = User.createMock({ id: "user-2" });

    const workflow1 = Workflow.createMock({
      code: "WORKFLOW_A",
      requiredRoles: ["ROLE_1"],
    });

    const workflow2 = Workflow.createMock({
      code: "WORKFLOW_B",
      requiredRoles: ["ROLE_2"],
    });

    const cases = [
      Case.createMock({
        assignedUser: { id: user1.id },
        workflowCode: "WORKFLOW_A",
      }),
      Case.createMock({
        assignedUser: { id: user2.id },
        workflowCode: "WORKFLOW_B",
      }),
      Case.createMock({
        assignedUser: null,
        workflowCode: "WORKFLOW_A",
      }),
    ];

    findAll.mockResolvedValue(cases);
    findUsersUseCase.mockResolvedValue([user1, user2]);
    findWorkflowsUseCase.mockResolvedValue([workflow1, workflow2]);

    await findCasesUseCase();

    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, user2.id],
    });
    expect(findWorkflowsUseCase).toHaveBeenCalledWith({
      $expr: {
        $and: [
          {
            $or: [
              { $eq: [{ $ifNull: ["$requiredRoles.allOf", []] }, []] },
              { $setIsSubset: ["$requiredRoles.allOf", ["ROLE_1", "ROLE_2"]] },
            ],
          },
          {
            $or: [
              { $eq: [{ $ifNull: ["$requiredRoles.anyOf", []] }, []] },
              {
                $gt: [
                  {
                    $size: {
                      $setIntersection: [
                        "$requiredRoles.anyOf",
                        ["ROLE_1", "ROLE_2"],
                      ],
                    },
                  },
                  0,
                ],
              },
            ],
          },
          { codes: ["WORKFLOW_A", "WORKFLOW_B"] },
        ],
      },
    });
  });

  it("throws when find user use cases fails", async () => {
    const user1 = User.createMock({ id: "user-1" });
    const cases = [
      Case.createMock({
        assignedUser: { id: user1.id },
        workflowCode: "WORKFLOW_A",
      }),
    ];

    const userError = new Error("User use case failed");

    findAll.mockResolvedValue(cases);
    findUsersUseCase.mockRejectedValue(userError);
    findWorkflowsUseCase.mockResolvedValue([]);

    await expect(findCasesUseCase()).rejects.toThrow("User use case failed");

    // Both use cases should have been called despite one failing
    expect(findUsersUseCase).toHaveBeenCalledWith({ ids: [user1.id] });
    expect(findWorkflowsUseCase).toHaveBeenCalledWith(
      createUserRolesFilter(userRoles, { codes: ["WORKFLOW_A"] }),
    );
  });

  it("throws when find workflow use case fails", async () => {
    const user1 = User.createMock({ id: "user-1" });
    const cases = [
      Case.createMock({
        assignedUser: { id: user1.id },
        workflowCode: "WORKFLOW_A",
      }),
    ];

    const workflowError = new Error("Workflow use case failed");

    findAll.mockResolvedValue(cases);
    findUsersUseCase.mockResolvedValue([user1]);
    findWorkflowsUseCase.mockRejectedValue(workflowError);

    await expect(findCasesUseCase()).rejects.toThrow(
      "Workflow use case failed",
    );

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({ ids: [user1.id] });
    expect(findWorkflowsUseCase).toHaveBeenCalledWith(
      createUserRolesFilter(userRoles, { codes: ["WORKFLOW_A"] }),
    );
  });
});
