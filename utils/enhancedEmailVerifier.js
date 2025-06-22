// utils/enhancedEmailVerifier.js - UPDATED: Focus on user-provided domains
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
    
    // Known email patterns for major companies (expandable for user domains)
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

    // PUBLIC DOMAINS TO REJECT - Not relevant for user-specific domains but keep for safety
    this.publicDomains = [
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
      'icloud.com', 'protonmail.com', 'mail.com', 'live.com', 'msn.com',
      'yandex.com', 'mail.ru', 'qq.com', '163.com', 'sina.com'
    ];

    // Dynamic pattern learning for user domains
    this.learnedPatterns = new Map();

    // Verify Python email-validator is available
    this.pythonAvailable = false;
    this.checkPythonValidator();
    
    console.log('🎯 Enhanced Email Verifier - User domain focus mode');
  }

  /**
   * Check if an email uses a public domain (warn but don't reject since user might intentionally want to verify)
   */
  isPublicDomain(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return this.publicDomains.includes(domain);
  }

  /**
   * Learn patterns dynamically for user-provided domains
   */
  learnPatternForDomain(domain, email) {
    const username = email.split('@')[0].toLowerCase();
    const lowerDomain = domain.toLowerCase();
    
    if (!this.learnedPatterns.has(lowerDomain)) {
      this.learnedPatterns.set(lowerDomain, new Set());
    }
    
    const patterns = this.learnedPatterns.get(lowerDomain);
    
    // Detect pattern type
    if (/^[a-z]+\.[a-z]+$/.test(username)) {
      patterns.add('first.last');
    } else if (/^[a-z]+_[a-z]+$/.test(username)) {
      patterns.add('first_last');
    } else if (/^[a-z]+[a-z]+$/.test(username) && username.length >= 4) {
      patterns.add('firstlast');
    } else if (/^[a-z]+$/.test(username) && username.length >= 2 && username.length <= 10) {
      patterns.add('first');
    } else if (/^[a-z]\.[a-z]+$/.test(username)) {
      patterns.add('initial.last');
    }
    
    console.log(`📚 Learned pattern for ${lowerDomain}: ${Array.from(patterns).join(', ')}`);
  }

  /**
   * Get known or learned patterns for a domain
   */
  getPatternsForDomain(domain) {
    const lowerDomain = domain.toLowerCase();
    
    // Check predefined patterns first
    if (this.knownValidPatterns[lowerDomain]) {
      return this.knownValidPatterns[lowerDomain];
    }
    
    // Check learned patterns
    if (this.learnedPatterns.has(lowerDomain)) {
      return Array.from(this.learnedPatterns.get(lowerDomain));
    }
    
    // Default business patterns for unknown domains
    return ['first.last', 'first', 'firstlast', 'first_last', 'initial.last'];
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
   * Run Python email validator (updated for user domains)
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
        
        # For user-provided domains, we validate all domains (including public ones)
        # but add a warning for public domains
        domain = email.split('@')[1].lower() if '@' in email else ''
        public_domains = [
            'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
            'icloud.com', 'protonmail.com', 'mail.com', 'live.com', 'msn.com'
        ]
        
        is_public_domain = domain in public_domains
        
        try:
            # Configure validation options
            validation_options = {
                'check_deliverability': options.get('check_deliverability', True),
                'allow_smtputf8': options.get('allow_smtputf8', True),
                'allow_empty_local': False,
                'allow_quoted_local': options.get('allow_quoted_local', True),
                'allow_domain_literal': False,
                'allow_display_name': False,
                'test_environment': options.get('test_environment', False),
                'globally_deliverable': options.get('globally_deliverable', True),
                'timeout': options.get('timeout', 15)
            }
            
            # Validate the email
            result = validate_email(email, **validation_options)
            
            # Convert result to dict
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
                'reasons': ['Passed comprehensive Python email-validator checks'],
                'isPublicDomain': is_public_domain,
                'userDomainFocus': True
            }
            
            if is_public_domain:
                response['warnings'] = [f'Note: {domain} is a public email provider']
            
            print(json.dumps(response))
            
        except EmailSyntaxError as e:
            response = {
                'success': True,
                'valid': False,
                'error': str(e),
                'error_type': 'syntax',
                'confidence': 'high',
                'method': 'python-email-validator',
                'reasons': [f'Email syntax error: {str(e)}'],
                'isPublicDomain': is_public_domain,
                'userDomainFocus': True
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
                'reasons': [f'Email deliverability error: {str(e)}'],
                'isPublicDomain': is_public_domain,
                'userDomainFocus': True
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
                'reasons': [f'Email validation error: {str(e)}'],
                'isPublicDomain': is_public_domain,
                'userDomainFocus': True
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
   * Enhanced email format validation (accepts user domains including public ones)
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
    
    // Note if it's a public domain but don't reject
    const isPublicDomain = this.isPublicDomain(email);
    
    return { 
      valid: true, 
      isPublicDomain,
      warning: isPublicDomain ? `Public domain ${domain.toLowerCase()} detected` : null
    };
  }

  /**
   * Check if email pattern matches known patterns for the domain
   */
  checkAgainstKnownPatterns(email) {
    const [username, domain] = email.split('@');
    const lowerDomain = domain.toLowerCase();
    const lowerUsername = username.toLowerCase();
    
    // Get patterns for this domain (known or learned)
    const patterns = this.getPatternsForDomain(lowerDomain);
    
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
        case 'initial.last':
          if (/^[a-z]\.[a-z]+$/.test(lowerUsername)) {
            return { isKnownPattern: true, confidence: 'high', pattern: 'initial.last' };
          }
          break;
      }
    }
    
    // Learn from this email if it looks like a business pattern
    if (/^[a-z]+\.[a-z]+$/.test(lowerUsername) || /^[a-z]+_[a-z]+$/.test(lowerUsername)) {
      this.learnPatternForDomain(domain, email);
    }
    
    return { isKnownPattern: false, confidence: 'low' };
  }

  /**
   * DNS MX Record Check (updated for user domains)
   */
  async checkMXRecord(email) {
    try {
      const domain = email.split('@')[1];
      if (!domain) {
        return { valid: false, method: 'mx', error: 'Invalid email format' };
      }

      const isPublicDomain = this.publicDomains.includes(domain.toLowerCase());
      const mxRecords = await dns.resolveMx(domain);
      
      return {
        valid: mxRecords && mxRecords.length > 0,
        method: 'mx',
        mxRecords: mxRecords?.map(mx => ({ exchange: mx.exchange, priority: mx.priority })),
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
   * Enhanced SMTP Handshake (updated for user domains)
   */
  async checkSMTPHandshake(email) {
    const domain = email.split('@')[1];
    const lowerDomain = domain.toLowerCase();
    
    const isPublicDomain = this.publicDomains.includes(lowerDomain);
    const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(lowerDomain);
    
    // Handle domains that typically block SMTP
    if (isCorporateDomain) {
      return {
        valid: null, // null means inconclusive, not invalid
        method: 'smtp',
        error: 'Corporate domain likely blocks SMTP verification',
        confidence: 'unknown',
        corporateBlocked: true,
        note: 'This domain typically blocks automated verification attempts for security'
      };
    }

    // Note if it's a public domain but still verify
    if (isPublicDomain) {
      console.log(`⚠️ Verifying public domain: ${domain}`);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          valid: null, // Timeout doesn't mean invalid
          method: 'smtp',
          error: 'Timeout',
          confidence: 'unknown',
          isPublicDomain
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
              confidence: 'high',
              isPublicDomain
            });
          }

          const client = new net.Socket();
          let step = 0;
          let result = { valid: false, method: 'smtp', confidence: 'medium', isPublicDomain };

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
                  result.valid = null; // Temporary failure - inconclusive
                  result.confidence = 'unknown';
                  result.smtpResponse = response.trim();
                  result.temporary = true;
                } else {
                  result.valid = null; // Other responses - inconclusive
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
            if (err.code === 'ECONNREFUSED') {
              result.note = 'SMTP server refused connection (may block verification)';
            }
            client.destroy();
          });

          client.on('timeout', () => {
            result.error = 'SMTP timeout';
            result.valid = null; // Timeout doesn't mean invalid
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
            valid: null, // DNS error doesn't mean email is invalid
            method: 'smtp',
            error: err.message,
            confidence: 'unknown',
            isPublicDomain
          });
        });
    });
  }

  /**
   * Main enhanced verification method (updated for user domains)
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
        userDomainFocus: true
      }
    };

    try {
      console.log(`🔍 Enhanced email verification for: ${email}`);
      
      // Step 1: Enhanced format validation
      const formatCheck = this.validateEmailFormat(email);
      if (!formatCheck.valid) {
        results.finalResult.reasons.push(formatCheck.reason);
        return results;
      }
      
      if (formatCheck.warning) {
        results.finalResult.warnings = [formatCheck.warning];
      }

      // Step 2: Try Python email-validator first (if available)
      if (this.pythonAvailable && options.usePythonValidator !== false) {
        try {
          console.log(`🐍 Using Python email-validator for: ${email}`);
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
              isPublicDomain: pythonResult.isPublicDomain,
              warnings: pythonResult.warnings,
              note: 'Validated using Python email-validator library'
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

      // Step 3: Fallback to Node.js validation
      console.log(`🟡 Using Node.js email validation for: ${email}`);

      // Check against known patterns
      const patternCheck = this.checkAgainstKnownPatterns(email);
      if (patternCheck.isKnownPattern) {
        results.checks.push({
          valid: true,
          method: 'pattern',
          confidence: patternCheck.confidence,
          pattern: patternCheck.pattern,
          note: 'Matches known email pattern for this domain'
        });
      }

      // MX Record check
      const mxCheck = await this.checkMXRecord(email);
      results.checks.push(mxCheck);
      
      if (!mxCheck.valid) {
        results.finalResult.reasons.push('No MX record found for domain');
        return results;
      }

      // SMTP check (if enabled and domain doesn't block it)
      const domain = email.split('@')[1].toLowerCase();
      const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain);
      
      if (options.enableSMTP !== false) {
        try {
          const smtpCheck = await this.checkSMTPHandshake(email);
          results.checks.push(smtpCheck);
        } catch (error) {
          results.checks.push({
            valid: null,
            method: 'smtp',
            error: error.message,
            confidence: 'unknown'
          });
        }
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
   * Analyze Python validation results (updated for user domains)
   */
  analyzePythonResults(pythonResult, email) {
    const domain = email.split('@')[1].toLowerCase();
    const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain);
    const isPublicDomain = this.publicDomains.includes(domain);
    
    if (pythonResult.valid) {
      return {
        valid: true,
        confidence: 'high',
        reasons: pythonResult.reasons || ['Passed Python email-validator checks'],
        corporateDomain: isCorporateDomain,
        isPublicDomain: isPublicDomain,
        warnings: pythonResult.warnings,
        method: 'python-email-validator',
        normalized: pythonResult.normalized,
        domain: pythonResult.domain,
        ascii_domain: pythonResult.ascii_domain,
        smtputf8: pythonResult.smtputf8,
        mx: pythonResult.mx || [],
        userDomainFocus: true,
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
        reasons: [pythonResult.error || 'Failed Python email-validator checks'],
        corporateDomain: isCorporateDomain,
        isPublicDomain: isPublicDomain,
        warnings: pythonResult.warnings,
        method: 'python-email-validator',
        error_type: pythonResult.error_type,
        userDomainFocus: true,
        summary: {
          totalChecks: 1,
          pythonValid: false,
          method: 'python-email-validator'
        }
      };
    }
  }

  /**
   * Enhanced result analysis (updated for user domains)
   */
  analyzeNodeJsResults(checks, email, patternCheck) {
    const domain = email.split('@')[1].toLowerCase();
    const isCorporateDomain = this.corporateDomainsWithStrictSecurity.includes(domain);
    const isPublicDomain = this.publicDomains.includes(domain);
    
    const mxCheck = checks.find(check => check.method === 'mx');
    const smtpCheck = checks.find(check => check.method === 'smtp');
    const patternCheckResult = checks.find(check => check.method === 'pattern');
    
    let confidence = 'unknown';
    let valid = false;
    let reasons = [];
    let warnings = [];

    // Add warning for public domains
    if (isPublicDomain) {
      warnings.push(`${domain} is a public email provider`);
    }

    if (mxCheck && mxCheck.valid) {
      reasons.push('Domain has valid MX records');
      
      // For domains that block SMTP, rely more on patterns and domain validation
      if (isCorporateDomain && patternCheck.isKnownPattern) {
        valid = true;
        confidence = patternCheck.confidence;
        reasons.push(`Corporate domain with known email pattern (${patternCheck.pattern})`);
        
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
          reasons.push('SMTP verification successful');
        } else if (smtpCheck.valid === false && smtpCheck.confidence === 'high') {
          valid = false;
          confidence = 'high';
          reasons.push('SMTP verification failed');
        } else {
          // SMTP inconclusive - rely on other factors
          if (patternCheck.isKnownPattern) {
            valid = true;
            confidence = patternCheck.confidence;
            reasons.push(`Domain accepts email (MX exists), matches known pattern (${patternCheck.pattern})`);
          } else {
            valid = true;
            confidence = 'medium';
            reasons.push('Domain accepts email (MX record exists), SMTP verification inconclusive');
          }
        }
      } else {
        // No SMTP check performed
        if (patternCheck.isKnownPattern) {
          valid = true;
          confidence = patternCheck.confidence;
          reasons.push(`Domain accepts email (MX exists), matches known pattern (${patternCheck.pattern})`);
        } else {
          valid = true;
          confidence = 'medium';
          reasons.push('Domain accepts email (MX record exists)');
        }
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
      warnings: warnings.length > 0 ? warnings : undefined,
      corporateDomain: isCorporateDomain,
      isPublicDomain: isPublicDomain,
      patternMatch: patternCheck.isKnownPattern ? patternCheck.pattern : null,
      method: 'nodejs-enhanced',
      userDomainFocus: true,
      summary: {
        totalChecks: checks.length,
        mxValid: mxCheck?.valid || false,
        smtpValid: smtpCheck?.valid || false,
        patternValid: patternCheckResult?.valid || false
      }
    };
  }

  /**
   * Verify multiple emails in batch (updated for user domains)
   */
  async verifyEmailBatch(emails, options = {}) {
    const results = [];
    const concurrency = Math.min(options.concurrency || 2, 3);
    const delay = Math.max(options.delay || 3000, 2000);
    
    console.log(`🔍 Starting email batch verification of ${emails.length} emails...`);
    
    // Group emails by domain for better processing
    const emailsByDomain = {};
    emails.forEach(email => {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain) {
        if (!emailsByDomain[domain]) {
          emailsByDomain[domain] = [];
        }
        emailsByDomain[domain].push(email);
      }
    });
    
    console.log(`📧 Processing emails across ${Object.keys(emailsByDomain).length} domains`);
    
    // Process emails in batches
    for (let i = 0; i < emails.length; i += concurrency) {
      const batch = emails.slice(i, i + concurrency);
      console.log(`Processing batch ${Math.floor(i/concurrency) + 1}/${Math.ceil(emails.length/concurrency)} (${batch.length} emails)`);
      
      const batchPromises = batch.map(email => 
        this.verifyEmail(email, options).catch(error => ({
          email,
          error: error.message,
          finalResult: { valid: false, confidence: 'unknown', reasons: ['Verification failed'], userDomainFocus: true }
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
            finalResult: { valid: false, confidence: 'unknown', reasons: ['Processing failed'], userDomainFocus: true }
          });
        }
      });
      
      // Add delay between batches
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
    const publicCount = results.filter(r => r.finalResult?.isPublicDomain === true).length;
    const pythonCount = results.filter(r => r.finalResult?.method === 'python-email-validator').length;
    
    console.log(`📊 Email batch verification complete:`);
    console.log(`   Total processed: ${results.length}`);
    console.log(`   Valid emails: ${validCount}/${emails.length}`);
    console.log(`   Corporate domains: ${corporateCount}`);
    console.log(`   Public domains: ${publicCount}`);
    console.log(`   Python-validated: ${pythonCount}`);
    
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
   * Save verification results to file (updated for user domains)
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
      
      // Add metadata
      const enhancedResults = {
        metadata: {
          timestamp: new Date().toISOString(),
          verifier: 'enhanced-email-verifier',
          pythonValidatorAvailable: this.pythonAvailable,
          userDomainFocus: true,
          totalEmails: Array.isArray(results) ? results.length : 1,
          validEmails: Array.isArray(results) 
            ? results.filter(r => r.finalResult?.valid === true).length 
            : (results.finalResult?.valid ? 1 : 0),
          corporateEmails: Array.isArray(results)
            ? results.filter(r => r.finalResult?.corporateDomain === true).length
            : (results.finalResult?.corporateDomain ? 1 : 0),
          publicEmails: Array.isArray(results)
            ? results.filter(r => r.finalResult?.isPublicDomain === true).length
            : (results.finalResult?.isPublicDomain ? 1 : 0),
          pythonValidated: Array.isArray(results)
            ? results.filter(r => r.finalResult?.method === 'python-email-validator').length
            : (results.finalResult?.method === 'python-email-validator' ? 1 : 0)
        },
        results
      };
      
      await fs.writeFile(filePath, JSON.stringify(enhancedResults, null, 2), 'utf8');
      
      console.log(`💾 Saved email verification results to: ${filename}`);
      
      return {
        success: true,
        filePath,
        filename
      };
    } catch (error) {
      throw new Error(`Failed to save email verification results: ${error.message}`);
    }
  }
}

module.exports = EnhancedEmailVerifier;