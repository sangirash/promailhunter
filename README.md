# ProMailHunter v2.0 - Complete Installation Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Node.js Dependencies
```bash
# Clone or navigate to your project directory
cd promailhunter

# Install Node.js dependencies
npm install
```

### Step 2: Setup Python Email-Validator (Recommended)
```bash
# Option A: Use our setup script (easiest)
chmod +x setup_python_validator.sh
./setup_python_validator.sh

# Option B: Manual installation
pip3 install email-validator

# Option C: Using virtual environment (recommended for production)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install email-validator
```

### Step 3: Start the Server
```bash
npm start
```

### Step 4: Test Everything Works
```bash
# Test enhanced verification
npm run test-enhanced

# Quick API test
curl -X GET http://localhost:3000/api/verifier-status
```

## 📋 Detailed Installation

### Prerequisites
- **Node.js 14+** (required)
- **npm 6+** (required)  
- **Python 3.8+** (recommended for enhanced features)
- **pip3** (recommended)

### Platform-Specific Setup

#### 🖥️ Windows
```powershell
# Install Python from python.org
# Add Python to PATH during installation

# Install email-validator
pip install email-validator

# If you get permission errors:
pip install --user email-validator
```

#### 🐧 Linux (Ubuntu/Debian)
```bash
# Install Python and pip
sudo apt update
sudo apt install python3 python3-pip

# Install email-validator
pip3 install email-validator

# Or with sudo if needed
sudo pip3 install email-validator
```

#### 🍎 macOS
```bash
# Using Homebrew (recommended)
brew install python3

# Install email-validator
pip3 install email-validator

# Using macOS built-in Python
python3 -m pip install email-validator
```

#### 🐳 Docker Setup
```dockerfile
FROM node:18-alpine

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

# Install email-validator
RUN pip3 install email-validator

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Production Deployment

#### Environment Variables
```bash
# Create .env file
NODE_ENV=production
PORT=3000
API_BASE_URL=https://jsonplaceholder.typicode.com
API_TIMEOUT=5000
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Enhanced verification settings
PYTHON_VALIDATOR_TIMEOUT=15000
ENHANCED_VERIFICATION=true
CORPORATE_INTELLIGENCE=true
PATTERN_MATCHING=true
```

#### Process Management (PM2)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name "promailhunter"

# Setup auto-restart
pm2 startup
pm2 save
```

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔧 Configuration Options

### Basic Configuration
```javascript
// config/enhanced.js (create this file)
module.exports = {
  // Python validator settings
  pythonValidator: {
    enabled: true,
    timeout: 15000,
    fallbackToNodeJS: true
  },
  
  // Corporate intelligence
  corporateIntelligence: {
    enabled: true,
    domains: [
      'microsoft.com', 'google.com', 'ukg.com', 
      'apple.com', 'amazon.com', 'salesforce.com'
    ]
  },
  
  // Verification options
  verification: {
    enableSMTP: true,
    enableDeliverability: true,
    allowUnicode: true,
    allowQuoted: true,
    timeout: 15,
    concurrency: 3,
    delay: 2000
  }
};
```

### Advanced Configuration
```javascript
// utils/enhancedConfig.js
const EnhancedEmailVerifier = require('./enhancedEmailVerifier');

class EnhancedConfig {
  static configure(options = {}) {
    const verifier = new EnhancedEmailVerifier();
    
    // Configure corporate domains
    if (options.corporateDomains) {
      verifier.corporateDomainsWithStrictSecurity = [
        ...verifier.corporateDomainsWithStrictSecurity,
        ...options.corporateDomains
      ];
    }
    
    // Configure email patterns
    if (options.emailPatterns) {
      Object.assign(verifier.knownValidPatterns, options.emailPatterns);
    }
    
    // Configure timeouts
    if (options.timeouts) {
      verifier.timeout = options.timeouts.general || verifier.timeout;
      verifier.smtpTimeout = options.timeouts.smtp || verifier.smtpTimeout;
      verifier.pythonTimeout = options.timeouts.python || verifier.pythonTimeout;
    }
    
    return verifier;
  }
}

module.exports = EnhancedConfig;
```

## 🧪 Testing & Validation

### Test Scripts Overview
```bash
# Basic functionality
npm test                    # Original email generator tests
npm run test-verification   # Original verification tests

# Enhanced functionality  
npm run test-enhanced      # Comprehensive enhanced tests
npm run test-ukg          # UKG-specific verification tests

# Setup validation
./setup_python_validator.sh # Python validator setup
```

### Manual Testing
```bash
# Test Python validator directly
python3 -c "
from email_validator import validate_email
result = validate_email('test@gmail.com')
print(f'Valid: {result.normalized}')
"

# Test API endpoints
curl -X POST http://localhost:3000/api/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email": "devesh.bhatt@ukg.com"}'

# Test batch verification
curl -X POST http://localhost:3000/api/verify-emails-batch \
  -H "Content-Type: application/json" \
  -d '{"emails": ["test@gmail.com", "user@ukg.com"]}'
```

### Load Testing
```bash
# Install Apache Bench
sudo apt install apache2-utils  # Linux
brew install httpie            # macOS

# Test endpoint performance
ab -n 100 -c 10 -H "Content-Type: application/json" \
   -p test_data.json http://localhost:3000/api/verify-email
```

## 🔍 Verification Examples

### Basic Email Verification
```javascript
const EnhancedEmailVerifier = require('./utils/enhancedEmailVerifier');
const verifier = new EnhancedEmailVerifier();

// Simple verification
const result = await verifier.verifyEmail('user@example.com');
console.log(result.finalResult.valid); // true/false
```

### Advanced Verification
```javascript
// Enhanced verification with all options
const result = await verifier.verifyEmail('devesh.bhatt@ukg.com', {
  usePythonValidator: true,
  enableSMTP: true,
  enableDeliverability: true,
  allowUTF8: true,
  allowQuoted: true,
  globallyDeliverable: true,
  timeout: 15
});

console.log('Verification Result:', {
  valid: result.finalResult.valid,
  confidence: result.finalResult.confidence,
  method: result.finalResult.method,
  corporateDomain: result.finalResult.corporateDomain,
  patternMatch: result.finalResult.patternMatch,
  normalized: result.finalResult.normalized
});
```

### Batch Processing
```javascript
const emails = [
  'user1@gmail.com',
  'user2@microsoft.com', 
  'user3@ukg.com',
  'invalid@fake.domain'
];

const results = await verifier.verifyEmailBatch(emails, {
  usePythonValidator: true,
  concurrency: 3,
  delay: 2000
});

// Analyze results
const summary = {
  total: results.length,
  valid: results.filter(r => r.finalResult?.valid).length,
  pythonValidated: results.filter(r => r.finalResult?.method === 'python-email-validator').length
};

console.log('Batch Summary:', summary);
```

### International Email Testing
```javascript
const internationalEmails = [
  'user@müller.de',           // German
  'test@café.fr',             // French  
  'admin@тест.рф',            // Russian
  '用户@测试.中国'              // Chinese
];

for (const email of internationalEmails) {
  const result = await verifier.verifyEmail(email, {
    usePythonValidator: true,
    allowUTF8: true
  });
  
  console.log(`${email}: ${result.finalResult.valid ? '✅' : '❌'}`);
  if (result.finalResult.normalized !== email) {
    console.log(`  Normalized: ${result.finalResult.normalized}`);
  }
}
```

## 🚨 Troubleshooting

### Common Issues & Solutions

#### 1. Python Not Found
```bash
# Error: python3: command not found
# Solution: Install Python 3

# Ubuntu/Debian
sudo apt install python3 python3-pip

# CentOS/RHEL
sudo yum install python3 python3-pip

# macOS
brew install python3

# Windows
# Download from python.org and add to PATH
```

#### 2. Email-Validator Installation Fails
```bash
# Error: pip install email-validator fails
# Solutions:

# Try with user flag
pip3 install --user email-validator

# Try with sudo (Linux/macOS)
sudo pip3 install email-validator

# Use virtual environment
python3 -m venv venv
source venv/bin/activate
pip install email-validator

# Update pip first
pip3 install --upgrade pip
pip3 install email-validator
```

#### 3. Permission Denied on Setup Script
```bash
# Error: Permission denied: setup_python_validator.sh
# Solution:
chmod +x setup_python_validator.sh
./setup_python_validator.sh
```

#### 4. Python Process Timeout
```bash
# Error: Python process timeout
# Solution: Increase timeout in config

# In .env file:
PYTHON_VALIDATOR_TIMEOUT=30000

# Or in code:
const verifier = new EnhancedEmailVerifier();
verifier.pythonTimeout = 30000;
```

#### 5. SMTP Connection Issues
```bash
# Corporate firewalls may block SMTP
# This is expected behavior, not an error

# Verification will fall back to:
# 1. MX record checking
# 2. Pattern matching (for known domains)
# 3. Python email-validator syntax validation
```

#### 6. DNS Resolution Failures
```bash
# Temporary DNS issues
# Solutions:

# 1. Check internet connectivity
ping google.com

# 2. Try different DNS servers
# Add to /etc/resolv.conf (Linux):
nameserver 8.8.8.8
nameserver 1.1.1.1

# 3. Increase timeout values
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=promailhunter:* npm start

# Or set environment variable
DEBUG_EMAIL_GENERATION=true npm start

# Check Python integration
node -e "
const EnhancedEmailVerifier = require('./utils/enhancedEmailVerifier');
const v = new EnhancedEmailVerifier();
setTimeout(() => console.log('Python available:', v.pythonAvailable), 2000);
"
```

### Health Checks
```bash
# API health check
curl http://localhost:3000/api/health

# Enhanced verifier status
curl http://localhost:3000/api/verifier-status

# Test specific functionality
curl -X POST http://localhost:3000/api/test-enhanced-verification
```

## 📊 Performance Optimization

### Python Process Optimization
```javascript
// Optimize Python subprocess usage
const verifier = new EnhancedEmailVerifier();

// Reduce timeout for faster fallback
verifier.pythonTimeout = 10000;

// Disable Python for high-volume, time-sensitive operations
const fastResult = await verifier.verifyEmail(email, {
  usePythonValidator: false  // Use Node.js validation only
});
```

### Batch Processing Optimization
```javascript
// Optimize for different scenarios

// High accuracy (slower)
const accurateResults = await verifier.verifyEmailBatch(emails, {
  usePythonValidator: true,
  enableSMTP: true,
  concurrency: 2,
  delay: 3000
});

// High speed (faster)
const fastResults = await verifier.verifyEmailBatch(emails, {
  usePythonValidator: false,
  enableSMTP: false,
  concurrency: 5,
  delay: 1000
});

// Balanced approach
const balancedResults = await verifier.verifyEmailBatch(emails, {
  usePythonValidator: true,
  enableSMTP: false,  // Skip slow SMTP for corporate domains
  concurrency: 3,
  delay: 2000
});
```

### Memory Management
```javascript
// For high-volume processing
const verifier = new EnhancedEmailVerifier();

// Process in smaller batches to manage memory
const chunkSize = 50;
const allResults = [];

for (let i = 0; i < emails.length; i += chunkSize) {
  const chunk = emails.slice(i, i + chunkSize);
  const chunkResults = await verifier.verifyEmailBatch(chunk);
  allResults.push(...chunkResults);
  
  // Optional: garbage collection hint
  if (global.gc) global.gc();
}
```

## 🔐 Security Considerations

### Rate Limiting
```javascript
// Enhanced rate limiting for verification endpoints
const { rateLimit } = require('express-rate-limit');

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 verification requests per windowMs
  message: 'Too many verification requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/verify-email', verificationLimiter);
app.use('/api/verify-emails-batch', verificationLimiter);
```

### Input Sanitization
```javascript
// All inputs are automatically sanitized
const sanitizer = require('./utils/sanitizer');

// Email addresses are cleaned
const cleanEmail = sanitizer.sanitizeText(userInput);

// Validation options are filtered
const safeOptions = {
  enableSMTP: Boolean(options.enableSMTP),
  timeout: Math.min(Math.max(options.timeout || 15, 5), 60)
};
```

### Process Security
```javascript
// Python subprocess is sandboxed
const { spawn } = require('child_process');

const python = spawn('python3', ['-c', script, email, options], {
  timeout: this.pythonTimeout,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, PYTHONPATH: '' }, // Clean environment
  cwd: __dirname // Controlled working directory
});
```

## 📈 Monitoring & Metrics

### Performance Metrics
```javascript
// Track verification performance
class VerificationMetrics {
  static track(method, duration, success) {
    console.log(`Verification: ${method}, Duration: ${duration}ms, Success: ${success}`);
    
    // Send to monitoring service
    // metrics.increment('email_verification.total');
    // metrics.timing('email_verification.duration', duration);
    // metrics.increment(`email_verification.method.${method}`);
  }
}

// Usage in verifier
const start = Date.now();
const result = await verifier.verifyEmail(email);
const duration = Date.now() - start;
VerificationMetrics.track(result.finalResult.method, duration, result.finalResult.valid);
```

### Health Monitoring
```javascript
// Monitor system health
app.get('/api/health-detailed', async (req, res) => {
  const health = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {
      nodejs: { status: 'up', version: process.version },
      python: { status: 'unknown', available: false },
      emailValidator: { status: 'unknown', available: false }
    }
  };
  
  // Check Python availability
  try {
    const verifier = new EnhancedEmailVerifier();
    await new Promise(resolve => setTimeout(resolve, 1000));
    health.services.python.status = 'up';
    health.services.python.available = verifier.pythonAvailable;
    health.services.emailValidator.status = verifier.pythonAvailable ? 'up' : 'down';
    health.services.emailValidator.available = verifier.pythonAvailable;
  } catch (error) {
    health.services.python.status = 'down';
    health.services.python.error = error.message;
  }
  
  res.json(health);
});
```

## 🚀 Production Deployment Checklist

### Pre-Deployment
- [ ] Python 3.8+ installed on production server
- [ ] `email-validator` package installed (`pip3 install email-validator`)
- [ ] All tests passing (`npm run test-enhanced`)
- [ ] Environment variables configured
- [ ] Rate limiting configured appropriately
- [ ] Monitoring and logging setup

### Deployment
- [ ] Deploy code to production server
- [ ] Run `npm install --production`
- [ ] Verify Python integration: `curl /api/verifier-status`
- [ ] Test email verification: `curl /api/test-enhanced-verification`
- [ ] Monitor initial traffic and performance
- [ ] Set up process management (PM2, systemd, etc.)

### Post-Deployment
- [ ] Monitor error rates and performance
- [ ] Check Python subprocess stability
- [ ] Verify enhanced features working
- [ ] Set up alerting for failures
- [ ] Document any production-specific configurations

## 🎉 You're All Set!

ProMailHunter v2.0 with Python email-validator integration is now ready for production use. You have access to:

✅ **Enterprise-grade email validation**  
✅ **International email support**  
✅ **Corporate domain intelligence**  
✅ **High-performance batch processing**  
✅ **RFC-compliant validation**  
✅ **Graceful fallback mechanisms**

For support, issues, or feature requests, please check our documentation or create an issue in the repository.

Happy email hunting! 🎯📧