import { Payload } from "./case-payload-model.js";

export class CaseModel {
  constructor({ _id, caseRef, workflowCode, payload, stages }, options = {}) {
    this._id = _id || null;
    this.caseRef = caseRef;
    this.workflowCode = workflowCode;
    this.payload = new Payload(payload);
    this.stages = stages;
    this.status = options.status || null;
    this.dateReceived = options.dateReceived || null;
  }

  static newCase(data) {
    return new CaseModel(data, {
      status: "NEW",
      dateReceived: new Date().toISOString()
    });
  }

  static exitsingCase(data) {
    return new CaseModel(data);
  }
}
