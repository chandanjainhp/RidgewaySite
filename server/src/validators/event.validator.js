import Joi from "joi";

const createEventSchema = Joi.object({
  eventId: Joi.string().required(),
  type: Joi.string()
    .valid(
      "fence_alert",
      "vehicle_detected",
      "badge_fail",
      "motion_sensor",
      "light_anomaly",
      "drone_observation"
    )
    .required(),
  severity: Joi.string().valid("unknown", "harmless", "monitor", "escalate"),
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
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid("queued", "running", "complete", "failed", "incomplete")
    .required(),
});

const correlateSchema = Joi.object({
  correlatedEventIds: Joi.array().items(Joi.string()).required(),
});

const applyReviewSchema = Joi.object({
  decision: Joi.string().valid("agreed", "overridden", "flagged").required(),
  overrideSeverity: Joi.string()
    .valid("harmless", "monitor", "escalate")
    .when("decision", {
      is: "overridden",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  note: Joi.string().allow(""),
});

export default {
  createEventSchema,
  updateStatusSchema,
  correlateSchema,
  applyReviewSchema,
};
