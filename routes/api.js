// routes/api.js - FIXED: Single email generation point
const express = require('express');
const axios = require('axios');
const {
    validateContactForm,
    handleValidationErrors
} = require('../middleware/validation');
const {
    limiter,
    strictLimiter
} = require('../middleware/rateLimiter');
const sanitizer = require('../utils/sanitizer');
const EmailGenerator = require('../utils/emailGenerator');
const EnhancedEmailVerifier = require('../utils/enhancedEmailVerifier');
const EmailPatternAnalytics = require('../utils/emailPatternAnalytics');
const performanceMonitor = require('../utils/performanceMonitor');
const fs = require('fs').promises; // ADDED: Missing fs import
const dns = require('dns').promises; // ADDED: Missing dns import

const router = express.Router();
const emailGenerator = new EmailGenerator();
const enhancedEmailVerifier = new EnhancedEmailVerifier();
const patternAnalytics = new EmailPatternAnalytics();
const originalGenerateAndVerify = router.post.bind(router);
const SmartEmailSubsetSelector = require('../utils/smartEmailSubsetSelector');

// Contact form submission endpoint (updated for single generation point)
router.post('/contact',
    strictLimiter,
    validateContactForm,
    handleValidationErrors,
    async (req, res) => {
        try {
            const sanitizedData = sanitizer.sanitizeObject(req.body);

            console.log(`🎯 Processing contact submission: ${sanitizedData.firstName} ${sanitizedData.lastName} for "${sanitizedData.companyName}"`);

            // SINGLE POINT: Generate emails using EmailGenerator ONLY
            const emailResult = await emailGenerator.processContact(
                sanitizedData.firstName,
                sanitizedData.lastName,
                sanitizedData.companyName,
                true // Save to file
            );

            // Handle case where email generation failed
            if (!emailResult.success) {
                console.warn(`⚠️ Email generation failed: ${emailResult.data?.metadata?.error}`);

                // Still call external API but note the email generation failure
                let apiResponse = null;
                try {
                    const apiPayload = {
                        title: 'Contact Form Submission',
                        body: `Name: ${sanitizedData.firstName} ${sanitizedData.lastName}, Company: ${sanitizedData.companyName}`,
                        userId: 1
                    };

                    const apiCall = await axios.post(
                        `${process.env.API_BASE_URL}/posts`,
                        apiPayload, {
                            timeout: process.env.API_TIMEOUT || 5000,
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': 'ProMailHunter/2.0'
                            }
                        }
                    );

                    apiResponse = apiCall.data;
                } catch (apiError) {
                    console.error('External API call failed:', apiError.message);
                    apiResponse = {
                        id: 'failed',
                        title: 'API call failed',
                        status: 'error'
                    };
                }

                return res.status(400).json({
                    success: false,
                    error: emailResult.data?.metadata?.error || 'Email generation failed',
                    warnings: emailResult.data?.metadata?.warnings || [],
                    submittedData: sanitizedData,
                    apiResponse: {
                        id: apiResponse?.id || 'failed',
                        title: apiResponse?.title || 'Contact submission',
                        status: 'submitted_with_errors'
                    },
                    emailGeneration: {
                        totalEmails: 0,
                        domain: null,
                        error: emailResult.data?.metadata?.error,
                        singleGenerationPoint: true
                    }
                });
            }

            // Call external API for successful submission
            let apiResponse = null;
            try {
                const apiPayload = {
                    title: 'Contact Form Submission',
                    body: `Name: ${sanitizedData.firstName} ${sanitizedData.lastName}, Company: ${sanitizedData.companyName}`,
                    userId: 1
                };

                const apiCall = await axios.post(
                    `${process.env.API_BASE_URL}/posts`,
                    apiPayload, {
                        timeout: process.env.API_TIMEOUT || 5000,
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'ProMailHunter/2.0'
                        }
                    }
                );

                apiResponse = apiCall.data;
            } catch (apiError) {
                console.error('External API call failed:', apiError.message);
                apiResponse = {
                    id: 'failed',
                    title: 'API call failed',
                    status: 'error'
                };
            }

            // Successful response with single generation point
            res.json({
                success: true,
                message: 'Form submitted successfully with single email generation point',
                submittedData: sanitizedData,
                apiResponse: {
                    id: apiResponse?.id || 'unknown',
                    title: apiResponse?.title || 'Contact submission',
                    status: 'submitted'
                },
                emailGeneration: {
                    totalEmails: emailResult.data?.emails?.all?.length || 0,
                    domain: emailResult.data?.metadata?.domain || null,
                    totalUsernames: emailResult.data?.metadata?.totalUsernames || 0,
                    domainValidated: emailResult.data?.metadata?.domainValidated || false,
                    fileSaved: emailResult.file?.filename || null,
                    singleGenerationPoint: true,
                    processingTime: `Generated at ${emailResult.data?.metadata?.generatedAt}`
                }
            });

        } catch (error) {
            console.error('API Error:', error.message);
            console.error('Stack trace:', error.stack);

            res.status(500).json({
                success: false,
                error: 'Failed to process your request. Please try again later.',
                code: 'API_ERROR',
                singleGenerationPoint: true
            });
        }
    }
);

// Email generation only (single generation point)
router.post('/generate-emails',
    strictLimiter,
    validateContactForm,
    handleValidationErrors,
    async (req, res) => {
        try {
            const sanitizedData = sanitizer.sanitizeObject(req.body);

            console.log(`📧 Generating emails for: ${sanitizedData.firstName} ${sanitizedData.lastName} with domain in "${sanitizedData.companyName}"`);

            // SINGLE POINT: Use EmailGenerator ONLY
            const emailResult = await emailGenerator.processContact(
                sanitizedData.firstName,
                sanitizedData.lastName,
                sanitizedData.companyName,
                req.query.save !== 'false'
            );

            if (!emailResult.success) {
                return res.status(400).json({
                    success: false,
                    error: emailResult.data?.metadata?.error || 'Email generation failed',
                    warnings: emailResult.data?.metadata?.warnings || [],
                    code: 'EMAIL_GENERATION_ERROR',
                    singleGenerationPoint: true
                });
            }

            console.log(`📊 EmailGenerator produced: ${emailResult.data.emails.all.length} emails`);

            res.json({
                success: true,
                message: 'Email combinations generated successfully using single generation point',
                data: emailResult.data,
                file: emailResult.file,
                singleGenerationPoint: true,
                enhancedFeatures: {
                    userProvidedDomain: true,
                    personalNamesOnly: true,
                    singleGenerationPoint: true
                }
            });

        } catch (error) {
            console.error('Email Generation Error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to generate email combinations',
                code: 'EMAIL_GENERATION_ERROR',
                singleGenerationPoint: true
            });
        }
    }
);

// Fixed version of the generate-and-verify endpoint
// Replace the existing endpoint in routes/api.js with this version

router.post('/generate-and-verify',
    strictLimiter,
    validateContactForm,
    handleValidationErrors,
    async (req, res) => { // REMOVED 'next' parameter - not needed
        const startTime = Date.now(); // Track timing here

        try {
            const sanitizedData = sanitizer.sanitizeObject(req.body);
            const {
                verificationOptions = {}
            } = req.body;

            console.log(`🚀 Generate and verify for ${sanitizedData.firstName} ${sanitizedData.lastName} with domain in "${sanitizedData.companyName}"`);

            // STEP 1: Generate emails using EmailGenerator ONLY (single generation point)
            console.log(`📧 Step 1: Generating emails using EmailGenerator...`);
            const emailResult = await emailGenerator.processContact(
                sanitizedData.firstName,
                sanitizedData.lastName,
                sanitizedData.companyName,
                false // Don't save during verification process
            );

            // Handle email generation failure
            if (!emailResult.success) {
                console.error(`❌ Email generation failed: ${emailResult.data?.metadata?.error}`);

                // Record metrics before returning
                const duration = Date.now() - startTime;
                performanceMonitor.recordAPIRequest(duration, true);

                return res.status(400).json({
                    success: false,
                    error: emailResult.data?.metadata?.error || 'Email generation failed',
                    warnings: emailResult.data?.metadata?.warnings || [],
                    code: 'EMAIL_GENERATION_ERROR',
                    step: 'generation',
                    singleGenerationPoint: true
                });
            }

            // STEP 2: Get ALL emails generated by EmailGenerator (no re-generation!)
            const allGeneratedEmails = emailResult.data?.emails?.all || [];

            if (allGeneratedEmails.length === 0) {
                console.error(`❌ No emails were generated by EmailGenerator`);

                // Record metrics before returning
                const duration = Date.now() - startTime;
                performanceMonitor.recordAPIRequest(duration, true);

                return res.status(400).json({
                    success: false,
                    error: 'No emails generated for verification',
                    domain: emailResult.data?.metadata?.domain,
                    step: 'generation',
                    singleGenerationPoint: true
                });
            }

            console.log(`📊 EmailGenerator produced: ${allGeneratedEmails.length} emails`);

            // STEP 3: Apply limit if requested (but use EmailGenerator's output)
            const limit = parseInt(req.query.limit) || allGeneratedEmails.length; // No default limit
            const useSmartSelection = req.query.smartSelection !== 'false';

            let emailsToVerify;
            let subsetStrategy;

            if (useSmartSelection && limit < allGeneratedEmails.length) {
                // Use smart selection
                console.log(`🧠 Using smart subset selection to pick ${limit} emails from ${allGeneratedEmails.length}`);

                emailsToVerify = SmartEmailSubsetSelector.selectSmartSubset(
                    allGeneratedEmails,
                    limit, {
                        firstName: sanitizedData.firstName,
                        lastName: sanitizedData.lastName,
                        prioritizePatterns: true,
                        includeDiversity: true
                    }
                );
                subsetStrategy = SmartEmailSubsetSelector.getStrategyExplanation(
                    allGeneratedEmails,
                    emailsToVerify
                );
                console.log(`📋 Smart selection picked:`, subsetStrategy.selectedPatterns);
            } else {
                // Use simple slicing (old method)
                emailsToVerify = allGeneratedEmails.slice(0, limit);
                subsetStrategy = {
                    summary: {
                        total: allGeneratedEmails.length,
                        selected: emailsToVerify.length,
                        percentage: ((emailsToVerify.length / allGeneratedEmails.length) * 100).toFixed(1) + '%'
                    },
                    strategy: 'Simple sequential selection (first N emails)',
                    rationale: ['Taking first ' + limit + ' emails in order of generation']
                };
            }
            console.log(`🔍 Will verify ${emailsToVerify.length} emails (${subsetStrategy.summary.percentage} of total)`);
            // Log the emails being verified for transparency
            console.log(`📧 Emails selected for verification:`, emailsToVerify.slice(0, 10),
                emailsToVerify.length > 10 ? `... and ${emailsToVerify.length - 10} more` : '');

            // STEP 4: Verify the emails (using EmailVerifier)
            console.log(`📫 Step 2: Verifying emails using EnhancedEmailVerifier...`);
            const verificationResults = await enhancedEmailVerifier.verifyEmailBatch(
                emailsToVerify, {
                    enableSMTP: verificationOptions.enableSMTP !== false,
                    enableDeliverability: verificationOptions.enableDeliverability !== false,
                    usePythonValidator: verificationOptions.usePythonValidator !== false,
                    allowUTF8: verificationOptions.allowUTF8 !== false,
                    allowQuoted: verificationOptions.allowQuoted !== false,
                    globallyDeliverable: verificationOptions.globallyDeliverable !== false,
                    deepVerification: verificationOptions.deepVerification !== false, // Enable deep verification
                    concurrency: Math.min(verificationOptions.concurrency || 2, 3),
                    delay: Math.max(verificationOptions.delay || 4000, 3000),
                    timeout: verificationOptions.timeout || 15
                }
            );

            console.log(`✅ Verification completed for ${verificationResults.length} emails`);

            // STEP 5: Organize results
            const validEmails = verificationResults
                .filter(result => result.finalResult?.valid === true)
                .map(result => result.email);

            const invalidEmails = verificationResults
                .filter(result => result.finalResult?.valid === false)
                .map(result => result.email);

            const uncertainEmails = verificationResults
                .filter(result => result.finalResult?.confidence === 'unknown' || result.finalResult?.valid === null)
                .map(result => result.email);

            const mailboxTestedEmails = verificationResults
                .filter(result => result.finalResult?.mailboxTested === true)
                .map(result => result.email);

            const mailboxExistsEmails = verificationResults
                .filter(result => result.finalResult?.mailboxExists === true)
                .map(result => result.email);

            // STEP 6: Save combined results with single generation point metadata
            const combinedResults = {
                metadata: {
                    ...emailResult.data.metadata,
                    verificationTimestamp: new Date().toISOString(),
                    totalEmailsGenerated: allGeneratedEmails.length,
                    emailsVerified: verificationResults.length,
                    emailsLimitApplied: emailsToVerify.length !== allGeneratedEmails.length,
                    subsetStrategy: subsetStrategy,
                    verificationMethod: 'enhanced-email-verifier-deep',
                    pythonValidatorUsed: enhancedEmailVerifier.pythonAvailable,
                    singleGenerationPoint: true,
                    enhancedFeatures: {
                        userProvidedDomain: true,
                        personalNamesOnly: true,
                        singleGenerationPoint: true,
                        deepVerification: true,
                        mailboxTesting: true,
                        smartSubsetSelection: useSmartSelection,
                        pythonValidator: enhancedEmailVerifier.pythonAvailable
                    }
                },
                generation: {
                    ...emailResult.data,
                    generatedBy: 'EmailGenerator',
                    allEmails: allGeneratedEmails,
                    verificationSubset: emailsToVerify,
                    subsetSelectionMethod: useSmartSelection ? 'smart-pattern-based' : 'sequential'
                },
                verification: {
                    results: verificationResults,
                    summary: {
                        totalGenerated: allGeneratedEmails.length,
                        totalVerified: verificationResults.length,
                        valid: validEmails.length,
                        invalid: invalidEmails.length,
                        uncertain: uncertainEmails.length,
                        mailboxTested: mailboxTestedEmails.length,
                        mailboxExists: mailboxExistsEmails.length,
                        deepVerification: true
                    },
                    validEmails,
                    invalidEmails,
                    uncertainEmails,
                    mailboxTestedEmails,
                    mailboxExistsEmails
                }
            };

            const fileInfo = await enhancedEmailVerifier.saveResults(
                combinedResults,
                `single_generation_${sanitizedData.firstName}_${sanitizedData.lastName}_${Date.now()}.json`
            );

            // Record performance metrics and pattern analytics
            const duration = Date.now() - startTime;
            performanceMonitor.recordAPIRequest(duration, false);

            // Record pattern analytics for valid emails
            if (validEmails.length > 0) {
                validEmails.forEach(email => {
                    patternAnalytics.recordSuccessfulVerification(email, {
                        method: 'generate-and-verify',
                        confidence: 'high'
                    });
                });
            }

            // STEP 7: Return comprehensive results - THIS IS THE ACTUAL RESPONSE
            // STEP 7: Return comprehensive results - THIS IS THE ACTUAL RESPONSE
            res.json({
                success: true,
                message: 'Emails generated and verified successfully using single generation point',
                generation: {
                    totalGenerated: allGeneratedEmails.length,
                    domain: emailResult.data.metadata.domain,
                    generatedBy: 'EmailGenerator'
                },
                verification: {
                    totalVerified: verificationResults.length,
                    limitApplied: emailsToVerify.length !== allGeneratedEmails.length,
                    strategy: {
                        // Add the missing strategy object
                        description: subsetStrategy.strategy || 'Complete email verification',
                        batchSize: Math.min(verificationOptions.concurrency || 2, 3),
                        delay: Math.max(verificationOptions.delay || 4000, 3000)
                    },
                    estimatedTime: `${Math.ceil(emailsToVerify.length / 3) * 5} seconds`,
                    progressTracking: {
                        enabled: false, // Set to true if you implement real progress tracking
                        checkProgressEndpoint: '/api/verification-progress' // Placeholder
                    }
                },
                summary: combinedResults.verification.summary,
                validEmails,
                file: fileInfo,
                enhanced: true,
                singleGenerationPoint: true,
                deepVerification: true,
                features: combinedResults.metadata.enhancedFeatures
            });
        } catch (error) {
            console.error('Enhanced Generate and Verify Error:', error.message);
            console.error('Stack trace:', error.stack);

            // Record error metrics
            const duration = Date.now() - startTime;
            performanceMonitor.recordAPIRequest(duration, true);

            res.status(500).json({
                success: false,
                error: 'Failed to generate and verify emails',
                code: 'ENHANCED_GENERATE_VERIFY_ERROR',
                singleGenerationPoint: true
            });
        }
        // REMOVED the problematic next() call
    }
);

// Enhanced single email verification (unchanged but added single generation point flag)
router.post('/verify-email',
    strictLimiter,
    async (req, res) => {
        try {
            const {
                email,
                options = {}
            } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email address is required',
                    singleGenerationPoint: true
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
                deepVerification: options.deepVerification !== false,
                timeout: options.timeout || 15
            };

            console.log(`🔍 Enhanced verification for: ${sanitizedEmail}`);
            const result = await enhancedEmailVerifier.verifyEmail(sanitizedEmail, verificationOptions);

            res.json({
                success: true,
                result,
                enhanced: true,
                deepVerification: result.deepVerification || false,
                mailboxTested: result.finalResult?.mailboxTested || false,
                singleGenerationPoint: true
            });

        } catch (error) {
            console.error('Enhanced Email Verification Error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to verify email address',
                code: 'ENHANCED_EMAIL_VERIFICATION_ERROR',
                singleGenerationPoint: true
            });
        }
    }
);

// Enhanced batch email verification (unchanged but added metadata)
router.post('/verify-emails-batch',
    strictLimiter,
    async (req, res) => {
        try {
            const {
                emails,
                options = {}
            } = req.body;

            if (!emails || !Array.isArray(emails) || emails.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Array of email addresses is required',
                    singleGenerationPoint: true
                });
            }

            if (emails.length > 50) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 50 emails per batch',
                    singleGenerationPoint: true
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
                deepVerification: options.deepVerification !== false,
                concurrency: Math.min(options.concurrency || 2, 3),
                delay: Math.max(options.delay || 4000, 3000),
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
                mailboxTested: results.filter(r => r.finalResult?.mailboxTested === true).length,
                mailboxExists: results.filter(r => r.finalResult?.mailboxExists === true).length,
                deepVerification: results.some(r => r.deepVerification === true)
            };

            res.json({
                success: true,
                summary,
                results,
                file: fileInfo,
                enhanced: true,
                deepVerification: summary.deepVerification,
                singleGenerationPoint: true,
                verificationMethod: 'enhanced-email-verifier'
            });

        } catch (error) {
            console.error('Enhanced Batch Email Verification Error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to verify email addresses',
                code: 'ENHANCED_BATCH_EMAIL_VERIFICATION_ERROR',
                singleGenerationPoint: true
            });
        }
    }
);

// Enhanced email validator status endpoint (updated)
router.get('/verifier-status', (req, res) => {
    res.json({
        status: 'enhanced',
        pythonValidatorAvailable: enhancedEmailVerifier.pythonAvailable,
        singleGenerationPoint: true,
        features: {
            userProvidedDomain: true,
            personalNamesOnly: true,
            singleGenerationPoint: true,
            deepVerification: true,
            mailboxTesting: true,
            pythonValidator: enhancedEmailVerifier.pythonAvailable,
            smtpVerification: true,
            batchProcessing: true
        },
        supportedDomains: enhancedEmailVerifier.corporateDomainsWithStrictSecurity.length,
        knownPatterns: Object.keys(enhancedEmailVerifier.knownValidPatterns).length,
        version: '2.0.0-single-generation-point'
    });
});

// Add this diagnostic endpoint to routes/api.js

// Diagnostic endpoint for testing email verification
router.post('/test-email-verification',
    limiter,
    async (req, res) => {
        try {
            const {
                email,
                runDiagnostics = false
            } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            console.log(`\n🔬 Testing email verification for: ${email}`);

            if (runDiagnostics) {
                // Run detailed diagnostics
                const result = await enhancedEmailVerifier.runDiagnosticVerification(email);

                res.json({
                    success: true,
                    email,
                    result: result.finalResult,
                    checks: result.checks,
                    diagnostics: true,
                    note: 'Check server console for detailed diagnostic output'
                });
            } else {
                // Run normal verification
                const result = await enhancedEmailVerifier.verifyEmail(email, {
                    enableSMTP: true,
                    deepVerification: true,
                    usePythonValidator: false, // Disable to isolate issue
                    timeout: 20
                });

                res.json({
                    success: true,
                    email,
                    result: result.finalResult,
                    checks: result.checks,
                    diagnostics: false
                });
            }

        } catch (error) {
            console.error('Test verification error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to test email verification',
                message: error.message
            });
        }
    }
);

// Endpoint to test with known good email
router.post('/test-known-email',
    limiter,
    async (req, res) => {
        try {
            const {
                knownEmail
            } = req.body;

            if (!knownEmail) {
                return res.status(400).json({
                    success: false,
                    error: 'Known email is required'
                });
            }

            console.log(`\n🧪 Testing verification with known good email: ${knownEmail}`);

            const result = await enhancedEmailVerifier.testKnownEmail(knownEmail);

            // Also test what patterns would match
            const [username, domain] = knownEmail.split('@');
            const generatedEmails = emailGenerator.generateUsernames(
                username.split(/[._-]/)[0] || username, // Guess first name
                username.split(/[._-]/)[1] || username // Guess last name
            ).map(u => `${u}@${domain}`);

            const matchesGenerated = generatedEmails.includes(knownEmail);

            res.json({
                success: true,
                knownEmail,
                result: result.finalResult,
                checks: result.checks,
                wouldBeGenerated: matchesGenerated,
                diagnostics: {
                    totalPatternsGenerated: generatedEmails.length,
                    samplePatterns: generatedEmails.slice(0, 10),
                    note: 'Check server console for detailed diagnostic output'
                }
            });

        } catch (error) {
            console.error('Known email test error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to test known email',
                message: error.message
            });
        }
    }
);

// Test enhanced verification endpoint (updated)
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

            console.log('🧪 Testing enhanced email verification with single generation point...');

            const results = [];
            for (const email of testEmails) {
                try {
                    const result = await enhancedEmailVerifier.verifyEmail(email, {
                        enableSMTP: true,
                        usePythonValidator: true,
                        deepVerification: true,
                        timeout: 10
                    });
                    results.push({
                        email,
                        ...result.finalResult,
                        method: result.finalResult?.method || 'nodejs-enhanced',
                        checks: result.checks?.length || 0,
                        mailboxTested: result.finalResult?.mailboxTested || false,
                        deepVerification: result.deepVerification || false,
                        singleGenerationPoint: true
                    });
                } catch (error) {
                    results.push({
                        email,
                        valid: false,
                        error: error.message,
                        method: 'error',
                        mailboxTested: false,
                        singleGenerationPoint: true
                    });
                }
            }

            res.json({
                success: true,
                message: 'Enhanced verification test completed with single generation point',
                results,
                pythonValidatorAvailable: enhancedEmailVerifier.pythonAvailable,
                testTimestamp: new Date().toISOString(),
                singleGenerationPoint: true
            });

        } catch (error) {
            console.error('Enhanced Verification Test Error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to run enhanced verification test',
                code: 'ENHANCED_TEST_ERROR',
                singleGenerationPoint: true
            });
        }
    }
);

// Download endpoints (unchanged)
router.get('/download-emails/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const path = require('path');
        const filePath = path.join(process.cwd(), 'generated_emails', filename);

        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({
                error: 'Invalid filename'
            });
        }

        res.download(filePath, (err) => {
            if (err) {
                res.status(404).json({
                    error: 'File not found'
                });
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Download failed'
        });
    }
});

router.get('/download-verification/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const path = require('path');
        const filePath = path.join(process.cwd(), 'email_verification_results', filename);

        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({
                error: 'Invalid filename'
            });
        }

        res.download(filePath, (err) => {
            if (err) {
                res.status(404).json({
                    error: 'File not found'
                });
            }
        });
    } catch (error) {
        res.status(500).json({
            error: 'Download failed'
        });
    }
});

// Add to routes/api.js

// Domain validation endpoint
// Add this endpoint to your routes/api.js file

// Domain validation endpoint
router.post('/validate-domain',
    limiter,
    async (req, res) => {
        try {
            const {
                domain
            } = req.body;

            if (!domain) {
                return res.status(400).json({
                    success: false,
                    error: 'Domain is required'
                });
            }

            const sanitizedDomain = sanitizer.sanitizeText(domain).toLowerCase();

            // Basic format check
            const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!domainPattern.test(sanitizedDomain)) {
                return res.json({
                    valid: false,
                    message: 'Invalid domain format',
                    domain: sanitizedDomain
                });
            }

            console.log(`🔍 Validating domain: ${sanitizedDomain}`);

            // Check if it's a known public provider
            const publicProviders = [
                'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
                'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'
            ];
            const isPublicProvider = publicProviders.includes(sanitizedDomain);

            // Check if it's a known corporate domain
            const corporateDomains = enhancedEmailVerifier.corporateDomainsWithStrictSecurity;
            const isCorporateDomain = corporateDomains.includes(sanitizedDomain);

            try {
                // Perform DNS MX record check
                const mxRecords = await dns.resolveMx(sanitizedDomain);

                if (mxRecords && mxRecords.length > 0) {
                    res.json({
                        valid: true,
                        message: `✅ ${sanitizedDomain} can receive emails`,
                        domain: sanitizedDomain,
                        mxRecords: mxRecords.slice(0, 3).map(mx => ({
                            exchange: mx.exchange,
                            priority: mx.priority
                        })),
                        isPublicProvider,
                        isCorporateDomain,
                        features: {
                            hasMultipleMX: mxRecords.length > 1,
                            primaryMX: mxRecords[0].exchange
                        }
                    });
                } else {
                    res.json({
                        valid: false,
                        message: `❌ ${sanitizedDomain} has no email servers`,
                        domain: sanitizedDomain,
                        isPublicProvider: false,
                        isCorporateDomain: false
                    });
                }
            } catch (dnsError) {
                // Try A record as fallback
                try {
                    await dns.resolve(sanitizedDomain, 'A');
                    res.json({
                        valid: true,
                        message: `⚠️ ${sanitizedDomain} exists but may not accept emails`,
                        domain: sanitizedDomain,
                        warning: 'Domain has no MX records but exists',
                        isPublicProvider,
                        isCorporateDomain
                    });
                } catch (secondError) {
                    res.json({
                        valid: false,
                        message: `❌ ${sanitizedDomain} does not exist`,
                        domain: sanitizedDomain,
                        isPublicProvider: false,
                        isCorporateDomain: false
                    });
                }
            }

        } catch (error) {
            console.error('Domain validation error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to validate domain',
                code: 'DOMAIN_VALIDATION_ERROR'
            });
        }
    }
);

// Bulk domain validation endpoint
router.post('/validate-domains-bulk',
    strictLimiter,
    async (req, res) => {
        try {
            const {
                domains
            } = req.body;

            if (!domains || !Array.isArray(domains)) {
                return res.status(400).json({
                    success: false,
                    error: 'Array of domains is required'
                });
            }

            if (domains.length > 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 10 domains per request'
                });
            }

            console.log(`🔍 Bulk validating ${domains.length} domains`);

            const results = await Promise.all(
                domains.map(async (domain) => {
                    const sanitizedDomain = sanitizer.sanitizeText(domain).toLowerCase();

                    try {
                        const mxRecords = await dns.resolveMx(sanitizedDomain);
                        return {
                            domain: sanitizedDomain,
                            valid: true,
                            hasMX: true,
                            mxCount: mxRecords.length
                        };
                    } catch (error) {
                        try {
                            await dns.resolve(sanitizedDomain, 'A');
                            return {
                                domain: sanitizedDomain,
                                valid: true,
                                hasMX: false,
                                hasA: true
                            };
                        } catch (secondError) {
                            return {
                                domain: sanitizedDomain,
                                valid: false,
                                error: 'Domain not found'
                            };
                        }
                    }
                })
            );

            const summary = {
                total: results.length,
                valid: results.filter(r => r.valid).length,
                invalid: results.filter(r => !r.valid).length,
                withMX: results.filter(r => r.hasMX).length
            };

            res.json({
                success: true,
                summary,
                results
            });

        } catch (error) {
            console.error('Bulk domain validation error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Failed to validate domains',
                code: 'BULK_DOMAIN_VALIDATION_ERROR'
            });
        }
    }
);

// Performance monitoring endpoint
router.get('/performance', (req, res) => {
    const detailed = req.query.detailed === 'true';
    const report = detailed ?
        performanceMonitor.getDetailedReport() :
        performanceMonitor.getSummary();

    res.json({
        success: true,
        report,
        timestamp: new Date().toISOString()
    });
});

// Reset performance metrics
router.post('/performance/reset',
    strictLimiter,
    (req, res) => {
        performanceMonitor.reset();
        res.json({
            success: true,
            message: 'Performance metrics reset',
            resetTime: new Date().toISOString()
        });
    }
);

// Pattern analytics for a specific domain
router.get('/analytics/domain/:domain', async (req, res) => {
    try {
        const domain = req.params.domain.toLowerCase();
        const report = patternAnalytics.getDomainReport(domain);

        res.json({
            success: true,
            report,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to generate domain report'
        });
    }
});

// Global analytics summary
router.get('/analytics/summary', async (req, res) => {
    try {
        const summary = patternAnalytics.getGlobalSummary();

        res.json({
            success: true,
            summary,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to generate analytics summary'
        });
    }
});

// Export analytics data
router.get('/analytics/export', async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const data = await patternAnalytics.exportAnalytics(format);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=email_pattern_analytics.csv');
            res.send(data);
        } else {
            res.json({
                success: true,
                data,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to export analytics'
        });
    }
});

// System diagnostics endpoint
router.get('/diagnostics', async (req, res) => {
    try {
        // Check various system components
        const diagnostics = {
            nodejs: {
                version: process.version,
                memory: process.memoryUsage(),
                uptime: process.uptime()
            },
            emailGenerator: {
                status: 'operational',
                domainCacheSize: emailGenerator.domainCache.size
            },
            emailVerifier: {
                status: 'operational',
                pythonAvailable: enhancedEmailVerifier.pythonAvailable,
                corporateDomainsCount: enhancedEmailVerifier.corporateDomainsWithStrictSecurity.length,
                knownPatternsCount: Object.keys(enhancedEmailVerifier.knownValidPatterns).length
            },
            performance: performanceMonitor.getSystemHealth(),
            storage: await checkStorageHealth()
        };

        res.json({
            success: true,
            diagnostics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to run diagnostics',
            message: error.message
        });
    }
});

// Helper function to check storage health
async function checkStorageHealth() {
    const path = require('path');
    const dirs = [
        'generated_emails',
        'email_verification_results',
        'data'
    ];

    const health = {
        directories: {},
        totalFiles: 0
    };

    for (const dir of dirs) {
        try {
            const dirPath = path.join(process.cwd(), dir);
            const files = await fs.readdir(dirPath);
            health.directories[dir] = {
                exists: true,
                fileCount: files.length
            };
            health.totalFiles += files.length;
        } catch (error) {
            health.directories[dir] = {
                exists: false,
                fileCount: 0
            };
        }
    }

    return health;
}

// Webhook for recording successful verifications (for pattern learning)
router.post('/analytics/record-verification',
    limiter,
    async (req, res) => {
        try {
            const {
                email,
                verificationData
            } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            await patternAnalytics.recordSuccessfulVerification(email, verificationData);

            res.json({
                success: true,
                message: 'Verification recorded',
                pattern: patternAnalytics.analyzeEmailPattern(email)
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to record verification'
            });
        }
    }
);

// Health check with enhanced status (updated)
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0-single-generation-point',
        features: {
            enhanced: true,
            singleGenerationPoint: true,
            personalNamesOnly: true,
            deepVerification: true,
            mailboxTesting: true,
            pythonValidator: enhancedEmailVerifier.pythonAvailable,
            domainValidation: true
        }
    });
});

module.exports = router;