import Joi from "joi";

const createInvestigationSchema = Joi.object({
  investigationId: Joi.string().required(),
  incident: Joi.string().required(),
  aiAgent: Joi.string(),
});

const startInvestigationSchema = Joi.object({
  nightDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const updateFindingsSchema = Joi.object({
  findings: Joi.array().items(
    Joi.object({
      category: Joi.string(),
      detail: Joi.string(),
      severity: Joi.string(),
    }),
  ),
  rootCause: Joi.string(),
  recommendedActions: Joi.array().items(Joi.string()),
  status: Joi.string().valid("queued", "running", "complete", "failed"),
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
