// middleware/auth.js
const auth = (req, res, next) => {
  // For now, just pass through
  // Add actual authentication logic here when needed
  next();
};

module.exports = auth;