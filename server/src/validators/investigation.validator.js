import Joi from "joi";

const createInvestigationSchema = Joi.object({
  investigationId: Joi.string().required(),
  incident: Joi.string().required(),
  aiAgent: Joi.string(),
});

const startInvestigationSchema = Joi.object({
  nightDate: Joi.string().isoDate().optional(),
});

const updateFindingsSchema = Joi.object({
  findings: Joi.array().items(
    Joi.object({
      category: Joi.string(),
      detail: Joi.string(),
      severity: Joi.string(),
    })
  ),
  rootCause: Joi.string(),
  recommendedActions: Joi.array().items(Joi.string()),
  status: Joi.string().valid("pending", "in_progress", "completed", "escalated"),
});

const executionLogSchema = Joi.object({
  action: Joi.string().required(),
  result: Joi.string().required(),
});

export default {
  createInvestigationSchema,
  startInvestigationSchema,
  updateFindingsSchema,
  executionLogSchema,
};
