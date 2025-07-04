// middleware/rateLimiter.js - Fixed version with proper trust proxy handling
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip automatic trust proxy validation - we handle it in server.js
    validate: {
        trustProxy: false, // Disable the automatic validation
        xForwardedForHeader: false,
    }
});

const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 25, // limit each IP to 25 requests per windowMs for sensitive endpoints
    message: {
        error: 'Too many form submissions, please try again later. We are doing this to ensure that there is no Denial of Service attack on this website. You can start again in another 15 Minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
        trustProxy: false,
        xForwardedForHeader: false,
    }
});

// Verification-specific rate limiter
const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 verification requests per IP per window
    message: {
        error: 'Too many verification requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
        trustProxy: false,
        xForwardedForHeader: false,
    },
    // Store in memory (you can use Redis for distributed systems)
    store: new rateLimit.MemoryStore(),
});

module.exports = {
    limiter,
    strictLimiter,
    verificationLimiter
};