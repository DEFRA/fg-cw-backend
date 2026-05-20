import { logger } from "../../common/logger.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { findInCaseRefsAndWorkflowCode } from "../repositories/case-series.repository.js";
import { findAll } from "../repositories/case.repository.js";
import { findWorkflowsUseCase } from "./find-workflows.use-case.js";

export const createRoleFilter = (roles) => {
  // Checks if all roles are in userRoles. Allows the workflow roles to be empty.
  const allOf = {
    $or: [
      { $eq: [{ $ifNull: ["$requiredRoles.allOf", []] }, []] }, // allow empty roles on workflow
      { $setIsSubset: ["$requiredRoles.allOf", roles] },
    ],
  };

  // Checks any (more than one) are in userRoles. Allows the workflow roles to be empty though.
  const anyOf = {
    $or: [
      {
        $eq: [{ $ifNull: ["$requiredRoles.anyOf", []] }, []], // allow empty roles on workflow
      },
      {
        $gt: [
          {
            $size: { $setIntersection: ["$requiredRoles.anyOf", roles] },
          },
          0,
        ],
      },
    ],
  };

  return {
    $expr: {
      $and: [allOf, anyOf],
    },
  };
};

export const findCasesUseCase = async ({ user, query }) => {
  const roleFilter = createRoleFilter(user.getRoles());
  const workflows = await findWorkflowsUseCase(roleFilter);

  const results = await findAll({
    workflowCodes: workflows.map((w) => w.code),
    search: query.search,
    cursor: query.cursor,
    direction: query.direction,
    sort: {
      workflowCode: query.workflowCode,
      caseRef: query.caseRef,
      createdAt: query.createdAt ?? "desc",
    },
    pageSize: 20,
  });

  logger.info(`Finding cases for User ${user.id}`);

  const assignedUserIds = results.data
    .map((c) => c.assignedUserId)
    .filter(Boolean);

  const assignedUsers = await findUsersUseCase({
    ids: assignedUserIds,
  });

  logger.info(`Finished: Finding cases for User ${user.id}`);

  const casePromises = results.data.map(async (kase) => {
    const workflow = workflows.find((w) => w.code === kase.workflowCode);

    const series = await findInCaseRefsAndWorkflowCode(
      kase.caseRef,
      workflow.code,
    );

    const assignedUser = assignedUsers.find(
      (u) => u.id === kase.assignedUserId,
    );

    const currentStatus = workflow
      .getStage(kase.position)
      .getStatus(kase.position.statusCode);

    return {
      _id: kase._id,
      caseRef: kase.caseRef,
      workflowCode: kase.workflowCode,
      createdAt: kase.createdAt,
      currentStatus: currentStatus.name,
      currentStatusTheme: currentStatus.theme,
      hasLinkedCases: series.caseRefs.size > 1,
      assignedUser: assignedUser
        ? {
            id: assignedUser.id,
            name: assignedUser.name,
          }
        : null,
      payload: kase.payload,
    };
  });

  const cases = await Promise.all(casePromises);

  return {
    pagination: results.pagination,
    cases,
  };
};
