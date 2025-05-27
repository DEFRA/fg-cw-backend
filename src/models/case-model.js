export class CaseClass {

  constructor(props, options = {}) {
    this.caseRef = props.caseRef;
    this.workflowCode = props.workflowCode;
    this.payload = new Payload(props.payload);
    this.stages = props.stages;
    this.status = options.status || null;
    this.dateReceived = options.dateReceived || null;
  }

  static newCase(data) {
    return new CaseClass(data, {
       status: "NEW",
       dateReceived: new Date().toISOString()
    });
  }
}

class Payload {
  constructor(props) {
    this.clientRef = props.clientRef;
    this.code = props.code;
    this.createdAt = props.createdAt;
    this.submittedAt = props.submittedAt;
    this.identifiers = new Identifier(props.identifiers);
    this.answers = new Answers(props.answers);
  }
}

class Identifier {
  constructor(props) {
    this.sbi = props.sbi;
    this.crn = props.crn;
    this.defraId = props.defraId;
    this.frn = props.frn;
  }
}

class Answers {
  constructor(props) {
    this.agreementName = props.agreementName;
    this.scheme = props.scheme;
    this.year = props.year;
    this.hasCheckedLandIsUpToDate = props.hasCheckedLandIsUpToDate;
    this.actionApplications = Array.isArray(props.actionApplications)
      ? props.actionApplications.map(item => new ActionApplications(item))
      : [];

  }
}

class ActionApplications {
  constructor(props) {
    this.parcelId = props.parcelId;
    this.sheetId = props.sheetId;
    this.code = props.code;
    this.appliedFor = props.appliedFor;
  }
}
