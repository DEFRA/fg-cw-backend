import Boom from "@hapi/boom";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { findById } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const CASE_ASSIGNED = "CASE_ASSIGNED";
const defaultTabs = ["tasks", "caseDetails", "notes", "timeline"];

export const findCaseByIdUseCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  if (kase.assignedUser) {
    const user = await findUserByIdUseCase(kase.assignedUser.id);

    kase.assignedUser.name = user.name;
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

  // Find workflow
  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);
  const workflowTabs = workflow.pages.cases.details.tabs;
  const banner = workflow.pages.cases.details.banner;

  // Add override tabs
  const overrideTabs = defaultTabs
    .filter((tabId) => tabId in workflowTabs)
    .map((tabId) => createTabObject(tabId, workflowTabs[tabId]));

  // Add custom tabs
  const customTabs = Object.entries(workflowTabs)
    .filter(([tabId]) => !defaultTabs.includes(tabId))
    .map(([tabId, config]) => createTabObject(tabId, config));

  // Add required roles
  kase.requiredRoles = workflow.requiredRoles;

  // Add titles to the case
  const caseWithTitles = addTitles(
    kase,
    workflow,
    overrideTabs,
    customTabs,
    banner,
  );

  return caseWithTitles;
};

const populateTimelineCreatedByUser = (timelineItem, users) => {
  const createdByUser = users?.find((u) => u.id === timelineItem.createdBy);
  if (createdByUser) {
    timelineItem.createdBy = createdByUser;
  } else {
    timelineItem.createdBy = { name: "System" };
  }
};

export const findUserAssignedToCase = () => {
  return "System"; // TODO: get user who has completed the task from auth
};

const processTask = (task, wfTaskGroup) => {
  const workflowTask = wfTaskGroup.tasks.find((wt) => wt.id === task.id);

  return {
    ...task,
    title: workflowTask.title,
    type: workflowTask.type,
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

const processStage = (stage, workflow) => {
  const workflowStage = workflow.stages.find((ws) => ws.id === stage.id);

  return {
    ...stage,
    title: workflowStage.title,
    actions: workflowStage.actions,
    taskGroups: stage.taskGroups.map((taskGroup) =>
      processTaskGroup(taskGroup, workflowStage),
    ),
  };
};

const addTitles = (kase, workflow, overrideTabs, customTabs, banner) => ({
  ...kase,
  stages: kase.stages.map((stage) => processStage(stage, workflow)),
  banner,
  overrideTabs,
  customTabs,
});

const createTabObject = (tabId, tabConfig) => ({
  id: tabId,
  ...tabConfig,
});
