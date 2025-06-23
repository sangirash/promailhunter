// config/verificationConfig.js - Configuration for complete email verification

module.exports = {
  // Verification strategies based on email count
  verificationStrategies: {
    small: {
      threshold: 20,
      batchSize: 2,
      delay: 3000,
      concurrency: 2,
      description: 'Small set - careful sequential verification',
      smtpEnabled: true,
      deepVerification: true
    },
    medium: {
      threshold: 50,
      batchSize: 3,
      delay: 2500,
      concurrency: 3,
      description: 'Medium set - balanced batch verification',
      smtpEnabled: true,
      deepVerification: true
    },
    large: {
      threshold: 100,
      batchSize: 4,
      delay: 2000,
      concurrency: 4,
      description: 'Large set - optimized batch verification',
      smtpEnabled: true,
      deepVerification: false // Skip deep verification for speed
    },
    veryLarge: {
      threshold: Infinity,
      batchSize: 5,
      delay: 1500,
      concurrency: 5,
      description: 'Very large set - progressive verification with pattern learning',
      smtpEnabled: false, // Use pattern matching primarily
      deepVerification: false
    }
  },

  // Domain-specific settings
  domainSettings: {
    corporate: {
      batchSizeMultiplier: 2, // Process faster with pattern matching
      delayDivisor: 6, // Much shorter delays
      preferPatternMatching: true,
      smtpEnabled: false
    },
    public: {
      batchSizeDivisor: 2, // Process slower to avoid rate limits
      delayMultiplier: 1.5, // Longer delays
      preferPatternMatching: false,
      smtpEnabled: true,
      maxRetries: 1 // Fewer retries for public providers
    },
    standard: {
      batchSizeMultiplier: 1,
      delayMultiplier: 1,
      preferPatternMatching: false,
      smtpEnabled: true,
      maxRetries: 2
    }
  },

  // Performance settings
  performance: {
    maxConcurrentDomains: 3, // Process up to 3 domains simultaneously
    maxTotalConcurrency: 10, // Maximum total concurrent verifications
    progressUpdateInterval: 1000, // Update progress every second
    saveResultsInterval: 50, // Save partial results every 50 verifications
    memoryCheckInterval: 100 // Check memory usage every 100 verifications
  },

  // Timeout settings (in milliseconds)
  timeouts: {
    dns: 5000,
    smtp: 15000,
    pattern: 100,
    python: 10000,
    overall: 300000 // 5 minutes max for entire verification
  },

  // Pattern confidence thresholds
  patternConfidence: {
    high: 0.9,    // 90% confidence - definitely valid pattern
    medium: 0.7,  // 70% confidence - likely valid
    low: 0.5,     // 50% confidence - possibly valid
    threshold: 0.6 // Minimum confidence to mark as valid
  },

  // Result caching
  caching: {
    enabled: true,
    ttl: 3600000, // 1 hour
    maxSize: 10000, // Maximum cached results
    domainCacheTTL: 86400000 // 24 hours for domain validation
  },

  // Error handling
  errorHandling: {
    maxConsecutiveErrors: 5, // Stop if too many errors in a row
    errorDelayMultiplier: 2, // Double delay after each error
    skipDomainAfterErrors: 3, // Skip domain after 3 consecutive errors
    continueOnDomainError: true // Continue with other domains if one fails
  },

  // Reporting
  reporting: {
    includeDetailedLogs: true,
    savePartialResults: true,
    generateSummaryReport: true,
    includePatternAnalysis: true,
    includeDomainAnalysis: true,
    includeTimingMetrics: true
  }
};

// Helper function to get strategy based on email count
function getVerificationStrategy(emailCount) {
  const config = module.exports;
  
  if (emailCount <= config.verificationStrategies.small.threshold) {
    return config.verificationStrategies.small;
  } else if (emailCount <= config.verificationStrategies.medium.threshold) {
    return config.verificationStrategies.medium;
  } else if (emailCount <= config.verificationStrategies.large.threshold) {
    return config.verificationStrategies.large;
  } else {
    return config.verificationStrategies.veryLarge;
  }
}

// Helper function to adjust strategy for domain type
function adjustStrategyForDomain(strategy, domain, domainType) {
  const config = module.exports;
  const domainSettings = config.domainSettings[domainType] || config.domainSettings.standard;
  
  return {
    ...strategy,
    batchSize: Math.round(strategy.batchSize * (domainSettings.batchSizeMultiplier || 1) / (domainSettings.batchSizeDivisor || 1)),
    delay: Math.round(strategy.delay * (domainSettings.delayMultiplier || 1) / (domainSettings.delayDivisor || 1)),
    smtpEnabled: domainSettings.smtpEnabled !== undefined ? domainSettings.smtpEnabled : strategy.smtpEnabled,
    preferPatternMatching: domainSettings.preferPatternMatching,
    maxRetries: domainSettings.maxRetries
  };
}

module.exports.getVerificationStrategy = getVerificationStrategy;
module.exports.adjustStrategyForDomain = adjustStrategyForDomain;