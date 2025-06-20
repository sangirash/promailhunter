// utils/emailGenerator.js
const fs = require('fs').promises;
const path = require('path');

class EmailGenerator {
  constructor() {
    // Only include common domains if they're specifically mentioned in company name
    this.commonDomains = [
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 
      'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'
    ];
  }

  /**
   * Generate domain variations from company name only
   */
  generateDomains(companyName) {
    const cleanCompany = this.cleanCompanyName(companyName);
    const domains = new Set();
    
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
          domains.add(domain);
        }
      });
    }
    
    // Always generate company-specific domains
    if (cleanCompany) {
      // Basic company domain variations
      domains.add(`${cleanCompany}.com`);
      domains.add(`${cleanCompany}.co`);
      domains.add(`${cleanCompany}.org`);
      domains.add(`${cleanCompany}.net`);
      domains.add(`${cleanCompany}.io`);
      domains.add(`${cleanCompany}.biz`);
      
      // International variations
      domains.add(`${cleanCompany}.co.uk`);
      domains.add(`${cleanCompany}.com.au`);
      domains.add(`${cleanCompany}.ca`);
      domains.add(`${cleanCompany}.de`);
      domains.add(`${cleanCompany}.fr`);
      
      // Without common business suffixes
      const withoutSuffixes = cleanCompany
        .replace(/\b(inc|incorporated|ltd|limited|llc|corp|corporation|company|co|group|international|intl|solutions|systems|technologies|tech|consulting|services|enterprises|global|worldwide)\b/gi, '')
        .replace(/\s+/g, '')
        .toLowerCase();
      
      if (withoutSuffixes && withoutSuffixes !== cleanCompany && withoutSuffixes.length > 1) {
        domains.add(`${withoutSuffixes}.com`);
        domains.add(`${withoutSuffixes}.co`);
        domains.add(`${withoutSuffixes}.org`);
        domains.add(`${withoutSuffixes}.net`);
        domains.add(`${withoutSuffixes}.io`);
      }
      
      // Acronym version (if company has multiple words)
      const words = companyName.split(/\s+/).filter(word => 
        word.length > 0 && 
        !['inc', 'ltd', 'llc', 'corp', 'co', 'company', 'group', 'international', 'intl', 'the', 'and', '&'].includes(word.toLowerCase())
      );
      
      if (words.length > 1) {
        const acronym = words.map(word => word.charAt(0).toLowerCase()).join('');
        if (acronym.length >= 2 && acronym.length <= 6) {
          domains.add(`${acronym}.com`);
          domains.add(`${acronym}.co`);
          domains.add(`${acronym}.org`);
          domains.add(`${acronym}.net`);
          domains.add(`${acronym}.io`);
        }
      }
      
      // Handle hyphenated company names
      if (companyName.includes('-') || companyName.includes(' ')) {
        const hyphenated = companyName.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        if (hyphenated && hyphenated !== cleanCompany) {
          domains.add(`${hyphenated}.com`);
          domains.add(`${hyphenated}.co`);
          domains.add(`${hyphenated}.org`);
          domains.add(`${hyphenated}.net`);
        }
      }
      
      // Handle numbers in company name
      const withNumbers = cleanCompany.replace(/\D/g, '');
      if (withNumbers) {
        domains.add(`${cleanCompany}${withNumbers}.com`);
        domains.add(`${withNumbers}${cleanCompany}.com`);
      }
    }
    
    return Array.from(domains).filter(domain => domain.length > 4); // Filter out very short domains
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
   * Generate comprehensive username variations
   */
  generateUsernames(firstName, lastName) {
    const fName = firstName.toLowerCase().trim();
    const lName = lastName.toLowerCase().trim();
    const fInitial = fName.charAt(0);
    const lInitial = lName.charAt(0);
    
    const usernames = new Set();
    
    // Basic combinations with different separators
    usernames.add(`${fName}.${lName}`);
    usernames.add(`${fName}_${lName}`);
    usernames.add(`${fName}-${lName}`);
    usernames.add(`${fName}${lName}`);
    
    // Initial + lastname combinations
    usernames.add(`${fInitial}.${lName}`);
    usernames.add(`${fInitial}_${lName}`);
    usernames.add(`${fInitial}-${lName}`);
    usernames.add(`${fInitial}${lName}`);
    
    // Firstname + initial combinations
    usernames.add(`${fName}.${lInitial}`);
    usernames.add(`${fName}_${lInitial}`);
    usernames.add(`${fName}-${lInitial}`);
    usernames.add(`${fName}${lInitial}`);
    
    // Double initials
    usernames.add(`${fInitial}.${lInitial}`);
    usernames.add(`${fInitial}_${lInitial}`);
    usernames.add(`${fInitial}-${lInitial}`);
    usernames.add(`${fInitial}${lInitial}`);
    
    // Reversed combinations
    usernames.add(`${lName}.${fName}`);
    usernames.add(`${lName}_${fName}`);
    usernames.add(`${lName}-${fName}`);
    usernames.add(`${lName}${fName}`);
    
    usernames.add(`${lName}.${fInitial}`);
    usernames.add(`${lName}_${fInitial}`);
    usernames.add(`${lName}-${fInitial}`);
    usernames.add(`${lName}${fInitial}`);
    
    // Single names
    usernames.add(fName);
    usernames.add(lName);
    
    // Common business patterns
    usernames.add(`${fName}${lName.charAt(0)}`);
    usernames.add(`${fInitial}${lName.substring(0, 3)}`);
    usernames.add(`${fName.substring(0, 3)}${lName.substring(0, 3)}`);
    
    // With common numbers
    const commonNumbers = ['1', '01', '2', '123', '2024', '2025'];
    const basePatterns = [
      `${fName}.${lName}`,
      `${fName}${lName}`,
      `${fInitial}${lName}`,
      `${fName}`,
      `${lName}`
    ];
    
    basePatterns.forEach(pattern => {
      commonNumbers.forEach(num => {
        usernames.add(`${pattern}${num}`);
        usernames.add(`${num}${pattern}`);
      });
    });
    
    // Department/role based (common in corporations)
    const departments = ['admin', 'info', 'contact', 'support', 'sales', 'hr', 'it', 'finance'];
    departments.forEach(dept => {
      usernames.add(`${fName}.${dept}`);
      usernames.add(`${dept}.${fName}`);
      usernames.add(`${fInitial}${dept}`);
    });
    
    // Length-based variations (some companies prefer specific lengths)
    if (fName.length > 3) {
      usernames.add(`${fName.substring(0, 3)}.${lName}`);
      usernames.add(`${fName.substring(0, 4)}.${lName}`);
    }
    
    if (lName.length > 3) {
      usernames.add(`${fName}.${lName.substring(0, 3)}`);
      usernames.add(`${fName}.${lName.substring(0, 4)}`);
    }
    
    return Array.from(usernames).filter(username => 
      username.length > 0 && 
      username.length <= 64 && // Email username length limit
      !username.startsWith('.') && 
      !username.endsWith('.')
    );
  }

  /**
   * Generate all possible email combinations for the specific company
   */
  generateEmails(firstName, lastName, companyName) {
    const usernames = this.generateUsernames(firstName, lastName);
    const domains = this.generateDomains(companyName);
    
    const emails = new Set();
    
    // Generate all combinations
    usernames.forEach(username => {
      domains.forEach(domain => {
        emails.add(`${username}@${domain}`);
      });
    });
    
    return Array.from(emails).sort();
  }

  /**
   * Generate email data structure with metadata
   */
  generateEmailData(firstName, lastName, companyName) {
    const emails = this.generateEmails(firstName, lastName, companyName);
    const domains = this.generateDomains(companyName);
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
        totalDomains: domains.length,
        totalUsernames: usernames.length
      },
      emails: {
        all: emails,
        company: companyEmails,
        commonProviders: commonProviderEmails,
        byDomain: emailsByDomain
      },
      domains: {
        all: domains,
        company: domains.filter(d => !this.commonDomains.includes(d)),
        commonProviders: domains.filter(d => this.commonDomains.includes(d))
      },
      patterns: {
        usernames: usernames,
        stats: {
          basicCombinations: usernames.filter(u => u.includes('.')).length,
          withNumbers: usernames.filter(u => /\d/.test(u)).length,
          singleNames: usernames.filter(u => !u.includes('.') && !u.includes('_') && !u.includes('-')).length
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
      try {
        await fs.access(outputDir);
      } catch {
        await fs.mkdir(outputDir, { recursive: true });
      }
      
      const filePath = path.join(outputDir, filename);
      await fs.writeFile(filePath, JSON.stringify(emailData, null, 2), 'utf8');
      
      return {
        success: true,
        filePath,
        filename,
        totalEmails: emailData.emails.all.length,
        companyEmails: emailData.emails.company.length
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
      const emailData = this.generateEmailData(firstName, lastName, companyName);
      
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