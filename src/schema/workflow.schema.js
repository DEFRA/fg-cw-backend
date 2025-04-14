import Joi from "joi";

const Task = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid("radio", "select").optional(),
  inputType: Joi.string().optional(),
  prompt: Joi.string().required(),
  value: Joi.alternatives()
    .try(Joi.string().optional(), Joi.boolean().optional(), Joi.allow(null))
    .optional(),
  options: Joi.array()
    .items(
      Joi.object({
        label: Joi.string().required(),
        value: Joi.string().required()
      })
    )
    .optional()
}).label("Task");

const TaskGroup = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  dependsOnActionCompletion: Joi.array().items(Joi.string()).optional(),
  tasks: Joi.array().items(Task).required(),
  status: Joi.string()
    .valid("NOT STARTED", "IN PROGRESS", "COMPLETED", "CANNOT START YET")
    .optional()
}).label("TaskGroup");

export const TaskSection = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required(),
  taskGroups: Joi.array().items(TaskGroup).required()
}).label("TaskSection");

const WorkflowData = Joi.object({
  workflowCode: Joi.string().required(),
  description: Joi.string().required(),
  taskSections: Joi.array().items(TaskSection).required(),
  payloadSchema: Joi.object().optional()
});

const Workflow = WorkflowData.keys({
  _id: Joi.object().required()
}).label("Workflow");

export const workflowSchema = {
  WorkflowData,
  Workflow
};
