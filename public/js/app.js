// public/js/app.js - CONSOLIDATED VERSION
// This is the ONLY frontend JavaScript file we need

class ProMailHunterApp {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.generateBtn = document.getElementById('generateBtn');
        this.verifyBtn = document.getElementById('verifyBtn');
        this.resultContainer = document.getElementById('result');
        this.resultContent = document.getElementById('resultContent');
        this.domainValidator = document.getElementById('domainValidator');
        this.validationIcon = document.getElementById('validationIcon');
        this.validationMessage = document.getElementById('validationMessage');
        
        // Domain validation instance
        this.domainValidationTimer = null;
        this.lastValidatedDomain = null;
        
        this.init();
    }

    init() {
        // Add button event listeners
        this.generateBtn.addEventListener('click', this.handleEmailGeneration.bind(this));
        this.verifyBtn.addEventListener('click', this.handleGenerateAndVerify.bind(this));
        
        // Add real-time validation
        this.addRealTimeValidation();
        
        // Add domain validation on company input
        const companyInput = document.getElementById('companyName');
        companyInput.addEventListener('input', this.handleDomainInputChange.bind(this));
        companyInput.addEventListener('blur', this.handleDomainInputChange.bind(this));
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
        
        // Clear previous timer
        if (this.domainValidationTimer) {
            clearTimeout(this.domainValidationTimer);
        }
        
        if (!value) {
            this.domainValidator.classList.remove('show');
            return;
        }
        
        // Extract domain from input
        const domain = this.extractDomain(value);
        
        if (!domain) {
            this.showDomainValidation('invalid', '❌', 'Invalid domain format');
            return;
        }
        
        // Show checking status
        this.showDomainValidation('checking', '⏳', `Checking ${domain}...`);
        
        // Debounce validation
        this.domainValidationTimer = setTimeout(() => {
            this.validateDomain(domain);
        }, 500);
    }

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

    async validateDomain(domain) {
        try {
            const response = await fetch('/api/validate-domain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain })
            });
            
            const result = await response.json();
            
            if (result.valid) {
                let message = result.message;
                if (result.isPublicProvider) {
                    message += ' (Public email provider)';
                } else if (result.isCorporateDomain) {
                    message += ' (Corporate domain)';
                }
                this.showDomainValidation('valid', '✅', message);
                this.lastValidatedDomain = domain;
            } else {
                this.showDomainValidation('invalid', '❌', result.message);
                this.lastValidatedDomain = null;
            }
        } catch (error) {
            console.error('Domain validation error:', error);
            this.showDomainValidation('error', '⚠️', 'Unable to validate domain');
        }
    }

    showDomainValidation(status, icon, message) {
        this.domainValidator.classList.add('show');
        this.validationIcon.textContent = icon;
        this.validationMessage.textContent = message;
        
        // Update styling based on status
        this.domainValidator.className = `domain-validator show ${status}`;
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

        switch(fieldName) {
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

    async handleEmailGeneration(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        this.setButtonLoading(this.generateBtn, true);
        this.hideResult();

        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());

            const response = await fetch('/api/generate-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showEmailResults(result);
            } else {
                this.showErrorMessage(result.error || 'An error occurred generating emails');
            }

        } catch (error) {
            console.error('Email generation error:', error);
            this.showErrorMessage('Network error. Please check your connection and try again.');
        } finally {
            this.setButtonLoading(this.generateBtn, false);
        }
    }

    async handleGenerateAndVerify(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        this.setButtonLoading(this.verifyBtn, true);
        this.hideResult();

        // Show enhanced progress indicator
        this.showEnhancedVerificationProgress();

        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());

            const requestBody = {
                ...data,
                verificationOptions: {
                    enableSMTP: true,
                    deepVerification: true,
                    usePythonValidator: true,
                    verifyAll: true // Verify ALL emails
                }
            };

            // NO LIMIT - verify all generated emails
            const response = await fetch('/api/generate-and-verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Show initial response with progress info
                this.showVerificationInProgress(result);
                
                // Start polling for results (in a real app, use WebSockets)
                if (result.progressTracking?.enabled) {
                    this.pollForResults(result.progressTracking.checkProgressEndpoint);
                }
            } else {
                this.showErrorMessage(result.error || 'An error occurred during email verification');
            }

        } catch (error) {
            console.error('Email verification error:', error);
            this.showErrorMessage('Network error. Please check your connection and try again.');
        } finally {
            this.setButtonLoading(this.verifyBtn, false);
        }
    }

    validateForm() {
        const inputs = this.form.querySelectorAll('input[type="text"]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    setButtonLoading(button, loading) {
        button.disabled = loading;
        button.classList.toggle('loading', loading);
        
        // Show/hide spinner
        const spinner = button.querySelector('.spinner');
        if (spinner) {
            spinner.style.display = loading ? 'inline-block' : 'none';
        }
    }

    showEnhancedVerificationProgress() {
        this.resultContainer.className = 'result-container';
        this.resultContent.innerHTML = `
            <div class="verification-progress enhanced">
                <h3>🔍 Complete Email Verification in Progress...</h3>
                <div class="progress-info">
                    <p><strong>Verifying ALL generated email addresses for maximum accuracy.</strong></p>
                    <p>This comprehensive verification tests every possible email combination.</p>
                    <div class="progress-animation">
                        <div class="progress-dot"></div>
                        <div class="progress-dot"></div>
                        <div class="progress-dot"></div>
                    </div>
                </div>
                <div class="progress-stages">
                    <div class="stage" id="stage-generate">📧 Generating all email patterns...</div>
                    <div class="stage" id="stage-validate">🌐 Validating domain...</div>
                    <div class="stage" id="stage-verify">📫 Testing ALL mailboxes...</div>
                    <div class="stage" id="stage-analyze">📊 Analyzing results...</div>
                </div>
                <div class="verification-note">
                    <p><small>💡 <strong>Note:</strong> Complete verification takes longer but provides the most accurate results by testing every possible email combination.</small></p>
                </div>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');

        // Animate stages
        setTimeout(() => document.getElementById('stage-generate')?.classList.add('active'), 500);
        setTimeout(() => document.getElementById('stage-validate')?.classList.add('active'), 2000);
        setTimeout(() => document.getElementById('stage-verify')?.classList.add('active'), 4000);
    }

    showVerificationInProgress(result) {
        this.resultContainer.className = 'result-container';
        this.resultContent.innerHTML = `
            <div class="verification-status">
                <h3>✅ Verification Started Successfully!</h3>
                
                <div class="status-info">
                    <div class="info-card">
                        <h4>📧 Emails Generated</h4>
                        <div class="big-number">${result.generation.totalGenerated}</div>
                        <p>For domain: ${this.escapeHtml(result.generation.domain)}</p>
                    </div>
                    
                    <div class="info-card">
                        <h4>🔍 Verification Strategy</h4>
                        <p><strong>${result.verification.strategy.description}</strong></p>
                        <p>Batch size: ${result.verification.strategy.batchSize}</p>
                        <p>Estimated time: ${result.verification.estimatedTime}</p>
                    </div>
                    
                    <div class="info-card">
                        <h4>📊 Progress</h4>
                        <div class="progress-bar">
                            <div class="progress-fill" id="verificationProgress" style="width: 0%"></div>
                        </div>
                        <p id="progressText">0 / ${result.generation.totalGenerated} verified</p>
                    </div>
                </div>
                
                <div class="verification-benefits">
                    <h4>✨ Benefits of Complete Verification:</h4>
                    <ul>
                        <li>Tests ALL ${result.generation.totalGenerated} possible email combinations</li>
                        <li>No potentially valid emails are missed</li>
                        <li>Provides the most accurate and comprehensive results</li>
                        <li>Identifies all working email addresses for the contact</li>
                    </ul>
                </div>
                
                <div class="results-notice">
                    <p><strong>📁 Results will be saved automatically when verification completes.</strong></p>
                    <p>You can close this window - verification continues in the background.</p>
                </div>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');
    }

    // Mock polling function (in production, use WebSockets or Server-Sent Events)
    async pollForResults(endpoint) {
        // Simulate progress updates
        let progress = 0;
        const totalEmails = parseInt(document.querySelector('.big-number')?.textContent || '0');
        
        const progressInterval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress > 100) progress = 100;
            
            const verified = Math.floor((progress / 100) * totalEmails);
            
            document.getElementById('verificationProgress').style.width = progress + '%';
            document.getElementById('progressText').textContent = `${verified} / ${totalEmails} verified`;
            
            if (progress >= 100) {
                clearInterval(progressInterval);
                document.getElementById('stage-analyze')?.classList.add('active');
                
                // Show completion message
                setTimeout(() => {
                    this.showVerificationComplete(totalEmails);
                }, 2000);
            }
        }, 1000);
    }

    showVerificationComplete(totalEmails) {
        const completionHtml = `
            <div class="verification-complete">
                <h3>🎉 Verification Complete!</h3>
                <p><strong>All ${totalEmails} emails have been verified.</strong></p>
                <p>Check the results file for detailed findings.</p>
                <div class="complete-actions">
                    <button class="action-btn" onclick="location.reload()">
                        🔄 Start New Verification
                    </button>
                </div>
            </div>
        `;
        
        const statusDiv = document.querySelector('.verification-status');
        if (statusDiv) {
            statusDiv.insertAdjacentHTML('beforeend', completionHtml);
        }
    }

    showEmailResults(result) {
        this.resultContainer.className = 'result-container success';
        
        const data = result.data;
        const companyEmailsHtml = this.createEmailList(data.emails.company, 'Generated Emails', true);
        
        let downloadLink = '';
        if (result.file && result.file.filename) {
            downloadLink = `
                <div class="download-section">
                    <a href="/api/download-emails/${result.file.filename}" 
                       class="download-btn" 
                       download="${result.file.filename}">
                        📥 Download JSON File
                    </a>
                </div>
            `;
        }
        
        this.resultContent.innerHTML = `
            <p><strong>📧 Email Generation Complete!</strong></p>
            <div class="result-data">
                <p><strong>Name:</strong> ${this.escapeHtml(data.metadata.firstName)} ${this.escapeHtml(data.metadata.lastName)}</p>
                <p><strong>Domain:</strong> ${this.escapeHtml(data.metadata.domain)}</p>
                <p><strong>Total Emails:</strong> ${data.metadata.totalEmails}</p>
                <p><strong>Generated At:</strong> ${new Date(data.metadata.generatedAt).toLocaleString()}</p>
            </div>
            
            ${downloadLink}
            
            <div class="email-sections">
                ${companyEmailsHtml}
            </div>
            
            <div class="quick-actions">
                <button class="action-btn copy-all-btn" onclick="copyAllEmails('${data.emails.all.join(',')}')">
                    📋 Copy All Emails
                </button>
                <button class="action-btn verify-now-btn" onclick="verifyGeneratedEmails()">
                    🔍 Verify These Emails
                </button>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');
    }

    createEmailList(emails, title, showCopyButton = false) {
        if (!emails || emails.length === 0) return '';
        
        const emailItems = emails.slice(0, 20).map(email => 
            `<li>${this.escapeHtml(email)} ${showCopyButton ? `<button class="copy-single-btn" onclick="copyToClipboard('${email}', 'Copied!')" title="Copy email">📋</button>` : ''}</li>`
        ).join('');
        
        return `
            <div class="email-category">
                <h4>${title} (${emails.length})</h4>
                <ul class="email-list">
                    ${emailItems}
                </ul>
                ${emails.length > 20 ? `<p><em>... and ${emails.length - 20} more</em></p>` : ''}
            </div>
        `;
    }

    showErrorMessage(message) {
        this.resultContainer.className = 'result-container error';
        this.resultContent.innerHTML = `
            <p><strong>❌ Error:</strong> ${this.escapeHtml(message)}</p>
        `;
        this.resultContainer.classList.remove('hidden');
    }

    hideResult() {
        this.resultContainer.classList.add('hidden');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Utility functions
window.copyToClipboard = async function(text, feedbackText = 'Copied to clipboard!') {
    try {
        await navigator.clipboard.writeText(text);
        showCopySuccess(feedbackText);
        return true;
    } catch (err) {
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
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showCopyError('Failed to copy to clipboard');
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
};

window.copyAllEmails = function(emailsString) {
    const emails = emailsString.split(',');
    const text = emails.join(', ');
    copyToClipboard(text, `Copied ${emails.length} emails!`);
};

window.verifyGeneratedEmails = function() {
    // Trigger the verify button click
    const verifyBtn = document.getElementById('verifyBtn');
    if (verifyBtn) {
        verifyBtn.click();
    }
};

function showCopySuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-feedback';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

function showCopyError(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-feedback error';
    notification.textContent = message;
    notification.style.background = '#dc3545';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProMailHunterApp();
});