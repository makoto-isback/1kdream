#!/bin/bash

# Test Data Setup Script for ADream
# This script helps you set up test data for local testing

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000"
MOCK_USER_ID="123456789"  # The mock Telegram user ID from frontend

echo -e "${YELLOW}🧪 ADream Test Data Setup${NC}"
echo ""

# Check if backend is running
if ! curl -s "$API_URL" > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend is not running on $API_URL${NC}"
    echo "   Please start the backend first: cd apps/backend-api && npm run start:dev"
    exit 1
fi

echo -e "${GREEN}✅ Backend is running${NC}"
echo ""

# Step 1: Login as mock user to get JWT token
echo -e "${YELLOW}Step 1: Authenticating as mock user...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/telegram" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$MOCK_USER_ID\",
    \"first_name\": \"Dev\",
    \"last_name\": \"User\",
    \"username\": \"devuser\",
    \"auth_date\": $(date +%s),
    \"hash\": \"mock-hash-dev\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Failed to get authentication token${NC}"
    echo "   Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Authenticated successfully${NC}"
echo ""

# Step 2: Check if user needs to be added as admin
echo -e "${YELLOW}Step 2: Checking admin access...${NC}"
ADMIN_CHECK=$(curl -s -X GET "$API_URL/admin/check" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ADMIN_CHECK" | grep -q "isAdmin.*true"; then
    echo -e "${GREEN}✅ User is already an admin${NC}"
else
    echo -e "${YELLOW}⚠️  User is not an admin. Adding to admin list...${NC}"
    echo "   To make this user an admin, add $MOCK_USER_ID to ADMIN_TELEGRAM_IDS in .env"
    echo "   For now, we'll proceed with manual balance adjustment (if endpoint allows)"
fi
echo ""

# Step 3: Add balance to user account
echo -e "${YELLOW}Step 3: Adding test balance (100,000 KYAT)...${NC}"
BALANCE_RESPONSE=$(curl -s -X POST "$API_URL/admin/manual-adjust" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$MOCK_USER_ID\",
    \"amount\": 100000,
    \"type\": \"credit\",
    \"reason\": \"Test data setup\"
  }")

if echo "$BALANCE_RESPONSE" | grep -q "error\|Error\|unauthorized\|Unauthorized"; then
    echo -e "${RED}❌ Failed to add balance (may need admin access)${NC}"
    echo "   Response: $BALANCE_RESPONSE"
    echo ""
    echo -e "${YELLOW}💡 Manual steps:${NC}"
    echo "   1. Add $MOCK_USER_ID to ADMIN_TELEGRAM_IDS in apps/backend-api/.env"
    echo "   2. Restart backend"
    echo "   3. Run this script again"
else
    echo -e "${GREEN}✅ Added 100,000 KYAT to user account${NC}"
fi
echo ""

# Step 4: Verify active round exists
echo -e "${YELLOW}Step 4: Checking for active lottery round...${NC}"
ROUND_RESPONSE=$(curl -s -X GET "$API_URL/lottery/active")

if echo "$ROUND_RESPONSE" | grep -q "roundNumber"; then
    ROUND_NUM=$(echo "$ROUND_RESPONSE" | grep -o '"roundNumber":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ Active round exists: Round #$ROUND_NUM${NC}"
else
    echo -e "${YELLOW}⚠️  No active round found. Creating one...${NC}"
    CREATE_ROUND=$(curl -s -X POST "$API_URL/admin/lottery/create-round" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json")
    
    if echo "$CREATE_ROUND" | grep -q "roundNumber"; then
        echo -e "${GREEN}✅ Created new active round${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not create round via API (may need admin access)${NC}"
        echo "   The backend should auto-create a round on startup"
    fi
fi
echo ""

# Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test Data Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📋 Summary:"
echo "   • User ID: $MOCK_USER_ID"
echo "   • Balance: Check in frontend (should be 100,000 KYAT if admin access works)"
echo "   • Active Round: Should exist (auto-created on backend startup)"
echo ""
echo "🧪 Next Steps:"
echo "   1. Open frontend: http://localhost:5173"
echo "   2. You should see:"
echo "      - Active round with countdown"
echo "      - Your balance (if admin adjustment worked)"
echo "      - Clickable buy buttons"
echo ""
echo "   If buy buttons are still disabled:"
echo "   • Check browser console for errors"
echo "   • Verify active round exists: curl $API_URL/lottery/active"
echo "   • Add $MOCK_USER_ID to ADMIN_TELEGRAM_IDS in .env and restart backend"
echo ""

