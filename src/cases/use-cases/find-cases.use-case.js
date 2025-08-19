import { getAuthenticatedUserRoles } from "../../common/auth.js";
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

const mapTimeline = (timeline) => {
  return (
    timeline?.map((tl) => ({
      ...tl,
      commentRef: tl.comment ? tl.comment.ref : undefined,
      comment: undefined,
    })) || []
  );
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

  // Remove any cases that the user does not have access to
  const casesFiltered = cases.reduce((acc, kase) => {
    const workflow = workflows.find((w) => w.code === kase.workflowCode);

    // We only add cases if there's a workflow that was filtered above.
    if (workflow) {
      kase.requiredRoles = workflow.requiredRoles;

      // Only then do we look up the assigned user.
      const assignedUser = users.find((u) => u.id === kase.assignedUser?.id);

      if (assignedUser) {
        kase.assignedUser.name = assignedUser.name;
      }
      kase.timeline = mapTimeline(kase.timeline);
      acc.push(kase);
    }
    return acc;
  }, []);

  return casesFiltered;
};
