#!/bin/bash
# setup_python_validator.sh
# Script to setup Python email-validator integration

echo "🚀 Setting up Python email-validator integration for ProMailHunter..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3 first."
    echo "Visit: https://www.python.org/downloads/"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip3 first."
    exit 1
fi

echo "✅ pip3 found: $(pip3 --version)"

# Install email-validator package
echo "📦 Installing email-validator package..."
pip3 install email-validator

# Verify installation
echo "🔍 Verifying installation..."
if python3 -c "import email_validator; print('✅ email-validator installed successfully')" 2>/dev/null; then
    echo "✅ Python email-validator is ready!"
    
    # Test the validator
    echo "🧪 Testing email validator..."
    python3 -c "
from email_validator import validate_email
result = validate_email('test@example.com', check_deliverability=False)
print(f'✅ Test successful: {result.normalized}')
"
    
    echo ""
    echo "🎉 Setup complete! The enhanced email verifier will now use Python email-validator for superior validation."
    echo ""
    echo "Features now available:"
    echo "  ✅ RFC-compliant email syntax validation"
    echo "  ✅ International domain name (IDN) support"
    echo "  ✅ Unicode email address support (SMTPUTF8)"
    echo "  ✅ Comprehensive deliverability checks"
    echo "  ✅ Domain literal support"
    echo "  ✅ Quoted local part validation"
    echo "  ✅ Display name parsing"
    echo ""
    
else
    echo "❌ Installation verification failed. Please check the error messages above."
    exit 1
fi