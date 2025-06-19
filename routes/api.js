const express = require('express');
const axios = require('axios');
const { validateContactForm, handleValidationErrors } = require('../middleware/validation');
const { strictLimiter } = require('../middleware/rateLimiter');
const sanitizer = require('../utils/sanitizer');

const router = express.Router();

// Contact form submission endpoint
router.post('/contact', 
  strictLimiter,
  validateContactForm,
  handleValidationErrors,
  async (req, res) => {
    try {
      // Sanitize input data
      const sanitizedData = sanitizer.sanitizeObject(req.body);
      
      // Prepare data for external API
      const apiPayload = {
        title: 'Contact Form Submission',
        body: `Name: ${sanitizedData.firstName} ${sanitizedData.lastName}, Company: ${sanitizedData.companyName}`,
        userId: 1
      };

      // Call external REST API (using JSONPlaceholder as example)
      const apiResponse = await axios.post(
        `${process.env.API_BASE_URL}/posts`,
        apiPayload,
        {
          timeout: process.env.API_TIMEOUT || 5000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SecureContactApp/1.0'
          }
        }
      );

      // Return sanitized response
      const response = {
        success: true,
        message: 'Form submitted successfully',
        submittedData: {
          firstName: sanitizedData.firstName,
          lastName: sanitizedData.lastName,
          companyName: sanitizedData.companyName
        },
        apiResponse: {
          id: apiResponse.data.id,
          title: apiResponse.data.title,
          status: 'submitted'
        }
      };

      res.json(response);

    } catch (error) {
      console.error('API Error:', error.message);
      
      // Don't expose internal error details
      res.status(500).json({
        success: false,
        error: 'Failed to process your request. Please try again later.',
        code: 'API_ERROR'
      });
    }
  }
);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;