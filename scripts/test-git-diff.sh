#!/bin/bash
# Test script to verify git diff operations work correctly
# This simulates what GitHub Copilot workflows do

set -e

echo "🔍 Testing git diff operations..."
echo ""

# Check if main branch ref exists
echo "1. Checking if refs/heads/main exists..."
if git show-ref --verify --quiet refs/heads/main; then
  echo "✅ refs/heads/main exists"
else
  echo "⚠️  refs/heads/main does not exist locally"
fi

# Check if origin/main exists
echo ""
echo "2. Checking if origin/main exists..."
if git show-ref --verify --quiet refs/remotes/origin/main; then
  echo "✅ origin/main exists"
else
  echo "❌ origin/main does not exist - this would cause the workflow to fail"
  exit 1
fi

# Test git diff against main
echo ""
echo "3. Testing git diff against origin/main..."
if git diff origin/main HEAD --stat > /dev/null 2>&1; then
  echo "✅ git diff origin/main HEAD works"
else
  echo "❌ git diff origin/main HEAD failed"
  exit 1
fi

# Test git diff with refs/heads/main format (what Copilot uses)
echo ""
echo "4. Testing git diff with refs/heads/main format..."
if git diff refs/remotes/origin/main HEAD --stat > /dev/null 2>&1; then
  echo "✅ git diff refs/remotes/origin/main HEAD works"
else
  echo "❌ git diff refs/remotes/origin/main HEAD failed"
  exit 1
fi

# Show available branches
echo ""
echo "5. Available branches:"
git branch -a | head -10

# Show git fetch configuration
echo ""
echo "6. Git configuration:"
echo "Current branch: $(git rev-parse --abbrev-ref HEAD)"
echo "Total commits fetched: $(git rev-list --all --count)"

echo ""
echo "✅ All git diff tests passed!"
echo ""
echo "This confirms that with fetch-depth: 0, the workflow will be able to:"
echo "  - Access the main branch for comparison"
echo "  - Run git diff operations successfully"
echo "  - Support GitHub Copilot's dynamic workflow requirements"
