// test_email_verification.js
// Simple test script for email verification
// Usage: node test_email_verification.js

const EmailVerifier = require('./utils/emailVerifier');

async function testBasicVerification() {
    console.log('🔍 Testing Basic Email Verification\n');
    
    const emailVerifier = new EmailVerifier();
    
    // Test emails - simple cases
    const testEmails = [
        'test@gmail.com',
        'admin@google.com',
        'invalid@nonexistentdomain99999.com',
        'not-an-email'
    ];
    
    console.log('📧 Testing individual emails...\n');
    
    for (const email of testEmails) {
        console.log(`Testing: ${email}`);
        
        try {
            // Test MX record check first
            const mxResult = await emailVerifier.checkMXRecord(email);
            console.log(`  MX Check: ${mxResult.valid ? '✅ Valid' : '❌ Invalid'}`);
            if (mxResult.error) {
                console.log(`  Error: ${mxResult.error}`);
            }
            
            // Test full verification
            const fullResult = await emailVerifier.verifyEmail(email, {
                enableSMTP: true
            });
            
            console.log(`  Final Result: ${fullResult.finalResult.valid ? '✅ Valid' : '❌ Invalid'}`);
            console.log(`  Confidence: ${fullResult.finalResult.confidence}`);
            console.log(`  Checks: ${fullResult.checks.length}`);
            
        } catch (error) {
            console.error(`  ❌ Error: ${error.message}`);
        }
        
        console.log(''); // Empty line
    }
}

async function testBatchVerification() {
    console.log('🚀 Testing Batch Verification\n');
    
    const emailVerifier = new EmailVerifier();
    
    const emails = [
        'test@gmail.com',
        'admin@microsoft.com',
        'nonexistent@gmail.com'
    ];
    
    try {
        const results = await emailVerifier.verifyEmailBatch(emails, {
            enableSMTP: true,
            concurrency: 2,
            delay: 1000
        });
        
        console.log('Results:');
        results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.email}`);
            console.log(`   Valid: ${result.finalResult?.valid ? '✅' : '❌'}`);
            console.log(`   Confidence: ${result.finalResult?.confidence || 'unknown'}`);
        });
        
        // Calculate summary
        const valid = results.filter(r => r.finalResult?.valid === true).length;
        const total = results.length;
        
        console.log(`\nSummary: ${valid}/${total} valid (${((valid/total)*100).toFixed(1)}%)`);
        
    } catch (error) {
        console.error('Batch verification failed:', error.message);
    }
}

async function testFileGeneration() {
    console.log('💾 Testing File Generation\n');
    
    const EmailGenerator = require('./utils/emailGenerator');
    const emailGenerator = new EmailGenerator();
    
    try {
        // Generate some emails first
        const emailResult = await emailGenerator.processContact(
            'John',
            'Doe',
            'Test Company',
            false // Don't save yet
        );
        
        console.log(`Generated ${emailResult.data.emails.all.length} emails`);
        
        // Now verify a few
        const emailVerifier = new EmailVerifier();
        const emailsToTest = emailResult.data.emails.all.slice(0, 5);
        
        const verificationResults = await emailVerifier.verifyEmailBatch(emailsToTest, {
            enableSMTP: true,
            concurrency: 2,
            delay: 1500
        });
        
        // Save results
        const fileInfo = await emailVerifier.saveResults(verificationResults);
        console.log(`Results saved to: ${fileInfo.filename}`);
        
    } catch (error) {
        console.error('File generation test failed:', error.message);
    }
}

// Main test runner
async function runTests() {
    console.log('🧪 Starting Email Verification Tests\n');
    
    try {
        await testBasicVerification();
        console.log('─'.repeat(50));
        await testBatchVerification();
        console.log('─'.repeat(50));
        await testFileGeneration();
        
        console.log('\n✅ All tests completed!');
        
    } catch (error) {
        console.error('Test suite failed:', error.message);
    }
}

// Run if called directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };