import Boom from "@hapi/boom";

export class CasePhase {
  constructor(props) {
    this.code = props.code;
    this.stages = props.stages;
  }

  hasStage(stageCode) {
    return this.stages.some((s) => s.code === stageCode);
  }

  findStage(stageCode) {
    const stage = this.stages.find((s) => s.code === stageCode);

    if (!stage) {
      throw Boom.notFound(`Cannot find Stage with code ${stageCode}`);
    }

    return stage;
  }

  addStage(caseStage) {
    this.stages.push(caseStage);
  }

  getUserIds() {
    return this.stages.flatMap((s) => s.getUserIds());
  }

  areTasksComplete(workflowPhase) {
    for (const workflowStage of workflowPhase.stages) {
      if (!this.hasStage(workflowStage.code)) {
        return false;
      }

      const caseStage = this.findStage(workflowStage.code);

      if (!caseStage.areTasksComplete(workflowStage)) {
        return false;
      }
    }

    return true;
  }
}
