export class WorkflowModel {
  constructor({ _id, code, payloadDefinition, stages }) {
    this._id = _id ?? null;
    this.code = code;
    this.payloadDefinition = payloadDefinition;
    this.stages = stages;
  }

  static newWorkflow(data) {
    return new WorkflowModel(data);
  }

  static existingWorkflow(data) {
    return new WorkflowModel(data);
  }
}
