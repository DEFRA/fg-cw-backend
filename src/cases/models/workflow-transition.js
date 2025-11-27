export class WorkflowTransition {
  constructor(props) {
    this.targetPosition = props.targetPosition;
    this.checkTasks =
      typeof props.checkTasks === "undefined" ? true : !!props.checkTasks;
    this.action = props.action;
  }
}
