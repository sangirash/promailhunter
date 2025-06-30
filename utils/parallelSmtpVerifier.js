// utils/parallelSmtpVerifier.js - Parallel SMTP verification using worker threads
const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

class ParallelSmtpVerifier extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        //this.maxWorkers = options.maxWorkers || Math.min(os.cpus().length, 8);
        this.maxWorkers = options.maxWorkers || 2;
        this.taskTimeout = options.taskTimeout || 30000;
        this.maxRetries = options.maxRetries || 1;
        
        // Worker pool
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        this.activeTasks = new Map();
        
        // Progress tracking
        this.progressTrackers = new Map();
        
        // Statistics
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            totalEmails: 0,
            verifiedEmails: 0
        };
        
        // Initialize worker pool
        this.initializeWorkers();
        
        console.log(`🚀 Parallel SMTP Verifier initialized with ${this.maxWorkers} workers`);
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
        
        console.log(`✅ ${this.workers.length} SMTP workers ready`);
    }
    
    /**
     * Create a worker thread with full SMTP verification
     */
    createWorker(workerId) {
        return new Promise((resolve, reject) => {
            // Worker code with SMTP verification
            const workerCode = `
                const { parentPort } = require('worker_threads');
                const dns = require('dns').promises;
                const net = require('net');
                
                // SMTP verification function
                async function verifyEmailSMTP(email, options = {}) {
                    const result = {
                        email,
                        finalResult: {
                            valid: false,
                            confidence: 'unknown',
                            mailboxTested: false,
                            mailboxExists: null,
                            reasons: []
                        },
                        checks: []
                    };
                    
                    try {
                        // Basic format check
                        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                        if (!emailRegex.test(email)) {
                            result.finalResult.reasons.push('Invalid email format');
                            result.finalResult.confidence = 'high';
                            return result;
                        }
                        
                        const [username, domain] = email.split('@');
                        
                        // MX record check
                        let mxValid = false;
                        let mxRecord = null;
                        try {
                            const mxRecords = await dns.resolveMx(domain);
                            if (mxRecords && mxRecords.length > 0) {
                                mxValid = true;
                                mxRecord = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
                                result.checks.push({ type: 'mx', valid: true, exchange: mxRecord });
                            }
                        } catch (error) {
                            result.checks.push({ type: 'mx', valid: false, error: error.message });
                            result.finalResult.reasons.push('Domain does not accept email (no MX records)');
                            result.finalResult.confidence = 'high';
                            return result;
                        }
                        
                        if (!mxValid || !mxRecord) {
                            result.finalResult.reasons.push('No MX records found');
                            result.finalResult.confidence = 'high';
                            return result;
                        }
                        
                        // Pattern check
                        const patterns = [
                            { regex: /^[a-z]+\\.[a-z]+$/, name: 'first.last', confidence: 'high' },
                            { regex: /^[a-z]+_[a-z]+$/, name: 'first_last', confidence: 'high' },
                            { regex: /^[a-z]\\.[a-z]+$/, name: 'f.last', confidence: 'high' },
                            { regex: /^[a-z]+$/, name: 'firstname', confidence: 'medium' },
                            { regex: /^[a-z]+[a-z]+$/, name: 'firstlast', confidence: 'medium' }
                        ];
                        
                        let patternMatch = null;
                        for (const pattern of patterns) {
                            if (pattern.regex.test(username.toLowerCase())) {
                                patternMatch = pattern;
                                result.checks.push({ type: 'pattern', valid: true, pattern: pattern.name });
                                break;
                            }
                        }
                        
                        // Skip SMTP for certain domains
                        const skipSMTPDomains = [
                            'microsoft.com', 'google.com', 'apple.com', 'amazon.com',
                            'salesforce.com', 'oracle.com', 'ibm.com', 'cisco.com'
                        ];
                        
                        if (skipSMTPDomains.includes(domain.toLowerCase())) {
                            result.finalResult.valid = mxValid && patternMatch !== null;
                            result.finalResult.confidence = patternMatch ? patternMatch.confidence : 'low';
                            result.finalResult.reasons.push('Corporate domain - SMTP skipped, using pattern matching');
                            result.finalResult.corporateBlocked = true;
                            return result;
                        }
                        
                        // SMTP verification
                        if (options.enableSMTP !== false) {
                            try {
                                const smtpResult = await checkSMTPMailbox(email, mxRecord);
                                result.checks.push({ type: 'smtp', ...smtpResult });
                                result.finalResult.mailboxTested = true;
                                result.finalResult.mailboxExists = smtpResult.mailboxExists;
                                
                                if (smtpResult.mailboxExists === true) {
                                    result.finalResult.valid = true;
                                    result.finalResult.confidence = 'high';
                                    result.finalResult.reasons.push('Mailbox confirmed to exist via SMTP');
                                } else if (smtpResult.mailboxExists === false) {
                                    result.finalResult.valid = false;
                                    result.finalResult.confidence = 'high';
                                    result.finalResult.reasons.push('Mailbox does not exist');
                                } else {
                                    // Inconclusive SMTP, use pattern matching
                                    result.finalResult.valid = patternMatch !== null;
                                    result.finalResult.confidence = patternMatch ? 'medium' : 'low';
                                    result.finalResult.reasons.push('SMTP inconclusive, using pattern matching');
                                }
                            } catch (smtpError) {
                                result.checks.push({ type: 'smtp', valid: false, error: smtpError.message });
                                // Fallback to pattern matching
                                result.finalResult.valid = patternMatch !== null;
                                result.finalResult.confidence = patternMatch ? 'medium' : 'low';
                                result.finalResult.reasons.push('SMTP failed, using pattern matching');
                            }
                        } else {
                            // No SMTP, use pattern matching
                            result.finalResult.valid = patternMatch !== null;
                            result.finalResult.confidence = patternMatch ? patternMatch.confidence : 'low';
                            result.finalResult.reasons.push('SMTP disabled, using pattern matching');
                        }
                        
                    } catch (error) {
                        result.finalResult.error = error.message;
                        result.finalResult.reasons.push('Verification error: ' + error.message);
                    }
                    
                    return result;
                }
                
                // SMTP mailbox check function
                function checkSMTPMailbox(email, mxRecord) {
                    return new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            resolve({ valid: null, mailboxExists: null, error: 'SMTP timeout' });
                        }, 15000); // 10 second timeout per email
                        
                        const client = new net.Socket();
                        let step = 0;
                        const result = { valid: false, mailboxExists: null };
                        
                        client.setTimeout(10000);
                        
                        client.connect(25, mxRecord, () => {
                            // Connected
                        });
                        
                        client.on('data', (data) => {
                            const response = data.toString().trim();
                            
                            switch (step) {
                                case 0: // Initial connection
                                    if (response.includes('220')) {
                                        client.write('HELO verify.local\\r\\n');
                                        step = 1;
                                    } else {
                                        client.destroy();
                                    }
                                    break;
                                    
                                case 1: // HELO response
                                    if (response.includes('250')) {
                                        client.write('MAIL FROM: <verify@verify.local>\\r\\n');
                                        step = 2;
                                    } else {
                                        client.destroy();
                                    }
                                    break;
                                    
                                case 2: // MAIL FROM response
                                    if (response.includes('250')) {
                                        client.write(\`RCPT TO: <\${email}>\\r\\n\`);
                                        step = 3;
                                    } else {
                                        client.destroy();
                                    }
                                    break;
                                    
                                case 3: // RCPT TO response - THE KEY CHECK
                                    if (response.includes('250') || response.includes('251')) {
                                        result.valid = true;
                                        result.mailboxExists = true;
                                    } else if (response.includes('550') && (
                                        response.toLowerCase().includes('user unknown') ||
                                        response.toLowerCase().includes('does not exist') ||
                                        response.toLowerCase().includes('invalid recipient')
                                    )) {
                                        result.valid = false;
                                        result.mailboxExists = false;
                                    } else {
                                        result.valid = null;
                                        result.mailboxExists = null;
                                    }
                                    client.write('QUIT\\r\\n');
                                    step = 4;
                                    break;
                                    
                                case 4: // QUIT
                                    client.destroy();
                                    break;
                            }
                        });
                        
                        client.on('error', (err) => {
                            result.error = err.message;
                            client.destroy();
                        });
                        
                        client.on('timeout', () => {
                            result.error = 'SMTP timeout';
                            client.destroy();
                        });
                        
                        client.on('close', () => {
                            clearTimeout(timeout);
                            resolve(result);
                        });
                    });
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
                        
                        // Process emails one by one with minimal delay
                        for (const email of emails) {
                            try {
                                const result = await verifyEmailSMTP(email, options);
                                results.push(result);
                                processedCount++;
                                
                                // Send progress update
                                parentPort.postMessage({
                                    type: 'progress',
                                    taskId,
                                    processed: processedCount,
                                    total: emails.length
                                });
                                
                                // Minimal delay between verifications (500ms)
                                if (processedCount < emails.length) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            } catch (error) {
                                results.push({
                                    email,
                                    finalResult: {
                                        valid: false,
                                        confidence: 'unknown',
                                        error: error.message
                                    }
                                });
                            }
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
     * Verify emails in parallel with SMTP
     */
    async verifyEmails(emails, options = {}) {
        const {
            //batchSize = Math.ceil(emails.length / this.maxWorkers),
            batchSize = Math.min(5, Math.ceil(emails.length / (this.maxWorkers * 4))),
            progressCallback = null,
            connectionId = null,
            ...verificationOptions
        } = options;
        
        console.log(`🔄 Starting parallel SMTP verification of ${emails.length} emails with ${this.maxWorkers} workers`);
        console.log(`📦 Batch size: ${batchSize} emails per worker`);
        
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
        
        // Split emails into batches for each worker
        const batches = [];
        for (let i = 0; i < emails.length; i += batchSize) {
            batches.push(emails.slice(i, i + batchSize));
        }
        
        console.log(`📦 Created ${batches.length} batches for parallel processing`);
        
        // Process batches in parallel
        const batchPromises = batches.map((batch, index) => 
            this.processBatch(batch, {
                ...verificationOptions,
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
        
        const duration = Date.now() - startTime;
        const validCount = results.filter(r => r.finalResult?.valid === true).length;
        const testedCount = results.filter(r => r.finalResult?.mailboxTested === true).length;
        
        console.log(`✅ Parallel SMTP verification complete:`);
        console.log(`   - Total: ${results.length} emails`);
        console.log(`   - Valid: ${validCount}`);
        console.log(`   - SMTP tested: ${testedCount}`);
        console.log(`   - Duration: ${(duration/1000).toFixed(1)}s`);
        console.log(`   - Speed: ${(emails.length / (duration/1000)).toFixed(1)} emails/second`);
        
        return results;
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
                options: verificationOptions,
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
        
        // Update overall progress
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
        
        console.log(`✅ Batch ${taskId} completed in ${(message.duration/1000).toFixed(1)}s`);
        
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
     * Get status
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
            }
        };
    }
    
    /**
     * Shutdown
     */
    async shutdown() {
        console.log('🛑 Shutting down parallel SMTP verifier...');
        
        this.taskQueue = [];
        this.progressTrackers.clear();
        
        await Promise.all(this.workers.map(worker => worker.terminate()));
        
        this.workers = [];
        this.availableWorkers = [];
        this.activeTasks.clear();
        
        console.log('✅ Parallel SMTP verifier shutdown complete');
    }
}

// Create singleton instance
const parallelSmtpVerifier = new ParallelSmtpVerifier({
    //maxWorkers: Math.min(os.cpus().length, 8),
    maxWorkers: 2,
    taskTimeout: 120000 // 60 seconds per batch
});

module.exports = parallelSmtpVerifier;