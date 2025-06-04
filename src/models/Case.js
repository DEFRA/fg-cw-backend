export class Case {
  constructor(props) {
    this._id = props._id;
    this.caseRef = props.caseRef;
    this.workflowCode = props.workflowCode;
    this.status = props.status;
    this.dateReceived = props.dateReceived;
    this.priority = props.priority;
    this.payload = props.payload;
    this.currentStage = props.currentStage;
    this.stages = props.stages;
  }
}
