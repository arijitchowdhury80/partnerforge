import { createClient } from '@supabase/supabase-js';
import { SimilarWebClient } from './services/similarweb';
import dotenv from 'dotenv';

dotenv.config();

async function quickTest() {
  console.log('🧪 Testing basic functionality...\n');
  
  // Test 1: Database connection
  console.log('Test 1: Database connection...');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );
  
  const { data, error } = await supabase
    .from('companies')
    .select('count')
    .limit(1);
  
  if (error) {
    console.log('❌ Database connection failed:', error.message);
    process.exit(1);
  }
  console.log('✅ Database connected\n');
  
  // Test 2: API client
  console.log('Test 2: SimilarWeb API client...');
  const similarweb = new SimilarWebClient();
  
  try {
    const traffic = await similarweb.getTrafficData('costco.com');
    console.log('✅ API client working');
    console.log('   Monthly visits:', traffic.visits?.toLocaleString() || 'N/A');
    console.log('   Cache hit:', traffic.cached ? 'Yes' : 'No\n');
  } catch (err: any) {
    console.log('⚠️  API call failed (expected if no API key):', err.message.substring(0, 50));
  }
  
  console.log('\n✅ Basic tests complete!');
  console.log('\nNext steps:');
  console.log('1. Add API keys to backend/.env');
  console.log('2. Start Redis: redis-server');
  console.log('3. Run full enrichment test');
}

quickTest();
