#!/bin/bash

# Security Scan Script
# Scans the repository for potential secrets and security issues
# Run this before committing sensitive changes

set -e

echo "🔍 Meta Ads Security Scanner"
echo "============================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ISSUES_FOUND=0

# Function to report issues
report_issue() {
    echo -e "${RED}❌ ISSUE:${NC} $1"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
}

# Function to report warnings
report_warning() {
    echo -e "${YELLOW}⚠️  WARNING:${NC} $1"
}

# Function to report success
report_success() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
}

# 1. Check for common secret patterns in tracked files
echo "1️⃣  Checking for hardcoded secrets..."
# Check for potential secrets in code files (case-insensitive, catches API_KEY, api_key, etc.)
secret_pattern="([Aa][Pp][Ii][_-]?[Kk][Ee][Yy]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]|[Tt][Oo][Kk][Ee][Nn]|[Aa][Cc][Cc][Ee][Ss][Ss][_-]?[Kk][Ee][Yy])[\"'][[:space:]]*[:=][[:space:]]*[\"'][a-zA-Z0-9]{8,}"
git_results=$(git grep -E "$secret_pattern" -- '*.ts' '*.js' '*.json' '*.yml' '*.yaml' 2>/dev/null || true)

if [ -n "$git_results" ]; then
    # Filter out false positives (comments and process.env references)
    filtered=$(echo "$git_results" | grep -v "process.env" | grep -v ".example" | grep -v "test" | grep -v "//" | grep -v "^[[:space:]]*\*" || true)
    if [ -n "$filtered" ]; then
        report_issue "Potential hardcoded secrets found in code"
    else
        report_success "No obvious hardcoded secrets detected"
    fi
else
    report_success "No obvious hardcoded secrets detected"
fi

# 2. Check for .env files in git
echo ""
echo "2️⃣  Checking for .env files in repository..."
if git ls-files | grep -E "^\.env$|^\.env\..*" | grep -v ".env.example"; then
    report_issue ".env files found in git history"
else
    report_success "No .env files tracked in git"
fi

# 3. Check for sensitive file extensions
echo ""
echo "3️⃣  Checking for sensitive file extensions..."
SENSITIVE_EXTENSIONS=".pem .key .p12 .pfx .cer .crt .der"
found_sensitive=false
for ext in $SENSITIVE_EXTENSIONS; do
    if git ls-files | grep "$ext$"; then
        report_warning "Found files with extension $ext"
        found_sensitive=true
    fi
done
if [ "$found_sensitive" = false ]; then
    report_success "No sensitive file extensions found"
fi

# 4. Check .gitignore includes .env
echo ""
echo "4️⃣  Verifying .gitignore configuration..."
if grep -q "^\.env$" .gitignore 2>/dev/null; then
    report_success ".env properly ignored"
else
    report_issue ".env not found in .gitignore"
fi

# 5. Check for AWS keys
echo ""
echo "5️⃣  Checking for AWS credentials..."
if git grep -E "AKIA[0-9A-Z]{16}" 2>/dev/null; then
    report_issue "Potential AWS access key found"
else
    report_success "No AWS credentials detected"
fi

# 6. Check for private keys
echo ""
echo "6️⃣  Checking for private keys..."
if git grep -E "BEGIN (RSA|DSA|EC|OPENSSH|PGP) PRIVATE KEY" 2>/dev/null; then
    report_issue "Private key found in repository"
else
    report_success "No private keys detected"
fi

# 7. Check .env.example exists
echo ""
echo "7️⃣  Checking for .env.example..."
if [ -f ".env.example" ]; then
    report_success ".env.example exists for reference"
    # Check if .env.example has placeholder values
    if grep -qE "(your-.*-here|changeme|example|placeholder|xxx)" .env.example; then
        report_success ".env.example uses placeholder values"
    else
        report_warning ".env.example might contain real values"
    fi
else
    report_warning ".env.example not found"
fi

# 8. Check for MongoDB connection strings
echo ""
echo "8️⃣  Checking for hardcoded MongoDB URIs..."
# Check for both mongodb:// and mongodb+srv:// with credentials
if git grep -E "mongodb(\+srv)?://[^/]*:[^@/]+@" -- '*.ts' '*.js' | grep -v "process.env" | grep -v "localhost" | grep -v "//"; then
    report_issue "Hardcoded MongoDB URI with credentials found"
else
    report_success "No hardcoded MongoDB URIs detected"
fi

# 9. Check for JWT secrets
echo ""
echo "9️⃣  Checking for hardcoded JWT secrets..."
# Check for JWT secrets with or without quotes (case-insensitive, scans .env files too)
jwt_pattern="([Jj][Ww][Tt][_-]?[Ss][Ee][Cc][Rr][Ee][Tt]|[Nn][Ee][Xx][Tt][Aa][Uu][Tt][Hh][_-]?[Ss][Ee][Cc][Rr][Ee][Tt])[\"'][[:space:]]*[:=][[:space:]]*[\"'][a-zA-Z0-9]{10,}"
if git grep -E "$jwt_pattern" -- '*.ts' '*.js' '.env' '.env.*' 2>/dev/null | grep -v "process.env" | grep -v ".env.example"; then
    report_issue "Hardcoded JWT secret found"
else
    report_success "No hardcoded JWT secrets detected"
fi

# 10. Summary
echo ""
echo "============================"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ Security scan completed: No issues found${NC}"
    echo "Your code appears to be following security best practices."
    exit 0
else
    echo -e "${RED}❌ Security scan completed: $ISSUES_FOUND issue(s) found${NC}"
    echo ""
    echo "Please fix the issues above before committing."
    echo "See SECURITY.md for security best practices."
    exit 1
fi
