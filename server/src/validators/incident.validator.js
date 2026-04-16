const Joi = require('joi');

// Incident validators
const createIncidentSchema = Joi.object().keys({
  incidentId: Joi.string().required(),
  events: Joi.array().items(Joi.string()),
  severity: Joi.string().valid('critical', 'high', 'medium', 'low').required(),
  title: Joi.string().required(),
  description: Joi.string(),
  tags: Joi.array().items(Joi.string()),
});

const updateIncidentSchema = Joi.object().keys({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed'),
  assignedTo: Joi.string(),
  severity: Joi.string().valid('critical', 'high', 'medium', 'low'),
  description: Joi.string(),
}).min(1);

module.exports = {
  createIncidentSchema,
  updateIncidentSchema,
};
