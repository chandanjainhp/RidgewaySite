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

const listIncidentsQuerySchema = Joi.object({
  nightDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: Joi.string()
    .valid("open", "investigating", "reviewed", "escalated", "closed")
    .optional(),
  severity: Joi.string()
    .valid("serious", "minor", "harmless", "uncertain")
    .optional(),
});

const mongoIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export default {
  createIncidentSchema,
  updateIncidentSchema,
  listIncidentsQuerySchema,
  mongoIdParamSchema,
};
