// utils/emailPatternAnalytics.js
const fs = require('fs').promises;
const path = require('path');

class EmailPatternAnalytics {
    constructor() {
        this.patterns = new Map();
        this.domainStats = new Map();
        this.successfulVerifications = new Map();
        this.dataFile = path.join(process.cwd(), 'data', 'email_pattern_analytics.json');
        this.loadData();
    }

    /**
     * Load analytics data from file
     */
    async loadData() {
        try {
            const data = await fs.readFile(this.dataFile, 'utf8');
            const parsed = JSON.parse(data);
            
            this.patterns = new Map(parsed.patterns || []);
            this.domainStats = new Map(parsed.domainStats || []);
            this.successfulVerifications = new Map(parsed.successfulVerifications || []);
            
            console.log('📊 Loaded email pattern analytics');
        } catch (error) {
            console.log('📊 No existing analytics data, starting fresh');
        }
    }

    /**
     * Save analytics data to file
     */
    async saveData() {
        try {
            const data = {
                patterns: Array.from(this.patterns.entries()),
                domainStats: Array.from(this.domainStats.entries()),
                successfulVerifications: Array.from(this.successfulVerifications.entries()),
                lastUpdated: new Date().toISOString()
            };

            const dir = path.dirname(this.dataFile);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2));
            
        } catch (error) {
            console.error('Failed to save analytics:', error.message);
        }
    }

    /**
     * Analyze an email to extract its pattern
     */
    analyzeEmailPattern(email) {
        const [username, domain] = email.split('@');
        if (!username || !domain) return null;

        const lowerUsername = username.toLowerCase();
        const lowerDomain = domain.toLowerCase();

        // Detect pattern type
        let pattern = 'unknown';
        let components = {};

        // Common patterns
        if (/^[a-z]+\.[a-z]+$/.test(lowerUsername)) {
            pattern = 'first.last';
            const parts = lowerUsername.split('.');
            components = { first: parts[0], last: parts[1] };
        } else if (/^[a-z]+_[a-z]+$/.test(lowerUsername)) {
            pattern = 'first_last';
            const parts = lowerUsername.split('_');
            components = { first: parts[0], last: parts[1] };
        } else if (/^[a-z]+\-[a-z]+$/.test(lowerUsername)) {
            pattern = 'first-last';
            const parts = lowerUsername.split('-');
            components = { first: parts[0], last: parts[1] };
        } else if (/^[a-z]\.[a-z]+$/.test(lowerUsername)) {
            pattern = 'f.last';
            components = { firstInitial: lowerUsername[0], last: lowerUsername.substring(2) };
        } else if (/^[a-z]+\.[a-z]$/.test(lowerUsername)) {
            pattern = 'first.l';
            const parts = lowerUsername.split('.');
            components = { first: parts[0], lastInitial: parts[1] };
        } else if (/^[a-z]+[0-9]+$/.test(lowerUsername)) {
            pattern = 'name+number';
            const match = lowerUsername.match(/^([a-z]+)([0-9]+)$/);
            components = { name: match[1], number: match[2] };
        } else if (/^[a-z]{2,}$/.test(lowerUsername)) {
            if (lowerUsername.length <= 8) {
                pattern = 'firstname';
            } else {
                pattern = 'firstlast';
            }
            components = { username: lowerUsername };
        }

        return {
            email,
            username: lowerUsername,
            domain: lowerDomain,
            pattern,
            components,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Record a successful email verification
     */
    async recordSuccessfulVerification(email, verificationData = {}) {
        const analysis = this.analyzeEmailPattern(email);
        if (!analysis) return;

        const { domain, pattern } = analysis;

        // Update pattern frequency for domain
        if (!this.patterns.has(domain)) {
            this.patterns.set(domain, new Map());
        }
        const domainPatterns = this.patterns.get(domain);
        domainPatterns.set(pattern, (domainPatterns.get(pattern) || 0) + 1);

        // Update domain statistics
        if (!this.domainStats.has(domain)) {
            this.domainStats.set(domain, {
                totalVerified: 0,
                patterns: {},
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            });
        }
        const stats = this.domainStats.get(domain);
        stats.totalVerified++;
        stats.patterns[pattern] = (stats.patterns[pattern] || 0) + 1;
        stats.lastSeen = new Date().toISOString();

        // Store successful verification
        if (!this.successfulVerifications.has(domain)) {
            this.successfulVerifications.set(domain, []);
        }
        this.successfulVerifications.get(domain).push({
            email,
            pattern,
            timestamp: new Date().toISOString(),
            ...verificationData
        });

        // Save data periodically
        await this.saveData();

        console.log(`📊 Recorded: ${email} (${pattern} pattern for ${domain})`);
    }

    /**
     * Get most common patterns for a domain
     */
    getMostCommonPatterns(domain, limit = 5) {
        const lowerDomain = domain.toLowerCase();
        const stats = this.domainStats.get(lowerDomain);
        
        if (!stats || !stats.patterns) {
            return [];
        }

        // Sort patterns by frequency
        const sorted = Object.entries(stats.patterns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);

        return sorted.map(([pattern, count]) => ({
            pattern,
            count,
            percentage: ((count / stats.totalVerified) * 100).toFixed(1)
        }));
    }

    /**
     * Get domain analytics report
     */
    getDomainReport(domain) {
        const lowerDomain = domain.toLowerCase();
        const stats = this.domainStats.get(lowerDomain);
        
        if (!stats) {
            return {
                domain: lowerDomain,
                hasData: false,
                message: 'No verification data for this domain'
            };
        }

        const commonPatterns = this.getMostCommonPatterns(domain);
        const recentVerifications = (this.successfulVerifications.get(lowerDomain) || [])
            .slice(-10)
            .map(v => ({ email: v.email, pattern: v.pattern }));

        return {
            domain: lowerDomain,
            hasData: true,
            statistics: {
                totalVerified: stats.totalVerified,
                uniquePatterns: Object.keys(stats.patterns).length,
                firstSeen: stats.firstSeen,
                lastSeen: stats.lastSeen
            },
            commonPatterns,
            recentVerifications,
            recommendations: this.generateRecommendations(commonPatterns)
        };
    }

    /**
     * Generate pattern recommendations
     */
    generateRecommendations(commonPatterns) {
        if (commonPatterns.length === 0) {
            return ['No pattern data available yet'];
        }

        const recommendations = [];
        const topPattern = commonPatterns[0];

        if (topPattern.percentage > 70) {
            recommendations.push(`Strong preference for "${topPattern.pattern}" pattern (${topPattern.percentage}%)`);
        } else if (topPattern.percentage > 40) {
            recommendations.push(`"${topPattern.pattern}" is most common but not dominant (${topPattern.percentage}%)`);
            recommendations.push('Consider trying multiple patterns');
        } else {
            recommendations.push('No dominant pattern detected');
            recommendations.push('This domain uses diverse email formats');
        }

        // Pattern-specific recommendations
        if (topPattern.pattern === 'first.last') {
            recommendations.push('Professional format: firstname.lastname@domain');
        } else if (topPattern.pattern === 'firstname') {
            recommendations.push('Simple format: firstname@domain');
        } else if (topPattern.pattern === 'f.last') {
            recommendations.push('Initial format: f.lastname@domain');
        }

        return recommendations;
    }

    /**
     * Get global analytics summary
     */
    getGlobalSummary() {
        const totalDomains = this.domainStats.size;
        const totalVerifications = Array.from(this.domainStats.values())
            .reduce((sum, stats) => sum + stats.totalVerified, 0);

        // Pattern distribution across all domains
        const globalPatterns = {};
        for (const [domain, stats] of this.domainStats) {
            for (const [pattern, count] of Object.entries(stats.patterns)) {
                globalPatterns[pattern] = (globalPatterns[pattern] || 0) + count;
            }
        }

        const sortedPatterns = Object.entries(globalPatterns)
            .sort((a, b) => b[1] - a[1])
            .map(([pattern, count]) => ({
                pattern,
                count,
                percentage: ((count / totalVerifications) * 100).toFixed(1)
            }));

        // Top domains by verification count
        const topDomains = Array.from(this.domainStats.entries())
            .sort((a, b) => b[1].totalVerified - a[1].totalVerified)
            .slice(0, 10)
            .map(([domain, stats]) => ({
                domain,
                totalVerified: stats.totalVerified,
                patterns: Object.keys(stats.patterns).length
            }));

        return {
            summary: {
                totalDomains,
                totalVerifications,
                avgVerificationsPerDomain: (totalVerifications / totalDomains).toFixed(1)
            },
            globalPatterns: sortedPatterns,
            topDomains,
            insights: this.generateGlobalInsights(sortedPatterns, totalVerifications)
        };
    }

    /**
     * Generate global insights
     */
    generateGlobalInsights(patterns, totalVerifications) {
        const insights = [];

        if (patterns.length > 0) {
            const topPattern = patterns[0];
            insights.push(`Most common pattern globally: "${topPattern.pattern}" (${topPattern.percentage}%)`);

            if (patterns.find(p => p.pattern === 'first.last')) {
                const flPattern = patterns.find(p => p.pattern === 'first.last');
                insights.push(`Professional format (first.last) represents ${flPattern.percentage}% of emails`);
            }

            const simplePatterns = ['firstname', 'lastname', 'firstlast'];
            const simpleTotal = patterns
                .filter(p => simplePatterns.includes(p.pattern))
                .reduce((sum, p) => sum + parseInt(p.count), 0);
            const simplePercentage = ((simpleTotal / totalVerifications) * 100).toFixed(1);
            
            if (simplePercentage > 20) {
                insights.push(`Simple patterns (single name) account for ${simplePercentage}% of emails`);
            }
        }

        return insights;
    }

    /**
     * Export analytics data
     */
    async exportAnalytics(format = 'json') {
        const data = {
            exportDate: new Date().toISOString(),
            globalSummary: this.getGlobalSummary(),
            domainReports: []
        };

        // Add individual domain reports
        for (const [domain, stats] of this.domainStats) {
            data.domainReports.push(this.getDomainReport(domain));
        }

        if (format === 'json') {
            return data;
        } else if (format === 'csv') {
            // Convert to CSV format
            const csvRows = ['Domain,Total Verified,Most Common Pattern,Pattern Count'];
            
            for (const report of data.domainReports) {
                if (report.hasData && report.commonPatterns.length > 0) {
                    const topPattern = report.commonPatterns[0];
                    csvRows.push(`${report.domain},${report.statistics.totalVerified},${topPattern.pattern},${topPattern.count}`);
                }
            }
            
            return csvRows.join('\n');
        }

        return data;
    }
}

module.exports = EmailPatternAnalytics;