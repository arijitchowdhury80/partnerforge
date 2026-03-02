import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function showICP() {
  const { data, error } = await supabase
    .from('industries')
    .select('name, icp_confidence, icp_proof_points, icp_keywords, icp_notes')
    .order('icp_confidence', { ascending: false })
    .order('name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== ALGOLIA ICP BY INDUSTRY ===\n');

  const byConfidence: Record<string, any[]> = {};
  data.forEach(ind => {
    const conf = ind.icp_confidence || 'NEUTRAL';
    if (!byConfidence[conf]) byConfidence[conf] = [];
    byConfidence[conf].push(ind);
  });

  ['HIGH', 'MEDIUM', 'LOW', 'NEUTRAL', 'NEGATIVE'].forEach(level => {
    if (byConfidence[level]) {
      console.log(`\n${level} CONFIDENCE (${byConfidence[level].length} industries):`);
      byConfidence[level].forEach(ind => {
        const proof = ind.icp_proof_points ? ` [${ind.icp_proof_points} proof points]` : '';
        const keywords = ind.icp_keywords ? `\n    Keywords: ${ind.icp_keywords.join(', ')}` : '';
        const notes = ind.icp_notes ? `\n    Notes: ${ind.icp_notes}` : '';
        console.log(`  • ${ind.name}${proof}${keywords}${notes}`);
      });
    }
  });
}

showICP().catch(console.error);
