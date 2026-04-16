import rateLimit from 'express-rate-limit';

const createLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
};

const apiLimiter = createLimiter(15 * 60 * 1000, 100);
const authLimiter = createLimiter(15 * 60 * 1000, 5);

export { apiLimiter, authLimiter, createLimiter };
