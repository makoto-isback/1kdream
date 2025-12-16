# 🧪 ADream Testing Guide

This guide helps you test all features of the ADream lottery app locally.

## ✅ What's Been Set Up

1. **Auto-Round Creation**: Backend automatically creates an active lottery round on startup if none exists
2. **Test Setup Script**: `./setup-test-data.sh` - Automatically sets up test data

## 🚀 Quick Start

### 1. Start Backend & Frontend

```bash
# Terminal 1: Backend
cd apps/backend-api
npm run start:dev

# Terminal 2: Frontend  
cd apps/frontend-miniapp
npm run dev
```

### 2. Run Test Setup Script

```bash
./setup-test-data.sh
```

This script will:
- Authenticate as mock user (ID: 123456789)
- Add 100,000 KYAT balance (if admin access works)
- Verify/create active round

**Note**: If balance adjustment fails, you may need to add the mock user ID to `ADMIN_TELEGRAM_IDS` in `.env`.

### 3. Open Frontend

Open http://localhost:5173 in your browser.

You should see:
- ✅ Active round with countdown
- ✅ Your balance (if setup script worked)
- ✅ Clickable buy buttons

---

## 📋 Test Scenarios

### Test 1 — Basic Flow (5 min)

1. Open frontend: http://localhost:5173
2. Confirm you are logged in as mock user (check top right)
3. Check balance = 0 or 100,000 (depending on setup)
4. Test language toggle (EN / MM) - should work

**Expected**: UI loads, language toggle works, user is logged in

---

### Test 2 — Buy Flow

**Prerequisites**: 
- Active round exists (auto-created on startup)
- User has balance (run setup script or manually add)

**Steps**:
1. Select 1 number (e.g., block 1)
2. Enter amount: 1000 KYAT
3. Click "Buy Numbers"
4. Verify balance decreases by 1000 KYAT
5. Verify points increase by 10 (10 points per bet)

**Validation Tests**:
- Try to buy < 1,000 KYAT → should show error
- Try to buy more than 10 times in same round → should show error
- Try to buy more than 100,000 KYAT total in round → should show error

**Expected**: 
- ✅ Buy succeeds with valid inputs
- ✅ Validation errors show for invalid inputs
- ✅ Balance and points update correctly

---

### Test 3 — Auto Buy

**Steps**:
1. Select 2-3 blocks (e.g., blocks 1, 2, 3)
2. Switch to "Auto Buy" tab
3. Enter amount per block: 1000 KYAT
4. Set rounds: 3
5. Confirm total cost (should be 1000 × 3 × 3 = 9,000 KYAT)
6. Click "Buy Numbers"
7. Verify balance decreases by 9,000 KYAT
8. Check "Your Stake" section - should show active auto-buy plan

**Cancel Test**:
1. Find your active auto-buy plan
2. Click "Cancel"
3. Verify unused rounds are refunded
4. Verify balance increases by refund amount

**Expected**:
- ✅ Auto-buy plan created successfully
- ✅ Balance deducted upfront
- ✅ Can cancel mid-way
- ✅ Unused rounds refunded correctly

---

### Test 4 — Withdrawal

**Prerequisites**: User has balance

**Steps**:
1. Open Wallet modal
2. Go to "Withdraw" tab
3. Enter amount: 10,000 KYAT
4. Enter TON address: `EQCD39VS5jcptHL8vMjEXrzGaRcApWGnDZHWk59_J-mZQzT4` (test address)
5. Click "Request Withdrawal"
6. Verify balance decreases
7. Verify withdrawal status = "pending"
8. Check withdrawal shows 1-hour delay

**Validation Test**:
- Try to request another withdrawal within 1 hour → should fail with error

**Admin Approval** (Manual):
```bash
# Get pending withdrawals
curl -X GET http://localhost:3000/admin/withdrawals/pending \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Execute withdrawal (simulates TON transaction)
curl -X POST http://localhost:3000/admin/withdrawals/WITHDRAWAL_ID/complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected**:
- ✅ Withdrawal request created
- ✅ Balance deducted
- ✅ Status = pending
- ✅ Cannot request again within 1 hour
- ✅ Admin can execute withdrawal

---

### Test 5 — Admin Actions

**Prerequisites**: Mock user ID (123456789) added to `ADMIN_TELEGRAM_IDS` in `.env`

**Manual Balance Adjust**:
```bash
# Get JWT token (from browser localStorage after login)
TOKEN="your_jwt_token_here"

# Add balance
curl -X POST http://localhost:3000/admin/manual-adjust \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123456789",
    "amount": 50000,
    "type": "credit",
    "reason": "Test balance"
  }'
```

**Confirm Deposit** (Manual):
```bash
# Get deposit ID from deposits list
curl -X GET http://localhost:3000/admin/deposits \
  -H "Authorization: Bearer $TOKEN"

# Confirm deposit
curl -X POST http://localhost:3000/admin/deposits/DEPOSIT_ID/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tonTxHash": "mock_tx_hash_12345",
    "userId": "123456789"
  }'
```

**Expected**:
- ✅ Balance adjustment works
- ✅ Deposit confirmation credits user
- ✅ All admin endpoints accessible

---

## 🔧 Troubleshooting

### Buy Buttons Not Clickable

**Check**:
1. Is there an active round? → `curl http://localhost:3000/lottery/active`
2. Is user logged in? → Check browser console
3. Does user have balance? → Check wallet modal

**Fix**:
- If no round: Backend should auto-create on startup. Check backend logs.
- If no balance: Run `./setup-test-data.sh` or manually add balance via admin endpoint

### Round Shows But Buttons Disabled

**Cause**: `disabled={buying || !user || !activeRound}`

**Check**:
- Browser console for errors
- Network tab for failed API calls
- Verify `user` and `activeRound` are not null

### Setup Script Fails

**If admin access fails**:
1. Add `123456789` to `ADMIN_TELEGRAM_IDS` in `apps/backend-api/.env`
2. Restart backend
3. Run script again

**If authentication fails**:
- Check backend is running
- Check backend logs for errors

---

## 📝 Notes

- **Mock User ID**: `123456789` (hardcoded in frontend dev mode)
- **Default Balance**: 0 (add via admin endpoint or setup script)
- **Round Duration**: 1 hour (auto-created rounds)
- **Min Buy**: 1,000 KYAT
- **Max Buy per Round**: 100,000 KYAT
- **Max Buys per Round**: 10

---

## ✅ Success Criteria

After completing all tests, you should have verified:
- ✅ User can buy numbers (single)
- ✅ User can create auto-buy plans
- ✅ User can cancel auto-buy plans
- ✅ User can request withdrawals
- ✅ Validation prevents invalid actions
- ✅ Admin can adjust balances
- ✅ Admin can confirm deposits
- ✅ All UI elements work correctly
- ✅ Language toggle works
- ✅ Countdown updates correctly

---

**Happy Testing! 🎉**
