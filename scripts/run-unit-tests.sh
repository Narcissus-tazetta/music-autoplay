#!/usr/bin/env bash
# Run all unit tests sequentially and provide a summary
# This script works around Bun test runner's issue where multiple files
# don't all execute when passed together.

set -euo pipefail

PASS=0
FAIL=0
TOTAL_TESTS=0
TOTAL_EXPECTS=0
START_TIME=$(date +%s)

echo ""
echo "========================================="
echo "  Running Unit Tests"
echo "========================================="
echo ""

for f in tests/unit/*.test.ts; do
  filename=$(basename "$f")
  printf "📝 Running: %s\n" "$filename"
  
  if output=$(bun test "$f" 2>&1); then
    PASS=$((PASS + 1))
    
    # Extract test count and expect count from output
    tests=$(echo "$output" | grep -oE '[0-9]+ pass' | head -1 | grep -oE '[0-9]+' || echo "0")
    expects=$(echo "$output" | grep -oE '[0-9]+ expect\(\) calls' | head -1 | grep -oE '[0-9]+' || echo "0")
    
    TOTAL_TESTS=$((TOTAL_TESTS + tests))
    TOTAL_EXPECTS=$((TOTAL_EXPECTS + expects))
    
    printf "   ✅ PASS (%s tests, %s expects)\n\n" "$tests" "$expects"
  else
    FAIL=$((FAIL + 1))
    printf "   ❌ FAIL\n"
    echo "$output"
    echo ""
    exit 1
  fi
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "========================================="
echo "  Test Summary"
echo "========================================="
echo "Files passed:    $PASS"
echo "Files failed:    $FAIL"
echo "Total tests:     $TOTAL_TESTS"
echo "Total expects:   $TOTAL_EXPECTS"
echo "Duration:        ${DURATION}s"
echo "========================================="
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi

exit 0
