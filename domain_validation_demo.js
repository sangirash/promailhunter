// domain_validation_demo.js
// Demo script to show how domain validation works
// Usage: node domain_validation_demo.js

const dns = require('dns').promises;

class DomainValidationDemo {
  constructor() {
    this.cache = new Map();
  }

  async validateDomain(domain) {
    console.log(`\n🔍 Validating domain: ${domain}`);
    
    // Check cache first
    if (this.cache.has(domain)) {
      console.log(`📋 Found in cache: ${this.cache.get(domain)}`);
      return this.cache.get(domain);
    }

    try {
      console.log(`📡 Checking MX records...`);
      const mxRecords = await dns.resolveMx(domain);
      console.log(`✅ MX Records found:`, mxRecords.map(mx => `${mx.exchange} (priority: ${mx.priority})`));
      this.cache.set(domain, true);
      return true;
    } catch (error) {
      console.log(`❌ No MX records: ${error.code}`);
      
      try {
        console.log(`📡 Checking A records as fallback...`);
        const aRecords = await dns.resolve(domain, 'A');
        console.log(`⚠️ A Records found (domain exists but may not accept emails):`, aRecords);
        this.cache.set(domain, true);
        return true;
      } catch (secondError) {
        console.log(`❌ No A records: ${secondError.code}`);
        console.log(`🚫 Domain does not exist`);
        this.cache.set(domain, false);
        return false;
      }
    }
  }

  async demoCompanyValidation(companyName) {
    console.log(`\n🏢 === DEMO: Domain Validation for "${companyName}" ===`);
    
    // Generate potential domains (simplified version)
    const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const potentialDomains = [
      `${cleanName}.com`,
      `${cleanName}.co`,
      `${cleanName}.org`,
      `${cleanName}.net`,
      `${cleanName}.io`,
      `${cleanName}.in`,
      `${cleanName}.co.uk`
    ];

    console.log(`\n📋 Potential domains to check:`, potentialDomains);

    const validDomains = [];
    const invalidDomains = [];

    // Validate each domain
    for (const domain of potentialDomains) {
      const isValid = await this.validateDomain(domain);
      if (isValid) {
        validDomains.push(domain);
      } else {
        invalidDomains.push(domain);
      }
      
      // Small delay to be respectful to DNS servers
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 === RESULTS ===`);
    console.log(`✅ Valid domains (${validDomains.length}):`, validDomains);
    console.log(`❌ Invalid domains (${invalidDomains.length}):`, invalidDomains);

    return { validDomains, invalidDomains };
  }

  async compareMethods() {
    console.log(`\n🔬 === COMPARING VALIDATION METHODS ===`);
    
    const testDomains = [
      { domain: 'google.com', expected: 'Should have MX records' },
      { domain: 'microsoft.com', expected: 'Should have MX records' },
      { domain: 'github.com', expected: 'Should have MX records' },
      { domain: 'example.com', expected: 'Might have only A records' },
      { domain: 'thisfakedomaindoesnotexist123.com', expected: 'Should not exist' }
    ];

    for (const test of testDomains) {
      console.log(`\n🧪 Testing: ${test.domain}`);
      console.log(`   Expected: ${test.expected}`);
      
      const startTime = Date.now();
      const result = await this.validateDomain(test.domain);
      const endTime = Date.now();
      
      console.log(`   Result: ${result ? '✅ Valid' : '❌ Invalid'}`);
      console.log(`   Time: ${endTime - startTime}ms`);
    }
  }

  async demonstrateCaching() {
    console.log(`\n💾 === DEMONSTRATING CACHING ===`);
    
    const domain = 'google.com';
    
    console.log(`\n🐌 First lookup (will hit DNS):`);
    const start1 = Date.now();
    await this.validateDomain(domain);
    const end1 = Date.now();
    console.log(`Time: ${end1 - start1}ms`);
    
    console.log(`\n⚡ Second lookup (from cache):`);
    const start2 = Date.now();
    await this.validateDomain(domain);
    const end2 = Date.now();
    console.log(`Time: ${end2 - start2}ms`);
    
    console.log(`\n📈 Cache performance: ${Math.round((end1 - start1) / (end2 - start2))}x faster!`);
  }
}

async function runDemo() {
  console.log('🚀 Starting Domain Validation Demo\n');
  
  const demo = new DomainValidationDemo();
  
  try {
    // Demo 1: Validate domains for real companies
    await demo.demoCompanyValidation('UKG');
    await demo.demoCompanyValidation('Microsoft');
    await demo.demoCompanyValidation('FakeCompany123');
    
    // Demo 2: Compare different validation scenarios
    await demo.compareMethods();
    
    // Demo 3: Show caching performance
    await demo.demonstrateCaching();
    
    console.log(`\n🎉 Demo completed successfully!`);
    console.log(`\n💡 Key Takeaways:`);
    console.log(`   • MX records = domain can definitely receive emails`);
    console.log(`   • A records = domain exists, might accept emails`);
    console.log(`   • No records = domain doesn't exist`);
    console.log(`   • Caching makes repeated lookups much faster`);
    console.log(`   • Only validated domains are used for email generation`);
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.log('\n🔧 Possible issues:');
    console.log('   • No internet connection');
    console.log('   • DNS servers are slow/unavailable');
    console.log('   • Firewall blocking DNS queries');
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runDemo();
}

module.exports = DomainValidationDemo;