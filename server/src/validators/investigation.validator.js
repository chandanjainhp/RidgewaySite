const Joi = require('joi');

// Investigation validators
const createInvestigationSchema = Joi.object().keys({
  investigationId: Joi.string().required(),
  incident: Joi.string().required(),
  aiAgent: Joi.string(),
});

const startInvestigationSchema = Joi.object().keys({
  nightDate: Joi.string().isoDate().optional(),
});

const updateFindingsSchema = Joi.object().keys({
  findings: Joi.array().items(
    Joi.object().keys({
      category: Joi.string(),
      detail: Joi.string(),
      severity: Joi.string(),
    })
  ),
  rootCause: Joi.string(),
  recommendedActions: Joi.array().items(Joi.string()),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'escalated'),
});

const executionLogSchema = Joi.object().keys({
  action: Joi.string().required(),
  result: Joi.string().required(),
});

module.exports = {
  createInvestigationSchema,
  startInvestigationSchema,
  updateFindingsSchema,
  executionLogSchema,
};
