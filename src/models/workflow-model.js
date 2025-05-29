export class WorkflowModel {
  constructor(props) {
    this.code = props.code;
    this.payloadDefinition = props.payloadDefinition;
    this.stages = props.stages;
  }

  static newWorkflow(data) {
    return new WorkflowModel(data);
  }
}
