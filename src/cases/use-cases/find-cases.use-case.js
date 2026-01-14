import { logger } from "../../common/logger.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { findAll } from "../repositories/case.repository.js";
import { findWorkflowsUseCase } from "./find-workflows.use-case.js";

export const createUserRolesFilter = (userRoles, extrafilters = {}) => {
  // Checks if all roles are in userRoles. Allows the workflow roles to be empty.
  const allOf = {
    $or: [
      { $eq: [{ $ifNull: ["$requiredRoles.allOf", []] }, []] }, // allow empty roles on workflow
      { $setIsSubset: ["$requiredRoles.allOf", userRoles] },
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
            $size: { $setIntersection: ["$requiredRoles.anyOf", userRoles] },
          },
          0,
        ],
      },
    ],
  };

  return {
    $expr: {
      $and: [allOf, anyOf, extrafilters],
    },
  };
};

export const findCasesUseCase = async (user) => {
  const cases = await findAll();

  logger.info(`Finding cases for User ${user.id}`);

  const assignedUserIds = cases.map((c) => c.assignedUser?.id).filter(Boolean);
  const workflowCodes = cases.map((c) => c.workflowCode);

  const workflowFilter = createUserRolesFilter(user.getRoles(), {
    codes: Array.from(new Set(workflowCodes)),
  });

  const [assignedUsers, workflowsUserCanAccess] = await Promise.all([
    findUsersUseCase({
      ids: assignedUserIds,
    }),
    findWorkflowsUseCase(workflowFilter),
  ]);

  const casesUserCanAccess = cases.reduce((acc, kase) => {
    const workflow = workflowsUserCanAccess.find(
      (w) => w.code === kase.workflowCode,
    );

    if (!workflow) {
      return acc;
    }

    const assignedUser = assignedUsers.find(
      (u) => u.id === kase.assignedUser?.id,
    );

    const currentStatus = workflow
      .getStage(kase.position)
      .getStatus(kase.position.statusCode);

    const result = {
      _id: kase._id,
      caseRef: kase.caseRef,
      workflowCode: kase.workflowCode,
      dateReceived: kase.dateReceived,
      currentStatus: currentStatus.name,
      currentStatusTheme: currentStatus.theme,
      assignedUser: assignedUser
        ? {
            id: assignedUser.id,
            name: assignedUser.name,
          }
        : null,
      payload: kase.payload,
    };

    acc.push(result);
    return acc;
  }, []);

  logger.info(`Finished: Finding cases for User ${user.id}`);

  return casesUserCanAccess;
};
