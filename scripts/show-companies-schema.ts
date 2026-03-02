import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function main() {
  // Get one row to see all columns
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Companies table columns:');
    console.log('='.repeat(70));
    const columns = Object.keys(data[0]);
    columns.forEach((col, i) => {
      const value = data[0][col];
      const type = typeof value;
      console.log(`${(i + 1).toString().padStart(2)}. ${col.padEnd(30)} | ${type.padEnd(10)} | ${value}`);
    });
  }
}

main().catch(console.error);
