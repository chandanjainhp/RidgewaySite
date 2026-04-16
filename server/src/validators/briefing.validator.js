const Joi = require('joi');

// Briefing validators
const createBriefingSchema = Joi.object().keys({
  briefingId: Joi.string().required(),
  investigation: Joi.string().required(),
  title: Joi.string().required(),
  summary: Joi.string().required(),
  highlights: Joi.array().items(Joi.string()),
  audience: Joi.string().valid('operator', 'manager', 'executive'),
  attachments: Joi.array().items(Joi.string()),
  aiGenerated: Joi.boolean(),
  generatedBy: Joi.string(),
});

const updateBriefingSchema = Joi.object().keys({
  title: Joi.string(),
  summary: Joi.string(),
  highlights: Joi.array().items(Joi.string()),
  attachments: Joi.array().items(Joi.string()),
}).min(1);

const updateBriefingSectionSchema = Joi.object().keys({
  sectionName: Joi.string().required(),
  content: Joi.object().required(),
});

module.exports = {
  createBriefingSchema,
  updateBriefingSchema,
  updateBriefingSectionSchema,
};
