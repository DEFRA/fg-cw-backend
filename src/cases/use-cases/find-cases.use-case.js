import { getAuthenticatedUserRoles } from "../../common/auth.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { findAll } from "../repositories/case.repository.js";
import { mapDescription } from "./find-case-by-id.use-case.js";
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

const mapTasks = (tasks, workflowTaskGroup) =>
  tasks.map((task) => {
    const workflowTaskGroupTask = workflowTaskGroup.tasks.find(
      (wtgt) => wtgt.code === task.code,
    );
    return {
      ...task,
      name: workflowTaskGroupTask.name,
      description: mapDescription(workflowTaskGroupTask),
      statusOptions: workflowTaskGroupTask.statusOptions,
    };
  });

const mapStages = (stages, workflow) =>
  stages.map((stage) => {
    const workflowStage = workflow.stages.find((s) => s.code === stage.code);
    return {
      ...stage,
      name: workflowStage.name,
      description: workflowStage.description,
      taskGroups: stage.taskGroups.map((taskGroup) => {
        const workflowTaskGroup = workflowStage.taskGroups.find(
          (tg) => tg.code === taskGroup.code,
        );
        return {
          ...taskGroup,
          name: workflowTaskGroup.name,
          description: workflowTaskGroup.description,
          tasks: mapTasks(taskGroup.tasks, workflowTaskGroup),
        };
      }),
    };
  });

export const findCasesUseCase = async () => {
  const userRoles = Object.keys(getAuthenticatedUserRoles());
  const cases = await findAll();

  const assignedUserIds = cases.map((c) => c.assignedUser?.id).filter(Boolean);
  const workflowCodes = cases.map((c) => c.workflowCode);

  const workflowFilter = createUserRolesFilter(userRoles, {
    codes: workflowCodes,
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

    kase.requiredRoles = workflow.requiredRoles;

    const assignedUser = assignedUsers.find(
      (u) => u.id === kase.assignedUser?.id,
    );

    if (assignedUser) {
      kase.assignedUser.name = assignedUser.name;
    }

    kase.stages = mapStages(kase.stages, workflow);
    kase.timeline = mapTimeline(kase.timeline);

    acc.push(kase);
    return acc;
  }, []);

  return casesUserCanAccess;
};
