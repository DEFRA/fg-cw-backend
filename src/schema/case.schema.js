import Joi from "joi";

const Task = Joi.object({
  id: Joi.string(),
  value: Joi.allow(null)
}).label("Task");

const Action = Joi.object({
  id: Joi.string(),
  tasks: Joi.array().items(Task),
  status: Joi.string()
}).label("Action");

const ActionGroup = Joi.object({
  id: Joi.string(),
  actions: Joi.array().items(Action)
}).label("ActionGroup");

const CaseData = Joi.object({
  id: Joi.string(),
  workflowId: Joi.string(),
  caseRef: Joi.string(),
  caseType: Joi.string(),
  caseName: Joi.string(),
  businessName: Joi.string(),
  status: Joi.string(),
  dateReceived: Joi.string(),
  targetDate: Joi.string(),
  priority: Joi.string(),
  assignedUser: Joi.string(),
  actionGroups: Joi.array().items(ActionGroup)
}).label("CaseData");

const Case = CaseData.keys({
  _id: Joi.object().required()
}).label("Case");

export const caseSchema = {
  CaseData,
  Case
};
