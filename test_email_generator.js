// test_email_generator.js
// Run this script to test the enhanced email generation functionality
// Usage: node test_email_generator.js

const EmailGenerator = require('./utils/emailGenerator');

async function testEnhancedEmailGeneration() {
    console.log('🔍 Testing Enhanced Email Generation with Domain Validation\n');
    
    const emailGenerator = new EmailGenerator();
    
    // Test data with real and fake companies
    const testCases = [
        {
            firstName: 'John',
            lastName: 'Doe', 
            companyName: 'UKG',
            expected: 'Should find ukg.com and other valid UKG domains'
        },
        {
            firstName: 'Sarah',
            lastName: 'Smith',
            companyName: 'Microsoft',
            expected: 'Should find microsoft.com and related domains'
        },
        {
            firstName: 'Mike',
            lastName: 'Johnson',
            companyName: 'FakeCompanyThatDoesNotExist123',
            expected: 'Should fallback to common providers when no domains exist'
        },
        {
            firstName: 'A',
            lastName: 'B',
            companyName: 'Google',
            expected: 'Should avoid single character usernames'
        }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`📧 Test Case ${i + 1}: ${test