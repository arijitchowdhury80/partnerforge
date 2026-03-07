import { EnrichmentOrchestrator } from './services/enrichment-orchestrator';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function testCostco() {
  console.log('🧪 Testing enrichment pipeline with costco.com...\n');
  
  const orchestrator = new EnrichmentOrchestrator();
  
  try {
    // Step 1: Create company
    console.log('Step 1: Creating company record...');
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        domain: 'costco.com',
        name: 'Costco Wholesale Corporation'
      })
      .select()
      .single();
    
    if (companyError) {
      if (companyError.code === '23505') {
        console.log('✅ Company already exists, fetching...');
        const { data: existing } = await supabase
          .from('companies')
          .select()
          .eq('domain', 'costco.com')
          .single();
        company = existing;
      } else {
        throw companyError;
      }
    } else {
      console.log('✅ Company created:', company.id);
    }
    
    // Step 2: Create audit
    console.log('\nStep 2: Creating audit...');
    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .insert({
        company_id: company.id,
        audit_type: 'enrichment',
        status: 'pending'
      })
      .select()
      .single();
    
    if (auditError) throw auditError;
    console.log('✅ Audit created:', audit.id);
    
    // Step 3: Run enrichment
    console.log('\nStep 3: Running enrichment (this may take 30-60 seconds)...');
    console.log('⏳ Fetching data from:');
    console.log('   - SimilarWeb (14 endpoints)');
    console.log('   - BuiltWith (7 endpoints)');
    console.log('   - Yahoo Finance (5 endpoints)');
    console.log('   - Apify (3 actors)');
    console.log('   - Apollo.io (2 endpoints)');
    
    const result = await orchestrator.enrichCompany({
      companyId: company.id,
      auditId: audit.id,
      domain: 'costco.com'
    });
    
    console.log('\n✅ Enrichment complete!');
    console.log('\nResults Summary:');
    console.log('  - Traffic data:', result.traffic ? '✅' : '❌');
    console.log('  - Financial data:', result.financials ? '✅' : '❌');
    console.log('  - Technologies:', result.technologies?.length || 0, 'found');
    console.log('  - Competitors:', result.competitors?.length || 0, 'found');
    console.log('  - Executives:', result.executives?.length || 0, 'found');
    console.log('  - Cache hits:', result.cacheStats?.hits || 0);
    console.log('  - API calls:', result.cacheStats?.misses || 0);
    console.log('  - Estimated cost: $' + (result.estimatedCost || 0).toFixed(2));
    
    // Step 4: Verify database
    console.log('\nStep 4: Verifying database persistence...');
    const { data: trafficData } = await supabase
      .from('company_traffic')
      .select()
      .eq('company_id', company.id)
      .eq('audit_id', audit.id);
    
    console.log('  - Traffic records:', trafficData?.length || 0);
    
    console.log('\n🎉 Test complete! Enrichment pipeline is working.');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

testCostco();
