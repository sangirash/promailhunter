// utils/emailVerifier.js
const dns = require('dns').promises;
const net = require('net');
const fs = require('fs').promises;
const path = require('path');

class EmailVerifier {
  constructor() {
    this.timeout = 10000; // 10 seconds timeout
    this.smtpTimeout = 5000; // 5 seconds for SMTP
  }

  /**
   * Method 1: DNS MX Record Check (Fast, Basic)
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
   * Method 2: SMTP Handshake (Medium accuracy, slower)
   */
  async checkSMTPHandshake(email) {
    return new Promise((resolve) => {
      const domain = email.split('@')[1];
      const timeout = setTimeout(() => {
        resolve({
          valid: false,
          method: 'smtp',
          error: 'Timeout',
          confidence: 'medium'
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
                  result.smtpResponse = response.trim();
                } else if (response.includes('550') || response.includes('551') || response.includes('553')) {
                  result.valid = false;
                  result.smtpResponse = response.trim();
                } else {
                  result.valid = false;
                  result.smtpResponse = response.trim();
                  result.uncertain = true;
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
            client.destroy();
          });

          client.on('timeout', () => {
            result.error = 'SMTP timeout';
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
   * Basic email format validation
   */
  validateEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Comprehensive verification (combines multiple methods)
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

      // Step 2: MX Record check (always do this first)
      const mxCheck = await this.checkMXRecord(email);
      results.checks.push(mxCheck);
      
      if (!mxCheck.valid) {
        results.finalResult.reasons.push('No MX record found');
        return results;
      }

      // Step 3: SMTP check (if enabled)
      if (options.enableSMTP !== false) {
        try {
          const smtpCheck = await this.checkSMTPHandshake(email);
          results.checks.push(smtpCheck);
        } catch (error) {
          results.checks.push({
            valid: false,
            method: 'smtp',
            error: error.message,
            confidence: 'medium'
          });
        }
      }

      // Analyze results and determine final verdict
      results.finalResult = this.analyzeResults(results.checks);
      
      return results;
    } catch (error) {
      results.finalResult.error = error.message;
      return results;
    }
  }

  /**
   * Verify multiple emails in batch
   */
  async verifyEmailBatch(emails, options = {}) {
    const results = [];
    const concurrency = Math.min(options.concurrency || 3, 5);
    const delay = Math.max(options.delay || 2000, 1000);
    
    for (let i = 0; i < emails.length; i += concurrency) {
      const batch = emails.slice(i, i + concurrency);
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
      
      // Add delay between batches
      if (i + concurrency < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log(`Verified batch ${Math.floor(i/concurrency) + 1}/${Math.ceil(emails.length/concurrency)}`);
    }
    
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
   * Analyze multiple check results to determine final verdict
   */
  analyzeResults(checks) {
    const validChecks = checks.filter(check => check.valid === true);
    const invalidChecks = checks.filter(check => check.valid === false);
    
    let confidence = 'unknown';
    let valid = false;
    let reasons = [];

    // If we have SMTP results, prioritize them
    const smtpCheck = checks.find(check => check.method === 'smtp');
    if (smtpCheck) {
      if (smtpCheck.valid === true) {
        valid = true;
        confidence = 'medium';
        reasons.push('SMTP verification successful');
      } else if (smtpCheck.valid === false && !smtpCheck.uncertain) {
        valid = false;
        confidence = 'medium';
        reasons.push('SMTP verification failed');
      } else {
        // SMTP was uncertain, fall back to MX
        valid = checks.some(check => check.method === 'mx' && check.valid);
        confidence = 'low';
        reasons.push('SMTP uncertain, using MX record result');
      }
    } else {
      // Only MX check available
      const mxCheck = checks.find(check => check.method === 'mx');
      if (mxCheck && mxCheck.valid) {
        valid = true;
        confidence = 'low';
        reasons.push('Domain accepts email (MX record exists)');
      } else {
        valid = false;
        confidence = 'low';
        reasons.push('Domain does not accept email');
      }
    }

    return {
      valid,
      confidence,
      reasons,
      summary: {
        totalChecks: checks.length,
        validChecks: validChecks.length,
        invalidChecks: invalidChecks.length
      }
    };
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
      
      try {
        await fs.access(outputDir);
      } catch {
        await fs.mkdir(outputDir, { recursive: true });
      }
      
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