// config/performance.js - Performance tuning configuration

const os = require('os');

module.exports = {
    // Connection pool settings
    connectionPool: {
        maxConcurrentUsers: process.env.MAX_CONCURRENT_USERS || 20,
        maxConnectionsPerUser: process.env.MAX_CONNECTIONS_PER_USER || 5,
        queueTimeout: process.env.QUEUE_TIMEOUT || 60000, // 60 seconds
        cleanupInterval: 5000, // 5 seconds
        maxConnectionTime: 300000 // 5 minutes max per connection
    },
    
    // Parallel processing settings
    parallelProcessing: {
        // Use up to 80% of available CPUs for worker threads
        maxWorkers: process.env.MAX_WORKERS || Math.min(Math.floor(os.cpus().length * 0.8), 8),
        taskTimeout: process.env.TASK_TIMEOUT || 30000, // 30 seconds per task
        maxRetries: 2,
        batchSize: process.env.BATCH_SIZE || 20 // Emails per batch
    },
    
    // Email verification settings
    emailVerification: {
        // Concurrent verifications per worker
        concurrencyPerWorker: 5,
        
        // Timeouts
        dnsTimeout: 5000,
        smtpTimeout: 15000,
        overallTimeout: 300000, // 5 minutes max
        
        // Retry settings
        maxRetries: 2,
        retryDelay: 2000,
        
        // Rate limiting per domain
        domainRateLimit: {
            'gmail.com': { delay: 3000, concurrent: 1 },
            'yahoo.com': { delay: 3000, concurrent: 1 },
            'outlook.com': { delay: 2000, concurrent: 2 },
            'hotmail.com': { delay: 2000, concurrent: 2 },
            'default': { delay: 1000, concurrent: 3 }
        }
    },
    
    // Cache settings
    cache: {
        domainCacheTTL: 86400000, // 24 hours
        verificationCacheTTL: 3600000, // 1 hour
        maxCacheSize: 10000,
        enableRedis: process.env.ENABLE_REDIS === 'true',
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
    },
    
    // AWS optimization (if on AWS)
    aws: {
        // Use placement groups for low latency
        usePlacementGroup: process.env.AWS_PLACEMENT_GROUP === 'true',
        
        // Enhanced networking
        enhancedNetworking: process.env.AWS_ENHANCED_NETWORKING === 'true',
        
        // Auto-scaling settings
        autoScaling: {
            enabled: process.env.AWS_AUTO_SCALING === 'true',
            minInstances: process.env.AWS_MIN_INSTANCES || 1,
            maxInstances: process.env.AWS_MAX_INSTANCES || 5,
            targetCPU: process.env.AWS_TARGET_CPU || 70
        }
    },
    
    // Performance monitoring
    monitoring: {
        enableMetrics: true,
        metricsInterval: 60000, // 1 minute
        enableHealthCheck: true,
        healthCheckInterval: 30000, // 30 seconds
        
        // Alert thresholds
        alerts: {
            queueLengthThreshold: 50,
            responseTimeThreshold: 10000, // 10 seconds
            errorRateThreshold: 0.1, // 10%
            cpuThreshold: 80,
            memoryThreshold: 85
        }
    },
    
    // Request processing
    requestProcessing: {
        // Prioritize smaller verification requests
        prioritizeBySize: true,
        
        // Smart routing based on domain
        smartRouting: true,
        
        // Batch processing optimization
        batchOptimization: {
            enabled: true,
            minBatchSize: 10,
            maxBatchSize: 100,
            adaptiveBatching: true // Adjust batch size based on load
        }
    },
    
    // Network optimization
    network: {
        // Keep-alive settings
        keepAlive: true,
        keepAliveTimeout: 60000,
        
        // DNS optimization
        dnsCacheEnabled: true,
        dnsCacheTTL: 300000, // 5 minutes
        
        // Connection pooling
        maxSockets: 100,
        maxFreeSockets: 20,
        
        // TCP optimization
        tcpNoDelay: true,
        
        // Compression
        enableCompression: true,
        compressionLevel: 6
    },
    
    // Resource limits
    resourceLimits: {
        // Memory limits per worker
        maxOldSpaceSize: 512, // MB
        maxYoungSpaceSize: 64, // MB
        
        // CPU limits
        cpuQuota: 80, // Percentage
        
        // File descriptor limits
        maxOpenFiles: 4096
    },
    
    // Optimization strategies
    optimizationStrategies: {
        // Use domain-specific strategies
        domainSpecific: {
            corporate: {
                useSMTP: false, // Skip SMTP for known corporate domains
                usePatternMatching: true,
                cacheResults: true
            },
            public: {
                useSMTP: true,
                rateLimit: true,
                batchSize: 5 // Smaller batches for public providers
            }
        },
        
        // Progressive enhancement
        progressiveEnhancement: {
            enabled: true,
            stages: [
                { threshold: 0, strategy: 'pattern' },
                { threshold: 100, strategy: 'mx' },
                { threshold: 50, strategy: 'smtp' }
            ]
        }
    }
};

// Helper function to get optimal settings based on system resources
function getOptimalSettings() {
    const cpus = os.cpus().length;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    const settings = {
        workers: Math.min(Math.max(2, Math.floor(cpus * 0.8)), 16),
        connectionPoolSize: Math.min(Math.max(10, cpus * 5), 50),
        batchSize: Math.min(Math.max(10, Math.floor(freeMemory / (100 * 1024 * 1024))), 50)
    };
    
    console.log(`🔧 Optimal settings calculated:`, settings);
    return settings;
}

module.exports.getOptimalSettings = getOptimalSettings;