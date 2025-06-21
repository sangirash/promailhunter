// utils/emailVerifier.js
const dns = require('dns').promises;
const net = require('net');
const fs = require('fs').promises;
const path = require('path');

class EmailVerifier {
  constructor() {
    this.timeout = 10000; // 10 seconds timeout
    this.smtpTimeout = 8000; // 8 seconds for SMTP (increased from 5)
    
    // Known corporate domains that typically block SMTP verification
    this.corporateDomainsWithStrictSecurity = [
      'microsoft.com', 'google.com', 'apple.com', 'amazon.com', 'facebook.com',
      'ukg.com', 'salesforce.com', 'oracle.com', 'sap.com', 'workday.com',
      'paypal.com', 'netflix.com', 'adobe.com', 'vmware.com', 'citrix.com'
    ];
    
    // Known email patterns for major companies
    this.knownValidPatterns = {
      'ukg.com': ['first.last', 'first', 'last', 'firstlast', 'first_last'],
      'microsoft.com': ['first.last', 'first', 'firstlast'],
      'google.com': ['first.last', 'first', 'firstlast'],
      'apple.com': ['first.last', 'first', 'firstlast'],
      'amazon.com': ['first.last', 'first', 'firstlast']
    };
  }

  /**
   * Enhanced email format validation with pattern recognition
   */
  validateEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    
    const [username, domain] = email.split('@');
    
    // Additional checks
    if (username.length < 1 || username.length > 64) return false;
    if (domain.length < 4 || domain.length > 255) return false;
    
    return true;
  }

  /**
   * Check if email pattern matches known corporate patterns
   */
  checkAgainstKnownPatterns(email) {
    const [username, domain] = email.split('@');
    const lowerDomain = domain.toLowerCase();
    
    if (!this.knownValidPatterns[lowerDomain]) {
      return { isKnownPattern: false, confidence: 'unknown' };
    }
    
    const patterns = this.knownValidPatterns[lowerDomain];
    const lowerUsername = username.toLowerCase();
    
    // Check if username matches known patterns
    for (const pattern of patterns) {
      switch (pattern) {
        case 'first.last':
          if (/^[a-z]+\.[a-z]+$/.test(lowerUsername)) {
            return { isKnownPattern: true, confidence: 'high', pattern: 'first.last' };
          }
          break;
        case 'first_last':
          if (/^[a-z]+_[a-z]+$/.test(lowerUsername)) {
            return { isKnownPattern: true, confidence: 'high', pattern: 'first_last' };
          }
          break;
        case 'firstlast':
          if (/^[a-z]{4,}$/.test(lowerUsername) && lowerUsername.length >= 6) {
            return { isKnownPattern: true, confidence: 'medium', pattern: 'firstlast' };
          }
          break;
        case 'first':
          if (/^[a-z]{2,}$/.test(lowerUsername) && lowerUsername.length <= 10) {
            return { isKnownPattern: true, confidence: 'medium', pattern: 'first' };
          }
          break;
        case 'last':
          if (/^[a-z]{2,}$/.test(lowerUsername) && lowerUsername.length <= 15) {
            return { isKnownPattern: true, confidence: 'medium', pattern: 'last' };
          }
          break;
      }
    }
    
    return { isKnownPattern: false, confidence: 'low' };
  }

  /**
   * Method 1: DNS MX Record Check (Enhanced)
   */
  async checkMXRecord(email) {
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
        confidence: 'low'
      };
    } catch (error) {
      return {
        valid: false,
        method: 'mx',
        error: error.code || error.message,
        confidence: 'low'
      };
    }
  }

  /**
   * Method 2: Enhanced SMTP Handshake with better corporate handling
   */
  async checkSMTPHandshake(email) {
    const domain = email.split('@')[1];
    const lowerDomain = domain.toLowerCase();
    
    // Check if this is a known corporate domain that blocks verification
    if (this.corporateDomainsWithStrictSecurity.includes(lowerDomain)) {
      return {
        valid: false,
        method: 'smtp',
        error: 'Corporate domain blocks SMTP verification',
        confidence: 'unknown',
        corporateBlocked: true,
        note: 'This corporate domain typically blocks automated verification attempts'
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          valid: false,
          method: 'smtp',
          error: 'Timeout',
          confidence: 'unknown'
        });
      }, this.smtpTimeout);

      this.getMXRecord(domain)
        .then(mxRecord => {
          if (!mxRecord) {
            clearTimeout(timeout);
            return resolve({
              valid: false,
              method: 'smtp',
              error: 'No MX record found',
              confidence: 'medium'
            });
          }

          const client = new net.Socket();
          let step = 0;
          let result = { valid: false, method: 'smtp', confidence: 'medium' };

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
                  result.error = 'SMTP connection failed';
                  client.destroy();
                }
                break;
                
              case 1: // HELO response
                if (response.includes('250')) {
                  client.write('MAIL FROM: <verify@verify.local>\r\n');
                  step = 2;
                } else {
                  result.error = 'HELO failed';
                  client.destroy();
                }
                break;
                
              case 2: // MAIL FROM response
                if (response.includes('250')) {
                  client.write(`RCPT TO: <${email}>\r\n`);
                  step = 3;
                } else {
                  result.error = 'MAIL FROM failed';
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
                  // Temporary failure - could be rate limiting
                  result.valid = false;
                  result.confidence = 'unknown';
                  result.smtpResponse = response.trim();
                  result.temporary = true;
                } else {
                  result.valid = false;
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
            if (err.code === 'ECONNREFUSED') {
              result.note = 'SMTP server refused connection (may block verification)';
            }
            client.destroy();
          });

          client.on('timeout', () => {
            result.error = 'SMTP timeout';
            result.note = 'Server may be blocking automated verification';
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
            valid: false,
            method: 'smtp',
            error: err.message,
            confidence: 'medium'
          });
        });
    });
  }

  /**
   * Enhanced comprehensive verification with better corporate domain handling
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

      // Step 2: Check against known patterns for corporate domains
      const patternCheck = this.checkAgainstKnownPatterns(email);
      if (patternCheck.isKnownPattern) {
        results.checks.push({
          valid: true,
          method: 'pattern',
          confidence: patternCheck.confidence,
          pattern: patternCheck.pattern,
          note: 'Matches known corporate email pattern'
        });
      }

      // Step 3: MX Record check (always do this)
      const mxCheck = await this.checkMXRecord(email);
      results.checks.push(mxCheck);
      
      if (!mxCheck.valid) {
        results.finalResult.reasons.push('No MX record found for domain');
        return results;
      }

      // Step 4: SMTP check (if enabled and not a blocking corporate domain)
      const domain = email.split('@')[1].toLowerCase();
      const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain);
      
      if (options.enableSMTP !== false && !isCorporateDomain) {
        try {
          const smtpCheck = await this.checkSMTPHandshake(email);
          results.checks.push(smtpCheck);
        } catch (error) {
          results.checks.push({
            valid: false,
            method: 'smtp',
            error: error.message,
            confidence: 'unknown'
          });
        }
      } else if (isCorporateDomain) {
        results.checks.push({
          valid: false,
          method: 'smtp',
          error: 'Skipped - Corporate domain blocks verification',
          confidence: 'unknown',
          note: 'Corporate domains typically block SMTP verification for security'
        });
      }

      // Analyze results and determine final verdict
      results.finalResult = this.analyzeResultsEnhanced(results.checks, email, patternCheck);
      
      return results;
    } catch (error) {
      results.finalResult.error = error.message;
      return results;
    }
  }

  /**
   * Enhanced result analysis with corporate domain intelligence
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

    // If domain has MX records, it can receive emails
    if (mxCheck && mxCheck.valid) {
      // For corporate domains with known patterns
      if (isCorporateDomain && patternCheck.isKnownPattern) {
        valid = true;
        confidence = patternCheck.confidence;
        reasons.push(`Corporate domain with valid MX records and known email pattern (${patternCheck.pattern})`);
        
        // Boost confidence for high-confidence patterns
        if (patternCheck.confidence === 'high') {
          confidence = 'high';
        }
      }
      // For corporate domains without known patterns
      else if (isCorporateDomain) {
        valid = true;
        confidence = 'medium';
        reasons.push('Corporate domain with valid MX records (SMTP verification blocked by security policy)');
      }
      // For non-corporate domains, use SMTP results if available
      else if (smtpCheck) {
        if (smtpCheck.valid === true) {
          valid = true;
          confidence = 'high';
          reasons.push('SMTP verification successful');
        } else if (smtpCheck.valid === false && !smtpCheck.temporary) {
          valid = false;
          confidence = 'high';
          reasons.push('SMTP verification failed');
        } else {
          valid = true;
          confidence = 'medium';
          reasons.push('Domain accepts email (MX record exists), SMTP verification inconclusive');
        }
      }
      // Fallback: domain has MX records
      else {
        valid = true;
        confidence = 'medium';
        reasons.push('Domain accepts email (MX record exists)');
      }
    } else {
      valid = false;
      confidence = 'high';
      reasons.push('Domain does not accept email (no MX records)');
    }

    return {
      valid,
      confidence,
      reasons,
      corporateDomain: isCorporateDomain,
      patternMatch: patternCheck.isKnownPattern ? patternCheck.pattern : null,
      summary: {
        totalChecks: checks.length,
        mxValid: mxCheck?.valid || false,
        smtpValid: smtpCheck?.valid || false,
        patternValid: patternCheckResult?.valid || false
      }
    };
  }

  /**
   * Verify multiple emails in batch with enhanced corporate handling
   */
  async verifyEmailBatch(emails, options = {}) {
    const results = [];
    const concurrency = Math.min(options.concurrency || 2, 3); // Reduced concurrency for better reliability
    const delay = Math.max(options.delay || 3000, 2000); // Increased delay
    
    console.log(`Starting batch verification of ${emails.length} emails...`);
    
    for (let i = 0; i < emails.length; i += concurrency) {
      const batch = emails.slice(i, i + concurrency);
      console.log(`Processing batch ${Math.floor(i/concurrency) + 1}/${Math.ceil(emails.length/concurrency)} (${batch.length} emails)`);
      
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
          results.push(result.value);
        } else {
          results.push({
            email: batch[index],
            error: result.reason?.message || 'Unknown error',
            finalResult: { valid: false, confidence: 'unknown', reasons: ['Processing failed'] }
          });
        }
      });
      
      // Add delay between batches (longer for corporate domains)
      if (i + concurrency < emails.length) {
        const hasCorporateDomains = batch.some(email => {
          const domain = email.split('@')[1]?.toLowerCase();
          return this.corporateDomainsWithStrictSecurity.includes(domain);
        });
        
        const delayTime = hasCorporateDomains ? delay * 1.5 : delay;
        console.log(`Waiting ${delayTime/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }
    }
    
    // Log summary
    const validCount = results.filter(r => r.finalResult?.valid === true).length;
    const corporateCount = results.filter(r => r.finalResult?.corporateDomain === true).length;
    console.log(`Batch verification complete: ${validCount}/${emails.length} valid, ${corporateCount} corporate domains`);
    
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
   * Save verification results to file
   */
  async saveResults(results, filename = null) {
    try {
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `email_verification_${timestamp}.json`;
      }

      const outputDir = path.join(process.cwd(), 'email_verification_results');
      
      await fs.mkdir(outputDir, { recursive: true });
      
      const filePath = path.join(outputDir, filename);
      await fs.writeFile(filePath, JSON.stringify(results, null, 2), 'utf8');
      
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

module.exports = EmailVerifier;