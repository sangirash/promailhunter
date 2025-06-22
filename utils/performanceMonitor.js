// utils/performanceMonitor.js
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            emailGeneration: {
                total: 0,
                successful: 0,
                failed: 0,
                avgDuration: 0,
                durations: []
            },
            emailVerification: {
                total: 0,
                valid: 0,
                invalid: 0,
                timeout: 0,
                avgDuration: 0,
                durations: []
            },
            domainValidation: {
                total: 0,
                valid: 0,
                invalid: 0,
                cached: 0,
                avgDuration: 0,
                durations: []
            },
            smtp: {
                total: 0,
                successful: 0,
                failed: 0,
                timeout: 0,
                blocked: 0,
                avgDuration: 0,
                durations: []
            },
            python: {
                available: false,
                total: 0,
                successful: 0,
                failed: 0,
                avgDuration: 0,
                durations: []
            },
            api: {
                requests: 0,
                errors: 0,
                rateLimit: 0,
                avgResponseTime: 0,
                responseTimes: []
            }
        };

        this.startTime = Date.now();
        this.lastReset = new Date().toISOString();
        
        // Keep last 1000 durations for each metric
        this.maxDurationHistory = 1000;
    }

    /**
     * Record email generation metric
     */
    recordEmailGeneration(duration, success, emailCount = 0) {
        const metric = this.metrics.emailGeneration;
        metric.total++;
        
        if (success) {
            metric.successful++;
        } else {
            metric.failed++;
        }

        this.addDuration(metric, duration);
        
        // Additional tracking
        if (!metric.emailCounts) metric.emailCounts = [];
        metric.emailCounts.push(emailCount);
        if (metric.emailCounts.length > 100) metric.emailCounts.shift();
    }

    /**
     * Record email verification metric
     */
    recordEmailVerification(duration, result) {
        const metric = this.metrics.emailVerification;
        metric.total++;

        if (result === 'valid') {
            metric.valid++;
        } else if (result === 'invalid') {
            metric.invalid++;
        } else if (result === 'timeout') {
            metric.timeout++;
        }

        this.addDuration(metric, duration);
    }

    /**
     * Record domain validation metric
     */
    recordDomainValidation(duration, valid, cached = false) {
        const metric = this.metrics.domainValidation;
        metric.total++;

        if (valid) {
            metric.valid++;
        } else {
            metric.invalid++;
        }

        if (cached) {
            metric.cached++;
        }

        this.addDuration(metric, duration);
    }

    /**
     * Record SMTP check metric
     */
    recordSMTPCheck(duration, result) {
        const metric = this.metrics.smtp;
        metric.total++;

        switch (result) {
            case 'success':
                metric.successful++;
                break;
            case 'failed':
                metric.failed++;
                break;
            case 'timeout':
                metric.timeout++;
                break;
            case 'blocked':
                metric.blocked++;
                break;
        }

        this.addDuration(metric, duration);
    }

    /**
     * Record Python validator metric
     */
    recordPythonValidation(duration, success) {
        const metric = this.metrics.python;
        metric.total++;

        if (success) {
            metric.successful++;
        } else {
            metric.failed++;
        }

        this.addDuration(metric, duration);
    }

    /**
     * Record API request metric
     */
    recordAPIRequest(duration, error = false, rateLimit = false) {
        const metric = this.metrics.api;
        metric.requests++;

        if (error) {
            metric.errors++;
        }

        if (rateLimit) {
            metric.rateLimit++;
        }

        metric.responseTimes.push(duration);
        if (metric.responseTimes.length > this.maxDurationHistory) {
            metric.responseTimes.shift();
        }

        metric.avgResponseTime = this.calculateAverage(metric.responseTimes);
    }

    /**
     * Add duration to metric history
     */
    addDuration(metric, duration) {
        metric.durations.push(duration);
        if (metric.durations.length > this.maxDurationHistory) {
            metric.durations.shift();
        }
        metric.avgDuration = this.calculateAverage(metric.durations);
    }

    /**
     * Calculate average
     */
    calculateAverage(arr) {
        if (arr.length === 0) return 0;
        return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    }

    /**
     * Get performance summary
     */
    getSummary() {
        const uptime = Date.now() - this.startTime;
        const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);

        return {
            uptime: {
                milliseconds: uptime,
                hours: uptimeHours,
                started: new Date(this.startTime).toISOString()
            },
            emailGeneration: {
                total: this.metrics.emailGeneration.total,
                successRate: this.getSuccessRate(this.metrics.emailGeneration),
                avgDuration: `${this.metrics.emailGeneration.avgDuration}ms`,
                avgEmailsPerRequest: this.getAvgEmailsPerRequest()
            },
            emailVerification: {
                total: this.metrics.emailVerification.total,
                validRate: this.getValidRate(),
                timeoutRate: this.getTimeoutRate(),
                avgDuration: `${this.metrics.emailVerification.avgDuration}ms`
            },
            domainValidation: {
                total: this.metrics.domainValidation.total,
                validRate: this.getDomainValidRate(),
                cacheHitRate: this.getCacheHitRate(),
                avgDuration: `${this.metrics.domainValidation.avgDuration}ms`
            },
            smtp: {
                total: this.metrics.smtp.total,
                successRate: this.getSMTPSuccessRate(),
                timeoutRate: this.getSMTPTimeoutRate(),
                blockedRate: this.getSMTPBlockedRate(),
                avgDuration: `${this.metrics.smtp.avgDuration}ms`
            },
            python: {
                available: this.metrics.python.available,
                total: this.metrics.python.total,
                successRate: this.getPythonSuccessRate(),
                avgDuration: `${this.metrics.python.avgDuration}ms`
            },
            api: {
                totalRequests: this.metrics.api.requests,
                errorRate: this.getAPIErrorRate(),
                rateLimitHits: this.metrics.api.rateLimit,
                avgResponseTime: `${this.metrics.api.avgResponseTime}ms`
            },
            throughput: this.getThroughput()
        };
    }

    /**
     * Calculate success rates
     */
    getSuccessRate(metric) {
        if (metric.total === 0) return '0%';
        return `${((metric.successful / metric.total) * 100).toFixed(1)}%`;
    }

    getValidRate() {
        const metric = this.metrics.emailVerification;
        if (metric.total === 0) return '0%';
        return `${((metric.valid / metric.total) * 100).toFixed(1)}%`;
    }

    getTimeoutRate() {
        const metric = this.metrics.emailVerification;
        if (metric.total === 0) return '0%';
        return `${((metric.timeout / metric.total) * 100).toFixed(1)}%`;
    }

    getDomainValidRate() {
        const metric = this.metrics.domainValidation;
        if (metric.total === 0) return '0%';
        return `${((metric.valid / metric.total) * 100).toFixed(1)}%`;
    }

    getCacheHitRate() {
        const metric = this.metrics.domainValidation;
        if (metric.total === 0) return '0%';
        return `${((metric.cached / metric.total) * 100).toFixed(1)}%`;
    }

    getSMTPSuccessRate() {
        const metric = this.metrics.smtp;
        if (metric.total === 0) return '0%';
        return `${((metric.successful / metric.total) * 100).toFixed(1)}%`;
    }

    getSMTPTimeoutRate() {
        const metric = this.metrics.smtp;
        if (metric.total === 0) return '0%';
        return `${((metric.timeout / metric.total) * 100).toFixed(1)}%`;
    }

    getSMTPBlockedRate() {
        const metric = this.metrics.smtp;
        if (metric.total === 0) return '0%';
        return `${((metric.blocked / metric.total) * 100).toFixed(1)}%`;
    }

    getPythonSuccessRate() {
        const metric = this.metrics.python;
        if (metric.total === 0) return '0%';
        return `${((metric.successful / metric.total) * 100).toFixed(1)}%`;
    }

    getAPIErrorRate() {
        const metric = this.metrics.api;
        if (metric.requests === 0) return '0%';
        return `${((metric.errors / metric.requests) * 100).toFixed(1)}%`;
    }

    getAvgEmailsPerRequest() {
        const metric = this.metrics.emailGeneration;
        if (!metric.emailCounts || metric.emailCounts.length === 0) return 0;
        return Math.round(metric.emailCounts.reduce((a, b) => a + b, 0) / metric.emailCounts.length);
    }

    /**
     * Calculate throughput
     */
    getThroughput() {
        const uptime = Date.now() - this.startTime;
        const uptimeMinutes = uptime / (1000 * 60);

        return {
            emailsGeneratedPerMinute: (this.metrics.emailGeneration.total / uptimeMinutes).toFixed(2),
            emailsVerifiedPerMinute: (this.metrics.emailVerification.total / uptimeMinutes).toFixed(2),
            apiRequestsPerMinute: (this.metrics.api.requests / uptimeMinutes).toFixed(2)
        };
    }

    /**
     * Get detailed performance report
     */
    getDetailedReport() {
        const summary = this.getSummary();
        
        return {
            ...summary,
            recentPerformance: {
                last100EmailGenerations: this.getRecentMetrics(this.metrics.emailGeneration.durations, 100),
                last100Verifications: this.getRecentMetrics(this.metrics.emailVerification.durations, 100),
                last100APIRequests: this.getRecentMetrics(this.metrics.api.responseTimes, 100)
            },
            systemHealth: this.getSystemHealth(),
            recommendations: this.getRecommendations()
        };
    }

    /**
     * Get recent metrics analysis
     */
    getRecentMetrics(durations, count) {
        const recent = durations.slice(-count);
        if (recent.length === 0) return null;

        return {
            count: recent.length,
            avg: Math.round(recent.reduce((a, b) => a + b, 0) / recent.length),
            min: Math.min(...recent),
            max: Math.max(...recent),
            p95: this.calculatePercentile(recent, 95),
            p99: this.calculatePercentile(recent, 99)
        };
    }

    /**
     * Calculate percentile
     */
    calculatePercentile(arr, percentile) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }

    /**
     * Get system health status
     */
    getSystemHealth() {
        const health = {
            status: 'healthy',
            score: 100,
            issues: []
        };

        // Check error rates
        const apiErrorRate = parseFloat(this.getAPIErrorRate());
        if (apiErrorRate > 10) {
            health.score -= 20;
            health.issues.push(`High API error rate: ${apiErrorRate}%`);
        }

        // Check timeout rates
        const timeoutRate = parseFloat(this.getTimeoutRate());
        if (timeoutRate > 30) {
            health.score -= 15;
            health.issues.push(`High email verification timeout rate: ${timeoutRate}%`);
        }

        // Check SMTP blocked rate
        const blockedRate = parseFloat(this.getSMTPBlockedRate());
        if (blockedRate > 50) {
            health.score -= 10;
            health.issues.push(`High SMTP blocked rate: ${blockedRate}%`);
        }

        // Determine overall status
        if (health.score >= 90) {
            health.status = 'excellent';
        } else if (health.score >= 70) {
            health.status = 'good';
        } else if (health.score >= 50) {
            health.status = 'fair';
        } else {
            health.status = 'poor';
        }

        return health;
    }

    /**
     * Get performance recommendations
     */
    getRecommendations() {
        const recommendations = [];
        
        // Check average durations
        if (this.metrics.emailVerification.avgDuration > 10000) {
            recommendations.push('Email verification is slow. Consider reducing SMTP timeout or increasing concurrency.');
        }

        if (this.metrics.smtp.timeout > this.metrics.smtp.successful) {
            recommendations.push('More SMTP timeouts than successes. Consider implementing a domain whitelist.');
        }

        const cacheHitRate = parseFloat(this.getCacheHitRate());
        if (cacheHitRate < 30 && this.metrics.domainValidation.total > 100) {
            recommendations.push('Low domain validation cache hit rate. Consider increasing cache TTL.');
        }

        if (!this.metrics.python.available) {
            recommendations.push('Python email-validator not available. Install it for better validation accuracy.');
        }

        if (recommendations.length === 0) {
            recommendations.push('System is performing well. No immediate optimizations needed.');
        }

        return recommendations;
    }

    /**
     * Reset metrics
     */
    reset() {
        this.metrics = {
            emailGeneration: {
                total: 0,
                successful: 0,
                failed: 0,
                avgDuration: 0,
                durations: []
            },
            emailVerification: {
                total: 0,
                valid: 0,
                invalid: 0,
                timeout: 0,
                avgDuration: 0,
                durations: []
            },
            domainValidation: {
                total: 0,
                valid: 0,
                invalid: 0,
                cached: 0,
                avgDuration: 0,
                durations: []
            },
            smtp: {
                total: 0,
                successful: 0,
                failed: 0,
                timeout: 0,
                blocked: 0,
                avgDuration: 0,
                durations: []
            },
            python: {
                available: this.metrics.python.available,
                total: 0,
                successful: 0,
                failed: 0,
                avgDuration: 0,
                durations: []
            },
            api: {
                requests: 0,
                errors: 0,
                rateLimit: 0,
                avgResponseTime: 0,
                responseTimes: []
            }
        };

        this.lastReset = new Date().toISOString();
    }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;