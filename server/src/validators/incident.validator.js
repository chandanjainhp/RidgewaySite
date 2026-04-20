import Joi from "joi";

const createIncidentSchema = Joi.object({
  incidentId: Joi.string().required(),
  events: Joi.array().items(Joi.string()),
  severity: Joi.string().valid("critical", "high", "medium", "low").required(),
  title: Joi.string().required(),
  description: Joi.string(),
  tags: Joi.array().items(Joi.string()),
});

const updateIncidentSchema = Joi.object({
  status: Joi.string().valid("open", "in_progress", "resolved", "closed"),
  assignedTo: Joi.string(),
  severity: Joi.string().valid("critical", "high", "medium", "low"),
  description: Joi.string(),
}).min(1);

export default {
  createIncidentSchema,
  updateIncidentSchema,
};
