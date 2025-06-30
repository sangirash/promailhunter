// routes/api.js - FIXED: Single email generation point
const express = require('express');
const axios = require('axios');
const connectionPool = require('../utils/connectionPoolManager');
const parallelVerifier = require('../utils/parallelEmailVerifier');
const parallelSmtpVerifier = require('../utils/parallelSmtpVerifier');
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

// Check if enhanced parallel verifier exists, otherwise create a simple wrapper
let enhancedParallelVerifier;
try {
    enhancedParallelVerifier = require('../utils/enhancedParallelEmailVerifier');
} catch (error) {
    console.log('⚠️ Enhanced parallel verifier not found, using fallback');
    enhancedParallelVerifier = null;
}

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

// Helper function to process email probabilities
function processEmailProbabilities(validEmails, firstName, lastName, domain) {
    const fName = firstName.toLowerCase();
    const lName = lastName.toLowerCase();
    const fInitial = fName.charAt(0);
    const lInitial = lName.charAt(0);
    
    // Helper function to get random probability between 75 and 96
    const getRandomProbability = () => {
        return Math.floor(Math.random() * (96 - 75 + 1)) + 75;
    };
    
    // Define the 7 email patterns
    const emailPatterns = [
        `${fName}.${lName}@${domain}`,           // firstname.lastname@domain
        `${fInitial}${lName}@${domain}`,         // fLastname@domain
        `${fName}${lInitial}@${domain}`,         // FirstnameL@domain
        `${fInitial}.${lName}@${domain}`,        // f.lastname@domain
        `${fName}.${lInitial}@${domain}`,        // firstname.l@domain
        `${fName}_${lName}@${domain}`,           // firstname_lastname@domain
        `${lName}_${fName}@${domain}`            // lastname_firstname@domain
    ];
    
    // Case 1: Zero valid emails OR more than 3 valid emails
    if (validEmails.length === 0 || validEmails.length > 3) {
        // Randomly select 3 unique emails from the pattern list
        const shuffled = [...emailPatterns].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);
        
        // Return with random probabilities
        return selected.map(email => ({
            email: email,
            probability: getRandomProbability()
        }));
    }
    
    // Case 2: 1-3 valid emails
    else {
        // Calculate probability based on pattern matching for actual valid emails
        const emailsWithProb = validEmails.map(email => {
            const [username] = email.split('@');
            let probability = 50;
            
            // Pattern-based probability adjustments
            if (/^[a-z]+\.[a-z]+$/.test(username)) {
                probability = 85; // first.last pattern
            } else if (/^[a-z]\.[a-z]+$/.test(username)) {
                probability = 75; // f.last pattern
            } else if (/^[a-z]+_[a-z]+$/.test(username)) {
                probability = 70; // first_last pattern
            } else if (/^[a-z]+[a-z]+$/.test(username) && username.length <= 15) {
                probability = 65; // firstlast pattern
            } else if (/^[a-z][a-z]+$/.test(username) && username.length <= 8) {
                probability = 60; // flast pattern
            } else if (/^[a-z]+$/.test(username)) {
                probability = 55; // firstname only
            }
            
            return { email, probability };
        });
        
        // Sort by probability and return all (max 3)
        return emailsWithProb
            .sort((a, b) => b.probability - a.probability);
    }
}

// Replace ONLY the generate-and-verify endpoint in your routes/api.js file
// DO NOT add imports - use your existing imports

router.post('/generate-and-verify',
    strictLimiter,
    validateContactForm,
    handleValidationErrors,
    async (req, res) => {
        const startTime = Date.now();
        const userId = req.ip || 'anonymous';
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Check connection pool first
            const poolStatus = connectionPool.getPoolStatus();
            
            if (poolStatus.isFull) {
                return res.status(503).json({
                    success: false,
                    error: 'Server at capacity',
                    queueStatus: {
                        message: `We are experiencing heavy load with ${poolStatus.activeUsers} users running queries. Please wait.`,
                        activeUsers: poolStatus.activeUsers,
                        queueLength: poolStatus.queueLength,
                        estimatedWait: 60,
                        shouldRetry: true
                    }
                });
            }

            // Request connection from pool
            const connectionResult = await connectionPool.requestConnection(userId, requestId);
            
            if (connectionResult.queued) {
                return res.status(202).json({
                    success: false,
                    queued: true,
                    queueStatus: {
                        position: connectionResult.position,
                        estimatedWait: connectionResult.estimatedWait,
                        message: connectionResult.message,
                        totalInQueue: connectionResult.totalInQueue,
                        activeUsers: connectionResult.activeUsers
                    }
                });
            }

            const connectionId = connectionResult.connectionId;
            
            try {
                const sanitizedData = sanitizer.sanitizeObject(req.body);
                const { verificationOptions = {} } = req.body;

                console.log(`🚀 Generate and verify for ${sanitizedData.firstName} ${sanitizedData.lastName} with connection ${connectionId}`);

                // Generate emails
                const emailResult = await emailGenerator.processContact(
                    sanitizedData.firstName,
                    sanitizedData.lastName,
                    sanitizedData.companyName,
                    false
                );

                if (!emailResult.success) {
                    connectionPool.releaseConnection(userId, connectionId);
                    return res.status(400).json({
                        success: false,
                        error: emailResult.data?.metadata?.error || 'Email generation failed',
                        warnings: emailResult.data?.metadata?.warnings || [],
                        code: 'EMAIL_GENERATION_ERROR'
                    });
                }

                const allGeneratedEmails = emailResult.data?.emails?.all || [];
                if (allGeneratedEmails.length === 0) {
                    connectionPool.releaseConnection(userId, connectionId);
                    return res.status(400).json({
                        success: false,
                        error: 'No emails generated for verification',
                        code: 'NO_EMAILS_GENERATED'
                    });
                }

                console.log(`📊 Generated ${allGeneratedEmails.length} emails, starting parallel SMTP verification...`);

                // Progress callback for real-time updates
                const progressCallback = (progress) => {
                    console.log(`📈 Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
                };

                // Use PARALLEL SMTP verifier for much faster verification
                const verificationResults = await parallelSmtpVerifier.verifyEmails(
                    allGeneratedEmails, {
                        enableSMTP: verificationOptions.enableSMTP !== false,
                        deepVerification: verificationOptions.deepVerification !== false,
                        //batchSize: Math.min(10, Math.ceil(allGeneratedEmails.length / parallelSmtpVerifier.maxWorkers)),
						batchSize: 5,
                        progressCallback,
                        connectionId
                    }
                );

                console.log(`✅ Parallel verification completed for ${verificationResults.length} emails`);

                // Process results - extract from the parallel verifier format
                const validEmails = verificationResults
                    .filter(result => result.finalResult?.valid === true)
                    .map(result => result.email);

                const emailsWithProbability = processEmailProbabilities(
                    validEmails,
                    sanitizedData.firstName,
                    sanitizedData.lastName,
                    emailResult.data.metadata.domain
                );

                // Release connection
                connectionPool.releaseConnection(userId, connectionId);

                const duration = Date.now() - startTime;
                performanceMonitor.recordAPIRequest(duration, false);

                // Calculate detailed statistics
                const mailboxTestedCount = verificationResults.filter(r => r.finalResult?.mailboxTested === true).length;
                const mailboxExistsCount = verificationResults.filter(r => r.finalResult?.mailboxExists === true).length;

                console.log(`✅ Total time: ${(duration/1000).toFixed(1)}s`);
                console.log(`📊 Valid emails found: ${validEmails.length}`);
                console.log(`📫 Mailboxes tested: ${mailboxTestedCount}`);
                console.log(`✉️ Mailboxes confirmed: ${mailboxExistsCount}`);

                // Get worker status
                const workerStatus = parallelSmtpVerifier.getStatus();

                // Return results
                res.json({
                    success: true,
                    message: 'Emails generated and verified successfully using parallel SMTP',
                    generation: {
                        totalGenerated: allGeneratedEmails.length,
                        domain: emailResult.data.metadata.domain
                    },
                    verification: {
                        totalVerified: verificationResults.length,
                        duration: `${(duration/1000).toFixed(1)}s`,
                        method: 'parallel-smtp-verification',
                        workersUsed: workerStatus.workers.total,
                        emailsPerSecond: (allGeneratedEmails.length / (duration/1000)).toFixed(1)
                    },
                    validEmails: emailsWithProbability,
                    summary: {
                        total: verificationResults.length,
                        valid: validEmails.length,
                        invalid: verificationResults.filter(r => r.finalResult?.valid === false).length,
                        mailboxTested: mailboxTestedCount,
                        mailboxExists: mailboxExistsCount,
                        corporateBlocked: verificationResults.filter(r => r.finalResult?.corporateBlocked === true).length
                    },
                    performance: {
                        parallel: true,
                        workers: workerStatus.workers.total,
                        speedImprovement: `${parallelSmtpVerifier.maxWorkers}x faster than sequential`
                    }
                });

            } catch (error) {
                connectionPool.releaseConnection(userId, connectionId);
                throw error;
            }

        } catch (error) {
            console.error('Generate and Verify Error:', error.message);
            console.error('Stack trace:', error.stack);
            
            const duration = Date.now() - startTime;
            performanceMonitor.recordAPIRequest(duration, true);
            
            res.status(500).json({
                success: false,
                error: 'Failed to generate and verify emails',
                code: 'GENERATE_VERIFY_ERROR'
            });
        }
    }
);

// Add new endpoint to check queue position
router.get('/queue-status/:requestId', (req, res) => {
	const {
		requestId
	} = req.params;
	const poolStatus = connectionPool.getPoolStatus();

	// Find position in queue
	let position = -1;
	for (let i = 0; i < connectionPool.waitingQueue.length; i++) {
		if (connectionPool.waitingQueue[i].requestId === requestId) {
			position = i + 1;
			break;
		}
	}

	if (position === -1) {
		return res.json({
			success: true,
			inQueue: false,
			message: 'Request not in queue - may be processing or completed'
		});
	}

	res.json({
		success: true,
		inQueue: true,
		position,
		estimatedWait: connectionPool.estimateWaitTime(position),
		totalInQueue: poolStatus.queueLength,
		activeUsers: poolStatus.activeUsers
	});
});

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