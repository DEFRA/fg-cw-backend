export class WorkflowStageStatus {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.theme = props.theme;
    this.description = props.description;
    this.interactive = props.interactive;
    this.transitions = props.transitions;
    this.closes = props.closes;
  }

  getActions() {
    return this.transitions.map((t) => t.action).filter(Boolean);
  }

  getTransition(actionCode) {
    return this.transitions.find((t) => t.action?.code === actionCode);
  }
}
