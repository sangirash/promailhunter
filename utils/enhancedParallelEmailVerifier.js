// utils/enhancedParallelEmailVerifier.js - Wrapper for parallel verification with existing verifier

const parallelVerifier = require('./parallelEmailVerifier');
const EnhancedEmailVerifier = require('./enhancedEmailVerifier');
const performanceConfig = require('../config/performance');

class EnhancedParallelEmailVerifier {
    constructor() {
        this.enhancedVerifier = new EnhancedEmailVerifier();
        this.config = performanceConfig.parallelProcessing;
        
        console.log('🚀 Enhanced Parallel Email Verifier initialized');
    }
    
    /**
     * Verify emails using parallel processing with enhanced verification
     */
    async verifyEmailsParallel(emails, options = {}) {
        const {
            progressCallback,
            connectionId,
            enableSMTP = true,
            deepVerification = true,
            usePythonValidator = true
        } = options;
        
        const startTime = Date.now();
        console.log(`🔄 Starting enhanced parallel verification of ${emails.length} emails`);
        
        try {
            // Group emails by domain for optimized processing
            const emailsByDomain = this.groupEmailsByDomain(emails);
            const allResults = [];
            let totalProcessed = 0;
            
            // Process each domain's emails with appropriate strategy
            for (const [domain, domainEmails] of Object.entries(emailsByDomain)) {
                const domainStrategy = this.getDomainStrategy(domain);
                console.log(`📧 Processing ${domainEmails.length} emails for ${domain} with strategy: ${domainStrategy.name}`);
                
                // Use parallel verifier with domain-specific settings
                const domainResults = await parallelVerifier.verifyEmails(
                    domainEmails,
                    {
                        batchSize: domainStrategy.batchSize,
                        connectionId,
                        progressCallback: (progress) => {
                            totalProcessed += progress.completed - totalProcessed;
                            if (progressCallback) {
                                progressCallback({
                                    ...progress,
                                    completed: totalProcessed,
                                    total: emails.length,
                                    percentage: Math.round((totalProcessed / emails.length) * 100),
                                    currentDomain: domain
                                });
                            }
                        }
                    }
                );
                
                // If needed, enhance results with deep verification for high-value domains
                if (domainStrategy.enhanceResults && domainResults.results.length <= 20) {
                    console.log(`🔬 Enhancing results for ${domain} with deep verification`);
                    const enhancedResults = await this.enhanceResults(
                        domainResults.results,
                        {
                            enableSMTP: domainStrategy.enableSMTP,
                            deepVerification: domainStrategy.deepVerification,
                            usePythonValidator
                        }
                    );
                    allResults.push(...enhancedResults);
                } else {
                    allResults.push(...domainResults.results);
                }
                
                // Apply rate limiting between domains if needed
                if (domainStrategy.delayAfter > 0) {
                    await new Promise(resolve => setTimeout(resolve, domainStrategy.delayAfter));
                }
            }
            
            const duration = Date.now() - startTime;
            
            return {
                results: allResults,
                summary: this.generateSummary(allResults),
                performance: {
                    totalEmails: emails.length,
                    duration,
                    emailsPerSecond: (emails.length / (duration / 1000)).toFixed(1),
                    domainsProcessed: Object.keys(emailsByDomain).length,
                    parallelProcessing: true,
                    enhanced: true
                }
            };
            
        } catch (error) {
            console.error('Enhanced parallel verification error:', error);
            throw error;
        }
    }
    
    /**
     * Group emails by domain
     */
    groupEmailsByDomain(emails) {
        const grouped = {};
        
        emails.forEach(email => {
            const domain = email.split('@')[1]?.toLowerCase();
            if (domain) {
                if (!grouped[domain]) {
                    grouped[domain] = [];
                }
                grouped[domain].push(email);
            }
        });
        
        return grouped;
    }
    
    /**
     * Get verification strategy for a domain
     */
    getDomainStrategy(domain) {
        const lowerDomain = domain.toLowerCase();
        
        // Check if it's a known corporate domain
        if (this.enhancedVerifier.corporateDomainsWithStrictSecurity.includes(lowerDomain)) {
            return {
                name: 'corporate-fast',
                batchSize: 50,
                enableSMTP: false,
                deepVerification: false,
                enhanceResults: false,
                delayAfter: 0
            };
        }
        
        // Check if it's a public email provider
        if (this.enhancedVerifier.publicDomains.includes(lowerDomain)) {
            return {
                name: 'public-careful',
                batchSize: 5,
                enableSMTP: true,
                deepVerification: true,
                enhanceResults: true,
                delayAfter: 2000 // 2 second delay after public domains
            };
        }
        
        // Default strategy for unknown domains
        return {
            name: 'standard',
            batchSize: 20,
            enableSMTP: true,
            deepVerification: false,
            enhanceResults: true,
            delayAfter: 500
        };
    }
    
    /**
     * Enhance results with deep verification
     */
    async enhanceResults(basicResults, options) {
        const enhanced = [];
        
        for (const result of basicResults) {
            if (result.valid || result.confidence === 'unknown') {
                // Run enhanced verification for potentially valid emails
                try {
                    const enhancedResult = await this.enhancedVerifier.verifyEmail(
                        result.email,
                        options
                    );
                    enhanced.push({
                        ...result,
                        ...enhancedResult.finalResult,
                        enhanced: true,
                        checks: enhancedResult.checks
                    });
                } catch (error) {
                    // Keep original result if enhancement fails
                    enhanced.push(result);
                }
            } else {
                // Keep invalid results as-is
                enhanced.push(result);
            }
        }
        
        return enhanced;
    }
    
    /**
     * Generate summary of results
     */
    generateSummary(results) {
        const summary = {
            total: results.length,
            valid: 0,
            invalid: 0,
            uncertain: 0,
            byConfidence: {
                high: 0,
                medium: 0,
                low: 0,
                unknown: 0
            },
            byDomain: {},
            enhanced: 0
        };
        
        results.forEach(result => {
            if (result.valid === true) summary.valid++;
            else if (result.valid === false) summary.invalid++;
            else summary.uncertain++;
            
            const confidence = result.confidence || 'unknown';
            summary.byConfidence[confidence]++;
            
            const domain = result.email?.split('@')[1];
            if (domain) {
                if (!summary.byDomain[domain]) {
                    summary.byDomain[domain] = { total: 0, valid: 0 };
                }
                summary.byDomain[domain].total++;
                if (result.valid) summary.byDomain[domain].valid++;
            }
            
            if (result.enhanced) summary.enhanced++;
        });
        
        summary.validPercentage = summary.total > 0 
            ? ((summary.valid / summary.total) * 100).toFixed(1) 
            : 0;
        
        return summary;
    }
    
    /**
     * Smart verification with adaptive strategies
     */
    async smartVerifyEmails(emails, options = {}) {
        const emailCount = emails.length;
        
        // Choose strategy based on email count
        if (emailCount <= 10) {
            // Small set - use enhanced verification for all
            console.log('📊 Small set detected - using enhanced verification');
            return this.enhancedVerifier.verifyEmailBatch(emails, {
                ...options,
                deepVerification: true,
                concurrency: 2
            });
        } else if (emailCount <= 50) {
            // Medium set - use parallel with some enhancement
            console.log('📊 Medium set detected - using parallel with enhancement');
            return this.verifyEmailsParallel(emails, {
                ...options,
                enhanceHighValue: true
            });
        } else {
            // Large set - use pure parallel for speed
            console.log('📊 Large set detected - using fast parallel verification');
            return parallelVerifier.verifyEmails(emails, {
                ...options,
                batchSize: 50
            });
        }
    }
}

// Create singleton instance
const enhancedParallelVerifier = new EnhancedParallelEmailVerifier();

module.exports = enhancedParallelVerifier;