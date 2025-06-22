// utils/realtimeDomainValidator.js
class RealtimeDomainValidator {
    constructor() {
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.debounceTimer = null;
    }

    /**
     * Extract domain from various input formats
     */
    extractDomain(input) {
        const cleanInput = input.trim().toLowerCase();
        
        // Direct domain format
        const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (domainPattern.test(cleanInput)) {
            return cleanInput;
        }
        
        // Email format
        if (cleanInput.includes('@')) {
            const parts = cleanInput.split('@');
            if (parts.length === 2 && domainPattern.test(parts[1])) {
                return parts[1];
            }
        }
        
        // URL format
        const urlPattern = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const match = cleanInput.match(urlPattern);
        if (match && match[3]) {
            return match[3];
        }
        
        return null;
    }

    /**
     * Validate domain with caching and debouncing
     */
    async validateDomain(input, callback) {
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Extract domain
        const domain = this.extractDomain(input);
        
        if (!domain) {
            callback({
                valid: false,
                status: 'invalid_format',
                message: 'Please enter a valid domain format',
                domain: null
            });
            return;
        }

        // Check cache first
        if (this.cache.has(domain)) {
            const cached = this.cache.get(domain);
            callback({
                ...cached,
                fromCache: true
            });
            return;
        }

        // Show checking status
        callback({
            valid: null,
            status: 'checking',
            message: `Validating ${domain}...`,
            domain: domain
        });

        // Debounce the actual validation
        this.debounceTimer = setTimeout(async () => {
            try {
                // Cancel any pending request for this domain
                if (this.pendingRequests.has(domain)) {
                    this.pendingRequests.get(domain).abort();
                }

                // Create new request
                const controller = new AbortController();
                this.pendingRequests.set(domain, controller);

                const response = await fetch('/api/validate-domain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain }),
                    signal: controller.signal
                });

                const result = await response.json();
                
                // Cache the result
                const validationResult = {
                    valid: result.valid,
                    status: result.valid ? 'valid' : 'invalid',
                    message: result.message || (result.valid ? `✅ ${domain} is valid` : `❌ ${domain} not found`),
                    domain: domain,
                    mxRecords: result.mxRecords,
                    isPublicProvider: result.isPublicProvider,
                    isCorporateDomain: result.isCorporateDomain
                };

                this.cache.set(domain, validationResult);
                this.pendingRequests.delete(domain);
                
                callback(validationResult);

            } catch (error) {
                this.pendingRequests.delete(domain);
                
                if (error.name === 'AbortError') {
                    // Request was cancelled, ignore
                    return;
                }

                callback({
                    valid: false,
                    status: 'error',
                    message: 'Unable to validate domain',
                    domain: domain,
                    error: error.message
                });
            }
        }, 500); // 500ms debounce
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get validation stats
     */
    getStats() {
        return {
            cachedDomains: this.cache.size,
            pendingRequests: this.pendingRequests.size
        };
    }
}

// Export for use in frontend
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealtimeDomainValidator;
}