import Joi from "joi";

const ingestEventItemSchema = Joi.object({
  eventId: Joi.string().optional(),
  type: Joi.string()
    .valid(
      "fence_alert",
      "vehicle_entry",
      "badge_swipe_fail",
      "motion_detected",
      "environmental",
    )
    .required(),
  severity: Joi.string().valid("serious", "minor", "harmless", "uncertain"),
  description: Joi.string().allow(""),
  location: Joi.object({
    name: Joi.string().required(),
    coordinates: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
    }).required(),
    zone: Joi.string()
      .valid("perimeter", "yard", "block", "access_point", "road")
      .required(),
  }).required(),
  rawData: Joi.object(),
  timestamp: Joi.date().iso().optional(),
});

const ingestEventsSchema = Joi.alternatives().try(
  ingestEventItemSchema,
  Joi.array().items(ingestEventItemSchema).min(1),
);

const nightDateQuerySchema = Joi.object({
  nightDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const mongoIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const createEventSchema = ingestEventItemSchema.keys({
  eventId: Joi.string().required(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid("queued", "running", "complete", "failed")
    .required(),
});

const correlateSchema = Joi.object({
  correlatedEventIds: Joi.array().items(Joi.string()).required(),
});

export default {
  createEventSchema,
  ingestEventItemSchema,
  ingestEventsSchema,
  nightDateQuerySchema,
  mongoIdParamSchema,
  updateStatusSchema,
  correlateSchema,
};
