#!/bin/bash

# ============================================
# Admin Endpoint Protection Test
# ============================================
# Tests all admin endpoint scenarios
# ============================================

API_URL="${API_URL:-https://adream-backend-production.up.railway.app}"
USER_TOKEN="${USER_TOKEN:-your-user-token-here}"
ADMIN_TOKEN="${ADMIN_TOKEN:-your-admin-token-here}"

echo "🔐 Testing Admin Endpoint Protection..."
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: No authentication
echo "1️⃣ Testing /telegram/set-webhook WITHOUT token..."
status1=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL/telegram/set-webhook" \
  -H "Content-Type: application/json")

if [ "$status1" = "401" ]; then
  echo -e "${GREEN}✅ Protected - Returns 401 Unauthorized${NC}"
else
  echo -e "${RED}❌ NOT Protected - Returns $status1${NC}"
fi
echo ""

# Test 2: With user token (non-admin)
if [ "$USER_TOKEN" != "your-user-token-here" ]; then
  echo "2️⃣ Testing /telegram/set-webhook WITH user token (non-admin)..."
  status2=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_URL/telegram/set-webhook" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json")
  
  if [ "$status2" = "403" ]; then
    echo -e "${GREEN}✅ Protected - Returns 403 Forbidden (admin required)${NC}"
  elif [ "$status2" = "401" ]; then
    echo -e "${YELLOW}⚠️  Returns 401 - Token may be invalid${NC}"
  else
    echo -e "${RED}❌ NOT Protected - Returns $status2${NC}"
  fi
else
  echo "2️⃣ Skipped - USER_TOKEN not set"
fi
echo ""

# Test 3: With admin token
if [ "$ADMIN_TOKEN" != "your-admin-token-here" ]; then
  echo "3️⃣ Testing /telegram/set-webhook WITH admin token..."
  status3=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_URL/telegram/set-webhook" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")
  
  if [ "$status3" = "200" ]; then
    echo -e "${GREEN}✅ Accessible - Returns 200 OK (admin access works)${NC}"
  else
    echo -e "${YELLOW}⚠️  Returns $status3 - May need to check token${NC}"
  fi
else
  echo "3️⃣ Skipped - ADMIN_TOKEN not set"
fi
echo ""

# Test 4: Other admin endpoint
echo "4️⃣ Testing /telegram/set-commands WITHOUT token..."
status4=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_URL/telegram/set-commands" \
  -H "Content-Type: application/json")

if [ "$status4" = "401" ]; then
  echo -e "${GREEN}✅ Protected - Returns 401 Unauthorized${NC}"
else
  echo -e "${RED}❌ NOT Protected - Returns $status4${NC}"
fi
echo ""

echo "======================================="
echo "📊 Summary"
echo "======================================="
echo "Both admin endpoints should return 401 without authentication"
echo "✅ Test complete!"

