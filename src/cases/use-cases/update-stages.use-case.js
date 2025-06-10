import { updateCaseStages } from "../repositories/case.repository.js";
export const updateStages = async ({ payload, stages, curStageId }) => {
  const { isComplete, caseId, taskId, groupId } = payload;

  const tasksReducer = (accTasks, curTask) => {
    if (curTask.id === taskId) {
      curTask.isComplete = isComplete;
    }
    accTasks.push(curTask);
    return accTasks;
  };

  const groupsReducer = (accTaskGroup, curTaskGroup) => {
    if (curTaskGroup.id === groupId) {
      const tasks = curTaskGroup.tasks.reduce(tasksReducer, []);
      curTaskGroup.tasks = tasks;
    }

    accTaskGroup.push(curTaskGroup);
    return accTaskGroup;
  };

  const stagesToUpdate = stages.reduce((accStage, curStage) => {
    if (curStage.id === curStageId) {
      const groups = curStage.taskGroups.reduce(groupsReducer, []);
      curStage.taskGroups = groups;
    }
    accStage.push(curStage);
    return accStage;
  }, []);

  return updateCaseStages(caseId, stagesToUpdate);
};
