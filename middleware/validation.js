const { body, validationResult } = require('express-validator');
const sanitizer = require('../utils/sanitizer');

const validateContactForm = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
    .customSanitizer(sanitizer.sanitizeText),
    
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes')
    .customSanitizer(sanitizer.sanitizeText),
    
  body('companyName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Company name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s&.,-]+$/)
    .withMessage('Company name contains invalid characters')
    .customSanitizer(sanitizer.sanitizeText),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

module.exports = { validateContactForm, handleValidationErrors };