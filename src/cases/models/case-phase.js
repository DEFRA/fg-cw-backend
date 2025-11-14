import Boom from "@hapi/boom";

export class CasePhase {
  constructor(props) {
    this.code = props.code;
    this.stages = props.stages;
  }

  findStage(stageCode) {
    const stage = this.stages.find((s) => s.code === stageCode);

    if (!stage) {
      throw Boom.notFound(`Cannot find Stage with code ${stageCode}`);
    }

    return stage;
  }

  getUserIds() {
    return this.stages.flatMap((s) => s.getUserIds());
  }

  isComplete(workflowPhase, statusCode) {
    for (const workflowStage of workflowPhase.stages) {
      const caseStage = this.findStage(workflowStage.code);

      if (!caseStage.isComplete(workflowStage, statusCode)) {
        return false;
      }
    }

    return true;
  }
}
