// middleware/validation.js - Updated for domain validation
const { body, validationResult } = require('express-validator');
const sanitizer = require('../utils/sanitizer');

/**
 * Validate domain format in company name field
 */
const validateDomainFormat = (value) => {
  const cleanValue = value.trim().toLowerCase();
  
  // Check if it's a domain (contains a dot and valid TLD)
  const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (domainPattern.test(cleanValue)) {
    return true;
  }
  
  // Check if it contains @ symbol (email format)
  if (cleanValue.includes('@')) {
    const domain = cleanValue.split('@')[1];
    if (domain && domainPattern.test(domain)) {
      return true;
    }
  }
  
  // Check if it's a URL format
  const urlPattern = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const urlMatch = cleanValue.match(urlPattern);
  if (urlMatch && urlMatch[3]) {
    return true;
  }
  
  return false;
};

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
    .withMessage('Company domain must be between 1 and 100 characters')
    .custom((value) => {
      if (!validateDomainFormat(value)) {
        throw new Error('Please provide a valid domain format (e.g., company.com, user@company.com, https://company.com)');
      }
      return true;
    })
    .customSanitizer(sanitizer.sanitizeText),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Please check your input and try again',
      details: errorDetails,
      hints: {
        companyName: [
          'Expected formats:',
          '• company.com (just the domain)',
          '• user@company.com (any email from that domain)', 
          '• https://company.com (company website)',
          '• www.company.com (website with www)'
        ]
      }
    });
  }
  next();
};

/**
 * Additional validation for email verification endpoints
 */
const validateEmailVerification = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 254 })
    .withMessage('Email address is too long')
    .customSanitizer(sanitizer.sanitizeText),
    
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
    
  body('options.enableSMTP')
    .optional()
    .isBoolean()
    .withMessage('enableSMTP must be a boolean'),
    
  body('options.usePythonValidator')
    .optional()
    .isBoolean()
    .withMessage('usePythonValidator must be a boolean'),
    
  body('options.timeout')
    .optional()
    .isInt({ min: 5, max: 60 })
    .withMessage('Timeout must be between 5 and 60 seconds')
];

const validateBatchEmailVerification = [
  body('emails')
    .isArray({ min: 1, max: 50 })
    .withMessage('Emails must be an array with 1-50 items'),
    
  body('emails.*')
    .trim()
    .isEmail()
    .withMessage('Each email must be valid')
    .customSanitizer(sanitizer.sanitizeText),
    
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object'),
    
  body('options.concurrency')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Concurrency must be between 1 and 5'),
    
  body('options.delay')
    .optional()
    .isInt({ min: 1000, max: 10000 })
    .withMessage('Delay must be between 1000 and 10000 milliseconds')
];

/**
 * Validation for domain-only input
 */
const validateDomainInput = [
  body('domain')
    .trim()
    .custom((value) => {
      if (!validateDomainFormat(value)) {
        throw new Error('Please provide a valid domain format');
      }
      return true;
    })
    .customSanitizer(sanitizer.sanitizeText)
];

module.exports = { 
  validateContactForm, 
  handleValidationErrors,
  validateEmailVerification,
  validateBatchEmailVerification,
  validateDomainInput,
  validateDomainFormat
};