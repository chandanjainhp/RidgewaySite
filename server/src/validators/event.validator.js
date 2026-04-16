const Joi = require('joi');

// Event validators
const createEventSchema = Joi.object().keys({
  eventId: Joi.string().required(),
  type: Joi.string().valid('drone_malfunction', 'system_anomaly', 'security_breach', 'operational_issue').required(),
  severity: Joi.string().valid('critical', 'high', 'medium', 'low'),
  source: Joi.string().required(),
  description: Joi.string().required(),
  location: Joi.object().keys({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
  }),
  metadata: Joi.object(),
});

const updateStatusSchema = Joi.object().keys({
  status: Joi.string().valid('new', 'acknowledged', 'under_investigation', 'resolved').required(),
});

const correlateSchema = Joi.object().keys({
  correlatedEventIds: Joi.array().items(Joi.string()).required(),
});

const applyReviewSchema = Joi.object().keys({
  decision: Joi.string().valid('confirmed', 'disputed', 'needs_clarification').required(),
  override: Joi.string(),
  flagDetails: Joi.string(),
});

module.exports = {
  createEventSchema,
  updateStatusSchema,
  correlateSchema,
  applyReviewSchema,
};
