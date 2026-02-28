#!/bin/bash
# Run domain enrichment in controlled batches
# Usage: ./scripts/run-enrichment-batch.sh <start_offset> <num_batches>
# Example: ./scripts/run-enrichment-batch.sh 0 5  (runs batches 0-4, each 100 domains)

START_OFFSET=${1:-0}
NUM_BATCHES=${2:-5}
BATCH_SIZE=100
GAP_SECONDS=2

cd "$(dirname "$0")/.."

echo "=== CONTROLLED ENRICHMENT RUN ==="
echo "Starting at offset: $START_OFFSET"
echo "Number of batches: $NUM_BATCHES"
echo "Batch size: $BATCH_SIZE"
echo "Gap between batches: ${GAP_SECONDS}s"
echo ""

for ((i=0; i<NUM_BATCHES; i++)); do
  OFFSET=$((START_OFFSET + i * BATCH_SIZE))
  echo "[$(date '+%H:%M:%S')] Starting batch $((i+1))/$NUM_BATCHES (offset $OFFSET)..."

  # Run in background
  npx ts-node scripts/enrich-domain-techstack.ts --start $OFFSET --count $BATCH_SIZE &

  # Wait before launching next batch
  sleep $GAP_SECONDS
done

echo ""
echo "All batches launched. Waiting for completion..."
wait

echo ""
echo "=== ALL BATCHES COMPLETE ==="
