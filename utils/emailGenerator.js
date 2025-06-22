// utils/emailGenerator.js - REFACTORED: Company domains only
const fs = require('fs').promises;
const path = require('path');
const dns = require('dns').promises;

class EmailGenerator {
  constructor() {
    // REMOVED: Common public domains - we only want company domains
    // We should NEVER generate emails with public providers like Gmail, Yahoo, etc.
    
    // Cache for domain validation to avoid repeated DNS queries
    this.domainCache = new Map();
    
    console.log('🎯 EmailGenerator initialized - Company domains only mode');
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
   * Generate ONLY company-specific domain variations from company name
   */
  async generateCompanyDomains(companyName) {
    const cleanCompany = this.cleanCompanyName(companyName);
    const potentialDomains = new Set();
    
    console.log(`🏢 Generating domains for company: "${companyName}" (cleaned: "${cleanCompany}")`);
    
    // Only generate company-specific domains - NO public providers
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
    } else {
      console.warn(`⚠️ Company name "${companyName}" too short or invalid for domain generation`);
      return [];
    }
    
    // Convert to array and filter out very short domains
    const domainsToValidate = Array.from(potentialDomains).filter(domain => domain.length > 4);
    
    console.log(`🔍 Checking ${domainsToValidate.length} potential company domains for ${companyName}...`);
    
    // Validate domains in batches to avoid overwhelming DNS servers
    const validDomains = [];
    const batchSize = 5;
    
    for (let i = 0; i < domainsToValidate.length; i += batchSize) {
      const batch = domainsToValidate.slice(i, i + batchSize);
      const batchPromises = batch.map(async domain => {
        try {
          const isValid = await this.validateDomain(domain);
          if (isValid) {
            console.log(`✅ Valid company domain found: ${domain}`);
          }
          return isValid ? domain : null;
        } catch (error) {
          console.log(`❌ Domain validation failed for ${domain}:`, error.message);
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
    
    console.log(`🎯 Found ${validDomains.length} valid company domains out of ${domainsToValidate.length} checked`);
    
    if (validDomains.length === 0) {
      console.warn(`⚠️ No valid company domains found for "${companyName}". This could mean:`);
      console.warn(`   - Company doesn't have a website/email domain`);
      console.warn(`   - Domain uses different naming convention`);
      console.warn(`   - DNS resolution issues`);
      console.warn(`   - Company domain is not publicly registered`);
    }
    
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
   * Generate email combinations for COMPANY DOMAINS ONLY
   */
  async generateEmails(firstName, lastName, companyName) {
    const usernames = this.generateUsernames(firstName, lastName);
    const companyDomains = await this.generateCompanyDomains(companyName);
    
    if (companyDomains.length === 0) {
      console.error(`❌ No valid company domains found for "${companyName}"`);
      console.error(`❌ Cannot generate corporate email addresses without valid company domains`);
      
      // Return empty result - DO NOT fallback to public domains
      return {
        all: [],
        company: [],
        warnings: [
          `No valid company domains found for "${companyName}"`,
          'Email generation requires valid company domains',
          'Check company name spelling or domain registration'
        ]
      };
    }
    
    const emails = new Set();
    
    // Generate emails ONLY for company domains
    usernames.forEach(username => {
      companyDomains.forEach(domain => {
        emails.add(`${username}@${domain}`);
      });
    });
    
    const emailList = Array.from(emails).sort();
    
    console.log(`✅ Generated ${emailList.length} corporate email addresses`);
    console.log(`🏢 Using ${companyDomains.length} valid company domains: ${companyDomains.join(', ')}`);
    
    return {
      all: emailList,
      company: emailList, // All emails are company emails now
      companyDomains: companyDomains
    };
  }

  /**
   * Generate email data structure with metadata (COMPANY DOMAINS ONLY)
   */
  async generateEmailData(firstName, lastName, companyName) {
    const companyDomains = await this.generateCompanyDomains(companyName);
    const emailResult = await this.generateEmails(firstName, lastName, companyName);
    const usernames = this.generateUsernames(firstName, lastName);
    
    // All emails are company emails now
    const emails = emailResult.all || [];
    const warnings = emailResult.warnings || [];
    
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
        companyEmails: emails.length, // All emails are company emails
        commonProviderEmails: 0, // We don't generate these anymore
        totalDomains: companyDomains.length,
        totalUsernames: usernames.length,
        validatedDomains: companyDomains,
        domainValidationEnabled: true,
        companyDomainsOnly: true, // NEW FLAG
        warnings: warnings
      },
      emails: {
        all: emails,
        company: emails, // All emails are company emails
        commonProviders: [], // Empty - we don't generate these
        byDomain: emailsByDomain
      },
      domains: {
        all: companyDomains,
        company: companyDomains, // Same as all
        commonProviders: [], // Empty
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
      const cleanCompany = emailData.metadata.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      filename = `corporate_emails_${cleanName}_${cleanCompany}_${timestamp}.json`;
    }
    
    try {
      const outputDir = path.join(process.cwd(), 'generated_emails');
      
      // Create directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true });
      
      const filePath = path.join(outputDir, filename);
      await fs.writeFile(filePath, JSON.stringify(emailData, null, 2), 'utf8');
      
      console.log(`💾 Saved corporate email data to: ${filename}`);
      
      return {
        success: true,
        filePath,
        filename,
        totalEmails: emailData.emails.all.length,
        companyEmails: emailData.emails.company.length,
        validatedDomains: emailData.metadata.validatedDomains,
        companyDomainsOnly: true
      };
    } catch (error) {
      throw new Error(`Failed to save email file: ${error.message}`);
    }
  }

  /**
   * Main function to generate and save emails (COMPANY DOMAINS ONLY)
   */
  async processContact(firstName, lastName, companyName, saveToFile = true) {
    try {
      console.log(`🎯 Processing contact: ${firstName} ${lastName} at ${companyName} (Company domains only)`);
      
      const emailData = await this.generateEmailData(firstName, lastName, companyName);
      
      let fileInfo = null;
      if (saveToFile) {
        fileInfo = await this.saveToFile(emailData);
      }
      
      // Log summary
      if (emailData.emails.all.length > 0) {
        console.log(`✅ Successfully generated ${emailData.emails.all.length} corporate emails`);
        console.log(`🏢 Company domains used: ${emailData.metadata.validatedDomains.join(', ')}`);
      } else {
        console.warn(`⚠️ No emails generated for ${companyName}`);
        if (emailData.metadata.warnings) {
          emailData.metadata.warnings.forEach(warning => console.warn(`   - ${warning}`));
        }
      }
      
      return {
        success: true,
        data: emailData,
        file: fileInfo
      };
    } catch (error) {
      throw new Error(`Corporate email generation failed: ${error.message}`);
    }
  }
}

module.exports = EmailGenerator;