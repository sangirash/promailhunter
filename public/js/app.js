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

        this.genericDomains = [
            'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'aol.com',
            'icloud.com', 'protonmail.com', 'zoho.com', 'mail.com', 'gmx.com'
        ];

        this.init();
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
    }

    updateButtonStates() {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const companyName = document.getElementById('companyName').value.trim();
        
        const domain = this.extractDomain(companyName);
        const isValidDomainFormat = this.isValidDomainFormat(companyName);
        const isCorporateDomain = domain && !this.isGenericDomain(domain);
        
        const allFieldsValid = firstName && lastName && companyName && isValidDomainFormat && isCorporateDomain;
        
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

    async handleGenerateAndVerify(e) {
        e.preventDefault();
        if (!this.validateForm()) return;
        
        this.setButtonLoading(this.verifyBtn, true);
        this.showVerificationProgress();
        
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
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Process the results and show top 3 emails with probabilities
                this.processAndDisplayResults(result, data);
            } else {
                this.showErrorMessage(result.error || 'Verification failed');
            }
        } catch (error) {
            console.error('Email verification error:', error);
            this.showErrorMessage('An error occurred during verification. Please try again.');
        } finally {
            this.setButtonLoading(this.verifyBtn, false);
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
            emailsWithProbability = validEmails.map(email => {
                const prob = this.calculateEmailProbability(email, validEmails.length);
                return { email, probability: prob };
            });
        }
        // Case 4: 4-10 valid emails
        else {
            // Calculate probabilities for all valid emails
            const allEmailsWithProb = validEmails.map(email => {
                const prob = this.calculateEmailProbability(email, validEmails.length);
                return { email, probability: prob };
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
                                    <button class="copy-btn" onclick="copyToClipboard('${item.email}', 'Copied!')">
                                        Copy
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <div style="margin-top: 20px; text-align: center;">
                <button class="action-btn" onclick="location.reload()" style="padding: 8px 20px;">
                    🔄 New Search
                </button>
            </div>
        `;
        
        this.resultContent.innerHTML = tableHTML;
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
                <button class="action-btn" onclick="location.reload()" style="margin-top: 20px; padding: 8px 20px;">
                    🔄 Try Again
                </button>
            </div>
        `;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

// Add fade out animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        0% { opacity: 1; }
        70% { opacity: 1; }
        100% { opacity: 0; }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => new ProMailHunterApp());