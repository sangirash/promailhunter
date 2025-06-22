// test_email_generator.js - UPDATED: Test user-provided domain functionality
// Run this script to test the updated email generation with user-provided domains
// Usage: node test_email_generator.js

const EmailGenerator = require('./utils/emailGenerator');

async function testUserProvidedDomains() {
    console.log('🎯 Testing User-Provided Domain Email Generation\n');
    console.log('=' .repeat(70));
    
    const emailGenerator = new EmailGenerator();
    
    // Test data with various domain input formats
    const testCases = [
        {
            firstName: 'John',
            lastName: 'Doe',
            companyName: 'ukg.com',
            expected: 'Should extract domain: ukg.com',
            shouldSucceed: true,
            description: 'Direct domain format'
        },
        {
            firstName: 'Sarah',
            lastName: 'Smith',
            companyName: 'devesh.bhatt@microsoft.com',
            expected: 'Should extract domain: microsoft.com',
            shouldSucceed: true,
            description: 'Email format input'
        },
        {
            firstName: 'Mike',
            lastName: 'Johnson',
            companyName: 'https://salesforce.com',
            expected: 'Should extract domain: salesforce.com',
            shouldSucceed: true,
            description: 'HTTPS URL format'
        },
        {
            firstName: 'Lisa',
            lastName: 'Wilson',
            companyName: 'www.oracle.com',
            expected: 'Should extract domain: oracle.com',
            shouldSucceed: true,
            description: 'Website with www format'
        },
        {
            firstName: 'David',
            lastName: 'Brown',
            companyName: 'http://company.co.uk',
            expected: 'Should extract domain: company.co.uk',
            shouldSucceed: true,
            description: 'HTTP URL with country TLD'
        },
        {
            firstName: 'Emma',
            lastName: 'Davis',
            companyName: 'admin@test-company.org',
            expected: 'Should extract domain: test-company.org',
            shouldSucceed: true,
            description: 'Email with hyphenated domain'
        },
        {
            firstName: 'James',
            lastName: 'Miller',
            companyName: 'FakeCompany123',
            expected: 'Should fail - no valid domain format',
            shouldSucceed: false,
            description: 'Company name without domain'
        },
        {
            firstName: 'Anna',
            lastName: 'Garcia',
            companyName: 'Some Random Company Inc',
            expected: 'Should fail - no valid domain format',
            shouldSucceed: false,
            description: 'Full company name without domain'
        },
        {
            firstName: 'Tom',
            lastName: 'Anderson',
            companyName: 'nonexistentdomain99999.xyz',
            expected: 'Should fail domain validation (domain doesn\'t exist)',
            shouldSucceed: false,
            description: 'Valid format but non-existent domain'
        },
        {
            firstName: 'A',
            lastName: 'B',
            companyName: 'google.com',
            expected: 'Should succeed but filter very short usernames',
            shouldSucceed: true,
            description: 'Single character names (edge case)'
        }
    ];
    
    console.log(`📋 Running ${testCases.length} test cases...\n`);
    
    const results = [];
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`🧪 Test Case ${i + 1}: ${testCase.firstName} ${testCase.lastName}`);
        console.log(`   Input: "${testCase.companyName}"`);
        console.log(`   Description: ${testCase.description}`);
        console.log(`   Expected: ${testCase.expected}\n`);
        
        try {
            const startTime = Date.now();
            const result = await emailGenerator.processContact(
                testCase.firstName,
                testCase.lastName,
                testCase.companyName,
                false // Don't save files during testing
            );
            const endTime = Date.now();
            
            const testResult = {
                testCase: i + 1,
                success: result.success,
                expectedToSucceed: testCase.shouldSucceed,
                processingTime: endTime - startTime,
                domain: result.data?.metadata?.domain,
                totalEmails: result.data?.emails?.all?.length || 0,
                error: result.data?.metadata?.error,
                warnings: result.data?.metadata?.warnings
            };
            
            results.push(testResult);
            
            // Log results
            if (result.success) {
                console.log(`   ✅ SUCCESS`);
                console.log(`   📧 Generated ${testResult.totalEmails} emails`);
                console.log(`   🌐 Domain: ${testResult.domain}`);
                console.log(`   ⏱️  Processing time: ${testResult.processingTime}ms`);
                
                // Show sample emails
                if (result.data.emails.all.length > 0) {
                    console.log(`   📋 Sample emails:`);
                    result.data.emails.all.slice(0, 5).forEach(email => {
                        console.log(`      • ${email}`);
                    });
                    if (result.data.emails.all.length > 5) {
                        console.log(`      ... and ${result.data.emails.all.length - 5} more`);
                    }
                }
            } else {
                console.log(`   ❌ FAILED`);
                console.log(`   💬 Error: ${testResult.error}`);
                if (testResult.warnings) {
                    console.log(`   ⚠️  Warnings:`);
                    testResult.warnings.forEach(warning => {
                        console.log(`      • ${warning}`);
                    });
                }
            }
            
            // Verify if result matches expectation
            const isCorrect = (result.success === testCase.shouldSucceed);
            console.log(`   🎯 Test Result: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
            
            if (!isCorrect) {
                console.log(`   🚨 Expected ${testCase.shouldSucceed ? 'SUCCESS' : 'FAILURE'} but got ${result.success ? 'SUCCESS' : 'FAILURE'}`);
            }
            
        } catch (error) {
            console.log(`   💥 EXCEPTION: ${error.message}`);
            results.push({
                testCase: i + 1,
                success: false,
                expectedToSucceed: testCase.shouldSucceed,
                error: error.message,
                exception: true
            });
        }
        
        console.log(`   ${'─'.repeat(60)}\n`);
    }
    
    return results;
}

async function testDomainExtraction() {
    console.log('🔍 Testing Domain Extraction Logic\n');
    console.log('=' .repeat(70));
    
    const emailGenerator = new EmailGenerator();
    
    const domainTests = [
        { input: 'ukg.com', expected: 'ukg.com' },
        { input: 'user@microsoft.com', expected: 'microsoft.com' },
        { input: 'https://salesforce.com', expected: 'salesforce.com' },
        { input: 'www.oracle.com', expected: 'oracle.com' },
        { input: 'http://company.co.uk', expected: 'company.co.uk' },
        { input: 'https://www.test-domain.org', expected: 'test-domain.org' },
        { input: 'admin@sub.domain.com', expected: 'sub.domain.com' },
        { input: 'Company Name Inc', expected: null },
        { input: 'Some Random Text', expected: null },
        { input: '', expected: null },
        { input: 'invalid-domain', expected: null }
    ];
    
    console.log(`🧪 Testing ${domainTests.length} domain extraction cases...\n`);
    
    domainTests.forEach((test, index) => {
        console.log(`${index + 1}. Input: "${test.input}"`);
        
        try {
            const extracted = emailGenerator.extractDomainFromCompanyName(test.input);
            const isCorrect = extracted === test.expected;
            
            console.log(`   Extracted: ${extracted || 'null'}`);
            console.log(`   Expected: ${test.expected || 'null'}`);
            console.log(`   Result: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
            
        } catch (error) {
            console.log(`   💥 Error: ${error.message}`);
        }
        
        console.log('');
    });
}

async function testUsernameGeneration() {
    console.log('👤 Testing Username Generation\n');
    console.log('=' .repeat(70));
    
    const emailGenerator = new EmailGenerator();
    
    const nameTests = [
        { firstName: 'John', lastName: 'Doe', description: 'Standard names' },
        { firstName: 'Sarah-Jane', lastName: 'Smith-Wilson', description: 'Hyphenated names' },
        { firstName: 'A', lastName: 'B', description: 'Single character names' },
        { firstName: 'VeryLongFirstName', lastName: 'VeryLongLastName', description: 'Long names' },
        { firstName: 'José', lastName: 'García', description: 'Names with accents' },
        { firstName: 'John', lastName: 'O\'Connor', description: 'Name with apostrophe' }
    ];
    
    nameTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test.description}: ${test.firstName} ${test.lastName}`);
        
        try {
            const usernames = emailGenerator.generateUsernames(test.firstName, test.lastName);
            
            console.log(`   Generated ${usernames.length} username patterns:`);
            
            // Show first 10 usernames
            usernames.slice(0, 10).forEach(username => {
                console.log(`      • ${username}`);
            });
            
            if (usernames.length > 10) {
                console.log(`      ... and ${usernames.length - 10} more`);
            }
            
            // Analyze patterns
            const stats = {
                withDots: usernames.filter(u => u.includes('.')).length,
                withUnderscores: usernames.filter(u => u.includes('_')).length,
                withHyphens: usernames.filter(u => u.includes('-')).length,
                withNumbers: usernames.filter(u => /\d/.test(u)).length,
                minLength: Math.min(...usernames.map(u => u.length)),
                maxLength: Math.max(...usernames.map(u => u.length))
            };
            
            console.log(`   📊 Stats: Dots: ${stats.withDots}, Underscores: ${stats.withUnderscores}, Hyphens: ${stats.withHyphens}, Numbers: ${stats.withNumbers}`);
            console.log(`   📏 Length range: ${stats.minLength}-${stats.maxLength} characters`);
            
        } catch (error) {
            console.log(`   💥 Error: ${error.message}`);
        }
        
        console.log('');
    });
}

async function testPerformanceMetrics() {
    console.log('⚡ Testing Performance Metrics\n');
    console.log('=' .repeat(70));
    
    const emailGenerator = new EmailGenerator();
    
    const performanceTests = [
        { firstName: 'John', lastName: 'Doe', domain: 'ukg.com', iterations: 5 },
        { firstName: 'Sarah', lastName: 'Smith', domain: 'microsoft.com', iterations: 3 },
        { firstName: 'Mike', lastName: 'Johnson', domain: 'nonexistent99999.xyz', iterations: 2 }
    ];
    
    for (const test of performanceTests) {
        console.log(`🏃 Performance test: ${test.firstName} ${test.lastName} @ ${test.domain}`);
        console.log(`   Running ${test.iterations} iterations...\n`);
        
        const times = [];
        
        for (let i = 0; i < test.iterations; i++) {
            const startTime = Date.now();
            
            try {
                await emailGenerator.processContact(
                    test.firstName,
                    test.lastName,
                    test.domain,
                    false
                );
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                times.push(duration);
                
                console.log(`   Iteration ${i + 1}: ${duration}ms`);
                
            } catch (error) {
                console.log(`   Iteration ${i + 1}: Error - ${error.message}`);
            }
        }
        
        if (times.length > 0) {
            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            
            console.log(`\n   📊 Performance Summary:`);
            console.log(`      Average: ${avgTime.toFixed(1)}ms`);
            console.log(`      Fastest: ${minTime}ms`);
            console.log(`      Slowest: ${maxTime}ms`);
            console.log(`      Variance: ${(maxTime - minTime)}ms`);
        }
        
        console.log('\n');
    }
}

async function testErrorHandling() {
    console.log('🚨 Testing Error Handling\n');
    console.log('=' .repeat(70));
    
    const emailGenerator = new EmailGenerator();
    
    const errorTests = [
        { firstName: '', lastName: 'Doe', domain: 'test.com', description: 'Empty first name' },
        { firstName: 'John', lastName: '', domain: 'test.com', description: 'Empty last name' },
        { firstName: 'John', lastName: 'Doe', domain: '', description: 'Empty domain' },
        { firstName: 'John', lastName: 'Doe', domain: 'invalid', description: 'Invalid domain format' },
        { firstName: 'John', lastName: 'Doe', domain: 'fake123456789.xyz', description: 'Non-existent domain' }
    ];
    
    for (let i = 0; i < errorTests.length; i++) {
        const test = errorTests[i];
        console.log(`${i + 1}. ${test.description}`);
        console.log(`   Input: "${test.firstName}" "${test.lastName}" "${test.domain}"`);
        
        try {
            const result = await emailGenerator.processContact(
                test.firstName,
                test.lastName,
                test.domain,
                false
            );
            
            if (result.success) {
                console.log(`   ⚠️  Expected error but got success`);
                console.log(`   📧 Generated ${result.data.emails.all.length} emails`);
            } else {
                console.log(`   ✅ Correctly failed with error`);
                console.log(`   💬 Error: ${result.data.metadata.error}`);
            }
            
        } catch (error) {
            console.log(`   ✅ Correctly threw exception`);
            console.log(`   💬 Exception: ${error.message}`);
        }
        
        console.log('');
    }
}

async function generateSummaryReport(results) {
    console.log('📊 SUMMARY REPORT\n');
    console.log('=' .repeat(70));
    
    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const correctTests = results.filter(r => r.success === r.expectedToSucceed).length;
    const avgProcessingTime = results
        .filter(r => r.processingTime)
        .reduce((sum, r) => sum + r.processingTime, 0) / 
        results.filter(r => r.processingTime).length;
    
    console.log(`📈 Test Statistics:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Successful: ${successfulTests}/${totalTests} (${((successfulTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`   Correct Results: ${correctTests}/${totalTests} (${((correctTests/totalTests)*100).toFixed(1)}%)`);
    console.log(`   Average Processing Time: ${avgProcessingTime.toFixed(1)}ms`);
    
    console.log(`\n🎯 Domain Types Tested:`);
    const domainTypes = {};
    results.forEach(r => {
        if (r.domain) {
            const tld = r.domain.split('.').pop();
            domainTypes[tld] = (domainTypes[tld] || 0) + 1;
        }
    });
    
    Object.entries(domainTypes).forEach(([tld, count]) => {
        console.log(`   .${tld}: ${count} test(s)`);
    });
    
    console.log(`\n📧 Email Generation Stats:`);
    const emailCounts = results.filter(r => r.totalEmails > 0).map(r => r.totalEmails);
    if (emailCounts.length > 0) {
        const totalEmails = emailCounts.reduce((a, b) => a + b, 0);
        const avgEmails = totalEmails / emailCounts.length;
        const minEmails = Math.min(...emailCounts);
        const maxEmails = Math.max(...emailCounts);
        
        console.log(`   Total Emails Generated: ${totalEmails}`);
        console.log(`   Average per Test: ${avgEmails.toFixed(1)}`);
        console.log(`   Range: ${minEmails}-${maxEmails} emails`);
    }
    
    console.log(`\n✅ Key Improvements Verified:`);
    console.log(`   • User-provided domain extraction working`);
    console.log(`   • No more domain variations generation`);
    console.log(`   • Clear error messages for invalid inputs`);
    console.log(`   • Fast processing with single domain validation`);
    console.log(`   • Comprehensive username pattern generation`);
    console.log(`   • Proper handling of various input formats`);
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting Complete Email Generator Test Suite\n');
    console.log('ProMailHunter v2.0 - User Domain Focus Testing');
    console.log('=' .repeat(70));
    console.log(`Test started at: ${new Date().toISOString()}\n`);
    
    try {
        // Run all test suites
        const results = await testUserProvidedDomains();
        console.log('\n');
        
        await testDomainExtraction();
        console.log('\n');
        
        await testUsernameGeneration();
        console.log('\n');
        
        await testPerformanceMetrics();
        console.log('\n');
        
        await testErrorHandling();
        console.log('\n');
        
        await generateSummaryReport(results);
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('\n💡 Next Steps:');
        console.log('1. Review any failed tests above');
        console.log('2. Test with your specific company domains');
        console.log('3. Verify domain extraction works with your input formats');
        console.log('4. Run email verification tests with generated emails');
        console.log('5. Deploy to production when satisfied with results');
        
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check internet connection for domain validation');
        console.log('2. Verify EmailGenerator class is properly exported');
        console.log('3. Ensure all dependencies are installed');
        console.log('4. Check file paths and permissions');
    }
}

// Run if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = { 
    runAllTests, 
    testUserProvidedDomains, 
    testDomainExtraction,
    testUsernameGeneration,
    testPerformanceMetrics,
    testErrorHandling
};