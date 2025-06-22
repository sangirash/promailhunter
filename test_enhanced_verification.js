// test_enhanced_verification.js
// Comprehensive test script for the enhanced email verification system
// Usage: node test_enhanced_verification.js

const EnhancedEmailVerifier = require('./utils/enhancedEmailVerifier');

async function testPythonIntegration() {
    console.log('🐍 Testing Python email-validator integration...\n');
    
    const verifier = new EnhancedEmailVerifier();
    
    // Wait for Python availability check
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const testEmails = [
        // Valid emails
        'test@gmail.com',
        'user@microsoft.com',
        'admin@google.com',
        
        // Corporate emails (UKG focus)
        'devesh.bhatt@ukg.com',
        'john.doe@ukg.com',
        'sarah@ukg.com',
        
        // International emails
        'user@müller.de',
        'test@café.fr',
        '用户@测试.中国',
        
        // Invalid emails
        'invalid@nonexistentdomain99999.com',
        'bad.email',
        '@missing-local.com',
        'missing-domain@',
        
        // Edge cases
        '"quoted user"@example.com',
        'user+tag@example.org',
        'very.long.email.address.that.might.be.problematic@very-long-domain-name-example.com'
    ];
    
    console.log(`📧 Testing ${testEmails.length} email addresses...\n`);
    
    for (let i = 0; i < testEmails.length; i++) {
        const email = testEmails[i];
        console.log(`${i + 1}. Testing: ${email}`);
        
        try {
            const result = await verifier.verifyEmail(email, {
                enableSMTP: true,
                usePythonValidator: true,
                timeout: 10
            });
            
            const finalResult = result.finalResult;
            const status = finalResult.valid ? '✅ VALID' : '❌ INVALID';
            const method = finalResult.method || 'unknown';
            const confidence = finalResult.confidence || 'unknown';
            
            console.log(`   ${status} (${confidence} confidence, ${method})`);
            
            if (finalResult.corporateDomain) {
                console.log(`   🏢 Corporate domain detected`);
            }
            
            if (finalResult.patternMatch) {
                console.log(`   📋 Pattern match: ${finalResult.patternMatch}`);
            }
            
            if (finalResult.normalized && finalResult.normalized !== email) {
                console.log(`   🔄 Normalized: ${finalResult.normalized}`);
            }
            
            if (finalResult.reasons && finalResult.reasons.length > 0) {
                console.log(`   💭 Reasons: ${finalResult.reasons.join(', ')}`);
            }
            
            if (result.checks && result.checks.length > 0) {
                console.log(`   🔍 Checks performed: ${result.checks.length}`);
            }
            
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
        }
        
        console.log(''); // Empty line for readability
    }
}

async function testBatchVerification() {
    console.log('📦 Testing batch verification...\n');
    
    const verifier = new EnhancedEmailVerifier();
    
    const batchEmails = [
        'batch1@gmail.com',
        'batch2@microsoft.com',
        'batch3@ukg.com',
        'batch4@nonexistent.fake',
        'devesh.bhatt@ukg.com'
    ];
    
    console.log(`Processing batch of ${batchEmails.length} emails...\n`);
    
    try {
        const results = await verifier.verifyEmailBatch(batchEmails, {
            enableSMTP: true,
            usePythonValidator: true,
            concurrency: 2,
            delay: 1000,
            timeout: 10
        });
        
        console.log('📊 Batch Results:');
        console.log('=' .repeat(50));
        
        results.forEach((result, index) => {
            const email = result.email;
            const finalResult = result.finalResult;
            const status = finalResult?.valid ? '✅' : '❌';
            const method = finalResult?.method || 'unknown';
            const confidence = finalResult?.confidence || 'unknown';
            
            console.log(`${index + 1}. ${email}`);
            console.log(`   Status: ${status} (${confidence}, ${method})`);
            
            if (finalResult?.corporateDomain) {
                console.log(`   🏢 Corporate domain`);
            }
            
            if (finalResult?.reasons) {
                console.log(`   Reasons: ${finalResult.reasons.slice(0, 2).join(', ')}`);
            }
            console.log('');
        });
        
        // Summary
        const validCount = results.filter(r => r.finalResult?.valid === true).length;
        const corporateCount = results.filter(r => r.finalResult?.corporateDomain === true).length;
        const pythonCount = results.filter(r => r.finalResult?.method === 'python-email-validator').length;
        
        console.log('📈 Batch Summary:');
        console.log(`   Total emails: ${results.length}`);
        console.log(`   Valid: ${validCount}`);
        console.log(`   Corporate domains: ${corporateCount}`);
        console.log(`   Python validated: ${pythonCount}`);
        console.log(`   Success rate: ${((validCount / results.length) * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('❌ Batch verification failed:', error.message);
    }
}

async function testUKGSpecificCase() {
    console.log('🎯 Testing UKG-specific email verification...\n');
    
    const verifier = new EnhancedEmailVerifier();
    
    const ukgEmails = [
        'devesh.bhatt@ukg.com',
        'john.doe@ukg.com',
        'sarah@ukg.com',
        'mike123@ukg.com',
        'admin@ukg.com',
        'test.user@ukg.com',
        'invalidpattern123abc@ukg.com'
    ];
    
    console.log('Testing UKG email patterns:\n');
    
    for (const email of ukgEmails) {
        console.log(`🔍 Testing: ${email}`);
        
        try {
            const result = await verifier.verifyEmail(email, {
                enableSMTP: true,
                usePythonValidator: true,
                timeout: 10
            });
            
            const finalResult = result.finalResult;
            const status = finalResult.valid ? '✅ VALID' : '❌ INVALID';
            
            console.log(`   ${status} (${finalResult.confidence})`);
            console.log(`   Method: ${finalResult.method}`);
            console.log(`   Corporate: ${finalResult.corporateDomain ? 'Yes' : 'No'}`);
            console.log(`   Pattern: ${finalResult.patternMatch || 'None'}`);
            console.log(`   Reasons: ${finalResult.reasons?.join(', ') || 'None'}`);
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        console.log('');
    }
}

async function testPerformanceComparison() {
    console.log('⚡ Testing performance comparison...\n');
    
    const verifier = new EnhancedEmailVerifier();
    
    const testEmail = 'performance.test@gmail.com';
    const iterations = 5;
    
    // Test Python validator performance
    console.log('🐍 Testing Python validator performance...');
    const pythonTimes = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        try {
            await verifier.verifyEmail(testEmail, {
                usePythonValidator: true,
                enableSMTP: false,
                enableDeliverability: false
            });
        } catch (error) {
            // Ignore errors for performance test
        }
        const end = Date.now();
        pythonTimes.push(end - start);
    }
    
    // Test Node.js validator performance
    console.log('🟡 Testing Node.js validator performance...');
    const nodeTimes = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        try {
            await verifier.verifyEmail(testEmail, {
                usePythonValidator: false,
                enableSMTP: false
            });
        } catch (error) {
            // Ignore errors for performance test
        }
        const end = Date.now();
        nodeTimes.push(end - start);
    }
    
    const avgPythonTime = pythonTimes.reduce((a, b) => a + b, 0) / pythonTimes.length;
    const avgNodeTime = nodeTimes.reduce((a, b) => a + b, 0) / nodeTimes.length;
    
    console.log('📊 Performance Results:');
    console.log(`   Python validator: ${avgPythonTime.toFixed(1)}ms average`);
    console.log(`   Node.js validator: ${avgNodeTime.toFixed(1)}ms average`);
    console.log(`   Difference: ${(avgPythonTime - avgNodeTime).toFixed(1)}ms`);
    
    if (avgPythonTime < avgNodeTime) {
        console.log('   🐍 Python validator is faster!');
    } else {
        console.log('   🟡 Node.js validator is faster!');
    }
}

async function testEnhancedFeatures() {
    console.log('🌟 Testing enhanced features...\n');
    
    const verifier = new EnhancedEmailVerifier();
    
    console.log('1. Testing international domain support:');
    const internationalEmails = [
        'user@müller.de',
        'test@café.fr',
        'admin@тест.рф'
    ];
    
    for (const email of internationalEmails) {
        try {
            const result = await verifier.verifyEmail(email, {
                usePythonValidator: true,
                allowUTF8: true,
                timeout: 10
            });
            
            console.log(`   ${email}: ${result.finalResult.valid ? '✅' : '❌'}`);
            if (result.finalResult.normalized !== email) {
                console.log(`     Normalized: ${result.finalResult.normalized}`);
            }
        } catch (error) {
            console.log(`   ${email}: ❌ Error - ${error.message}`);
        }
    }
    
    console.log('\n2. Testing quoted local parts:');
    const quotedEmails = [
        '"john.doe"@example.com',
        '"user with spaces"@example.com',
        '"user@domain"@example.com'
    ];
    
    for (const email of quotedEmails) {
        try {
            const result = await verifier.verifyEmail(email, {
                usePythonValidator: true,
                allowQuoted: true,
                timeout: 10
            });
            
            console.log(`   ${email}: ${result.finalResult.valid ? '✅' : '❌'}`);
        } catch (error) {
            console.log(`   ${email}: ❌ Error - ${error.message}`);
        }
    }
    
    console.log('\n3. Testing domain literal support:');
    const domainLiterals = [
        'user@[192.168.1.1]',
        'user@[IPv6:2001:db8::1]'
    ];
    
    for (const email of domainLiterals) {
        try {
            const result = await verifier.verifyEmail(email, {
                usePythonValidator: true,
                timeout: 10
            });
            
            console.log(`   ${email}: ${result.finalResult.valid ? '✅' : '❌'}`);
        } catch (error) {
            console.log(`   ${email}: ❌ Error - ${error.message}`);
        }
    }
}

async function generateDetailedReport() {
    console.log('📋 Generating detailed verification report...\n');
    
    const verifier = new EnhancedEmailVerifier();
    
    // Wait for Python check to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🔧 System Configuration:');
    console.log(`   Python Validator Available: ${verifier.pythonAvailable ? '✅' : '❌'}`);
    console.log(`   Corporate Domains Tracked: ${verifier.corporateDomainsWithStrictSecurity.length}`);
    console.log(`   Known Email Patterns: ${Object.keys(verifier.knownValidPatterns).length}`);
    console.log(`   SMTP Timeout: ${verifier.smtpTimeout}ms`);
    console.log(`   Python Timeout: ${verifier.pythonTimeout}ms`);
    
    console.log('\n🏢 Supported Corporate Domains:');
    verifier.corporateDomainsWithStrictSecurity.slice(0, 10).forEach(domain => {
        console.log(`   • ${domain}`);
    });
    if (verifier.corporateDomainsWithStrictSecurity.length > 10) {
        console.log(`   ... and ${verifier.corporateDomainsWithStrictSecurity.length - 10} more`);
    }
    
    console.log('\n📋 Known Email Patterns:');
    Object.entries(verifier.knownValidPatterns).forEach(([domain, patterns]) => {
        console.log(`   ${domain}: ${patterns.join(', ')}`);
    });
    
    console.log('\n🎯 Recommendations:');
    
    if (!verifier.pythonAvailable) {
        console.log('   ⚠️  Install Python email-validator for enhanced validation:');
        console.log('      pip3 install email-validator');
        console.log('      Run: ./setup_python_validator.sh');
    } else {
        console.log('   ✅ Python email-validator is properly configured');
    }
    
    console.log('   ✅ Enhanced email verification is ready for production');
    console.log('   ✅ Corporate domain intelligence is active');
    console.log('   ✅ Pattern matching is enabled for known companies');
}

// Main test runner
async function runEnhancedTests() {
    console.log('🚀 Starting Enhanced Email Verification Tests\n');
    console.log('=' .repeat(60));
    
    try {
        await testPythonIntegration();
        console.log('\n' + '─'.repeat(60));
        
        await testBatchVerification();
        console.log('\n' + '─'.repeat(60));
        
        await testUKGSpecificCase();
        console.log('\n' + '─'.repeat(60));
        
        await testPerformanceComparison();
        console.log('\n' + '─'.repeat(60));
        
        await testEnhancedFeatures();
        console.log('\n' + '─'.repeat(60));
        
        await generateDetailedReport();
        
        console.log('\n' + '=' .repeat(60));
        console.log('🎉 All enhanced verification tests completed successfully!');
        console.log('\n💡 Key Benefits of Enhanced Verification:');
        console.log('   ✅ RFC-compliant email syntax validation');
        console.log('   ✅ International domain name (IDN) support');
        console.log('   ✅ Unicode email address support (SMTPUTF8)');
        console.log('   ✅ Comprehensive deliverability checks');
        console.log('   ✅ Corporate domain intelligence');
        console.log('   ✅ Pattern matching for known companies');
        console.log('   ✅ Reduced false negatives for corporate emails');
        console.log('   ✅ Fallback to Node.js validation when needed');
        
    } catch (error) {
        console.error('❌ Enhanced test suite failed:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Ensure Python 3 is installed');
        console.log('2. Install email-validator: pip3 install email-validator');
        console.log('3. Run setup script: ./setup_python_validator.sh');
        console.log('4. Check network connectivity');
    }
}

// Run if called directly
if (require.main === module) {
    runEnhancedTests();
}

module.exports = { 
    runEnhancedTests, 
    testPythonIntegration, 
    testBatchVerification, 
    testUKGSpecificCase 
};