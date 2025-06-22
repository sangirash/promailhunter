// utils/emailGenerator.js - SIMPLIFIED: Use only user-provided domain
const fs = require('fs').promises;
const path = require('path');
const dns = require('dns').promises;

class EmailGenerator {
  constructor() {
    // Cache for domain validation to avoid repeated DNS queries
    this.domainCache = new Map();
    
    console.log('🎯 EmailGenerator initialized - User domain only mode');
  }

  /**
   * Check if a domain exists by performing DNS MX record lookup
   */
  async validateDomain(domain) {
    // Check cache first
    if (this.domainCache.has(domain)) {
      return this.domainCache.get(domain);
    }

    try {
      // Check MX records first (most reliable for email domains)
      await dns.resolveMx(domain);
      this.domainCache.set(domain, true);
      console.log(`✅ Domain validated: ${domain} (has MX records)`);
      return true;
    } catch (error) {
      try {
        // Fallback: check if domain has any DNS records
        await dns.resolve(domain, 'A');
        this.domainCache.set(domain, true);
        console.log(`⚠️ Domain exists: ${domain} (has A records, may not accept email)`);
        return true;
      } catch (secondError) {
        this.domainCache.set(domain, false);
        console.log(`❌ Domain does not exist: ${domain}`);
        return false;
      }
    }
  }

  /**
   * Extract domain from company name if it contains a domain
   * Otherwise, assume user provided just company name and we can't generate emails
   */
  extractDomainFromCompanyName(companyName) {
    const cleanCompany = companyName.trim().toLowerCase();
    
    // Check if user provided a domain (contains a dot and valid TLD)
    const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (domainPattern.test(cleanCompany)) {
      console.log(`🌐 Domain extracted from company name: ${cleanCompany}`);
      return cleanCompany;
    }
    
    // Check if it contains @ symbol (user might have provided an email)
    if (cleanCompany.includes('@')) {
      const domain = cleanCompany.split('@')[1];
      if (domain && domainPattern.test(domain)) {
        console.log(`🌐 Domain extracted from email format: ${domain}`);
        return domain;
      }
    }
    
    // Check if it's a URL format
    const urlPattern = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const urlMatch = cleanCompany.match(urlPattern);
    if (urlMatch && urlMatch[3]) {
      console.log(`🌐 Domain extracted from URL format: ${urlMatch[3]}`);
      return urlMatch[3];
    }
    
    console.log(`❌ No valid domain found in company name: "${companyName}"`);
    console.log(`💡 Expected formats: "company.com", "user@company.com", "https://company.com", or "www.company.com"`);
    return null;
  }

  /**
   * Get the single domain from user input (no variations)
   */
  async getUserProvidedDomain(companyName) {
    console.log(`🏢 Processing user-provided company/domain: "${companyName}"`);
    
    const domain = this.extractDomainFromCompanyName(companyName);
    
    if (!domain) {
      return {
        validDomains: [],
        error: 'No valid domain found in company name. Please provide a domain like "company.com" or "user@company.com"'
      };
    }
    
    console.log(`🔍 Validating user-provided domain: ${domain}`);
    
    try {
      const isValid = await this.validateDomain(domain);
      
      if (isValid) {
        console.log(`✅ User-provided domain is valid: ${domain}`);
        return {
          validDomains: [domain],
          error: null
        };
      } else {
        console.log(`❌ User-provided domain is invalid: ${domain}`);
        return {
          validDomains: [],
          error: `Domain "${domain}" does not exist or is not configured for email`
        };
      }
    } catch (error) {
      console.error(`❌ Error validating domain "${domain}":`, error.message);
      return {
        validDomains: [],
        error: `Failed to validate domain "${domain}": ${error.message}`
      };
    }
  }

  /**
   * Generate comprehensive username variations (no numbers prefix, no single chars)
   */
  generateUsernames(firstName, lastName) {
    const fName = firstName.toLowerCase().trim();
    const lName = lastName.toLowerCase().trim();
    const fInitial = fName.charAt(0);
    const lInitial = lName.charAt(0);
    
    const usernames = new Set();
    
    console.log(`👤 Generating username patterns for: ${firstName} ${lastName}`);
    
    // Basic combinations with different separators (minimum 2 characters)
    if (fName.length >= 2 && lName.length >= 2) {
      usernames.add(`${fName}.${lName}`);
      usernames.add(`${fName}_${lName}`);
      usernames.add(`${fName}-${lName}`);
      usernames.add(`${fName}${lName}`);
    }
    
    // Initial + lastname combinations (avoid single character usernames)
    if (lName.length >= 2) {
      usernames.add(`${fInitial}.${lName}`);
      usernames.add(`${fInitial}_${lName}`);
      usernames.add(`${fInitial}-${lName}`);
      usernames.add(`${fInitial}${lName}`);
    }
    
    // Firstname + initial combinations (avoid single character usernames)
    if (fName.length >= 2) {
      usernames.add(`${fName}.${lInitial}`);
      usernames.add(`${fName}_${lInitial}`);
      usernames.add(`${fName}-${lInitial}`);
      usernames.add(`${fName}${lInitial}`);
    }
    
    // Double initials (only if makes sense - avoid single letters)
    if (fInitial && lInitial) {
      usernames.add(`${fInitial}${lInitial}`);
    }
    
    // Reversed combinations (minimum 2 characters)
    if (fName.length >= 2 && lName.length >= 2) {
      usernames.add(`${lName}.${fName}`);
      usernames.add(`${lName}_${fName}`);
      usernames.add(`${lName}-${fName}`);
      usernames.add(`${lName}${fName}`);
    }
    
    if (lName.length >= 2) {
      usernames.add(`${lName}.${fInitial}`);
      usernames.add(`${lName}_${fInitial}`);
      usernames.add(`${lName}-${fInitial}`);
      usernames.add(`${lName}${fInitial}`);
    }
    
    // Full names only if they're reasonable length
    if (fName.length >= 2) {
      usernames.add(fName);
    }
    if (lName.length >= 2) {
      usernames.add(lName);
    }
    
    // Common business patterns (no single characters)
    if (fName.length >= 2 && lName.length >= 2) {
      usernames.add(`${fName}${lName.charAt(0)}`);
      if (lName.length >= 3) {
        usernames.add(`${fInitial}${lName.substring(0, 3)}`);
      }
      if (fName.length >= 3 && lName.length >= 3) {
        usernames.add(`${fName.substring(0, 3)}${lName.substring(0, 3)}`);
      }
    }
    
    // With common numbers (SUFFIX ONLY - no prefix numbers)
    const commonNumbers = ['1', '01', '2', '123'];
    const basePatterns = [];
    
    if (fName.length >= 2 && lName.length >= 2) {
      basePatterns.push(`${fName}.${lName}`, `${fName}${lName}`);
    }
    if (lName.length >= 2) {
      basePatterns.push(`${fInitial}${lName}`);
    }
    if (fName.length >= 2) {
      basePatterns.push(fName);
    }
    if (lName.length >= 2) {
      basePatterns.push(lName);
    }
    
    basePatterns.forEach(pattern => {
      commonNumbers.forEach(num => {
        // Only add numbers as SUFFIX, never prefix
        usernames.add(`${pattern}${num}`);
      });
    });
    
    // Department/role based (common in corporations) - minimum 2 characters
    const departments = ['admin', 'info', 'contact', 'support', 'sales', 'hr', 'it', 'finance'];
    departments.forEach(dept => {
      if (fName.length >= 2) {
        usernames.add(`${fName}.${dept}`);
        usernames.add(`${dept}.${fName}`);
        usernames.add(`${fInitial}${dept}`);
      }
    });
    
    // Length-based variations (some companies prefer specific lengths)
    if (fName.length > 3 && lName.length >= 2) {
      usernames.add(`${fName.substring(0, 3)}.${lName}`);
      if (fName.length > 4) {
        usernames.add(`${fName.substring(0, 4)}.${lName}`);
      }
    }
    
    if (lName.length > 3 && fName.length >= 2) {
      usernames.add(`${fName}.${lName.substring(0, 3)}`);
      if (lName.length > 4) {
        usernames.add(`${fName}.${lName.substring(0, 4)}`);
      }
    }
    
    // Filter out invalid usernames
    const validUsernames = Array.from(usernames).filter(username => 
      username.length >= 2 && // Minimum 2 characters
      username.length <= 64 && // Email username length limit
      !username.startsWith('.') && 
      !username.endsWith('.') &&
      !username.startsWith('_') && 
      !username.endsWith('_') &&
      !username.startsWith('-') && 
      !username.endsWith('-') &&
      !/^\d/.test(username) // No numbers at the beginning
    );
    
    console.log(`📋 Generated ${validUsernames.length} username patterns`);
    return validUsernames;
  }

  /**
   * Generate email combinations for USER-PROVIDED DOMAIN ONLY
   */
  async generateEmails(firstName, lastName, companyName) {
    const usernames = this.generateUsernames(firstName, lastName);
    const domainResult = await this.getUserProvidedDomain(companyName);
    
    if (domainResult.error || domainResult.validDomains.length === 0) {
      console.error(`❌ ${domainResult.error || 'No valid domain found'}`);
      
      return {
        all: [],
        company: [],
        domain: null,
        error: domainResult.error || 'No valid domain found',
        warnings: [
          domainResult.error || 'No valid domain found',
          'Please provide a valid domain in the company name field',
          'Expected formats: "company.com", "user@company.com", "https://company.com"'
        ]
      };
    }
    
    const domain = domainResult.validDomains[0]; // Only one domain now
    const emails = new Set();
    
    // Generate emails for the single user-provided domain
    usernames.forEach(username => {
      emails.add(`${username}@${domain}`);
    });
    
    const emailList = Array.from(emails).sort();
    
    console.log(`✅ Generated ${emailList.length} email addresses for domain: ${domain}`);
    
    return {
      all: emailList,
      company: emailList, // All emails are for the user's company domain
      domain: domain,
      error: null
    };
  }

  /**
   * Generate email data structure with metadata (USER DOMAIN ONLY)
   */
  async generateEmailData(firstName, lastName, companyName) {
    const emailResult = await this.generateEmails(firstName, lastName, companyName);
    const usernames = this.generateUsernames(firstName, lastName);
    
    // Handle error case
    if (emailResult.error) {
      return {
        metadata: {
          firstName,
          lastName,
          companyName,
          generatedAt: new Date().toISOString(),
          totalEmails: 0,
          domain: null,
          totalUsernames: usernames.length,
          error: emailResult.error,
          warnings: emailResult.warnings || [],
          userDomainOnly: true
        },
        emails: {
          all: [],
          company: [],
          domain: null
        },
        domains: {
          provided: null,
          validated: false
        },
        patterns: {
          usernames: usernames,
          stats: {
            basicCombinations: usernames.filter(u => u.includes('.')).length,
            withNumbers: usernames.filter(u => /\d/.test(u)).length,
            singleNames: usernames.filter(u => !u.includes('.') && !u.includes('_') && !u.includes('-')).length,
            minLength: usernames.length > 0 ? Math.min(...usernames.map(u => u.length)) : 0,
            maxLength: usernames.length > 0 ? Math.max(...usernames.map(u => u.length)) : 0
          }
        }
      };
    }
    
    const emails = emailResult.all || [];
    const domain = emailResult.domain;
    
    return {
      metadata: {
        firstName,
        lastName,
        companyName,
        generatedAt: new Date().toISOString(),
        totalEmails: emails.length,
        domain: domain,
        totalUsernames: usernames.length,
        domainValidated: true,
        userDomainOnly: true,
        error: null
      },
      emails: {
        all: emails,
        company: emails, // All emails are for the user's company domain
        domain: domain
      },
      domains: {
        provided: domain,
        validated: true
      },
      patterns: {
        usernames: usernames,
        stats: {
          basicCombinations: usernames.filter(u => u.includes('.')).length,
          withNumbers: usernames.filter(u => /\d/.test(u)).length,
          singleNames: usernames.filter(u => !u.includes('.') && !u.includes('_') && !u.includes('-')).length,
          minLength: usernames.length > 0 ? Math.min(...usernames.map(u => u.length)) : 0,
          maxLength: usernames.length > 0 ? Math.max(...usernames.map(u => u.length)) : 0
        }
      }
    };
  }

  /**
   * Save email data to JSON file
   */
  async saveToFile(emailData, filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cleanName = `${emailData.metadata.firstName}_${emailData.metadata.lastName}`.toLowerCase();
      const cleanDomain = emailData.metadata.domain ? emailData.metadata.domain.replace(/[^a-z0-9]/g, '') : 'no-domain';
      filename = `emails_${cleanName}_${cleanDomain}_${timestamp}.json`;
    }
    
    try {
      const outputDir = path.join(process.cwd(), 'generated_emails');
      
      // Create directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });
      
      const filePath = path.join(outputDir, filename);
      await fs.writeFile(filePath, JSON.stringify(emailData, null, 2), 'utf8');
      
      console.log(`💾 Saved email data to: ${filename}`);
      
      return {
        success: true,
        filePath,
        filename,
        totalEmails: emailData.emails.all.length,
        domain: emailData.metadata.domain,
        userDomainOnly: true
      };
    } catch (error) {
      throw new Error(`Failed to save email file: ${error.message}`);
    }
  }

  /**
   * Main function to generate and save emails (USER DOMAIN ONLY)
   */
  async processContact(firstName, lastName, companyName, saveToFile = true) {
    try {
      console.log(`🎯 Processing contact: ${firstName} ${lastName} for domain in "${companyName}" (User domain only)`);
      
      const emailData = await this.generateEmailData(firstName, lastName, companyName);
      
      let fileInfo = null;
      if (saveToFile && emailData.emails.all.length > 0) {
        fileInfo = await this.saveToFile(emailData);
      }
      
      // Log summary
      if (emailData.metadata.error) {
        console.warn(`⚠️ ${emailData.metadata.error}`);
        if (emailData.metadata.warnings) {
          emailData.metadata.warnings.forEach(warning => console.warn(`   - ${warning}`));
        }
      } else if (emailData.emails.all.length > 0) {
        console.log(`✅ Successfully generated ${emailData.emails.all.length} emails for domain: ${emailData.metadata.domain}`);
      } else {
        console.warn(`⚠️ No emails generated for ${companyName}`);
      }
      
      return {
        success: !emailData.metadata.error,
        data: emailData,
        file: fileInfo
      };
    } catch (error) {
      throw new Error(`Email generation failed: ${error.message}`);
    }
  }
}

module.exports = EmailGenerator;