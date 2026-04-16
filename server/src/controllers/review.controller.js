const asyncHandler = require('../utils/async-handler');
const ApiResponse = require('../utils/api-response');
const ApiError = require('../utils/api-error');
const Review = require('../models/review.model');

// Create review
const createReview = asyncHandler(async (req, res) => {
  const { reviewId, briefing, reviewer, verdict, comments, suggestedChanges } = req.body;

  const review = await Review.create({
    reviewId,
    briefing,
    reviewer,
    verdict,
    comments,
    suggestedChanges,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, review, 'Review created successfully'));
});

// Get reviews
const getReviews = asyncHandler(async (req, res) => {
  const { verdict, limit = 10, offset = 0 } = req.query;

  const query = {};
  if (verdict) query.verdict = verdict;

  const reviews = await Review.find(query)
    .populate('briefing')
    .populate('reviewer', 'name email')
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .sort({ reviewedAt: -1 });

  const total = await Review.countDocuments(query);

  return res.status(200).json(
    new ApiResponse(200, { reviews, total, limit, offset }, 'Reviews fetched successfully')
  );
});

// Get review by ID
const getReviewById = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const review = await Review.findById(reviewId)
    .populate('briefing')
    .populate('reviewer', 'name email');

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  return res.status(200).json(new ApiResponse(200, review, 'Review fetched successfully'));
});

// Update review
const updateReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { verdict, comments, suggestedChanges } = req.body;

  const updateData = {};
  if (verdict) updateData.verdict = verdict;
  if (comments) updateData.comments = comments;
  if (suggestedChanges) updateData.suggestedChanges = suggestedChanges;

  const review = await Review.findByIdAndUpdate(reviewId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  return res.status(200).json(new ApiResponse(200, review, 'Review updated successfully'));
});

// Delete review
const deleteReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const review = await Review.findByIdAndDelete(reviewId);

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  return res.status(200).json(new ApiResponse(200, null, 'Review deleted successfully'));
});

module.exports = {
  createReview,
  getReviews,
  getReviewById,
  updateReview,
  deleteReview,
};
