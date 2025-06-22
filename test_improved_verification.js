// test_improved_verification.js
// Test the improved email verification system
// Usage: node test_improved_verification.js

// You would replace this with: const EmailVerifier = require('./utils/emailVerifier');
// const ImprovedEmailVerifier = require('./improved_emailVerifier');

async function testImprovedVerification() {
    console.log('🚀 Testing Improved Email Verification System\n');
    
    // Initialize the improved verifier
    const emailVerifier = new emailVerifier(); // Use improved version
    
    // Test cases including the problematic "firstname.lastname@company.com" pattern
    const testCases = [
        {
            email: 'firstname.lastname@company.com',
            expected: 'Should be VALID (your confirmed working example)',
            description: 'The problematic case you mentioned'
        },
        {
            email: 'john.doe@ukg.com',
            expected: 'Should be VALID (corporate pattern)',
            description: 'UKG corporate email with known pattern'
        },
        {
            email: 'devesh.bhatt@ukg.com',
            expected: 'Should be VALID (real UKG pattern)',
            description: 'Real UKG email format'
        },
        {
            email: 'admin@microsoft.com',
            expected: 'Should be VALID (corporate domain)',
            description: 'Microsoft corporate email'
        },
        {
            email: 'test@gmail.com',
            expected: 'Should be VALID (common provider)',
            description: 'Gmail consumer email'
        },
        {
            email: 'invalid@nonexistentdomain99999.xyz',
            expected: 'Should be INVALID (fake domain)',
            description: 'Non-existent domain'
        },
        {
            email: 'sarah_johnson@salesforce.com',
            expected: 'Should be VALID (underscore pattern)',
            description: 'Corporate email with underscore'
        },
        {
            email: 'mike123@oracle.com',
            expected: 'Should be VALID (number suffix)',
            description: 'Corporate email with number'
        },
        {
            email: 'a@company.com',
            expected: 'Should be INVALID (too short username)',
            description: 'Single character username'
        },
        {
            email: 'not-an-email',
            expected: 'Should be INVALID (bad format)',
            description: 'Invalid email format'
        }
    ];
    
    console.log('📋 Test Cases:');
    testCases.forEach((test, index) => {
        console.log(`${index + 1}. ${test.email}`);
        console.log(`   Expected: ${test.expected}`);
        console.log(`   Description: ${test.description}\n`);
    });
    
    console.log('🔍 Starting Individual Email Tests...\n');
    
    // Test each email individually
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`📧 Test ${i + 1}: ${testCase.email}`);
        console.log(`   Expected: ${testCase.expected}`);
        
        try {
            const startTime = Date.now();
            const result = await emailVerifier.verifyEmail(testCase.email, {
                enableSMTP: true
            });
            const endTime = Date.now();
            
            console.log(`   ✅ Result: ${result.finalResult.valid ? 'VALID' : 'INVALID'}`);
            console.log(`   🔍 Confidence: ${result.finalResult.confidence}`);
            console.log(`   ⏱️  Time: ${endTime - startTime}ms`);
            console.log(`   📝 Reasons: ${result.finalResult.reasons.join(', ')}`);
            
            if (result.finalResult.patternMatch) {
                console.log(`   🎯 Pattern Match: ${result.finalResult.patternMatch}`);
            }
            
            if (result.finalResult.corporateDomain) {
                console.log(`   🏢 Corporate Domain: Yes`);
            }
            
            // Show detailed check results
            console.log(`   🔧 Checks Performed:`);
            result.checks.forEach(check => {
                const status = check.valid === true ? '✅' : check.valid === false ? '❌' : '❓';
                console.log(`      ${status} ${check.method}: ${check.confidence || 'unknown'}`);
                if (check.note) console.log(`         Note: ${check.note}`);
                if (check.error) console.log(`         Error: ${check.error}`);
            });
            
            // Analyze if result matches expectation
            const shouldBeValid = testCase.expected.includes('VALID');
            const isCorrect = (result.finalResult.valid === shouldBeValid);
            console.log(`   🎯 Test Result: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        console.log('   ' + '─'.repeat(60) + '\n');
    }
    
    console.log('🚀 Starting Batch Verification Test...\n');
    
    // Test batch verification with the problematic emails
    const batchEmails = [
        'firstname.lastname@company.com', // Your problematic case
        'john.doe@ukg.com',
        'devesh.bhatt@ukg.com',
        'sarah_johnson@microsoft.com',
        'test@gmail.com'
    ];
    
    try {
        const batchResults = await emailVerifier.verifyEmailBatch(batchEmails, {
            enableSMTP: true,
            concurrency: 1, // Very conservative for testing
            delay: 3000
        });
        
        console.log('\n📊 Batch Results Summary:');
        console.log('=' .repeat(70));
        
        batchResults.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.email}`);
            console.log(`   Status: ${result.finalResult.valid ? '✅ VALID' : '❌ INVALID'}`);
            console.log(`   Confidence: ${result.finalResult.confidence}`);
            console.log(`   Pattern: ${result.finalResult.patternMatch || 'None detected'}`);
            console.log(`   Corporate: ${result.finalResult.corporateDomain ? 'Yes' : 'No'}`);
            console.log(`   Reasons: ${result.finalResult.reasons.join(', ')}`);
        });
        
        // Calculate success metrics
        const validCount = batchResults.filter(r => r.finalResult.valid === true).length;
        const highConfidenceCount = batchResults.filter(r => r.finalResult.confidence === 'high').length;
        const patternMatchCount = batchResults.filter(r => r.finalResult.patternMatch).length;
        
        console.log('\n📈 Batch Statistics:');
        console.log(`   Total Emails: ${batchResults.length}`);
        console.log(`   Valid Emails: ${validCount} (${((validCount/batchResults.length)*100).toFixed(1)}%)`);
        console.log(`   High Confidence: ${highConfidenceCount}`);
        console.log(`   Pattern Matches: ${patternMatchCount}`);
        
    } catch (error) {
        console.error('Batch verification failed:', error.message);
    }
    
    console.log('\n🎯 Key Improvements Made:');
    console.log('✅ Increased SMTP timeout from 8s to 15s');
    console.log('✅ Added retry mechanism (up to 2 retries)');
    console.log('✅ Enhanced pattern recognition for business emails');
    console.log('✅ Better handling of corporate domains');
    console.log('✅ Smarter result analysis (pattern matching overrides SMTP failures)');
    console.log('✅ Null values for inconclusive results (instead of false negatives)');
    console.log('✅ Dynamic pattern learning');
    console.log('✅ More forgiving verification logic');
    
    console.log('\n💡 Why "firstname.lastname@company.com" Should Now Work:');
    console.log('1. Pattern detection recognizes "firstname.lastname" as high-confidence business pattern');
    console.log('2. If SMTP times out, pattern match overrides the failure');
    console.log('3. Retry mechanism gives multiple chances for DNS/SMTP');
    console.log('4. Corporate domain handling is more intelligent');
    console.log('5. Result analysis weighs pattern matching heavily');
    
    console.log('\n🔧 To Use This Fix:');
    console.log('1. Replace your current utils/emailVerifier.js with the improved version');
    console.log('2. Test with your specific "firstname.lastname@company.com" case');
    console.log('3. Monitor the detailed logs to see which verification method succeeds');
    console.log('4. Add more domains to corporateDomainsWithStrictSecurity if needed');
    console.log('5. The system will learn patterns automatically over time');
}

async function testSpecificCase() {
    console.log('\n🎯 TESTING YOUR SPECIFIC CASE\n');
    
    const emailVerifier = new emailVerifier();
    const email = 'firstname.lastname@company.com'; // Replace with your actual email
    
    console.log(`Testing: ${email}`);
    console.log('This should now show as VALID if the domain exists\n');
    
    try {
        // Test pattern detection first
        console.log('🔍 Step 1: Pattern Analysis');
        const patternResult = emailVerifier.checkAgainstKnownPatterns(email);
        console.log(`   Pattern Detected: ${patternResult.isKnownPattern ? 'YES' : 'NO'}`);
        if (patternResult.isKnownPattern) {
            console.log(`   Pattern Type: ${patternResult.pattern}`);
            console.log(`   Confidence: ${patternResult.confidence}`);
        }
        
        // Test full verification
        console.log('\n🔍 Step 2: Full Verification');
        const result = await emailVerifier.verifyEmail(email, { enableSMTP: true });
        
        console.log(`   Final Result: ${result.finalResult.valid ? '✅ VALID' : '❌ INVALID'}`);
        console.log(`   Confidence: ${result.finalResult.confidence}`);
        console.log(`   Corporate Domain: ${result.finalResult.corporateDomain ? 'Yes' : 'No'}`);
        
        console.log('\n📋 Detailed Check Results:');
        result.checks.forEach((check, index) => {
            console.log(`   ${index + 1}. ${check.method.toUpperCase()}: ${check.valid === true ? '✅' : check.valid === false ? '❌' : '❓'}`);
            console.log(`      Confidence: ${check.confidence}`);
            if (check.error) console.log(`      Error: ${check.error}`);
            if (check.note) console.log(`      Note: ${check.note}`);
        });
        
        console.log('\n💭 Analysis:');
        result.finalResult.reasons.forEach((reason, index) => {
            console.log(`   ${index + 1}. ${reason}`);
        });
        
        if (result.finalResult.valid) {
            console.log('\n🎉 SUCCESS! The email is now correctly identified as VALID');
        } else {
            console.log('\n⚠️  Still showing as invalid. Possible reasons:');
            console.log('   - Domain genuinely doesn\'t exist (check DNS)');
            console.log('   - Network connectivity issues');
            console.log('   - Need to add domain to corporate whitelist');
            console.log('   - Pattern not recognized (will be learned automatically)');
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Main execution
async function runTests() {
    try {
        await testImprovedVerification();
        await testSpecificCase();
        
        console.log('\n✅ All tests completed!');
        console.log('\nNext steps:');
        console.log('1. Replace your emailVerifier.js with the improved version');
        console.log('2. Test with your real email case');
        console.log('3. Check the logs to see exactly why emails pass/fail');
        console.log('4. Report back if you still see issues');
        
    } catch (error) {
        console.error('Test suite failed:', error.message);
    }
}

// Note: This is a test script. To actually use it:
// 1. Save the improved EmailVerifier class as a separate file
// 2. Replace the class definition with: const EmailVerifier = require('./improved_emailVerifier');
// 3. Run this test script

console.log('📝 NOTE: This is a demonstration script.');
console.log('To use the improvements:');
console.log('1. Copy the improved EmailVerifier class to a new file');
console.log('2. Replace your existing utils/emailVerifier.js');
console.log('3. Test with your actual email case');
console.log('4. The improvements should resolve false negatives\n');

// Uncomment to run tests:
// runTests();