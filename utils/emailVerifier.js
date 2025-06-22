// utils/emailVerifier.js - IMPROVED VERSION
const dns = require('dns').promises;
const net = require('net');
const fs = require('fs').promises;
const path = require('path');

class emailVerifier {
  constructor() {
    this.timeout = 20000; // Increased from 10 to 20 seconds
    this.smtpTimeout = 15000; // Increased from 8 to 15 seconds
    this.maxRetries = 2; // Add retry mechanism
    
    // Expanded list of corporate domains
    this.corporateDomainsWithStrictSecurity = [
      'microsoft.com', 'google.com', 'apple.com', 'amazon.com', 'facebook.com',
      'ukg.com', 'salesforce.com', 'oracle.com', 'sap.com', 'workday.com',
      'paypal.com', 'netflix.com', 'adobe.com', 'vmware.com', 'citrix.com',
      'intel.com', 'cisco.com', 'ibm.com', 'hp.com', 'dell.com', 'accenture.com',
      'deloitte.com', 'pwc.com', 'ey.com', 'kpmg.com', 'mckinsey.com',
      'jpmorgan.com', 'wellsfargo.com', 'bankofamerica.com', 'goldmansachs.com'
    ];
    
    // Enhanced pattern recognition - now includes dynamic pattern detection
    this.commonEmailPatterns = [
      'first.last',     // john.doe
      'firstname.lastname', // firstname.lastname
      'first_last',     // john_doe
      'firstlast',      // johndoe
      'first',          // john
      'last',           // doe
      'firstl',         // johnD
      'flast',          // jdoe
      'first.initial',  // john.d
      'initial.last',   // j.doe
      'initials',       // jd
      'first+last',     // john+doe
      'first-last',     // john-doe
      'last.first',     // doe.john
    ];
    
    // Dynamic pattern cache for learning
    this.learnedPatterns = new Map();
  }

  /**
   * Enhanced email format validation
   */
  validateEmailFormat(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) return false;
    
    const [username, domain] = email.split('@');
    
    // Additional checks
    if (username.length < 1 || username.length > 64) return false;
    if (domain.length < 4 || domain.length > 255) return false;
    if (username.startsWith('.') || username.endsWith('.')) return false;
    if (username.includes('..')) return false;
    
    return true;
  }

  /**
   * ENHANCED: Better pattern matching with dynamic detection
   */
  checkAgainstKnownPatterns(email) {
    const [username, domain] = email.split('@');
    const lowerDomain = domain.toLowerCase();
    const lowerUsername = username.toLowerCase();
    
    // Check learned patterns first
    if (this.learnedPatterns.has(lowerDomain)) {
      const domainPatterns = this.learnedPatterns.get(lowerDomain);
      for (const pattern of domainPatterns) {
        if (this.matchesPattern(lowerUsername, pattern)) {
          return { isKnownPattern: true, confidence: 'high', pattern: pattern.name };
        }
      }
    }
    
    // Check common business patterns
    const detectedPattern = this.detectBusinessPattern(lowerUsername);
    if (detectedPattern) {
      // Learn this pattern for the domain
      this.learnPattern(lowerDomain, detectedPattern);
      
      return { 
        isKnownPattern: true, 
        confidence: detectedPattern.confidence, 
        pattern: detectedPattern.name 
      };
    }
    
    return { isKnownPattern: false, confidence: 'unknown' };
  }

  /**
   * NEW: Detect business email patterns dynamically
   */
  detectBusinessPattern(username) {
    // Remove numbers and special chars for pattern analysis
    const cleanUsername = username.replace(/[0-9._+-]/g, '');
    
    // Pattern detection logic
    const patterns = [
      {
        name: 'first.last',
        regex: /^[a-z]+\.[a-z]+$/,
        confidence: 'high',
        test: () => /^[a-z]{2,}\.[a-z]{2,}$/.test(username)
      },
      {
        name: 'firstname.lastname',
        regex: /^[a-z]+\.[a-z]+$/,
        confidence: 'high',
        test: () => username.includes('.') && username.split('.').every(part => part.length >= 2)
      },
      {
        name: 'first_last',
        regex: /^[a-z]+_[a-z]+$/,
        confidence: 'high',
        test: () => /^[a-z]{2,}_[a-z]{2,}$/.test(username)
      },
      {
        name: 'firstlast',
        regex: /^[a-z]{4,}$/,
        confidence: 'medium',
        test: () => /^[a-z]{4,20}$/.test(username) && cleanUsername.length >= 4
      },
      {
        name: 'first',
        regex: /^[a-z]{2,}$/,
        confidence: 'medium',
        test: () => /^[a-z]{2,15}$/.test(username) && !username.includes('.')
      },
      {
        name: 'initial.last',
        regex: /^[a-z]\.[a-z]+$/,
        confidence: 'high',
        test: () => /^[a-z]\.[a-z]{2,}$/.test(username)
      },
      {
        name: 'first.initial',
        regex: /^[a-z]+\.[a-z]$/,
        confidence: 'high',
        test: () => /^[a-z]{2,}\.[a-z]$/.test(username)
      }
    ];
    
    for (const pattern of patterns) {
      if (pattern.test()) {
        return pattern;
      }
    }
    
    return null;
  }

  /**
   * NEW: Learn patterns for domains
   */
  learnPattern(domain, pattern) {
    if (!this.learnedPatterns.has(domain)) {
      this.learnedPatterns.set(domain, []);
    }
    
    const domainPatterns = this.learnedPatterns.get(domain);
    if (!domainPatterns.some(p => p.name === pattern.name)) {
      domainPatterns.push(pattern);
    }
  }

  /**
   * NEW: Check if username matches a specific pattern
   */
  matchesPattern(username, pattern) {
    return pattern.test ? pattern.test() : pattern.regex.test(username);
  }

  /**
   * ENHANCED: DNS MX Record Check with retry
   */
  async checkMXRecord(email, attempt = 1) {
    try {
      const domain = email.split('@')[1];
      if (!domain) {
        return { valid: false, method: 'mx', error: 'Invalid email format' };
      }

      const mxRecords = await dns.resolveMx(domain);
      
      return {
        valid: mxRecords && mxRecords.length > 0,
        method: 'mx',
        mxRecords: mxRecords?.map(mx => ({ exchange: mx.exchange, priority: mx.priority })),
        confidence: 'medium',
        attempt
      };
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.log(`MX check failed for ${email}, retrying... (attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        return this.checkMXRecord(email, attempt + 1);
      }
      
      return {
        valid: false,
        method: 'mx',
        error: error.code || error.message,
        confidence: 'low',
        attempts: attempt
      };
    }
  }

  /**
   * ENHANCED: SMTP with better error handling and retry
   */
  async checkSMTPHandshake(email, attempt = 1) {
    const domain = email.split('@')[1];
    const lowerDomain = domain.toLowerCase();
    
    // Skip SMTP for known blocking domains but don't fail the email
    if (this.corporateDomainsWithStrictSecurity.includes(lowerDomain)) {
      return {
        valid: null, // null means inconclusive, not invalid
        method: 'smtp',
        error: 'Corporate domain - SMTP verification skipped',
        confidence: 'unknown',
        corporateBlocked: true,
        note: 'Corporate domain likely blocks SMTP verification for security'
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (attempt < this.maxRetries) {
          console.log(`SMTP timeout for ${email}, retrying... (attempt ${attempt + 1})`);
          resolve(this.checkSMTPHandshake(email, attempt + 1));
        } else {
          resolve({
            valid: null, // Timeout doesn't mean invalid
            method: 'smtp',
            error: 'Timeout after retries',
            confidence: 'unknown',
            attempts: attempt
          });
        }
      }, this.smtpTimeout);

      this.getMXRecord(domain)
        .then(mxRecord => {
          if (!mxRecord) {
            clearTimeout(timeout);
            return resolve({
              valid: false,
              method: 'smtp',
              error: 'No MX record found',
              confidence: 'high'
            });
          }

          const client = new net.Socket();
          let step = 0;
          let result = { valid: false, method: 'smtp', confidence: 'medium', attempt };

          client.setTimeout(this.smtpTimeout);
          
          client.connect(25, mxRecord, () => {
            // Connected to SMTP server
          });

          client.on('data', (data) => {
            const response = data.toString();
            
            switch (step) {
              case 0: // Initial connection
                if (response.includes('220')) {
                  client.write('HELO verify.local\r\n');
                  step = 1;
                } else {
                  result.error = 'SMTP connection rejected';
                  client.destroy();
                }
                break;
                
              case 1: // HELO response
                if (response.includes('250')) {
                  client.write('MAIL FROM: <verify@verify.local>\r\n');
                  step = 2;
                } else {
                  result.error = 'HELO command failed';
                  client.destroy();
                }
                break;
                
              case 2: // MAIL FROM response
                if (response.includes('250')) {
                  client.write(`RCPT TO: <${email}>\r\n`);
                  step = 3;
                } else {
                  result.error = 'MAIL FROM command failed';
                  client.destroy();
                }
                break;
                
              case 3: // RCPT TO response
                if (response.includes('250')) {
                  result.valid = true;
                  result.confidence = 'high';
                  result.smtpResponse = response.trim();
                } else if (response.includes('550') || response.includes('551') || response.includes('553')) {
                  result.valid = false;
                  result.confidence = 'high';
                  result.smtpResponse = response.trim();
                } else if (response.includes('421') || response.includes('450') || response.includes('451')) {
                  // Temporary failure - not definitive
                  result.valid = null;
                  result.confidence = 'unknown';
                  result.smtpResponse = response.trim();
                  result.temporary = true;
                } else {
                  result.valid = null;
                  result.confidence = 'unknown';
                  result.smtpResponse = response.trim();
                }
                client.write('QUIT\r\n');
                step = 4;
                break;
                
              case 4: // QUIT response
                client.destroy();
                break;
            }
          });

          client.on('error', (err) => {
            result.error = err.message;
            result.valid = null; // Error doesn't mean invalid
            client.destroy();
          });

          client.on('timeout', () => {
            result.error = 'SMTP timeout';
            result.valid = null; // Timeout doesn't mean invalid
            client.destroy();
          });

          client.on('close', () => {
            clearTimeout(timeout);
            resolve(result);
          });
        })
        .catch(err => {
          clearTimeout(timeout);
          resolve({
            valid: null, // DNS error doesn't mean email is invalid
            method: 'smtp',
            error: err.message,
            confidence: 'unknown'
          });
        });
    });
  }

  /**
   * COMPLETELY REWRITTEN: Smart result analysis with better logic
   */
  analyzeResultsEnhanced(checks, email, patternCheck) {
    const domain = email.split('@')[1].toLowerCase();
    const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain);
    
    const mxCheck = checks.find(check => check.method === 'mx');
    const smtpCheck = checks.find(check => check.method === 'smtp');
    const patternCheckResult = checks.find(check => check.method === 'pattern');
    
    let confidence = 'unknown';
    let valid = false;
    let reasons = [];

    // PRIMARY: MX record check - if no MX, definitely invalid
    if (!mxCheck || !mxCheck.valid) {
      return {
        valid: false,
        confidence: 'high',
        reasons: ['Domain does not accept email (no MX records)'],
        corporateDomain: isCorporateDomain,
        patternMatch: null,
        summary: {
          totalChecks: checks.length,
          mxValid: false,
          smtpValid: false,
          patternValid: false
        }
      };
    }

    // Domain has MX records, so it CAN receive email
    reasons.push('Domain has valid MX records');

    // SECONDARY: Pattern matching (high weight for business emails)
    if (patternCheck && patternCheck.isKnownPattern) {
      valid = true;
      confidence = patternCheck.confidence;
      reasons.push(`Matches known business email pattern: ${patternCheck.pattern}`);
      
      // High confidence patterns are very reliable
      if (patternCheck.confidence === 'high') {
        confidence = 'high';
      }
    }

    // TERTIARY: SMTP results (but don't override pattern matching)
    if (smtpCheck) {
      if (smtpCheck.valid === true) {
        valid = true;
        confidence = 'high';
        reasons.push('SMTP verification successful');
      } else if (smtpCheck.valid === false && smtpCheck.confidence === 'high') {
        // Only mark as invalid if SMTP definitively failed AND no pattern match
        if (!patternCheck || !patternCheck.isKnownPattern) {
          valid = false;
          confidence = 'high';
          reasons.push('SMTP verification failed');
        } else {
          // Pattern match overrides SMTP failure for business emails
          reasons.push('SMTP failed but pattern suggests valid business email');
        }
      } else {
        // SMTP inconclusive (null, timeout, etc.)
        if (!valid) { // Only if not already validated by pattern
          valid = true;
          confidence = 'medium';
          reasons.push('SMTP inconclusive, but domain accepts email');
        }
      }
    }

    // FALLBACK: For corporate domains without SMTP
    if (isCorporateDomain && !valid) {
      valid = true;
      confidence = 'medium';
      reasons.push('Corporate domain with MX records (likely valid)');
    }

    // FINAL FALLBACK: Domain has MX records
    if (!valid) {
      valid = true;
      confidence = 'low';
      reasons.push('Domain can receive email (MX record exists)');
    }

    return {
      valid,
      confidence,
      reasons,
      corporateDomain: isCorporateDomain,
      patternMatch: patternCheck?.isKnownPattern ? patternCheck.pattern : null,
      summary: {
        totalChecks: checks.length,
        mxValid: mxCheck?.valid || false,
        smtpValid: smtpCheck?.valid || false,
        patternValid: patternCheckResult?.valid || patternCheck?.isKnownPattern || false
      }
    };
  }

  /**
   * ENHANCED: Main verification method with better error handling
   */
  async verifyEmail(email, options = {}) {
    const results = {
      email,
      timestamp: new Date().toISOString(),
      checks: [],
      finalResult: {
        valid: false,
        confidence: 'unknown',
        reasons: []
      }
    };

    try {
      // Step 1: Basic format validation
      if (!this.validateEmailFormat(email)) {
        results.finalResult.reasons.push('Invalid email format');
        return results;
      }

      // Step 2: Enhanced pattern checking
      const patternCheck = this.checkAgainstKnownPatterns(email);
      if (patternCheck.isKnownPattern) {
        results.checks.push({
          valid: true,
          method: 'pattern',
          confidence: patternCheck.confidence,
          pattern: patternCheck.pattern,
          note: 'Matches business email pattern'
        });
      }

      // Step 3: MX Record check with retry
      const mxCheck = await this.checkMXRecord(email);
      results.checks.push(mxCheck);
      
      // Step 4: SMTP check (more forgiving)
      if (options.enableSMTP !== false) {
        try {
          const smtpCheck = await this.checkSMTPHandshake(email);
          results.checks.push(smtpCheck);
        } catch (error) {
          results.checks.push({
            valid: null,
            method: 'smtp',
            error: error.message,
            confidence: 'unknown',
            note: 'SMTP check failed due to error'
          });
        }
      }

      // Analyze results with improved logic
      results.finalResult = this.analyzeResultsEnhanced(results.checks, email, patternCheck);
      
      return results;
    } catch (error) {
      results.finalResult.error = error.message;
      return results;
    }
  }

  /**
   * ENHANCED: Better batch processing
   */
  async verifyEmailBatch(emails, options = {}) {
    const results = [];
    const concurrency = Math.min(options.concurrency || 1, 2); // Reduced for reliability
    const delay = Math.max(options.delay || 4000, 3000); // Increased delay
    
    console.log(`Starting enhanced batch verification of ${emails.length} emails...`);
    console.log(`Using concurrency: ${concurrency}, delay: ${delay}ms`);
    
    for (let i = 0; i < emails.length; i += concurrency) {
      const batch = emails.slice(i, i + concurrency);
      const batchNum = Math.floor(i/concurrency) + 1;
      const totalBatches = Math.ceil(emails.length/concurrency);
      
      console.log(`Processing batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);
      
      const batchPromises = batch.map(email => 
        this.verifyEmail(email, options).catch(error => ({
          email,
          error: error.message,
          finalResult: { valid: false, confidence: 'unknown', reasons: ['Verification failed'] }
        }))
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const emailResult = result.value;
          console.log(`  ✓ ${batch[index]}: ${emailResult.finalResult.valid ? 'Valid' : 'Invalid'} (${emailResult.finalResult.confidence})`);
          results.push(emailResult);
        } else {
          console.log(`  ✗ ${batch[index]}: Error - ${result.reason?.message}`);
          results.push({
            email: batch[index],
            error: result.reason?.message || 'Unknown error',
            finalResult: { valid: false, confidence: 'unknown', reasons: ['Processing failed'] }
          });
        }
      });
      
      // Progressive delay between batches
      if (i + concurrency < emails.length) {
        console.log(`Waiting ${delay/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Enhanced summary
    const validCount = results.filter(r => r.finalResult?.valid === true).length;
    const highConfidence = results.filter(r => r.finalResult?.confidence === 'high').length;
    const patternMatches = results.filter(r => r.finalResult?.patternMatch).length;
    
    console.log(`\n📊 Enhanced Verification Summary:`);
    console.log(`   Total: ${emails.length}`);
    console.log(`   Valid: ${validCount} (${((validCount/emails.length)*100).toFixed(1)}%)`);
    console.log(`   High Confidence: ${highConfidence}`);
    console.log(`   Pattern Matches: ${patternMatches}`);
    
    return results;
  }

  /**
   * Helper method to get MX record (unchanged)
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
   * Save verification results (unchanged)
   */
  async saveResults(results, filename = null) {
    try {
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `email_verification_enhanced_${timestamp}.json`;
      }

      const outputDir = path.join(process.cwd(), 'email_verification_results');
      
      await fs.mkdir(outputDir, { recursive: true });
      
      const filePath = path.join(outputDir, filename);
      
      // Enhanced results with metadata
      const enhancedResults = {
        metadata: {
          version: '2.0',
          timestamp: new Date().toISOString(),
          totalEmails: Array.isArray(results) ? results.length : 1,
          validEmails: Array.isArray(results) 
            ? results.filter(r => r.finalResult?.valid === true).length 
            : (results.finalResult?.valid === true ? 1 : 0),
          improvements: [
            'Enhanced pattern recognition',
            'Better SMTP handling with retries',
            'Improved corporate domain detection',
            'Smarter result analysis logic',
            'Dynamic pattern learning'
          ]
        },
        results: results
      };
      
      await fs.writeFile(filePath, JSON.stringify(enhancedResults, null, 2), 'utf8');
      
      return {
        success: true,
        filePath,
        filename
      };
    } catch (error) {
      throw new Error(`Failed to save verification results: ${error.message}`);
    }
  }
}

module.exports = emailVerifier;