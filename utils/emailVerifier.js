// utils/emailVerifier.js
const dns = require('dns').promises;
const net = require('net');
const nodemailer = require('nodemailer');
const axios = require('axios');

class EmailVerifier {
  constructor() {
    this.timeout = 10000; // 10 seconds timeout
    this.smtpTimeout = 5000; // 5 seconds for SMTP
    this.commonMxServers = new Map([
      ['gmail.com', ['gmail-smtp-in.l.google.com']],
      ['yahoo.com', ['mta5.am0.yahoodns.net', 'mta6.am0.yahoodns.net']],
      ['outlook.com', ['outlook-com.olc.protection.outlook.com']],
      ['hotmail.com', ['hotmail-com.olc.protection.outlook.com']]
    ]);
  }

  /**
   * Method 1: DNS MX Record Check (Fast, Basic)
   * Checks if the domain has valid mail exchange records
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
   * Connects to SMTP server and checks if email exists without sending
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
   * Method 3: Email Service API (High accuracy, may cost money)
   * Uses third-party services like Hunter.io, ZeroBounce, etc.
   */
  async checkWithAPI(email, apiKey = null, service = 'hunter') {
    try {
      if (!apiKey) {
        return {
          valid: false,
          method: 'api',
          error: 'API key required',
          confidence: 'high'
        };
      }

      let response;
      
      switch (service.toLowerCase()) {
        case 'hunter':
          response = await axios.get(`https://api.hunter.io/v2/email-verifier`, {
            params: {
              email: email,
              api_key: apiKey
            },
            timeout: this.timeout
          });
          
          return {
            valid: response.data.data.result === 'deliverable',
            method: 'api',
            service: 'hunter.io',
            result: response.data.data.result,
            score: response.data.data.score,
            confidence: 'high'
          };

        case 'zerobounce':
          response = await axios.get(`https://api.zerobounce.net/v2/validate`, {
            params: {
              api_key: apiKey,
              email: email
            },
            timeout: this.timeout
          });
          
          return {
            valid: response.data.status === 'valid',
            method: 'api',
            service: 'zerobounce',
            status: response.data.status,
            confidence: 'high'
          };

        default:
          return {
            valid: false,
            method: 'api',
            error: 'Unsupported API service',
            confidence: 'high'
          };
      }
    } catch (error) {
      return {
        valid: false,
        method: 'api',
        error: error.response?.data?.message || error.message,
        confidence: 'high'
      };
    }
  }

  /**
   * Method 4: Email Ping (Send actual test email)
   * This should be used very carefully and sparingly
   */
  async checkWithEmailPing(email, smtpConfig) {
    try {
      if (!smtpConfig || !smtpConfig.host || !smtpConfig.auth) {
        return {
          valid: false,
          method: 'ping',
          error: 'SMTP configuration required',
          confidence: 'high'
        };
      }

      const transporter = nodemailer.createTransporter({
        host: smtpConfig.host,
        port: smtpConfig.port || 587,
        secure: smtpConfig.secure || false,
        auth: smtpConfig.auth
      });

      // Send a very small, non-intrusive test email
      const testEmail = {
        from: smtpConfig.auth.user,
        to: email,
        subject: 'Email verification test',
        html: `
          <div style="font-size: 10px; color: #999;">
            This is an automated email verification test. 
            If you received this, please ignore it.
            <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="1" height="1">
          </div>
        `
      };

      const info = await transporter.sendMail(testEmail);
      
      return {
        valid: true,
        method: 'ping',
        messageId: info.messageId,
        response: info.response,
        confidence: 'high',
        warning: 'Email was actually sent'
      };
    } catch (error) {
      // Parse different types of SMTP errors
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('recipient address rejected') || 
          errorMessage.includes('user unknown') ||
          errorMessage.includes('mailbox unavailable') ||
          errorMessage.includes('no such user')) {
        return {
          valid: false,
          method: 'ping',
          error: 'Email address does not exist',
          smtpError: error.message,
          confidence: 'high'
        };
      }
      
      return {
        valid: false,
        method: 'ping',
        error: error.message,
        confidence: 'medium',
        uncertain: true
      };
    }
  }

  /**
   * Method 5: Comprehensive verification (combines multiple methods)
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
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
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
        const smtpCheck = await this.checkSMTPHandshake(email);
        results.checks.push(smtpCheck);
      }

      // Step 4: API check (if API key provided)
      if (options.apiKey && options.apiService) {
        const apiCheck = await this.checkWithAPI(email, options.apiKey, options.apiService);
        results.checks.push(apiCheck);
      }

      // Step 5: Email ping (only if explicitly enabled - use carefully!)
      if (options.enableEmailPing && options.smtpConfig) {
        const pingCheck = await this.checkWithEmailPing(email, options.smtpConfig);
        results.checks.push(pingCheck);
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
    const concurrency = options.concurrency || 5;
    const delay = options.delay || 1000; // 1 second delay between batches
    
    for (let i = 0; i < emails.length; i += concurrency) {
      const batch = emails.slice(i, i + concurrency);
      const batchPromises = batch.map(email => this.verifyEmail(email, options));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            email: batch[index],
            error: result.reason?.message || 'Unknown error',
            finalResult: { valid: false, confidence: 'unknown' }
          });
        }
      });
      
      // Add delay between batches to be respectful to servers
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
    const uncertainChecks = checks.filter(check => check.uncertain === true);
    
    let confidence = 'unknown';
    let valid = false;
    let reasons = [];

    // High confidence checks (API, Email ping)
    const highConfidenceChecks = checks.filter(check => check.confidence === 'high');
    if (highConfidenceChecks.length > 0) {
      const highConfidenceValid = highConfidenceChecks.filter(check => check.valid === true);
      if (highConfidenceValid.length > 0) {
        valid = true;
        confidence = 'high';
        reasons.push('Verified by high-confidence method');
      } else {
        valid = false;
        confidence = 'high';
        reasons.push('Rejected by high-confidence method');
      }
    }
    // Medium confidence (SMTP)
    else if (checks.some(check => check.confidence === 'medium')) {
      const mediumChecks = checks.filter(check => check.confidence === 'medium');
      const mediumValid = mediumChecks.filter(check => check.valid === true);
      
      if (mediumValid.length > 0 && invalidChecks.length === 0) {
        valid = true;
        confidence = 'medium';
        reasons.push('SMTP verification successful');
      } else if (mediumValid.length === 0) {
        valid = false;
        confidence = 'medium';
        reasons.push('SMTP verification failed');
      } else {
        valid = false;
        confidence = 'low';
        reasons.push('Mixed results from verification methods');
      }
    }
    // Low confidence (MX only)
    else {
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
        invalidChecks: invalidChecks.length,
        uncertainChecks: uncertainChecks.length
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

      const fs = require('fs').promises;
      const path = require('path');
      
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