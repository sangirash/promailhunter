// public/js/app-improved.js
class SecureContactForm {
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

        // Show progress indicator
        this.showVerificationProgress();

        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());

            const requestBody = {
                ...data,
                verificationOptions: {
                    enableSMTP: true,
                    deepVerification: true,
                    usePythonValidator: true
                }
            };

            const response = await fetch('/api/generate-and-verify?limit=30', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showVerificationResults(result);
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

    showVerificationProgress() {
        this.resultContainer.className = 'result-container';
        this.resultContent.innerHTML = `
            <div class="verification-progress">
                <h3>🔍 Deep Email Verification in Progress...</h3>
                <div class="progress-info">
                    <p>Testing actual mailbox existence for each email address.</p>
                    <p>This may take 30-60 seconds for accurate results.</p>
                    <div class="progress-animation">
                        <div class="progress-dot"></div>
                        <div class="progress-dot"></div>
                        <div class="progress-dot"></div>
                    </div>
                </div>
                <div class="progress-stages">
                    <div class="stage" id="stage-generate">📧 Generating email patterns...</div>
                    <div class="stage" id="stage-validate">🌐 Validating domain...</div>
                    <div class="stage" id="stage-verify">📫 Testing mailboxes...</div>
                </div>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');

        // Animate stages
        setTimeout(() => document.getElementById('stage-generate')?.classList.add('active'), 500);
        setTimeout(() => document.getElementById('stage-validate')?.classList.add('active'), 2000);
        setTimeout(() => document.getElementById('stage-verify')?.classList.add('active'), 4000);
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

    showVerificationResults(result) {
        this.resultContainer.className = 'result-container success';
        
        let downloadLink = '';
        if (result.file && result.file.filename) {
            downloadLink = `
                <div class="download-section">
                    <a href="/api/download-verification/${result.file.filename}" 
                       class="download-btn" 
                       download="${result.file.filename}">
                        📥 Download Verification Results
                    </a>
                </div>
            `;
        }

        const verifiedEmailsHtml = this.createVerifiedEmailsList(result.validEmails || []);
        const verificationStatsHtml = this.createVerificationStats(result.summary);
        
        this.resultContent.innerHTML = `
            <div class="verification-header">
                <h3>✅ Deep Email Verification Complete!</h3>
                <div class="verification-summary-quick">
                    <span class="quick-stat valid">✅ ${result.summary.valid} Valid</span>
                    <span class="quick-stat invalid">❌ ${result.summary.invalid} Invalid</span>
                    <span class="quick-stat uncertain">❓ ${result.summary.uncertain} Uncertain</span>
                </div>
            </div>
            
            <div class="result-data">
                <p><strong>Total Emails Checked:</strong> ${result.summary.total}</p>
                <p><strong>Success Rate:</strong> ${result.summary.total > 0 ? ((result.summary.valid / result.summary.total) * 100).toFixed(1) : 0}%</p>
                <p><strong>Deep Verification:</strong> ${result.deepVerification ? 'Yes - Mailbox existence tested' : 'No'}</p>
                <p><strong>Verification Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            ${downloadLink}
            
            ${verificationStatsHtml}
            
            ${verifiedEmailsHtml}
            
            ${result.validEmails && result.validEmails.length > 0 ? this.createCopySection(result.validEmails) : ''}
        `;
        this.resultContainer.classList.remove('hidden');
    }

    createVerificationStats(summary) {
        return `
            <div class="verification-summary">
                <h4>📊 Verification Statistics</h4>
                <div class="verification-stats">
                    <div class="stat-card valid">
                        <h4>✅ Valid Emails</h4>
                        <div class="stat-number">${summary.valid}</div>
                        <div class="stat-percentage">${summary.total > 0 ? ((summary.valid / summary.total) * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div class="stat-card invalid">
                        <h4>❌ Invalid Emails</h4>
                        <div class="stat-number">${summary.invalid}</div>
                        <div class="stat-percentage">${summary.total > 0 ? ((summary.invalid / summary.total) * 100).toFixed(1) : 0}%</div>
                    </div>
                    <div class="stat-card uncertain">
                        <h4>❓ Uncertain</h4>
                        <div class="stat-number">${summary.uncertain}</div>
                        <div class="stat-percentage">${summary.total > 0 ? ((summary.uncertain / summary.total) * 100).toFixed(1) : 0}%</div>
                    </div>
                </div>
                ${summary.mailboxTested ? `
                    <div class="mailbox-stats">
                        <p><strong>📫 Mailboxes Tested:</strong> ${summary.mailboxTested}</p>
                        <p><strong>✅ Confirmed to Exist:</strong> ${summary.mailboxExists || 0}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    createVerifiedEmailsList(validEmails) {
        if (!validEmails || validEmails.length === 0) {
            return `
                <div class="verified-emails-section">
                    <h4>📧 Verified Email Addresses</h4>
                    <div class="no-results">
                        <p>No valid email addresses were found during verification.</p>
                        <p>This could mean:</p>
                        <ul>
                            <li>The email servers are temporarily unavailable</li>
                            <li>The company uses strict email filtering</li>
                            <li>The generated email patterns don't match the company's format</li>
                        </ul>
                    </div>
                </div>
            `;
        }

        const emailItems = validEmails.map((email, index) => `
            <div class="verified-email-item" data-email="${email}">
                <div class="email-info">
                    <span class="email-address">${this.escapeHtml(email)}</span>
                    <span class="email-status">✅ Verified</span>
                </div>
                <div class="email-actions">
                    <button class="copy-single-btn" onclick="copyToClipboard('${email}', 'Email copied!')" title="Copy email">
                        📋 Copy
                    </button>
                    <button class="compose-btn" onclick="window.open('mailto:${email}', '_blank')" title="Compose email">
                        ✉️ Email
                    </button>
                </div>
            </div>
        `).join('');

        return `
            <div class="verified-emails-section">
                <h4>📧 Verified Email Addresses (${validEmails.length})</h4>
                <div class="verified-emails-container">
                    ${emailItems}
                </div>
            </div>
        `;
    }

    createCopySection(validEmails) {
        const emailsJson = JSON.stringify(validEmails);
        return `
            <div class="copy-section">
                <h4>📋 Quick Actions</h4>
                <div class="copy-buttons">
                    <button class="copy-btn primary" onclick='copyVerifiedEmails(${emailsJson}, "comma")'>
                        📋 Copy All Emails (Comma Separated)
                    </button>
                    <button class="copy-btn" onclick='copyVerifiedEmails(${emailsJson}, "newline")'>
                        📋 Copy All Emails (Line by Line)
                    </button>
                </div>
            </div>
        `;
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

window.copyVerifiedEmails = function(emails, format = 'comma') {
    let text = '';
    let feedbackText = '';
    
    switch(format) {
        case 'comma':
            text = emails.join(', ');
            feedbackText = `Copied ${emails.length} emails (comma separated)`;
            break;
        case 'newline':
            text = emails.join('\n');
            feedbackText = `Copied ${emails.length} emails (line by line)`;
            break;
        default:
            text = emails.join(', ');
            feedbackText = `Copied ${emails.length} emails`;
    }
    
    copyToClipboard(text, feedbackText);
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

// Initialize the form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SecureContactForm();
});