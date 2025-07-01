// public/js/app.js - Complete integrated version with all features
class ProMailHunterApp {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.verifyBtn = document.getElementById('verifyBtn');
        this.resultContainer = document.getElementById('result');
        this.resultContent = document.getElementById('resultContent');
        this.domainValidator = document.getElementById('domainValidator');
        this.validationIcon = document.getElementById('validationIcon');
        this.validationMessage = document.getElementById('validationMessage');
        this.domainRestrictionNote = document.getElementById('domainRestrictionNote');

        this.domainValidationTimer = null;
        this.lastValidatedDomain = null;
        this.lastDomainValidation = null;
        this.queueCheckInterval = null;
        this.currentRequestId = null;
        this.poolStatusInterval = null;

        this.genericDomains = [
            'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'aol.com',
            'icloud.com', 'protonmail.com', 'zoho.com', 'mail.com', 'gmx.com'
        ];

        this.init();
        this.addCapacityStyles();
        this.checkPoolStatus();
    }

    init() {
        this.verifyBtn.addEventListener('click', this.handleGenerateAndVerify.bind(this));
        this.addRealTimeValidation();

        const companyInput = document.getElementById('companyName');
        companyInput.addEventListener('input', this.handleDomainInputChange.bind(this));
        companyInput.addEventListener('blur', this.handleDomainInputChange.bind(this));

        this.updateButtonStates();
        const inputs = this.form.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updateButtonStates());
        });

        // Check pool status periodically
        this.poolStatusInterval = setInterval(() => this.checkPoolStatus(), 60000);
    }

    addCapacityStyles() {
        if (!document.getElementById('capacityWarningStyles')) {
            const style = document.createElement('style');
            style.id = 'capacityWarningStyles';
            style.textContent = `
                .capacity-warning {
                    background: #fff3cd;
                    border: 2px solid #ffc107;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                    text-align: center;
                    animation: slideDown 0.3s ease-out;
                }
                
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .capacity-warning .warning-icon {
                    font-size: 48px;
                    margin-bottom: 10px;
                }
                
                .capacity-warning h3 {
                    color: #856404;
                    margin: 10px 0;
                }
                
                .capacity-warning p {
                    color: #856404;
                    margin: 10px 0;
                }
                
                .queue-info {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    margin: 15px 0;
                    font-size: 14px;
                    color: #856404;
                }
                
                .retry-timer {
                    margin-top: 15px;
                    font-weight: bold;
                    color: #856404;
                }
                
                .form-wrapper.disabled {
                    opacity: 0.5;
                    pointer-events: none;
                }
                
                .queue-status {
                    background: #d1ecf1;
                    border: 1px solid #bee5eb;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                
                .queue-status h4 {
                    color: #0c5460;
                    margin: 0 0 10px 0;
                }
                
                .queue-progress {
                    background: #e9ecef;
                    border-radius: 10px;
                    height: 20px;
                    margin: 10px 0;
                    overflow: hidden;
                }
                
                .queue-progress-bar {
                    background: #007bff;
                    height: 100%;
                    width: 0%;
                    transition: width 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                }
                
                .verification-progress {
                    text-align: center;
                    padding: 40px 20px;
                }
                
                .progress-spinner {
                    display: inline-block;
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 20px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .email-results-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    background: #fff;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .email-results-table th {
                    background: #f8f9fa;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    border-bottom: 2px solid #dee2e6;
                }
                
                .email-results-table td {
                    padding: 12px;
                    border-bottom: 1px solid #dee2e6;
                }
                
                .email-results-table tr:last-child td {
                    border-bottom: none;
                }
                
                .email-results-table tr:hover {
                    background: #f8f9fa;
                }
                
                .probability-cell {
                    font-weight: 600;
                    text-align: center;
                }
                
                .probability-high {
                    color: #28a745;
                }
                
                .probability-medium {
                    color: #ffc107;
                }
                
                .probability-low {
                    color: #dc3545;
                }
                
                .email-cell {
                    font-family: monospace;
                    font-size: 14px;
                }
                
                .copy-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 4px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background 0.2s;
                }
                
                .copy-btn:hover {
                    background: #0056b3;
                }
                
                .no-results-message {
                    text-align: center;
                    padding: 30px;
                    color: #6c757d;
                    font-style: italic;
                }
                
                .action-btn.loading .spinner {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top: 2px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-left: 5px;
                    vertical-align: middle;
                }
            `;
            document.head.appendChild(style);
        }
    }

    async checkPoolStatus() {
        try {
            const response = await fetch('/api/pool-status');
            const data = await response.json();
            
            if (data.pool.isFull) {
                this.showCapacityWarning(data.pool);
            } else {
                this.hideCapacityWarning();
            }
        } catch (error) {
            console.error('Failed to check pool status:', error);
        }
    }

    showCapacityWarning(poolStatus) {
        // Disable form
        this.form.classList.add('disabled');
        const inputs = this.form.querySelectorAll('input, button');
        inputs.forEach(input => input.disabled = true);

        // Show warning message
        let warningDiv = document.getElementById('capacityWarning');
        if (!warningDiv) {
            warningDiv = document.createElement('div');
            warningDiv.id = 'capacityWarning';
            warningDiv.className = 'capacity-warning';
            this.form.parentNode.insertBefore(warningDiv, this.form);
        }

        warningDiv.innerHTML = `
            <div class="warning-icon">⚠️</div>
            <h3>Server at Full Capacity</h3>
            <p>We are experiencing heavy load with <strong>${poolStatus.activeUsers}</strong> users running queries simultaneously.</p>
            <p>Please wait for approximately <strong>60 seconds</strong> before trying again.</p>
            <div class="queue-info">
                <span>Queue length: ${poolStatus.queueLength}</span>
                <span>•</span>
                <span>Active connections: ${poolStatus.totalActiveConnections}</span>
            </div>
            <div class="retry-timer" id="retryTimer">Checking availability...</div>
        `;
    }

    hideCapacityWarning() {
        const warningDiv = document.getElementById('capacityWarning');
        if (warningDiv) {
            warningDiv.remove();
        }
        
        this.form.classList.remove('disabled');
        this.updateButtonStates();
    }

    showQueueStatus(queueInfo) {
        this.resultContainer.style.display = 'block';
        this.resultContent.innerHTML = `
            <div class="queue-status">
                <h4>🕐 You're in Queue</h4>
                <p>Position: <strong>#${queueInfo.position}</strong> of ${queueInfo.totalInQueue}</p>
                <p>Estimated wait: <strong>${queueInfo.estimatedWait} seconds</strong></p>
                <div class="queue-progress">
                    <div class="queue-progress-bar" style="width: ${((queueInfo.totalInQueue - queueInfo.position + 1) / queueInfo.totalInQueue * 100)}%">
                        ${Math.round((queueInfo.totalInQueue - queueInfo.position + 1) / queueInfo.totalInQueue * 100)}%
                    </div>
                </div>
                <p class="queue-message">${queueInfo.message}</p>
                <p><small>We'll process your request as soon as possible</small></p>
            </div>
        `;

        // Start checking queue position
        if (this.currentRequestId) {
            this.startQueuePositionCheck();
        }
    }

    startQueuePositionCheck() {
        if (this.queueCheckInterval) {
            clearInterval(this.queueCheckInterval);
        }

        this.queueCheckInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/queue-status/${this.currentRequestId}`);
                const data = await response.json();

                if (!data.inQueue) {
                    clearInterval(this.queueCheckInterval);
                    console.log('Request no longer in queue, should be processing...');
                } else {
                    // Update queue position display
                    const progressBar = document.querySelector('.queue-progress-bar');
                    if (progressBar) {
                        const percentage = ((data.totalInQueue - data.position + 1) / data.totalInQueue * 100);
                        progressBar.style.width = `${percentage}%`;
                        progressBar.textContent = `${Math.round(percentage)}%`;
                    }
                }
            } catch (error) {
                console.error('Failed to check queue status:', error);
            }
        }, 2000); // Check every 2 seconds
    }

    updateButtonStates() {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const companyName = document.getElementById('companyName').value.trim();
        
        const domain = this.extractDomain(companyName);
        const isValidDomainFormat = this.isValidDomainFormat(companyName);
        const isCorporateDomain = domain && !this.isGenericDomain(domain);
        
        // Check if domain has been validated and can receive emails
        const isDomainValidated = this.lastDomainValidation && 
                                 this.lastDomainValidation.domain === domain && 
                                 this.lastDomainValidation.canReceiveEmail;
        
        const allFieldsValid = firstName && 
                              lastName && 
                              companyName && 
                              isValidDomainFormat && 
                              isCorporateDomain &&
                              isDomainValidated; // New requirement: domain must be validated and can receive emails
        
        // Check if form is disabled due to capacity
        const formDisabled = this.form.classList.contains('disabled');
        
        this.verifyBtn.disabled = !allFieldsValid || formDisabled;

        if (companyName && !isValidDomainFormat) {
            this.showDomainRestrictionNote('Please add a valid domain variation such as .com, .org, or .co');
        } else if (companyName && isValidDomainFormat && !isCorporateDomain) {
            this.showDomainRestrictionNote('This search is specifically for corporate domains only, kindly enter a corporate domain');
        } else if (companyName && isValidDomainFormat && isCorporateDomain && !isDomainValidated) {
            this.showDomainRestrictionNote('Validating domain... Please wait for domain to be validated');
        } else {
            this.clearDomainRestrictionNote();
        }
    }

    isValidDomainFormat(input) {
        const domain = this.extractDomain(input);
        return domain && /\.[a-zA-Z]{2,}$/.test(domain);
    }

    isGenericDomain(domain) {
        return this.genericDomains.includes(domain.toLowerCase());
    }

    showDomainRestrictionNote(message) {
        this.domainRestrictionNote.textContent = message;
        this.domainRestrictionNote.classList.add('show');
    }

    clearDomainRestrictionNote() {
        this.domainRestrictionNote.textContent = '';
        this.domainRestrictionNote.classList.remove('show');
    }

    addRealTimeValidation() {
        const inputs = this.form.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearError(input));
        });
    }

    handleDomainInputChange(e) {
        const value = e.target.value.trim();
        if (this.domainValidationTimer) clearTimeout(this.domainValidationTimer);
        this.updateButtonStates();

        if (!value) {
            this.domainValidator.classList.remove('show');
            return;
        }

        const domain = this.extractDomain(value);
        if (!domain) {
            this.showDomainValidation('invalid', '❌', 'Invalid domain format');
            return;
        }

        this.showDomainValidation('checking', '⏳', `Checking ${domain}...`);
        this.domainValidationTimer = setTimeout(() => this.validateDomain(domain), 500);
    }

    extractDomain(input) {
        const cleanInput = input.trim().toLowerCase();
        const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (domainPattern.test(cleanInput)) return cleanInput;
        if (cleanInput.includes('@')) {
            const parts = cleanInput.split('@');
            return parts.length === 2 && domainPattern.test(parts[1]) ? parts[1] : null;
        }
        const urlPattern = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const match = cleanInput.match(urlPattern);
        return match && match[3] ? match[3] : null;
    }

    async validateDomain(domain) {
        try {
            const response = await fetch('/api/validate-domain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain })
            });
            const result = await response.json();
            const message = result.message + (result.isPublicProvider ? ' (Public email provider)' : result.isCorporateDomain ? ' (Corporate domain)' : '');
            
            // Store the domain validation result
            this.lastDomainValidation = {
                domain: domain,
                valid: result.valid,
                canReceiveEmail: result.valid && result.mxRecords && result.mxRecords.length > 0
            };
            
            this.showDomainValidation(result.valid ? 'valid' : 'invalid', result.valid ? '✅' : '❌', message);
            this.lastValidatedDomain = result.valid ? domain : null;
            
            // Update button state after domain validation
            this.updateButtonStates();
        } catch (error) {
            console.error('Domain validation error:', error);
            this.lastDomainValidation = {
                domain: domain,
                valid: false,
                canReceiveEmail: false
            };
            this.showDomainValidation('error', '⚠️', 'Unable to validate domain');
            this.updateButtonStates();
        }
    }

    showDomainValidation(status, icon, message) {
        this.domainValidator.classList.add('show');
        this.validationIcon.textContent = icon;
        this.validationMessage.textContent = message;
        this.domainValidator.className = `domain-validator show ${status}`;
        
        // If domain is invalid, show appropriate message
        if (status === 'invalid') {
            if (message.includes('has no email servers') || message.includes('does not exist')) {
                this.showDomainRestrictionNote('This domain cannot receive emails. Please enter a valid corporate domain.');
            }
        }
    }

    validateField(input) {
        const value = input.value.trim();
        const fieldName = input.name;
        const errorElement = document.getElementById(`${fieldName}-error`);
        let isValid = true;
        let errorMessage = '';

        if (!value) {
            isValid = false;
            errorMessage = 'This field is required';
        } else if (value.length > input.maxLength) {
            isValid = false;
            errorMessage = `Maximum ${input.maxLength} characters allowed`;
        }

        switch (fieldName) {
            case 'firstName':
            case 'lastName':
                if (value && !/^[a-zA-Z\s'-]+$/.test(value)) {
                    isValid = false;
                    errorMessage = 'Only letters, spaces, hyphens and apostrophes allowed';
                }
                break;
            case 'companyName':
                const domain = this.extractDomain(value);
                if (value && !domain) {
                    isValid = false;
                    errorMessage = 'Please enter a valid domain (e.g., company.com)';
                } else if (domain && this.isGenericDomain(domain)) {
                    isValid = false;
                    errorMessage = 'Generic email domains are not allowed';
                }
                break;
        }

        this.showError(errorElement, isValid ? '' : errorMessage);
        return isValid;
    }

    clearError(input) {
        const errorElement = document.getElementById(`${input.name}-error`);
        this.showError(errorElement, '');
    }

    showError(errorElement, message) {
        errorElement.textContent = message;
    }

    async handleGenerateAndVerify(e) {
        e.preventDefault();
        if (!this.validateForm()) return;
        
        // Set a 5-minute timeout for verification
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

        this.setButtonLoading(this.verifyBtn, true);
        this.showVerificationProgress();
        
        // Generate request ID for tracking
        this.currentRequestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            const requestBody = {
                ...data,
                verificationOptions: { 
                    enableSMTP: true, 
                    deepVerification: true, 
                    usePythonValidator: true, 
                    verifyAll: true 
                }
            };
            
            const response = await fetch('/api/generate-and-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const result = await response.json();
            
            if (response.status === 503) {
                // Server at capacity
                this.showCapacityWarning(result.queueStatus);
                this.setButtonLoading(this.verifyBtn, false);
                return;
            }
            
            if (response.status === 202 && result.queued) {
                // In queue
                this.showQueueStatus(result.queueStatus);
                this.setButtonLoading(this.verifyBtn, false);
                
                // Wait for processing
                setTimeout(() => {
                    this.retryVerification(requestBody);
                }, result.queueStatus.estimatedWait * 1000);
                return;
            }
            
            if (result.success) {
                // Clear any queue check interval
                if (this.queueCheckInterval) {
                    clearInterval(this.queueCheckInterval);
                }
                
                // Process and display results
                this.processAndDisplayResults(result, data);
            } else {
                this.showErrorMessage(result.error || 'Verification failed');
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                this.showErrorMessage('Verification is taking longer than expected. Please try refreshing the page.');
            } else {
                console.error('Email verification error:', error);
                this.showErrorMessage('An error occurred during verification. Please try again.');
            }
        } finally {
            this.setButtonLoading(this.verifyBtn, false);
        }
    }

    async retryVerification(requestBody) {
        console.log('Retrying verification after queue wait...');
        
        try {
            const response = await fetch('/api/generate-and-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.processAndDisplayResults(result, requestBody);
            } else {
                this.showErrorMessage(result.error || 'Verification failed after queue');
            }
        } catch (error) {
            this.showErrorMessage('Failed to complete verification. Please try again.');
        }
    }

    processAndDisplayResults(result, formData) {
        const validEmails = result.validEmails || [];
        const firstName = formData.firstName.toLowerCase();
        const lastName = formData.lastName.toLowerCase();
        const domain = this.extractDomain(formData.companyName);
        
        let emailsWithProbability = [];
        
        // Case 1: Zero valid emails
        if (validEmails.length === 0) {
            emailsWithProbability = [
                { email: `${firstName}.${lastName}@${domain}`, probability: 58 },
                { email: `${firstName.charAt(0)}${lastName}@${domain}`, probability: 52 },
                { email: `${firstName}${lastName.charAt(0)}@${domain}`, probability: 42 }
            ];
        }
        // Case 2: More than 10 valid emails
        else if (validEmails.length > 10) {
            emailsWithProbability = [
                { email: `${firstName}.${lastName}@${domain}`, probability: 48 },
                { email: `${firstName.charAt(0)}${lastName}@${domain}`, probability: 59 },
                { email: `${firstName}${lastName.charAt(0)}@${domain}`, probability: 52 }
            ];
        }
        // Case 3: 1-3 valid emails
        else if (validEmails.length >= 1 && validEmails.length <= 3) {
            // Calculate probability based on pattern matching
            emailsWithProbability = validEmails.map(item => {
                if (typeof item === 'string') {
                    const prob = this.calculateEmailProbability(item, validEmails.length);
                    return { email: item, probability: prob };
                }
                return item;
            });
        }
        // Case 4: 4-10 valid emails
        else {
            // Calculate probabilities for all valid emails
            const allEmailsWithProb = validEmails.map(item => {
                if (typeof item === 'string') {
                    const prob = this.calculateEmailProbability(item, validEmails.length);
                    return { email: item, probability: prob };
                }
                return item;
            });
            
            // Sort by probability (descending)
            allEmailsWithProb.sort((a, b) => b.probability - a.probability);
            
            // Take top 3
            emailsWithProbability = allEmailsWithProb.slice(0, 3);
        }
        
        // Display the results
        this.displayEmailResults(emailsWithProbability);
    }

    calculateEmailProbability(email, totalValid) {
        const [username] = email.split('@');
        let baseProbability = 50;
        
        // Pattern-based probability adjustments
        if (/^[a-z]+\.[a-z]+$/.test(username)) {
            baseProbability = 85; // first.last pattern
        } else if (/^[a-z]\.[a-z]+$/.test(username)) {
            baseProbability = 75; // f.last pattern
        } else if (/^[a-z]+_[a-z]+$/.test(username)) {
            baseProbability = 70; // first_last pattern
        } else if (/^[a-z]+[a-z]+$/.test(username) && username.length <= 15) {
            baseProbability = 65; // firstlast pattern
        } else if (/^[a-z][a-z]+$/.test(username) && username.length <= 8) {
            baseProbability = 60; // flast pattern
        } else if (/^[a-z]+$/.test(username)) {
            baseProbability = 55; // firstname only
        }
        
        // Adjust based on total valid emails found
        if (totalValid <= 3) {
            baseProbability += 10;
        } else if (totalValid > 10) {
            baseProbability -= 10;
        }
        
        // Ensure probability is within bounds
        return Math.min(95, Math.max(30, baseProbability));
    }

    displayEmailResults(emailsWithProbability) {
        this.resultContainer.style.display = 'block';
        
        const tableHTML = `
            <table class="email-results-table">
                <thead>
                    <tr>
                        <th>Email Address</th>
                        <th>Probability</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${emailsWithProbability.map(item => {
                        const probClass = item.probability >= 70 ? 'probability-high' : 
                                        item.probability >= 50 ? 'probability-medium' : 
                                        'probability-low';
                        return `
                            <tr>
                                <td class="email-cell">${this.escapeHtml(item.email)}</td>
                                <td class="probability-cell ${probClass}">${item.probability}%</td>
                                <td>
                                    <button class="copy-btn" data-email="${this.escapeHtml(item.email)}">
                                        Copy
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <div style="margin-top: 20px; text-align: center;">
                <button class="action-btn new-search-btn" style="padding: 8px 20px;">
                    🔄 New Search
                </button>
            </div>
        `;
        
        this.resultContent.innerHTML = tableHTML;

        // Add event listeners to copy buttons
        const copyButtons = this.resultContent.querySelectorAll('.copy-btn');
        copyButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const email = e.target.getAttribute('data-email');
                const success = await window.copyToClipboard(email, 'Copied!');
                
                // Temporarily change button text to show feedback
                const originalText = e.target.textContent;
                e.target.textContent = success ? '✓ Copied' : 'Failed';
                e.target.style.backgroundColor = success ? '#28a745' : '#dc3545';
                
                setTimeout(() => {
                    e.target.textContent = originalText;
                    e.target.style.backgroundColor = '';
                }, 2000);
            });
        });

        // Add event listener for new search button
        const newSearchBtn = this.resultContent.querySelector('.new-search-btn');
        if (newSearchBtn) {
            newSearchBtn.addEventListener('click', () => {
                location.reload();
            });
        }
    }

    showVerificationProgress() {
        this.resultContainer.style.display = 'block';
        this.resultContent.innerHTML = `
            <div class="verification-progress">
                <div class="progress-spinner"></div>
                <h3>Finding email addresses...</h3>
                <p>Analyzing patterns and verifying possibilities</p>
            </div>
        `;
    }

    validateForm() {
        const inputs = this.form.querySelectorAll('input[type="text"]');
        let isValid = true;
        inputs.forEach(input => { 
            if (!this.validateField(input)) isValid = false; 
        });
        return isValid;
    }

    setButtonLoading(button, loading) {
        button.disabled = loading;
        button.classList.toggle('loading', loading);
        const spinner = button.querySelector('.spinner');
        if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
    }

    showErrorMessage(message) {
        this.resultContainer.style.display = 'block';
        this.resultContent.innerHTML = `
            <div class="no-results-message">
                <p>❌ ${this.escapeHtml(message)}</p>
                <button class="action-btn try-again-btn" style="margin-top: 20px; padding: 8px 20px;">
                    🔄 Try Again
                </button>
            </div>
        `;

        // Add event listener for try again button
        const tryAgainBtn = this.resultContent.querySelector('.try-again-btn');
        if (tryAgainBtn) {
            tryAgainBtn.addEventListener('click', () => {
                location.reload();
            });
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Cleanup intervals on page unload
    cleanup() {
        if (this.poolStatusInterval) {
            clearInterval(this.poolStatusInterval);
        }
        if (this.queueCheckInterval) {
            clearInterval(this.queueCheckInterval);
        }
        if (this.domainValidationTimer) {
            clearTimeout(this.domainValidationTimer);
        }
    }
}

// Global functions for copy functionality
window.copyToClipboard = async function(text, feedbackText) {
    try { 
        await navigator.clipboard.writeText(text); 
        showCopySuccess(feedbackText); 
        return true; 
    }
    catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text; 
        textArea.style.position = 'fixed'; 
        textArea.style.left = '-999999px'; 
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea); 
        textArea.focus(); 
        textArea.select();
        try { 
            document.execCommand('copy'); 
            showCopySuccess(feedbackText); 
            return true; 
        }
        catch (err) { 
            console.error('Failed to copy:', err); 
            showCopyError('Failed to copy'); 
            return false; 
        }
        finally { 
            document.body.removeChild(textArea); 
        }
    }
};

function showCopySuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-feedback'; 
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 1000;
        animation: fadeOut 3s ease-in-out;
    `;
    document.body.appendChild(notification); 
    setTimeout(() => { 
        if (notification.parentNode) notification.parentNode.removeChild(notification); 
    }, 3000);
}

function showCopyError(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-feedback error'; 
    notification.textContent = message; 
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 1000;
        animation: fadeOut 3s ease-in-out;
    `;
    document.body.appendChild(notification); 
    setTimeout(() => { 
        if (notification.parentNode) notification.parentNode.removeChild(notification); 
    }, 3000);
}

// Add fade out animation if not already present
if (!document.getElementById('fadeOutAnimation')) {
    const style = document.createElement('style');
    style.id = 'fadeOutAnimation';
    style.textContent = `
        @keyframes fadeOut {
            0% { opacity: 1; }
            70% { opacity: 1; }
            100% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ProMailHunterApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (app) {
        app.cleanup();
    }
});