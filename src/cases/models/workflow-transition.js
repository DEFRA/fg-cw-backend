export class WorkflowTransition {
  constructor(props) {
    this.targetPosition = props.targetPosition;
    this.checkTasks = props.checkTasks;
    this.action = props.action;
  }
}
