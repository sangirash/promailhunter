// utils/emailGenerator.js
const fs = require('fs').promises;
const path = require('path');
const dns = require('dns').promises;

class EmailGenerator {
  constructor() {
    // Only include common domains if they're specifically mentioned in company name
    this.commonDomains = [
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 
      'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'
    ];
    
    // Cache for domain validation to avoid repeated DNS queries
    this.domainCache = new Map();
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
      return true;
    } catch (error) {
      try {
        // Fallback: check if domain has any DNS records
        await dns.resolve(domain, 'A');
        this.domainCache.set(domain, true);
        return true;
      } catch (secondError) {
        this.domainCache.set(domain, false);
        return false;
      }
    }
  }

  /**
   * Generate domain variations from company name and validate them
   */
  async generateValidatedDomains(companyName) {
    const cleanCompany = this.cleanCompanyName(companyName);
    const potentialDomains = new Set();
    
    // Check if company name contains common email providers
    const lowerCompanyName = companyName.toLowerCase();
    const mentionsCommonDomain = this.commonDomains.some(domain => 
      lowerCompanyName.includes(domain.split('.')[0]) // e.g., "gmail" from "gmail.com"
    );
    
    // If company mentions a common domain, include it
    if (mentionsCommonDomain) {
      this.commonDomains.forEach(domain => {
        const provider = domain.split('.')[0];
        if (lowerCompanyName.includes(provider)) {
          potentialDomains.add(domain);
        }
      });
    }
    
    // Generate company-specific domains only if cleanCompany exists
    if (cleanCompany && cleanCompany.length >= 2) {
      // Basic company domain variations
      potentialDomains.add(`${cleanCompany}.com`);
      potentialDomains.add(`${cleanCompany}.co`);
      potentialDomains.add(`${cleanCompany}.org`);
      potentialDomains.add(`${cleanCompany}.net`);
      potentialDomains.add(`${cleanCompany}.io`);
      potentialDomains.add(`${cleanCompany}.biz`);
      
      // International variations
      potentialDomains.add(`${cleanCompany}.co.uk`);
      potentialDomains.add(`${cleanCompany}.com.au`);
      potentialDomains.add(`${cleanCompany}.ca`);
      potentialDomains.add(`${cleanCompany}.de`);
      potentialDomains.add(`${cleanCompany}.fr`);
      potentialDomains.add(`${cleanCompany}.in`);
      potentialDomains.add(`${cleanCompany}.co.in`);
      
      // Without common business suffixes
      const withoutSuffixes = cleanCompany
        .replace(/\b(inc|incorporated|ltd|limited|llc|corp|corporation|company|co|group|international|intl|solutions|systems|technologies|tech|consulting|services|enterprises|global|worldwide)\b/gi, '')
        .replace(/\s+/g, '')
        .toLowerCase();
      
      if (withoutSuffixes && withoutSuffixes !== cleanCompany && withoutSuffixes.length >= 2) {
        potentialDomains.add(`${withoutSuffixes}.com`);
        potentialDomains.add(`${withoutSuffixes}.co`);
        potentialDomains.add(`${withoutSuffixes}.org`);
        potentialDomains.add(`${withoutSuffixes}.net`);
        potentialDomains.add(`${withoutSuffixes}.io`);
      }
      
      // Acronym version (if company has multiple words)
      const words = companyName.split(/\s+/).filter(word => 
        word.length > 0 && 
        !['inc', 'ltd', 'llc', 'corp', 'co', 'company', 'group', 'international', 'intl', 'the', 'and', '&'].includes(word.toLowerCase())
      );
      
      if (words.length > 1) {
        const acronym = words.map(word => word.charAt(0).toLowerCase()).join('');
        if (acronym.length >= 2 && acronym.length <= 6) {
          potentialDomains.add(`${acronym}.com`);
          potentialDomains.add(`${acronym}.co`);
          potentialDomains.add(`${acronym}.org`);
          potentialDomains.add(`${acronym}.net`);
          potentialDomains.add(`${acronym}.io`);
        }
      }
      
      // Handle hyphenated company names
      if (companyName.includes('-') || companyName.includes(' ')) {
        const hyphenated = companyName.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        if (hyphenated && hyphenated !== cleanCompany && hyphenated.length >= 2) {
          potentialDomains.add(`${hyphenated}.com`);
          potentialDomains.add(`${hyphenated}.co`);
          potentialDomains.add(`${hyphenated}.org`);
          potentialDomains.add(`${hyphenated}.net`);
        }
      }
    }
    
    // Convert to array and filter out very short domains
    const domainsToValidate = Array.from(potentialDomains).filter(domain => domain.length > 4);
    
    console.log(`Checking ${domainsToValidate.length} potential domains for ${companyName}...`);
    
    // Validate domains in batches to avoid overwhelming DNS servers
    const validDomains = [];
    const batchSize = 5;
    
    for (let i = 0; i < domainsToValidate.length; i += batchSize) {
      const batch = domainsToValidate.slice(i, i + batchSize);
      const batchPromises = batch.map(async domain => {
        try {
          const isValid = await this.validateDomain(domain);
          return isValid ? domain : null;
        } catch (error) {
          console.log(`Domain validation failed for ${domain}:`, error.message);
          return null;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          validDomains.push(result.value);
        }
      });
      
      // Small delay between batches to be respectful to DNS servers
      if (i + batchSize < domainsToValidate.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Found ${validDomains.length} valid domains out of ${domainsToValidate.length} checked`);
    return validDomains;
  }

  /**
   * Clean and normalize company name for domain generation
   */
  cleanCompanyName(companyName) {
    return companyName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
      .replace(/\b(inc|incorporated|ltd|limited|llc|corp|corporation|company|co|group|international|intl)\b/gi, '') // Remove common suffixes
      .replace(/\s+/g, '') // Remove spaces
      .trim();
  }

  /**
   * Generate comprehensive username variations (IMPROVED - no numbers prefix, no single chars)
   */
  generateUsernames(firstName, lastName) {
    const fName = firstName.toLowerCase().trim();
    const lName = lastName.toLowerCase().trim();
    const fInitial = fName.charAt(0);
    const lInitial = lName.charAt(0);
    
    const usernames = new Set();
    
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
    usernames.add(`${fInitial}${lInitial}`);
    
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
    const commonNumbers = ['1', '01', '2', '123', '2024', '2025'];
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
    return Array.from(usernames).filter(username => 
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
  }

  /**
   * Generate all possible email combinations for validated domains only
   */
  async generateEmails(firstName, lastName, companyName) {
    const usernames = this.generateUsernames(firstName, lastName);
    const validDomains = await this.generateValidatedDomains(companyName);
    
    if (validDomains.length === 0) {
      console.log(`Warning: No valid domains found for ${companyName}. Using common providers only.`);
      // If no company domains are valid, use common providers as fallback
      validDomains.push(...this.commonDomains.slice(0, 3)); // Just add top 3 common providers
    }
    
    const emails = new Set();
    
    // Generate all combinations
    usernames.forEach(username => {
      validDomains.forEach(domain => {
        emails.add(`${username}@${domain}`);
      });
    });
    
    return Array.from(emails).sort();
  }

  /**
   * Generate email data structure with metadata and domain validation info
   */
  async generateEmailData(firstName, lastName, companyName) {
    const validDomains = await this.generateValidatedDomains(companyName);
    const emails = await this.generateEmails(firstName, lastName, companyName);
    const usernames = this.generateUsernames(firstName, lastName);
    
    // Categorize emails by domain type
    const companyEmails = emails.filter(email => {
      const domain = email.split('@')[1];
      return !this.commonDomains.includes(domain);
    });
    
    const commonProviderEmails = emails.filter(email => {
      const domain = email.split('@')[1];
      return this.commonDomains.includes(domain);
    });
    
    // Group by domain for better organization
    const emailsByDomain = {};
    emails.forEach(email => {
      const domain = email.split('@')[1];
      if (!emailsByDomain[domain]) {
        emailsByDomain[domain] = [];
      }
      emailsByDomain[domain].push(email);
    });
    
    return {
      metadata: {
        firstName,
        lastName,
        companyName,
        generatedAt: new Date().toISOString(),
        totalEmails: emails.length,
        companyEmails: companyEmails.length,
        commonProviderEmails: commonProviderEmails.length,
        totalDomains: validDomains.length,
        totalUsernames: usernames.length,
        validatedDomains: validDomains,
        domainValidationEnabled: true
      },
      emails: {
        all: emails,
        company: companyEmails,
        commonProviders: commonProviderEmails,
        byDomain: emailsByDomain
      },
      domains: {
        all: validDomains,
        company: validDomains.filter(d => !this.commonDomains.includes(d)),
        commonProviders: validDomains.filter(d => this.commonDomains.includes(d)),
        validated: true
      },
      patterns: {
        usernames: usernames,
        stats: {
          basicCombinations: usernames.filter(u => u.includes('.')).length,
          withNumbers: usernames.filter(u => /\d/.test(u)).length,
          singleNames: usernames.filter(u => !u.includes('.') && !u.includes('_') && !u.includes('-')).length,
          minLength: Math.min(...usernames.map(u => u.length)),
          maxLength: Math.max(...usernames.map(u => u.length))
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
      const cleanCompany = emailData.metadata.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      filename = `emails_${cleanName}_${cleanCompany}_${timestamp}.json`;
    }
    
    try {
      const outputDir = path.join(process.cwd(), 'generated_emails');
      
      // Create directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });
      
      const filePath = path.join(outputDir, filename);
      await fs.writeFile(filePath, JSON.stringify(emailData, null, 2), 'utf8');
      
      return {
        success: true,
        filePath,
        filename,
        totalEmails: emailData.emails.all.length,
        companyEmails: emailData.emails.company.length,
        validatedDomains: emailData.metadata.validatedDomains
      };
    } catch (error) {
      throw new Error(`Failed to save email file: ${error.message}`);
    }
  }

  /**
   * Main function to generate and save emails
   */
  async processContact(firstName, lastName, companyName, saveToFile = true) {
    try {
      const emailData = await this.generateEmailData(firstName, lastName, companyName);
      
      let fileInfo = null;
      if (saveToFile) {
        fileInfo = await this.saveToFile(emailData);
      }
      
      return {
        success: true,
        data: emailData,
        file: fileInfo
      };
    } catch (error) {
      throw new Error(`Email generation failed: ${error.message}`);
    }
  }
}

module.exports = EmailGenerator;