import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { Workflow } from "../models/workflow.js";
import { findInCaseRefsAndWorkflowCode } from "../repositories/case-series.repository.js";
import { findAll } from "../repositories/case.repository.js";
import { createRoleFilter, findCasesUseCase } from "./find-cases.use-case.js";
import { findWorkflowCodesUseCase } from "./find-workflow-codes.use-case.js";
import { resolveWorkflowForCase } from "./resolve-current-workflow.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/case-series.repository.js");
vi.mock("../../users/use-cases/find-users.use-case.js");
vi.mock("./find-workflow-codes.use-case.js");
vi.mock("./resolve-current-workflow.use-case.js");
vi.mock("../../common/auth.js");

const defaultQuery = { direction: "forward", createdAt: "desc" };

const mockFindAllResult = (data) => ({
  data,
  pagination: {
    startCursor: null,
    endCursor: null,
    hasNextPage: false,
    hasPreviousPage: false,
    totalCount: data.length,
  },
});

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
        ],
      },
    };
    expect(createRoleFilter(userRoles)).toEqual(expectedFilters);
  });
});

describe("findCasesUseCase", () => {
  const user = User.createMock();

  beforeEach(() => {
    findWorkflowCodesUseCase.mockResolvedValue([]);
    findAll.mockResolvedValue(mockFindAllResult([]));
    findInCaseRefsAndWorkflowCode.mockResolvedValue({
      caseRefs: new Set(["case-ref"]),
    });
    resolveWorkflowForCase.mockImplementation(async (kase) => ({
      workflow: Workflow.createMock({ code: kase.workflowCode }),
      resolvedVersion: kase.originalConfigVersion ?? null,
    }));
  });

  it("finds cases without assigned users", async () => {
    const workflows = [
      Workflow.createMock({
        code: "WORKFLOW_1",
        schemeName: "Workflow One",
        requiredRoles: ["ROLE_1", "ROLE_2"],
      }),
      Workflow.createMock({
        code: "WORKFLOW_2",
        requiredRoles: ["ROLE_3"],
      }),
    ];

    const casesWithoutUsers = [
      {
        _id: "id-1",
        caseRef: "case-ref",
        workflowCode: "WORKFLOW_1",
        assignedUserId: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
      {
        _id: "id-2",
        caseRef: "case-ref",
        workflowCode: "WORKFLOW_2",
        assignedUserId: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
    ];

    findAll.mockResolvedValue(mockFindAllResult(casesWithoutUsers));
    findUsersUseCase.mockResolvedValue([]);
    findWorkflowCodesUseCase.mockResolvedValue(["WORKFLOW_1", "WORKFLOW_2"]);
    resolveWorkflowForCase.mockImplementation(async (kase) => ({
      workflow: workflows.find((w) => w.code === kase.workflowCode),
      resolvedVersion: kase.originalConfigVersion ?? null,
    }));

    const result = await findCasesUseCase({ user, query: defaultQuery });

    expect(findAll).toHaveBeenCalledWith({
      workflowCodes: ["WORKFLOW_1", "WORKFLOW_2"],
      cursor: undefined,
      direction: "forward",
      sort: {
        workflowCode: undefined,
        caseRef: undefined,
        createdAt: "desc",
      },
      pageSize: 20,
    });
    expect(findWorkflowCodesUseCase).toHaveBeenCalledWith(
      createRoleFilter(user.getRoles()),
    );
    expect(findUsersUseCase).toHaveBeenCalledWith({ ids: [] });
    expect(result).toEqual({
      pagination: mockFindAllResult(casesWithoutUsers).pagination,
      cases: [
        {
          _id: "id-1",
          assignedUser: null,
          caseRef: "case-ref",
          currentStatus: "Stage status 1",
          currentStatusTheme: "INFO",
          hasLinkedCases: false,
          createdAt: "2025-01-01T00:00:00.000Z",
          payload: {},
          workflowCode: "WORKFLOW_1",
          schemeName: "Workflow One",
        },
        {
          _id: "id-2",
          assignedUser: null,
          caseRef: "case-ref",
          currentStatus: "Stage status 1",
          currentStatusTheme: "INFO",
          hasLinkedCases: false,
          createdAt: "2025-01-01T00:00:00.000Z",
          payload: {},
          workflowCode: "WORKFLOW_2",
          schemeName: "WORKFLOW_2",
        },
      ],
    });
  });

  it("finds cases with assigned users and populates user", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const user2 = User.createMock({ id: "user-2", name: "Jane Jones" });
    const users = [user1, user2];

    const casesWithUsers = [
      {
        _id: "id-1",
        caseRef: "case-ref",
        workflowCode: "workflow-code",
        assignedUserId: user1.id,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
      {
        _id: "id-2",
        caseRef: "case-ref",
        workflowCode: "workflow-code",
        assignedUserId: user2.id,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
    ];

    findAll.mockResolvedValue(mockFindAllResult(casesWithUsers));
    findUsersUseCase.mockResolvedValue(users);
    findWorkflowCodesUseCase.mockResolvedValue(["workflow-code"]);

    const result = await findCasesUseCase({ user, query: defaultQuery });

    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, user2.id],
    });
    expect(result.cases[0].assignedUser.name).toBe(user1.name);
    expect(result.cases[1].assignedUser.name).toBe(user2.name);
  });

  it("passes workflowCode sort when requested", async () => {
    findUsersUseCase.mockResolvedValue([]);
    findWorkflowCodesUseCase.mockResolvedValue(["workflow-code"]);

    await findCasesUseCase({
      user,
      query: { direction: "forward", workflowCode: "asc", createdAt: "desc" },
    });

    expect(findAll).toHaveBeenCalledWith({
      workflowCodes: [expect.any(String)],
      cursor: undefined,
      direction: "forward",
      sort: {
        workflowCode: "asc",
        caseRef: undefined,
        createdAt: "desc",
      },
      pageSize: 20,
    });
  });

  it("finds cases with and without assigned users", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const user2 = User.createMock({ id: "user-2", name: "Jane Jones" });
    const users = [user1, user2];

    const mixedCases = [
      {
        _id: "id-1",
        caseRef: "case-ref",
        workflowCode: "workflow-code",
        assignedUserId: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
      {
        _id: "id-2",
        caseRef: "case-ref",
        workflowCode: "workflow-code",
        assignedUserId: user1.id,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
      {
        _id: "id-3",
        caseRef: "case-ref",
        workflowCode: "workflow-code",
        assignedUserId: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
      {
        _id: "id-4",
        caseRef: "case-ref",
        workflowCode: "workflow-code",
        assignedUserId: user2.id,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
    ];

    findAll.mockResolvedValue(mockFindAllResult(mixedCases));
    findUsersUseCase.mockResolvedValue(users);
    findWorkflowCodesUseCase.mockResolvedValue(["workflow-code"]);

    const result = await findCasesUseCase({ user, query: defaultQuery });

    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, user2.id],
    });
    expect(result.cases[0].assignedUser).toBeNull();
    expect(result.cases[1].assignedUser.name).toBe(user1.name);
    expect(result.cases[2].assignedUser).toBeNull();
    expect(result.cases[3].assignedUser.name).toBe(user2.name);
  });

  it("handles cases where assigned user is not found", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const users = [user1];

    const casesWithUsers = [
      {
        _id: "id-1",
        caseRef: "case-ref",
        workflowCode: "workflow-code",
        assignedUserId: user1.id,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
      {
        _id: "id-2",
        caseRef: "case-ref",
        workflowCode: "workflow-code",
        assignedUserId: "user-missing",
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
    ];

    findAll.mockResolvedValue(mockFindAllResult(casesWithUsers));
    findUsersUseCase.mockResolvedValue(users);
    findWorkflowCodesUseCase.mockResolvedValue(["workflow-code"]);

    const result = await findCasesUseCase({ user, query: defaultQuery });

    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, "user-missing"],
    });

    expect(result.cases[0].assignedUser.name).toBe(user1.name);
    expect(result.cases[1].assignedUser).toBeNull();
  });

  it("throws when user lookup fails", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const casesWithUsers = [
      {
        _id: "id-1",
        caseRef: "case-ref",
        workflowCode: "workflow-code",
        assignedUserId: user1.id,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
    ];
    const userError = new Error("Find users error");

    findAll.mockResolvedValue(mockFindAllResult(casesWithUsers));
    findUsersUseCase.mockRejectedValue(userError);
    findWorkflowCodesUseCase.mockResolvedValue(["workflow-code"]);

    await expect(
      findCasesUseCase({ user, query: defaultQuery }),
    ).rejects.toThrow("Find users error");

    expect(findUsersUseCase).toHaveBeenCalledWith({ ids: [user1.id] });
  });

  it("calls findWorkflowCodesUseCase with role filter only", async () => {
    const user1 = User.createMock({ id: "user-1" });
    const user2 = User.createMock({ id: "user-2" });

    const cases = [
      {
        _id: "id-1",
        caseRef: "case-ref",
        workflowCode: "WORKFLOW_A",
        assignedUserId: user1.id,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
      {
        _id: "id-2",
        caseRef: "case-ref",
        workflowCode: "WORKFLOW_B",
        assignedUserId: user2.id,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
      {
        _id: "id-3",
        caseRef: "case-ref",
        workflowCode: "WORKFLOW_A",
        assignedUserId: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
    ];

    findAll.mockResolvedValue(mockFindAllResult(cases));
    findUsersUseCase.mockResolvedValue([user1, user2]);
    findWorkflowCodesUseCase.mockResolvedValue(["WORKFLOW_A", "WORKFLOW_B"]);

    await findCasesUseCase({ user, query: defaultQuery });

    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, user2.id],
    });
    expect(findWorkflowCodesUseCase).toHaveBeenCalledWith(
      createRoleFilter(user.getRoles()),
    );
  });

  it("throws when find user use cases fails", async () => {
    const user1 = User.createMock({ id: "user-1" });

    findWorkflowCodesUseCase.mockResolvedValue(["WORKFLOW_A"]);

    const cases = [
      {
        _id: "id-1",
        caseRef: "case-ref",
        workflowCode: "WORKFLOW_A",
        assignedUserId: user1.id,
        createdAt: "2025-01-01T00:00:00.000Z",
        payload: {},
        position: {
          phaseCode: "PHASE_1",
          stageCode: "STAGE_1",
          statusCode: "STATUS_1",
        },
      },
    ];

    const userError = new Error("User use case failed");

    findAll.mockResolvedValue(mockFindAllResult(cases));
    findUsersUseCase.mockRejectedValue(userError);

    await expect(
      findCasesUseCase({ user, query: defaultQuery }),
    ).rejects.toThrow("User use case failed");

    expect(findUsersUseCase).toHaveBeenCalledWith({ ids: [user1.id] });
    expect(findWorkflowCodesUseCase).toHaveBeenCalledWith(
      createRoleFilter(user.getRoles()),
    );
  });

  it("throws when find workflow use case fails", async () => {
    const workflowError = new Error("Workflow use case failed");

    findWorkflowCodesUseCase.mockRejectedValue(workflowError);

    await expect(
      findCasesUseCase({ user, query: defaultQuery }),
    ).rejects.toThrow("Workflow use case failed");

    expect(findWorkflowCodesUseCase).toHaveBeenCalledWith(
      createRoleFilter(user.getRoles()),
    );
  });

  it("passes search parameter to findAll", async () => {
    findUsersUseCase.mockResolvedValue([]);
    findWorkflowCodesUseCase.mockResolvedValue(["workflow-code"]);

    await findCasesUseCase({
      user,
      query: { direction: "forward", search: "12345", createdAt: "desc" },
    });

    expect(findAll).toHaveBeenCalledWith({
      workflowCodes: [expect.any(String)],
      search: "12345",
      cursor: undefined,
      direction: "forward",
      sort: {
        workflowCode: undefined,
        caseRef: undefined,
        createdAt: "desc",
      },
      pageSize: 20,
    });
  });

  it("passes undefined search when not provided", async () => {
    findUsersUseCase.mockResolvedValue([]);
    findWorkflowCodesUseCase.mockResolvedValue(["workflow-code"]);

    await findCasesUseCase({
      user,
      query: { direction: "forward", createdAt: "desc" },
    });

    expect(findAll).toHaveBeenCalledWith({
      workflowCodes: [expect.any(String)],
      search: undefined,
      cursor: undefined,
      direction: "forward",
      sort: {
        workflowCode: undefined,
        caseRef: undefined,
        createdAt: "desc",
      },
      pageSize: 20,
    });
  });
});
