export class WorkflowDocument {
  constructor(props) {
    this._id = props._id;
    this.code = props.code;
    this.payloadDefinition = props.payloadDefinition;
    this.stages = props.stages;
  }
}
