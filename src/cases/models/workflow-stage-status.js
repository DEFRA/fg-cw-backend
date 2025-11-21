export class WorkflowStageStatus {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.interactive = props.interactive;
    this.transitions = props.transitions;
  }

  getActions() {
    return this.transitions.map((t) => t.action).filter(Boolean);
  }

  getTransition(actionCode) {
    return this.transitions.find((t) => t.action?.code === actionCode);
  }
}
