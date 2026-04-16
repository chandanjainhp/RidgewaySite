const Joi = require('joi');

// Review validators
const createReviewSchema = Joi.object().keys({
  reviewId: Joi.string().required(),
  briefing: Joi.string().required(),
  reviewer: Joi.string().required(),
  verdict: Joi.string().valid('approved', 'needs_revision', 'rejected').required(),
  comments: Joi.string(),
  suggestedChanges: Joi.array().items(Joi.string()),
});

const updateReviewSchema = Joi.object().keys({
  verdict: Joi.string().valid('approved', 'needs_revision', 'rejected'),
  comments: Joi.string(),
  suggestedChanges: Joi.array().items(Joi.string()),
}).min(1);

module.exports = {
  createReviewSchema,
  updateReviewSchema,
};
