import Joi from "joi";

const taskSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid("radio", "select").required(),
  prompt: Joi.string().required(),
  options: Joi.array()
    .items(
      Joi.object({
        label: Joi.string().required(),
        value: Joi.string().required()
      })
    )
    .when("type", {
      is: "select",
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
});

const actionSchema = Joi.object({
  id: Joi.string().required(),
  dependsOnActionCompletion: Joi.array().items(Joi.string()).min(1).optional(),
  label: Joi.string().required(),
  tasks: Joi.array().items(taskSchema).min(1).required()
});

const actionGroupSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  actions: Joi.array().items(actionSchema).min(1)
});

const WorkflowData = Joi.object({
  workflowCode: Joi.string().required(),
  description: Joi.string().required(),
  caseRef: Joi.string().required(),
  caseName: Joi.string().required(),
  caseGroup: Joi.string().required(),
  actionGroups: Joi.array().items(actionGroupSchema).min(1).required()
}).label("WorkflowData");

const Workflow = WorkflowData.keys({
  _id: Joi.object().required()
}).label("Workflow");

export const caseSchema = {
  WorkflowData,
  Workflow
};
