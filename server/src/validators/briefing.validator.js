import Joi from "joi";

const createBriefingSchema = Joi.object({
  title: Joi.string().required(),
  summary: Joi.string().required(),
});

const updateBriefingSchema = Joi.object({
  title: Joi.string(),
  summary: Joi.string(),
}).min(1);

const updateBriefingSectionSchema = Joi.object({
  content: Joi.alternatives()
    .try(Joi.string(), Joi.object(), Joi.array())
    .required(),
});

const latestBriefingQuerySchema = Joi.object({
  nightDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const briefingIdParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

const briefingSectionParamSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
  sectionName: Joi.string().trim().min(1).required(),
});

export default {
  createBriefingSchema,
  updateBriefingSchema,
  updateBriefingSectionSchema,
  latestBriefingQuerySchema,
  briefingIdParamSchema,
  briefingSectionParamSchema,
};
