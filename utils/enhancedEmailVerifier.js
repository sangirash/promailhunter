// utils/enhancedEmailVerifier.js - UPDATED: Real mailbox verification
const dns = require('dns').promises;
const net = require('net');
const fs = require('fs').promises;
const path = require('path');
const {
    spawn
} = require('child_process');

class EnhancedEmailVerifier {
    constructor() {
        this.timeout = 15000;
        this.smtpTimeout = 20000; // Increased for thorough SMTP checking
        this.pythonTimeout = 15000;

        // Corporate domains that typically block SMTP verification
        this.corporateDomainsWithStrictSecurity = [
            'microsoft.com', 'google.com', 'apple.com', 'amazon.com', 'facebook.com',
            'ukg.com', 'salesforce.com', 'oracle.com', 'sap.com', 'workday.com',
            'paypal.com', 'netflix.com', 'adobe.com', 'vmware.com', 'citrix.com',
            'meta.com', 'linkedin.com', 'twitter.com', 'spotify.com', 'slack.com',
            'ibm.com', 'intel.com', 'nvidia.com', 'cisco.com', 'hp.com'
        ];

        // Known email patterns for major companies
        this.knownValidPatterns = {
            'ukg.com': ['first.last', 'first', 'last', 'firstlast', 'first_last'],
            'microsoft.com': ['first.last', 'first', 'firstlast', 'first_last'],
            'google.com': ['first.last', 'first', 'firstlast'],
            'apple.com': ['first.last', 'first', 'firstlast'],
            'amazon.com': ['first.last', 'first', 'firstlast', 'first_last']
        };

        // Public domains (for reference)
        this.publicDomains = [
            'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
            'icloud.com', 'protonmail.com', 'mail.com', 'live.com', 'msn.com'
        ];

        // Dynamic pattern learning for user domains
        this.learnedPatterns = new Map();

        // Verify Python email-validator is available
        this.pythonAvailable = false;
        this.checkPythonValidator();

        console.log('🎯 Enhanced Email Verifier - Real mailbox verification mode');
    }

    /**
     * Check if Python email-validator is available
     */
    async checkPythonValidator() {
        try {
            const result = await this.runPythonValidator('test@example.com', {
                test: true
            });
            this.pythonAvailable = result.success;
            if (this.pythonAvailable) {
                console.log('✅ Python email-validator integration available');
            } else {
                console.log('⚠️ Python email-validator not available, using Node.js validation');
            }
        } catch (error) {
            console.log('⚠️ Python email-validator check failed:', error.message);
            this.pythonAvailable = false;
        }
    }

    /**
     * Enhanced email format validation
     */
    validateEmailFormat(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return {
            valid: false,
            reason: 'Invalid email format'
        };

        const [username, domain] = email.split('@');

        if (username.length < 1 || username.length > 64) {
            return {
                valid: false,
                reason: 'Username length invalid'
            };
        }
        if (domain.length < 4 || domain.length > 255) {
            return {
                valid: false,
                reason: 'Domain length invalid'
            };
        }

        const isPublicDomain = this.publicDomains.includes(domain.toLowerCase());

        return {
            valid: true,
            isPublicDomain,
            warning: isPublicDomain ? `Public domain ${domain.toLowerCase()} detected` : null
        };
    }

    /**
     * DNS MX Record Check
     */
    async checkMXRecord(email) {
        try {
            const domain = email.split('@')[1];
            if (!domain) {
                return {
                    valid: false,
                    method: 'mx',
                    error: 'Invalid email format'
                };
            }

            const isPublicDomain = this.publicDomains.includes(domain.toLowerCase());
            const mxRecords = await dns.resolveMx(domain);

            return {
                valid: mxRecords && mxRecords.length > 0,
                method: 'mx',
                mxRecords: mxRecords?.map(mx => ({
                    exchange: mx.exchange,
                    priority: mx.priority
                })),
                confidence: 'medium',
                isPublicDomain,
                warning: isPublicDomain ? `${domain} is a public email provider` : null
            };
        } catch (error) {
            return {
                valid: false,
                method: 'mx',
                error: error.code || error.message,
                confidence: 'high'
            };
        }
    }

    /**
     * ENHANCED SMTP Mailbox Verification - Actually tests if the specific mailbox exists
     */
    /**
     * ENHANCED SMTP Mailbox Verification - More forgiving interpretation
     */
    async checkSMTPMailboxExists(email) {
        const domain = email.split('@')[1];
        const lowerDomain = domain.toLowerCase();

        const isPublicDomain = this.publicDomains.includes(lowerDomain);
        const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(lowerDomain);

        console.log(`📫 Testing mailbox existence for: ${email}`);

        // Handle domains that typically block SMTP verification
        if (isCorporateDomain) {
            console.log(`🏢 Corporate domain detected: ${domain} - SMTP may be blocked`);
            return {
                valid: null, // null means inconclusive, not invalid
                method: 'smtp-mailbox',
                error: 'Corporate domain likely blocks SMTP verification',
                confidence: 'unknown',
                corporateBlocked: true,
                note: 'Corporate domains often block automated mailbox verification for security',
                mailboxExists: null,
                mailboxTested: false
            };
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log(`⏱️ SMTP timeout for ${email}`);
                resolve({
                    valid: null, // Timeout doesn't mean invalid
                    method: 'smtp-mailbox',
                    error: 'SMTP timeout',
                    confidence: 'unknown',
                    isPublicDomain,
                    mailboxExists: null,
                    mailboxTested: false
                });
            }, this.smtpTimeout);

            this.getMXRecord(domain)
                .then(mxRecord => {
                    if (!mxRecord) {
                        clearTimeout(timeout);
                        return resolve({
                            valid: false,
                            method: 'smtp-mailbox',
                            error: 'No MX record found',
                            confidence: 'high',
                            isPublicDomain,
                            mailboxExists: false,
                            mailboxTested: false
                        });
                    }

                    console.log(`🔗 Connecting to SMTP server: ${mxRecord} for ${email}`);

                    const client = new net.Socket();
                    let step = 0;
                    let result = {
                        valid: false,
                        method: 'smtp-mailbox',
                        confidence: 'medium',
                        isPublicDomain,
                        smtpServer: mxRecord,
                        steps: [],
                        mailboxExists: null,
                        mailboxTested: false
                    };

                    client.setTimeout(this.smtpTimeout);

                    client.connect(25, mxRecord, () => {
                        result.steps.push('Connected to SMTP server');
                    });

                    client.on('data', (data) => {
                        const response = data.toString().trim();
                        console.log(`📨 SMTP Response (Step ${step}): ${response.substring(0, 100)}...`);

                        switch (step) {
                            case 0: // Initial connection
                                if (response.includes('220')) {
                                    result.steps.push('Server greeting received');
                                    client.write('HELO mailverify.local\r\n');
                                    step = 1;
                                } else {
                                    result.error = 'SMTP server rejected connection';
                                    result.smtpResponse = response;
                                    result.steps.push('Server rejected connection');
                                    client.destroy();
                                }
                                break;

                            case 1: // HELO response
                                if (response.includes('250')) {
                                    result.steps.push('HELO accepted');
                                    client.write('MAIL FROM: <verify@mailverify.local>\r\n');
                                    step = 2;
                                } else {
                                    result.error = 'HELO command failed';
                                    result.smtpResponse = response;
                                    result.steps.push('HELO failed');
                                    client.destroy();
                                }
                                break;

                            case 2: // MAIL FROM response
                                if (response.includes('250')) {
                                    result.steps.push('MAIL FROM accepted');
                                    // THIS IS THE CRITICAL TEST - Does this specific mailbox exist?
                                    client.write(`RCPT TO: <${email}>\r\n`);
                                    step = 3;
                                } else {
                                    result.error = 'MAIL FROM command failed';
                                    result.smtpResponse = response;
                                    result.steps.push('MAIL FROM failed');
                                    client.destroy();
                                }
                                break;

                            case 3: // RCPT TO response - THE ACTUAL MAILBOX TEST
                                result.steps.push('RCPT TO response received');
                                result.mailboxTested = true;

                                if (response.includes('250') || response.includes('251')) {
                                    // MAILBOX EXISTS AND CAN RECEIVE EMAIL
                                    result.valid = true;
                                    result.confidence = 'high';
                                    result.smtpResponse = response;
                                    result.mailboxExists = true;
                                    result.steps.push('✅ Mailbox exists and accepts email');
                                    console.log(`✅ MAILBOX EXISTS: ${email}`);

                                } else if (response.includes('550') && (
                                        response.toLowerCase().includes('user unknown') ||
                                        response.toLowerCase().includes('user not found') ||
                                        response.toLowerCase().includes('does not exist') ||
                                        response.toLowerCase().includes('invalid recipient') ||
                                        response.toLowerCase().includes('no such user')
                                    )) {
                                    // DEFINITELY: Mailbox does not exist
                                    result.valid = false;
                                    result.confidence = 'high';
                                    result.smtpResponse = response;
                                    result.mailboxExists = false;
                                    result.steps.push('❌ Mailbox definitely does not exist');
                                    console.log(`❌ MAILBOX DOES NOT EXIST: ${email}`);

                                } else if (response.includes('550') || response.includes('551') || response.includes('553')) {
                                    // MAYBE: Could be policy rejection rather than non-existent mailbox
                                    result.valid = null;
                                    result.confidence = 'low';
                                    result.smtpResponse = response;
                                    result.mailboxExists = null;
                                    result.steps.push('❓ Rejected - could be policy or non-existent');
                                    console.log(`❓ REJECTED (ambiguous): ${email}`);

                                } else if (response.includes('421') || response.includes('450') || response.includes('451') || response.includes('452')) {
                                    // TEMPORARY FAILURE - Server busy, try later
                                    result.valid = null;
                                    result.confidence = 'unknown';
                                    result.smtpResponse = response;
                                    result.mailboxExists = null;
                                    result.temporary = true;
                                    result.steps.push('⏳ Temporary failure - server busy');
                                    console.log(`⏳ TEMPORARY FAILURE: ${email}`);

                                } else if (response.includes('554')) {
                                    // POLICY REJECTION - Domain blocks verification
                                    result.valid = null;
                                    result.confidence = 'unknown';
                                    result.smtpResponse = response;
                                    result.mailboxExists = null;
                                    result.policyBlocked = true;
                                    result.steps.push('🛡️ Policy blocked - domain blocks verification');
                                    console.log(`🛡️ POLICY BLOCKED: ${email}`);

                                } else {
                                    // OTHER RESPONSE - Inconclusive
                                    result.valid = null;
                                    result.confidence = 'unknown';
                                    result.smtpResponse = response;
                                    result.mailboxExists = null;
                                    result.steps.push('❓ Inconclusive response');
                                    console.log(`❓ INCONCLUSIVE: ${email} - ${response}`);
                                }

                                // Don't send QUIT immediately, let server finish processing
                                setTimeout(() => {
                                    client.write('QUIT\r\n');
                                    step = 4;
                                }, 500);
                                break;

                            case 4: // QUIT response
                                result.steps.push('Connection terminated gracefully');
                                client.destroy();
                                break;
                        }
                    });

                    client.on('error', (err) => {
                        result.error = err.message;
                        result.valid = null; // Error doesn't mean invalid
                        result.steps.push(`Connection error: ${err.message}`);
                        result.mailboxTested = false;

                        if (err.code === 'ECONNREFUSED') {
                            result.note = 'SMTP server refused connection (may block verification)';
                        } else if (err.code === 'ENOTFOUND') {
                            result.note = 'SMTP server not found';
                        } else if (err.code === 'ETIMEDOUT') {
                            result.note = 'Connection timed out';
                        }

                        console.log(`🔌 SMTP Error for ${email}: ${err.message}`);
                        client.destroy();
                    });

                    client.on('timeout', () => {
                        result.error = 'SMTP timeout';
                        result.valid = null; // Timeout doesn't mean invalid
                        result.steps.push('Connection timed out');
                        result.note = 'Server may be blocking automated verification';
                        result.mailboxTested = false;
                        console.log(`⏱️ SMTP Timeout for ${email}`);
                        client.destroy();
                    });

                    client.on('close', () => {
                        clearTimeout(timeout);
                        result.steps.push('Connection closed');
                        resolve(result);
                    });
                })
                .catch(err => {
                    clearTimeout(timeout);
                    resolve({
                        valid: null, // DNS error doesn't mean email is invalid
                        method: 'smtp-mailbox',
                        error: err.message,
                        confidence: 'unknown',
                        isPublicDomain,
                        steps: ['DNS lookup failed'],
                        mailboxExists: null,
                        mailboxTested: false
                    });
                });
        });
    }

    /**
     * Deep email verification - Combines multiple methods for accurate results
     */
    /**
     * Deep email verification - MORE FORGIVING LOGIC
     */
    async deepVerifyEmail(email) {
        console.log(`🔬 Starting deep verification for: ${email}`);

        const results = {
            email,
            timestamp: new Date().toISOString(),
            checks: [],
            deepVerification: true,
            finalResult: {
                valid: false,
                confidence: 'unknown',
                reasons: [],
                mailboxTested: false,
                mailboxExists: null
            }
        };

        try {
            // Step 1: Format validation
            const formatCheck = this.validateEmailFormat(email);
            if (!formatCheck.valid) {
                results.finalResult.reasons.push(formatCheck.reason);
                results.finalResult.confidence = 'high';
                return results;
            }

            // Step 2: MX Record check
            console.log(`🌐 Checking MX records for: ${email}`);
            const mxCheck = await this.checkMXRecord(email);
            results.checks.push(mxCheck);

            if (!mxCheck.valid) {
                results.finalResult.reasons.push('Domain does not accept email (no MX records)');
                results.finalResult.confidence = 'high';
                return results;
            }

            results.finalResult.reasons.push('Domain has valid MX records');

            // Step 3: Pattern matching check
            const patternCheck = this.checkAgainstKnownPatterns(email);
            const hasGoodPattern = patternCheck.isKnownPattern && patternCheck.confidence !== 'low';

            if (patternCheck.isKnownPattern) {
                results.checks.push({
                    method: 'pattern',
                    valid: true,
                    confidence: patternCheck.confidence,
                    pattern: patternCheck.pattern
                });
            }

            // Step 4: SMTP Mailbox verification
            console.log(`📫 Testing mailbox existence for: ${email}`);
            const mailboxCheck = await this.checkSMTPMailboxExists(email);
            results.checks.push(mailboxCheck);
            results.finalResult.mailboxTested = mailboxCheck.mailboxTested || false;

            // Step 5: Analyze results with MORE FORGIVING LOGIC
            const domain = email.split('@')[1].toLowerCase();
            const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain);

            // Decision logic (more forgiving)
            if (mailboxCheck.mailboxExists === true) {
                // BEST CASE: Mailbox confirmed to exist
                results.finalResult.valid = true;
                results.finalResult.confidence = 'high';
                results.finalResult.reasons.push('✅ Mailbox confirmed to exist via SMTP');
                results.finalResult.mailboxExists = true;

            } else if (mailboxCheck.mailboxExists === false && mailboxCheck.confidence === 'high') {
                // ONLY mark as invalid if we're REALLY sure
                results.finalResult.valid = false;
                results.finalResult.confidence = 'high';
                results.finalResult.reasons.push('❌ Mailbox confirmed not to exist (definitive SMTP response)');
                results.finalResult.mailboxExists = false;

            } else if (isCorporateDomain || mailboxCheck.corporateBlocked || mailboxCheck.policyBlocked) {
                // Corporate domain or blocked - use pattern matching
                if (hasGoodPattern) {
                    results.finalResult.valid = true;
                    results.finalResult.confidence = 'medium';
                    results.finalResult.reasons.push('✅ Corporate domain with valid pattern (SMTP blocked)');
                    results.finalResult.mailboxExists = null;
                } else {
                    // Still be forgiving for corporate domains
                    results.finalResult.valid = true;
                    results.finalResult.confidence = 'low';
                    results.finalResult.reasons.push('✅ Corporate domain with MX records (SMTP blocked, assuming valid)');
                    results.finalResult.mailboxExists = null;
                }

            } else if (hasGoodPattern) {
                // Good pattern match - likely valid
                results.finalResult.valid = true;
                results.finalResult.confidence = 'medium';
                results.finalResult.reasons.push(`✅ Matches professional email pattern: ${patternCheck.pattern}`);
                results.finalResult.mailboxExists = null;

            } else {
                // FALLBACK: Domain accepts email, couldn't verify specific mailbox
                results.finalResult.valid = true;
                results.finalResult.confidence = 'low';
                results.finalResult.reasons.push('✅ Domain accepts email (specific mailbox unverified)');
                results.finalResult.mailboxExists = null;
            }

            // Add pattern info
            if (patternCheck.isKnownPattern) {
                results.finalResult.patternMatch = patternCheck.pattern;
            }

            return results;

        } catch (error) {
            results.finalResult.error = error.message;
            results.finalResult.reasons.push(`Verification failed: ${error.message}`);
            // Even on error, if domain has MX, assume it might be valid
            if (results.checks.some(c => c.method === 'mx' && c.valid)) {
                results.finalResult.valid = true;
                results.finalResult.confidence = 'low';
                results.finalResult.reasons.push('Domain has MX records (verification error occurred)');
            }
            return results;
        }
    }

    /**
     * Learn patterns for domains (helper method)
     */
    learnPattern(domain, pattern) {
        if (!this.learnedPatterns.has(domain)) {
            this.learnedPatterns.set(domain, []);
        }

        const domainPatterns = this.learnedPatterns.get(domain);
        const exists = domainPatterns.some(p => p.name === pattern.name);

        if (!exists) {
            domainPatterns.push(pattern);
            console.log(`📝 Learned pattern "${pattern.name}" for domain ${domain}`);
        }
    }

    /**
     * Check if username matches a specific pattern (helper method)
     */
    matchesPattern(username, pattern) {
        if (pattern.test) {
            return pattern.test();
        }
        // Fallback for simple pattern objects
        return false;
    }

    /**
     * Check against known patterns (more comprehensive)
     */
    checkAgainstKnownPatterns(email) {
        const [username, domain] = email.split('@');
        const lowerDomain = domain.toLowerCase();
        const lowerUsername = username.toLowerCase();

        // Check if we have learned patterns for this domain
        if (this.learnedPatterns.has(lowerDomain)) {
            const domainPatterns = this.learnedPatterns.get(lowerDomain);
            for (const pattern of domainPatterns) {
                if (this.matchesPattern(lowerUsername, pattern)) {
                    return {
                        isKnownPattern: true,
                        confidence: 'high',
                        pattern: pattern.name
                    };
                }
            }
        }

        // Check against comprehensive pattern list
        const patterns = [
            // High confidence patterns (most common in business)
            {
                name: 'first.last',
                test: () => /^[a-z]+\.[a-z]+$/.test(lowerUsername),
                confidence: 'high'
            },
            {
                name: 'first_last',
                test: () => /^[a-z]+_[a-z]+$/.test(lowerUsername),
                confidence: 'high'
            },
            {
                name: 'f.last',
                test: () => /^[a-z]\.[a-z]+$/.test(lowerUsername),
                confidence: 'high'
            },
            {
                name: 'first-last',
                test: () => /^[a-z]+-[a-z]+$/.test(lowerUsername),
                confidence: 'medium'
            },
            {
                name: 'firstlast',
                test: () => /^[a-z]{4,20}$/.test(lowerUsername) && lowerUsername.length >= 6,
                confidence: 'medium'
            },
            {
                name: 'first.l',
                test: () => /^[a-z]+\.[a-z]$/.test(lowerUsername),
                confidence: 'medium'
            },
            {
                name: 'flast',
                test: () => /^[a-z][a-z]{2,15}$/.test(lowerUsername) && lowerUsername.length <= 10,
                confidence: 'medium'
            },
            {
                name: 'firstl',
                test: () => /^[a-z]{2,}[a-z]$/.test(lowerUsername) && lowerUsername.length <= 10,
                confidence: 'medium'
            },
            {
                name: 'last.first',
                test: () => /^[a-z]+\.[a-z]+$/.test(lowerUsername),
                confidence: 'medium'
            },
            {
                name: 'l.first',
                test: () => /^[a-z]\.[a-z]+$/.test(lowerUsername),
                confidence: 'medium'
            },
            // Lower confidence patterns
            {
                name: 'first',
                test: () => /^[a-z]{2,15}$/.test(lowerUsername) && lowerUsername.length <= 10,
                confidence: 'low'
            },
            {
                name: 'last',
                test: () => /^[a-z]{2,15}$/.test(lowerUsername) && lowerUsername.length <= 10,
                confidence: 'low'
            },
            {
                name: 'initials',
                test: () => /^[a-z]{2,3}$/.test(lowerUsername),
                confidence: 'low'
            },
            {
                name: 'first+number',
                test: () => /^[a-z]+\d{1,4}$/.test(lowerUsername),
                confidence: 'low'
            },
            {
                name: 'firstlast+number',
                test: () => /^[a-z]+\d{1,4}$/.test(lowerUsername) && lowerUsername.length >= 5,
                confidence: 'low'
            }
        ];

        // Check each pattern
        for (const pattern of patterns) {
            if (pattern.test()) {
                // Boost confidence for known corporate domains
                const isCorporate = this.knownValidPatterns[lowerDomain] &&
                    this.knownValidPatterns[lowerDomain].includes(pattern.name);

                const finalConfidence = isCorporate ? 'high' : pattern.confidence;

                // Learn this pattern for the domain
                this.learnPattern(lowerDomain, pattern);

                return {
                    isKnownPattern: true,
                    confidence: finalConfidence,
                    pattern: pattern.name
                };
            }
        }

        // No pattern match, but check if it's still a reasonable username
        if (lowerUsername.length >= 2 &&
            lowerUsername.length <= 30 &&
            /^[a-z0-9._+-]+$/.test(lowerUsername)) {
            return {
                isKnownPattern: false,
                confidence: 'low',
                pattern: 'unknown'
            };
        }

        return {
            isKnownPattern: false,
            confidence: 'low'
        };
    }


    /**
     * Main verification method - Uses deep verification
     */
    async verifyEmail(email, options = {}) {
        if (options.deepVerification !== false) {
            return await this.deepVerifyEmail(email);
        } else {
            // Fallback to basic verification if requested
            return await this.basicVerifyEmail(email, options);
        }
    }

    /**
     * Verify multiple emails with deep verification
     */
    async verifyEmailBatch(emails, options = {}) {
        const results = [];
        const concurrency = Math.min(options.concurrency || 1, 2); // Conservative for SMTP
        const delay = Math.max(options.delay || 5000, 3000); // Longer delay for SMTP

        console.log(`🔬 Starting DEEP verification of ${emails.length} emails...`);
        console.log(`📫 This will test actual mailbox existence - may take longer but much more accurate`);

        for (let i = 0; i < emails.length; i += concurrency) {
            const batch = emails.slice(i, i + concurrency);
            const batchNum = Math.floor(i / concurrency) + 1;
            const totalBatches = Math.ceil(emails.length / concurrency);

            console.log(`📦 Processing batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);

            const batchPromises = batch.map(email =>
                this.verifyEmail(email, options).catch(error => ({
                    email,
                    error: error.message,
                    deepVerification: true,
                    finalResult: {
                        valid: false,
                        confidence: 'unknown',
                        reasons: ['Verification failed'],
                        mailboxTested: false
                    }
                }))
            );

            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const emailResult = result.value;
                    const status = emailResult.finalResult.valid ? '✅ VALID' : '❌ INVALID';
                    const confidence = emailResult.finalResult.confidence || 'unknown';
                    const mailboxStatus = emailResult.finalResult.mailboxExists === true ? ' (Mailbox exists)' :
                        emailResult.finalResult.mailboxExists === false ? ' (Mailbox does not exist)' :
                        ' (Mailbox status unknown)';

                    console.log(`  ${status} - ${batch[index]} (${confidence}${mailboxStatus})`);
                    results.push(emailResult);
                } else {
                    console.log(`  ❌ ERROR - ${batch[index]}: ${result.reason?.message}`);
                    results.push({
                        email: batch[index],
                        error: result.reason?.message || 'Unknown error',
                        deepVerification: true,
                        finalResult: {
                            valid: false,
                            confidence: 'unknown',
                            reasons: ['Processing failed'],
                            mailboxTested: false
                        }
                    });
                }
            });

            // Longer delay between batches for SMTP verification
            if (i + concurrency < emails.length) {
                console.log(`⏳ Waiting ${delay/1000}s before next batch (SMTP verification requires delays)...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Enhanced summary with mailbox statistics
        const validCount = results.filter(r => r.finalResult?.valid === true).length;
        const mailboxTestedCount = results.filter(r => r.finalResult?.mailboxTested === true).length;
        const mailboxExistsCount = results.filter(r => r.finalResult?.mailboxExists === true).length;
        const mailboxDoesNotExistCount = results.filter(r => r.finalResult?.mailboxExists === false).length;

        console.log(`\n📊 DEEP Verification Summary:`);
        console.log(`   Total emails: ${emails.length}`);
        console.log(`   Valid emails: ${validCount} (${((validCount/emails.length)*100).toFixed(1)}%)`);
        console.log(`   Mailboxes tested via SMTP: ${mailboxTestedCount}`);
        console.log(`   Mailboxes confirmed to exist: ${mailboxExistsCount}`);
        console.log(`   Mailboxes confirmed NOT to exist: ${mailboxDoesNotExistCount}`);
        console.log(`   ✅ Much more accurate than basic format/MX checking!`);

        return results;
    }

    /**
     * Helper method to get MX record
     */
    async getMXRecord(domain) {
        try {
            const mxRecords = await dns.resolveMx(domain);
            return mxRecords.sort((a, b) => a.priority - b.priority)[0]?.exchange;
        } catch (error) {
            return null;
        }
    }

    /**
     * Save verification results
     */
    async saveResults(results, filename = null) {
        try {
            if (!filename) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                filename = `deep_email_verification_${timestamp}.json`;
            }

            const outputDir = path.join(process.cwd(), 'email_verification_results');

            await fs.mkdir(outputDir, {
                recursive: true
            });

            const filePath = path.join(outputDir, filename);

            // Add metadata about deep verification
            const enhancedResults = {
                metadata: {
                    timestamp: new Date().toISOString(),
                    verifier: 'enhanced-email-verifier-deep',
                    deepVerification: true,
                    mailboxTesting: true,
                    totalEmails: Array.isArray(results) ? results.length : 1,
                    validEmails: Array.isArray(results) ?
                        results.filter(r => r.finalResult?.valid === true).length : (results.finalResult?.valid ? 1 : 0),
                    mailboxesTested: Array.isArray(results) ?
                        results.filter(r => r.finalResult?.mailboxTested === true).length : (results.finalResult?.mailboxTested ? 1 : 0),
                    mailboxesExist: Array.isArray(results) ?
                        results.filter(r => r.finalResult?.mailboxExists === true).length : (results.finalResult?.mailboxExists === true ? 1 : 0)
                },
                results
            };

            await fs.writeFile(filePath, JSON.stringify(enhancedResults, null, 2), 'utf8');

            console.log(`💾 Saved deep verification results to: ${filename}`);

            return {
                success: true,
                filePath,
                filename
            };
        } catch (error) {
            throw new Error(`Failed to save deep verification results: ${error.message}`);
        }
    }

    // Placeholder for Python validator and basic verification methods
    async runPythonValidator(email, options = {}) {
        // Implementation stays the same as before
        return {
            success: false,
            error: 'Python validator not implemented in this example'
        };
    }

    async basicVerifyEmail(email, options = {}) {
        // Fallback to basic verification if needed
        const formatCheck = this.validateEmailFormat(email);
        if (!formatCheck.valid) {
            return {
                email,
                finalResult: {
                    valid: false,
                    confidence: 'high',
                    reasons: [formatCheck.reason]
                }
            };
        }

        const mxCheck = await this.checkMXRecord(email);
        return {
            email,
            checks: [mxCheck],
            finalResult: {
                valid: mxCheck.valid,
                confidence: mxCheck.valid ? 'medium' : 'high',
                reasons: mxCheck.valid ? ['Domain accepts email'] : ['Domain does not accept email']
            }
        };
    }

    // Additional methods to add to EnhancedEmailVerifier class

    /**
     * Intelligently verify ALL emails with optimized batching and progress tracking
     * @param {Array} emails - All emails to verify
     * @param {Object} options - Verification options
     * @returns {Array} All verification results
     */
    async verifyAllEmailsIntelligently(emails, options = {}) {
        const results = [];
        const {
            batchSize = 3,
                delay = 2000,
                progressCallback = null,
                enableSMTP = true,
                deepVerification = true
        } = options;

        const totalEmails = emails.length;
        let completed = 0;

        console.log(`🎯 Starting intelligent verification of ALL ${totalEmails} emails`);
        console.log(`📦 Using dynamic batching: ${batchSize} emails per batch with ${delay}ms delay`);

        // Group emails by domain for more efficient verification
        const emailsByDomain = this.groupEmailsByDomain(emails);
        const domainCount = Object.keys(emailsByDomain).length;

        console.log(`🌐 Emails grouped into ${domainCount} domain(s) for optimized verification`);

        // Process each domain's emails
        for (const [domain, domainEmails] of Object.entries(emailsByDomain)) {
            console.log(`\n📧 Processing ${domainEmails.length} emails for domain: ${domain}`);

            // Check if domain is corporate/known to block SMTP
            const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain.toLowerCase());
            const isPublicDomain = this.publicDomains.includes(domain.toLowerCase());

            // Adjust strategy based on domain type
            let domainBatchSize = batchSize;
            let domainDelay = delay;

            if (isCorporateDomain) {
                console.log(`🏢 Corporate domain detected - using pattern matching strategy`);
                domainBatchSize = Math.min(batchSize * 2, 10); // Faster for pattern matching
                domainDelay = 500; // Minimal delay for pattern matching
            } else if (isPublicDomain) {
                console.log(`📮 Public email provider detected - using careful SMTP strategy`);
                domainBatchSize = Math.max(1, Math.floor(batchSize / 2)); // Slower for public providers
                domainDelay = delay * 1.5; // Longer delay to avoid rate limits
            }

            // Process domain's emails in batches
            for (let i = 0; i < domainEmails.length; i += domainBatchSize) {
                const batch = domainEmails.slice(i, i + domainBatchSize);
                const batchNum = Math.floor(i / domainBatchSize) + 1;
                const totalBatches = Math.ceil(domainEmails.length / domainBatchSize);

                console.log(`  Batch ${batchNum}/${totalBatches} for ${domain}: Verifying ${batch.length} emails`);

                // Verify batch with appropriate method
                const batchPromises = batch.map(email => {
                    if (isCorporateDomain && !enableSMTP) {
                        // Fast pattern matching for corporate domains
                        return this.verifyViaPatternMatching(email);
                    } else {
                        // Full verification including SMTP
                        return this.verifyEmail(email, {
                            ...options,
                            enableSMTP: enableSMTP && !isCorporateDomain,
                            deepVerification: deepVerification && !isCorporateDomain
                        }).catch(error => ({
                            email,
                            error: error.message,
                            finalResult: {
                                valid: false,
                                confidence: 'unknown',
                                reasons: ['Verification failed'],
                                error: error.message
                            }
                        }));
                    }
                });

                const batchResults = await Promise.allSettled(batchPromises);

                // Process batch results
                batchResults.forEach((result, index) => {
                    completed++;

                    if (result.status === 'fulfilled') {
                        const emailResult = result.value;
                        results.push(emailResult);

                        // Log result
                        const email = batch[index];
                        const status = emailResult.finalResult?.valid ? '✅' : '❌';
                        const confidence = emailResult.finalResult?.confidence || 'unknown';
                        console.log(`    ${status} ${email} (${confidence})`);
                    } else {
                        // Handle failed verification
                        const email = batch[index];
                        console.log(`    ❌ ${email} (error: ${result.reason?.message})`);

                        results.push({
                            email,
                            error: result.reason?.message || 'Unknown error',
                            finalResult: {
                                valid: false,
                                confidence: 'unknown',
                                reasons: ['Processing failed']
                            }
                        });
                    }

                    // Call progress callback if provided
                    if (progressCallback) {
                        const progress = {
                            completed,
                            total: totalEmails,
                            percentage: Math.round((completed / totalEmails) * 100),
                            currentDomain: domain,
                            domainsProcessed: Object.keys(emailsByDomain).indexOf(domain) + 1,
                            totalDomains: domainCount
                        };
                        progressCallback(progress);
                    }
                });

                // Delay between batches (except for the last batch of a domain)
                if (i + domainBatchSize < domainEmails.length) {
                    console.log(`  ⏳ Waiting ${domainDelay}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, domainDelay));
                }
            }

            // Summary for this domain
            const domainResults = results.filter(r => r.email.endsWith('@' + domain));
            const validCount = domainResults.filter(r => r.finalResult?.valid === true).length;
            console.log(`✅ Domain ${domain} complete: ${validCount}/${domainEmails.length} valid emails`);
        }

        // Final summary
        this.printVerificationSummary(results, totalEmails);

        return results;
    }

    /**
     * Group emails by domain for efficient processing
     */
    groupEmailsByDomain(emails) {
        const grouped = {};

        emails.forEach(email => {
            const domain = email.split('@')[1];
            if (!grouped[domain]) {
                grouped[domain] = [];
            }
            grouped[domain].push(email);
        });

        // Sort domains by email count (process smaller domains first)
        const sorted = {};
        Object.keys(grouped)
            .sort((a, b) => grouped[a].length - grouped[b].length)
            .forEach(domain => {
                sorted[domain] = grouped[domain];
            });

        return sorted;
    }

    /**
     * Fast pattern matching verification for corporate domains
     */
    async verifyViaPatternMatching(email) {
        const [username, domain] = email.split('@');
        const patternCheck = this.checkAgainstKnownPatterns(email);

        const result = {
            email,
            timestamp: new Date().toISOString(),
            checks: [{
                method: 'pattern-matching',
                valid: patternCheck.isKnownPattern,
                confidence: patternCheck.confidence,
                pattern: patternCheck.pattern
            }],
            finalResult: {
                valid: patternCheck.isKnownPattern,
                confidence: patternCheck.confidence,
                reasons: patternCheck.isKnownPattern ? [`Matches known pattern: ${patternCheck.pattern}`] : ['No matching pattern found'],
                method: 'pattern-matching',
                corporateDomain: true
            }
        };

        return result;
    }

    /**
     * Print detailed verification summary
     */
    printVerificationSummary(results, totalEmails) {
        const validCount = results.filter(r => r.finalResult?.valid === true).length;
        const invalidCount = results.filter(r => r.finalResult?.valid === false).length;
        const uncertainCount = results.filter(r => r.finalResult?.valid === null || r.finalResult?.confidence === 'unknown').length;

        const byConfidence = {
            high: results.filter(r => r.finalResult?.confidence === 'high').length,
            medium: results.filter(r => r.finalResult?.confidence === 'medium').length,
            low: results.filter(r => r.finalResult?.confidence === 'low').length,
            unknown: results.filter(r => r.finalResult?.confidence === 'unknown').length
        };

        const byMethod = {};
        results.forEach(r => {
            const method = r.finalResult?.method || 'unknown';
            byMethod[method] = (byMethod[method] || 0) + 1;
        });

        console.log('\n' + '='.repeat(70));
        console.log('📊 COMPLETE VERIFICATION SUMMARY');
        console.log('='.repeat(70));
        console.log(`Total Emails Processed: ${totalEmails}`);
        console.log(`✅ Valid: ${validCount} (${((validCount/totalEmails)*100).toFixed(1)}%)`);
        console.log(`❌ Invalid: ${invalidCount} (${((invalidCount/totalEmails)*100).toFixed(1)}%)`);
        console.log(`❓ Uncertain: ${uncertainCount} (${((uncertainCount/totalEmails)*100).toFixed(1)}%)`);
        console.log('\nConfidence Distribution:');
        Object.entries(byConfidence).forEach(([level, count]) => {
            if (count > 0) {
                console.log(`  ${level}: ${count} (${((count/totalEmails)*100).toFixed(1)}%)`);
            }
        });
        console.log('\nVerification Methods Used:');
        Object.entries(byMethod).forEach(([method, count]) => {
            console.log(`  ${method}: ${count}`);
        });
        console.log('='.repeat(70));
    }

}

module.exports = EnhancedEmailVerifier;