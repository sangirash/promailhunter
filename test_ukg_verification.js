// test_ukg_verification.js
// Specific test for UKG email verification
// Usage: node test_ukg_verification.js

const EmailGenerator = require('./utils/emailGenerator');
const EmailVerifier = require('./utils/emailVerifier');

async function testUKGCase() {
    console.log('🔍 Testing UKG Email Generation and Verification\n');
    
    const emailGenerator = new EmailGenerator();
    const emailVerifier = new EmailVerifier();
    
    // Test the exact case you mentioned
    const firstName = 'Devesh';
    const lastName = 'Bhatt';
    const companyName = 'UKG';
    
    console.log(`👤 Testing: ${firstName} ${lastName} at ${companyName}\n`);
    
    try {
        // Step 1: Generate emails
        console.log('📧 Step 1: Generating emails...');
        const emailResult = await emailGenerator.processContact(firstName, lastName, companyName, false);
        
        console.log(`✅ Generated ${emailResult.data.emails.all.length} emails`);
        console.log(`🏢 Company emails: ${emailResult.data.emails.company.length}`);
        console.log(`📋 Validated domains: ${emailResult.data.metadata.validatedDomains.join(', ')}`);
        
        // Find the specific email you mentioned
        const targetEmail = 'devesh.bhatt@ukg.com';
        const emailExists = emailResult.data.emails.all.includes(targetEmail);
        
        console.log(`\n🎯 Target email "${targetEmail}": ${emailExists ? '✅ Generated' : '❌ Not generated'}`);
        
        if (emailExists) {
            console.log('✅ Great! The email was generated as expected.\n');
        } else {
            console.log('❌ The target email was not generated. Let\'s see what was generated:');
            console.log('📋 First 10 emails:', emailResult.data.emails.all.slice(0, 10));
        }
        
        // Step 2: Test verification on a small sample including the target email
        console.log('🔍 Step 2: Testing email verification...');
        
        const testEmails = [
            targetEmail,
            'devesh@ukg.com',
            'dbhatt@ukg.com',
            'bhatt.devesh@ukg.com',
            'fake.email@ukg.com'
        ].filter(email => emailResult.data.emails.all.includes(email) || email === targetEmail);
        
        console.log(`📬 Verifying ${testEmails.length} emails:`, testEmails);
        
        const verificationResults = await emailVerifier.verifyEmailBatch(testEmails, {
            enableSMTP: true,
            concurrency: 1, // Very conservative for testing
            delay: 2000
        });
        
        // Analyze results
        console.log('\n📊 Verification Results:');
        console.log('=' .repeat(60));
        
        verificationResults.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.email}`);
            console.log(`   Valid: ${result.finalResult.valid ? '✅ YES' : '❌ NO'}`);
            console.log(`   Confidence: ${result.finalResult.confidence}`);
            console.log(`   Corporate Domain: ${result.finalResult.corporateDomain ? 'Yes' : 'No'}`);
            console.log(`   Pattern Match: ${result.finalResult.patternMatch || 'None'}`);
            console.log(`   Reasons: ${result.finalResult.reasons.join(', ')}`);
            
            if (result.checks) {
                console.log(`   Checks performed:`);
                result.checks.forEach(check => {
                    console.log(`     - ${check.method}: ${check.valid ? '✅' : '❌'} (${check.confidence})`);
                    if (check.note) console.log(`       Note: ${check.note}`);
                });
            }
        });
        
        // Summary
        const validEmails = verificationResults.filter(r => r.finalResult.valid === true);
        const corporateEmails = verificationResults.filter(r => r.finalResult.corporateDomain === true);
        
        console.log('\n📈 Summary:');
        console.log(`   Total tested: ${verificationResults.length}`);
        console.log(`   Valid: ${validEmails.length}`);
        console.log(`   Corporate domains: ${corporateEmails.length}`);
        console.log(`   Success rate: ${((validEmails.length / verificationResults.length) * 100).toFixed(1)}%`);
        
        // Explain what happened
        console.log('\n💡 Explanation:');
        if (corporateEmails.length > 0) {
            console.log('✅ UKG is detected as a corporate domain with strict email security.');
            console.log('✅ The system uses pattern matching instead of SMTP verification.');
            console.log('✅ Emails matching known UKG patterns are marked as valid.');
            console.log('✅ This avoids false negatives from blocked SMTP verification.');
        }
        
        if (validEmails.length === 0) {
            console.log('⚠️  If no emails show as valid, this could be due to:');
            console.log('   1. DNS resolution issues');
            console.log('   2. Network connectivity problems');
            console.log('   3. UKG\'s email servers being temporarily unavailable');
            console.log('   4. Need to add UKG to the known patterns list');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n🔧 Possible solutions:');
        console.log('1. Check internet connection');
        console.log('2. Verify DNS resolution works: nslookup ukg.com');
        console.log('3. Try running the test again (DNS can be flaky)');
    }
}

async function testPatternMatching() {
    console.log('\n🧪 Testing Pattern Matching for UKG emails...');
    
    const emailVerifier = new EmailVerifier();
    
    const testPatterns = [
        'devesh.bhatt@ukg.com',
        'john.doe@ukg.com',
        'sarah@ukg.com',
        'mike123@ukg.com',
        'a@ukg.com',
        'verylongfirstname.verylonglastname@ukg.com'
    ];
    
    console.log('Testing pattern recognition:');
    testPatterns.forEach(email => {
        const result = emailVerifier.checkAgainstKnownPatterns(email);
        console.log(`  ${email}: ${result.isKnownPattern ? '✅' : '❌'} (${result.confidence}) ${result.pattern || ''}`);
    });
}

// Run the tests
async function runTests() {
    await testUKGCase();
    await testPatternMatching();
    
    console.log('\n🎉 Testing complete!');
    console.log('\n📚 Key improvements made:');
    console.log('✅ Corporate domain detection (UKG, Microsoft, Google, etc.)');
    console.log('✅ Pattern-based validation for known email formats');
    console.log('✅ Reduced false negatives from SMTP blocking');
    console.log('✅ Better handling of security-conscious companies');
    console.log('✅ More accurate results for real corporate emails');
}

if (require.main === module) {
    runTests();
}

module.exports = { testUKGCase, testPatternMatching };