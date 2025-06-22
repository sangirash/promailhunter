// utils/smartEmailSubsetSelector.js

class SmartEmailSubsetSelector {
    /**
     * Select the most likely valid emails for verification
     * @param {Array} allEmails - All generated emails
     * @param {number} limit - Maximum number to verify
     * @param {Object} options - Selection options
     * @returns {Array} Selected emails for verification
     */
    static selectSmartSubset(allEmails, limit, options = {}) {
        if (!allEmails || allEmails.length === 0) {
            return [];
        }

        // If limit is greater than or equal to total, return all
        if (limit >= allEmails.length) {
            return allEmails;
        }

        const {
            firstName = '',
            lastName = '',
            prioritizePatterns = true,
            includeDiversity = true
        } = options;

        // Categorize emails by pattern
        const categorizedEmails = this.categorizeByPattern(allEmails);
        
        // Rank patterns by likelihood
        const rankedPatterns = this.rankPatterns(categorizedEmails, { firstName, lastName });
        
        // Select emails based on ranking
        return this.selectByPriority(rankedPatterns, limit, includeDiversity);
    }

    /**
     * Categorize emails by their pattern type
     */
    static categorizeByPattern(emails) {
        const patterns = {
            'first.last': [],      // john.doe@
            'firstlast': [],       // johndoe@
            'first_last': [],      // john_doe@
            'first-last': [],      // john-doe@
            'f.last': [],          // j.doe@
            'first.l': [],         // john.d@
            'first': [],           // john@
            'last': [],            // doe@
            'flast': [],           // jdoe@
            'firstl': [],          // johnd@
            'with_numbers': [],    // john1@, doe123@
            'other': []           // anything else
        };

        emails.forEach(email => {
            const [username] = email.split('@');
            const pattern = this.detectPattern(username);
            
            if (patterns[pattern]) {
                patterns[pattern].push(email);
            } else if (/\d/.test(username)) {
                patterns.with_numbers.push(email);
            } else {
                patterns.other.push(email);
            }
        });

        return patterns;
    }

    /**
     * Detect the pattern of a username
     */
    static detectPattern(username) {
        const lower = username.toLowerCase();
        
        // Check for specific patterns
        if (/^[a-z]+\.[a-z]+$/.test(lower)) return 'first.last';
        if (/^[a-z]+_[a-z]+$/.test(lower)) return 'first_last';
        if (/^[a-z]+-[a-z]+$/.test(lower)) return 'first-last';
        if (/^[a-z]\.[a-z]+$/.test(lower)) return 'f.last';
        if (/^[a-z]+\.[a-z]$/.test(lower)) return 'first.l';
        if (/^[a-z][a-z]+$/.test(lower) && lower.length <= 15) {
            // Try to detect if it's firstname only or combined
            if (lower.length <= 8) return 'first';
            return 'firstlast';
        }
        if (/^[a-z]{2,}$/.test(lower) && lower.length <= 10) return 'last';
        if (/^[a-z][a-z]{2,}$/.test(lower) && lower.length <= 8) return 'flast';
        
        return 'other';
    }

    /**
     * Rank patterns by likelihood of being valid
     */
    static rankPatterns(categorizedEmails, options) {
        // Professional email patterns ranked by commonality
        const patternPriority = {
            'first.last': 1,     // Most professional/common
            'first_last': 2,     
            'firstlast': 3,      
            'first': 4,          
            'f.last': 5,         
            'flast': 6,          
            'first-last': 7,     
            'last': 8,           
            'first.l': 9,        
            'firstl': 10,        
            'with_numbers': 11,  // Less common for professional emails
            'other': 12          
        };

        // Convert to array and sort by priority
        const rankedList = [];
        
        Object.entries(categorizedEmails).forEach(([pattern, emails]) => {
            if (emails.length > 0) {
                rankedList.push({
                    pattern,
                    priority: patternPriority[pattern] || 99,
                    emails: emails
                });
            }
        });

        // Sort by priority (lower number = higher priority)
        rankedList.sort((a, b) => a.priority - b.priority);

        return rankedList;
    }

    /**
     * Select emails based on priority and diversity
     */
    static selectByPriority(rankedPatterns, limit, includeDiversity) {
        const selected = [];
        const selectedPatterns = new Set();

        if (!includeDiversity) {
            // Simple selection: take from highest priority patterns first
            for (const { pattern, emails } of rankedPatterns) {
                for (const email of emails) {
                    if (selected.length >= limit) break;
                    selected.push(email);
                }
                if (selected.length >= limit) break;
            }
        } else {
            // Smart selection: ensure diversity of patterns
            
            // First pass: take at least one from each pattern (if available)
            for (const { pattern, emails } of rankedPatterns) {
                if (selected.length >= limit) break;
                if (emails.length > 0) {
                    selected.push(emails[0]);
                    selectedPatterns.add(pattern);
                }
            }

            // Second pass: fill remaining slots prioritizing higher-ranked patterns
            if (selected.length < limit) {
                for (const { pattern, emails } of rankedPatterns) {
                    // Take additional emails from this pattern
                    const startIndex = selectedPatterns.has(pattern) ? 1 : 0;
                    
                    for (let i = startIndex; i < emails.length; i++) {
                        if (selected.length >= limit) break;
                        selected.push(emails[i]);
                    }
                    
                    if (selected.length >= limit) break;
                }
            }
        }

        return selected;
    }

    /**
     * Get verification strategy explanation
     */
    static getStrategyExplanation(allEmails, selectedEmails) {
        const totalCount = allEmails.length;
        const selectedCount = selectedEmails.length;
        
        // Analyze what was selected
        const selectedPatterns = {};
        selectedEmails.forEach(email => {
            const [username] = email.split('@');
            const pattern = this.detectPattern(username);
            selectedPatterns[pattern] = (selectedPatterns[pattern] || 0) + 1;
        });

        return {
            summary: {
                total: totalCount,
                selected: selectedCount,
                percentage: ((selectedCount / totalCount) * 100).toFixed(1) + '%'
            },
            strategy: 'Smart pattern-based selection prioritizing professional email formats',
            selectedPatterns: Object.entries(selectedPatterns)
                .sort((a, b) => b[1] - a[1])
                .map(([pattern, count]) => ({
                    pattern,
                    count,
                    percentage: ((count / selectedCount) * 100).toFixed(1) + '%'
                })),
            rationale: [
                'Prioritizes common professional patterns (first.last, firstlast)',
                'Includes diverse patterns to maximize hit rate',
                'Avoids over-testing similar patterns',
                'Focuses on patterns most likely to exist in corporate environments'
            ]
        };
    }
}

module.exports = SmartEmailSubsetSelector;