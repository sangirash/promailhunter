const express = require('express');
const axios = require('axios');
const { validateContactForm, handleValidationErrors } = require('../middleware/validation');
const { strictLimiter } = require('../middleware/rateLimiter');
const sanitizer = require('../utils/sanitizer');
const EmailGenerator = require('../utils/emailGenerator');
const EmailVerifier = require('../utils/emailVerifier');

const router = express.Router();
const emailGenerator = new EmailGenerator();
const emailVerifier = new EmailVerifier();

// Contact form submission endpoint (with email generation)
router.post('/contact', 
  strictLimiter,
  validateContactForm,
  handleValidationErrors,
  async (req, res) => {
    try {
      const sanitizedData = sanitizer.sanitizeObject(req.body);
      
      // Generate emails
      const emailResult = await emailGenerator.processContact(
        sanitizedData.firstName,
        sanitizedData.lastName,
        sanitizedData.companyName,
        true // Save to file
      );
      
      // Call external API
      const apiPayload = {
        title: 'Contact Form Submission',
        body: `Name: ${sanitizedData.firstName} ${sanitizedData.lastName}, Company: ${sanitizedData.companyName}`,
        userId: 1
      };

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

      res.json({
        success: true,
        message: 'Form submitted successfully',
        submittedData: sanitizedData,
        apiResponse: {
          id: apiResponse.data.id,
          title: apiResponse.data.title,
          status: 'submitted'
        },
        emailGeneration: {
          totalEmails: emailResult.data.emails.all.length,
          companyEmails: emailResult.data.emails.company.length,
          commonProviderEmails: emailResult.data.emails.commonProviders.length,
          totalDomains: emailResult.data.domains.all.length,
          fileSaved: emailResult.file ? emailResult.file.filename : null
        }
      });

    } catch (error) {
      console.error('API Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to process your request. Please try again later.',
        code: 'API_ERROR'
      });
    }
  }
);

// Email generation only
router.post('/generate-emails',
  strictLimiter,
  validateContactForm,
  handleValidationErrors,
  async (req, res) => {
    try {
      const sanitizedData = sanitizer.sanitizeObject(req.body);
      
      const emailResult = await emailGenerator.processContact(
        sanitizedData.firstName,
        sanitizedData.lastName,
        sanitizedData.companyName,
        req.query.save !== 'false'
      );

      res.json({
        success: true,
        message: 'Email combinations generated successfully',
        data: emailResult.data,
        file: emailResult.file
      });

    } catch (error) {
      console.error('Email Generation Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to generate email combinations',
        code: 'EMAIL_GENERATION_ERROR'
      });
    }
  }
);

// Simple email format endpoint
router.post('/emails-simple',
  strictLimiter,
  validateContactForm,
  handleValidationErrors,
  async (req, res) => {
    try {
      const sanitizedData = sanitizer.sanitizeObject(req.body);
      
      const emails = emailGenerator.generateEmails(
        sanitizedData.firstName,
        sanitizedData.lastName,
        sanitizedData.companyName
      );

      res.json({ emails: emails });

    } catch (error) {
      console.error('Simple Email Generation Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to generate email list',
        code: 'SIMPLE_EMAIL_ERROR'
      });
    }
  }
);

// Single email verification
router.post('/verify-email',
  strictLimiter,
  async (req, res) => {
    try {
      const { email, options = {} } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email address is required'
        });
      }

      const sanitizedEmail = sanitizer.sanitizeText(email);
      const verificationOptions = {
        enableSMTP: options.enableSMTP !== false,
        enableEmailPing: options.enableEmailPing === true
      };

      const result = await emailVerifier.verifyEmail(sanitizedEmail, verificationOptions);

      res.json({
        success: true,
        result
      });

    } catch (error) {
      console.error('Email Verification Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to verify email address',
        code: 'EMAIL_VERIFICATION_ERROR'
      });
    }
  }
);

// Batch email verification
router.post('/verify-emails-batch',
  strictLimiter,
  async (req, res) => {
    try {
      const { emails, options = {} } = req.body;
      
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Array of email addresses is required'
        });
      }

      if (emails.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 50 emails per batch'
        });
      }

      const sanitizedEmails = emails.map(email => sanitizer.sanitizeText(email));
      const verificationOptions = {
        enableSMTP: options.enableSMTP !== false,
        enableEmailPing: options.enableEmailPing === true,
        concurrency: Math.min(options.concurrency || 3, 5),
        delay: Math.max(options.delay || 2000, 1000)
      };

      const results = await emailVerifier.verifyEmailBatch(sanitizedEmails, verificationOptions);

      const saveResults = options.saveResults !== false;
      let fileInfo = null;
      if (saveResults) {
        fileInfo = await emailVerifier.saveResults(results);
      }

      const summary = {
        total: results.length,
        valid: results.filter(r => r.finalResult?.valid === true).length,
        invalid: results.filter(r => r.finalResult?.valid === false).length,
        uncertain: results.filter(r => r.finalResult?.confidence === 'unknown').length
      };

      res.json({
        success: true,
        summary,
        results,
        file: fileInfo
      });

    } catch (error) {
      console.error('Batch Email Verification Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to verify email addresses',
        code: 'BATCH_EMAIL_VERIFICATION_ERROR'
      });
    }
  }
);

// Generate and verify emails
router.post('/generate-and-verify',
  strictLimiter,
  validateContactForm,
  handleValidationErrors,
  async (req, res) => {
    try {
      const sanitizedData = sanitizer.sanitizeObject(req.body);
      const { verificationOptions = {} } = req.body;
      
      // Generate emails
      const emailResult = await emailGenerator.processContact(
        sanitizedData.firstName,
        sanitizedData.lastName,
        sanitizedData.companyName,
        false
      );

      // Get emails to verify
      const emailsToVerify = emailResult.data.emails.all.slice(0, 
        parseInt(req.query.limit) || 30
      );

      // Verify emails
      const verificationResults = await emailVerifier.verifyEmailBatch(
        emailsToVerify, 
        {
          ...verificationOptions,
          enableSMTP: verificationOptions.enableSMTP !== false,
          enableEmailPing: false,
          concurrency: 3,
          delay: 2000
        }
      );

      // Organize results
      const validEmails = verificationResults
        .filter(result => result.finalResult?.valid === true)
        .map(result => result.email);

      const invalidEmails = verificationResults
        .filter(result => result.finalResult?.valid === false)
        .map(result => result.email);

      const uncertainEmails = verificationResults
        .filter(result => result.finalResult?.confidence === 'unknown')
        .map(result => result.email);

      // Save combined results
      const combinedResults = {
        metadata: {
          ...emailResult.data.metadata,
          verificationTimestamp: new Date().toISOString(),
          emailsVerified: verificationResults.length
        },
        generation: emailResult.data,
        verification: {
          results: verificationResults,
          summary: {
            total: verificationResults.length,
            valid: validEmails.length,
            invalid: invalidEmails.length,
            uncertain: uncertainEmails.length
          },
          validEmails,
          invalidEmails,
          uncertainEmails
        }
      };

      const fileInfo = await emailVerifier.saveResults(
        combinedResults, 
        `combined_${sanitizedData.firstName}_${sanitizedData.lastName}_${Date.now()}.json`
      );

      res.json({
        success: true,
        message: 'Emails generated and verified successfully',
        summary: combinedResults.verification.summary,
        validEmails,
        file: fileInfo
      });

    } catch (error) {
      console.error('Generate and Verify Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to generate and verify emails',
        code: 'GENERATE_VERIFY_ERROR'
      });
    }
  }
);

// Download endpoints
router.get('/download-emails/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const path = require('path');
    const filePath = path.join(process.cwd(), 'generated_emails', filename);
    
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    res.download(filePath, (err) => {
      if (err) {
        res.status(404).json({ error: 'File not found' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

router.get('/download-verification/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const path = require('path');
    const filePath = path.join(process.cwd(), 'email_verification_results', filename);
    
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    res.download(filePath, (err) => {
      if (err) {
        res.status(404).json({ error: 'File not found' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;