// test_verification_fix.js - Create this file in your project root
// Run with: node test_verification_fix.js

const EnhancedEmailVerifier = require('./utils/enhancedEmailVerifier');

async function testVerificationFix() {
    const verifier = new EnhancedEmailVerifier();
    
    console.log('🧪 TESTING EMAIL VERIFICATION FIX\n');
    
    // Test emails - add your known good email here
    const testEmails = [
        'john.doe@example.com',      // Generic test
        'test@gmail.com',            // Public provider
        'user@microsoft.com',        // Corporate domain
        // ADD YOUR KNOWN GOOD EMAIL HERE:
        // 'your.email@yourdomain.com'
    ];
    
    console.log('Testing individual emails:\n');
    
    for (const email of testEmails) {
        console.log(`\n📧 Testing: ${email}`);
        console.log('-'.repeat(50));
        
        const result = await verifier.deepVerifyEmail(email);
        
        console.log(`Valid: ${result.finalResult.valid ? '✅ YES' : '❌ NO'}`);
        console.log(`Confidence: ${result.finalResult.confidence}`);
        console.log(`Mailbox Tested: ${result.finalResult.mailboxTested ? 'Yes' : 'No'}`);
        console.log(`Mailbox Exists: ${result.finalResult.mailboxExists === true ? 'Yes' : result.finalResult.mailboxExists === false ? 'No' : 'Unknown'}`);
        console.log('Reasons:');
        result.finalResult.reasons.forEach(r => console.log(`  - ${r}`));
        
        if (result.finalResult.patternMatch) {
            console.log(`Pattern Match: ${result.finalResult.patternMatch}`);
        }
    }
    
    // Test batch verification
    console.log('\n\n📦 TESTING BATCH VERIFICATION\n');
    console.log('Generating sample emails for verification...\n');
    
    const sampleEmails = [
        'john.doe@example.com',
        'jane.smith@example.com',
        'j.doe@example.com',
        'johndoe@example.com',
        'john@example.com',
        'jdoe@example.com',
        'john.d@example.com',
        'john_doe@example.com',
        'john-doe@example.com',
        'doe.john@example.com'
    ];
    
    const batchResult = await verifier.verifyEmailBatchWithStats(sampleEmails, {
        enableSMTP: true,
        deepVerification: true,
        concurrency: 2,
        delay: 2000
    });
    
    console.log('\n✅ Test complete! Check the statistics above.');
    console.log('\nIf emails are still being marked as invalid when they shouldn\'t be:');
    console.log('1. Check if SMTP is being blocked by your firewall');
    console.log('2. Try running the diagnostic test endpoint');
    console.log('3. Add your known good email to the test array above');
}

// Run the test
testVerificationFix().catch(console.error);