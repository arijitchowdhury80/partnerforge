#!/bin/bash
# Run comprehensive domain enrichment in controlled batches
#
# RATE LIMITS (BuiltWith):
# - Max 8 concurrent requests
# - Max 10 requests/second
#
# This script launches 5 agents with 2-second gaps between batches
# Each agent processes 100 domains with 2-second delays between calls
#
# Usage:
#   ./scripts/run-comprehensive-batch.sh 0 5    # Run batches 0-4 (500 domains)
#   ./scripts/run-comprehensive-batch.sh 500 5  # Run batches 5-9 (domains 500-999)
#
# To process all 14,307 domains: Run 144 batches (0-14300 in groups of 5)

START_OFFSET=${1:-0}
NUM_BATCHES=${2:-5}
BATCH_SIZE=100
GAP_SECONDS=3  # Gap between launching agents

cd "$(dirname "$0")/.."

echo "============================================================"
echo "COMPREHENSIVE ENRICHMENT - CONTROLLED BATCH RUN"
echo "============================================================"
echo ""
echo "Start offset: $START_OFFSET"
echo "Number of batches: $NUM_BATCHES"
echo "Batch size: $BATCH_SIZE"
echo "Gap between launches: ${GAP_SECONDS}s"
echo "Total domains: $((NUM_BATCHES * BATCH_SIZE))"
echo ""
echo "Rate limits: 2s between API calls, 5 concurrent agents max"
echo "============================================================"
echo ""

# Launch batches with gaps
for ((i=0; i<NUM_BATCHES; i++)); do
  OFFSET=$((START_OFFSET + i * BATCH_SIZE))
  echo "[$(date '+%H:%M:%S')] Launching batch $((i+1))/$NUM_BATCHES (domains $OFFSET to $((OFFSET + BATCH_SIZE - 1)))..."

  npx ts-node scripts/enrich-domain-comprehensive.ts --start $OFFSET --count $BATCH_SIZE &

  # Wait before launching next batch to stagger the requests
  if [ $i -lt $((NUM_BATCHES - 1)) ]; then
    sleep $GAP_SECONDS
  fi
done

echo ""
echo "All $NUM_BATCHES batches launched. Waiting for completion..."
echo "Press Ctrl+C to abort (but already-running batches will continue)"
echo ""
wait

echo ""
echo "============================================================"
echo "ALL BATCHES COMPLETE"
echo "============================================================"
echo ""

# Show summary from database
echo "Verifying results..."
npx ts-node -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://xbitqeejsgqnwvxlnjra.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiaXRxZWVqc2dxbnd2eGxuanJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODU1NDAsImV4cCI6MjA4NzY2MTU0MH0.XoEOx8rHo_1EyCF4yJ3g2S3tXUX_XepQu9PSfUWvyIg'
);

async function summary() {
  const { count: totalCompanies } = await supabase.from('companies').select('*', { count: 'exact', head: true });
  const { count: enrichedCompanies } = await supabase.from('companies').select('*', { count: 'exact', head: true }).not('source', 'is', null).eq('source', 'builtwith-domain');
  const { count: totalTechs } = await supabase.from('company_technologies').select('*', { count: 'exact', head: true });

  console.log('Summary:');
  console.log('  Total companies: ' + totalCompanies);
  console.log('  Enriched (builtwith-domain): ' + enrichedCompanies);
  console.log('  Technologies stored: ' + totalTechs);
}

summary().catch(console.error);
"
