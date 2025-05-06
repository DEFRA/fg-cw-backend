import Joi from "joi";

const WorkflowData = Joi.object({
  code: Joi.string()
    .pattern(/^[a-zA-Z0-9-]+$/)
    .required(),
  payloadDefinition: Joi.object().min(1).required()
});

const Workflow = WorkflowData.keys({
  _id: Joi.object().required()
}).label("Workflow");

export const workflowSchema = {
  WorkflowData,
  Workflow
};
