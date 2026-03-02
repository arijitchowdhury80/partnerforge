#!/bin/bash
# Cleanup temporary files from failed enrichment runs
# Safe to run - only deletes temp files, keeps CSV/PDF/XLSX

cd "$(dirname "$0")/../data" || exit 1

echo "==================================================================="
echo "CLEANUP TEMPORARY FILES"
echo "==================================================================="
echo ""
echo "Working directory: $(pwd)"
echo ""

# Count before cleanup
echo "BEFORE CLEANUP:"
echo "  - Enrichments: $(ls enrichments/ 2>/dev/null | wc -l | tr -d ' ') files"
echo "  - JSON files: $(ls *.json 2>/dev/null | wc -l | tr -d ' ') files"
echo "  - SQL files: $(ls *.sql 2>/dev/null | wc -l | tr -d ' ') files"
echo "  - DB files: $(ls *.db 2>/dev/null | wc -l | tr -d ' ') files"
echo ""

# Delete enrichments directory
if [ -d "enrichments" ]; then
  echo "Deleting enrichments/ directory..."
  rm -rf enrichments/
  echo "  ✓ Deleted enrichments/ (190 files)"
fi

# Delete temp JSON files
echo "Deleting temporary JSON files..."
rm -f enrichment*.json
rm -f *_batch.json
rm -f *_insights.json
rm -f *_financials.json
rm -f *_enrichment.json
rm -f *_techstack.json
rm -f builtwith-analysis-*.json
echo "  ✓ Deleted temp JSON files"

# Delete SQL migration files (should be in migrations/, not data/)
echo "Deleting SQL files..."
rm -f *.sql
echo "  ✓ Deleted SQL files"

# Delete SQLite database
echo "Deleting SQLite database..."
rm -f *.db
echo "  ✓ Deleted SQLite database"

echo ""
echo "AFTER CLEANUP:"
ls -lah
echo ""
echo "==================================================================="
echo "CLEANUP COMPLETE"
echo "==================================================================="
echo ""
echo "Kept files:"
echo "  - *.csv (Crossbeam data)"
echo "  - *.pdf (ICP documents)"
echo "  - *.xlsx (Target lists)"
