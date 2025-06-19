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

    showSuccess(result) {
        this.resultContainer.className = 'result-container success';
        this.resultContent.innerHTML = `
            <p><strong>✅ Success!</strong> Your information has been submitted successfully.</p>
            <div class="result-data">
                <p><strong>Name:</strong> ${this.escapeHtml(result.submittedData.firstName)} ${this.escapeHtml(result.submittedData.lastName)}</p>
                <p><strong>Company:</strong> ${this.escapeHtml(result.submittedData.companyName)}</p>
                <p><strong>API Response ID:</strong> ${result.apiResponse.id}</p>
                <p><strong>Status:</strong> ${this.escapeHtml(result.apiResponse.status)}</p>
            </div>
        `;
        this.resultContainer.classList.remove('hidden');
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