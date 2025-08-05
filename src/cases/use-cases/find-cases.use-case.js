import { getAuthenticatedUserRoles } from "../../common/auth.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { findAll } from "../repositories/case.repository.js";
import { enrichCaseUseCase } from "./enrich-case.use-case.js";
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

export const findCasesUseCase = async () => {
  const userRoles = Object.keys(getAuthenticatedUserRoles());
  const cases = await findAll();

  const assignedUserIds = cases.map((c) => c.assignedUser?.id).filter(Boolean);
  const workflowCodes = cases.map((c) => c.workflowCode);

  const workflowFilter = createUserRolesFilter(userRoles, {
    codes: workflowCodes,
  });

  const [users, workflows] = await Promise.all([
    findUsersUseCase({
      ids: assignedUserIds,
    }),
    findWorkflowsUseCase(workflowFilter),
  ]);

  // Remove any cases that the user does not have access to and enrich them concurrently
  const casePromises = cases.map(async (kase) => {
    const workflow = workflows.find((w) => w.code === kase.workflowCode);

    if (workflow) {
      kase.requiredRoles = workflow.requiredRoles;

      const assignedUser = users.find((u) => u.id === kase.assignedUser?.id);

      if (assignedUser) {
        kase.assignedUser.name = assignedUser.name;
      }

      const enrichedCase = await enrichCaseUseCase(kase, workflow);
      return enrichedCase;
    }

    return null; // Return null for cases without matching workflows
  });

  const enrichedCases = await Promise.all(casePromises);

  // Filter out null values (cases without matching workflows)
  const casesFiltered = enrichedCases.filter(Boolean);

  return casesFiltered;
};
