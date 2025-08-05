import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";

const CASE_ASSIGNED = "CASE_ASSIGNED";

const addTimelineInfo = async (kase) => {
  const populateTimelineCreatedByUser = (timelineItem, users) => {
    const createdByUser = users?.find((u) => u.id === timelineItem.createdBy);
    if (createdByUser) {
      timelineItem.createdBy = createdByUser;
    } else {
      timelineItem.createdBy = { name: "System" };
    }
  };

  if (kase.assignedUser) {
    const user = await findUserByIdUseCase(kase.assignedUser.id);

    if (user) {
      kase.assignedUser.name = user.name;
    }
  }

  // find timeline user data
  const createdByUserIds = kase.timeline
    .map((t) => t.createdBy)
    .filter((user) => user !== "System");

  const createdByUsers = await findUsersUseCase({
    ids: createdByUserIds,
  });

  const assignedToUserIds = kase.timeline
    .filter((t) => !!t.data?.assignedTo)
    .map((t) => t.data.assignedTo);

  const assignedToUsers = await findUsersUseCase({
    ids: assignedToUserIds,
  });

  const timeline = kase.timeline.map((tl) => {
    populateTimelineCreatedByUser(tl, createdByUsers);

    if (tl.eventType === CASE_ASSIGNED && tl.data.assignedTo) {
      const usr = assignedToUsers.find((atu) => atu.id === tl.data.assignedTo);

      tl.data.assignedTo = {
        email: usr.email,
        name: usr.name,
        id: usr.id,
      };
    }

    return tl;
  });

  kase.timeline = timeline;
};

const addStages = (kase, workflow) => {
  const processStage = (stage, workflowInfo) => {
    const workflowStage = workflowInfo.stages.find((ws) => ws.id === stage.id);

    return {
      ...stage,
      title: workflowStage.title,
      actions: workflowStage.actions,
      taskGroups: stage.taskGroups.map((taskGroup) =>
        processTaskGroup(taskGroup, workflowStage),
      ),
    };
  };

  const processTaskGroup = (taskGroup, workflowStage) => {
    const wfTaskGroup = workflowStage.taskGroups.find(
      (wtg) => wtg.id === taskGroup.id,
    );

    return {
      ...taskGroup,
      title: wfTaskGroup.title,
      tasks: taskGroup.tasks.map((task) => processTask(task, wfTaskGroup)),
    };
  };

  const processTask = (task, wfTaskGroup) => {
    const workflowTask = wfTaskGroup.tasks.find((wt) => wt.id === task.id);

    return {
      ...task,
      title: workflowTask.title,
      type: workflowTask.type,
    };
  };

  kase.stages = kase.stages.map((stage) => processStage(stage, workflow));
};

const addPages = (kase, workflow) => {
  kase.pages = workflow.pages.cases;
};

const addRequiredRoles = (kase, workflow) => {
  kase.requiredRoles = workflow.requiredRoles;
};

export const enrichCaseUseCase = async (kase, workflow) => {
  await addTimelineInfo(kase);
  addStages(kase, workflow);
  addPages(kase, workflow);
  addRequiredRoles(kase, workflow);

  return kase;
};
