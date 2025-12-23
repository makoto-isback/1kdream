#!/bin/bash

# ============================================
# Security Testing Script
# ============================================
# Replace these values with your actual URLs and tokens
# ============================================

API_URL="${API_URL:-https://adream-backend-production.up.railway.app}"
FRONTEND_URL="${FRONTEND_URL:-https://adream-frontend-production.up.railway.app}"

# You need to set these tokens manually
TOKEN="${TOKEN:-your-jwt-token-here}"
ADMIN_TOKEN="${ADMIN_TOKEN:-your-admin-token-here}"

echo "🔒 Testing Security Improvements..."
echo "=================================="
echo ""
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Rate Limiting Headers
echo "1️⃣ Testing Rate Limiting Headers..."
RATE_HEADERS=$(curl -s -I "$API_URL/lottery/active" -H "Authorization: Bearer $TOKEN" 2>&1)
if echo "$RATE_HEADERS" | grep -qi "rate"; then
  echo -e "${GREEN}✅ Rate limiting headers present${NC}"
  echo "$RATE_HEADERS" | grep -i "rate" | head -3
else
  echo -e "${RED}❌ Rate limiting headers missing${NC}"
  echo "Response:"
  echo "$RATE_HEADERS" | head -5
fi
echo ""

# Test 2: Admin Endpoint Protection (without auth)
echo "2️⃣ Testing Admin Endpoint Protection (No Auth)..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/telegram/set-webhook" 2>&1)
if [ "$ADMIN_STATUS" = "401" ] || [ "$ADMIN_STATUS" = "403" ]; then
  echo -e "${GREEN}✅ Admin endpoint protected (Status: $ADMIN_STATUS)${NC}"
else
  echo -e "${RED}❌ Admin endpoint not properly protected (Status: $ADMIN_STATUS)${NC}"
fi
echo ""

# Test 3: Security Headers
echo "3️⃣ Testing Security Headers..."
SEC_HEADERS=$(curl -s -I "$API_URL/lottery/active" -H "Authorization: Bearer $TOKEN" 2>&1)
SECURITY_FOUND=false

if echo "$SEC_HEADERS" | grep -qi "x-content-type"; then
  SECURITY_FOUND=true
fi
if echo "$SEC_HEADERS" | grep -qi "x-frame"; then
  SECURITY_FOUND=true
fi
if echo "$SEC_HEADERS" | grep -qi "x-xss"; then
  SECURITY_FOUND=true
fi

if [ "$SECURITY_FOUND" = true ]; then
  echo -e "${GREEN}✅ Security headers present${NC}"
  echo "$SEC_HEADERS" | grep -iE "x-content-type|x-frame|x-xss|strict-transport" | head -5
else
  echo -e "${RED}❌ Security headers missing${NC}"
  echo "Response headers:"
  echo "$SEC_HEADERS" | head -10
fi
echo ""

# Test 4: CORS - Frontend URL
echo "4️⃣ Testing CORS (Frontend URL)..."
CORS_RESPONSE=$(curl -s -I "$API_URL/lottery/active" \
  -H "Origin: $FRONTEND_URL" \
  -H "Authorization: Bearer $TOKEN" 2>&1)

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
  echo -e "${GREEN}✅ CORS configured for frontend${NC}"
  CORS_ORIGIN=$(echo "$CORS_RESPONSE" | grep -i "access-control-allow-origin" | head -1)
  echo "  $CORS_ORIGIN"
else
  echo -e "${RED}❌ CORS not working for frontend URL${NC}"
  echo "Response:"
  echo "$CORS_RESPONSE" | head -10
fi
echo ""

# Test 5: CORS - Telegram Origin
echo "5️⃣ Testing CORS (Telegram Origin)..."
TELEGRAM_CORS=$(curl -s -I "$API_URL/lottery/active" \
  -H "Origin: https://web.telegram.org" \
  -H "Authorization: Bearer $TOKEN" 2>&1)

if echo "$TELEGRAM_CORS" | grep -qi "access-control-allow-origin.*telegram"; then
  echo -e "${GREEN}✅ CORS configured for Telegram${NC}"
  echo "$TELEGRAM_CORS" | grep -i "access-control-allow-origin" | head -1
else
  echo -e "${YELLOW}⚠️ CORS for Telegram origin not found${NC}"
fi
echo ""

# Test 6: CORS - Unauthorized Origin
echo "6️⃣ Testing CORS (Unauthorized Origin)..."
EVIL_CORS=$(curl -s -I "$API_URL/lottery/active" \
  -H "Origin: https://evil-site.com" \
  -H "Authorization: Bearer $TOKEN" 2>&1)

if echo "$EVIL_CORS" | grep -qi "access-control-allow-origin.*evil"; then
  echo -e "${RED}❌ CORS allows unauthorized origin (SECURITY ISSUE!)${NC}"
else
  echo -e "${GREEN}✅ CORS blocks unauthorized origin${NC}"
fi
echo ""

# Test 7: Admin Endpoint with Admin Token (if provided)
if [ "$ADMIN_TOKEN" != "your-admin-token-here" ]; then
  echo "7️⃣ Testing Admin Endpoint (With Admin Token)..."
  ADMIN_WITH_TOKEN=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_URL/telegram/set-webhook" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>&1)
  
  if [ "$ADMIN_WITH_TOKEN" = "200" ]; then
    echo -e "${GREEN}✅ Admin endpoint accessible with admin token${NC}"
  else
    echo -e "${YELLOW}⚠️ Admin endpoint returned status: $ADMIN_WITH_TOKEN${NC}"
  fi
  echo ""
fi

# Summary
echo "=================================="
echo "📊 Test Summary"
echo "=================================="
echo ""
echo "To test rate limiting with rapid requests, run:"
echo "  for i in {1..150}; do curl -s -o /dev/null -w \"%{http_code}\" -X GET \"$API_URL/lottery/active\" -H \"Authorization: Bearer $TOKEN\"; done | sort | uniq -c"
echo ""
echo "To get a token, login via Telegram Mini App and check browser localStorage"
echo ""
echo "✅ Testing complete!"

