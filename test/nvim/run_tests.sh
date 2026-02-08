#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PASS=0
FAIL=0
FAILED_TESTS=()

echo "Running Neovim integration tests..."
echo ""

for test_file in "$SCRIPT_DIR"/test_*.lua; do
  test_name="$(basename "$test_file" .lua)"
  printf "  %-25s " "$test_name"

  stderr_file=$(mktemp)
  if nvim --headless --noplugin -u NONE \
    --cmd "set rtp^=$PLUGIN_ROOT" \
    -l "$test_file" 2>"$stderr_file"; then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("$test_name")
    if [ -s "$stderr_file" ]; then
      sed 's/^/    /' "$stderr_file"
    fi
  fi
  rm -f "$stderr_file"
done

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ $FAIL -gt 0 ]; then
  echo "Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
  exit 1
fi
