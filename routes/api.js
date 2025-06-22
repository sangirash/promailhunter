// routes/api.js - Updated with Enhanced Email Verification
const express = require('express');
const axios = require('axios');
const { validateContactForm, handleValidationErrors } = require('../middleware/validation');
const { strictLimiter } = require('../middleware/rateLimiter');
const sanitizer = require('../utils/sanitizer');
const EmailGenerator = require('../utils/emailGenerator');
const EnhancedEmailVerifier = require('../utils/enhancedEmailVerifier');

const router = express.Router();
const emailGenerator = new EmailGenerator();
const enhancedEmailVerifier = new EnhancedEmailVerifier();

// Contact form submission endpoint (with enhanced email generation)
router.post('/contact', 
  strictLimiter,
  validateContactForm,
  handleValidationErrors,
  async (req, res) => {
    try {
      const sanitizedData = sanitizer.sanitizeObject(req.body);
      
      // Generate emails with enhanced domain validation
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
            'User-Agent': 'ProMailHunter/1.0'
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
          validatedDomains: emailResult.data.metadata.validatedDomains,
          fileSaved: emailResult.file ? emailResult.file.filename : null,
          enhancedValidation: true
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

// Enhanced email generation only
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
        message: 'Email combinations generated successfully with enhanced validation',
        data: emailResult.data,
        file: emailResult.file,
        enhancedFeatures: {
          domainValidation: true,
          patternMatching: true,
          corporateIntelligence: true
        }
      });

    } catch (error) {
      console.error('Enhanced Email Generation Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to generate email combinations',
        code: 'EMAIL_GENERATION_ERROR'
      });
    }
  }
);

// Enhanced single email verification
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
        enableDeliverability: options.enableDeliverability !== false,
        usePythonValidator: options.usePythonValidator !== false,
        allowUTF8: options.allowUTF8 !== false,
        allowQuoted: options.allowQuoted !== false,
        globallyDeliverable: options.globallyDeliverable !== false,
        timeout: options.timeout || 15
      };

      console.log(`🔍 Enhanced verification for: ${sanitizedEmail}`);
      const result = await enhancedEmailVerifier.verifyEmail(sanitizedEmail, verificationOptions);

      res.json({
        success: true,
        result,
        enhanced: true,
        pythonValidatorUsed: result.finalResult?.method === 'python-email-validator'
      });

    } catch (error) {
      console.error('Enhanced Email Verification Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to verify email address',
        code: 'ENHANCED_EMAIL_VERIFICATION_ERROR'
      });
    }
  }
);

// Enhanced batch email verification
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
        enableDeliverability: options.enableDeliverability !== false,
        usePythonValidator: options.usePythonValidator !== false,
        allowUTF8: options.allowUTF8 !== false,
        allowQuoted: options.allowQuoted !== false,
        globallyDeliverable: options.globallyDeliverable !== false,
        concurrency: Math.min(options.concurrency || 3, 5),
        delay: Math.max(options.delay || 2000, 1000),
        timeout: options.timeout || 15
      };

      console.log(`🔍 Enhanced batch verification for ${sanitizedEmails.length} emails`);
      const results = await enhancedEmailVerifier.verifyEmailBatch(sanitizedEmails, verificationOptions);

      const saveResults = options.saveResults !== false;
      let fileInfo = null;
      if (saveResults) {
        fileInfo = await enhancedEmailVerifier.saveResults(results);
      }

      const summary = {
        total: results.length,
        valid: results.filter(r => r.finalResult?.valid === true).length,
        invalid: results.filter(r => r.finalResult?.valid === false).length,
        uncertain: results.filter(r => r.finalResult?.confidence === 'unknown').length,
        pythonValidated: results.filter(r => r.finalResult?.method === 'python-email-validator').length,
        corporateDomains: results.filter(r => r.finalResult?.corporateDomain === true).length
      };

      res.json({
        success: true,
        summary,
        results,
        file: fileInfo,
        enhanced: true,
        verificationMethod: 'enhanced-email-verifier'
      });

    } catch (error) {
      console.error('Enhanced Batch Email Verification Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to verify email addresses',
        code: 'ENHANCED_BATCH_EMAIL_VERIFICATION_ERROR'
      });
    }
  }
);

// Enhanced generate and verify emails
router.post('/generate-and-verify',
  strictLimiter,
  validateContactForm,
  handleValidationErrors,
  async (req, res) => {
    try {
      const sanitizedData = sanitizer.sanitizeObject(req.body);
      const { verificationOptions = {} } = req.body;
      
      console.log(`🚀 Enhanced generate and verify for ${sanitizedData.firstName} ${sanitizedData.lastName} at ${sanitizedData.companyName}`);
      
      // Generate emails with enhanced domain validation
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

      console.log(`📧 Generated ${emailResult.data.emails.all.length} emails, verifying top ${emailsToVerify.length}`);

      // Enhanced verification with Python email-validator
      const verificationResults = await enhancedEmailVerifier.verifyEmailBatch(
        emailsToVerify, 
        {
          enableSMTP: verificationOptions.enableSMTP !== false,
          enableDeliverability: verificationOptions.enableDeliverability !== false,
          usePythonValidator: verificationOptions.usePythonValidator !== false,
          allowUTF8: verificationOptions.allowUTF8 !== false,
          allowQuoted: verificationOptions.allowQuoted !== false,
          globallyDeliverable: verificationOptions.globallyDeliverable !== false,
          concurrency: 3,
          delay: 2000,
          timeout: 15
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

      const pythonValidatedEmails = verificationResults
        .filter(result => result.finalResult?.method === 'python-email-validator')
        .map(result => result.email);

      // Save combined results with enhanced metadata
      const combinedResults = {
        metadata: {
          ...emailResult.data.metadata,
          verificationTimestamp: new Date().toISOString(),
          emailsVerified: verificationResults.length,
          verificationMethod: 'enhanced-email-verifier',
          pythonValidatorUsed: enhancedEmailVerifier.pythonAvailable,
          pythonValidatedCount: pythonValidatedEmails.length,
          enhancedFeatures: {
            domainValidation: true,
            patternMatching: true,
            corporateIntelligence: true,
            pythonValidator: enhancedEmailVerifier.pythonAvailable
          }
        },
        generation: emailResult.data,
        verification: {
          results: verificationResults,
          summary: {
            total: verificationResults.length,
            valid: validEmails.length,
            invalid: invalidEmails.length,
            uncertain: uncertainEmails.length,
            pythonValidated: pythonValidatedEmails.length,
            corporateDomains: verificationResults.filter(r => r.finalResult?.corporateDomain === true).length
          },
          validEmails,
          invalidEmails,
          uncertainEmails,
          pythonValidatedEmails
        }
      };

      const fileInfo = await enhancedEmailVerifier.saveResults(
        combinedResults, 
        `enhanced_combined_${sanitizedData.firstName}_${sanitizedData.lastName}_${Date.now()}.json`
      );

      res.json({
        success: true,
        message: 'Emails generated and verified successfully with enhanced validation',
        summary: combinedResults.verification.summary,
        validEmails,
        file: fileInfo,
        enhanced: true,
        pythonValidatorUsed: enhancedEmailVerifier.pythonAvailable,
        features: combinedResults.metadata.enhancedFeatures
      });

    } catch (error) {
      console.error('Enhanced Generate and Verify Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to generate and verify emails with enhanced validation',
        code: 'ENHANCED_GENERATE_VERIFY_ERROR'
      });
    }
  }
);

// Enhanced email validator status endpoint
router.get('/verifier-status', (req, res) => {
  res.json({
    status: 'enhanced',
    pythonValidatorAvailable: enhancedEmailVerifier.pythonAvailable,
    features: {
      domainValidation: true,
      patternMatching: true,
      corporateIntelligence: true,
      pythonValidator: enhancedEmailVerifier.pythonAvailable,
      smtpVerification: true,
      batchProcessing: true
    },
    supportedDomains: enhancedEmailVerifier.corporateDomainsWithStrictSecurity.length,
    knownPatterns: Object.keys(enhancedEmailVerifier.knownValidPatterns).length,
    version: '2.0.0-enhanced'
  });
});

// Test enhanced verification endpoint
router.post('/test-enhanced-verification',
  strictLimiter,
  async (req, res) => {
    try {
      const testEmails = [
        'test@gmail.com',
        'admin@microsoft.com', 
        'user@ukg.com',
        'invalid@nonexistentdomain99999.com',
        'devesh.bhatt@ukg.com'
      ];

      console.log('🧪 Testing enhanced email verification...');
      
      const results = [];
      for (const email of testEmails) {
        try {
          const result = await enhancedEmailVerifier.verifyEmail(email, {
            enableSMTP: true,
            usePythonValidator: true,
            timeout: 10
          });
          results.push({
            email,
            ...result.finalResult,
            method: result.finalResult?.method || 'nodejs-enhanced',
            checks: result.checks?.length || 0
          });
        } catch (error) {
          results.push({
            email,
            valid: false,
            error: error.message,
            method: 'error'
          });
        }
      }

      res.json({
        success: true,
        message: 'Enhanced verification test completed',
        results,
        pythonValidatorAvailable: enhancedEmailVerifier.pythonAvailable,
        testTimestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Enhanced Verification Test Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to run enhanced verification test',
        code: 'ENHANCED_TEST_ERROR'
      });
    }
  }
);

// Download endpoints (existing ones remain the same)
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

// Health check with enhanced status
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0-enhanced',
    features: {
      enhanced: true,
      pythonValidator: enhancedEmailVerifier.pythonAvailable,
      domainValidation: true,
      corporateIntelligence: true
    }
  });
});

module.exports = router;