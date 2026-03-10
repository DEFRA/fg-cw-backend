import Boom from "@hapi/boom";
import Joi from "joi";

export class CaseSeries {
  static validationSchema = Joi.object({
    caseRefs: Joi.array().items(Joi.string()).required(),
    workflowCode: Joi.string().required(),
    latestCaseId: Joi.string().required(),
    latestCaseRef: Joi.string().required(),
    updatedAt: Joi.string().required(),
    createdAt: Joi.string().required(),
  });

  constructor(props) {
    const { error } = CaseSeries.validationSchema.validate(props, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid CaseSeries: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this._id = props._id;
    this.caseRefs = new Set(props.caseRefs);
    this.workflowCode = props.workflowCode;
    this.latestCaseRef = props.latestCaseRef;
    this.latestCaseId = props.latestCaseId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  addCaseRef(caseRef, caseId) {
    if (!caseRef) {
      throw Boom.badData("CaseSeries can not be updated, caseRef is missing.");
    }

    if (!caseId) {
      throw Boom.badData("CaseSeries can not be updated, caseId is missing.");
    }

    this.caseRefs.add(caseRef);
    this.latestCaseId = caseId;
    this.latestCaseRef = caseRef;
    this.updatedAt = new Date(Date.now()).toISOString();
  }

  static new({ workflowCode, caseRef, caseId }) {
    const date = new Date(Date.now()).toISOString();
    return new CaseSeries({
      caseRefs: [caseRef],
      workflowCode,
      latestCaseRef: caseRef,
      latestCaseId: caseId,
      createdAt: date,
      updatedAt: date,
    });
  }

  static fromDocument({
    caseRefs,
    _id,
    workflowCode,
    latestCaseId,
    latestCaseRef,
    createdAt,
    updatedAt,
  }) {
    return new CaseSeries({
      _id,
      caseRefs,
      workflowCode,
      latestCaseId,
      latestCaseRef,
      createdAt,
      updatedAt,
    });
  }

  toDocument() {
    return {
      _id: this._id,
      caseRefs: Array.from(this.caseRefs),
      workflowCode: this.workflowCode,
      latestCaseRef: this.latestCaseRef,
      latestCaseId: this.latestCaseId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
