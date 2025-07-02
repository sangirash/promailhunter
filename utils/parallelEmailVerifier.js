// utils/parallelEmailVerifier.js - Fixed version without function passing to workers
const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

class ParallelEmailVerifier extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.maxWorkers = options.maxWorkers || Math.min(os.cpus().length, 10);
        //this.maxWorkers = options.maxWorkers || 2;
        this.taskTimeout = options.taskTimeout || 30000; // 30 seconds per task
        this.maxRetries = options.maxRetries || 2;
        
        // Worker pool
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        this.activeTasks = new Map();
        
        // Progress tracking
        this.progressTrackers = new Map(); // Track progress by connectionId
        
        // Statistics
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            totalEmails: 0,
            verifiedEmails: 0,
            avgTaskTime: 0,
            taskTimes: []
        };
        
        // Initialize worker pool
        this.initializeWorkers();
        
        console.log(`🚀 Parallel Email Verifier initialized with ${this.maxWorkers} workers`);
    }
    
    /**
     * Initialize worker threads
     */
    async initializeWorkers() {
        for (let i = 0; i < this.maxWorkers; i++) {
            try {
                const worker = await this.createWorker(i);
                this.workers.push(worker);
                this.availableWorkers.push(worker);
            } catch (error) {
                console.error(`Failed to create worker ${i}:`, error);
            }
        }
        
        console.log(`✅ ${this.workers.length} workers ready`);
    }
    
    /**
     * Create a worker thread
     */
    createWorker(workerId) {
        return new Promise((resolve, reject) => {
            // Create worker with verification logic
            const workerCode = `
                const { parentPort } = require('worker_threads');
                const dns = require('dns').promises;
                const net = require('net');
                
                // Simple email verification function for worker
                async function verifyEmail(email, options = {}) {
                    const result = {
                        email,
                        valid: false,
                        confidence: 'unknown',
                        checks: [],
                        error: null
                    };
                    
                    try {
                        // Basic format check
                        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                        if (!emailRegex.test(email)) {
                            result.error = 'Invalid format';
                            return result;
                        }
                        
                        const [username, domain] = email.split('@');
                        
                        // MX record check
                        try {
                            const mxRecords = await dns.resolveMx(domain);
                            if (mxRecords && mxRecords.length > 0) {
                                result.checks.push({ type: 'mx', valid: true });
                                result.valid = true;
                                result.confidence = 'medium';
                            } else {
                                result.checks.push({ type: 'mx', valid: false });
                            }
                        } catch (error) {
                            result.checks.push({ type: 'mx', valid: false, error: error.message });
                        }
                        
                        // Pattern matching (simple version)
                        const patterns = [
                            /^[a-z]+\\.[a-z]+$/, // first.last
                            /^[a-z]+_[a-z]+$/,   // first_last
                            /^[a-z]+$/,          // firstname
                            /^[a-z]\\.[a-z]+$/   // f.last
                        ];
                        
                        const hasGoodPattern = patterns.some(p => p.test(username.toLowerCase()));
                        if (hasGoodPattern) {
                            result.checks.push({ type: 'pattern', valid: true });
                            if (result.valid) result.confidence = 'high';
                        }
                        
                    } catch (error) {
                        result.error = error.message;
                    }
                    
                    return result;
                }
                
                // Handle messages from main thread
                parentPort.on('message', async ({ taskId, emails, options }) => {
                    const startTime = Date.now();
                    const results = [];
                    let processedCount = 0;
                    
                    try {
                        // Send initial progress
                        parentPort.postMessage({
                            type: 'progress',
                            taskId,
                            processed: 0,
                            total: emails.length
                        });
                        
                        // Process emails in parallel within worker
                        const batchSize = 5; // Process 5 at a time within worker
                        for (let i = 0; i < emails.length; i += batchSize) {
                            const batch = emails.slice(i, i + batchSize);
                            const promises = batch.map(email => 
                                verifyEmail(email, options).catch(err => ({
                                    email,
                                    valid: false,
                                    error: err.message
                                }))
                            );
                            
                            const batchResults = await Promise.all(promises);
                            results.push(...batchResults);
                            processedCount += batch.length;
                            
                            // Send progress update
                            parentPort.postMessage({
                                type: 'progress',
                                taskId,
                                processed: processedCount,
                                total: emails.length
                            });
                        }
                        
                        // Send final results
                        parentPort.postMessage({
                            type: 'complete',
                            taskId,
                            success: true,
                            results,
                            duration: Date.now() - startTime
                        });
                    } catch (error) {
                        parentPort.postMessage({
                            type: 'error',
                            taskId,
                            success: false,
                            error: error.message,
                            duration: Date.now() - startTime
                        });
                    }
                });
            `;
            
            const worker = new Worker(workerCode, { eval: true });
            
            worker.on('error', (error) => {
                console.error(`Worker ${workerId} error:`, error);
                this.handleWorkerError(worker, error);
            });
            
            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`Worker ${workerId} exited with code ${code}`);
                    this.handleWorkerExit(worker);
                }
            });
            
            worker.workerId = workerId;
            worker.busy = false;
            
            resolve(worker);
        });
    }
    
    /**
     * Verify emails in parallel
     */
    async verifyEmails(emails, options = {}) {
        const {
            batchSize = 10,
            progressCallback = null,
            connectionId = null,
            ...verificationOptions // Extract remaining options without callback
        } = options;
        
        console.log(`🔄 Starting parallel verification of ${emails.length} emails`);
        
        // Store progress callback if provided
        if (progressCallback && connectionId) {
            this.progressTrackers.set(connectionId, {
                callback: progressCallback,
                total: emails.length,
                completed: 0
            });
        }
        
        const startTime = Date.now();
        const results = [];
        let completed = 0;
        
        // Split emails into batches
        const batches = [];
        for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
        }
        
        console.log(`📦 Split into ${batches.length} batches of up to ${batchSize} emails each`);
        
        // Process batches in parallel - ONLY pass safe options
        const batchPromises = batches.map((batch, index) => 
            this.processBatch(batch, {
                ...verificationOptions, // Only serializable options
                batchIndex: index,
                totalBatches: batches.length,
                connectionId
            })
        );
        
        // Wait for all batches to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Combine results
        batchResults.forEach(batchResult => {
            results.push(...batchResult);
        });
        
        // Clean up progress tracker
        if (connectionId) {
            this.progressTrackers.delete(connectionId);
        }
        
        // Update statistics
        const duration = Date.now() - startTime;
        this.updateStats(emails.length, results, duration);
        
        console.log(`✅ Parallel verification complete: ${results.length} emails in ${(duration/1000).toFixed(1)}s`);
        
        return {
            results,
            summary: this.generateSummary(results),
            performance: {
                totalEmails: emails.length,
                duration,
                emailsPerSecond: (emails.length / (duration / 1000)).toFixed(1),
                workersUsed: this.workers.length,
                batchesProcessed: batches.length
            }
        };
    }
    
    /**
     * Process a batch of emails
     */
    async processBatch(emails, options) {
        const {
            batchIndex,
            totalBatches,
            connectionId,
            ...verificationOptions
        } = options;
        
        return new Promise((resolve, reject) => {
            const task = {
                id: `batch-${batchIndex}-${Date.now()}`,
                emails,
                options: verificationOptions, // Only safe, serializable options
                retries: 0,
                resolve,
                reject,
                connectionId,
                startTime: Date.now()
            };
            
            // Add to queue
            this.taskQueue.push(task);
            this.stats.totalTasks++;
            
            // Try to assign to worker
            this.assignTaskToWorker();
        });
    }
    
    /**
     * Assign task to available worker
     */
    assignTaskToWorker() {
        if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
            return;
        }
        
        const task = this.taskQueue.shift();
        const worker = this.availableWorkers.shift();
        
        worker.busy = true;
        this.activeTasks.set(task.id, { worker, task });
        
        console.log(`👷 Worker ${worker.workerId} processing batch ${task.id} (${task.emails.length} emails)`);
        
        // Set up timeout
        const timeout = setTimeout(() => {
            this.handleTaskTimeout(task.id);
        }, this.taskTimeout);
        
        // Send task to worker
        worker.postMessage({
            taskId: task.id,
            emails: task.emails,
            options: task.options
        });
        
        // Handle worker messages
        const messageHandler = (message) => {
            if (message.taskId !== task.id) return;
            
            switch (message.type) {
                case 'progress':
                    this.handleTaskProgress(task.id, message);
                    break;
                    
                case 'complete':
                    clearTimeout(timeout);
                    worker.removeListener('message', messageHandler);
                    this.handleTaskComplete(task.id, message);
                    break;
                    
                case 'error':
                    clearTimeout(timeout);
                    worker.removeListener('message', messageHandler);
                    this.handleTaskError(task.id, message);
                    break;
            }
        };
        
        worker.on('message', messageHandler);
    }
    
    /**
     * Handle task progress updates
     */
    handleTaskProgress(taskId, message) {
        const activeTask = this.activeTasks.get(taskId);
        if (!activeTask || !activeTask.task.connectionId) return;
        
        const tracker = this.progressTrackers.get(activeTask.task.connectionId);
        if (!tracker) return;
        
        // Update progress
        const overallProgress = {
            completed: tracker.completed + message.processed,
            total: tracker.total,
            percentage: Math.round(((tracker.completed + message.processed) / tracker.total) * 100),
            currentBatch: taskId
        };
        
        // Call the callback
        if (tracker.callback) {
            try {
                tracker.callback(overallProgress);
            } catch (error) {
                console.error('Progress callback error:', error);
            }
        }
    }
    
    /**
     * Handle task completion
     */
    handleTaskComplete(taskId, message) {
        const activeTask = this.activeTasks.get(taskId);
        if (!activeTask) return;
        
        const { worker, task } = activeTask;
        
        // Mark worker as available
        worker.busy = false;
        this.availableWorkers.push(worker);
        this.activeTasks.delete(taskId);
        
        // Update progress tracker
        if (task.connectionId) {
            const tracker = this.progressTrackers.get(task.connectionId);
            if (tracker) {
                tracker.completed += task.emails.length;
            }
        }
        
        // Update stats
        this.stats.completedTasks++;
        this.stats.taskTimes.push(message.duration);
        if (this.stats.taskTimes.length > 100) {
            this.stats.taskTimes.shift();
        }
        
        console.log(`✅ Batch ${taskId} completed in ${message.duration}ms`);
        
        task.resolve(message.results);
        
        // Process next task
        this.assignTaskToWorker();
    }
    
    /**
     * Handle task error
     */
    handleTaskError(taskId, message) {
        const activeTask = this.activeTasks.get(taskId);
        if (!activeTask) return;
        
        const { worker, task } = activeTask;
        
        // Mark worker as available
        worker.busy = false;
        this.availableWorkers.push(worker);
        this.activeTasks.delete(taskId);
        
        // Retry if possible
        if (task.retries < this.maxRetries) {
            task.retries++;
            console.log(`🔄 Retrying batch ${taskId} (attempt ${task.retries + 1})`);
            this.taskQueue.unshift(task);
            this.assignTaskToWorker();
        } else {
            this.stats.failedTasks++;
            console.error(`❌ Batch ${taskId} failed after ${task.retries + 1} attempts`);
            task.reject(new Error(message.error || 'Task failed'));
        }
    }
    
    /**
     * Handle task timeout
     */
    handleTaskTimeout(taskId) {
        const activeTask = this.activeTasks.get(taskId);
        if (!activeTask) return;
        
        const { worker, task } = activeTask;
        
        console.error(`⏱️ Task ${taskId} timed out`);
        
        // Terminate and recreate worker
        worker.terminate();
        this.workers = this.workers.filter(w => w !== worker);
        this.activeTasks.delete(taskId);
        
        // Create replacement worker
        this.createWorker(worker.workerId).then(newWorker => {
            this.workers.push(newWorker);
            this.availableWorkers.push(newWorker);
            console.log(`🔧 Replaced worker ${worker.workerId}`);
        });
        
        // Retry task
        if (task.retries < this.maxRetries) {
            task.retries++;
            this.taskQueue.unshift(task);
            this.assignTaskToWorker();
        } else {
            this.stats.failedTasks++;
            task.reject(new Error('Task timeout'));
        }
    }
    
    /**
     * Handle worker error
     */
    handleWorkerError(worker, error) {
        // Find and fail any active tasks for this worker
        for (const [taskId, activeTask] of this.activeTasks.entries()) {
            if (activeTask.worker === worker) {
                this.handleTaskTimeout(taskId);
            }
        }
    }
    
    /**
     * Handle worker exit
     */
    handleWorkerExit(worker) {
        this.workers = this.workers.filter(w => w !== worker);
        this.availableWorkers = this.availableWorkers.filter(w => w !== worker);
        
        // Create replacement
        this.createWorker(worker.workerId).then(newWorker => {
            this.workers.push(newWorker);
            this.availableWorkers.push(newWorker);
        });
    }
    
    /**
     * Update statistics
     */
    updateStats(emailCount, results, duration) {
        this.stats.totalEmails += emailCount;
        this.stats.verifiedEmails += results.length;
        this.stats.avgTaskTime = this.stats.taskTimes.length > 0
            ? this.stats.taskTimes.reduce((a, b) => a + b, 0) / this.stats.taskTimes.length
            : 0;
    }
    
    /**
     * Generate summary
     */
    generateSummary(results) {
        const valid = results.filter(r => r.valid).length;
        const invalid = results.filter(r => !r.valid).length;
        
        return {
            total: results.length,
            valid,
            invalid,
            validPercentage: results.length > 0 ? ((valid / results.length) * 100).toFixed(1) : 0,
            byConfidence: {
                high: results.filter(r => r.confidence === 'high').length,
                medium: results.filter(r => r.confidence === 'medium').length,
                low: results.filter(r => r.confidence === 'low').length,
                unknown: results.filter(r => r.confidence === 'unknown').length
            }
        };
    }
    
    /**
     * Get worker pool status
     */
    getStatus() {
        return {
            workers: {
                total: this.workers.length,
                available: this.availableWorkers.length,
                busy: this.workers.length - this.availableWorkers.length
            },
            tasks: {
                queued: this.taskQueue.length,
                active: this.activeTasks.size,
                completed: this.stats.completedTasks,
                failed: this.stats.failedTasks
            },
            performance: {
                avgTaskTime: `${(this.stats.avgTaskTime / 1000).toFixed(1)}s`,
                totalEmailsProcessed: this.stats.totalEmails,
                successRate: this.stats.totalTasks > 0
                    ? ((this.stats.completedTasks / this.stats.totalTasks) * 100).toFixed(1) + '%'
                    : '0%'
            }
        };
    }
    
    /**
     * Shutdown workers
     */
    async shutdown() {
        console.log('🛑 Shutting down parallel verifier...');
        
        // Clear task queue
        this.taskQueue = [];
        
        // Clear progress trackers
        this.progressTrackers.clear();
        
        // Terminate all workers
        await Promise.all(this.workers.map(worker => worker.terminate()));
        
        this.workers = [];
        this.availableWorkers = [];
        this.activeTasks.clear();
        
        console.log('✅ Parallel verifier shutdown complete');
    }
}

// Create singleton instance
const parallelVerifier = new ParallelEmailVerifier({
    maxWorkers: Math.min(os.cpus().length, 10),
    //maxWorkers: 2,
    taskTimeout: 30000
});

module.exports = parallelVerifier;