// utils/connectionPoolManager.js
const EventEmitter = require('events');

class ConnectionPoolManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.maxConcurrentUsers = options.maxConcurrentUsers || 20;
        this.maxConnectionsPerUser = options.maxConnectionsPerUser || 5;
        this.queueTimeout = options.queueTimeout || 60000; // 60 seconds
        this.cleanupInterval = options.cleanupInterval || 5000; // 5 seconds
        
        // State management
        this.activeConnections = new Map(); // userId -> connection info
        this.waitingQueue = [];
        this.connectionStats = {
            totalRequests: 0,
            activeRequests: 0,
            queuedRequests: 0,
            completedRequests: 0,
            failedRequests: 0,
            avgProcessingTime: 0,
            processingTimes: []
        };
        
        // Start cleanup timer
        this.startCleanupTimer();
        
        console.log(`🔧 Connection Pool Manager initialized - Max users: ${this.maxConcurrentUsers}`);
    }
    
    /**
     * Request a connection slot
     */
    async requestConnection(userId, requestId, estimatedDuration = 30000) {
        this.connectionStats.totalRequests++;
        
        const request = {
            userId,
            requestId,
            timestamp: Date.now(),
            estimatedDuration,
            status: 'pending'
        };
        
        // Check if user already has active connections
        const userConnections = this.getUserConnectionCount(userId);
        
        // Check total active connections
        const totalActive = this.getTotalActiveConnections();
        
        console.log(`📊 Connection request from ${userId}: Active users: ${this.activeConnections.size}/${this.maxConcurrentUsers}, User connections: ${userConnections}/${this.maxConnectionsPerUser}`);
        
        // Can we allocate immediately?
        if (this.activeConnections.size < this.maxConcurrentUsers && userConnections < this.maxConnectionsPerUser) {
            return this.allocateConnection(request);
        }
        
        // Add to queue
        return this.queueRequest(request);
    }
    
    /**
     * Allocate a connection slot
     */
    allocateConnection(request) {
        if (!this.activeConnections.has(request.userId)) {
            this.activeConnections.set(request.userId, []);
        }
        
        const connection = {
            ...request,
            status: 'active',
            startTime: Date.now(),
            connectionId: `${request.userId}-${request.requestId}-${Date.now()}`
        };
        
        this.activeConnections.get(request.userId).push(connection);
        this.connectionStats.activeRequests++;
        
        console.log(`✅ Connection allocated for ${request.userId} (${connection.connectionId})`);
        
        this.emit('connectionAllocated', connection);
        
        return {
            success: true,
            connectionId: connection.connectionId,
            position: 0,
            estimatedWait: 0,
            message: 'Connection allocated successfully'
        };
    }
    
    /**
     * Queue a request
     */
    async queueRequest(request) {
        this.waitingQueue.push(request);
        this.connectionStats.queuedRequests++;
        
        const position = this.waitingQueue.length;
        const estimatedWait = this.estimateWaitTime(position);
        
        console.log(`⏳ Request queued for ${request.userId} - Position: ${position}, Est. wait: ${estimatedWait}s`);
        
        this.emit('requestQueued', {
            ...request,
            position,
            estimatedWait
        });
        
        // Set up timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                this.removeFromQueue(request.requestId);
                reject(new Error('Queue timeout - please try again'));
            }, this.queueTimeout);
        });
        
        // Set up queue processing promise
        const queuePromise = new Promise((resolve) => {
            const checkQueue = setInterval(() => {
                const index = this.waitingQueue.findIndex(r => r.requestId === request.requestId);
                
                if (index === -1) {
                    // Request was processed or removed
                    clearInterval(checkQueue);
                    
                    // Check if it's now active
                    const isActive = this.isRequestActive(request.userId, request.requestId);
                    if (isActive) {
                        const connection = this.getConnection(request.userId, request.requestId);
                        resolve({
                            success: true,
                            connectionId: connection.connectionId,
                            position: 0,
                            estimatedWait: 0,
                            message: 'Connection allocated from queue'
                        });
                    }
                }
            }, 1000); // Check every second
        });
        
        // Return queue status immediately with promise for allocation
        return {
            success: false,
            queued: true,
            position,
            estimatedWait,
            totalInQueue: this.waitingQueue.length,
            activeUsers: this.activeConnections.size,
            message: `You are #${position} in queue. Estimated wait: ${estimatedWait} seconds`,
            allocationPromise: Promise.race([queuePromise, timeoutPromise])
        };
    }
    
    /**
     * Release a connection
     */
    releaseConnection(userId, connectionId) {
        const userConnections = this.activeConnections.get(userId);
        if (!userConnections) return false;
        
        const index = userConnections.findIndex(c => c.connectionId === connectionId);
        if (index === -1) return false;
        
        const connection = userConnections[index];
        const duration = Date.now() - connection.startTime;
        
        // Update stats
        this.connectionStats.completedRequests++;
        this.connectionStats.activeRequests--;
        this.connectionStats.processingTimes.push(duration);
        if (this.connectionStats.processingTimes.length > 100) {
            this.connectionStats.processingTimes.shift();
        }
        this.connectionStats.avgProcessingTime = this.calculateAverage(this.connectionStats.processingTimes);
        
        // Remove connection
        userConnections.splice(index, 1);
        if (userConnections.length === 0) {
            this.activeConnections.delete(userId);
        }
        
        console.log(`🔓 Connection released for ${userId} (${connectionId}) - Duration: ${(duration/1000).toFixed(1)}s`);
        
        this.emit('connectionReleased', {
            ...connection,
            duration
        });
        
        // Process waiting queue
        this.processQueue();
        
        return true;
    }
    
    /**
     * Process waiting queue
     */
    processQueue() {
        if (this.waitingQueue.length === 0) return;
        
        const availableSlots = this.maxConcurrentUsers - this.activeConnections.size;
        if (availableSlots <= 0) return;
        
        // Process as many queued requests as possible
        const toProcess = Math.min(availableSlots, this.waitingQueue.length);
        
        for (let i = 0; i < toProcess; i++) {
            const request = this.waitingQueue.shift();
            if (request) {
                this.connectionStats.queuedRequests--;
                this.allocateConnection(request);
            }
        }
    }
    
    /**
     * Get user connection count
     */
    getUserConnectionCount(userId) {
        const connections = this.activeConnections.get(userId);
        return connections ? connections.length : 0;
    }
    
    /**
     * Get total active connections
     */
    getTotalActiveConnections() {
        let total = 0;
        for (const connections of this.activeConnections.values()) {
            total += connections.length;
        }
        return total;
    }
    
    /**
     * Check if request is active
     */
    isRequestActive(userId, requestId) {
        const connections = this.activeConnections.get(userId);
        if (!connections) return false;
        return connections.some(c => c.requestId === requestId);
    }
    
    /**
     * Get connection info
     */
    getConnection(userId, requestId) {
        const connections = this.activeConnections.get(userId);
        if (!connections) return null;
        return connections.find(c => c.requestId === requestId);
    }
    
    /**
     * Remove from queue
     */
    removeFromQueue(requestId) {
        const index = this.waitingQueue.findIndex(r => r.requestId === requestId);
        if (index !== -1) {
            this.waitingQueue.splice(index, 1);
            this.connectionStats.queuedRequests--;
            return true;
        }
        return false;
    }
    
    /**
     * Estimate wait time based on queue position
     */
    estimateWaitTime(position) {
        // Use average processing time to estimate
        const avgTime = this.connectionStats.avgProcessingTime || 30000; // Default 30s
        const concurrentProcessing = this.maxConcurrentUsers;
        
        // Estimate based on position and processing capacity
        const estimatedSeconds = Math.ceil((position * avgTime) / (concurrentProcessing * 1000));
        return Math.min(estimatedSeconds, 60); // Cap at 60 seconds
    }
    
    /**
     * Calculate average
     */
    calculateAverage(arr) {
        if (arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    
    /**
     * Get pool status
     */
    getPoolStatus() {
        return {
            activeUsers: this.activeConnections.size,
            totalActiveConnections: this.getTotalActiveConnections(),
            queueLength: this.waitingQueue.length,
            maxConcurrentUsers: this.maxConcurrentUsers,
            stats: {
                ...this.connectionStats,
                avgProcessingTimeSeconds: (this.connectionStats.avgProcessingTime / 1000).toFixed(1)
            },
            isFull: this.activeConnections.size >= this.maxConcurrentUsers,
            availableSlots: Math.max(0, this.maxConcurrentUsers - this.activeConnections.size)
        };
    }
    
    /**
     * Clean up stale connections
     */
    cleanupStaleConnections() {
        const now = Date.now();
        const maxConnectionTime = 300000; // 5 minutes max
        
        let cleaned = 0;
        
        for (const [userId, connections] of this.activeConnections.entries()) {
            const staleConnections = connections.filter(c => 
                (now - c.startTime) > maxConnectionTime
            );
            
            staleConnections.forEach(connection => {
                console.log(`🧹 Cleaning stale connection: ${connection.connectionId}`);
                this.releaseConnection(userId, connection.connectionId);
                cleaned++;
            });
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} stale connections`);
        }
    }
    
    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupStaleConnections();
        }, this.cleanupInterval);
    }
}

// Create singleton instance
const connectionPool = new ConnectionPoolManager({
    //maxConcurrentUsers: 20,
    maxConcurrentUsers: 15,
    maxConnectionsPerUser: 5,
    queueTimeout: 60000
});

module.exports = connectionPool;