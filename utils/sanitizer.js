const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const sanitizeText = (value) => {
  // Remove any HTML/script tags and potentially dangerous characters
  let sanitized = DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
  
  // Additional sanitization for SQL injection prevention
  sanitized = sanitized.replace(/['";\\]/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');
  
  return sanitized.trim();
};

const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

module.exports = { sanitizeText, sanitizeObject };