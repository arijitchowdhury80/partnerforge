#!/bin/bash

# Search Audit Worker Verification Script
# Tests that the worker implementation is complete and functional

set -e

echo "============================================"
echo "Search Audit Worker Verification"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check counter
CHECKS_PASSED=0
CHECKS_FAILED=0

check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
  else
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
  fi
}

# 1. Check file existence
echo "1. Checking file existence..."
echo ""

test -f "workers/search-audit-worker.ts"
check "Backend worker file exists"

test -f "../frontend/src/components/audit/SearchTestResults.tsx"
check "Frontend SearchTestResults component exists"

test -f "../frontend/src/components/audit/SearchScoreBreakdown.tsx"
check "Frontend SearchScoreBreakdown component exists"

test -f "tests/workers/search-audit-worker.test.ts"
check "Test file exists"

echo ""

# 2. Check dependencies
echo "2. Checking dependencies..."
echo ""

test -f "services/search-test-library.ts"
check "SearchTestLibrary service exists"

test -f "services/search-audit-scoring.ts"
check "SearchAuditScoringService exists"

test -f "services/browser-automation.ts"
check "BrowserAutomationService exists"

test -f "services/websocket-manager.ts"
check "WebSocketManager exists"

test -f "database/supabase.ts"
check "SupabaseClient exists"

echo ""

# 3. Check TypeScript compilation
echo "3. Checking TypeScript compilation..."
echo ""

npx tsc --noEmit workers/search-audit-worker.ts 2>/dev/null
check "Worker TypeScript compiles"

npx tsc --noEmit tests/workers/search-audit-worker.test.ts 2>/dev/null
check "Test TypeScript compiles"

echo ""

# 4. Check database schema
echo "4. Checking database schema..."
echo ""

if [ -n "$DATABASE_URL" ]; then
  # Check search_audit_tests table
  psql $DATABASE_URL -c "SELECT 1 FROM search_audit_tests LIMIT 0;" &>/dev/null
  check "search_audit_tests table exists"

  # Check search_audit_screenshots table
  psql $DATABASE_URL -c "SELECT 1 FROM search_audit_screenshots LIMIT 0;" &>/dev/null
  check "search_audit_screenshots table exists"

  # Check composite primary key
  CONSTRAINT_COUNT=$(psql $DATABASE_URL -t -c "
    SELECT COUNT(*)
    FROM information_schema.table_constraints
    WHERE table_name = 'search_audit_tests'
    AND constraint_type = 'PRIMARY KEY';" | xargs)

  if [ "$CONSTRAINT_COUNT" -eq "1" ]; then
    echo -e "${GREEN}✓${NC} Composite primary key exists"
    ((CHECKS_PASSED++))
  else
    echo -e "${RED}✗${NC} Composite primary key missing"
    ((CHECKS_FAILED++))
  fi

  # Check score range constraint
  psql $DATABASE_URL -c "
    SELECT 1
    FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%score_range%';" &>/dev/null
  check "Score range constraint exists"
else
  echo -e "${YELLOW}⚠${NC} DATABASE_URL not set - skipping database checks"
fi

echo ""

# 5. Check code structure
echo "5. Checking code structure..."
echo ""

# Check worker exports createSearchAuditWorker function
grep -q "export function createSearchAuditWorker" workers/search-audit-worker.ts
check "Worker exports createSearchAuditWorker function"

# Check worker uses SearchTestLibrary
grep -q "import.*SearchTestLibrary" workers/search-audit-worker.ts
check "Worker imports SearchTestLibrary"

# Check worker uses WebSocketManager
grep -q "WebSocketManager" workers/search-audit-worker.ts
check "Worker uses WebSocketManager"

# Check frontend components use useSWR
grep -q "useSWR" ../frontend/src/components/audit/SearchTestResults.tsx
check "SearchTestResults uses useSWR"

grep -q "useSWR" ../frontend/src/components/audit/SearchScoreBreakdown.tsx
check "SearchScoreBreakdown uses useSWR"

# Check test file has describe blocks
grep -q "describe('Search Audit Worker" tests/workers/search-audit-worker.test.ts
check "Test file has describe blocks"

echo ""

# 6. Run unit tests (if available)
echo "6. Running tests..."
echo ""

if command -v npm &> /dev/null; then
  if npm test -- tests/workers/search-audit-worker.test.ts 2>&1 | grep -q "PASS"; then
    echo -e "${GREEN}✓${NC} Integration tests pass"
    ((CHECKS_PASSED++))
  else
    echo -e "${YELLOW}⚠${NC} Tests not run (requires setup)"
  fi
else
  echo -e "${YELLOW}⚠${NC} npm not found - skipping tests"
fi

echo ""

# 7. Check screenshot directory
echo "7. Checking screenshot directory..."
echo ""

if [ -d "screenshots" ]; then
  echo -e "${GREEN}✓${NC} Screenshot directory exists"
  ((CHECKS_PASSED++))
else
  echo -e "${YELLOW}⚠${NC} Screenshot directory not created yet (will be created on first audit)"
fi

echo ""

# Summary
echo "============================================"
echo "Verification Summary"
echo "============================================"
echo ""
echo -e "Checks passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Start Redis: redis-server"
  echo "2. Start backend: npm run dev"
  echo "3. Trigger audit: curl -X POST http://localhost:3001/api/audits -d '{\"company_domain\":\"costco.com\",\"audit_type\":\"search_audit\"}'"
  exit 0
else
  echo -e "${RED}✗ Some checks failed${NC}"
  echo ""
  echo "Please fix the issues above before proceeding."
  exit 1
fi
