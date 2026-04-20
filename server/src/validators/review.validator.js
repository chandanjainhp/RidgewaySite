import Joi from "joi";

const createReviewSchema = Joi.object({
  briefingId: Joi.string().required(),
  verdict: Joi.string()
    .valid(
      "approved",
      "approved_with_notes",
      "needs_revision",
      "rejected",
      "agreed",
      "overridden",
      "flagged"
    )
    .required(),
  comments: Joi.string().allow(""),
  suggestedChanges: Joi.array().items(Joi.string()),
});

const updateReviewSchema = Joi.object({
  verdict: Joi.string().valid(
    "approved",
    "approved_with_notes",
    "needs_revision",
    "rejected",
    "agreed",
    "overridden",
    "flagged"
  ),
  comments: Joi.string().allow(""),
  suggestedChanges: Joi.array().items(Joi.string()),
}).min(1);

export default {
  createReviewSchema,
  updateReviewSchema,
};
