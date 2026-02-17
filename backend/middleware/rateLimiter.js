import rateLimit from 'express-rate-limit';

// Submission rate limiter (stricter for submissions)
export const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Max 15 submissions per 15 minutes
  message: { error: 'Trop de soumissions. Veuillez réessayer dans 15 minutes.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Trop de soumissions. Veuillez réessayer dans 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Search rate limiter (moderate for searches)
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 searches per minute
  message: { error: 'Trop de requêtes. Veuillez patienter.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Trop de requêtes de recherche. Veuillez patienter une minute.',
      retryAfter: Math.ceil((Date.now() + req.rateLimit.resetTime) / 1000)
    });
  }
});

// Login rate limiter (very strict for admin login)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 login attempts per 15 minutes
  message: { error: 'Trop de tentatives de connexion. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    res.status(429).json({
      error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Like/vote rate limiter (moderate for voting)
export const likeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Max 30 vote actions per 5 minutes
  message: { error: 'Trop d\'actions. Ralentissez un peu.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Trop d\'actions de vote. Ralentissez un peu.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});
