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
        // Add a button for email generation only
        const emailBtn = document.createElement('button');
        emailBtn.type = 'button';
        emailBtn.className = 'email-btn';
        emailBtn.innerHTML = `
            <span class="btn-text">Generate Emails Only</span>
            <span class="spinner" id="email-spinner"></span>
        `;
        emailBtn.addEventListener('click', this.handleEmailGeneration.bind(this));
        
        // Insert after submit button
        this.submitBtn.parentNode.insertBefore(emailBtn, this.submitBtn.nextSibling);
    }

    addEmailVerificationButton() {
        // Add a button for generate and verify
        const verifyBtn = document.createElement('button');
        verifyBtn.type = 'button';
        verifyBtn.className = 'verify-btn';
        verifyBtn.innerHTML = `
            <span class="btn-text">Generate & Verify Emails</span>
            <span class="spinner" id="verify-spinner"></span>
        `;
        verifyBtn.addEventListener('click', this.handleGenerateAndVerify.bind(this));
        
        // Insert after email generation button
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

        // Basic validation
        if (!value) {
            isValid = false;
            errorMessage = 'This field is required';
        } else if (value.length > input.maxLength) {
            isValid = false;
            errorMessage = `Maximum ${input.maxLength} characters allowed`;
        }

        // Field-specific validation
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
                this.showError(result.error || 'An error occurred');
            }

        } catch (error) {
            console.error('Submission error:', error);
            this.showError('Network error. Please check your connection and try again.');
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
                this.showError(result.error || 'An error occurred generating emails');
            }

        } catch (error) {
            console.error('Email generation error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setEmailLoading(false);
        }
    }
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        this.setVerifyLoading(true);
        this.hideResult();

        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());

            // Add verification options
            const requestBody = {
                ...data,
                verificationOptions: {
                    enableSMTP: true,
                    enableEmailPing: false // Never enable email ping by default
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
                this.showError(result.error || 'An error occurred during email verification');
            }

        } catch (error) {
            console.error('Email verification error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setVerifyLoading(false);
        }
    }
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
                this.showError(result.error || 'An error occurred generating emails');
            }

        } catch (error) {
            console.error('Email generation error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setEmailLoading(false);
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

    createEmailList(emails, title, showCopyButton = false) {
        if (!emails || emails.length === 0) return '';
        
        const emailItems = emails.slice(0, 20).map(email => 
            `<li>${this.escapeHtml(email)} ${showCopyButton ? `<button class="copy-single-btn" onclick="navigator.clipboard.writeText('${email}')" title="Copy email">📋</button>` : ''}</li>`
        ).join('');
        
        return `
            <div class="email-category ${showCopyButton ? 'verified-emails' : ''}">
                <h4>${title} (${emails.length})</h4>
                <ul class="email-list">
                    ${emailItems}
                </ul>
                ${emails.length > 20 ? `<p><em>... and ${emails.length - 20} more</em></p>` : ''}
            </div>
        `;
    }
        const verifyBtn = document.querySelector('.verify-btn');
        if (verifyBtn) {
            verifyBtn.disabled = loading;
            verifyBtn.classList.toggle('loading', loading);
        }
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

        const validEmailsList = this.createEmailList(result.validEmails, 'Valid Emails (Verified)', true);
        
        this.resultContent.innerHTML = `
            <p><strong>✅ Email Generation & Verification Complete!</strong></p>
            <div class="result-data">
                <p><strong>Total Emails Checked:</strong> ${result.summary.total}</p>
                <p><strong>✅ Valid:</strong> ${result.summary.valid}</p>
                <p><strong>❌ Invalid:</strong> ${result.summary.invalid}</p>
                <p><strong>❓ Uncertain:</strong> ${result.summary.uncertain}</p>
                <p><strong>Success Rate:</strong> ${((result.summary.valid / result.summary.total) * 100).toFixed(1)}%</p>
            </div>
            
            ${downloadLink}
            
            <div class="verification-summary">
                <div class="verification-stats">
                    <div class="stat-card valid">
                        <h4>✅ Valid Emails</h4>
                        <div class="stat-number">${result.summary.valid}</div>
                    </div>
                    <div class="stat-card invalid">
                        <h4>❌ Invalid Emails</h4>
                        <div class="stat-number">${result.summary.invalid}</div>
                    </div>
                    <div class="stat-card uncertain">
                        <h4>❓ Uncertain</h4>
                        <div class="stat-number">${result.summary.uncertain}</div>
                    </div>
                </div>
            </div>
            
            ${validEmailsList}
            
            ${result.validEmails.length > 0 ? `
                <div class="copy-section">
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${result.validEmails.join(', ')}')">
                        📋 Copy Valid Emails
                    </button>
                </div>
            ` : ''}
        `;
        this.resultContainer.classList.remove('hidden');
    }
        const emailBtn = document.querySelector('.email-btn');
        if (emailBtn) {
            emailBtn.disabled = loading;
            emailBtn.classList.toggle('loading', loading);
        }
    }

    showSuccess(result) {
        this.resultContainer.className = 'result-container success';
        
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
        const companyEmailsHtml = this.createEmailList(data.emails.company, 'Company Emails');
        const commonProviderEmailsHtml = this.createEmailList(data.emails.commonProviders, 'Common Provider Emails');
        
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

    createEmailList(emails, title) {
        if (emails.length === 0) return '';
        
        const emailItems = emails.slice(0, 10).map(email => 
            `<li>${this.escapeHtml(email)}</li>`
        ).join('');
        
        return `
            <div class="email-category">
                <h4>${title} (${emails.length})</h4>
                <ul class="email-list">
                    ${emailItems}
                </ul>
                ${emails.length > 10 ? `<p><em>... and ${emails.length - 10} more</em></p>` : ''}
            </div>
        `;
    }

    showError(message) {
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
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the form when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SecureContactForm();
});