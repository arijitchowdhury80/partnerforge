#!/bin/bash
# Full enrichment with wave-based parallelization
#
# Processes ALL 14,307 domains in waves of 5 parallel agents
# Each wave: 5 agents × 500 domains = 2,500 domains
# Total: 6 waves to complete
#
# Progress is saved after each wave - can resume if interrupted
#
# Usage:
#   ./scripts/run-full-enrichment.sh           # Start from beginning
#   ./scripts/run-full-enrichment.sh 5000      # Resume from domain 5000

START_FROM=${1:-0}
TOTAL_DOMAINS=14307
AGENTS_PER_WAVE=5
DOMAINS_PER_AGENT=500
DOMAINS_PER_WAVE=$((AGENTS_PER_WAVE * DOMAINS_PER_AGENT))  # 2500

cd "$(dirname "$0")/.."

echo "============================================================"
echo "FULL ENRICHMENT - ALL $TOTAL_DOMAINS DOMAINS"
echo "============================================================"
echo ""
echo "Strategy: $AGENTS_PER_WAVE parallel agents per wave"
echo "Domains per agent: $DOMAINS_PER_AGENT"
echo "Domains per wave: $DOMAINS_PER_WAVE"
echo "Starting from: $START_FROM"
echo ""

CURRENT=$START_FROM
WAVE=1

while [ $CURRENT -lt $TOTAL_DOMAINS ]; do
  REMAINING=$((TOTAL_DOMAINS - CURRENT))
  echo "============================================================"
  echo "WAVE $WAVE - Starting at domain $CURRENT ($REMAINING remaining)"
  echo "============================================================"

  # Launch agents for this wave
  for ((i=0; i<AGENTS_PER_WAVE; i++)); do
    OFFSET=$((CURRENT + i * DOMAINS_PER_AGENT))

    # Don't exceed total
    if [ $OFFSET -ge $TOTAL_DOMAINS ]; then
      break
    fi

    # Calculate count (don't exceed remaining)
    COUNT=$DOMAINS_PER_AGENT
    if [ $((OFFSET + COUNT)) -gt $TOTAL_DOMAINS ]; then
      COUNT=$((TOTAL_DOMAINS - OFFSET))
    fi

    echo "[$(date '+%H:%M:%S')] Agent $((i+1)): domains $OFFSET to $((OFFSET + COUNT - 1))"
    npx ts-node scripts/enrich-domain-comprehensive.ts --start $OFFSET --count $COUNT &

    sleep 2  # Stagger launches
  done

  echo ""
  echo "Wave $WAVE launched. Waiting for completion..."
  wait

  echo ""
  echo "Wave $WAVE complete!"
  echo ""

  # Move to next wave
  CURRENT=$((CURRENT + DOMAINS_PER_WAVE))
  WAVE=$((WAVE + 1))

  # Brief pause between waves
  if [ $CURRENT -lt $TOTAL_DOMAINS ]; then
    echo "Pausing 5 seconds before next wave..."
    sleep 5
  fi
done

echo "============================================================"
echo "ALL WAVES COMPLETE!"
echo "============================================================"
echo ""
echo "Total domains processed: $TOTAL_DOMAINS"
echo ""

# Quick verification
echo "Checking results..."
npx ts-node scripts/check-schema-status.ts 2>/dev/null || echo "(verification script not available)"
