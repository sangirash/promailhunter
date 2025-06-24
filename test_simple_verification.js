// test_simple_verification.js - Simple test that works with current setup
// Run with: node test_simple_verification.js

const EnhancedEmailVerifier = require('./utils/enhancedEmailVerifier');

async function testSimpleVerification() {
    const verifier = new EnhancedEmailVerifier();
    
    console.log('🧪 TESTING EMAIL VERIFICATION\n');
    
    // Test with your known good email
    const knownGoodEmail = 'lmyneni@osius.com'; // Your known good email
    
    console.log(`Testing known good email: ${knownGoodEmail}\n`);
    
    try {
        // Test 1: Basic verification
        console.log('1️⃣ Running basic verification...');
        const basicResult = await verifier.verifyEmail(knownGoodEmail, {
            enableSMTP: false, // Skip SMTP for now
            deepVerification: false
        });
        
        console.log(`   Valid: ${basicResult.finalResult?.valid ? '✅' : '❌'}`);
        console.log(`   Confidence: ${basicResult.finalResult?.confidence || 'N/A'}`);
        
        // Test 2: Deep verification
        console.log('\n2️⃣ Running deep verification...');
        const deepResult = await verifier.verifyEmail(knownGoodEmail, {
            enableSMTP: true,
            deepVerification: true
        });
        
        console.log(`   Valid: ${deepResult.finalResult?.valid ? '✅' : '❌'}`);
        console.log(`   Confidence: ${deepResult.finalResult?.confidence || 'N/A'}`);
        console.log(`   Mailbox tested: ${deepResult.finalResult?.mailboxTested ? 'Yes' : 'No'}`);
        console.log(`   Reasons:`);
        if (deepResult.finalResult?.reasons) {
            deepResult.finalResult.reasons.forEach(r => console.log(`     - ${r}`));
        }
        
        // Test 3: Pattern check
        console.log('\n3️⃣ Checking pattern match...');
        const [username, domain] = knownGoodEmail.split('@');
        const patternCheck = verifier.checkAgainstKnownPatterns(knownGoodEmail);
        console.log(`   Username: ${username}`);
        console.log(`   Pattern found: ${patternCheck.isKnownPattern ? `Yes - ${patternCheck.pattern}` : 'No'}`);
        console.log(`   Confidence: ${patternCheck.confidence}`);
        
        // Test 4: Test a batch
        console.log('\n4️⃣ Testing batch verification...');
        const testBatch = [
            knownGoodEmail,
            'test@' + domain,
            'admin@' + domain,
            username.split(/[._-]/)[0] + '@' + domain, // First name only
            'invalid.definitely.not.exists@' + domain
        ];
        
        console.log(`   Testing ${testBatch.length} emails...`);
        const batchResults = await verifier.verifyEmailBatch(testBatch, {
            enableSMTP: true,
            deepVerification: true,
            concurrency: 1,
            delay: 2000
        });
        
        const validCount = batchResults.filter(r => r.finalResult?.valid === true).length;
        const invalidCount = batchResults.filter(r => r.finalResult?.valid === false).length;
        
        console.log(`\n   Results:`);
        console.log(`   Valid: ${validCount}/${testBatch.length}`);
        console.log(`   Invalid: ${invalidCount}/${testBatch.length}`);
        
        console.log(`\n   Detailed results:`);
        batchResults.forEach((result, i) => {
            const email = testBatch[i];
            const status = result.finalResult?.valid ? '✅' : '❌';
            const confidence = result.finalResult?.confidence || 'unknown';
            console.log(`   ${status} ${email} (${confidence})`);
        });
        
        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 SUMMARY:');
        if (!deepResult.finalResult?.valid) {
            console.log('⚠️  Your known good email was marked as INVALID!');
            console.log('   This suggests verification may be too strict.');
            console.log('\n   Possible causes:');
            console.log('   1. SMTP verification is being blocked');
            console.log('   2. The domain has strict security policies');
            console.log('   3. Pattern matching needs adjustment');
            console.log('\n   The fixes in the updated code should help!');
        } else {
            console.log('✅ Your known good email was correctly validated!');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
console.log('Starting verification test...\n');
testSimpleVerification().catch(console.error);