import Review from "../models/review.model.js";
import { ApiResponse } from "../utils/api-response.js";

const startAndEndOfDay = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export const createReview = async (req, res) => {
  const review = await Review.create({
    reviewId: `REVIEW-${Date.now()}`,
    briefingId: req.body.briefingId,
    reviewer: req.user?._id,
    verdict: req.body.verdict,
    comments: req.body.comments,
    suggestedChanges: req.body.suggestedChanges || [],
    reviewedAt: new Date(),
  });

  res
    .status(201)
    .json(new ApiResponse(201, review, "Review created successfully"));
};

export const getReviewsForNight = async (req, res) => {
  const date = req.params.date || req.query.date || new Date().toISOString().split("T")[0];
  const { start, end } = startAndEndOfDay(date);

  const reviews = await Review.find({
    reviewedAt: { $gte: start, $lte: end },
  })
    .sort({ reviewedAt: -1 })
    .lean();

  res
    .status(200)
    .json(new ApiResponse(200, reviews, "Reviews fetched successfully"));
};
