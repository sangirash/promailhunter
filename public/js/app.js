class SecureContactForm {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.resultContainer = document.getElementById('result');
        this.resultContent = document.getElementById('resultContent');
        
        this.init();
    }

    init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.addRealTimeValidation();
        this.addEmailGenerationButton();
        this.addEmailVerificationButton();
    }

    addEmailGenerationButton() {
        const emailBtn = document.createElement('button');
        emailBtn.type = 'button';
        emailBtn.className = 'email-btn';
        emailBtn.innerHTML = `
            <span class="btn-text">Generate Emails Only</span>
            <span class="spinner" id="email-spinner"></span>
        `;
        emailBtn.addEventListener('click', this.handleEmailGeneration.bind(this));
        
        this.submitBtn.parentNode.insertBefore(emailBtn, this.submitBtn.nextSibling);
    }

    addEmailVerificationButton() {
        const verifyBtn = document.createElement('button');
        verifyBtn.type = 'button';
        verifyBtn.className = 'verify-btn';
        verifyBtn.innerHTML = `
            <span class="btn-text">Generate & Verify Emails</span>
            <span class="spinner" id="verify-spinner"></span>
        `;
        verifyBtn.addEventListener('click', this.handleGenerateAndVerify.bind(this));
        
        const emailBtn = document.querySelector('.email-btn');
        emailBtn.parentNode.insertBefore(verifyBtn, emailBtn.nextSibling);
    }

    addRealTimeValidation() {
        const inputs = this.form.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearError(input));
        });
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
                if (value && !/^[a-zA-Z0-9\s&.,-]+$/.test(value)) {
                    isValid = false;
                    errorMessage = 'Contains invalid characters';
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

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        this.setLoading(true);
        this.hideResult();

        // Show progress for verification
        this.showSubmitProgress();

        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());

            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccess(result);
                this.form.reset();
            } else {
                this.showErrorMessage(result.error || 'An error occurred');
            }

        } catch (error) {
            console.error('Submission error:', error);
            this.showErrorMessage('Network error. Please check your connection and try again.');
        } finally {
            this.setLoading(false);
        }
    }

    async handleEmailGeneration(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        this.setEmailLoading(true);
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
            this.setEmailLoading(false);
        }
    }

    async handleGenerateAndVerify(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        this.setVerifyLoading(true);
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
                    enableEmailPing: false
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
            this.setVerifyLoading(false);
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

    setLoading(loading) {
        this.submitBtn.disabled = loading;
        this.submitBtn.classList.toggle('loading', loading);
    }

    setEmailLoading(loading) {
        const emailBtn = document.querySelector('.email-btn');
        if (emailBtn) {
            emailBtn.disabled = loading;
            emailBtn.classList.toggle('loading', loading);
        }
    }

    setVerifyLoading(loading) {
        const verifyBtn = document.querySelector('.verify-btn');
        if (verifyBtn) {
            verifyBtn.disabled = loading;
            verifyBtn.classList.toggle('loading', loading);
        }
    }

    showSubmitProgress() {
        this.resultContainer.className = 'result-container';
        this.resultContent.innerHTML = `
            <div class="verification-progress">
                <h3>📤 Processing Your Submission...</h3>
                <div class="progress-info">
                    <p>Generating and verifying email addresses for your company.</p>
                    <p>This may take 30-60 seconds depending on email server responses.</p>
                    <div class="progress-animation">
                        <div class="progress-dot"></div>
                        <div class="progress-dot"></div>
                        <div class="progress-dot"></div>
                    </div>
                </div>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');
    }

    showVerificationProgress() {
        this.resultContainer.className = 'result-container';
        this.resultContent.innerHTML = `
            <div class="verification-progress">
                <h3>🔍 Verifying Email Addresses...</h3>
                <div class="progress-info">
                    <p>This may take 30-60 seconds depending on email server responses.</p>
                    <div class="progress-animation">
                        <div class="progress-dot"></div>
                        <div class="progress-dot"></div>
                        <div class="progress-dot"></div>
                    </div>
                </div>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');
    }

    showSuccess(result) {
        this.resultContainer.className = 'result-container success';
        
        // Check if this is a verification result (has validEmails) or just submission
        if (result.validEmails !== undefined && result.summary) {
            // This is a verification result - show the enhanced verification UI
            this.showVerificationResults(result);
            return;
        }
        
        // This is a basic submission result
        let emailInfo = '';
        if (result.emailGeneration) {
            emailInfo = `
                <div class="email-generation-info">
                    <h4>📧 Email Generation Results</h4>
                    <p><strong>Total Emails Generated:</strong> ${result.emailGeneration.totalEmails}</p>
                    <p><strong>Company Emails:</strong> ${result.emailGeneration.companyEmails}</p>
                    <p><strong>Common Provider Emails:</strong> ${result.emailGeneration.commonProviderEmails}</p>
                    <p><strong>Total Domains:</strong> ${result.emailGeneration.totalDomains}</p>
                    ${result.emailGeneration.fileSaved ? `<p><strong>File Saved:</strong> ${result.emailGeneration.fileSaved}</p>` : ''}
                </div>
            `;
        }
        
        this.resultContent.innerHTML = `
            <p><strong>✅ Success!</strong> Your information has been submitted successfully.</p>
            <div class="result-data">
                <p><strong>Name:</strong> ${this.escapeHtml(result.submittedData.firstName)} ${this.escapeHtml(result.submittedData.lastName)}</p>
                <p><strong>Company:</strong> ${this.escapeHtml(result.submittedData.companyName)}</p>
                <p><strong>API Response ID:</strong> ${result.apiResponse.id}</p>
                <p><strong>Status:</strong> ${this.escapeHtml(result.apiResponse.status)}</p>
            </div>
            ${emailInfo}
        `;
        this.resultContainer.classList.remove('hidden');
    }

    showEmailResults(result) {
        this.resultContainer.className = 'result-container success';
        
        const data = result.data;
        const companyEmailsHtml = this.createEmailList(data.emails.company, 'Company Emails', false);
        const commonProviderEmailsHtml = this.createEmailList(data.emails.commonProviders, 'Common Provider Emails', false);
        
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
                <p><strong>Company:</strong> ${this.escapeHtml(data.metadata.companyName)}</p>
                <p><strong>Total Emails:</strong> ${data.metadata.totalEmails}</p>
                <p><strong>Company Domains:</strong> ${data.domains.company.length}</p>
                <p><strong>Generated At:</strong> ${new Date(data.metadata.generatedAt).toLocaleString()}</p>
            </div>
            
            ${downloadLink}
            
            <div class="email-sections">
                ${companyEmailsHtml}
                ${commonProviderEmailsHtml}
            </div>
            
            <div class="json-preview">
                <h4>📄 JSON Preview (First 10 emails)</h4>
                <pre><code>${JSON.stringify({emails: data.emails.all.slice(0, 10)}, null, 2)}</code></pre>
                ${data.emails.all.length > 10 ? '<p><em>... and ' + (data.emails.all.length - 10) + ' more emails</em></p>' : ''}
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

        // Enhanced verified emails display
        const verifiedEmailsHtml = this.createVerifiedEmailsList(result.validEmails || []);
        const verificationStatsHtml = this.createVerificationStats(result.summary);
        
        this.resultContent.innerHTML = `
            <div class="verification-header">
                <h3>✅ Email Verification Complete!</h3>
                <div class="verification-summary-quick">
                    <span class="quick-stat valid">✅ ${result.summary.valid} Valid</span>
                    <span class="quick-stat invalid">❌ ${result.summary.invalid} Invalid</span>
                    <span class="quick-stat uncertain">❓ ${result.summary.uncertain} Uncertain</span>
                </div>
            </div>
            
            <div class="result-data">
                <p><strong>Total Emails Checked:</strong> ${result.summary.total}</p>
                <p><strong>Success Rate:</strong> ${result.summary.total > 0 ? ((result.summary.valid / result.summary.total) * 100).toFixed(1) : 0}%</p>
                <p><strong>Verification Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            ${downloadLink}
            
            ${verificationStatsHtml}
            
            ${verifiedEmailsHtml}
            
            ${result.validEmails && result.validEmails.length > 0 ? this.createCopySection(result.validEmails) : ''}
            
            ${result.validEmails && result.validEmails.length > 0 ? this.createExportSection(result.validEmails) : ''}
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
                ${validEmails.length > 10 ? `
                    <div class="show-more-section">
                        <button class="show-more-btn" onclick="this.parentElement.parentElement.querySelector('.verified-emails-container').classList.toggle('show-all')">
                            Show All ${validEmails.length} Emails
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    createCopySection(validEmails) {
        const emailsJson = JSON.stringify(validEmails);
        return `
            <div class="copy-section">
                <h4>📋 Quick Actions</h4>
                <div class="copy-buttons">
                    <button class="copy-btn primary" onclick="copyVerifiedEmails(${emailsJson}, 'comma')">
                        📋 Copy All Emails (Comma Separated)
                    </button>
                    <button class="copy-btn" onclick="copyVerifiedEmails(${emailsJson}, 'newline')">
                        📋 Copy All Emails (Line by Line)
                    </button>
                    <button class="copy-btn" onclick="copyVerifiedEmails(${emailsJson}, 'semicolon')">
                        📋 Copy All Emails (Semicolon Separated)
                    </button>
                    <button class="copy-btn" onclick="copyVerifiedEmails(${emailsJson}, 'mailto')">
                        ✉️ Copy as Mailto Link
                    </button>
                </div>
            </div>
        `;
    }

    createExportSection(validEmails) {
        const csvData = validEmails.map(email => `"${email}"`).join('\\n');
        const dataUrl = `data:text/csv;charset=utf-8,Email Address\\n${csvData}`;
        
        return `
            <div class="export-section">
                <h4>💾 Export Options</h4>
                <div class="export-buttons">
                    <a href="${dataUrl}" download="verified_emails.csv" class="export-btn">
                        📊 Download as CSV
                    </a>
                    <button class="export-btn" onclick="this.downloadAsText('${validEmails.join('\\n')}', 'verified_emails.txt')">
                        📄 Download as Text
                    </button>
                </div>
            </div>
        `;
    }

    createEmailList(emails, title, showCopyButton = false) {
        if (!emails || emails.length === 0) return '';
        
        const emailItems = emails.slice(0, 20).map(email => 
            `<li>${this.escapeHtml(email)} ${showCopyButton ? `<button class="copy-single-btn" onclick="navigator.clipboard.writeText('${email}')" title="Copy email">📋</button>` : ''}</li>`
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

// Add utility functions at the end of the file, before DOM initialization

// Enhanced copy functionality with user feedback
window.copyToClipboard = async function(text, feedbackText = 'Copied to clipboard!') {
    try {
        await navigator.clipboard.writeText(text);
        showCopySuccess(feedbackText);
        return true;
    } catch (err) {
        // Fallback for older browsers
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

// Show copy success notification
function showCopySuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-success';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Show copy error notification
function showCopyError(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-error';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        animation: copySuccessSlide 3s ease-in-out;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Bulk copy function with different formats
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
        case 'semicolon':
            text = emails.join('; ');
            feedbackText = `Copied ${emails.length} emails (semicolon separated)`;
            break;
        case 'mailto':
            text = `mailto:${emails.join(';')}`;
            feedbackText = `Copied ${emails.length} emails as mailto link`;
            break;
        default:
            text = emails.join(', ');
            feedbackText = `Copied ${emails.length} emails`;
    }
    
    copyToClipboard(text, feedbackText);
};

// Add utility function for downloading text files
window.downloadAsText = function(content, filename) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

// Initialize the form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SecureContactForm();
});