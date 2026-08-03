import { logger } from "../../common/logger.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { findInCaseRefsAndWorkflowCode } from "../repositories/case-series.repository.js";
import { findAll } from "../repositories/case.repository.js";
import { findWorkflowsUseCase } from "./find-workflows.use-case.js";
import {
  persistResolvedVersion,
  resolveWorkflowForCase,
} from "./resolve-current-workflow.use-case.js";

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

const findAssignedUser = (assignedUsers, kase) =>
  assignedUsers.find((u) => u.id === kase.assignedUserId) ?? null;

const formatAssignedUser = (assignedUser) =>
  assignedUser ? { id: assignedUser.id, name: assignedUser.name } : null;

const enrichCase = async (kase, workflowMemo, assignedUsers) => {
  const { workflow, resolvedVersion } = await resolveWorkflowForCase(
    kase,
    workflowMemo,
  );
  await persistResolvedVersion(kase, resolvedVersion);

  const series = await findInCaseRefsAndWorkflowCode(
    kase.caseRef,
    kase.workflowCode,
  );

  const assignedUser = findAssignedUser(assignedUsers, kase);
  const currentStatus = workflow
    .getStage(kase.position)
    .getStatus(kase.position.statusCode);

  return {
    _id: kase._id,
    caseRef: kase.caseRef,
    workflowCode: kase.workflowCode,
    schemeName: workflow.getSchemeName(),
    createdAt: kase.createdAt,
    currentStatus: currentStatus.name,
    currentStatusTheme: currentStatus.theme,
    hasLinkedCases: series.caseRefs.size > 1,
    assignedUser: formatAssignedUser(assignedUser),
    payload: kase.payload,
  };
};

// Returns a minimal case representation when workflow resolution fails (e.g. S3
// unavailable, config version missing). Prevents a single broken case from
// taking down the entire paginated list response.
const buildDegradedCase = (kase, assignedUsers) => ({
  _id: kase._id,
  caseRef: kase.caseRef,
  workflowCode: kase.workflowCode,
  createdAt: kase.createdAt,
  currentStatus: "Unknown",
  currentStatusTheme: null,
  hasLinkedCases: false,
  assignedUser: formatAssignedUser(findAssignedUser(assignedUsers, kase)),
  payload: kase.payload,
});

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

  // Per-request memo so a paged list resolves each (code, major) once instead
  // of issuing a config-version lookup per case.
  const workflowMemo = new Map();

  const casePromises = results.data.map(async (kase) => {
    try {
      return await enrichCase(kase, workflowMemo, assignedUsers);
    } catch (err) {
      logger.warn(
        err,
        `Failed to resolve workflow for case ${kase.caseRef}, returning degraded`,
      );
      return buildDegradedCase(kase, assignedUsers);
    }
  });

  const cases = await Promise.all(casePromises);

  return {
    pagination: results.pagination,
    cases,
  };
};
