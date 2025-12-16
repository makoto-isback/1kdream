# Local Testing Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL installed and running
- Git repository cloned

## Quick Start

### 1. Install Dependencies

```bash
# Root level
npm install

# Backend
cd apps/backend-api
npm install

# Frontend
cd ../frontend-miniapp
npm install
```

### 2. Setup Database

See [DATABASE_SETUP.md](./apps/backend-api/DATABASE_SETUP.md) for detailed instructions.

Quick version:
```bash
# Create database
createdb -U postgres adream

# Copy env file
cd apps/backend-api
cp .env.example .env

# Edit .env and set:
# - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adream
# - JWT_SECRET=any-random-string-for-dev
# - TON_NETWORK=testnet
# - HOT_WALLET_ADDRESS=any-address-for-dev
# - USDT_JETTON_MASTER=any-address-for-dev
```

### 3. Start Backend

```bash
cd apps/backend-api
npm run start:dev
```

Expected output:
```
✅ Environment variables validated
🚀 Server running on port 3000
🔧 Development mode: TON listener disabled
```

Backend will be available at: `http://localhost:3000`

### 4. Start Frontend

```bash
cd apps/frontend-miniapp
npm run dev
```

Expected output:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

Frontend will be available at: `http://localhost:5173`

**Note:** You'll see a yellow "🔧 DEV MODE" banner at the top indicating mock Telegram mode.

---

## Testing Flows

### 1. Authentication (Automatic)

- Frontend automatically logs in with mock Telegram user in dev mode
- User ID: `123456789`
- Username: `devuser`
- No real Telegram required

### 2. Buy Numbers (Single Buy)

1. Open frontend: `http://localhost:5173`
2. Select numbers (1-25) by clicking on the grid
3. Enter amount (minimum 1,000 KYAT)
4. Click "Buy Numbers"
5. Verify balance decreases
6. Check points increase (10 points per 1,000 KYAT)

**Expected:**
- Balance deducted immediately
- Points added
- Bet appears in user's bet history

### 3. Auto Buy

1. Select numbers (1-10 blocks max)
2. Enter amount per block (minimum 1,000 KYAT)
3. Set number of rounds (e.g., 5)
4. Switch to "Auto Buy" mode
5. Click "Buy Numbers"
6. Verify total locked amount = (amount × blocks × rounds)

**Expected:**
- Balance locked for all rounds
- AutoBuy plan created
- Plan executes automatically each hour (when lottery draws)

**Cancel Auto Buy:**
- View active plans (if UI available)
- Cancel plan
- Verify unused rounds refunded

### 4. Deposit (Manual Confirmation)

Since TON listener is disabled in dev:

1. **Get Deposit Address:**
   - Open Wallet modal
   - Click "Deposit"
   - Copy TON address and memo

2. **Create Deposit Record (Admin):**
   ```bash
   # Use admin endpoint or database
   # POST /admin/deposits/confirm
   # Or manually insert into database
   ```

3. **Manual Confirmation:**
   - Admin confirms deposit via API
   - User balance increases
   - Deposit status: `pending` → `confirmed`

**Test Direct Deposit (with memo):**
- Create deposit request (generates memo)
- Admin confirms with matching memo
- Auto-credits to user

**Test Pending Manual (no memo):**
- Create deposit from unknown address
- Status: `pending_manual`
- Admin reviews and confirms manually

### 5. Withdrawal

1. **Request Withdrawal:**
   - Open Wallet modal
   - Click "Withdraw"
   - Enter amount (minimum 5,000 KYAT)
   - Enter TON address (if not registered)
   - Click "Request Withdrawal"

2. **Verify:**
   - Balance deducted immediately
   - Withdrawal status: `pending`
   - 1-hour delay enforced (backend)

3. **Admin Processing:**
   - Admin processes after 1 hour
   - Status: `pending` → `processing` → `completed`
   - TON transaction executed (manual in dev)

**Daily Limit Test:**
- Request withdrawal: 500,000 KYAT (max daily)
- Try another withdrawal (should fail)
- Verify error message

### 6. Points Redemption

1. Accumulate points (by buying numbers)
2. Open Points modal
3. Enter points to redeem (minimum 10,000)
4. Click "Redeem"
5. Verify:
   - Points deducted
   - Balance increased (1,000 points = 1,000 KYAT)

### 7. Lottery Round

**Automatic:**
- New round created every hour
- Draw happens automatically
- Winners get proportional payout
- No winners: 90% refunded

**Manual Testing:**
- Use admin endpoint to trigger draw early
- Or wait for hourly cron job

---

## Admin Actions

### Make User Admin

```sql
UPDATE users SET "isAdmin" = true WHERE "telegramId" = '123456789';
```

### Confirm Deposit

```bash
# Using curl
curl -X POST http://localhost:3000/admin/deposits/confirm \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "depositId": "deposit-uuid",
    "tonTxHash": "mock-tx-hash-123"
  }'
```

### Process Withdrawal

```bash
# Process withdrawal
curl -X POST http://localhost:3000/admin/withdrawals/process \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "withdrawalId": "withdrawal-uuid",
    "tonTxHash": "mock-tx-hash-456"
  }'
```

### Manual Balance Adjustment

```bash
curl -X POST http://localhost:3000/admin/manual-adjust \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid",
    "amount": 10000,
    "type": "credit",
    "reason": "Testing"
  }'
```

### System Settings

```bash
# Pause betting
curl -X PUT http://localhost:3000/admin/system-settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bettingPaused": true
  }'
```

---

## Common Issues

### Backend Won't Start

**Missing env vars:**
- Check `.env` file exists
- Verify all required variables are set
- See `.env.example` for reference

**Database connection error:**
- Verify PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` in `.env`
- Ensure database exists: `psql -U postgres -l | grep adream`

### Frontend Won't Connect

**CORS error:**
- Verify backend CORS allows `http://localhost:5173`
- Check backend is running on port 3000

**API errors:**
- Check browser console for errors
- Verify `VITE_API_URL` in frontend (defaults to `http://localhost:3000`)

### Mock Telegram Not Working

- Verify `import.meta.env.DEV === true`
- Check browser console for "DEV MODE" warnings
- Ensure you're running `npm run dev` (not `npm run build`)

---

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Mock Telegram user logs in automatically
- [ ] Can buy numbers (single buy)
- [ ] Can create auto buy plan
- [ ] Can cancel auto buy plan
- [ ] Can request withdrawal
- [ ] Can redeem points
- [ ] Deposit memo generation works
- [ ] Admin can confirm deposits
- [ ] Admin can process withdrawals
- [ ] Lottery rounds create automatically
- [ ] Business rules enforced (min/max limits)

---

## Safety Reminders

✅ **Development Mode:**
- TON listener is DISABLED
- No real TON transactions
- Mock Telegram user
- Manual deposit/withdrawal confirmation

❌ **DO NOT:**
- Connect to mainnet
- Enable auto-withdraw
- Remove withdrawal delay
- Change business limits
- Use production JWT_SECRET

---

## Next Steps

After local testing:
1. Test with real Telegram Mini App (deploy to testnet)
2. Test TON USDT deposits (testnet)
3. Test withdrawal execution (testnet)
4. Load testing
5. Security audit

---

**Happy Testing! 🚀**

