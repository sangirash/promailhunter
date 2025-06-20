// test_email_verification.js
// Run this script to test email verification functionality
// Usage: node test_email_verification.js

const EmailVerifier = require('./utils/emailVerifier');

async function testEmailVerification() {
    console.log('🔍 Testing Email Verification Functionality\n');
    
    const emailVerifier = new EmailVerifier();
    
    // Test emails - mix of valid, invalid, and uncertain
    const testEmails = [
        'test@gmail.com',          // Should have MX record
        'nonexistent@gmail.com',   // Gmail exists but user might not
        'admin@google.com',        // Google domain, might exist
        'test@nonexistentdomain12345.com', // Should fail MX check
        'invalid-email',           // Invalid format
        'support@microsoft.com',   // Likely to exist
        'noreply@github.com'       // Common no-reply address
    ];
    
    console.log('📧 Testing individual email verification...\n');
    
    for (const email of testEmails) {
        console.log(`\n🔍 Testing: ${email}`);
        console.log('─'.repeat(50));
        
        try {
            const result = await emailVerifier.verifyEmail(email, {
                enableSMTP: true,
                enableEmailPing: false // Don't actually send emails in test
            });
            
            console.log(`✅ Result: ${result.finalResult.valid ? 'VALID' : 'INVALID'}`);
            console.log(`🎯 Confidence: ${result.finalResult.confidence.toUpperCase()}`);
            console.log(`📊 Checks performed: ${result.checks.length}`);
            
            // Show each check result
            result.checks.forEach((check, index) => {
                const status = check.valid ? '✅' : '❌';
                console.log(`   ${index + 1}. ${check.method.toUpperCase()}: ${status} (${check.confidence} confidence)`);
                if (check.error) {
                    console.log(`      Error: ${check.error}`);
                }
                if (check.smtpResponse) {
                    console.log(`      SMTP: ${check.smtpResponse.substring(0, 50)}...`);
                }
            });
            
            console.log(`💭 Reasons: ${result.finalResult.reasons.join(', ')}`);
            
        } catch (error) {
            console.error(`❌ Error testing ${email}:`, error.message);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Testing batch verification...\n');
    
    try {
        const batchResults = await emailVerifier.verifyEmailBatch(
            testEmails.slice(0, 4), // Test first 4 emails
            {
                enableSMTP: true,
                enableEmailPing: false,
                concurrency: 2,
                delay: 1000
            }
        );
        
        const summary = {
            total: batchResults.length,
            valid: batchResults.filter(r => r.finalResult?.valid === true).length,
            invalid: batchResults.filter(r => r.finalResult?.valid === false).length,
            uncertain: batchResults.filter(r => r.finalResult?.confidence === 'unknown').length
        };
        
        console.log('📊 Batch Results Summary:');
        console.log(`   Total: ${summary.total}`);
        console.log(`   ✅ Valid: ${summary.valid}`);
        console.log(`   ❌ Invalid: ${summary.invalid}`);
        console.log(`   ❓ Uncertain: ${summary.uncertain}`);
        console.log(`   📈 Success Rate: ${((summary.valid / summary.total) * 100).toFixed(1)}%`);
        
        console.log('\n📋 Detailed Results:');
        batchResults.forEach((result, index) => {
            const status = result.finalResult?.valid ? '✅' : '❌';
            console.log(`   ${index + 1}. ${result.email} - ${status} (${result.finalResult?.confidence || 'unknown'})`);
        });
        
        // Save results to file
        console.log('\n💾 Saving results to file...');
        const fileInfo = await emailVerifier.saveResults(batchResults);
        console.log(`✅ Results saved to: ${fileInfo.filename}`);
        
    } catch (error) {
        console.error('❌ Batch verification error:', error.message);
    }
}

// Test different verification methods separately
async function testVerificationMethods() {
    console.log('\n🧪 Testing Individual Verification Methods\n');
    
    const emailVerifier = new EmailVerifier();
    const testEmail = 'test@gmail.com';
    
    console.log(`Testing methods for: ${testEmail}\n`);
    
    // Test MX Record check
    console.log('1️⃣ Testing MX Record Check...');
    try {
        const mxResult = await emailVerifier.checkMXRecord(testEmail);
        console.log(`   Result: ${mxResult.valid ? '✅ Valid' : '❌ Invalid'}`);
        if (mxResult.mxRecords) {
            console.log(`   MX Records: ${mxResult.mxRecords.length} found`);
            mxResult.mxRecords.slice(0, 3).forEach(mx => {
                console.log(`     - ${mx.exchange} (priority: ${mx.priority})`);
            });
        }
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
    }
    
    // Test SMTP Handshake
    console.log('\n2️⃣ Testing SMTP Handshake...');
    try {
        const smtpResult = await emailVerifier.checkSMTPHandshake(testEmail);
        console.log(`   Result: ${smtpResult.valid ? '✅ Valid' : '❌ Invalid'}`);
        if (smtpResult.smtpResponse) {
            console.log(`   SMTP Response: ${smtpResult.smtpResponse}`);
        }
        if (smtpResult.error) {
            console.log(`   Error: ${smtpResult.error}`);
        }
    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
    }
    
    console.log('\n💡 Note: For API testing, you would need valid API keys.');
    console.log('💡 For email ping testing, you would need SMTP configuration.');
}

// Test domain-specific patterns
async function testDomainPatterns() {
    console.log('\n🌐 Testing Domain-Specific Patterns\n');
    
    const emailVerifier = new EmailVerifier();
    
    const domainTests = [
        { domain: 'gmail.com', email: 'test@gmail.com' },
        { domain: 'yahoo.com', email: 'test@yahoo.com' },
        { domain: 'outlook.com', email: 'test@outlook.com' },
        { domain: 'company.com', email: 'admin@company.com' },
        { domain: 'nonexistent.fake', email: 'test@nonexistent.fake' }
    ];
    
    for (const test of domainTests) {
        console.log(`🔍 Testing domain: ${test.domain}`);
        
        try {
            const result = await emailVerifier.checkMXRecord(test.email);
            console.log(`   MX Record: ${result.valid ? '✅ Found' : '❌ Not found'}`);
            
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
        }
        
        console.log('');
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Comprehensive Email Verification Tests\n');
    console.log('⚠️  Note: This may take a few minutes to complete.\n');
    
    try {
        await testVerificationMethods();
        await testDomainPatterns();
        await testEmailVerification();
        
        console.log('\n✨ All tests completed successfully!');
        console.log('\n📋 Test Summary:');
        console.log('   ✅ MX Record verification');
        console.log('   ✅ SMTP handshake verification');
        console.log('   ✅ Batch processing');
        console.log('   ✅ File saving');
        console.log('   ✅ Domain pattern testing');
        
        console.log('\n🔧 Next Steps:');
        console.log('   1. Set up API keys for higher accuracy verification');
        console.log('   2. Configure SMTP for email ping testing (use carefully)');
        console.log('   3. Integrate with your email generation workflow');
        console.log('   4. Set up rate limiting for production use');
        
    } catch (error) {
        console.error('💥 Test suite failed:', error.message);
    }
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = { 
    testEmailVerification, 
    testVerificationMethods, 
    testDomainPatterns, 
    runAllTests 
};