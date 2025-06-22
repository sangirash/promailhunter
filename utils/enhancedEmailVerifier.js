// utils/enhancedEmailVerifier.js - REFACTORED: Company domains focus - COMPLETE VERSION
const dns = require('dns').promises;
const net = require('net');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class EnhancedEmailVerifier {
  constructor() {
    this.timeout = 10000;
    this.smtpTimeout = 8000;
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
      'amazon.com': ['first.last', 'first', 'firstlast', 'first_last'],
      'meta.com': ['first.last', 'first', 'firstlast'],
      'linkedin.com': ['first.last', 'first', 'firstlast'],
      'salesforce.com': ['first.last', 'first', 'firstlast'],
      'oracle.com': ['first.last', 'first', 'firstlast', 'first_last'],
      'sap.com': ['first.last', 'first', 'firstlast'],
      'workday.com': ['first.last', 'first', 'firstlast', 'first_last'],
      'ibm.com': ['first.last', 'first', 'firstlast'],
      'intel.com': ['first.last', 'first', 'firstlast'],
      'nvidia.com': ['first.last', 'first', 'firstlast'],
      'cisco.com': ['first.last', 'first', 'firstlast']
    };

    // PUBLIC DOMAINS TO REJECT - We should never verify these in corporate context
    this.publicDomains = [
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
      'icloud.com', 'protonmail.com', 'mail.com', 'live.com', 'msn.com',
      'yandex.com', 'mail.ru', 'qq.com', '163.com', 'sina.com'
    ];

    // Verify Python email-validator is available
    this.pythonAvailable = false;
    this.checkPythonValidator();
    
    console.log('🎯 Enhanced Email Verifier - Corporate domains focus mode');
  }

  /**
   * Check if an email uses a public domain (should be rejected for corporate email finding)
   */
  isPublicDomain(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return this.publicDomains.includes(domain);
  }

  /**
   * Check if Python email-validator is available
   */
  async checkPythonValidator() {
    try {
      const result = await this.runPythonValidator('test@example.com', { test: true });
      this.pythonAvailable = result.success;
      if (this.pythonAvailable) {
        console.log('✅ Python email-validator integration available');
      } else {
        console.log('⚠️ Python email-validator not available, falling back to Node.js validation');
      }
    } catch (error) {
      console.log('⚠️ Python email-validator check failed:', error.message);
      this.pythonAvailable = false;
    }
  }

  /**
   * Run Python email validator with corporate focus
   */
  async runPythonValidator(email, options = {}) {
    return new Promise((resolve, reject) => {
      const pythonScript = `
import sys
import json
import traceback

try:
    from email_validator import validate_email, EmailNotValidError, EmailSyntaxError, EmailUndeliverableError
    
    def main():
        email = sys.argv[1]
        options = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
        
        # Handle test mode
        if options.get('test'):
            print(json.dumps({"success": True, "test": True}))
            return
        
        # Check if this is a public domain (reject for corporate email finding)
        public_domains = [
            'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
            'icloud.com', 'protonmail.com', 'mail.com', 'live.com', 'msn.com'
        ]
        
        domain = email.split('@')[1].lower() if '@' in email else ''
        if domain in public_domains:
            response = {
                'success': True,
                'valid': False,
                'error': f'Public domain {domain} not allowed for corporate email verification',
                'error_type': 'public_domain',
                'confidence': 'high',
                'method': 'python-email-validator',
                'reasons': [f'Rejected public domain: {domain}'],
                'corporateEmailOnly': True
            }
            print(json.dumps(response))
            return
        
        try:
            # Configure validation options for corporate emails
            validation_options = {
                'check_deliverability': options.get('check_deliverability', True),
                'allow_smtputf8': options.get('allow_smtputf8', True),
                'allow_empty_local': False,  # Never allow empty local for corporate
                'allow_quoted_local': options.get('allow_quoted_local', True),
                'allow_domain_literal': False,  # Rarely used in corporate
                'allow_display_name': False,  # Not relevant for verification
                'test_environment': options.get('test_environment', False),
                'globally_deliverable': options.get('globally_deliverable', True),
                'timeout': options.get('timeout', 15)
            }
            
            # Validate the email
            result = validate_email(email, **validation_options)
            
            # Convert result to dict with corporate focus
            response = {
                'success': True,
                'valid': True,
                'normalized': result.normalized,
                'local_part': result.local_part,
                'domain': result.domain,
                'ascii_domain': result.ascii_domain,
                'ascii_email': result.ascii_email,
                'ascii_local_part': result.ascii_local_part,
                'smtputf8': result.smtputf8,
                'display_name': getattr(result, 'display_name', None),
                'mx': getattr(result, 'mx', []),
                'mx_fallback_type': getattr(result, 'mx_fallback_type', None),
                'confidence': 'high',
                'method': 'python-email-validator',
                'checks': ['syntax', 'format', 'domain', 'deliverability'],
                'reasons': ['Passed comprehensive Python email-validator checks for corporate email'],
                'corporateEmailOnly': True
            }
            
            print(json.dumps(response))
            
        except EmailSyntaxError as e:
            response = {
                'success': True,
                'valid': False,
                'error': str(e),
                'error_type': 'syntax',
                'confidence': 'high',
                'method': 'python-email-validator',
                'reasons': [f'Corporate email syntax error: {str(e)}'],
                'corporateEmailOnly': True
            }
            print(json.dumps(response))
            
        except EmailUndeliverableError as e:
            response = {
                'success': True,
                'valid': False,
                'error': str(e),
                'error_type': 'deliverability',
                'confidence': 'high',
                'method': 'python-email-validator',
                'reasons': [f'Corporate email deliverability error: {str(e)}'],
                'corporateEmailOnly': True
            }
            print(json.dumps(response))
            
        except EmailNotValidError as e:
            response = {
                'success': True,
                'valid': False,
                'error': str(e),
                'error_type': 'validation',
                'confidence': 'high',
                'method': 'python-email-validator',
                'reasons': [f'Corporate email validation error: {str(e)}'],
                'corporateEmailOnly': True
            }
            print(json.dumps(response))
            
    if __name__ == '__main__':
        main()
        
except ImportError as e:
    print(json.dumps({
        'success': False,
        'error': 'email-validator package not installed',
        'install_command': 'pip install email-validator'
    }))
except Exception as e:
    print(json.dumps({
        'success': False,
        'error': str(e),
        'traceback': traceback.format_exc()
    }))
`;

      const python = spawn('python3', ['-c', pythonScript, email, JSON.stringify(options)], {
        timeout: this.pythonTimeout
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        try {
          if (code === 0 && stdout.trim()) {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } else {
            reject(new Error(`Python process failed with code ${code}: ${stderr}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error.message}\nOutput: ${stdout}\nError: ${stderr}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  /**
   * Enhanced email format validation with public domain rejection
   */
  validateEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return { valid: false, reason: 'Invalid email format' };
    
    const [username, domain] = email.split('@');
    
    if (username.length < 1 || username.length > 64) {
      return { valid: false, reason: 'Username length invalid' };
    }
    if (domain.length < 4 || domain.length > 255) {
      return { valid: false, reason: 'Domain length invalid' };
    }
    
    // REJECT public domains for corporate email verification
    if (this.isPublicDomain(email)) {
      return { 
        valid: false, 
        reason: `Public domain ${domain.toLowerCase()} not allowed for corporate email verification`,
        isPublicDomain: true
      };
    }
    
    return { valid: true };
  }

  /**
   * Check if email pattern matches known corporate patterns
   */
  checkAgainstKnownPatterns(email) {
    const [username, domain] = email.split('@');
    const lowerDomain = domain.toLowerCase();
    
    // Reject public domains
    if (this.publicDomains.includes(lowerDomain)) {
      return { 
        isKnownPattern: false, 
        confidence: 'high',
        reason: 'Public domain rejected',
        isPublicDomain: true
      };
    }
    
    if (!this.knownValidPatterns[lowerDomain]) {
      return { isKnownPattern: false, confidence: 'unknown' };
    }
    
    const patterns = this.knownValidPatterns[lowerDomain];
    const lowerUsername = username.toLowerCase();
    
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
   * DNS MX Record Check
   */
  async checkMXRecord(email) {
    try {
      const domain = email.split('@')[1];
      if (!domain) {
        return { valid: false, method: 'mx', error: 'Invalid email format' };
      }

      // Reject public domains
      if (this.publicDomains.includes(domain.toLowerCase())) {
        return {
          valid: false,
          method: 'mx',
          error: `Public domain ${domain} not allowed for corporate email verification`,
          isPublicDomain: true
        };
      }

      const mxRecords = await dns.resolveMx(domain);
      
      return {
        valid: mxRecords && mxRecords.length > 0,
        method: 'mx',
        mxRecords: mxRecords?.map(mx => ({ exchange: mx.exchange, priority: mx.priority })),
        confidence: 'low',
        corporateDomain: !this.publicDomains.includes(domain.toLowerCase())
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
   * Enhanced SMTP Handshake with corporate focus
   */
  async checkSMTPHandshake(email) {
    const domain = email.split('@')[1];
    const lowerDomain = domain.toLowerCase();
    
    // Reject public domains
    if (this.publicDomains.includes(lowerDomain)) {
      return {
        valid: false,
        method: 'smtp',
        error: `Public domain ${domain} not allowed for corporate email verification`,
        confidence: 'high',
        isPublicDomain: true,
        note: 'Public domains are not verified in corporate email context'
      };
    }
    
    // Handle corporate domains that block SMTP
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
   * Main enhanced verification method with corporate focus
   */
  async verifyEmail(email, options = {}) {
    const results = {
      email,
      timestamp: new Date().toISOString(),
      checks: [],
      finalResult: {
        valid: false,
        confidence: 'unknown',
        reasons: [],
        corporateEmailOnly: true
      }
    };

    try {
      console.log(`🔍 Corporate email verification for: ${email}`);
      
      // Step 1: Enhanced format validation with public domain rejection
      const formatCheck = this.validateEmailFormat(email);
      if (!formatCheck.valid) {
        results.finalResult.reasons.push(formatCheck.reason);
        if (formatCheck.isPublicDomain) {
          results.finalResult.confidence = 'high';
          results.finalResult.isPublicDomain = true;
          results.finalResult.reasons.push('Public domains not allowed for corporate email verification');
        }
        return results;
      }

      // Step 2: Try Python email-validator first (if available)
      if (this.pythonAvailable && options.usePythonValidator !== false) {
        try {
          console.log(`🐍 Using Python email-validator for corporate verification: ${email}`);
          const pythonResult = await this.runPythonValidator(email, {
            check_deliverability: options.enableDeliverability !== false,
            allow_smtputf8: options.allowUTF8 !== false,
            allow_quoted_local: options.allowQuoted !== false,
            globally_deliverable: options.globallyDeliverable !== false,
            timeout: options.timeout || 15
          });

          if (pythonResult.success) {
            results.checks.push({
              valid: pythonResult.valid,
              method: 'python-email-validator',
              confidence: pythonResult.confidence || 'high',
              error: pythonResult.error,
              error_type: pythonResult.error_type,
              normalized: pythonResult.normalized,
              domain: pythonResult.domain,
              ascii_domain: pythonResult.ascii_domain,
              smtputf8: pythonResult.smtputf8,
              mx: pythonResult.mx,
              mx_fallback_type: pythonResult.mx_fallback_type,
              note: 'Validated using Python email-validator library for corporate emails'
            });

            // If Python validation is decisive, use it
            if (pythonResult.valid !== undefined) {
              results.finalResult = this.analyzePythonResults(pythonResult, email);
              return results;
            }
          } else {
            console.log(`⚠️ Python email-validator not available: ${pythonResult.error}`);
            this.pythonAvailable = false;
          }
        } catch (error) {
          console.log(`⚠️ Python email-validator failed: ${error.message}`);
          // Fall through to Node.js validation
        }
      }

      // Step 3: Fallback to Node.js validation with corporate focus
      console.log(`🟡 Using Node.js corporate email validation for: ${email}`);

      // Check against known patterns for corporate domains
      const patternCheck = this.checkAgainstKnownPatterns(email);
      if (patternCheck.isPublicDomain) {
        results.finalResult.valid = false;
        results.finalResult.confidence = 'high';
        results.finalResult.isPublicDomain = true;
        results.finalResult.reasons.push('Public domain rejected for corporate email verification');
        return results;
      }
      
      if (patternCheck.isKnownPattern) {
        results.checks.push({
          valid: true,
          method: 'pattern',
          confidence: patternCheck.confidence,
          pattern: patternCheck.pattern,
          note: 'Matches known corporate email pattern'
        });
      }

      // MX Record check
      const mxCheck = await this.checkMXRecord(email);
      results.checks.push(mxCheck);
      
      if (mxCheck.isPublicDomain) {
        results.finalResult.valid = false;
        results.finalResult.confidence = 'high';
        results.finalResult.isPublicDomain = true;
        results.finalResult.reasons.push('Public domain rejected for corporate email verification');
        return results;
      }
      
      if (!mxCheck.valid) {
        results.finalResult.reasons.push('No MX record found for domain');
        return results;
      }

      // SMTP check (if enabled and not a blocking corporate domain)
      const domain = email.split('@')[1].toLowerCase();
      const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain);
      
      if (options.enableSMTP !== false && !isCorporateDomain) {
        try {
          const smtpCheck = await this.checkSMTPHandshake(email);
          results.checks.push(smtpCheck);
          
          if (smtpCheck.isPublicDomain) {
            results.finalResult.valid = false;
            results.finalResult.confidence = 'high';
            results.finalResult.isPublicDomain = true;
            results.finalResult.reasons.push('Public domain rejected for corporate email verification');
            return results;
          }
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
      results.finalResult = this.analyzeNodeJsResults(results.checks, email, patternCheck);
      
      return results;
    } catch (error) {
      results.finalResult.error = error.message;
      return results;
    }
  }

  /**
   * Analyze Python validation results with corporate focus
   */
  analyzePythonResults(pythonResult, email) {
    const domain = email.split('@')[1].toLowerCase();
    const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain);
    const isPublicDomain = this.publicDomains.includes(domain);
    
    if (isPublicDomain) {
      return {
        valid: false,
        confidence: 'high',
        reasons: ['Public domain rejected for corporate email verification'],
        corporateDomain: false,
        isPublicDomain: true,
        method: 'python-email-validator',
        corporateEmailOnly: true
      };
    }
    
    if (pythonResult.valid) {
      return {
        valid: true,
        confidence: 'high',
        reasons: pythonResult.reasons || ['Passed Python email-validator checks for corporate email'],
        corporateDomain: isCorporateDomain,
        method: 'python-email-validator',
        normalized: pythonResult.normalized,
        domain: pythonResult.domain,
        ascii_domain: pythonResult.ascii_domain,
        smtputf8: pythonResult.smtputf8,
        mx: pythonResult.mx || [],
        corporateEmailOnly: true,
        summary: {
          totalChecks: 1,
          pythonValid: true,
          method: 'python-email-validator'
        }
      };
    } else {
      return {
        valid: false,
        confidence: 'high',
        reasons: [pythonResult.error || 'Failed Python email-validator checks for corporate email'],
        corporateDomain: isCorporateDomain,
        method: 'python-email-validator',
        error_type: pythonResult.error_type,
        corporateEmailOnly: true,
        summary: {
          totalChecks: 1,
          pythonValid: false,
          method: 'python-email-validator'
        }
      };
    }
  }

  /**
   * Enhanced result analysis with corporate domain intelligence
   */
  analyzeNodeJsResults(checks, email, patternCheck) {
    const domain = email.split('@')[1].toLowerCase();
    const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain);
    const isPublicDomain = this.publicDomains.includes(domain);
    
    if (isPublicDomain) {
      return {
        valid: false,
        confidence: 'high',
        reasons: ['Public domain rejected for corporate email verification'],
        corporateDomain: false,
        isPublicDomain: true,
        method: 'nodejs-enhanced',
        corporateEmailOnly: true
      };
    }
    
    const mxCheck = checks.find(check => check.method === 'mx');
    const smtpCheck = checks.find(check => check.method === 'smtp');
    const patternCheckResult = checks.find(check => check.method === 'pattern');
    
    let confidence = 'unknown';
    let valid = false;
    let reasons = [];

    if (mxCheck && mxCheck.valid) {
      if (isCorporateDomain && patternCheck.isKnownPattern) {
        valid = true;
        confidence = patternCheck.confidence;
        reasons.push(`Corporate domain with valid MX records and known email pattern (${patternCheck.pattern})`);
        
        if (patternCheck.confidence === 'high') {
          confidence = 'high';
        }
      } else if (isCorporateDomain) {
        valid = true;
        confidence = 'medium';
        reasons.push('Corporate domain with valid MX records (SMTP verification blocked by security policy)');
      } else if (smtpCheck) {
        if (smtpCheck.valid === true) {
          valid = true;
          confidence = 'high';
          reasons.push('SMTP verification successful for corporate email');
        } else if (smtpCheck.valid === false && !smtpCheck.temporary) {
          valid = false;
          confidence = 'high';
          reasons.push('SMTP verification failed for corporate email');
        } else {
          valid = true;
          confidence = 'medium';
          reasons.push('Corporate domain accepts email (MX record exists), SMTP verification inconclusive');
        }
      } else {
        valid = true;
        confidence = 'medium';
        reasons.push('Corporate domain accepts email (MX record exists)');
      }
    } else {
      valid = false;
      confidence = 'high';
      reasons.push('Corporate domain does not accept email (no MX records)');
    }

    return {
      valid,
      confidence,
      reasons,
      corporateDomain: isCorporateDomain,
      patternMatch: patternCheck.isKnownPattern ? patternCheck.pattern : null,
      method: 'nodejs-enhanced',
      corporateEmailOnly: true,
      summary: {
        totalChecks: checks.length,
        mxValid: mxCheck?.valid || false,
        smtpValid: smtpCheck?.valid || false,
        patternValid: patternCheckResult?.valid || false
      }
    };
  }

  /**
   * Verify multiple emails in batch with corporate focus
   */
  async verifyEmailBatch(emails, options = {}) {
    const results = [];
    const concurrency = Math.min(options.concurrency || 2, 3);
    const delay = Math.max(options.delay || 3000, 2000);
    
    console.log(`🔍 Starting corporate email batch verification of ${emails.length} emails...`);
    
    // Filter out public domain emails first
    const corporateEmails = emails.filter(email => !this.isPublicDomain(email));
    const rejectedPublicEmails = emails.filter(email => this.isPublicDomain(email));
    
    if (rejectedPublicEmails.length > 0) {
      console.log(`🚫 Rejected ${rejectedPublicEmails.length} public domain emails: ${rejectedPublicEmails.join(', ')}`);
      
      // Add rejected results
      rejectedPublicEmails.forEach(email => {
        results.push({
          email,
          timestamp: new Date().toISOString(),
          checks: [],
          finalResult: {
            valid: false,
            confidence: 'high',
            reasons: ['Public domain rejected for corporate email verification'],
            corporateDomain: false,
            isPublicDomain: true,
            method: 'rejected',
            corporateEmailOnly: true
          }
        });
      });
    }
    
    if (corporateEmails.length === 0) {
      console.log('⚠️ No corporate emails to verify after filtering public domains');
      return results;
    }
    
    console.log(`🏢 Verifying ${corporateEmails.length} corporate emails...`);
    
    // Process corporate emails in batches
    for (let i = 0; i < corporateEmails.length; i += concurrency) {
      const batch = corporateEmails.slice(i, i + concurrency);
      console.log(`Processing corporate email batch ${Math.floor(i/concurrency) + 1}/${Math.ceil(corporateEmails.length/concurrency)} (${batch.length} emails)`);
      
      const batchPromises = batch.map(email => 
        this.verifyEmail(email, options).catch(error => ({
          email,
          error: error.message,
          finalResult: { valid: false, confidence: 'unknown', reasons: ['Verification failed'], corporateEmailOnly: true }
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
            finalResult: { valid: false, confidence: 'unknown', reasons: ['Processing failed'], corporateEmailOnly: true }
          });
        }
      });
      
      // Add delay between batches
      if (i + concurrency < corporateEmails.length) {
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
    const pythonCount = results.filter(r => r.finalResult?.method === 'python-email-validator').length;
    const rejectedCount = results.filter(r => r.finalResult?.isPublicDomain === true).length;
    
    console.log(`🏢 Corporate email batch verification complete:`);
    console.log(`   Total processed: ${results.length}`);
    console.log(`   Valid corporate emails: ${validCount}/${corporateEmails.length}`);
    console.log(`   Known corporate domains: ${corporateCount}`);
    console.log(`   Python-validated: ${pythonCount}`);
    console.log(`   Public domains rejected: ${rejectedCount}`);
    
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
   * Save verification results to file with corporate focus metadata
   */
  async saveResults(results, filename = null) {
    try {
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `corporate_email_verification_${timestamp}.json`;
      }

      const outputDir = path.join(process.cwd(), 'email_verification_results');
      
      await fs.mkdir(outputDir, { recursive: true });
      
      const filePath = path.join(outputDir, filename);
      
      // Add metadata about the enhanced corporate verification
      const enhancedResults = {
        metadata: {
          timestamp: new Date().toISOString(),
          verifier: 'enhanced-corporate-email-verifier',
          pythonValidatorAvailable: this.pythonAvailable,
          corporateEmailOnly: true,
          publicDomainsRejected: Array.isArray(results) 
            ? results.filter(r => r.finalResult?.isPublicDomain === true).length 
            : (results.finalResult?.isPublicDomain ? 1 : 0),
          totalEmails: Array.isArray(results) ? results.length : 1,
          validEmails: Array.isArray(results) 
            ? results.filter(r => r.finalResult?.valid === true).length 
            : (results.finalResult?.valid ? 1 : 0),
          corporateEmails: Array.isArray(results)
            ? results.filter(r => r.finalResult?.corporateDomain === true).length
            : (results.finalResult?.corporateDomain ? 1 : 0),
          pythonValidated: Array.isArray(results)
            ? results.filter(r => r.finalResult?.method === 'python-email-validator').length
            : (results.finalResult?.method === 'python-email-validator' ? 1 : 0)
        },
        results
      };
      
      await fs.writeFile(filePath, JSON.stringify(enhancedResults, null, 2), 'utf8');
      
      console.log(`💾 Saved corporate email verification results to: ${filename}`);
      
      return {
        success: true,
        filePath,
        filename
      };
    } catch (error) {
      throw new Error(`Failed to save enhanced corporate verification results: ${error.message}`);
    }
  }
}

module.exports = EnhancedEmailVerifier;