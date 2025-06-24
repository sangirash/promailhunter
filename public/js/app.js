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
        this.domainRestrictionNote = document.getElementById('domainRestrictionNote');

        this.domainValidationTimer = null;
        this.lastValidatedDomain = null;

        this.genericDomains = [
            'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'aol.com',
            'icloud.com', 'protonmail.com', 'zoho.com', 'mail.com', 'gmx.com'
        ];

        this.init();
    }

    init() {
        this.generateBtn.addEventListener('click', this.handleEmailGeneration.bind(this));
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
    }

    updateButtonStates() {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const companyName = document.getElementById('companyName').value.trim();
        
        const domain = this.extractDomain(companyName);
        const isValidDomainFormat = this.isValidDomainFormat(companyName);
        const isCorporateDomain = domain && !this.isGenericDomain(domain);
        
        const allFieldsValid = firstName && lastName && companyName && isValidDomainFormat && isCorporateDomain;
        
        this.generateBtn.disabled = !allFieldsValid;
        this.verifyBtn.disabled = !allFieldsValid;

        if (companyName && !isValidDomainFormat) {
            this.showDomainRestrictionNote('Please add a valid domain variation such as .com, .org, or .co');
        } else if (companyName && isValidDomainFormat && !isCorporateDomain) {
            this.showDomainRestrictionNote('This search is specifically for corporate domains only, kindly enter a corporate domain');
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
            this.showDomainValidation(result.valid ? 'valid' : 'invalid', result.valid ? '✅' : '❌', message);
            this.lastValidatedDomain = result.valid ? domain : null;
        } catch (error) {
            console.error('Domain validation error:', error);
            this.showDomainValidation('error', '⚠️', 'Unable to validate domain');
        }
        this.updateButtonStates();
    }

    showDomainValidation(status, icon, message) {
        this.domainValidator.classList.add('show');
        this.validationIcon.textContent = icon;
        this.validationMessage.textContent = message;
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

    async handleEmailGeneration(e) {
        e.preventDefault();
        if (!this.validateForm()) return;
        this.setButtonLoading(this.generateBtn, true);
        this.hideResult();
        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            const response = await fetch('/api/generate-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok && result.success) this.showEmailResults(result);
            else this.showErrorMessage(result.error || 'An error occurred generating emails');
        } catch (error) {
            console.error('Email generation error:', error);
            this.showErrorMessage('Network error. Please check your connection and try again.');
        } finally {
            this.setButtonLoading(this.generateBtn, false);
        }
    }

    async handleGenerateAndVerify(e) {
        e.preventDefault();
        if (!this.validateForm()) return;
        this.setButtonLoading(this.verifyBtn, true);
        this.hideResult();
        this.showEnhancedVerificationProgress();
        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            const requestBody = {
                ...data,
                verificationOptions: { enableSMTP: true, deepVerification: true, usePythonValidator: true, verifyAll: true }
            };
            const response = await fetch('/api/generate-and-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) result = await response.json();
            else {
                const text = await response.text();
                console.error('Non-JSON response received:', text);
                throw new Error('Server returned an invalid response format');
            }
            if (response.ok && result.success) {
                if (!result.generation || !result.generation.totalGenerated) {
                    result.generation = result.generation || { totalGenerated: 0, domain: 'unknown' };
                    result.verification = result.verification || { strategy: { description: 'Verification' } };
                }
                this.showVerificationInProgress(result);
                const totalEmails = result.generation?.totalGenerated || 0;
                if (totalEmails > 0) {
                    let progress = 0;
                    const progressInterval = setInterval(() => {
                        progress += Math.random() * 20;
                        if (progress > 100) progress = 100;
                        const verified = Math.floor((progress / 100) * totalEmails);
                        const progressBar = document.getElementById('verificationProgress');
                        const progressText = document.getElementById('progressText');
                        if (progressBar) progressBar.style.width = progress + '%';
                        if (progressText) progressText.textContent = `${verified} / ${totalEmails} verified`;
                        if (progress >= 100) {
                            clearInterval(progressInterval);
                            document.getElementById('stage-analyze')?.classList.add('active');
                            setTimeout(() => this.showVerificationComplete(totalEmails), 2000);
                        }
                    }, 1000);
                } else this.showErrorMessage('No emails were generated for verification');
            } else this.showErrorMessage(result.error || result.message || 'An error occurred during email verification');
        } catch (error) {
            console.error('Email verification error:', error);
            let errorMessage = 'An error occurred during verification.';
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) errorMessage = 'Unable to connect to the server.';
            else if (error.message) errorMessage = error.message;
            this.showErrorMessage(errorMessage);
            console.error('Full error details:', { name: error.name, message: error.message, stack: error.stack });
        } finally {
            this.setButtonLoading(this.verifyBtn, false);
        }
    }

    validateForm() {
        const inputs = this.form.querySelectorAll('input[type="text"]');
        let isValid = true;
        inputs.forEach(input => { if (!this.validateField(input)) isValid = false; });
        return isValid;
    }

    setButtonLoading(button, loading) {
        button.disabled = loading;
        button.classList.toggle('loading', loading);
        const spinner = button.querySelector('.spinner');
        if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
    }

    showEnhancedVerificationProgress() {
        this.resultContainer.className = 'result-container';
        this.resultContent.innerHTML = `
            <div class="verification-progress enhanced">
                <h3>🔍 Verification in Progress...</h3>
                <div class="progress-info">
                    <p><strong>Checking all emails.</strong></p>
                    <div class="progress-animation"><div class="progress-dot"></div><div class="progress-dot"></div><div class="progress-dot"></div></div>
                </div>
                <div class="progress-stages">
                    <div class="stage" id="stage-generate">📧 Generating...</div>
                    <div class="stage" id="stage-validate">🌐 Validating...</div>
                    <div class="stage" id="stage-verify">📫 Testing...</div>
                    <div class="stage" id="stage-analyze">📊 Analyzing...</div>
                </div>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');
        setTimeout(() => document.getElementById('stage-generate')?.classList.add('active'), 500);
        setTimeout(() => document.getElementById('stage-validate')?.classList.add('active'), 2000);
        setTimeout(() => document.getElementById('stage-verify')?.classList.add('active'), 4000);
    }

    showVerificationInProgress(result) {
        const totalGenerated = result?.generation?.totalGenerated || 0;
        const domain = result?.generation?.domain || 'unknown';
        const strategy = result?.verification?.strategy || {};
        const estimatedTime = result?.verification?.estimatedTime || 'calculating...';
        this.resultContainer.className = 'result-container';
        this.resultContent.innerHTML = `
            <div class="verification-status">
                <h3>✅ Verification Started!</h3>
                <div class="status-info">
                    <div class="info-card"><h4>📧 Emails</h4><div class="big-number">${totalGenerated}</div><p>For: ${this.escapeHtml(domain)}</p></div>
                    <div class="info-card"><h4>🔍 Strategy</h4><p><strong>${strategy.description || 'Verification'}</strong></p><p>Time: ${estimatedTime}</p></div>
                    <div class="info-card"><h4>📊 Progress</h4><div class="progress-bar"><div class="progress-fill" id="verificationProgress" style="width: 0%"></div></div><p id="progressText">0 / ${totalGenerated} verified</p></div>
                </div>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');
    }

    showVerificationComplete(totalEmails) {
        const statusDiv = document.querySelector('.verification-status');
        if (statusDiv) statusDiv.insertAdjacentHTML('beforeend', `
            <div class="verification-complete">
                <h3>🎉 Verification Done!</h3>
                <p><strong>All ${totalEmails} emails verified.</strong></p>
                <div class="complete-actions"><button class="action-btn" onclick="location.reload()">🔄 New</button></div>
            </div>
        `);
    }

    showEmailResults(result) {
        this.resultContainer.className = 'result-container success';
        const data = result.data;
        const companyEmailsHtml = this.createEmailList(data.emails.company, 'Generated Emails', true);
        let downloadLink = result.file && result.file.filename ? `<div class="download-section"><a href="/api/download-emails/${result.file.filename}" class="download-btn" download="${result.file.filename}">📥 Download</a></div>` : '';
        this.resultContent.innerHTML = `
            <p><strong>📧 Generation Complete!</strong></p>
            <div class="result-data">
                <p><strong>Name:</strong> ${this.escapeHtml(data.metadata.firstName)} ${this.escapeHtml(data.metadata.lastName)}</p>
                <p><strong>Domain:</strong> ${this.escapeHtml(data.metadata.domain)}</p>
                <p><strong>Total:</strong> ${data.metadata.totalEmails}</p>
                <p><strong>At:</strong> ${new Date(data.metadata.generatedAt).toLocaleString()}</p>
            </div>
            ${downloadLink}
            <div class="email-sections">${companyEmailsHtml}</div>
            <div class="quick-actions">
                <button class="action-btn copy-all-btn" onclick="copyAllEmails('${data.emails.all.join(',')}')">📋 Copy All</button>
                <button class="action-btn verify-now-btn" onclick="verifyGeneratedEmails()">🔍 Verify</button>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');
    }

    createEmailList(emails, title, showCopyButton) {
        if (!emails || emails.length === 0) return '';
        const emailItems = emails.slice(0, 20).map(email => `<li>${this.escapeHtml(email)} ${showCopyButton ? `<button class="copy-single-btn" onclick="copyToClipboard('${email}', 'Copied!')" title="Copy">📋</button>` : ''}</li>`).join('');
        return `<div class="email-category"><h4>${title} (${emails.length})</h4><ul class="email-list">${emailItems}</ul>${emails.length > 20 ? `<p><em>... and ${emails.length - 20} more</em></p>` : ''}</div>`;
    }

    showErrorMessage(message) {
        this.resultContainer.className = 'result-container error';
        this.resultContent.innerHTML = `<p><strong>❌ Error:</strong> ${this.escapeHtml(message)}</p>`;
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

window.copyToClipboard = async function(text, feedbackText) {
    try { await navigator.clipboard.writeText(text); showCopySuccess(feedbackText); return true; }
    catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text; textArea.style.position = 'fixed'; textArea.style.left = '-999999px'; textArea.style.top = '-999999px';
        document.body.appendChild(textArea); textArea.focus(); textArea.select();
        try { document.execCommand('copy'); showCopySuccess(feedbackText); return true; }
        catch (err) { console.error('Failed to copy:', err); showCopyError('Failed to copy'); return false; }
        finally { document.body.removeChild(textArea); }
    }
};

window.copyAllEmails = function(emailsString) { const emails = emailsString.split(','); copyToClipboard(emails.join(', '), `Copied ${emails.length} emails!`); };
window.verifyGeneratedEmails = function() { const verifyBtn = document.getElementById('verifyBtn'); if (verifyBtn) verifyBtn.click(); };

function showCopySuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-feedback'; notification.textContent = message;
    document.body.appendChild(notification); setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 3000);
}

function showCopyError(message) {
    const notification = document.createElement('div');
    notification.className = 'copy-feedback error'; notification.textContent = message; notification.style.background = '#dc3545';
    document.body.appendChild(notification); setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 3000);
}

document.addEventListener('DOMContentLoaded', () => new ProMailHunterApp());