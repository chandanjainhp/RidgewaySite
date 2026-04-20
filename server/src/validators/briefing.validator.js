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

export default {
  createBriefingSchema,
  updateBriefingSchema,
  updateBriefingSectionSchema,
};
