import Joi from "joi";

const updateSiteConfigSchema = Joi.object({
  name: Joi.string().trim(),
  timezone: Joi.string(),
  locationLabel: Joi.string().allow(null, ""),
  coordinates: Joi.object({
    lat: Joi.number(),
    lng: Joi.number(),
  }),
  siteGeometry: Joi.any(),
  webhookUrl: Joi.string().uri({ allowRelative: false }).allow(null, ""),
  webhookEnabled: Joi.boolean(),
  siteName: Joi.string().trim(),
}).min(1);

const updateWebhookConfigSchema = Joi.object({
  webhookUrl: Joi.string().uri({ allowRelative: false }).allow(null, ""),
  webhookEnabled: Joi.boolean(),
}).min(1);

const webhookDeliveriesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(200).optional(),
  skip: Joi.number().integer().min(0).optional(),
});

const deliveryIdParamSchema = Joi.object({
  deliveryId: Joi.string().hex().length(24).required(),
});

export default {
  updateSiteConfigSchema,
  updateWebhookConfigSchema,
  webhookDeliveriesQuerySchema,
  deliveryIdParamSchema,
};
