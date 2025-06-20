// test_email_generator.js
// Run this script to test the email generation functionality
// Usage: node test_email_generator.js

const EmailGenerator = require('./utils/emailGenerator');

async function testEmailGeneration() {
    console.log('🔍 Testing Email Generation Functionality\n');
    
    const emailGenerator = new EmailGenerator();
    
    // Test data
    const testCases = [
        {
            firstName: 'Dhaara',
            lastName: 'Angirash', 
            companyName: 'Dhaara Engineering'
        },
        {
            firstName: 'Sarah',
            lastName: 'Smith',
            companyName: 'Microsoft'
        },
        {
            firstName: 'Michael',
            lastName: 'Johnson',
            companyName: 'Global Dynamics'
        }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`📧 Test Case ${i + 1}: ${testCase.firstName} ${testCase.lastName} at ${testCase.companyName}`);
        console.log('─'.repeat(60));
        
        try {
            // Generate email data
            const result = await emailGenerator.processContact(
                testCase.firstName,
                testCase.lastName,
                testCase.companyName,
                false // Don't save to file for testing
            );
            
            console.log(`✅ Generated ${result.data.emails.all.length} email combinations`);
            console.log(`📊 Company: ${result.data.emails.company.length}, Common Providers: ${result.data.emails.commonProviders.length}`);
            
            // Show first 10 emails
            console.log('\n📋 First 10 email combinations:');
            result.data.emails.all.slice(0, 10).forEach((email, index) => {
                console.log(`   ${index + 1}. ${email}`);
            });
            
            // Show some company emails
            if (result.data.emails.company.length > 0) {
                console.log('\n🏢 Company email examples:');
                result.data.emails.company.slice(0, 5).forEach((email, index) => {
                    console.log(`   ${index + 1}. ${email}`);
                });
            }
            
            // Show domains generated
            console.log('\n🌐 Company domains generated:');
            result.data.domains.company.forEach((domain, index) => {
                console.log(`   ${index + 1}. ${domain}`);
            });
            
            console.log('\n' + '='.repeat(60) + '\n');
            
        } catch (error) {
            console.error(`❌ Error in test case ${i + 1}:`, error.message);
        }
    }
    
    // Test file saving
    console.log('💾 Testing file saving functionality...');
    try {
        const result = await emailGenerator.processContact(
            'Test',
            'User',
            'Sample Company',
            true // Save to file
        );
        
        console.log(`✅ File saved successfully: ${result.file.filename}`);
        console.log(`📁 File path: ${result.file.filePath}`);
        console.log(`📊 Total emails in file: ${result.file.totalEmails}`);
        
    } catch (error) {
        console.error('❌ File saving error:', error.message);
    }
}

// Test simple email generation (matching the original request format)
function testSimpleFormat() {
    console.log('\n🎯 Testing Simple JSON Format (as requested)');
    console.log('─'.repeat(50));
    
    const emailGenerator = new EmailGenerator();
    const emails = emailGenerator.generateEmails('John', 'Doe', 'Acme Corp');
    
    const simpleFormat = {
        emails: emails.slice(0, 20) // Show first 20 for brevity
    };
    
    console.log('📄 JSON Output (first 20 emails):');
    console.log(JSON.stringify(simpleFormat, null, 2));
    console.log(`\n📊 Total available: ${emails.length} emails`);
}

// Run tests
if (require.main === module) {
    console.log('🚀 Starting Email Generator Tests...\n');
    
    testEmailGeneration()
        .then(() => {
            testSimpleFormat();
            console.log('\n✨ All tests completed!');
        })
        .catch(error => {
            console.error('💥 Test suite failed:', error);
        });
}

module.exports = { testEmailGeneration, testSimpleFormat };